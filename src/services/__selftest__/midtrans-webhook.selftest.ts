// Pastikan environment fallback terpasang sebelum modul supabase client di-import
if (!process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://dummy.supabase.co';
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && !process.env.SUPABASE_ANON_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'dummy-anon-key';
}

import assert from 'node:assert/strict';
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
export function computeMidtransSignature(
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

export async function runSelfTests(): Promise<boolean> {
  console.log('[SELFTEST] Memulai pengujian webhook Midtrans refund & chargeback (T-214)...');

  const { WalletService, WalletHttpError } = await import('../wallet.service');

  const DUMMY_SERVER_KEY = 'SB-Mid-server-TEST-KEY-XYZ-9999';
  const originalServerKey = process.env.PAYMENT_SERVER_KEY;
  process.env.PAYMENT_SERVER_KEY = DUMMY_SERVER_KEY;

  try {
    // ========================================================
    // UJI 1: Kalkulasi Signature SHA-512 & Validasi Format
    // ========================================================
    {
      const orderId = 'topup-uuid-001';
      const statusCode = '200';
      const grossAmount = '100000.00';
      const sig = computeMidtransSignature(orderId, statusCode, grossAmount, DUMMY_SERVER_KEY);

      assert.strictEqual(sig.length, 128, 'Panjang hash SHA-512 hex harus tepat 128 karakter');
      assert(/^[a-f0-9]{128}$/.test(sig), 'Format signature harus berupa hex lowercase');

      // Verifikasi konsistensi hash deterministik
      const sig2 = computeMidtransSignature(orderId, statusCode, grossAmount, DUMMY_SERVER_KEY);
      assert.strictEqual(sig, sig2, 'Kalkulasi signature deterministik harus konsisten');
      console.log('✓ UJI 1 LULUS: Kalkulasi signature SHA-512 valid dan deterministik (128 char hex)');
    }

    // ========================================================
    // UJI 2: Penolakan Signature Tidak Valid (401 INVALID_SIGNATURE)
    // ========================================================
    {
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

      await assert.rejects(
        async () => {
          await WalletService.handleMidtransWebhook(invalidPayload, mock.client);
        },
        (err: unknown) => {
          assert(err instanceof WalletHttpError, 'Error harus instance WalletHttpError');
          assert.strictEqual(err.status, 401, 'Status code harus 401');
          assert.strictEqual(err.code, 'INVALID_SIGNATURE', 'Error code harus INVALID_SIGNATURE');
          return true;
        }
      );
      console.log('✓ UJI 2 LULUS: Signature tidak valid ditolak dengan 401 INVALID_SIGNATURE');
    }

    // ========================================================
    // UJI 3: Penanganan Order Tidak Ditemukan (404 ORDER_NOT_FOUND)
    // ========================================================
    {
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

      await assert.rejects(
        async () => {
          await WalletService.handleMidtransWebhook(payload, mock.client);
        },
        (err: unknown) => {
          assert(err instanceof WalletHttpError, 'Error harus instance WalletHttpError');
          assert.strictEqual(err.status, 404, 'Status code harus 404');
          assert.strictEqual(err.code, 'ORDER_NOT_FOUND', 'Error code harus ORDER_NOT_FOUND');
          return true;
        }
      );
      console.log('✓ UJI 3 LULUS: Order tidak ditemukan ditolak dengan 404 ORDER_NOT_FOUND');
    }

    // ========================================================
    // UJI 4: Pemrosesan Status 'refund' pada Order Settlement
    // ========================================================
    {
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

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.message, 'Order marked as refund');

      const updated = mock.getOrder();
      assert.strictEqual(updated?.status, 'refund', 'Status order harus berubah menjadi refund');
      assert.strictEqual(updated?.provider_reference, 'midtrans-refund-tx-4', 'provider_reference harus terbarui');

      // Verifikasi RPC create_dispute_holds terpanggil dan tidak ada mutasi langsung ke wallets
      const rpcCalls = mock.getRpcCalls();
      assert.strictEqual(rpcCalls.length, 1, 'Harus memanggil RPC create_dispute_holds');
      assert.strictEqual(rpcCalls[0].fn, 'create_dispute_holds');
      assert.deepStrictEqual(rpcCalls[0].args, { p_topup_order_id: 'ord-4' });
      assert(!mock.getTableAccess().includes('wallets'), 'Tabel wallets tidak boleh diakses');
      console.log('✓ UJI 4 LULUS: Webhook refund memperbarui status order menjadi refund dan memanggil RPC dispute holds');
    }

    // ========================================================
    // UJI 5: Pemrosesan Status 'partial_refund' Menjadi 'refund'
    // ========================================================
    {
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

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.message, 'Order marked as refund');

      const updated = mock.getOrder();
      assert.strictEqual(updated?.status, 'refund', 'partial_refund harus dipetakan ke status refund');
      assert.strictEqual(updated?.provider_reference, 'midtrans-partial-tx-5');

      const rpcCalls = mock.getRpcCalls();
      assert.strictEqual(rpcCalls.length, 1, 'Harus memanggil RPC create_dispute_holds');
      assert.strictEqual(rpcCalls[0].fn, 'create_dispute_holds');
      assert.deepStrictEqual(rpcCalls[0].args, { p_topup_order_id: 'ord-5' });
      console.log('✓ UJI 5 LULUS: Webhook partial_refund dipetakan ke status refund dan memicu dispute holds');
    }

    // ========================================================
    // UJI 6: Pemrosesan Status 'chargeback'
    // ========================================================
    {
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

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.message, 'Order marked as chargeback');

      const updated = mock.getOrder();
      assert.strictEqual(updated?.status, 'chargeback', 'Status order harus berubah menjadi chargeback');
      assert.strictEqual(updated?.provider_reference, 'midtrans-cb-tx-6');

      const rpcCalls = mock.getRpcCalls();
      assert.strictEqual(rpcCalls.length, 1, 'Harus memanggil RPC create_dispute_holds');
      assert.strictEqual(rpcCalls[0].fn, 'create_dispute_holds');
      assert.deepStrictEqual(rpcCalls[0].args, { p_topup_order_id: 'ord-6' });
      console.log('✓ UJI 6 LULUS: Webhook chargeback memperbarui status order menjadi chargeback dan memicu dispute holds');
    }

    // ========================================================
    // UJI 7: Idempotensi Webhook (Refund Berulang)
    // ========================================================
    {
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

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.message, 'Order already marked as refund');
      assert.strictEqual(mock.getUpdates().length, 0, 'Tidak boleh ada query update ke database pada webhook duplikat');

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
      assert.strictEqual(partialResult.success, true);
      assert.strictEqual(partialResult.message, 'Order already marked as refund');
      assert.strictEqual(mock.getUpdates().length, 0, 'Tidak boleh ada query update pada partial_refund berulang');
      console.log('✓ UJI 7 LULUS: Idempotensi refund terbukti (return success tanpa update DB ulang, RPC tetap dipanggil)');
    }

    // ========================================================
    // UJI 8: Idempotensi Webhook (Chargeback Berulang)
    // ========================================================
    {
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

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.message, 'Order already marked as chargeback');
      assert.strictEqual(mock.getUpdates().length, 0, 'Tidak boleh ada query update ke database pada webhook duplikat');

      const rpcCalls = mock.getRpcCalls();
      assert(
        rpcCalls.some(
          (c) =>
            c.fn === 'create_dispute_holds' &&
            (c.args as { p_topup_order_id: string }).p_topup_order_id === 'ord-8'
        ),
        'RPC create_dispute_holds harus tetap dipanggil pada webhook chargeback retry'
      );
      console.log('✓ UJI 8 LULUS: Idempotensi chargeback terbukti (return success tanpa update DB ulang, RPC tetap dipanggil)');
    }

    // ========================================================
    // UJI 9: Keamanan Logging (Zero PII Audit)
    // ========================================================
    {
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
        assert.deepStrictEqual(logData, {
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

      console.log('✓ UJI 9 LULUS: Log audit bebas PII dan hanya mencatat order_id serta status');
    }

    // ========================================================
    // UJI 10: Proteksi Order Non-Settlement (pending, expire, cancel, deny)
    // ========================================================
    {
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

        assert.strictEqual(refundResult.success, true);
        assert.strictEqual(
          refundResult.message,
          `Refund/chargeback notification ignored for order in ${nonSettlementStatus} status`
        );
        assert.strictEqual(
          mock.getUpdates().length,
          0,
          `Status ${nonSettlementStatus} tidak boleh dimutasi pada webhook refund`
        );
        assert.strictEqual(
          mock.getOrder()?.status,
          nonSettlementStatus,
          `Status di DB harus tetap ${nonSettlementStatus}`
        );
        assert.strictEqual(
          mock.getRpcCalls().length,
          0,
          `Tidak boleh memanggil RPC create_dispute_holds untuk order ${nonSettlementStatus}`
        );

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

        assert.strictEqual(cbResult.success, true);
        assert.strictEqual(
          cbResult.message,
          `Refund/chargeback notification ignored for order in ${nonSettlementStatus} status`
        );
        assert.strictEqual(
          mock.getUpdates().length,
          0,
          `Status ${nonSettlementStatus} tidak boleh dimutasi pada webhook chargeback`
        );
        assert.strictEqual(
          mock.getOrder()?.status,
          nonSettlementStatus,
          `Status di DB harus tetap ${nonSettlementStatus}`
        );
        assert.strictEqual(
          mock.getRpcCalls().length,
          0,
          `Tidak boleh memanggil RPC create_dispute_holds untuk order ${nonSettlementStatus}`
        );
      }
      console.log(
        '✓ UJI 10 LULUS: Order status non-settlement (pending, expire, cancel, deny) diabaikan tanpa mutasi DB dan tanpa RPC'
      );
    }

    // ========================================================
    // UJI 11: Keamanan Log saat Webhook Diabaikan (Zero PII Audit)
    // ========================================================
    {
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
        assert.deepStrictEqual(logData, {
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
      console.log('✓ UJI 11 LULUS: Log audit saat diabaikan bebas PII dan hanya mencatat order_id serta status');
    }

    // ========================================================
    // UJI 12: Skenario Retry Saat RPC Gagal di Percobaan Pertama (PRD-050 Skenario 6)
    // ========================================================
    {
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
      assert.strictEqual(result1.success, true);
      assert.strictEqual(result1.message, 'Order marked as chargeback');
      assert.strictEqual(mock.getOrder()?.status, 'chargeback', 'Status order harus berhasil termutasi ke chargeback');
      assert.strictEqual(mock.getUpdates().length, 1, 'Harus ada 1 mutasi DB pada webhook pertama');
      assert.strictEqual(rpcAttempt, 1, 'RPC create_dispute_holds harus terpanggil 1x');

      // Panggilan 2: Webhook chargeback retry dari Midtrans (status order sudah chargeback)
      const result2 = await WalletService.handleMidtransWebhook(payload, mock.client);
      assert.strictEqual(result2.success, true);
      assert.strictEqual(result2.message, 'Order already marked as chargeback');
      assert.strictEqual(mock.getOrder()?.status, 'chargeback', 'Status order tetap chargeback');
      assert.strictEqual(mock.getUpdates().length, 1, 'Tidak boleh ada mutasi DB tambahan pada panggilan retry');
      assert.strictEqual(rpcAttempt, 2, 'RPC create_dispute_holds harus dipanggil ulang pada webhook retry');
      console.log(
        '✓ UJI 12 LULUS: Webhook retry berhasil memicu RPC create_dispute_holds setelah kegagalan awal'
      );
    }

    console.log('[SELFTEST] SEMUA PENGUJIAN T-214 LULUS DENGAN SUKSES.');
    return true;
  } finally {
    process.env.PAYMENT_SERVER_KEY = originalServerKey;
  }
}

// Jalankan otomatis jika dieksekusi langsung
if (process.argv[1]?.includes('midtrans-webhook.selftest')) {
  runSelfTests()
    .then((ok) => {
      if (!ok) process.exit(1);
    })
    .catch((err) => {
      console.error('Self-test fatal error:', err);
      process.exit(1);
    });
}
