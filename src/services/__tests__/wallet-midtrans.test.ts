// T-234 (PRD-053): webhook Midtrans — signature, idempotensi settlement, mismatch nominal, status non-settlement.
// ponytail: RPC topup_settle/topup_fail ditiru fake in-memory (idempoten + cek nominal seperti SQL aslinya);
// SQL riil tetap diuji oleh supabase/tests/*_dryrun.sql (doktrin dual testing).
import { TEST_SERVER_KEY, catchError, type RpcResult } from '@/test/env';
import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { supabaseAdmin } from '@/lib/supabase/client';
import type { PaymentStatus } from '@/types/wallet';

const { WalletService } = await import('../wallet.service');

interface Order {
  id: string;
  order_id: string;
  patient_id: string;
  coins: number;
  amount_rupiah: number;
  status: PaymentStatus;
  provider_reference: string | null;
}

function createDb(order: Order) {
  const state = { order: { ...order }, coinBalance: 0, ledger: [] as Array<{ amount: number; reason: string }> };
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const updates: Array<Record<string, unknown>> = [];

  const rpc = async (fn: string, args: Record<string, unknown>): Promise<RpcResult> => {
    rpcCalls.push({ fn, args });
    const o = state.order;
    if (fn === 'topup_settle') {
      if (o.status === 'settlement') return { data: false, error: null }; // retry: tidak ada kredit ganda
      if (args.p_paid_amount_rupiah !== o.amount_rupiah) {
        return { data: null, error: { code: '22023', message: 'TOPUP_AMOUNT_MISMATCH' } };
      }
      o.status = 'settlement';
      o.provider_reference = String(args.p_provider_reference);
      state.coinBalance += o.coins;
      state.ledger.push({ amount: o.coins, reason: 'topup_credit' });
      return { data: true, error: null };
    }
    if (fn === 'topup_fail') {
      if (o.status === 'pending') o.status = args.p_status as PaymentStatus;
      return { data: null, error: null };
    }
    if (fn === 'create_dispute_holds') return { data: 0, error: null };
    throw new Error(`RPC tidak diharapkan: ${fn}`);
  };

  const client = {
    rpc,
    from: (table: string) => {
      if (table !== 'topup_orders') throw new Error(`Tabel tidak diharapkan: ${table}`);
      return {
        select: () => ({
          eq: (_c: string, v: string) => ({
            maybeSingle: async () => ({ data: v === state.order.order_id ? { ...state.order } : null, error: null }),
          }),
        }),
        update: (payload: Record<string, unknown>) => ({
          eq: async () => {
            updates.push(payload);
            Object.assign(state.order, payload);
            return { error: null };
          },
        }),
      };
    },
  };
  return { client: client as unknown as typeof supabaseAdmin, state, rpcCalls, updates };
}

const sign = (orderId: string, statusCode: string, gross: string, key = TEST_SERVER_KEY) =>
  crypto.createHash('sha512').update(orderId + statusCode + gross + key).digest('hex');

function payload(orderId: string, transaction_status: string, gross = '100000.00', statusCode = '200') {
  return {
    order_id: orderId,
    status_code: statusCode,
    gross_amount: gross,
    signature_key: sign(orderId, statusCode, gross),
    transaction_status,
    transaction_id: `tx-${orderId}`,
  };
}

const pending = (orderId: string, status: PaymentStatus = 'pending'): Order => ({
  id: `id-${orderId}`,
  order_id: orderId,
  patient_id: 'pasien-1',
  coins: 10,
  amount_rupiah: 100_000,
  status,
  provider_reference: null,
});

describe('Webhook Midtrans — signature', () => {
  it('signature valid diterima dan settlement diproses', async () => {
    const db = createDb(pending('TOPUP-SIG-1'));
    const res = await WalletService.handleMidtransWebhook(payload('TOPUP-SIG-1', 'settlement'), db.client);
    expect(res).toStrictEqual({ success: true, message: 'Order settled successfully' });
    expect(db.state.coinBalance).toBe(10);
  });

  it.each([
    ['signature dari server key lain', (p: ReturnType<typeof payload>) => ({ ...p, signature_key: sign(p.order_id, p.status_code, p.gross_amount, 'kunci-palsu') })],
    ['gross_amount diubah setelah ditandatangani', (p: ReturnType<typeof payload>) => ({ ...p, gross_amount: '1000000.00' })],
    ['signature kosong', (p: ReturnType<typeof payload>) => ({ ...p, signature_key: '' })],
    ['signature panjang salah', (p: ReturnType<typeof payload>) => ({ ...p, signature_key: 'abc' })],
  ])('%s ditolak 401 INVALID_SIGNATURE tanpa menyentuh DB', async (_label, tamper) => {
    const db = createDb(pending('TOPUP-SIG-2'));
    const err = await catchError(() => WalletService.handleMidtransWebhook(tamper(payload('TOPUP-SIG-2', 'settlement')), db.client));
    expect(err).toMatchObject({ status: 401, code: 'INVALID_SIGNATURE' });
    expect(db.rpcCalls.length).toBe(0);
    expect(db.state.coinBalance).toBe(0);
  });

  it('signature uppercase tetap diterima (perbandingan case-insensitive)', async () => {
    const db = createDb(pending('TOPUP-SIG-3'));
    const p = payload('TOPUP-SIG-3', 'settlement');
    const res = await WalletService.handleMidtransWebhook({ ...p, signature_key: p.signature_key.toUpperCase() }, db.client);
    expect(res.success).toBe(true);
  });
});

describe('Webhook Midtrans — settlement', () => {
  it('retry settlement tidak menduplikasi kredit koin', async () => {
    const db = createDb(pending('TOPUP-IDEM-1'));
    const first = await WalletService.handleMidtransWebhook(payload('TOPUP-IDEM-1', 'settlement'), db.client);
    const second = await WalletService.handleMidtransWebhook(payload('TOPUP-IDEM-1', 'settlement'), db.client);
    expect(first.message).toBe('Order settled successfully');
    expect(second).toStrictEqual({ success: true, message: 'Order already settled' });
    expect(db.state.coinBalance, 'Koin hanya dikredit sekali').toBe(10);
    expect(db.state.ledger.length).toBe(1);
    expect(db.updates.length, 'Settlement wajib lewat RPC, bukan UPDATE langsung').toBe(0);
  });

  it('capture + fraud_status accept diperlakukan sebagai settlement; capture tanpa accept tidak', async () => {
    const db = createDb(pending('TOPUP-CAP-1'));
    const challenge = await WalletService.handleMidtransWebhook({ ...payload('TOPUP-CAP-1', 'capture'), fraud_status: 'challenge' }, db.client);
    expect(challenge.message).toBe('Status capture recorded');
    expect(db.state.coinBalance).toBe(0);
    await WalletService.handleMidtransWebhook({ ...payload('TOPUP-CAP-1', 'capture'), fraud_status: 'accept' }, db.client);
    expect(db.state.coinBalance).toBe(10);
  });

  it('nominal mismatch ditolak 422 TOPUP_AMOUNT_MISMATCH tanpa kredit koin', async () => {
    const db = createDb(pending('TOPUP-MIS-1'));
    const err = await catchError(() => WalletService.handleMidtransWebhook(payload('TOPUP-MIS-1', 'settlement', '50000.00'), db.client));
    expect(err).toMatchObject({ status: 422, code: 'TOPUP_AMOUNT_MISMATCH' });
    expect(db.rpcCalls[0].args.p_paid_amount_rupiah, 'gross_amount dibulatkan ke rupiah bulat').toBe(50_000);
    expect(db.state.coinBalance).toBe(0);
    expect(db.state.order.status).toBe('pending');
  });

  it('error RPC lain dipetakan 500 RPC_ERROR', async () => {
    const db = createDb(pending('TOPUP-ERR-1'));
    db.client.rpc = (async () => ({ data: null, error: { code: 'XX000', message: 'boom' } })) as unknown as typeof db.client.rpc;
    const err = await catchError(() => WalletService.handleMidtransWebhook(payload('TOPUP-ERR-1', 'settlement'), db.client));
    expect(err).toMatchObject({ status: 500, code: 'RPC_ERROR' });
  });

  it('order tidak dikenal ditolak 404 ORDER_NOT_FOUND', async () => {
    const db = createDb(pending('TOPUP-ADA'));
    const err = await catchError(() => WalletService.handleMidtransWebhook(payload('TOPUP-TIDAK-ADA', 'settlement'), db.client));
    expect(err).toMatchObject({ status: 404, code: 'ORDER_NOT_FOUND' });
  });
});

describe('Webhook Midtrans — status non-settlement', () => {
  it.each(['expire', 'cancel', 'deny'])('%s memanggil topup_fail tanpa menambah koin', async (status) => {
    const db = createDb(pending(`TOPUP-${status}`));
    const res = await WalletService.handleMidtransWebhook(payload(`TOPUP-${status}`, status), db.client);
    expect(res).toStrictEqual({ success: true, message: `Order marked as ${status}` });
    expect(db.rpcCalls.map((c) => [c.fn, c.args.p_status])).toStrictEqual([['topup_fail', status]]);
    expect(db.state.order.status).toBe(status);
    expect(db.state.coinBalance).toBe(0);
  });

  it('status pending dicatat tanpa RPC', async () => {
    const db = createDb(pending('TOPUP-PEND'));
    const res = await WalletService.handleMidtransWebhook(payload('TOPUP-PEND', 'pending', '100000.00', '201'), db.client);
    expect(res.message).toBe('Status pending recorded');
    expect(db.rpcCalls.length).toBe(0);
  });
});

describe('Webhook Midtrans — filter refund/chargeback', () => {
  it.each(['pending', 'expire', 'cancel', 'deny'] as const)('order %s: refund/chargeback diabaikan tanpa hold', async (status) => {
    for (const tx of ['refund', 'chargeback']) {
      const db = createDb(pending(`TOPUP-F-${status}`, status));
      const res = await WalletService.handleMidtransWebhook(payload(`TOPUP-F-${status}`, tx), db.client);
      expect(res.message).toBe(`Refund/chargeback notification ignored for order in ${status} status`);
      expect(db.updates.length).toBe(0);
      expect(db.rpcCalls.length).toBe(0);
      expect(db.state.order.status).toBe(status);
    }
  });

  it('order settlement: chargeback mengubah status dan membuat dispute hold, saldo koin tidak disentuh', async () => {
    const db = createDb(pending('TOPUP-CB', 'settlement'));
    const res = await WalletService.handleMidtransWebhook(payload('TOPUP-CB', 'chargeback'), db.client);
    expect(res.message).toBe('Order marked as chargeback');
    expect(db.state.order.status).toBe('chargeback');
    expect(db.rpcCalls.map((c) => c.fn)).toStrictEqual(['create_dispute_holds']);
    expect(db.state.coinBalance).toBe(0);
  });
});
