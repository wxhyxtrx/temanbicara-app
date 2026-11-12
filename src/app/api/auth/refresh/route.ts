import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin, supabasePublic } from '@/lib/supabase/client';
import { setSessionCookies, clearSessionCookies, SESSION_MAX_AGE } from '@/lib/auth/session-cookies';

/**
 * POST /api/auth/refresh
 * Menukar refresh token yang tersimpan di cookie httpOnly tb_refresh_token
 * menggunakan supabase auth.refreshSession.
 * Memperbarui cookie tb_access_token dan tb_refresh_token baru.
 */
export async function POST() {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('tb_refresh_token')?.value;

    if (!refreshToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'MISSING_REFRESH_TOKEN',
          message: 'Refresh token tidak ditemukan di cookie',
        },
        { status: 401 }
      );
    }

    // Tukar refresh token via Supabase Auth
    const { data: authData, error: refreshError } =
      await supabasePublic.auth.refreshSession({ refresh_token: refreshToken });

    if (refreshError || !authData.session || !authData.user) {
      if (refreshError) {
        console.error('[AUTH_REFRESH_FAILED]:', refreshError.message);
      }
      const errorResponse = NextResponse.json(
        {
          success: false,
          error: 'INVALID_REFRESH_TOKEN',
          message: 'Sesi tidak dapat diperbarui. Silakan login kembali.',
        },
        { status: 401 }
      );

      // Bersihkan cookie sesi yang kedaluwarsa
      clearSessionCookies(errorResponse);

      return errorResponse;
    }

    const { session, user } = authData;
    const maxAge = SESSION_MAX_AGE; // 7 hari

    // Ambil data profil terbaru untuk memastikan role dan status akun
    let userProfile: { id: string; role: string; status: string } | null = null;
    if (supabaseAdmin) {
      const { data } = await supabaseAdmin
        .from('users')
        .select('id, role, status')
        .eq('id', user.id)
        .maybeSingle();
      if (data) userProfile = data;
    }

    const response = NextResponse.json({
      success: true,
      message: 'Token berhasil diperbarui',
      data: {
        session: {
          expires_at: session.expires_at,
        },
        user: userProfile
          ? {
              id: userProfile.id,
              email: user.email,
              role: userProfile.role,
              status: userProfile.status,
            }
          : {
              id: user.id,
              email: user.email,
            },
      },
    });

    await setSessionCookies(response, {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      userId: userProfile?.id || user.id,
      role: userProfile?.role,
      status: userProfile?.status,
      maxAge,
    });

    return response;
  } catch (err: unknown) {
    console.error('[AUTH_REFRESH_INTERNAL_ERROR]:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Terjadi kesalahan sistem saat memperbarui token.',
      },
      { status: 500 }
    );
  }
}
