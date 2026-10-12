import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { getSessionUser, fail, pageParams, sanitizeSearch } from '@/lib/auth/session';

const ROLES = ['pasien', 'relawan', 'psikolog', 'admin'] as const;
const STATUSES = [
  'active',
  'unverified_email',
  'incomplete_profile',
  'pending_approval',
  'pending_verification',
  'rejected',
  'suspended',
] as const;

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
    if (role && !ROLES.includes(role as (typeof ROLES)[number])) {
      return fail(400, 'VALIDATION_ERROR', 'Parameter role tidak valid');
    }
    if (status && !STATUSES.includes(status as (typeof STATUSES)[number])) {
      return fail(400, 'VALIDATION_ERROR', 'Parameter status tidak valid');
    }
    const { page, limit, from, to } = pageParams(url, 20);

    let query = supabaseAdmin
      .from('users')
      .select(
        'id, email, no_wa, role, status, avatar_url, is_email_verified, created_at, ' +
          'pasien_profiles(nama_lengkap), relawan_profiles(nama_lengkap), ' +
          'psikolog_profiles(nama_lengkap_gelar, verified_at), admin_profiles(nama_lengkap, level)',
        { count: 'exact' }
      )
      .neq('id', session.user.id)
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

/**
 * POST /api/users
 * Pembuatan user baru secara manual oleh Admin (Superadmin / Operator)
 */
export async function POST(req: Request) {
  try {
    const session = await getSessionUser();
    if (session.response) return session.response;
    if (session.user.role !== 'admin' || session.user.status !== 'active') {
      return fail(403, 'FORBIDDEN', 'Hanya admin yang dapat membuat pengguna baru');
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return fail(400, 'INVALID_BODY', 'Body request tidak valid');
    }

    const {
      email,
      password,
      role,
      fullName,
      nama_lengkap,
      no_wa,
      status = 'active',
      level,
      nomor_sipp_str,
      spesialisasi,
      tarif_sesi,
    } = body;

    const finalName = (fullName || nama_lengkap || '').trim();

    // Validasi dasar
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return fail(400, 'VALIDATION_ERROR', 'Format email tidak valid');
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return fail(400, 'VALIDATION_ERROR', 'Password minimal 6 karakter');
    }
    if (!role || !ROLES.includes(role as (typeof ROLES)[number])) {
      return fail(400, 'VALIDATION_ERROR', 'Peran (role) pengguna tidak valid');
    }
    if (!finalName) {
      return fail(400, 'VALIDATION_ERROR', 'Nama lengkap wajib diisi');
    }
    if (status && !STATUSES.includes(status as (typeof STATUSES)[number])) {
      return fail(400, 'VALIDATION_ERROR', 'Status akun tidak valid');
    }

    // 1. Cek apakah email sudah terdaftar
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (existingUser) {
      return fail(409, 'EMAIL_EXISTS', 'Email sudah terdaftar dalam sistem');
    }

    // 2. Buat akun di Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { role, full_name: finalName },
    });

    if (authError || !authData.user) {
      return fail(500, 'AUTH_CREATION_FAILED', authError?.message || 'Gagal membuat auth user');
    }

    const userId = authData.user.id;

    // 3. Masukkan ke public.users
    const { error: userError } = await supabaseAdmin.from('users').insert({
      id: userId,
      email: email.trim().toLowerCase(),
      no_wa: no_wa ? String(no_wa).trim() : null,
      role,
      status,
      is_email_verified: true,
    });

    if (userError) {
      // Rollback auth user jika insert tabel induk gagal
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return fail(500, 'USER_INSERT_FAILED', userError.message);
    }

    // 4. Masukkan ke tabel profil anak sesuai role
    let profileError: { message: string } | null = null;

    if (role === 'pasien') {
      const { error: err } = await supabaseAdmin.from('pasien_profiles').insert({
        user_id: userId,
        nama_lengkap: finalName,
      });
      profileError = err;
    } else if (role === 'relawan') {
      const { error: err } = await supabaseAdmin.from('relawan_profiles').insert({
        user_id: userId,
        nama_lengkap: finalName,
        alias_name: finalName.split(' ')[0] || 'Relawan',
        latar_belakang: 'Didaftarkan oleh Admin',
        dokumen_cv_url: '',
        alasan_bergabung: 'Akun Relawan Dibuat Admin',
        total_sesi: 0,
        is_available: false,
        topik_keahlian: ['Dukungan Umum'],
      });
      profileError = err;
    } else if (role === 'psikolog') {
      const { error: err } = await supabaseAdmin.from('psikolog_profiles').insert({
        user_id: userId,
        nama_lengkap_gelar: finalName,
        nomor_sipp_str: nomor_sipp_str || `ADM-SIPP-${Date.now().toString().slice(-6)}`,
        dokumen_sipp_str_url: '',
        spesialisasi: Array.isArray(spesialisasi) ? spesialisasi : ['Konseling Umum'],
        tahun_pengalaman: 1,
        tarif_sesi: Number(tarif_sesi) || 0,
        saldo: 0,
        verified_at: status === 'active' ? new Date().toISOString() : null,
      });
      profileError = err;
    } else if (role === 'admin') {
      const { error: err } = await supabaseAdmin.from('admin_profiles').insert({
        user_id: userId,
        nama_lengkap: finalName,
        level: level || 'operator',
      });
      profileError = err;
    }

    if (profileError) {
      // Rollback total: hapus dari public.users dan auth.users
      await supabaseAdmin.from('users').delete().eq('id', userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return fail(500, 'PROFILE_INSERT_FAILED', profileError.message);
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Pengguna baru berhasil dibuat',
        data: {
          id: userId,
          email: email.trim().toLowerCase(),
          role,
          status,
          fullName: finalName,
          no_wa: no_wa ? String(no_wa).trim() : null,
        },
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}
