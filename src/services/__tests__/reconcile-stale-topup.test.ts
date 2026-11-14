// Pastikan environment fallback terpasang sebelum modul supabase client di-import
if (!process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://dummy.supabase.co';
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && !process.env.SUPABASE_ANON_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'dummy-anon-key';
}

import { describe, expect, it } from 'vitest';
import type {
  ReconcileStaleDbClient,
  ReconcileStatusFetcher,
} from '@/services/wallet-reconcile.service';

/**
 * Mock DB Client factory untuk pengujian unit WalletReconcileService.reconcileStaleOrders
 */
function createMockDbClient(config: {
  orders?: Array<{
    id: string;
    order_id: string;
    patient_id: string;
    coins: number | string;
    amount_rupiah: number | string;
    status: string;
    provider_reference: string | null;
    settled_at: string | null;
    created_at: string;
    expires_at?: string | null;
    snap_redirect_url?: string | null;
  }>;
  fetchError?: { message: string } | null;
  rpcHandler?: (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ data?: unknown; error: { message: string; code?: string } | null }>;
}) {
  const queryLog: {
    table?: string;
    statusFilter?: string;
    lteFilter?: string;
    orderColumn?: string;
    orderAscending?: boolean;
    limitCount?: number;
  } = {};

  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];

  const mockClient: ReconcileStaleDbClient = {
    from: (table: string) => {
      queryLog.table = table;
      return {
        select: () => ({
          eq: (col: string, val: string) => {
            if (col === 'status') queryLog.statusFilter = val;
            return {
              lte: (lteCol: string, lteVal: string) => {
                if (lteCol === 'created_at') queryLog.lteFilter = lteVal;
                return {
                  order: (orderCol: string, opts: { ascending: boolean }) => {
                    queryLog.orderColumn = orderCol;
                    queryLog.orderAscending = opts.ascending;
                    return {
                      limit: async (cnt: number) => {
                        queryLog.limitCount = cnt;
                        if (config.fetchError) {
                          return { data: null, error: config.fetchError };
                        }
                        return { data: config.orders ?? [], error: null };
                      },
                    };
                  },
                };
              },
            };
          },
        }),
      };
    },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      if (config.rpcHandler) {
        return config.rpcHandler(fn, args);
      }
      return { data: true, error: null };
    },
  };

  return { mockClient, queryLog, rpcCalls };
}


const { GET } = await import('@/app/api/cron/reconcile-stale-topup/route');
const { WalletReconcileService, safeTimingCompare } = await import('@/services/wallet-reconcile.service');

describe('Rekonsiliasi stale topup Midtrans (T-209)', () => {
  it('UJI 1 LULUS: safeTimingCompare berfungsi benar & timing-safe', async () => {
    expect(safeTimingCompare('secret123', 'secret123'), 'String identik harus bernilai true').toBe(true);
    expect(safeTimingCompare('secret123', 'secret456'), 'String berbeda harus bernilai false').toBe(false);
    expect(safeTimingCompare('short', 'much-longer-string'), 'Perbedaan panjang harus aman & false').toBe(false);
    expect(safeTimingCompare('', 'non-empty'), 'String kosong dibanding non-kosong harus false').toBe(false);
    expect(safeTimingCompare('', ''), 'String kosong identik harus true').toBe(true);
  });

  it('UJI 2 LULUS: Endpoint dilindungi 401 untuk request unauthorized', async () => {
    const originalSecret = process.env.CRON_SECRET;
    try {
      // 2a. Server belum punya CRON_SECRET
      delete process.env.CRON_SECRET;
      const resNoSecret = await GET(new Request('http://localhost/api/cron/reconcile-stale-topup'));
      expect(resNoSecret.status, 'Harus 401 jika CRON_SECRET belum dikonfigurasi').toBe(401);
      const jsonNoSecret = (await resNoSecret.json()) as { success: boolean; error: string; message: string };
      expect(jsonNoSecret.success).toBe(false);
      expect(jsonNoSecret.error).toBe('UNAUTHORIZED');
      expect(jsonNoSecret.message).toBe('Kredensial cron tidak valid');

      // Pasang secret valid untuk sub-pengujian
      process.env.CRON_SECRET = 'super-secret-cron-key-123';

      // 2b. Request tanpa header Authorization
      const resNoHeader = await GET(new Request('http://localhost/api/cron/reconcile-stale-topup'));
      expect(resNoHeader.status, 'Harus 401 jika header Authorization tidak ada').toBe(401);
      const jsonNoHeader = (await resNoHeader.json()) as { success: boolean; error: string };
      expect(jsonNoHeader.success).toBe(false);
      expect(jsonNoHeader.error).toBe('UNAUTHORIZED');

      // 2c. Request dengan token salah
      const resWrongToken = await GET(
        new Request('http://localhost/api/cron/reconcile-stale-topup', {
          headers: { Authorization: 'Bearer wrong-secret' },
        })
      );
      expect(resWrongToken.status, 'Harus 401 jika token Bearer salah').toBe(401);
      const jsonWrongToken = (await resWrongToken.json()) as { success: boolean; error: string };
      expect(jsonWrongToken.success).toBe(false);
      expect(jsonWrongToken.error).toBe('UNAUTHORIZED');

      // 2d. Request tanpa prefix Bearer
      const resNoBearer = await GET(
        new Request('http://localhost/api/cron/reconcile-stale-topup', {
          headers: { Authorization: 'super-secret-cron-key-123' },
        })
      );
      expect(resNoBearer.status, 'Harus 401 jika format header bukan Bearer <secret>').toBe(401);
    } finally {
      if (originalSecret !== undefined) {
        process.env.CRON_SECRET = originalSecret;
      } else {
        delete process.env.CRON_SECRET;
      }
    }
  });

  it('UJI 3 LULUS: Order stale settlement berhasil memanggil topup_settle', async () => {
    const mockOrder = {
      id: 'uuid-topup-001',
      order_id: 'ORDER-STALE-SETTLE-001',
      patient_id: 'uuid-patient-001',
      coins: 50,
      amount_rupiah: 50000,
      status: 'pending',
      provider_reference: null,
      settled_at: null,
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    };

    const { mockClient, rpcCalls } = createMockDbClient({
      orders: [mockOrder],
    });

    const mockFetcher: ReconcileStatusFetcher = async (orderId) => {
      expect(orderId).toBe('ORDER-STALE-SETTLE-001');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          transaction_status: 'settlement',
          fraud_status: 'accept',
          gross_amount: '50000.00',
          transaction_id: 'midtrans-tx-settle-999',
        }),
      };
    };

    const summary = await WalletReconcileService.reconcileStaleOrders(50, {
      dbClient: mockClient,
      statusFetcher: mockFetcher,
      serverKey: 'dummy-server-key',
    });

    expect(summary.success).toBe(true);
    expect(summary.scanned).toBe(1);
    expect(summary.settled).toBe(1);
    expect(summary.reconciled).toBe(1);
    expect(summary.failed).toBe(0);
    expect(summary.pending).toBe(0);
    expect(summary.errors).toBe(0);

    // Verifikasi RPC topup_settle terpanggil dengan argumen tepat
    expect(rpcCalls.length).toBe(1);
    expect(rpcCalls[0].fn).toBe('topup_settle');
    expect(rpcCalls[0].args).toStrictEqual({
      p_order_id: 'ORDER-STALE-SETTLE-001',
      p_provider_reference: 'midtrans-tx-settle-999',
      p_paid_amount_rupiah: 50000,
    });
  });

  it('UJI 3b LULUS: Status capture-accept memicu topup_settle', async () => {
    const mockOrder = {
      id: 'uuid-topup-002',
      order_id: 'ORDER-STALE-CAPTURE-002',
      patient_id: 'uuid-patient-002',
      coins: 100,
      amount_rupiah: 100000,
      status: 'pending',
      provider_reference: null,
      settled_at: null,
      created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    };

    const { mockClient, rpcCalls } = createMockDbClient({
      orders: [mockOrder],
    });

    const mockFetcher: ReconcileStatusFetcher = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        transaction_status: 'capture',
        fraud_status: 'accept',
        gross_amount: '100000',
        transaction_id: 'midtrans-tx-capture-888',
      }),
    });

    const summary = await WalletReconcileService.reconcileStaleOrders(50, {
      dbClient: mockClient,
      statusFetcher: mockFetcher,
      serverKey: 'dummy-server-key',
    });

    expect(summary.settled).toBe(1);
    expect(summary.reconciled).toBe(1);
    expect(rpcCalls.length).toBe(1);
    expect(rpcCalls[0].fn).toBe('topup_settle');
  });

  it('UJI 4 LULUS: Ketidakcocokan nominal dicegah dari settlement', async () => {
    const mockOrder = {
      id: 'uuid-topup-003',
      order_id: 'ORDER-STALE-MISMATCH-003',
      patient_id: 'uuid-patient-003',
      coins: 50,
      amount_rupiah: 50000,
      status: 'pending',
      provider_reference: null,
      settled_at: null,
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    };

    const { mockClient, rpcCalls } = createMockDbClient({
      orders: [mockOrder],
    });

    const mockFetcher: ReconcileStatusFetcher = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        transaction_status: 'settlement',
        gross_amount: '20000', // Nominal tidak cocok (50.000 vs 20.000)
        transaction_id: 'midtrans-tx-mismatch',
      }),
    });

    const summary = await WalletReconcileService.reconcileStaleOrders(50, {
      dbClient: mockClient,
      statusFetcher: mockFetcher,
      serverKey: 'dummy-server-key',
    });

    // Harus mencatat error dan TIDAK memanggil topup_settle
    expect(summary.errors).toBe(1);
    expect(summary.settled).toBe(0);
    expect(summary.reconciled).toBe(0);
    expect(rpcCalls.length, 'RPC topup_settle tidak boleh dipanggil jika nominal tidak cocok').toBe(0);
  });

  it('UJI 5 LULUS: Status expire, deny, dan cancel memanggil topup_fail', async () => {
    const statuses = ['expire', 'deny', 'cancel'];
    for (const status of statuses) {
      const mockOrder = {
        id: `uuid-topup-${status}`,
        order_id: `ORDER-STALE-${status.toUpperCase()}`,
        patient_id: 'uuid-patient-fail',
        coins: 20,
        amount_rupiah: 20000,
        status: 'pending',
        provider_reference: null,
        settled_at: null,
        created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      };

      const { mockClient, rpcCalls } = createMockDbClient({
        orders: [mockOrder],
      });

      const mockFetcher: ReconcileStatusFetcher = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          transaction_status: status,
          transaction_id: `midtrans-tx-${status}`,
        }),
      });

      const summary = await WalletReconcileService.reconcileStaleOrders(50, {
        dbClient: mockClient,
        statusFetcher: mockFetcher,
        serverKey: 'dummy-server-key',
      });

      expect(summary.failed).toBe(1);
      expect(summary.reconciled).toBe(1);
      expect(summary.settled).toBe(0);
      expect(rpcCalls.length).toBe(1);
      expect(rpcCalls[0].fn).toBe('topup_fail');
      expect(rpcCalls[0].args).toStrictEqual({
        p_order_id: `ORDER-STALE-${status.toUpperCase()}`,
        p_status: status,
        p_provider_reference: `midtrans-tx-${status}`,
      });
    }
  });

  it('UJI 6 LULUS: Order status pending dan HTTP 404 membiarkan status tetap pending di DB', async () => {
    // 6a. Midtrans mengembalikan transaction_status: 'pending'
    {
      const mockOrder = {
        id: 'uuid-topup-pending',
        order_id: 'ORDER-STALE-PENDING-001',
        patient_id: 'uuid-patient-pending',
        coins: 10,
        amount_rupiah: 10000,
        status: 'pending',
        provider_reference: null,
        settled_at: null,
        created_at: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
      };

      const { mockClient, rpcCalls } = createMockDbClient({
        orders: [mockOrder],
      });

      const mockFetcher: ReconcileStatusFetcher = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          transaction_status: 'pending',
        }),
      });

      const summary = await WalletReconcileService.reconcileStaleOrders(50, {
        dbClient: mockClient,
        statusFetcher: mockFetcher,
        serverKey: 'dummy-server-key',
      });

      expect(summary.pending).toBe(1);
      expect(summary.settled).toBe(0);
      expect(summary.failed).toBe(0);
      expect(summary.reconciled).toBe(0);
      expect(rpcCalls.length, 'Tidak boleh ada RPC yang dipanggil saat Midtrans pending').toBe(0);
    }

    // 6b. Midtrans mengembalikan HTTP 404 (Snap link belum dibuka pengguna)
    {
      const mockOrder = {
        id: 'uuid-topup-404',
        order_id: 'ORDER-STALE-404-001',
        patient_id: 'uuid-patient-404',
        coins: 10,
        amount_rupiah: 10000,
        status: 'pending',
        provider_reference: null,
        settled_at: null,
        created_at: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
      };

      const { mockClient, rpcCalls } = createMockDbClient({
        orders: [mockOrder],
      });

      const mockFetcher: ReconcileStatusFetcher = async () => ({
        ok: false,
        status: 404,
        json: async () => ({ status_code: '404', status_message: 'Transaction doesn\'t exist.' }),
      });

      const summary = await WalletReconcileService.reconcileStaleOrders(50, {
        dbClient: mockClient,
        statusFetcher: mockFetcher,
        serverKey: 'dummy-server-key',
      });

      expect(summary.pending).toBe(1);
      expect(summary.settled).toBe(0);
      expect(summary.failed).toBe(0);
      expect(summary.reconciled).toBe(0);
      expect(rpcCalls.length, 'HTTP 404 membiarkan order tetap pending').toBe(0);
    }
  });

  it('UJI 7 LULUS: Query DB memfilter status pending, created_at <= 1 jam lalu, limit 50', async () => {
    const fixedNow = 1731412800000; // 2026-11-12T12:00:00.000Z
    const expectedCutoffIso = new Date(fixedNow - 60 * 60 * 1000).toISOString();

    const { mockClient, queryLog } = createMockDbClient({
      orders: [],
    });

    const summary = await WalletReconcileService.reconcileStaleOrders(50, {
      dbClient: mockClient,
      nowMs: fixedNow,
      serverKey: 'dummy-server-key',
    });

    expect(queryLog.table).toBe('topup_orders');
    expect(queryLog.statusFilter).toBe('pending');
    expect(queryLog.lteFilter).toBe(expectedCutoffIso);
    expect(queryLog.orderColumn).toBe('created_at');
    expect(queryLog.orderAscending).toBe(true);
    expect(queryLog.limitCount).toBe(50);

    expect(summary.scanned).toBe(0);
    expect(summary.reconciled).toBe(0);
    expect(summary.settled).toBe(0);
    expect(summary.failed).toBe(0);
    expect(summary.pending).toBe(0);
    expect(summary.errors).toBe(0);
  });

  it('UJI 8 LULUS: Batch 12 order cocok persis dengan contoh spesifikasi PRD-049', async () => {
    const batchOrders = [
      // 4 settled
      { id: '1', order_id: 'ORD-S1', patient_id: 'p1', coins: 10, amount_rupiah: 10000, status: 'pending', provider_reference: null, settled_at: null, created_at: '2026-11-12T00:00:00Z' },
      { id: '2', order_id: 'ORD-S2', patient_id: 'p2', coins: 20, amount_rupiah: 20000, status: 'pending', provider_reference: null, settled_at: null, created_at: '2026-11-12T00:01:00Z' },
      { id: '3', order_id: 'ORD-S3', patient_id: 'p3', coins: 30, amount_rupiah: 30000, status: 'pending', provider_reference: null, settled_at: null, created_at: '2026-11-12T00:02:00Z' },
      { id: '4', order_id: 'ORD-S4', patient_id: 'p4', coins: 40, amount_rupiah: 40000, status: 'pending', provider_reference: null, settled_at: null, created_at: '2026-11-12T00:03:00Z' },
      // 1 failed
      { id: '5', order_id: 'ORD-F1', patient_id: 'p5', coins: 10, amount_rupiah: 10000, status: 'pending', provider_reference: null, settled_at: null, created_at: '2026-11-12T00:04:00Z' },
      // 7 pending (5 pending di midtrans + 2 404)
      { id: '6', order_id: 'ORD-P1', patient_id: 'p6', coins: 10, amount_rupiah: 10000, status: 'pending', provider_reference: null, settled_at: null, created_at: '2026-11-12T00:05:00Z' },
      { id: '7', order_id: 'ORD-P2', patient_id: 'p7', coins: 10, amount_rupiah: 10000, status: 'pending', provider_reference: null, settled_at: null, created_at: '2026-11-12T00:06:00Z' },
      { id: '8', order_id: 'ORD-P3', patient_id: 'p8', coins: 10, amount_rupiah: 10000, status: 'pending', provider_reference: null, settled_at: null, created_at: '2026-11-12T00:07:00Z' },
      { id: '9', order_id: 'ORD-P4', patient_id: 'p9', coins: 10, amount_rupiah: 10000, status: 'pending', provider_reference: null, settled_at: null, created_at: '2026-11-12T00:08:00Z' },
      { id: '10', order_id: 'ORD-P5', patient_id: 'p10', coins: 10, amount_rupiah: 10000, status: 'pending', provider_reference: null, settled_at: null, created_at: '2026-11-12T00:09:00Z' },
      { id: '11', order_id: 'ORD-P6-404', patient_id: 'p11', coins: 10, amount_rupiah: 10000, status: 'pending', provider_reference: null, settled_at: null, created_at: '2026-11-12T00:10:00Z' },
      { id: '12', order_id: 'ORD-P7-404', patient_id: 'p12', coins: 10, amount_rupiah: 10000, status: 'pending', provider_reference: null, settled_at: null, created_at: '2026-11-12T00:11:00Z' },
    ];

    const { mockClient } = createMockDbClient({
      orders: batchOrders,
    });

    const mockFetcher: ReconcileStatusFetcher = async (orderId) => {
      if (orderId.startsWith('ORD-S')) {
        const amounts: Record<string, string> = {
          'ORD-S1': '10000',
          'ORD-S2': '20000',
          'ORD-S3': '30000',
          'ORD-S4': '40000',
        };
        return {
          ok: true,
          status: 200,
          json: async () => ({
            transaction_status: 'settlement',
            gross_amount: amounts[orderId],
            transaction_id: `tx-${orderId}`,
          }),
        };
      }
      if (orderId === 'ORD-F1') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            transaction_status: 'expire',
            transaction_id: 'tx-ORD-F1',
          }),
        };
      }
      if (orderId.includes('404')) {
        return {
          ok: false,
          status: 404,
          json: async () => ({ status_code: '404' }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          transaction_status: 'pending',
        }),
      };
    };

    const summary = await WalletReconcileService.reconcileStaleOrders(50, {
      dbClient: mockClient,
      statusFetcher: mockFetcher,
      serverKey: 'dummy-server-key',
    });

    expect(summary).toStrictEqual({
      success: true,
      scanned: 12,
      reconciled: 5,
      settled: 4,
      failed: 1,
      pending: 7,
      errors: 0,
    });
  });
});
