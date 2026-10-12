import { NextResponse } from 'next/server';
import { fail } from '@/lib/auth/session';
import { activeProfiles, toPublicPsychologist } from '@/lib/public-profiles';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) return fail(400, 'INVALID_ID', 'ID tidak valid');

    const { data, error } = await activeProfiles('psikolog_profiles').eq('user_id', id).maybeSingle();
    if (error) return fail(500, 'QUERY_FAILED', error.message);
    if (!data) return fail(404, 'NOT_FOUND', 'Psikolog tidak ditemukan');

    return NextResponse.json({ success: true, data: toPublicPsychologist(data) });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}
