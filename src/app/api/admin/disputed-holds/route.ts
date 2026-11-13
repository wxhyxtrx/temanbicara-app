import { NextResponse } from 'next/server';
import { getSessionUser, fail, pageParams } from '@/lib/auth/session';
import {
  DisputedPayoutHoldService,
  DISPUTED_HOLD_STATUSES,
  checkActiveAdmin,
} from '@/services/disputed-payout-hold.service';
import { WalletHttpError } from '@/services/wallet.service';
import type { DisputedHoldStatus } from '@/types/wallet';

/**
 * GET /api/admin/disputed-holds
 * Daftar penahanan sengketa payout mitra terpaginasi.
 * Dilindungi hak akses admin aktif.
 */
export async function GET(req: Request) {
  try {
    const session = await getSessionUser();
    if (session.response) return session.response;

    const adminCheck = checkActiveAdmin(session.user);
    if (adminCheck) {
      return fail(adminCheck.status, adminCheck.code, adminCheck.message);
    }

    const url = new URL(req.url);
    const { page, limit } = pageParams(url, 20);

    const rawStatus = url.searchParams.get('status');
    let status: DisputedHoldStatus = 'active';
    if (rawStatus) {
      if (!DISPUTED_HOLD_STATUSES.includes(rawStatus as DisputedHoldStatus)) {
        return fail(400, 'INVALID_STATUS', 'Filter status harus salah satu dari: active, cleared, deducted');
      }
      status = rawStatus as DisputedHoldStatus;
    }

    const result = await DisputedPayoutHoldService.listDisputedHolds({ status, page, limit });

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
    console.error('Error fetching disputed holds:', error);
    return fail(500, 'INTERNAL_SERVER_ERROR', 'Gagal memuat daftar sengketa penahanan payout');
  }
}
