import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail, getSessionUser } from '@/lib/auth/session';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Status tip milik pasien yang login untuk satu sesi (booking) atau tiket curhat.
 * Dipakai kartu tip agar setelah refresh tidak menawarkan tip kedua (DB tetap menolak lewat tips_source_once).
 */
export async function getMyTipStatus(sourceType: 'session' | 'ticket', sourceId: string) {
  if (!UUID_RE.test(sourceId)) return fail(400, 'INVALID_ID', 'ID tidak valid');

  const session = await getSessionUser();
  if (session.response) return session.response;
  if (session.user.role !== 'pasien') return fail(403, 'FORBIDDEN', 'Hanya pasien yang dapat melihat status tip');
  if (!supabaseAdmin) return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');

  const { data, error } = await supabaseAdmin
    .from('tips')
    .select('coins')
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)
    .eq('patient_id', session.user.id)
    .maybeSingle();

  if (error) {
    console.error('[TIP_STATUS_QUERY_ERROR]:', error);
    return fail(500, 'QUERY_FAILED', 'Gagal memuat status tip');
  }

  return NextResponse.json({ success: true, data: { tipped: Boolean(data), coins: data ? Number(data.coins) : null } });
}
