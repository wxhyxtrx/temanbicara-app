import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase/client';

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
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://mcciuvlqvvvptgmelexi.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_JshNaL_CvRDPS1JD5nJs7g_iYKI0oIV',
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

    if (sessionError || !sessionData.user) {
      console.error('[OAUTH EXCHANGE FAILED]:', sessionError?.message);
      return NextResponse.redirect(
        `${origin}/login?error=OAUTH_EXCHANGE_FAILED&message=${encodeURIComponent(sessionError?.message || '')}`
      );
    }

    const authUser = sessionData.user;
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

      return NextResponse.redirect(`${origin}${redirectPath}`);
    }

    // 3. User BARU
    if (intentRole === 'relawan' || intentRole === 'psikolog') {
      // Calon Mitra -> role sesuai intent, status incomplete_profile
      await supabaseAdmin.from('users').insert({
        id: authUser.id,
        email,
        google_id: authUser.id,
        role: intentRole,
        status: 'incomplete_profile',
        avatar_url: avatarUrl,
        is_email_verified: true,
      });

      return NextResponse.redirect(
        `${origin}${intentRole === 'psikolog' ? '/register/counselor' : '/register/listener'}`
      );
    }

    // Default Pasien -> Auto-register active
    await supabaseAdmin.from('users').insert({
      id: authUser.id,
      email,
      google_id: authUser.id,
      role: 'pasien',
      status: 'active',
      avatar_url: avatarUrl,
      is_email_verified: true,
    });

    await supabaseAdmin.from('pasien_profiles').insert({
      user_id: authUser.id,
      nama_lengkap: fullName,
    });

    return NextResponse.redirect(`${origin}/patient/beranda`);
  } catch (err: any) {
    console.error('[OAUTH INTERNAL ERROR]:', err);
    return NextResponse.redirect(
      `${origin}/login?error=OAUTH_INTERNAL_ERROR&message=${encodeURIComponent(err.message || '')}`
    );
  }
}
