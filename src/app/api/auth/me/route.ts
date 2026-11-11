import { NextResponse } from 'next/server';
import { getSessionUser, getRoleProfile, displayName, fail } from '@/lib/auth/session';

export async function GET() {
  try {
    const session = await getSessionUser({ allowInactive: true });
    if (session.response) return session.response;
    const { google_id: _googleId, ...user } = session.user;

    const profile = await getRoleProfile(session.user);
    const fullName = displayName(user, profile);

    return NextResponse.json({
      success: true,
      data: {
        user: { ...user, fullName },
        profile,
      },
    });
  } catch (err: unknown) {
    console.error('[AUTH_ME_INTERNAL_ERROR]:', err);
    return fail(500, 'INTERNAL_ERROR', 'Terjadi kesalahan sistem saat memuat data profil');
  }
}
