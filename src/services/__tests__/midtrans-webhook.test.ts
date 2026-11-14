// Pastikan environment fallback terpasang sebelum modul supabase client di-import
if (!process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://dummy.supabase.co';
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && !process.env.SUPABASE_ANON_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'dummy-anon-key';
}

import { afterAll, assert, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import type { PaymentStatus } from '@/types/wallet';
import type { supabaseAdmin } from '@/lib/supabase/client';

type SupabaseAdminType = typeof supabaseAdmin;

interface MockTopupOrder {
  id: string;
  order_id: string;
  amount_rupiah: number;
  status: PaymentStatus;
  provider_reference: string | null;
}

interface MockClientOptions {
  initialOrder?: MockTopupOrder | null;
  rpcHandler?: (
    fn: string,
    args: unknown
  ) =>
    | Promise<{ data?: unknown; error?: { code?: string; message?: string } | null }>
    | { data?: unknown; error?: { code?: string; message?: string } | null };
}

/**
 * Mock DB Client factory untuk pengujian unit WalletService.handleMidtransWebhook
 */
function createMockDbClient(options: MockClientOptions = {}) {
  let currentOrder: MockTopupOrder | null = options.initialOrder ? { ...options.initialOrder } : null;
  const updateCalls: Array<{ order_id: string; status: PaymentStatus; provider_reference: string }> = [];
  const rpcCalls: Array<{ fn: string; args: unknown }> = [];
  const tableAccess: string[] = [];

  const mockDb = {
    from: (table: string) => {
      tableAccess.push(table);
      if (table !== 'topup_orders') {
        throw new Error(`Akses tidak diizinkan ke tabel: ${table}`);
      }
      return {
        select: (_cols: string) => ({
          eq: (field: string, value: string) => ({
            maybeSingle: async () => {
              if (field === 'order_id' && currentOrder && currentOrder.order_id === value) {
                return {
                  data: {
                    id: currentOrder.id,
                    order_id: currentOrder.order_id,
                    amount_rupiah: currentOrder.amount_rupiah,
                    status: currentOrder.status,
                  },
                  error: null,
                };
              }
              return { data: null, error: null };
            },
          }),
        }),
        update: (payload: { status: PaymentStatus; provider_reference: string }) => ({
          eq: async (field: string, value: string) => {
            if (field === 'order_id' && currentOrder && currentOrder.order_id === value) {
              currentOrder.status = payload.status;
              currentOrder.provider_reference = payload.provider_reference;
              updateCalls.push({
                order_id: value,
                status: payload.status,
                provider_reference: payload.provider_reference,
              });
              return { error: null };
            }
            return { error: { message: 'Order not found for update' } };
          },
        }),
      };
    },
    rpc: async (fn: string, args: unknown) => {
      rpcCalls.push({ fn, args });
      if (options.rpcHandler) {
        return options.rpcHandler(fn, args);
      }
      return { data: true, error: null };
    },
  };

  return {
    client: mockDb as unknown as SupabaseAdminType,
    getOrder: () => (currentOrder ? { ...currentOrder } : null),
    getUpdates: () => [...updateCalls],
    getRpcCalls: () => [...rpcCalls],
    getTableAccess: () => [...tableAccess],
  };
}

/**
 * Helper kalkulasi SHA-512 signature Midtrans sesuai spesifikasi resmi
 */
function computeMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  serverKey: string
): string {
  return crypto
    .createHash('sha512')
    .update(orderId + statusCode + grossAmount + serverKey)
    .digest('hex');
}


const { WalletService, WalletHttpError } = await import('../wallet.service');

describe('Midtrans webhook refund & chargeback (T-214/T-215)', () => {
  const DUMMY_SERVER_KEY = 'SB-Mid-server-TEST-KEY-XYZ-9999';
  let originalServerKey: string | undefined;
  beforeAll(() => {
    originalServerKey = process.env.PAYMENT_SERVER_KEY;
    process.env.PAYMENT_SERVER_KEY = DUMMY_SERVER_KEY;
  });
  afterAll(() => {
    process.env.PAYMENT_SERVER_KEY = originalServerKey;
  });

  it('UJI 1 LULUS: Kalkulasi signature SHA-512 valid dan deterministik (128 char hex)', async () => {
    const orderId = 'topup-uuid-001';
    const statusCode = '200';
    const grossAmount = '100000.00';
    const sig = computeMidtransSignature(orderId, statusCode, grossAmount, DUMMY_SERVER_KEY);

    expect(sig.length, 'Panjang hash SHA-512 hex harus tepat 128 karakter').toBe(128);
    assert(/^[a-f0-9]{128}$/.test(sig), 'Format signature harus berupa hex lowercase');

    // Verifikasi konsistensi hash deterministik
    const sig2 = computeMidtransSignature(orderId, statusCode, grossAmount, DUMMY_SERVER_KEY);
    expect(sig, 'Kalkulasi signature deterministik harus konsisten').toBe(sig2);
  });

  it('UJI 2 LULUS: Signature tidak valid ditolak dengan 401 INVALID_SIGNATURE', async () => {
    const mock = createMockDbClient({
      initialOrder: {
        id: 'ord-1',
        order_id: 'topup-uuid-002',
        amount_rupiah: 100000,
        status: 'settlement',
        provider_reference: 'prev-ref',
      },
    });

    const invalidPayload = {
      order_id: 'topup-uuid-002',
      status_code: '200',
      gross_amount: '100000.00',
      signature_key: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
      transaction_status: 'refund',
    };

    await expect((async () => {
        await WalletService.handleMidtransWebhook(invalidPayload, mock.client);
      })()).rejects.toSatisfy((err: unknown) => {
        assert(err instanceof WalletHttpError, 'Error harus instance WalletHttpError');
        expect(err.status, 'Status code harus 401').toBe(401);
        expect(err.code, 'Error code harus INVALID_SIGNATURE').toBe('INVALID_SIGNATURE');
        return true;
      });
  });

  it('UJI 3 LULUS: Order tidak ditemukan ditolak dengan 404 ORDER_NOT_FOUND', async () => {
    const mock = createMockDbClient({ initialOrder: null });
    const orderId = 'topup-nonexistent-003';
    const statusCode = '200';
    const grossAmount = '50000.00';
    const signatureKey = computeMidtransSignature(orderId, statusCode, grossAmount, DUMMY_SERVER_KEY);

    const payload = {
      order_id: orderId,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: signatureKey,
      transaction_status: 'refund',
    };

    await expect((async () => {
        await WalletService.handleMidtransWebhook(payload, mock.client);
      })()).rejects.toSatisfy((err: unknown) => {
        assert(err instanceof WalletHttpError, 'Error harus instance WalletHttpError');
        expect(err.status, 'Status code harus 404').toBe(404);
        expect(err.code, 'Error code harus ORDER_NOT_FOUND').toBe('ORDER_NOT_FOUND');
        return true;
      });
  });

  it('UJI 4 LULUS: Webhook refund memperbarui status order menjadi refund dan memanggil RPC dispute holds', async () => {
    const orderId = 'topup-refund-004';
    const statusCode = '200';
    const grossAmount = '100000.00';
    const signatureKey = computeMidtransSignature(orderId, statusCode, grossAmount, DUMMY_SERVER_KEY);

    const mock = createMockDbClient({
      initialOrder: {
        id: 'ord-4',
        order_id: orderId,
        amount_rupiah: 100000,
        status: 'settlement',
        provider_reference: 'prev-tx-4',
      },
    });

    const payload = {
      order_id: orderId,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: signatureKey,
      transaction_status: 'refund',
      transaction_id: 'midtrans-refund-tx-4',
    };

    const result = await WalletService.handleMidtransWebhook(payload, mock.client);

    expect(result.success).toBe(true);
    expect(result.message).toBe('Order marked as refund');

    const updated = mock.getOrder();
    expect(updated?.status, 'Status order harus berubah menjadi refund').toBe('refund');
    expect(updated?.provider_reference, 'provider_reference harus terbarui').toBe('midtrans-refund-tx-4');

    // Verifikasi RPC create_dispute_holds terpanggil dan tidak ada mutasi langsung ke wallets
    const rpcCalls = mock.getRpcCalls();
    expect(rpcCalls.length, 'Harus memanggil RPC create_dispute_holds').toBe(1);
    expect(rpcCalls[0].fn).toBe('create_dispute_holds');
    expect(rpcCalls[0].args).toStrictEqual({ p_topup_order_id: 'ord-4' });
    assert(!mock.getTableAccess().includes('wallets'), 'Tabel wallets tidak boleh diakses');
  });

  it('UJI 5 LULUS: Webhook partial_refund dipetakan ke status refund dan memicu dispute holds', async () => {
    const orderId = 'topup-partial-005';
    const statusCode = '200';
    const grossAmount = '100000.00';
    const signatureKey = computeMidtransSignature(orderId, statusCode, grossAmount, DUMMY_SERVER_KEY);

    const mock = createMockDbClient({
      initialOrder: {
        id: 'ord-5',
        order_id: orderId,
        amount_rupiah: 100000,
        status: 'settlement',
        provider_reference: 'prev-tx-5',
      },
    });

    const payload = {
      order_id: orderId,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: signatureKey,
      transaction_status: 'partial_refund',
      transaction_id: 'midtrans-partial-tx-5',
    };

    const result = await WalletService.handleMidtransWebhook(payload, mock.client);

    expect(result.success).toBe(true);
    expect(result.message).toBe('Order marked as refund');

    const updated = mock.getOrder();
    expect(updated?.status, 'partial_refund harus dipetakan ke status refund').toBe('refund');
    expect(updated?.provider_reference).toBe('midtrans-partial-tx-5');

    const rpcCalls = mock.getRpcCalls();
    expect(rpcCalls.length, 'Harus memanggil RPC create_dispute_holds').toBe(1);
    expect(rpcCalls[0].fn).toBe('create_dispute_holds');
    expect(rpcCalls[0].args).toStrictEqual({ p_topup_order_id: 'ord-5' });
  });

  it('UJI 6 LULUS: Webhook chargeback memperbarui status order menjadi chargeback dan memicu dispute holds', async () => {
    const orderId = 'topup-chargeback-006';
    const statusCode = '200';
    const grossAmount = '100000.00';
    const signatureKey = computeMidtransSignature(orderId, statusCode, grossAmount, DUMMY_SERVER_KEY);

    const mock = createMockDbClient({
      initialOrder: {
        id: 'ord-6',
        order_id: orderId,
        amount_rupiah: 100000,
        status: 'settlement',
        provider_reference: 'prev-tx-6',
      },
    });

    const payload = {
      order_id: orderId,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: signatureKey,
      transaction_status: 'chargeback',
      transaction_id: 'midtrans-cb-tx-6',
    };

    const result = await WalletService.handleMidtransWebhook(payload, mock.client);

    expect(result.success).toBe(true);
    expect(result.message).toBe('Order marked as chargeback');

    const updated = mock.getOrder();
    expect(updated?.status, 'Status order harus berubah menjadi chargeback').toBe('chargeback');
    expect(updated?.provider_reference).toBe('midtrans-cb-tx-6');

    const rpcCalls = mock.getRpcCalls();
    expect(rpcCalls.length, 'Harus memanggil RPC create_dispute_holds').toBe(1);
    expect(rpcCalls[0].fn).toBe('create_dispute_holds');
    expect(rpcCalls[0].args).toStrictEqual({ p_topup_order_id: 'ord-6' });
  });

  it('UJI 7 LULUS: Idempotensi refund terbukti (return success tanpa update DB ulang, RPC tetap dipanggil)', async () => {
    const orderId = 'topup-idem-refund-007';
    const statusCode = '200';
    const grossAmount = '100000.00';
    const signatureKey = computeMidtransSignature(orderId, statusCode, grossAmount, DUMMY_SERVER_KEY);

    const mock = createMockDbClient({
      initialOrder: {
        id: 'ord-7',
        order_id: orderId,
        amount_rupiah: 100000,
        status: 'refund', // Sudah berstatus refund sebelumnya
        provider_reference: 'existing-refund-tx',
      },
    });

    const payload = {
      order_id: orderId,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: signatureKey,
      transaction_status: 'refund',
      transaction_id: 'duplicate-refund-tx',
    };

    const result = await WalletService.handleMidtransWebhook(payload, mock.client);

    expect(result.success).toBe(true);
    expect(result.message).toBe('Order already marked as refund');
    expect(mock.getUpdates().length, 'Tidak boleh ada query update ke database pada webhook duplikat').toBe(0);

    // Verifikasi RPC create_dispute_holds tetap dipanggil untuk mengantisipasi hold yang belum tercatat
    const rpcCalls = mock.getRpcCalls();
    assert(
      rpcCalls.some(
        (c) =>
          c.fn === 'create_dispute_holds' &&
          (c.args as { p_topup_order_id: string }).p_topup_order_id === 'ord-7'
      ),
      'RPC create_dispute_holds harus tetap dipanggil pada webhook refund retry'
    );

    // Uji juga idempotensi jika dikirim partial_refund pada order yang sudah refund
    const partialPayload = {
      ...payload,
      transaction_status: 'partial_refund',
    };
    const partialResult = await WalletService.handleMidtransWebhook(partialPayload, mock.client);
    expect(partialResult.success).toBe(true);
    expect(partialResult.message).toBe('Order already marked as refund');
    expect(mock.getUpdates().length, 'Tidak boleh ada query update pada partial_refund berulang').toBe(0);
  });

  it('UJI 8 LULUS: Idempotensi chargeback terbukti (return success tanpa update DB ulang, RPC tetap dipanggil)', async () => {
    const orderId = 'topup-idem-cb-008';
    const statusCode = '200';
    const grossAmount = '100000.00';
    const signatureKey = computeMidtransSignature(orderId, statusCode, grossAmount, DUMMY_SERVER_KEY);

    const mock = createMockDbClient({
      initialOrder: {
        id: 'ord-8',
        order_id: orderId,
        amount_rupiah: 100000,
        status: 'chargeback', // Sudah berstatus chargeback sebelumnya
        provider_reference: 'existing-cb-tx',
      },
    });

    const payload = {
      order_id: orderId,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: signatureKey,
      transaction_status: 'chargeback',
      transaction_id: 'duplicate-cb-tx',
    };

    const result = await WalletService.handleMidtransWebhook(payload, mock.client);

    expect(result.success).toBe(true);
    expect(result.message).toBe('Order already marked as chargeback');
    expect(mock.getUpdates().length, 'Tidak boleh ada query update ke database pada webhook duplikat').toBe(0);

    const rpcCalls = mock.getRpcCalls();
    assert(
      rpcCalls.some(
        (c) =>
          c.fn === 'create_dispute_holds' &&
          (c.args as { p_topup_order_id: string }).p_topup_order_id === 'ord-8'
      ),
      'RPC create_dispute_holds harus tetap dipanggil pada webhook chargeback retry'
    );
  });

  it('UJI 9 LULUS: Log audit bebas PII dan hanya mencatat order_id serta status', async () => {
    const orderId = 'topup-pii-check-009';
    const statusCode = '200';
    const grossAmount = '100000.00';
    const signatureKey = computeMidtransSignature(orderId, statusCode, grossAmount, DUMMY_SERVER_KEY);

    const mock = createMockDbClient({
      initialOrder: {
        id: 'ord-9',
        order_id: orderId,
        amount_rupiah: 100000,
        status: 'settlement',
        provider_reference: 'prev-tx-9',
      },
    });

    // Simpan log console
    const originalLog = console.log;
    const loggedItems: Array<{ message: string; data: unknown }> = [];
    console.log = (msg: unknown, data?: unknown) => {
      loggedItems.push({ message: String(msg), data });
    };

    try {
      const payload = {
        order_id: orderId,
        status_code: statusCode,
        gross_amount: grossAmount,
        signature_key: signatureKey,
        transaction_status: 'chargeback',
        transaction_id: 'tx-pii-check',
      };

      await WalletService.handleMidtransWebhook(payload, mock.client);

      const statusLog = loggedItems.find((l) => l.message === '[MIDTRANS_WEBHOOK_STATUS_UPDATE]');
      assert(statusLog, 'Log [MIDTRANS_WEBHOOK_STATUS_UPDATE] harus tercatat');

      const logData = statusLog.data as Record<string, unknown>;
      expect(logData).toStrictEqual({
        order_id: orderId,
        status: 'chargeback',
        transaction_status: 'chargeback',
      });

      // Verifikasi ketat tidak ada kebocoran PII
      const serialized = JSON.stringify(logData);
      assert(!serialized.includes('email'), 'Log tidak boleh memuat field email');
      assert(!serialized.includes('patient'), 'Log tidak boleh memuat nama pasien');
      assert(!serialized.includes('user_id'), 'Log tidak boleh memuat user_id');
      assert(!serialized.includes(DUMMY_SERVER_KEY), 'Log tidak boleh memuat server key');
    } finally {
      console.log = originalLog;
    }
  });

  it('UJI 10 LULUS: Order status non-settlement (pending, expire, cancel, deny) diabaikan tanpa mutasi DB dan tanpa RPC', async () => {
    const nonSettlementStatuses: PaymentStatus[] = ['pending', 'expire', 'cancel', 'deny'];

    for (const nonSettlementStatus of nonSettlementStatuses) {
      const orderId = `topup-nonsettle-${nonSettlementStatus}-010`;
      const statusCode = '200';
      const grossAmount = '100000.00';
      const signatureKey = computeMidtransSignature(orderId, statusCode, grossAmount, DUMMY_SERVER_KEY);

      const mock = createMockDbClient({
        initialOrder: {
          id: `ord-${nonSettlementStatus}`,
          order_id: orderId,
          amount_rupiah: 100000,
          status: nonSettlementStatus,
          provider_reference: null,
        },
      });

      // Coba kirim status 'refund'
      const refundPayload = {
        order_id: orderId,
        status_code: statusCode,
        gross_amount: grossAmount,
        signature_key: signatureKey,
        transaction_status: 'refund',
        transaction_id: `tx-ref-${nonSettlementStatus}`,
      };

      const refundResult = await WalletService.handleMidtransWebhook(refundPayload, mock.client);

      expect(refundResult.success).toBe(true);
      expect(refundResult.message).toBe(`Refund/chargeback notification ignored for order in ${nonSettlementStatus} status`);
      expect(mock.getUpdates().length, `Status ${nonSettlementStatus} tidak boleh dimutasi pada webhook refund`).toBe(0);
      expect(mock.getOrder()?.status, `Status di DB harus tetap ${nonSettlementStatus}`).toBe(nonSettlementStatus);
      expect(mock.getRpcCalls().length, `Tidak boleh memanggil RPC create_dispute_holds untuk order ${nonSettlementStatus}`).toBe(0);

      // Coba kirim status 'chargeback'
      const chargebackPayload = {
        order_id: orderId,
        status_code: statusCode,
        gross_amount: grossAmount,
        signature_key: signatureKey,
        transaction_status: 'chargeback',
        transaction_id: `tx-cb-${nonSettlementStatus}`,
      };

      const cbResult = await WalletService.handleMidtransWebhook(chargebackPayload, mock.client);

      expect(cbResult.success).toBe(true);
      expect(cbResult.message).toBe(`Refund/chargeback notification ignored for order in ${nonSettlementStatus} status`);
      expect(mock.getUpdates().length, `Status ${nonSettlementStatus} tidak boleh dimutasi pada webhook chargeback`).toBe(0);
      expect(mock.getOrder()?.status, `Status di DB harus tetap ${nonSettlementStatus}`).toBe(nonSettlementStatus);
      expect(mock.getRpcCalls().length, `Tidak boleh memanggil RPC create_dispute_holds untuk order ${nonSettlementStatus}`).toBe(0);
    }
  });

  it('UJI 11 LULUS: Log audit saat diabaikan bebas PII dan hanya mencatat order_id serta status', async () => {
    const orderId = 'topup-pii-ignore-011';
    const statusCode = '200';
    const grossAmount = '75000.00';
    const signatureKey = computeMidtransSignature(orderId, statusCode, grossAmount, DUMMY_SERVER_KEY);

    const mock = createMockDbClient({
      initialOrder: {
        id: 'ord-pii-ignore',
        order_id: orderId,
        amount_rupiah: 75000,
        status: 'pending',
        provider_reference: null,
      },
    });

    const originalLog = console.log;
    const loggedItems: Array<{ message: string; data: unknown }> = [];
    console.log = (msg: unknown, data?: unknown) => {
      loggedItems.push({ message: String(msg), data });
    };

    try {
      const payload = {
        order_id: orderId,
        status_code: statusCode,
        gross_amount: grossAmount,
        signature_key: signatureKey,
        transaction_status: 'refund',
        transaction_id: 'tx-pii-ignore',
      };

      await WalletService.handleMidtransWebhook(payload, mock.client);

      const ignoreLog = loggedItems.find((l) => l.message === '[MIDTRANS_WEBHOOK_STATUS_IGNORED]');
      assert(ignoreLog, 'Log [MIDTRANS_WEBHOOK_STATUS_IGNORED] harus tercatat');

      const logData = ignoreLog.data as Record<string, unknown>;
      expect(logData).toStrictEqual({
        order_id: orderId,
        status: 'pending',
        transaction_status: 'refund',
      });

      const serialized = JSON.stringify(logData);
      assert(!serialized.includes('email'), 'Log tidak boleh memuat field email');
      assert(!serialized.includes('patient'), 'Log tidak boleh memuat nama pasien');
      assert(!serialized.includes('token'), 'Log tidak boleh memuat token');
      assert(!serialized.includes(DUMMY_SERVER_KEY), 'Log tidak boleh memuat server key');
    } finally {
      console.log = originalLog;
    }
  });

  it('UJI 12 LULUS: Webhook retry berhasil memicu RPC create_dispute_holds setelah kegagalan awal', async () => {
    const orderId = 'topup-retry-rpc-012';
    const statusCode = '200';
    const grossAmount = '100000.00';
    const signatureKey = computeMidtransSignature(orderId, statusCode, grossAmount, DUMMY_SERVER_KEY);

    let rpcAttempt = 0;
    const mock = createMockDbClient({
      initialOrder: {
        id: 'ord-retry-12',
        order_id: orderId,
        amount_rupiah: 100000,
        status: 'settlement',
        provider_reference: 'prev-tx-12',
      },
      rpcHandler: async (fn: string) => {
        if (fn === 'create_dispute_holds') {
          rpcAttempt++;
          if (rpcAttempt === 1) {
            // Percobaan 1: RPC gagal (misal koneksi / fungsi belum siap)
            return { data: null, error: { code: 'P0001', message: 'DB connection error' } };
          }
          // Percobaan 2: RPC berhasil
          return { data: 1, error: null };
        }
        return { data: true, error: null };
      },
    });

    const payload = {
      order_id: orderId,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: signatureKey,
      transaction_status: 'chargeback',
      transaction_id: 'tx-cb-retry-12',
    };

    // Panggilan 1: Webhook chargeback masuk saat status masih settlement
    const result1 = await WalletService.handleMidtransWebhook(payload, mock.client);
    expect(result1.success).toBe(true);
    expect(result1.message).toBe('Order marked as chargeback');
    expect(mock.getOrder()?.status, 'Status order harus berhasil termutasi ke chargeback').toBe('chargeback');
    expect(mock.getUpdates().length, 'Harus ada 1 mutasi DB pada webhook pertama').toBe(1);
    expect(rpcAttempt, 'RPC create_dispute_holds harus terpanggil 1x').toBe(1);

    // Panggilan 2: Webhook chargeback retry dari Midtrans (status order sudah chargeback)
    const result2 = await WalletService.handleMidtransWebhook(payload, mock.client);
    expect(result2.success).toBe(true);
    expect(result2.message).toBe('Order already marked as chargeback');
    expect(mock.getOrder()?.status, 'Status order tetap chargeback').toBe('chargeback');
    expect(mock.getUpdates().length, 'Tidak boleh ada mutasi DB tambahan pada panggilan retry').toBe(1);
    expect(rpcAttempt, 'RPC create_dispute_holds harus dipanggil ulang pada webhook retry').toBe(2);
  });

  it('UJI 13 LULUS: Kegagalan eksepsi keras pada RPC create_dispute_holds ditangani graceful (tidak crash/500)', async () => {
    const orderId = 'topup-rpc-throw-013';
    const statusCode = '200';
    const grossAmount = '100000.00';
    const signatureKey = computeMidtransSignature(orderId, statusCode, grossAmount, DUMMY_SERVER_KEY);

    const mock = createMockDbClient({
      initialOrder: {
        id: 'ord-throw-13',
        order_id: orderId,
        amount_rupiah: 100000,
        status: 'settlement',
        provider_reference: 'prev-tx-13',
      },
      rpcHandler: () => {
        // Simulasikan database throw exception jaringan tak terduga
        throw new Error('Supabase network connection terminated');
      },
    });

    const payload = {
      order_id: orderId,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: signatureKey,
      transaction_status: 'refund',
      transaction_id: 'tx-refund-throw-13',
    };

    // Webhook tidak boleh throw atau crash meskipun RPC melempar exception keras
    const result = await WalletService.handleMidtransWebhook(payload, mock.client);
    expect(result.success).toBe(true);
    expect(result.message).toBe('Order marked as refund');
    expect(mock.getOrder()?.status).toBe('refund');
  });

  it('UJI 14 LULUS: Parameter RPC create_dispute_holds tepat memuat p_topup_order_id dengan UUID pesanan', async () => {
    const orderId = 'topup-rpc-param-014';
    const statusCode = '200';
    const grossAmount = '100000.00';
    const signatureKey = computeMidtransSignature(orderId, statusCode, grossAmount, DUMMY_SERVER_KEY);

    let capturedArgs: unknown = null;
    const mock = createMockDbClient({
      initialOrder: {
        id: '11111111-2222-3333-4444-555555555555',
        order_id: orderId,
        amount_rupiah: 100000,
        status: 'settlement',
        provider_reference: 'prev-tx-14',
      },
      rpcHandler: (fn: string, args: unknown) => {
        if (fn === 'create_dispute_holds') {
          capturedArgs = args;
          return { data: 2, error: null }; // 2 hold berhasil dibuat
        }
        return { data: true, error: null };
      },
    });

    const payload = {
      order_id: orderId,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: signatureKey,
      transaction_status: 'chargeback',
      transaction_id: 'tx-cb-param-14',
    };

    const result = await WalletService.handleMidtransWebhook(payload, mock.client);
    expect(result.success).toBe(true);
    expect(result.message).toBe('Order marked as chargeback');
    expect(capturedArgs).toStrictEqual({
      p_topup_order_id: '11111111-2222-3333-4444-555555555555',
    });
  });
});
