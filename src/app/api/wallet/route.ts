import { NextResponse } from 'next/server';
import { getSessionUser, fail } from '@/lib/auth/session';
import { WalletService, WalletHttpError } from '@/services/wallet.service';

export async function GET() {
  try {
    const session = await getSessionUser();
    if (session.response) return session.response;
    if (session.user.status !== 'active') {
      return fail(403, 'USER_NOT_ACTIVE', 'Akun pengguna belum aktif');
    }

    const data = await WalletService.getWalletInfo(session.user.id, session.user.role);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    if (error instanceof WalletHttpError) {
      return fail(error.status, error.code, error.message);
    }
    console.error('Error fetching wallet info:', error);
    return fail(500, 'INTERNAL_SERVER_ERROR', 'Gagal memuat saldo dompet');
  }
}
