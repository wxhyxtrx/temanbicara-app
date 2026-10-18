import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail, getSessionUser } from '@/lib/auth/session';
import type { PatientEmergencyContactView } from '@/types/booking';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/admin/users/[id]/emergency-contact
 * Mengambil data kontak darurat pasien untuk protokol krisis klinis.
 * Syarat: Hanya admin berstatus aktif.
 * Setiap akses WAJIB mencatat entri audit log ke emergency_contact_access_log.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return fail(400, 'INVALID_ID', 'ID pengguna tidak valid');
    }

    const session = await getSessionUser();
    if (session.response) return session.response;
    const { user } = session;

    if (user.role !== 'admin') {
      return fail(403, 'FORBIDDEN', 'Hanya admin yang memiliki wewenang mengakses data kontak darurat');
    }
    if (user.status !== 'active') {
      return fail(403, 'FORBIDDEN', 'Akun admin belum aktif');
    }

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    // 1. Verifikasi keberadaan pengguna
    const { data: targetUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, role')
      .eq('id', id)
      .maybeSingle();

    if (userError) {
      return fail(500, 'QUERY_FAILED', userError.message);
    }
    if (!targetUser) {
      return fail(404, 'NOT_FOUND', 'Pengguna tidak ditemukan');
    }

    // 2. Ambil kontak darurat dari tabel pasien_profiles
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('pasien_profiles')
      .select('user_id, kontak_darurat_nama, kontak_darurat_wa')
      .eq('user_id', id)
      .maybeSingle();

    if (profileError) {
      return fail(500, 'QUERY_FAILED', profileError.message);
    }

    // 3. Catat log audit akses kontak darurat (Fail closed: jika gagal log, jangan bocorkan kontak)
    const logId = crypto.randomUUID();
    const { error: logError } = await supabaseAdmin
      .from('emergency_contact_access_log')
      .insert({
        id: logId,
        admin_id: user.id,
        patient_id: id,
      });

    if (logError) {
      return fail(500, 'AUDIT_LOG_FAILED', 'Gagal mencatat log audit akses kontak darurat: ' + logError.message);
    }

    const contactView: PatientEmergencyContactView = {
      patient_id: id,
      kontak_darurat_nama: profile?.kontak_darurat_nama ?? null,
      kontak_darurat_wa: profile?.kontak_darurat_wa ?? null,
    };

    return NextResponse.json({
      success: true,
      data: contactView,
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}
