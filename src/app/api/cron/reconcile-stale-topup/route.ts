import { NextResponse } from 'next/server';
import { fail } from '@/lib/auth/session';
import {
  WalletReconcileService,
  safeTimingCompare,
} from '@/services/wallet-reconcile.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/reconcile-stale-topup
 * Endpoint Vercel Cron untuk rekonsiliasi batch order top-up pending berumur > 1 jam.
 * Dilindungi header Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(req: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET?.trim();
    if (!cronSecret) {
      return fail(401, 'UNAUTHORIZED', 'Kredensial cron tidak valid');
    }

    const authHeader = req.headers.get('authorization')?.trim() || '';
    if (!authHeader) {
      return fail(401, 'UNAUTHORIZED', 'Kredensial cron tidak valid');
    }

    const expectedHeader = `Bearer ${cronSecret}`;
    if (!safeTimingCompare(authHeader, expectedHeader)) {
      return fail(401, 'UNAUTHORIZED', 'Kredensial cron tidak valid');
    }

    const summary = await WalletReconcileService.reconcileStaleOrders(50);
    return NextResponse.json(summary);
  } catch (err: unknown) {
    console.error('[CRON_RECONCILE_STALE_TOPUP_ERROR]:', err);
    return fail(
      500,
      'INTERNAL_SERVER_ERROR',
      'Terjadi kesalahan sistem saat rekonsiliasi order'
    );
  }
}
