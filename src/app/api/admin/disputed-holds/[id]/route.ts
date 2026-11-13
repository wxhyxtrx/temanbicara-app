import { NextResponse } from 'next/server';
import { getSessionUser, fail } from '@/lib/auth/session';
import {
  DisputedPayoutHoldService,
  resolveDisputedHoldSchema,
  checkActiveAdmin,
} from '@/services/disputed-payout-hold.service';
import { WalletHttpError } from '@/services/wallet.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PATCH /api/admin/disputed-holds/[id]
 * Menyelesaikan sengketa penahanan payout mitra (action: 'clear' | 'deduct', note: string).
 * Dilindungi autentikasi admin aktif.
 * Idempoten: menolak hold yang sudah tidak berstatus 'active' dengan 409 HOLD_ALREADY_RESOLVED.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser();
    if (session.response) return session.response;

    const adminCheck = checkActiveAdmin(session.user);
    if (adminCheck) {
      return fail(adminCheck.status, adminCheck.code, adminCheck.message);
    }

    const { id } = await params;
    if (!id || !UUID_RE.test(id)) {
      return fail(400, 'INVALID_ID', 'ID sengketa penahanan payout tidak valid');
    }

    const rawBody = await req.json().catch(() => null);
    const parsed = resolveDisputedHoldSchema.safeParse(rawBody);
    if (!parsed.success) {
      return fail(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Data tidak valid');
    }

    const result = await DisputedPayoutHoldService.resolveDisputedHold(
      id,
      session.user.id,
      parsed.data.action,
      parsed.data.note
    );

    return NextResponse.json({
      success: true,
      message: 'Sengketa hold berhasil diselesaikan',
      data: result,
    });
  } catch (error) {
    if (error instanceof WalletHttpError) {
      return fail(error.status, error.code, error.message);
    }
    console.error('Error resolving disputed hold:', error);
    return fail(500, 'INTERNAL_SERVER_ERROR', 'Gagal menyelesaikan sengketa penahanan payout');
  }
}
