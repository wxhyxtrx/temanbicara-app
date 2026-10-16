import { NextResponse } from 'next/server';
import { getSessionUser, fail, pageParams } from '@/lib/auth/session';
import { WalletService, WalletHttpError } from '@/services/wallet.service';
import type { PayoutStatus } from '@/types/wallet';

const VALID_STATUSES: PayoutStatus[] = ['requested', 'paid', 'rejected'];

export async function GET(req: Request) {
  try {
    const session = await getSessionUser();
    if (session.response) return session.response;
    if (session.user.role !== 'admin') {
      return fail(403, 'FORBIDDEN', 'Hanya admin yang dapat mengakses antrean penarikan dana');
    }
    if (session.user.status !== 'active') {
      return fail(403, 'USER_NOT_ACTIVE', 'Akun admin belum aktif');
    }

    const url = new URL(req.url);
    const { page, limit } = pageParams(url, 20);

    const rawStatus = url.searchParams.get('status');
    let status: PayoutStatus | undefined;
    if (rawStatus) {
      if (!VALID_STATUSES.includes(rawStatus as PayoutStatus)) {
        return fail(400, 'INVALID_STATUS', 'Filter status harus salah satu dari: requested, paid, rejected');
      }
      status = rawStatus as PayoutStatus;
    }

    const result = await WalletService.getAdminPayouts({ status, page, limit });

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
    console.error('Error fetching admin payouts:', error);
    return fail(500, 'INTERNAL_SERVER_ERROR', 'Gagal memuat antrean penarikan dana');
  }
}
