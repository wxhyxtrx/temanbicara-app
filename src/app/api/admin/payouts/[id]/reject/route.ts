import { NextResponse } from 'next/server';
import { getSessionUser, fail } from '@/lib/auth/session';
import { WalletService, WalletHttpError } from '@/services/wallet.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser();
    if (session.response) return session.response;
    if (session.user.role !== 'admin') {
      return fail(403, 'FORBIDDEN', 'Hanya admin yang dapat menolak penarikan dana');
    }
    if (session.user.status !== 'active') {
      return fail(403, 'USER_NOT_ACTIVE', 'Akun admin belum aktif');
    }

    const { id } = await params;
    if (!id || !UUID_RE.test(id)) {
      return fail(400, 'INVALID_ID', 'ID pengajuan payout tidak valid');
    }

    const result = await WalletService.rejectPayout(id, session.user.id);

    return NextResponse.json({
      success: true,
      message: 'Pengajuan payout ditolak dan saldo dikembalikan ke mitra',
      data: result,
    });
  } catch (error) {
    if (error instanceof WalletHttpError) {
      return fail(error.status, error.code, error.message);
    }
    console.error('Error rejecting payout:', error);
    return fail(500, 'INTERNAL_SERVER_ERROR', 'Gagal memproses penolakan payout');
  }
}
