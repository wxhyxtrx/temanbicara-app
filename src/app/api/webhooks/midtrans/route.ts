import { NextResponse } from 'next/server';
import { fail } from '@/lib/auth/session';
import { WalletService, WalletHttpError } from '@/services/wallet.service';

/**
 * POST /api/webhooks/midtrans
 * Endpoint publik penerima notifikasi HTTP dari Midtrans Snap Sandbox/Production.
 * Idempoten dan aman terhadap replay / maintenance.
 */
export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return fail(400, 'BAD_REQUEST', 'Request body bukan format JSON yang valid');
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return fail(400, 'BAD_REQUEST', 'Request body harus berupa JSON object');
    }

    const result = await WalletService.handleMidtransWebhook(body as Record<string, unknown>);

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    if (error instanceof WalletHttpError) {
      return fail(error.status, error.code, error.message);
    }
    console.error('Unhandled error in Midtrans webhook:', error);
    return fail(500, 'INTERNAL_SERVER_ERROR', 'Gagal memproses notifikasi pembayaran');
  }
}
