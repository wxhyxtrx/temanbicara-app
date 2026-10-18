import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail, getSessionUser } from '@/lib/auth/session';
import { createBookingSchema, bookingQuerySchema } from '@/lib/validations/booking';
import { toPsikologBookingView } from '@/lib/booking/views';
import type { BookingEntity, PatientBookingView, PsychologistSummary, PsikologBookingReview } from '@/types/booking';

/**
 * POST /api/bookings
 * Membuat pemesanan sesi konseling baru (khusus pasien aktif).
 * Mengunci slot dan mendebit koin secara atomik melalui RPC booking_create.
 */
export async function POST(req: Request) {
  try {
    const session = await getSessionUser();
    if (session.response) return session.response;
    const { user } = session;

    if (user.status !== 'active') {
      return fail(403, 'USER_NOT_ACTIVE', 'Akun Anda tidak aktif');
    }

    if (user.role !== 'pasien') {
      return fail(403, 'FORBIDDEN', 'Hanya pengguna dengan peran pasien yang dapat memesan sesi konseling');
    }

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    const rawBody = await req.json().catch(() => null);
    const parsed = createBookingSchema.safeParse(rawBody);
    if (!parsed.success) {
      return fail(422, 'VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Data input tidak valid');
    }

    const bookingId = crypto.randomUUID();
    const { data: booking, error: rpcError } = await supabaseAdmin.rpc('booking_create', {
      p_booking_id: bookingId,
      p_patient_id: user.id,
      p_psikolog_id: parsed.data.psikolog_id,
      p_start_at: parsed.data.start_at,
      p_keluhan: parsed.data.keluhan,
    });

    if (rpcError) {
      const msg = rpcError.message || '';
      if (msg.includes('INSUFFICIENT_COINS')) {
        return fail(402, 'INSUFFICIENT_COINS', 'Saldo koin tidak mencukupi untuk memesan sesi konseling ini');
      }
      if (msg.includes('SLOT_UNAVAILABLE')) {
        return fail(409, 'SLOT_UNAVAILABLE', 'Slot jadwal sudah tidak tersedia atau baru saja dipesan orang lain');
      }
      if (msg.includes('LIMIT_ACTIVE')) {
        return fail(409, 'LIMIT_ACTIVE', 'Anda telah mencapai batas maksimum 3 sesi booking aktif');
      }
      if (msg.includes('LIMIT_DAILY')) {
        return fail(409, 'LIMIT_DAILY', 'Anda telah memiliki jadwal dengan psikolog ini di hari kalender yang sama');
      }
      if (msg.includes('PSIKOLOG_UNAVAILABLE')) {
        return fail(409, 'PSIKOLOG_UNAVAILABLE', 'Psikolog sedang tidak menerima booking atau dalam masa jeda/penalti');
      }
      if (msg.includes('CANNOT_BOOK_SELF')) {
        return fail(400, 'CANNOT_BOOK_SELF', 'Tidak dapat memesan sesi untuk diri sendiri');
      }
      if (msg.includes('INVALID_KELUHAN')) {
        return fail(422, 'INVALID_KELUHAN', 'Keluhan wajib terdiri dari 20 hingga 1000 karakter');
      }
      return fail(400, 'BOOKING_FAILED', msg);
    }

    return NextResponse.json({ success: true, data: booking as BookingEntity }, { status: 201 });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}

/**
 * GET /api/bookings?scope=upcoming|history&page=1&limit=10
 * Mengambil daftar booking milik pengguna yang sedang login.
 * Role-aware:
 * - Pasien: Melihat booking miliknya lengkap dengan profil ringkas psikolog
 * - Psikolog: Melihat booking miliknya yang telah disaring (tanpa data pribadi pasien)
 * - Admin: Melihat daftar booking dengan pagination
 */
export async function GET(req: Request) {
  try {
    const session = await getSessionUser();
    if (session.response) return session.response;
    const { user } = session;

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    const url = new URL(req.url);
    const queryParsed = bookingQuerySchema.safeParse({
      scope: url.searchParams.get('scope') || undefined,
      page: url.searchParams.get('page') || undefined,
      limit: url.searchParams.get('limit') || undefined,
    });

    if (!queryParsed.success) {
      return fail(422, 'VALIDATION_ERROR', queryParsed.error.issues[0]?.message || 'Parameter query tidak valid');
    }

    const { scope, page, limit } = queryParsed.data;
    const from = (page - 1) * limit;
    const to = page * limit - 1;

    let query = supabaseAdmin.from('bookings').select('*', { count: 'exact' });

    // Filter berdasarkan peran pengguna
    if (user.role === 'pasien') {
      query = query.eq('patient_id', user.id);
    } else if (user.role === 'psikolog') {
      query = query.eq('psikolog_id', user.id);
    } else if (user.role !== 'admin') {
      return fail(403, 'FORBIDDEN', 'Akses ditolak');
    }

    // Filter scope status
    if (scope === 'upcoming') {
      query = query
        .in('status', ['booked', 'in_progress', 'awaiting_patient_choice'])
        .order('start_at', { ascending: true });
    } else if (scope === 'history') {
      query = query
        .in('status', ['completed', 'cancelled_by_patient', 'cancelled_by_psikolog', 'auto_cancelled_late', 'no_show'])
        .order('start_at', { ascending: false });
    } else {
      query = query.order('start_at', { ascending: false });
    }

    const { data: rows, count, error: selectError } = await query.range(from, to);

    if (selectError) {
      return fail(500, 'QUERY_FAILED', selectError.message);
    }

    const bookingList = (rows || []) as BookingEntity[];
    const totalCount = count ?? bookingList.length;

    // Jika yang meminta adalah psikolog, lakukan penyaringan ketat bebas data pribadi pasien
    if (user.role === 'psikolog') {
      const bookingIds = bookingList.map((b) => b.id);
      const reviewMap = new Map<string, PsikologBookingReview>();

      if (bookingIds.length > 0) {
        const { data: revs } = await supabaseAdmin
          .from('session_reviews')
          .select('booking_id, rating, review, reported_at, created_at')
          .in('booking_id', bookingIds);

        for (const r of revs || []) {
          reviewMap.set(r.booking_id, {
            rating: r.rating,
            review: r.review,
            reported_at: r.reported_at,
            created_at: r.created_at,
          });
        }
      }

      const sanitized = bookingList.map((b) =>
        toPsikologBookingView(b, reviewMap.get(b.id) ?? null)
      );
      return NextResponse.json({
        success: true,
        data: sanitized,
        pagination: { page, limit, total: totalCount },
      });
    }

    // Jika yang meminta adalah pasien, lakukan hydration ringkasan data psikolog
    if (user.role === 'pasien' && bookingList.length > 0) {
      const psikologIds = Array.from(new Set(bookingList.map((b) => b.psikolog_id)));

      const [profilesRes, usersRes] = await Promise.all([
        supabaseAdmin
          .from('psikolog_profiles')
          .select('user_id, nama_lengkap_gelar, nomor_sipp_str, spesialisasi, tahun_pengalaman, tarif_sesi')
          .in('user_id', psikologIds),
        supabaseAdmin
          .from('users')
          .select('id, avatar_url')
          .in('id', psikologIds),
      ]);

      const avatarMap = new Map<string, string | null>();
      for (const u of usersRes.data || []) {
        avatarMap.set(u.id, u.avatar_url);
      }

      const summaryMap = new Map<string, PsychologistSummary>();
      for (const p of profilesRes.data || []) {
        summaryMap.set(p.user_id, {
          id: p.user_id,
          nama_lengkap_gelar: p.nama_lengkap_gelar,
          nomor_sipp_str: p.nomor_sipp_str,
          spesialisasi: p.spesialisasi || [],
          tahun_pengalaman: Number(p.tahun_pengalaman || 0),
          avatar_url: avatarMap.get(p.user_id) ?? null,
          tarif_sesi: Number(p.tarif_sesi || 0),
        });
      }

      const patientViews: PatientBookingView[] = bookingList.map((b) => ({
        ...b,
        psikolog: summaryMap.get(b.psikolog_id),
      }));

      return NextResponse.json({
        success: true,
        data: patientViews,
        pagination: { page, limit, total: totalCount },
      });
    }

    return NextResponse.json({
      success: true,
      data: bookingList,
      pagination: { page, limit, total: totalCount },
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}
