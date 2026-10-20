import { NextResponse } from 'next/server';
import { getSessionUser, fail } from '@/lib/auth/session';
import { getMaintenanceStatus } from '@/lib/maintenance';
import { WalletService, WalletHttpError } from '@/services/wallet.service';
import { createTopupOrderSchema } from '@/lib/validations/wallet';

export async function POST(req: Request) {
  try {
    const maintenance = await getMaintenanceStatus();
    if (maintenance.phase === 'draining') {
      return fail(503, 'MAINTENANCE_DRAINING', 'Sistem sedang bersiap untuk pemeliharaan. Transaksi baru ditunda.');
    }
    if (maintenance.phase === 'active') {
      return fail(503, 'MAINTENANCE_ACTIVE', maintenance.message);
    }

    const session = await getSessionUser();
    if (session.response) return session.response;
    if (session.user.role !== 'pasien') {
      return fail(403, 'FORBIDDEN', 'Hanya pasien yang dapat melakukan top-up koin');
    }
    if (session.user.status !== 'active') {
      return fail(403, 'USER_NOT_ACTIVE', 'Akun pasien belum aktif');
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return fail(400, 'BAD_REQUEST', 'Request body bukan format JSON yang valid');
    }

    const parsed = createTopupOrderSchema.safeParse(body);
    if (!parsed.success) {
      return fail(422, 'TOPUP_COINS_OUT_OF_RANGE', parsed.error.issues[0]?.message || 'Jumlah koin tidak valid');
    }

    const result = await WalletService.createTopupOrder(session.user, parsed.data.coins);

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof WalletHttpError) {
      return fail(error.status, error.code, error.message);
    }
    console.error('Error creating topup order:', error);
    return fail(500, 'INTERNAL_SERVER_ERROR', 'Gagal memproses pesanan top-up');
  }
}
