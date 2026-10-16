import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase/client';
import { signRole } from '@/lib/auth/role-cookie';

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
        `${origin}/login?error=OAUTH_EXCHANGE_FAILED&message=${encodeURIComponent(sessionError?.message || '')}`
      );
    }

    const authUser = sessionData.user;
    const accessToken = sessionData.session.access_token;
    const withSessionCookies = async (res: NextResponse, role: string, status: string) => {
      const opts = { path: '/', maxAge: 60 * 60 * 24 * 7, sameSite: 'lax' as const };
      res.cookies.set('tb_access_token', accessToken, opts);
      res.cookies.set('tb_user_role', await signRole(role), {
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

    // 2. Cek apakah user sudah ada di public.users
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id, role, status')
      .eq('email', email)
      .maybeSingle();

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

    // 3. User BARU: jika insert gagal, hapus auth user (cascade ke public.users) agar tidak jadi akun zombie
    const failNewUser = async (insertError: unknown) => {
      console.error('[OAUTH NEW USER INSERT FAILED]:', insertError);
      await supabaseServer.auth.signOut();
      const { error: rollbackError } = await supabaseAdmin.auth.admin.deleteUser(authUser.id);
      if (rollbackError) console.error('[OAUTH ROLLBACK FAILED]:', rollbackError);
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
