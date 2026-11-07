import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail, getSessionUser } from '@/lib/auth/session';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const crisisReportSchema = z.object({
  note: z
    .string()
    .max(500, 'Catatan laporan krisis maksimal 500 karakter')
    .optional()
    .nullable(),
});

const ACTIVE_BOOKING_STATUSES = ['booked', 'in_progress', 'confirmed'];

/**
 * POST /api/bookings/[id]/crisis-report
 * Pelaporan manual krisis keselamatan pasien oleh psikolog pendamping.
 * Akses: Khusus psikolog pemilik booking aktif.
 * Mematuhi aturan 1 alert terbuka:
 * - Jika sudah ada alert 'new': naikkan hit_count.
 * - Jika belum ada: buat baris baru di public.crisis_alerts & kirim notifikasi ke admin dan pasien.
 */
export async function POST(
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

    if (user.role !== 'psikolog') {
      return fail(403, 'FORBIDDEN', 'Hanya psikolog yang berwenang melaporkan krisis sesi');
    }
    if (user.status !== 'active') {
      return fail(403, 'FORBIDDEN', 'Akun psikolog belum aktif');
    }

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    const rawBody = await req.json().catch(() => ({}));
    const parsed = crisisReportSchema.safeParse(rawBody);
    if (!parsed.success) {
      return fail(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Data tidak valid');
    }

    const note = parsed.data.note?.trim() || null;

    // Verifikasi data booking
    const { data: booking, error: bookingErr } = await supabaseAdmin
      .from('bookings')
      .select('id, patient_id, psikolog_id, status')
      .eq('id', id)
      .maybeSingle();

    if (bookingErr) {
      console.error('[BOOKING_CRISIS_REPORT_FIND_ERROR]:', bookingErr.code || bookingErr.message);
      return fail(500, 'QUERY_FAILED', 'Gagal memverifikasi data booking');
    }
    if (!booking) {
      return fail(404, 'NOT_FOUND', 'Booking tidak ditemukan');
    }

    if (booking.psikolog_id !== user.id) {
      return fail(403, 'FORBIDDEN', 'Hanya psikolog pemilik booking ini yang dapat melaporkan krisis');
    }

    if (!ACTIVE_BOOKING_STATUSES.includes(booking.status)) {
      return fail(400, 'INVALID_BOOKING_STATUS', 'Pelaporan krisis hanya dapat dilakukan pada sesi yang aktif');
    }

    // Aturan 1 alert terbuka: periksa apakah ada alert berstatus 'new'
    const { data: existingAlert, error: existingErr } = await supabaseAdmin
      .from('crisis_alerts')
      .select('id, hit_count')
      .eq('booking_id', id)
      .eq('status', 'new')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingErr) {
      console.error('[BOOKING_CRISIS_REPORT_CHECK_ERROR]:', existingErr.code || existingErr.message);
      return fail(500, 'QUERY_FAILED', 'Gagal memeriksa status alert krisis');
    }

    if (existingAlert) {
      // Perbarui hit_count jika alert berstatus 'new' sudah ada
      const { error: updateErr } = await supabaseAdmin
        .from('crisis_alerts')
        .update({ hit_count: (existingAlert.hit_count || 1) + 1 })
        .eq('id', existingAlert.id);

      if (updateErr) {
        console.error('[BOOKING_CRISIS_REPORT_HIT_UPDATE_ERROR]:', updateErr.code || updateErr.message);
        return fail(500, 'UPDATE_FAILED', 'Gagal memperbarui laporan krisis');
      }
    } else {
      // Buat baris baru di public.crisis_alerts
      const snippet = (note || 'Laporan krisis manual oleh psikolog').slice(0, 100);
      const { error: insertErr } = await supabaseAdmin
        .from('crisis_alerts')
        .insert({
          source: 'booking',
          booking_id: id,
          ticket_id: null,
          patient_id: booking.patient_id,
          detected_by: 'manual',
          reporter_id: user.id,
          category: 'self_harm_risk',
          snippet,
          hit_count: 1,
          status: 'new',
        });

      if (insertErr) {
        console.error('[BOOKING_CRISIS_REPORT_INSERT_ERROR]:', insertErr.code || insertErr.message);
        return fail(500, 'INSERT_FAILED', 'Gagal mencatat laporan krisis');
      }

      // Kirim notifikasi crisis_alert ke seluruh admin aktif dan crisis_support ke pasien
      try {
        const { data: adminUsers } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('role', 'admin')
          .eq('status', 'active');

        const notifications = [
          ...((adminUsers || []).map((adm) => ({
            user_id: adm.id,
            type: 'crisis_alert',
            title: 'Peringatan Krisis Pasien',
            body: 'Terdeteksi indikasi krisis keselamatan diri pasien yang membutuhkan penanganan segera.',
            link: '/admin/crisis-feed',
          }))),
          {
            user_id: booking.patient_id,
            type: 'crisis_support',
            title: 'Bantuan Selalu Ada Untukmu',
            body: 'Kamu tidak sendirian. Jika butuh bantuan segera, hubungi hotline darurat 119 ext 8 (Pencegahan Bunuh Diri) atau 112 (Panggilan Darurat). Kami peduli padamu.',
            link: null,
          },
        ];

        if (notifications.length > 0) {
          await supabaseAdmin.from('notifications').insert(notifications);
        }
      } catch (notifErr: unknown) {
        console.error('[BOOKING_CRISIS_REPORT_NOTIF_ERROR]:', notifErr instanceof Error ? notifErr.message : 'Unknown notif error');
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Laporan krisis berhasil dicatat',
    });
  } catch (err: unknown) {
    console.error('[BOOKING_CRISIS_REPORT_INTERNAL_ERROR]:', err instanceof Error ? err.message : 'Unknown error');
    return fail(500, 'INTERNAL_ERROR', 'Terjadi kesalahan sistem saat memproses laporan krisis');
  }
}
