import { NextResponse } from 'next/server';
import { supabaseAdmin, supabasePublic } from '@/lib/supabase/client';
import { loginSchema } from '@/lib/validations/auth';
import { setSessionCookies } from '@/lib/auth/session-cookies';
import {
  checkRateLimit,
  getClientIp,
  hashEmail,
  rateLimitExceededResponse,
} from '@/lib/rate-limit/distributed';
import { internalErrorResponse } from '@/lib/api/error-response';

export async function POST(req: Request) {
  try {
    // 1. Rate Limiting Terdistribusi: Batas global 30 request per 15 menit per IP (fail-open)
    const ip = getClientIp(req);
    const globalLimit = await checkRateLimit(`auth_login_ip:${ip}`, 30, 900);
    if (!globalLimit.allowed) {
      return rateLimitExceededResponse(globalLimit.retryAfter);
    }

    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'Format email atau password tidak valid',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { email, password, remember_me } = parsed.data;
    const emailHash = hashEmail(email);
    const failKey = `auth_login_fail:${ip}:${emailHash}`;

    // Periksa apakah kredensial pengguna sedang terkunci (maksimal 5 kegagalan per 15 menit)
    if (supabaseAdmin) {
      try {
        const { data: existingLimit } = await supabaseAdmin
          .from('rate_limits')
          .select('count, expires_at')
          .eq('key', failKey)
          .maybeSingle();

        if (
          existingLimit &&
          existingLimit.count >= 5 &&
          new Date(existingLimit.expires_at).getTime() > Date.now()
        ) {
          const retryAfter = Math.max(
            1,
            Math.ceil((new Date(existingLimit.expires_at).getTime() - Date.now()) / 1000)
          );
          return rateLimitExceededResponse(retryAfter);
        }
      } catch (err: unknown) {
        console.error(
          '[RateLimit] Gagal memeriksa status kunci login (fail-open):',
          err instanceof Error ? err.message : String(err)
        );
      }
    }

    // 2. Verifikasi kredensial via Supabase Auth
    const { data: authData, error: authError } = await supabasePublic.auth.signInWithPassword({
      email,
      password,
    });

    // Supabase menolak akun belum konfirmasi email sebelum cek profil di bawah
    if (authError?.code === 'email_not_confirmed') {
      return NextResponse.json(
        {
          error: 'EMAIL_UNVERIFIED',
          message: 'Email belum diverifikasi. Silakan periksa inbox email Anda.',
        },
        { status: 403 }
      );
    }

    if (authError || !authData.user) {
      const failLimit = await checkRateLimit(failKey, 5, 900);
      if (!failLimit.allowed) {
        return rateLimitExceededResponse(failLimit.retryAfter);
      }
      return NextResponse.json(
        {
          error: 'INVALID_CREDENTIALS',
          message: 'Email atau password salah',
        },
        { status: 401 }
      );
    }

    const userId = authData.user.id;

    // 3. Ambil entitas public.users untuk memeriksa status akun & role
    const { data: userProfile, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, role, status, is_email_verified, avatar_url')
      .eq('id', userId)
      .maybeSingle();

    if (userError || !userProfile) {
      const failLimit = await checkRateLimit(failKey, 5, 900);
      if (!failLimit.allowed) {
        return rateLimitExceededResponse(failLimit.retryAfter);
      }
      return NextResponse.json(
        {
          error: 'USER_PROFILE_NOT_FOUND',
          message: 'Data profil pengguna tidak ditemukan di sistem',
        },
        { status: 404 }
      );
    }

    // 4. Evaluasi status akun
    // suspended / rejected TIDAK ditolak di sini: tetap login agar user melihat penjelasan di /status
    if (userProfile.status === 'unverified_email' || !userProfile.is_email_verified) {
      return NextResponse.json(
        {
          error: 'EMAIL_UNVERIFIED',
          message: 'Email belum diverifikasi. Silakan periksa inbox email Anda.',
        },
        { status: 403 }
      );
    }

    // Login berhasil: bersihkan counter kegagalan kredensial jika ada
    if (supabaseAdmin) {
      try {
        await supabaseAdmin.from('rate_limits').delete().eq('key', failKey);
      } catch {
        // Abaikan error pembersihan counter
      }
    }

    // 5. Penentuan redirect URL berdasarkan role & status
    let redirectTo = '/patient/beranda';

    if (userProfile.status === 'suspended' || userProfile.status === 'rejected') {
      redirectTo = '/status';
    } else if (userProfile.status === 'incomplete_profile') {
      redirectTo = '/register';
    } else if (userProfile.status === 'pending_approval') {
      redirectTo = '/register/listener';
    } else if (userProfile.status === 'pending_verification') {
      redirectTo = '/register/counselor';
    } else {
      // Status aktif: redirect sesuai role
      switch (userProfile.role) {
        case 'admin':
          redirectTo = '/admin/beranda';
          break;
        case 'psikolog':
          redirectTo = '/counselor/beranda';
          break;
        case 'relawan':
          redirectTo = '/listener/beranda';
          break;
        case 'pasien':
        default:
          redirectTo = '/patient/beranda';
          break;
      }
    }

    // 6. Kembalikan session data dan metadata role
    const response = NextResponse.json({
      success: true,
      message: 'Login berhasil',
      data: {
        user: {
          id: userProfile.id,
          email: userProfile.email,
          role: userProfile.role,
          status: userProfile.status,
          avatar_url: userProfile.avatar_url,
        },
        session: {
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
          expires_at: authData.session.expires_at,
        },
        redirect_to: redirectTo,
      },
    });

    const maxAge = remember_me ? 60 * 60 * 24 * 7 : 60 * 60 * 24;
    await setSessionCookies(response, {
      accessToken: authData.session.access_token,
      refreshToken: authData.session.refresh_token,
      userId: authData.user.id,
      role: userProfile.role,
      status: userProfile.status,
      maxAge,
    });

    return response;
  } catch (err: unknown) {
    return internalErrorResponse(err, 'Terjadi kesalahan sistem saat proses login');
  }
}
