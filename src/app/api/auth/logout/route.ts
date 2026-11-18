import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/client';
import { getSessionUser } from '@/lib/auth/session';
import { clearSessionCookies } from '@/lib/auth/session-cookies';
import { logActivity } from '@/lib/activity-log';

export async function POST() {
  // Baca sesi sebelum token dicabut agar log tahu siapa yang keluar.
  try {
    const session = await getSessionUser({ allowInactive: true });
    if (session.user) {
      await logActivity({
        actorId: session.user.id,
        actorRole: session.user.role,
        category: 'auth',
        action: 'auth.logout',
      });
    }
  } catch {
    // Pencatatan best-effort; logout tetap berjalan.
  }

  try {
    const token = (await cookies()).get('tb_access_token')?.value;
    if (token && supabaseAdmin) {
      await supabaseAdmin.auth.admin.signOut(token, 'local');
    }
  } catch {
    // Sign-out best-effort; logout tetap sukses dan cookie dibersihkan.
  }

  const response = NextResponse.json({
    success: true,
    message: 'Logout berhasil',
  });
  try {
    clearSessionCookies(response);
  } catch {
    // Abaikan error sekunder
  }
  return response;
}
