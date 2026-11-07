import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail, getSessionUser } from '@/lib/auth/session';
import { getMaintenanceStatus } from '@/lib/maintenance';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const crisisReportSchema = z.object({
  note: z
    .string()
    .max(500, 'Catatan laporan krisis maksimal 500 karakter')
    .optional()
    .nullable(),
});

const ACTIVE_PEER_TICKET_STATUSES = ['claimed', 'active'];

/**
 * POST /api/peer-tickets/[id]/crisis-report
 * Pelaporan manual krisis keselamatan pasien oleh relawan pendamping tiket curhat.
 * Akses: Khusus relawan pengklaim tiket aktif.
 * Mematuhi aturan 1 alert terbuka:
 * - Jika sudah ada alert 'new': naikkan hit_count.
 * - Jika belum ada: buat baris baru di public.crisis_alerts & kirim notifikasi ke admin dan pasien.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const maintenance = await getMaintenanceStatus();
    if (maintenance.phase === 'active') {
      return fail(503, 'MAINTENANCE_ACTIVE', maintenance.message);
    }

    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return fail(400, 'INVALID_ID', 'ID tiket curhat tidak valid');
    }

    const session = await getSessionUser();
    if (session.response) return session.response;
    const { user } = session;

    if (user.role !== 'relawan') {
      return fail(403, 'FORBIDDEN', 'Hanya relawan yang berwenang melaporkan krisis tiket curhat');
    }
    if (user.status !== 'active') {
      return fail(403, 'FORBIDDEN', 'Akun relawan belum aktif');
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

    // Verifikasi data tiket curhat
    const { data: ticket, error: ticketErr } = await supabaseAdmin
      .from('peer_tickets')
      .select('id, patient_id, claimed_by, status')
      .eq('id', id)
      .maybeSingle();

    if (ticketErr) {
      console.error('[PEER_TICKET_CRISIS_REPORT_FIND_ERROR]:', ticketErr.code || ticketErr.message);
      return fail(500, 'QUERY_FAILED', 'Gagal memverifikasi data tiket curhat');
    }
    if (!ticket) {
      return fail(404, 'NOT_FOUND', 'Tiket curhat tidak ditemukan');
    }

    if (ticket.claimed_by !== user.id) {
      return fail(403, 'FORBIDDEN', 'Hanya relawan pengklaim tiket ini yang dapat melaporkan krisis');
    }

    if (!ACTIVE_PEER_TICKET_STATUSES.includes(ticket.status)) {
      return fail(400, 'INVALID_TICKET_STATUS', 'Pelaporan krisis hanya dapat dilakukan pada tiket curhat yang aktif');
    }

    // Aturan 1 alert terbuka: periksa apakah ada alert berstatus 'new'
    const { data: existingAlert, error: existingErr } = await supabaseAdmin
      .from('crisis_alerts')
      .select('id, hit_count')
      .eq('ticket_id', id)
      .eq('status', 'new')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingErr) {
      console.error('[PEER_TICKET_CRISIS_REPORT_CHECK_ERROR]:', existingErr.code || existingErr.message);
      return fail(500, 'QUERY_FAILED', 'Gagal memeriksa status alert krisis');
    }

    if (existingAlert) {
      // Perbarui hit_count jika alert berstatus 'new' sudah ada
      const { error: updateErr } = await supabaseAdmin
        .from('crisis_alerts')
        .update({ hit_count: (existingAlert.hit_count || 1) + 1 })
        .eq('id', existingAlert.id);

      if (updateErr) {
        console.error('[PEER_TICKET_CRISIS_REPORT_HIT_UPDATE_ERROR]:', updateErr.code || updateErr.message);
        return fail(500, 'UPDATE_FAILED', 'Gagal memperbarui laporan krisis');
      }
    } else {
      // Buat baris baru di public.crisis_alerts
      const snippet = (note || 'Laporan krisis manual oleh relawan').slice(0, 100);
      const { error: insertErr } = await supabaseAdmin
        .from('crisis_alerts')
        .insert({
          source: 'peer_ticket',
          booking_id: null,
          ticket_id: id,
          patient_id: ticket.patient_id,
          detected_by: 'manual',
          reporter_id: user.id,
          category: 'self_harm_risk',
          snippet,
          hit_count: 1,
          status: 'new',
        });

      if (insertErr) {
        console.error('[PEER_TICKET_CRISIS_REPORT_INSERT_ERROR]:', insertErr.code || insertErr.message);
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
            user_id: ticket.patient_id,
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
        console.error('[PEER_TICKET_CRISIS_REPORT_NOTIF_ERROR]:', notifErr instanceof Error ? notifErr.message : 'Unknown notif error');
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Laporan krisis berhasil dicatat',
    });
  } catch (err: unknown) {
    console.error('[PEER_TICKET_CRISIS_REPORT_INTERNAL_ERROR]:', err instanceof Error ? err.message : 'Unknown error');
    return fail(500, 'INTERNAL_ERROR', 'Terjadi kesalahan sistem saat memproses laporan krisis');
  }
}
