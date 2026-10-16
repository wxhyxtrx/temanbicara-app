import { NextResponse } from 'next/server';
import { getSessionUser, fail, pageParams } from '@/lib/auth/session';
import { WalletService, WalletHttpError } from '@/services/wallet.service';

export async function GET(req: Request) {
  try {
    const session = await getSessionUser();
    if (session.response) return session.response;
    if (session.user.status !== 'active') {
      return fail(403, 'USER_NOT_ACTIVE', 'Akun pengguna belum aktif');
    }

    const url = new URL(req.url);
    const { page, limit } = pageParams(url, 20);

    const result = await WalletService.getLedgerTransactions(session.user.id, { page, limit });

    return NextResponse.json({
      success: true,
      data: result.items,
      meta: {
        page,
        limit,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / limit)),
      },
    });
  } catch (error) {
    if (error instanceof WalletHttpError) {
      return fail(error.status, error.code, error.message);
    }
    console.error('Error fetching wallet transactions:', error);
    return fail(500, 'INTERNAL_SERVER_ERROR', 'Gagal memuat riwayat transaksi');
  }
}
