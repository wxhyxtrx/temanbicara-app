import { NextResponse } from 'next/server';
import { fail, pageParams } from '@/lib/auth/session';
import { activeProfiles, toPublicVolunteer } from '@/lib/public-profiles';

export async function GET(req: Request) {
  try {
    const { page, limit, from, to } = pageParams(new URL(req.url));
    const { data, error, count } = await activeProfiles('relawan_profiles')
      .order('total_sesi', { ascending: false })
      .range(from, to);
    if (error) {
      console.error('[VOLUNTEERS_GET_QUERY_ERROR]:', error);
      return fail(500, 'QUERY_FAILED', 'Gagal memuat daftar relawan');
    }

    return NextResponse.json({
      success: true,
      data: (data ?? []).map(toPublicVolunteer),
      meta: { page, limit, total: count ?? 0 },
    });
  } catch (err: unknown) {
    console.error('[VOLUNTEERS_GET_INTERNAL_ERROR]:', err);
    return fail(500, 'INTERNAL_ERROR', 'Terjadi kesalahan sistem saat memuat daftar relawan');
  }
}
