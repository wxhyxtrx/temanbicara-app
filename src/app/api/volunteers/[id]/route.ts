import { NextResponse } from 'next/server';
import { fail } from '@/lib/auth/session';
import { activeProfiles, toPublicVolunteer } from '@/lib/public-profiles';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) return fail(400, 'INVALID_ID', 'ID tidak valid');

    const { data, error } = await activeProfiles('relawan_profiles').eq('user_id', id).maybeSingle();
    if (error) {
      console.error('[VOLUNTEERS_GET_BY_ID_QUERY_ERROR]:', error);
      return fail(500, 'QUERY_FAILED', 'Gagal memuat data relawan');
    }
    if (!data) return fail(404, 'NOT_FOUND', 'Relawan tidak ditemukan');

    return NextResponse.json({ success: true, data: toPublicVolunteer(data) });
  } catch (err: unknown) {
    console.error('[VOLUNTEERS_GET_BY_ID_INTERNAL_ERROR]:', err);
    return fail(500, 'INTERNAL_ERROR', 'Terjadi kesalahan sistem saat memuat data relawan');
  }
}
