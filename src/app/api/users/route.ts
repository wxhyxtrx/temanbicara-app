import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { getSessionUser, fail, pageParams, sanitizeSearch } from '@/lib/auth/session';
import {
  adminCreatePsikologSchema,
  adminCreateRelawanSchema,
  adminCreatePasienSchema,
  adminCreateAdminSchema,
} from '@/lib/validations/auth';

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
    const roleParam = url.searchParams.get('role');
    const statusParam = url.searchParams.get('status');
    const search = sanitizeSearch(url.searchParams.get('search'));

    let roles: (typeof ROLES)[number][] | null = null;
    if (roleParam !== null && roleParam.trim() !== '') {
      const parsed = Array.from(
        new Set(
          roleParam
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        )
      );
      if (parsed.length === 0 || parsed.some((r) => !ROLES.includes(r as (typeof ROLES)[number]))) {
        return fail(400, 'VALIDATION_ERROR', 'Parameter role tidak valid');
      }
      roles = parsed as (typeof ROLES)[number][];
    }

    let statuses: (typeof STATUSES)[number][] | null = null;
    if (statusParam !== null && statusParam.trim() !== '') {
      const parsed = Array.from(
        new Set(
          statusParam
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        )
      );
      if (parsed.length === 0 || parsed.some((s) => !STATUSES.includes(s as (typeof STATUSES)[number]))) {
        return fail(400, 'VALIDATION_ERROR', 'Parameter status tidak valid');
      }
      statuses = parsed as (typeof STATUSES)[number][];
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

    if (roles) {
      query = roles.length === 1 ? query.eq('role', roles[0]) : query.in('role', roles);
    }
    if (statuses) {
      query = statuses.length === 1 ? query.eq('status', statuses[0]) : query.in('status', statuses);
    }

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
    const userIds = rows.map((u) => u.id);

    // 1 Batch query wallets untuk seluruh baris halaman (0 N+1 query)
    const { data: walletsData } = userIds.length > 0
      ? await supabaseAdmin
          .from('wallets')
          .select('user_id, coin_balance, pending_rupiah, available_rupiah')
          .in('user_id', userIds)
      : { data: [] };

    const walletMap = new Map((walletsData ?? []).map((w) => [w.user_id, w]));

    return NextResponse.json({
      success: true,
      data: rows.map(({ pasien_profiles, relawan_profiles, psikolog_profiles, admin_profiles, ...u }) => {
        const profile = pasien_profiles ?? relawan_profiles ?? psikolog_profiles ?? admin_profiles ?? null;
        const profileWithName = profile as { nama_lengkap?: string; nama_lengkap_gelar?: string } | null;
        const wallet = walletMap.get(u.id);

        const item: Record<string, unknown> = {
          ...u,
          fullName: profileWithName?.nama_lengkap_gelar ?? profileWithName?.nama_lengkap ?? u.email.split('@')[0],
          profile,
        };

        if (u.role === 'pasien') {
          item.coin_balance = Number(wallet?.coin_balance ?? 0);
        } else if (u.role === 'psikolog' || u.role === 'relawan') {
          item.pending_rupiah = Number(wallet?.pending_rupiah ?? 0);
          item.available_rupiah = Number(wallet?.available_rupiah ?? 0);
        }

        return item;
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

    const role = body.role;
    if (!role || !ROLES.includes(role as (typeof ROLES)[number])) {
      return fail(422, 'VALIDATION_ERROR', 'Peran (role) pengguna tidak valid');
    }

    const status = body.status ?? 'active';
    if (status && !STATUSES.includes(status as (typeof STATUSES)[number])) {
      return fail(422, 'VALIDATION_ERROR', 'Status akun tidak valid');
    }

    // Validasi ketat berbasis schema Zod per peran (samakan dengan registrasi, password min 8)
    let validatedEmail = '';
    let validatedPassword = '';
    let validatedNoWa = '';
    let finalFullName = '';

    let pasienData: { nama_lengkap: string } | null = null;
    let relawanData: {
      nama_lengkap: string;
      latar_belakang: string;
      dokumen_cv_url: string;
      alasan_bergabung: string;
    } | null = null;
    let psikologData: {
      nama_lengkap_gelar: string;
      nomor_sipp_str: string;
      dokumen_sipp_str_url: string;
      spesialisasi: string[];
      tahun_pengalaman: number;
      tarif_sesi: number;
    } | null = null;
    let adminData: { nama_lengkap: string; level: string } | null = null;

    if (role === 'psikolog') {
      const parsed = adminCreatePsikologSchema.safeParse({
        nama_lengkap_gelar: (body.nama_lengkap_gelar || body.fullName || body.nama_lengkap || '').trim(),
        email: body.email ? String(body.email).trim().toLowerCase() : '',
        no_wa: body.no_wa ? String(body.no_wa).trim() : '',
        password: body.password,
        nomor_sipp_str: body.nomor_sipp_str ? String(body.nomor_sipp_str).trim() : '',
        dokumen_sipp_str_url: body.dokumen_sipp_str_url ? String(body.dokumen_sipp_str_url).trim() : '',
        spesialisasi: body.spesialisasi,
        tahun_pengalaman: body.tahun_pengalaman !== undefined ? Number(body.tahun_pengalaman) : undefined,
        tarif_sesi: body.tarif_sesi !== undefined ? Number(body.tarif_sesi) : 0,
      });

      if (!parsed.success) {
        const firstIssue = parsed.error.issues[0]?.message || 'Data psikolog tidak valid';
        return fail(422, 'VALIDATION_ERROR', firstIssue);
      }

      validatedEmail = parsed.data.email;
      validatedPassword = parsed.data.password;
      validatedNoWa = parsed.data.no_wa;
      finalFullName = parsed.data.nama_lengkap_gelar;
      psikologData = parsed.data;
    } else if (role === 'relawan') {
      const parsed = adminCreateRelawanSchema.safeParse({
        nama_lengkap: (body.nama_lengkap || body.fullName || '').trim(),
        email: body.email ? String(body.email).trim().toLowerCase() : '',
        no_wa: body.no_wa ? String(body.no_wa).trim() : '',
        password: body.password,
        latar_belakang: body.latar_belakang ? String(body.latar_belakang).trim() : '',
        dokumen_cv_url: body.dokumen_cv_url ? String(body.dokumen_cv_url).trim() : '',
        alasan_bergabung: body.alasan_bergabung ? String(body.alasan_bergabung).trim() : '',
      });

      if (!parsed.success) {
        const firstIssue = parsed.error.issues[0]?.message || 'Data relawan tidak valid';
        return fail(422, 'VALIDATION_ERROR', firstIssue);
      }

      validatedEmail = parsed.data.email;
      validatedPassword = parsed.data.password;
      validatedNoWa = parsed.data.no_wa;
      finalFullName = parsed.data.nama_lengkap;
      relawanData = parsed.data;
    } else if (role === 'pasien') {
      const parsed = adminCreatePasienSchema.safeParse({
        nama_lengkap: (body.nama_lengkap || body.fullName || '').trim(),
        email: body.email ? String(body.email).trim().toLowerCase() : '',
        no_wa: body.no_wa ? String(body.no_wa).trim() : '',
        password: body.password,
      });

      if (!parsed.success) {
        const firstIssue = parsed.error.issues[0]?.message || 'Data pasien tidak valid';
        return fail(422, 'VALIDATION_ERROR', firstIssue);
      }

      validatedEmail = parsed.data.email;
      validatedPassword = parsed.data.password;
      validatedNoWa = parsed.data.no_wa;
      finalFullName = parsed.data.nama_lengkap;
      pasienData = parsed.data;
    } else if (role === 'admin') {
      const parsed = adminCreateAdminSchema.safeParse({
        nama_lengkap: (body.nama_lengkap || body.fullName || '').trim(),
        email: body.email ? String(body.email).trim().toLowerCase() : '',
        no_wa: body.no_wa ? String(body.no_wa).trim() : '',
        password: body.password,
        level: body.level || 'operator',
      });

      if (!parsed.success) {
        const firstIssue = parsed.error.issues[0]?.message || 'Data admin tidak valid';
        return fail(422, 'VALIDATION_ERROR', firstIssue);
      }

      validatedEmail = parsed.data.email;
      validatedPassword = parsed.data.password;
      validatedNoWa = parsed.data.no_wa;
      finalFullName = parsed.data.nama_lengkap;
      adminData = parsed.data;
    }

    // 1. Cek apakah email sudah terdaftar
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', validatedEmail)
      .maybeSingle();

    if (existingUser) {
      return fail(409, 'EMAIL_EXISTS', 'Email sudah terdaftar dalam sistem');
    }

    // 2. Buat akun di Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: validatedEmail,
      password: validatedPassword,
      email_confirm: true,
      user_metadata: { role, full_name: finalFullName },
    });

    if (authError || !authData.user) {
      return fail(500, 'AUTH_CREATION_FAILED', authError?.message || 'Gagal membuat auth user');
    }

    const userId = authData.user.id;

    // 3. Masukkan ke public.users
    const { error: userError } = await supabaseAdmin.from('users').insert({
      id: userId,
      email: validatedEmail,
      no_wa: validatedNoWa,
      role,
      status,
      is_email_verified: true,
    });

    if (userError) {
      // Rollback auth user jika insert tabel induk gagal
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return fail(500, 'USER_INSERT_FAILED', userError.message);
    }

    // 4. Masukkan ke tabel profil anak sesuai role (TANPA dummy fallback)
    let profileError: { message: string } | null = null;

    if (role === 'pasien' && pasienData) {
      const { error: err } = await supabaseAdmin.from('pasien_profiles').insert({
        user_id: userId,
        nama_lengkap: pasienData.nama_lengkap,
      });
      profileError = err;
    } else if (role === 'relawan' && relawanData) {
      const { error: err } = await supabaseAdmin.from('relawan_profiles').insert({
        user_id: userId,
        nama_lengkap: relawanData.nama_lengkap,
        alias_name: relawanData.nama_lengkap.split(' ')[0] || 'Relawan',
        latar_belakang: relawanData.latar_belakang,
        dokumen_cv_url: relawanData.dokumen_cv_url,
        alasan_bergabung: relawanData.alasan_bergabung,
        total_sesi: 0,
        is_available: false,
        topik_keahlian: ['Dukungan Umum'],
      });
      profileError = err;
    } else if (role === 'psikolog' && psikologData) {
      const { error: err } = await supabaseAdmin.from('psikolog_profiles').insert({
        user_id: userId,
        nama_lengkap_gelar: psikologData.nama_lengkap_gelar,
        nomor_sipp_str: psikologData.nomor_sipp_str,
        dokumen_sipp_str_url: psikologData.dokumen_sipp_str_url,
        spesialisasi: psikologData.spesialisasi,
        tahun_pengalaman: psikologData.tahun_pengalaman,
        tarif_sesi: psikologData.tarif_sesi,
        saldo: 0,
        verified_at: status === 'active' ? new Date().toISOString() : null,
      });
      profileError = err;
    } else if (role === 'admin' && adminData) {
      const { error: err } = await supabaseAdmin.from('admin_profiles').insert({
        user_id: userId,
        nama_lengkap: adminData.nama_lengkap,
        level: adminData.level,
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
          email: validatedEmail,
          role,
          status,
          fullName: finalFullName,
          no_wa: validatedNoWa || null,
        },
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}
