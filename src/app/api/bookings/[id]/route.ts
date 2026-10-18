import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail, getSessionUser } from '@/lib/auth/session';
import { toPsikologBookingView } from '@/lib/booking/views';
import type { BookingEntity, PatientBookingView, PsychologistSummary } from '@/types/booking';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/bookings/[id]
 * Mengambil detail satu booking sesi konseling.
 * Akses dibatasi hanya untuk pasien pemilik, psikolog yang bertugas, atau admin.
 * Data yang diterima psikolog disaring ketat (bebas dari data pribadi pasien).
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

    const { data: booking, error: selectError } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (selectError) {
      return fail(500, 'QUERY_FAILED', selectError.message);
    }
    if (!booking) {
      return fail(404, 'NOT_FOUND', 'Booking tidak ditemukan');
    }

    const bookingRow = booking as BookingEntity;

    // Verifikasi otorisasi akses
    const isPatient = user.id === bookingRow.patient_id;
    const isPsikolog = user.id === bookingRow.psikolog_id;
    const isAdmin = user.role === 'admin';

    if (!isPatient && !isPsikolog && !isAdmin) {
      return fail(403, 'FORBIDDEN', 'Anda tidak memiliki hak akses untuk melihat booking ini');
    }

    // Jika diakses psikolog, kembalikan tampilan yang telah disanitasi
    if (user.role === 'psikolog') {
      const { data: rev } = await supabaseAdmin
        .from('session_reviews')
        .select('rating, review, reported_at, created_at')
        .eq('booking_id', bookingRow.id)
        .maybeSingle();

      return NextResponse.json({
        success: true,
        data: toPsikologBookingView(bookingRow, rev ?? null),
      });
    }

    // Jika diakses pasien, lengkapi dengan data ringkas profil psikolog
    if (user.role === 'pasien') {
      const [profileRes, userRes] = await Promise.all([
        supabaseAdmin
          .from('psikolog_profiles')
          .select('user_id, nama_lengkap_gelar, nomor_sipp_str, spesialisasi, tahun_pengalaman, tarif_sesi')
          .eq('user_id', bookingRow.psikolog_id)
          .maybeSingle(),
        supabaseAdmin
          .from('users')
          .select('avatar_url')
          .eq('id', bookingRow.psikolog_id)
          .maybeSingle(),
      ]);

      const psikologSummary: PsychologistSummary | undefined = profileRes.data
        ? {
            id: profileRes.data.user_id,
            nama_lengkap_gelar: profileRes.data.nama_lengkap_gelar,
            nomor_sipp_str: profileRes.data.nomor_sipp_str,
            spesialisasi: profileRes.data.spesialisasi || [],
            tahun_pengalaman: Number(profileRes.data.tahun_pengalaman || 0),
            avatar_url: userRes.data?.avatar_url ?? null,
            tarif_sesi: Number(profileRes.data.tarif_sesi || 0),
          }
        : undefined;

      const patientView: PatientBookingView = {
        ...bookingRow,
        psikolog: psikologSummary,
      };

      return NextResponse.json({
        success: true,
        data: patientView,
      });
    }

    return NextResponse.json({
      success: true,
      data: bookingRow,
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}
