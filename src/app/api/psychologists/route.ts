import { NextResponse } from 'next/server';
import { fail, pageParams } from '@/lib/auth/session';
import {
  activeProfiles,
  getPsychologistsAttendance,
  getPsychologistsRatings,
  toPublicPsychologist,
} from '@/lib/public-profiles';

export async function GET(req: Request) {
  try {
    const { page, limit, from, to } = pageParams(new URL(req.url));
    const { data, error, count } = await activeProfiles('psikolog_profiles')
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) {
      console.error('[PSYCHOLOGISTS_GET_QUERY_ERROR]:', error);
      return fail(500, 'QUERY_FAILED', 'Gagal memuat daftar psikolog');
    }

    const rows = data ?? [];
    const psychologistIds = rows.map((r) => r.user_id);
    const [attendanceMap, ratingsMap] = await Promise.all([
      getPsychologistsAttendance(psychologistIds),
      getPsychologistsRatings(psychologistIds),
    ]);

    return NextResponse.json({
      success: true,
      data: rows.map((r) =>
        toPublicPsychologist(r, attendanceMap[r.user_id] ?? null, ratingsMap[r.user_id])
      ),
      meta: { page, limit, total: count ?? 0 },
    });
  } catch (err: unknown) {
    console.error('[PSYCHOLOGISTS_GET_INTERNAL_ERROR]:', err);
    return fail(500, 'INTERNAL_ERROR', 'Terjadi kesalahan sistem saat memuat daftar psikolog');
  }
}

