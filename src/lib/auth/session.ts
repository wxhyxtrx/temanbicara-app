import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/client';
import type { UserEntity } from '@/types/database';

const PROFILE_TABLE = {
  pasien: 'pasien_profiles',
  relawan: 'relawan_profiles',
  psikolog: 'psikolog_profiles',
  admin: 'admin_profiles',
} as const;

export const fail = (status: number, error: string, message: string) =>
  NextResponse.json({ success: false, error, message }, { status });

// Token dari cookie tb_access_token atau header Authorization: Bearer <token>
async function readToken(): Promise<string | null> {
  const bearer = (await headers()).get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  return bearer || (await cookies()).get('tb_access_token')?.value || null;
}

/**
 * Resolusi user aktif dari JWT Supabase yang terverifikasi.
 * Sengaja TIDAK menerima UUID mentah sebagai token: user id psikolog/relawan terekspos
 * di katalog publik, jadi fallback UUID = siapa pun bisa menyamar jadi user lain.
 */
export async function getSessionUser(): Promise<
  { user: UserEntity; response?: never } | { user?: never; response: NextResponse }
> {
  if (!supabaseAdmin) return { response: fail(500, 'SERVER_CONFIG_ERROR', 'Server configuration error') };

  const token = await readToken();
  if (!token) return { response: fail(401, 'UNAUTHENTICATED', 'Belum terautentikasi') };

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user) {
    return { response: fail(401, 'INVALID_TOKEN', 'Sesi tidak valid atau kedaluwarsa') };
  }

  const { data: user } = await supabaseAdmin.from('users').select('*').eq('id', authData.user.id).maybeSingle();
  if (!user) return { response: fail(404, 'USER_NOT_FOUND', 'Pengguna tidak ditemukan') };

  return { user: user as UserEntity };
}

export async function getRoleProfile(user: UserEntity) {
  const { data } = await supabaseAdmin
    .from(PROFILE_TABLE[user.role])
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  return (data as Record<string, unknown> | null) ?? null;
}

export function displayName(user: Pick<UserEntity, 'email'>, profile: Record<string, unknown> | null) {
  return (profile?.nama_lengkap_gelar || profile?.nama_lengkap || user.email.split('@')[0]) as string;
}

export function pageParams(url: URL, defaultLimit = 12) {
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || defaultLimit));
  return { page, limit, from: (page - 1) * limit, to: page * limit - 1 };
}

// Buang karakter yang punya arti di sintaks filter PostgREST .or()/ilike
export const sanitizeSearch = (s: string | null) => (s ?? '').replace(/[,()*%\\:"']/g, ' ').trim().slice(0, 100);
