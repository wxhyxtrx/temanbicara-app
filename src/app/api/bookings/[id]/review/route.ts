import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail, getSessionUser } from '@/lib/auth/session';
import { reviewUpsertSchema } from '@/lib/validations/booking';
import type { BookingEntity, SessionReviewEntity } from '@/types/booking';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/bookings/[id]/review
 * Mengambil ulasan dan rating pada sesi konseling terkait.
 * Akses: pasien pemesan, psikolog pemeriksa, atau admin.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return fail(400, 'INVALID_ID', 'ID booking tidak valid');
    }

    const session = await getSessionUser();
    if (session.response) return session.response;
    const { user } = session;

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    // Cek keberadaan booking dan hak akses partisipan/admin
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('id, patient_id, psikolog_id')
      .eq('id', id)
      .maybeSingle();

    if (bookingError) {
      return fail(500, 'QUERY_FAILED', bookingError.message);
    }
    if (!booking) {
      return fail(404, 'NOT_FOUND', 'Booking sesi tidak ditemukan');
    }

    const bookingRow = booking as BookingEntity;
    const isParticipant = bookingRow.patient_id === user.id || bookingRow.psikolog_id === user.id;
    const isAdmin = user.role === 'admin';

    if (!isParticipant && !isAdmin) {
      return fail(403, 'FORBIDDEN', 'Hanya partisipan sesi atau admin yang dapat melihat ulasan booking ini');
    }

    const { data: review, error: reviewError } = await supabaseAdmin
      .from('session_reviews')
      .select('booking_id, patient_id, psikolog_id, rating, review, is_hidden, reported_at, created_at, updated_at')
      .eq('booking_id', id)
      .maybeSingle();

    if (reviewError) {
      return fail(500, 'QUERY_FAILED', reviewError.message);
    }

    return NextResponse.json({
      success: true,
      data: (review as SessionReviewEntity | null) ?? null,
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}

/**
 * PUT /api/bookings/[id]/review
 * Pasien mengisi atau memperbarui rating (1-5) dan ulasan (maks 500 karakter).
 * Syarat: Role pasien, booking completed, dalam rating.window_days sejak ended_at.
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return fail(400, 'INVALID_ID', 'ID booking tidak valid');
    }

    const session = await getSessionUser();
    if (session.response) return session.response;
    const { user } = session;

    if (user.role !== 'pasien') {
      return fail(403, 'FORBIDDEN', 'Hanya pasien yang dapat memberikan rating dan ulasan');
    }
    if (user.status !== 'active') {
      return fail(403, 'FORBIDDEN', 'Akun pasien belum aktif');
    }

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    const rawBody = await req.json().catch(() => null);
    const parsed = reviewUpsertSchema.safeParse(rawBody);
    if (!parsed.success) {
      return fail(422, 'VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Data ulasan tidak valid');
    }

    // Panggil RPC review_upsert
    const { data: review, error: rpcError } = await supabaseAdmin.rpc('review_upsert', {
      p_booking_id: id,
      p_patient_id: user.id,
      p_rating: parsed.data.rating,
      p_review: parsed.data.review ?? null,
    });

    if (rpcError) {
      const msg = rpcError.message || '';
      if (msg.includes('BOOKING_NOT_FOUND')) {
        return fail(404, 'NOT_FOUND', 'Booking sesi tidak ditemukan');
      }
      if (msg.includes('FORBIDDEN')) {
        return fail(403, 'FORBIDDEN', 'Anda tidak memiliki hak akses untuk menilai sesi ini');
      }
      if (msg.includes('BOOKING_NOT_COMPLETED')) {
        return fail(400, 'BOOKING_NOT_COMPLETED', 'Rating hanya dapat diberikan pada sesi yang telah selesai normal');
      }
      if (msg.includes('RATING_WINDOW_EXPIRED')) {
        return fail(400, 'RATING_WINDOW_EXPIRED', 'Batas waktu pemberian rating untuk sesi ini telah berakhir');
      }
      if (msg.includes('REVIEW_TOO_LONG')) {
        return fail(422, 'REVIEW_TOO_LONG', 'Ulasan maksimal 500 karakter');
      }
      if (msg.includes('INVALID_RATING')) {
        return fail(422, 'INVALID_RATING', 'Rating harus antara 1 sampai 5');
      }
      return fail(400, 'REVIEW_FAILED', msg);
    }

    return NextResponse.json({
      success: true,
      data: review as SessionReviewEntity,
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}
