import { NextResponse } from 'next/server';
import { getSessionUser, fail } from '@/lib/auth/session';
import { WalletService, WalletHttpError } from '@/services/wallet.service';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ order_id: string }> }
) {
  try {
    const session = await getSessionUser();
    if (session.response) return session.response;
    if (session.user.status !== 'active') {
      return fail(403, 'USER_NOT_ACTIVE', 'Akun pengguna belum aktif');
    }

    const { order_id } = await params;
    if (!order_id || typeof order_id !== 'string') {
      return fail(400, 'BAD_REQUEST', 'order_id wajib diisi');
    }

    const data = await WalletService.getTopupOrder(order_id, session.user);

    const resPayload: Record<string, unknown> = {
      success: true,
      data,
    };
    if (data.reconciled_at) {
      resPayload.reconciled_at = data.reconciled_at;
    }

    return NextResponse.json(resPayload);
  } catch (error) {
    if (error instanceof WalletHttpError) {
      return fail(error.status, error.code, error.message);
    }
    console.error('Error checking topup order status:', error);
    return fail(500, 'INTERNAL_SERVER_ERROR', 'Gagal memeriksa status pesanan top-up');
  }
}
