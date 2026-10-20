import { NextResponse } from 'next/server';
import { clearSessionCookies } from '@/lib/auth/session-cookies';

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: 'Logout berhasil',
  });

  clearSessionCookies(response);

  return response;
}
