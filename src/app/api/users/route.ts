import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { getSessionUser, fail, pageParams, sanitizeSearch } from '@/lib/auth/session';

const ROLES = ['pasien', 'relawan', 'psikolog', 'admin'];
const STATUSES = [
  'active',
  'unverified_email',
  'incomplete_profile',
  'pending_approval',
  'pending_verification',
  'rejected',
  'suspended',
];

const NAME_COLUMNS = [
  ['pasien_profiles', 'nama_lengkap'],
  ['relawan_profiles', 'nama_lengkap'],
  ['psikolog_profiles', 'nama_lengkap_gelar'],
  ['admin_profiles', 'nama_lengkap'],
] as const;

interface AdminUserQueryResult {
  id: string;
  email: string;
  no_wa: string | null;
  role: string;
  status: string;
  avatar_url: string | null;
  is_email_verified: boolean;
  created_at: string;
  pasien_profiles?: { nama_lengkap: string } | null;
  relawan_profiles?: { nama_lengkap: string } | null;
  psikolog_profiles?: { nama_lengkap_gelar: string; verified_at: string | null } | null;
  admin_profiles?: { nama_lengkap: string; level: string } | null;
}

export async function GET(req: Request) {
  try {
    const session = await getSessionUser();
    if (session.response) return session.response;
    if (session.user.role !== 'admin' || session.user.status !== 'active') {
      return fail(403, 'FORBIDDEN', 'Hanya admin yang dapat mengakses data ini');
    }

    const url = new URL(req.url);
    const role = url.searchParams.get('role');
    const status = url.searchParams.get('status');
    const search = sanitizeSearch(url.searchParams.get('search'));
    if (role && !ROLES.includes(role)) return fail(400, 'VALIDATION_ERROR', 'Parameter role tidak valid');
    if (status && !STATUSES.includes(status)) return fail(400, 'VALIDATION_ERROR', 'Parameter status tidak valid');
    const { page, limit, from, to } = pageParams(url, 20);

    let query = supabaseAdmin
      .from('users')
      .select(
        'id, email, no_wa, role, status, avatar_url, is_email_verified, created_at, ' +
          'pasien_profiles(nama_lengkap), relawan_profiles(nama_lengkap), ' +
          'psikolog_profiles(nama_lengkap_gelar, verified_at), admin_profiles(nama_lengkap, level)',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to);
    if (role) query = query.eq('role', role);
    if (status) query = query.eq('status', status);

    if (search) {
      // Nama ada di 4 tabel profil berbeda: kumpulkan user_id yang cocok, lalu OR dengan email/no_wa
      const nameHits = await Promise.all(
        NAME_COLUMNS.map(([table, col]) =>
          supabaseAdmin.from(table).select('user_id').ilike(col, `%${search}%`).limit(200)
        )
      );
      const ids = nameHits.flatMap((r) => (r.data ?? []).map((row) => row.user_id as string));
      const filters = [`email.ilike.%${search}%`, `no_wa.ilike.%${search}%`];
      if (ids.length) filters.push(`id.in.(${ids.join(',')})`);
      query = query.or(filters.join(','));
    }

    const { data, error, count } = await query;
    if (error) return fail(500, 'QUERY_FAILED', error.message);

    const rows = (data ?? []) as unknown as AdminUserQueryResult[];
    return NextResponse.json({
      success: true,
      data: rows.map(({ pasien_profiles, relawan_profiles, psikolog_profiles, admin_profiles, ...u }) => {
        const profile = pasien_profiles ?? relawan_profiles ?? psikolog_profiles ?? admin_profiles ?? null;
        const profileWithName = profile as { nama_lengkap?: string; nama_lengkap_gelar?: string } | null;
        return {
          ...u,
          fullName: profileWithName?.nama_lengkap_gelar ?? profileWithName?.nama_lengkap ?? u.email.split('@')[0],
          profile,
        };
      }),
      meta: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) },
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}
