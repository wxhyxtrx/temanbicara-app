import { NextResponse } from 'next/server';
import { fail, pageParams } from '@/lib/auth/session';
import { activeProfiles, toPublicVolunteer } from '@/lib/public-profiles';

export async function GET(req: Request) {
  try {
    const { page, limit, from, to } = pageParams(new URL(req.url));
    const { data, error, count } = await activeProfiles('relawan_profiles')
      .order('total_sesi', { ascending: false })
      .range(from, to);
    if (error) return fail(500, 'QUERY_FAILED', error.message);

    return NextResponse.json({
      success: true,
      data: (data ?? []).map(toPublicVolunteer),
      meta: { page, limit, total: count ?? 0 },
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}
