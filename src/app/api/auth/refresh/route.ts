import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin, supabasePublic } from '@/lib/supabase/client';
import { signRole } from '@/lib/auth/role-cookie';

/**
 * POST /api/auth/refresh
 * Menukar refresh token yang tersimpan di cookie httpOnly tb_refresh_token
 * (atau dikirimkan melalui body) menggunakan supabase auth.refreshSession.
 * Memperbarui cookie tb_access_token dan tb_refresh_token baru.
 */
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    let refreshToken = cookieStore.get('tb_refresh_token')?.value;

    if (!refreshToken) {
      const body = await req.json().catch(() => null);
      refreshToken = body?.refresh_token;
    }

    if (!refreshToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'MISSING_REFRESH_TOKEN',
          message: 'Refresh token tidak ditemukan di cookie maupun request body',
        },
        { status: 401 }
      );
    }

    // Tukar refresh token via Supabase Auth
    const { data: authData, error: refreshError } =
      await supabasePublic.auth.refreshSession({ refresh_token: refreshToken });

    if (refreshError || !authData.session || !authData.user) {
      const errorResponse = NextResponse.json(
        {
          success: false,
          error: 'INVALID_REFRESH_TOKEN',
          message: refreshError?.message || 'Sesi tidak dapat diperbarui',
        },
        { status: 401 }
      );

      // Bersihkan cookie sesi yang kedaluwarsa
      errorResponse.cookies.set('tb_access_token', '', {
        path: '/',
        maxAge: 0,
        expires: new Date(0),
        sameSite: 'lax',
      });
      errorResponse.cookies.set('tb_refresh_token', '', {
        path: '/',
        maxAge: 0,
        expires: new Date(0),
        sameSite: 'lax',
        httpOnly: true,
      });
      errorResponse.cookies.set('tb_user_role', '', {
        path: '/',
        maxAge: 0,
        expires: new Date(0),
        sameSite: 'lax',
        httpOnly: true,
      });
      errorResponse.cookies.set('tb_user_status', '', {
        path: '/',
        maxAge: 0,
        expires: new Date(0),
        sameSite: 'lax',
      });

      return errorResponse;
    }

    const { session, user } = authData;
    const maxAge = 60 * 60 * 24 * 7; // 7 hari

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
          access_token: session.access_token,
          refresh_token: session.refresh_token,
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

    // Pasang ulang access token (JavaScript-readable untuk websocket/chat)
    response.cookies.set('tb_access_token', session.access_token, {
      path: '/',
      maxAge,
      sameSite: 'lax',
    });

    // Pasang ulang refresh token baru (httpOnly)
    if (session.refresh_token) {
      response.cookies.set('tb_refresh_token', session.refresh_token, {
        path: '/',
        maxAge,
        sameSite: 'lax',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
      });
    }

    // Sinkronkan cookie role dan status jika profil ditemukan
    if (userProfile) {
      try {
        const signedRole = await signRole(userProfile.role, userProfile.id, maxAge);
        response.cookies.set('tb_user_role', signedRole, {
          path: '/',
          maxAge,
          sameSite: 'lax',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
        });
      } catch (err) {
        console.error('[AUTH REFRESH]: Gagal menandatangani role cookie:', err);
      }

      response.cookies.set('tb_user_status', userProfile.status, {
        path: '/',
        maxAge,
        sameSite: 'lax',
      });
    }

    return response;
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: err instanceof Error ? err.message : 'Terjadi kesalahan sistem saat memperbarui token',
      },
      { status: 500 }
    );
  }
}
