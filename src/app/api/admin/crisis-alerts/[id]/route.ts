import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail, getSessionUser } from '@/lib/auth/session';
import type { CrisisAlertItem, CrisisAlertStatus } from '@/types/crisis';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const updateCrisisAlertSchema = z.object({
  status: z.enum(['handled', 'false_alarm'], {
    message: "Status penanganan harus 'handled' atau 'false_alarm'",
  }),
  admin_note: z
    .string()
    .max(1000, 'Catatan admin maksimal 1000 karakter')
    .optional()
    .nullable(),
});

/**
 * PATCH /api/admin/crisis-alerts/[id]
 * Memperbarui status penanganan alarm krisis pasien oleh admin (ditangani / alarm palsu).
 * Menyimpan identitas admin penangan (handled_by), stempel waktu penanganan (handled_at),
 * dan catatan admin (admin_note).
 * Syarat: Role admin aktif.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return fail(400, 'INVALID_ID', 'ID alert krisis tidak valid');
    }

    const session = await getSessionUser();
    if (session.response) return session.response;
    const { user } = session;

    if (user.role !== 'admin') {
      return fail(403, 'FORBIDDEN', 'Hanya admin yang memiliki wewenang memperbarui alert krisis');
    }
    if (user.status !== 'active') {
      return fail(403, 'FORBIDDEN', 'Akun admin belum aktif');
    }

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    const rawBody = await req.json().catch(() => null);
    const parsed = updateCrisisAlertSchema.safeParse(rawBody);
    if (!parsed.success) {
      return fail(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Data tidak valid');
    }

    // 1. Verifikasi keberadaan alert krisis
    const { data: existingAlert, error: findError } = await supabaseAdmin
      .from('crisis_alerts')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (findError) {
      console.error('[ADMIN_UPDATE_CRISIS_ALERT_FIND_ERROR]:', findError.code || findError.message);
      return fail(500, 'QUERY_FAILED', 'Gagal memuat data alert krisis');
    }
    if (!existingAlert) {
      return fail(404, 'NOT_FOUND', 'Alert krisis tidak ditemukan');
    }

    // 2. Perbarui alert krisis
    const now = new Date().toISOString();
    const adminNote = parsed.data.admin_note?.trim() || null;

    const { data: updatedAlert, error: updateError } = await supabaseAdmin
      .from('crisis_alerts')
      .update({
        status: parsed.data.status,
        handled_by: user.id,
        handled_at: now,
        admin_note: adminNote,
      })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (updateError || !updatedAlert) {
      console.error('[ADMIN_UPDATE_CRISIS_ALERT_ERROR]:', updateError?.code || updateError?.message);
      return fail(500, 'UPDATE_FAILED', 'Gagal memperbarui status alert krisis');
    }

    // 3. Resolusi display name pasien & nama penangan
    let patientDisplayName = 'Pasien Anonim';
    if (updatedAlert.source === 'booking' && updatedAlert.booking_id) {
      const { data: b } = await supabaseAdmin
        .from('bookings')
        .select('patient_display_name')
        .eq('id', updatedAlert.booking_id)
        .maybeSingle();
      if (b?.patient_display_name) patientDisplayName = b.patient_display_name;
    } else if (updatedAlert.source === 'peer_ticket' && updatedAlert.ticket_id) {
      const { data: t } = await supabaseAdmin
        .from('peer_tickets')
        .select('patient_alias')
        .eq('id', updatedAlert.ticket_id)
        .maybeSingle();
      if (t?.patient_alias) patientDisplayName = t.patient_alias;
    } else if (updatedAlert.patient_id) {
      const { data: p } = await supabaseAdmin
        .from('pasien_profiles')
        .select('nama_panggilan, nama_lengkap, is_anonim_default')
        .eq('user_id', updatedAlert.patient_id)
        .maybeSingle();
      if (p) {
        if (p.is_anonim_default) {
          patientDisplayName = 'Pasien Anonim';
        } else if (p.nama_panggilan?.trim()) {
          patientDisplayName = p.nama_panggilan.trim();
        } else if (p.nama_lengkap?.trim()) {
          patientDisplayName = p.nama_lengkap.trim().split(' ')[0] || 'Pasien';
        }
      }
    }

    const { data: adminProf } = await supabaseAdmin
      .from('admin_profiles')
      .select('nama_lengkap')
      .eq('user_id', user.id)
      .maybeSingle();
    const handlerName = adminProf?.nama_lengkap || user.email.split('@')[0] || 'Admin';

    let reporterName: string | null = null;
    if (updatedAlert.reporter_id) {
      const [psikologRes, relawanRes] = await Promise.all([
        supabaseAdmin.from('psikolog_profiles').select('nama_lengkap_gelar').eq('user_id', updatedAlert.reporter_id).maybeSingle(),
        supabaseAdmin.from('relawan_profiles').select('nama_lengkap').eq('user_id', updatedAlert.reporter_id).maybeSingle(),
      ]);
      reporterName = psikologRes.data?.nama_lengkap_gelar || relawanRes.data?.nama_lengkap || 'Pendamping';
    }

    const resultItem: CrisisAlertItem = {
      id: updatedAlert.id,
      source: updatedAlert.source,
      booking_id: updatedAlert.booking_id,
      ticket_id: updatedAlert.ticket_id,
      patient_id: updatedAlert.patient_id,
      patient_display_name: patientDisplayName,
      detected_by: updatedAlert.detected_by,
      reporter_id: updatedAlert.reporter_id,
      reporter_name: reporterName,
      category: updatedAlert.category,
      snippet: updatedAlert.snippet,
      hit_count: updatedAlert.hit_count,
      status: updatedAlert.status as CrisisAlertStatus,
      handled_by: updatedAlert.handled_by,
      handler_name: handlerName,
      handled_at: updatedAlert.handled_at,
      admin_note: updatedAlert.admin_note,
      created_at: updatedAlert.created_at,
    };

    return NextResponse.json({
      success: true,
      data: resultItem,
    });
  } catch (err: unknown) {
    // Sanitasi log server: dilarang mencatat snippet atau teks krisis ke log
    console.error('[ADMIN_UPDATE_CRISIS_ALERT_INTERNAL_ERROR]:', err instanceof Error ? err.message : 'Unknown error');
    return fail(500, 'INTERNAL_ERROR', 'Terjadi kesalahan sistem saat memproses pembaruan alert krisis');
  }
}
