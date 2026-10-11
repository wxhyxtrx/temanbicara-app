import { NextResponse } from 'next/server';
import { supabaseAdmin, supabasePublic } from '@/lib/supabase/client';

export async function GET(req: Request) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get('code');
  const intentRole = requestUrl.searchParams.get('intent_role'); // 'relawan' | 'psikolog' | null
  const origin = requestUrl.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=OAUTH_CODE_MISSING`);
  }

  try {
    // 1. Tukar auth code dengan session Supabase Auth
    const { data: sessionData, error: sessionError } =
      await supabasePublic.auth.exchangeCodeForSession(code);

    if (sessionError || !sessionData.user) {
      return NextResponse.redirect(`${origin}/login?error=OAUTH_EXCHANGE_FAILED`);
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
        return NextResponse.redirect(`${origin}/register/mitra/step-2`);
      }
      if (existingUser.status === 'pending_approval') {
        return NextResponse.redirect(`${origin}/status/menunggu-verifikasi`);
      }
      if (existingUser.status === 'pending_verification') {
        return NextResponse.redirect(`${origin}/status/verifikasi-dokumen`);
      }

      const redirectPath =
        existingUser.role === 'admin'
          ? '/admin'
          : existingUser.role === 'psikolog'
          ? '/dashboard/psikolog'
          : existingUser.role === 'relawan'
          ? '/dashboard/relawan'
          : '/dashboard/pasien';

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

      return NextResponse.redirect(`${origin}/register/mitra/step-2`);
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

    return NextResponse.redirect(`${origin}/dashboard/pasien`);
  } catch (err) {
    return NextResponse.redirect(`${origin}/login?error=OAUTH_INTERNAL_ERROR`);
  }
}
