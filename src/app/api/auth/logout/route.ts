import { NextResponse } from 'next/server';
import { clearSessionCookies } from '@/lib/auth/session-cookies';

export async function POST() {
  try {
    const response = NextResponse.json({
      success: true,
      message: 'Logout berhasil',
    });

    clearSessionCookies(response);

    return response;
  } catch {
    const fallback = NextResponse.json({
      success: true,
      message: 'Logout berhasil',
    });
    try {
      clearSessionCookies(fallback);
    } catch {
      // Abaikan error sekunder
    }
    return fallback;
  }
}
