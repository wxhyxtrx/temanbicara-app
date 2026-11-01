import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabasePublic } from '@/lib/supabase/client';
import { setSessionCookies } from '@/lib/auth/session-cookies';

function parseJwtExp(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    const payload = JSON.parse(jsonPayload);
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const headers = {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  };

  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('tb_access_token')?.value;
    const refreshToken = cookieStore.get('tb_refresh_token')?.value;

    // 1. Cek token akses aktif yang masih berlaku
    if (accessToken) {
      const exp = parseJwtExp(accessToken);
      const now = Math.floor(Date.now() / 1000);

      // Jika belum kedaluwarsa, validasi ke Supabase Auth
      if (exp && exp > now) {
        const { data: authData, error: authError } = await supabasePublic.auth.getUser(accessToken);
        if (!authError && authData?.user) {
          return NextResponse.json(
            {
              success: true,
              data: {
                access_token: accessToken,
                expires_at: exp,
              },
            },
            { status: 200, headers }
          );
        }
      }
    }

    // 2. Jika token akses tidak ada, kedaluwarsa, atau tidak valid, coba perbarui via refresh token
    if (refreshToken) {
      const { data: refreshData, error: refreshError } =
        await supabasePublic.auth.refreshSession({ refresh_token: refreshToken });

      if (!refreshError && refreshData.session && refreshData.user) {
        const newAccessToken = refreshData.session.access_token;
        const newExpiresAt =
          refreshData.session.expires_at ??
          parseJwtExp(newAccessToken) ??
          Math.floor(Date.now() / 1000) + 3600;

        const response = NextResponse.json(
          {
            success: true,
            data: {
              access_token: newAccessToken,
              expires_at: newExpiresAt,
            },
          },
          { status: 200, headers }
        );

        const status = cookieStore.get('tb_user_status')?.value;
        await setSessionCookies(response, {
          accessToken: newAccessToken,
          refreshToken: refreshData.session.refresh_token,
          userId: refreshData.user.id,
          status,
        });

        return response;
      }
    }

    // 3. Sesi tidak valid atau telah berakhir
    return NextResponse.json(
      {
        success: false,
        error: 'UNAUTHENTICATED',
        message: 'Sesi tidak valid atau telah berakhir',
      },
      { status: 401, headers }
    );
  } catch (err: unknown) {
    console.error('[REALTIME TOKEN ERROR]:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'UNAUTHENTICATED',
        message: 'Sesi tidak valid atau telah berakhir',
      },
      { status: 401, headers }
    );
  }
}
