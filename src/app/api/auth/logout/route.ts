import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/client';
import { getSessionUser } from '@/lib/auth/session';
import { clearSessionCookies } from '@/lib/auth/session-cookies';

export async function POST() {
  try {
    const token = (await cookies()).get('tb_access_token')?.value;
    if (token && supabaseAdmin) {
      await supabaseAdmin.auth.admin.signOut(token, 'local');
    }
  } catch {
    // Sign-out best-effort; logout tetap sukses dan cookie dibersihkan.
  }

  try {
    await getSessionUser({ allowInactive: true });

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
