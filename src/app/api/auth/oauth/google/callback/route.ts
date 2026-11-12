import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase/client';
import { signRole } from '@/lib/auth/role-cookie';

const ROLLBACK_MAX_AGE_MS = 5 * 60 * 1000;

// Hapus auth user hanya jika baris public.users terbukti tidak ada DAN akun < 5 menit.
function canRollbackAuthUser(rowAbsent: boolean, createdAt: string | undefined, now: number): boolean {
  const created = createdAt ? new Date(createdAt).getTime() : NaN;
  return rowAbsent && Number.isFinite(created) && now - created < ROLLBACK_MAX_AGE_MS;
}

export async function GET(req: Request) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');
  const intentRole = requestUrl.searchParams.get('intent_role'); // 'relawan' | 'psikolog' | null
  const origin = requestUrl.origin;

  console.log('[OAUTH CALLBACK URL]:', req.url);
  console.log('[OAUTH SEARCH PARAMS]:', Object.fromEntries(requestUrl.searchParams.entries()));

  if (error) {
    console.error('[OAUTH ERROR FROM PROVIDER]:', error, errorDescription);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error)}&message=${encodeURIComponent(errorDescription || '')}`
    );
  }

  if (!code) {
    console.warn('[OAUTH CODE MISSING]: No code param received');
    return NextResponse.redirect(`${origin}/login?error=OAUTH_CODE_MISSING`);
  }

  try {
    const cookieStore = await cookies();

    const supabaseServer = createServerClient(
      (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)!,
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY)!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch {
              // Ignore if called in unsupported context
            }
          },
        },
      }
    );

    // 1. Tukar auth code dengan session Supabase Auth menggunakan PKCE verifier di cookie
    const { data: sessionData, error: sessionError } =
      await supabaseServer.auth.exchangeCodeForSession(code);

    // Tanpa session tidak ada token sah; jangan pernah memakai user id sebagai token
    if (sessionError || !sessionData.user || !sessionData.session) {
      console.error('[OAUTH EXCHANGE FAILED]:', sessionError?.message);
      return NextResponse.redirect(
        `${origin}/login?error=OAUTH_EXCHANGE_FAILED&message=${encodeURIComponent('Gagal masuk via Google. Silakan coba beberapa saat lagi.')}`
      );
    }

    const authUser = sessionData.user;
    const accessToken = sessionData.session.access_token;
    const refreshToken = sessionData.session.refresh_token;
    const withSessionCookies = async (res: NextResponse, role: string, status: string) => {
      const opts = { path: '/', maxAge: 60 * 60 * 24 * 7, sameSite: 'lax' as const };
      res.cookies.set('tb_access_token', accessToken, {
        ...opts,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
      });
      if (refreshToken) {
        res.cookies.set('tb_refresh_token', refreshToken, {
          ...opts,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
        });
      }
      res.cookies.set('tb_user_role', await signRole(role, authUser.id, 60 * 60 * 24 * 7), {
        ...opts,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
      });
      res.cookies.set('tb_user_status', status, opts);
      return res;
    };
    const email = authUser.email!;
    const fullName =
      authUser.user_metadata?.full_name ||
      authUser.user_metadata?.name ||
      'Pengguna Google';
    const avatarUrl =
      authUser.user_metadata?.avatar_url ||
      authUser.user_metadata?.picture ||
      null;

    // 2. Cek user lama: by id dulu, lalu by email (dibandingkan lowercase di JS).
    // Query error != not found: jangan pernah lanjut ke jalur user baru (bisa berujung deleteUser).
    const internalError = (stage: string, err: { code?: string; message?: string }) => {
      console.error('[OAUTH_USER_LOOKUP_FAILED]', { stage, code: err.code, message: err.message });
      return NextResponse.redirect(`${origin}/login?error=OAUTH_INTERNAL_ERROR`);
    };

    const byId = await supabaseAdmin
      .from('users')
      .select('id, role, status')
      .eq('id', authUser.id)
      .maybeSingle();
    if (byId.error) return internalError('by_id', byId.error);

    let existingUser: { id: string; role: string; status: string } | null = byId.data;
    if (!existingUser) {
      const emailLower = email.toLowerCase();
      // Escape wildcard ILIKE (%, _, \) lalu verifikasi ulang persis di JS.
      const pattern = emailLower.replace(/[\\%_]/g, (c) => `\\${c}`);
      const byEmail = await supabaseAdmin
        .from('users')
        .select('id, role, status, email')
        .ilike('email', pattern)
        .limit(5);
      if (byEmail.error) return internalError('by_email', byEmail.error);
      const match = (byEmail.data ?? []).find(
        (u: { email: string | null }) => (u.email ?? '').toLowerCase() === emailLower
      );
      existingUser = match ? { id: match.id, role: match.role, status: match.status } : null;
    }

    if (existingUser) {
      // Akun ditangguhkan / ditolak: tetap pasang session, middleware membatasi ke /status
      if (existingUser.status === 'suspended' || existingUser.status === 'rejected') {
        return await withSessionCookies(
          NextResponse.redirect(`${origin}/status`),
          existingUser.role,
          existingUser.status
        );
      }

      // User sudah ada -> pastikan google_id terhubung
      await supabaseAdmin
        .from('users')
        .update({
          google_id: authUser.id,
          avatar_url: avatarUrl,
          is_email_verified: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingUser.id);

      // Redirect sesuai role dan status
      if (existingUser.status === 'incomplete_profile') {
        return NextResponse.redirect(`${origin}/register`);
      }
      if (existingUser.status === 'pending_approval') {
        return NextResponse.redirect(`${origin}/register/listener`);
      }
      if (existingUser.status === 'pending_verification') {
        return NextResponse.redirect(`${origin}/register/counselor`);
      }

      const redirectPath =
        existingUser.role === 'admin'
          ? '/admin/beranda'
          : existingUser.role === 'psikolog'
          ? '/counselor/beranda'
          : existingUser.role === 'relawan'
          ? '/listener/beranda'
          : '/patient/beranda';

      return await withSessionCookies(
        NextResponse.redirect(`${origin}${redirectPath}`),
        existingUser.role,
        existingUser.status
      );
    }

    // 3. User BARU: jika insert gagal, hapus auth user HANYA bila baris public.users terbukti
    // tidak ada DAN akun auth berumur < 5 menit. Selain itu: signOut saja, tanpa delete.
    const failNewUser = async (insertError: { code?: string; message?: string }) => {
      console.error('[OAUTH NEW USER INSERT FAILED]', { code: insertError.code, message: insertError.message });
      const recheck = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('id', authUser.id)
        .maybeSingle();
      const rowAbsent = !recheck.error && !recheck.data;
      await supabaseServer.auth.signOut();
      if (!canRollbackAuthUser(rowAbsent, authUser.created_at, Date.now())) {
        console.error('[OAUTH_FAIL_NEW_USER_SANITIZED]', {
          reason: recheck.error ? 'recheck_error' : rowAbsent ? 'account_too_old' : 'row_exists',
        });
        return NextResponse.redirect(`${origin}/login?error=OAUTH_INTERNAL_ERROR`);
      }
      const { error: rollbackError } = await supabaseAdmin.auth.admin.deleteUser(authUser.id);
      if (rollbackError) console.error('[OAUTH ROLLBACK FAILED]', { message: rollbackError.message });
      return NextResponse.redirect(`${origin}/login?error=OAUTH_INTERNAL_ERROR`);
    };

    if (intentRole === 'relawan' || intentRole === 'psikolog') {
      // Calon Mitra -> role sesuai intent, status incomplete_profile
      const { error: mitraError } = await supabaseAdmin.from('users').insert({
        id: authUser.id,
        email,
        google_id: authUser.id,
        role: intentRole,
        status: 'incomplete_profile',
        avatar_url: avatarUrl,
        is_email_verified: true,
      });
      if (mitraError) return failNewUser(mitraError);

      return NextResponse.redirect(
        `${origin}${intentRole === 'psikolog' ? '/register/counselor' : '/register/listener'}`
      );
    }

    // Default Pasien -> Auto-register active
    const { error: userError } = await supabaseAdmin.from('users').insert({
      id: authUser.id,
      email,
      google_id: authUser.id,
      role: 'pasien',
      status: 'active',
      avatar_url: avatarUrl,
      is_email_verified: true,
    });
    if (userError) return failNewUser(userError);

    const { error: profileError } = await supabaseAdmin.from('pasien_profiles').insert({
      user_id: authUser.id,
      nama_lengkap: fullName,
    });
    if (profileError) return failNewUser(profileError);

    return await withSessionCookies(NextResponse.redirect(`${origin}/patient/beranda`), 'pasien', 'active');
  } catch (err: unknown) {
    console.error('[OAUTH INTERNAL ERROR]:', err);
    return NextResponse.redirect(`${origin}/login?error=OAUTH_INTERNAL_ERROR`);
  }
}

/* @self-test — T-203 cabang rollback OAuth (manual; ponytail: upgrade ke test runner bila proyek memasangnya)
 *
 * A. User lama via id: byId.data ada -> masuk blok `if (existingUser)` -> redirect sesuai role/status.
 *    failNewUser tidak terjangkau -> deleteUser TIDAK dipanggil. (Sama untuk user lama via email.)
 * B. Query error: byId.error / byEmail.error -> internalError() -> /login?error=OAUTH_INTERNAL_ERROR,
 *    return sebelum signOut/deleteUser/insert -> deleteUser & signOut TIDAK dipanggil.
 * C. User baru + insert gagal -> failNewUser: recheck public.users by id, lalu canRollbackAuthUser():
 *    const now = Date.parse('2026-11-12T09:10:00Z');
 *    canRollbackAuthUser(true,  '2026-11-12T09:06:00Z', now) === true   // umur 4 menit, baris tidak ada -> delete
 *    canRollbackAuthUser(true,  '2026-11-12T09:05:00Z', now) === false  // umur tepat 5 menit -> tanpa delete
 *    canRollbackAuthUser(true,  '2025-01-01T00:00:00Z', now) === false  // akun lama -> tanpa delete
 *    canRollbackAuthUser(false, '2026-11-12T09:09:00Z', now) === false  // baris ada / recheck error -> tanpa delete
 *    canRollbackAuthUser(true,  undefined, now)              === false  // created_at tidak valid -> tanpa delete
 *    Cabang false: signOut + log '[OAUTH_FAIL_NEW_USER_SANITIZED]' (tanpa email/nama) + redirect, tanpa delete.
 *    Catatan: gagal insert pasien_profiles terjadi setelah baris users ada -> recheck menemukan baris -> tanpa delete.
 */
