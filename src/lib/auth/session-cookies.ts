import type { NextResponse } from 'next/server';
import { signRole } from '@/lib/auth/role-cookie';

export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 hari

export interface SetSessionCookiesOptions {
  accessToken: string;
  refreshToken?: string | null;
  userId: string;
  role?: string;
  status?: string;
  maxAge?: number;
}

export async function setSessionCookies(
  res: NextResponse,
  s: SetSessionCookiesOptions
): Promise<void> {
  const maxAge = s.maxAge ?? SESSION_MAX_AGE;

  res.cookies.set('tb_access_token', s.accessToken, {
    path: '/',
    maxAge,
    sameSite: 'lax',
  });

  if (s.refreshToken) {
    res.cookies.set('tb_refresh_token', s.refreshToken, {
      path: '/',
      maxAge,
      sameSite: 'lax',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    });
  }

  if (s.role) {
    try {
      const signedRole = await signRole(s.role, s.userId, maxAge);
      res.cookies.set('tb_user_role', signedRole, {
        path: '/',
        maxAge,
        sameSite: 'lax',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
      });
    } catch (err) {
      console.error('[setSessionCookies]: Gagal menandatangani role cookie:', err);
    }
  }

  if (s.status) {
    res.cookies.set('tb_user_status', s.status, {
      path: '/',
      maxAge,
      sameSite: 'lax',
    });
  }
}

export function clearSessionCookies(res: NextResponse): void {
  res.cookies.set('tb_access_token', '', {
    path: '/',
    maxAge: 0,
    expires: new Date(0),
    sameSite: 'lax',
  });
  res.cookies.set('tb_refresh_token', '', {
    path: '/',
    maxAge: 0,
    expires: new Date(0),
    sameSite: 'lax',
    httpOnly: true,
  });
  res.cookies.set('tb_user_role', '', {
    path: '/',
    maxAge: 0,
    expires: new Date(0),
    sameSite: 'lax',
    httpOnly: true,
  });
  res.cookies.set('tb_user_status', '', {
    path: '/',
    maxAge: 0,
    expires: new Date(0),
    sameSite: 'lax',
  });
}
