import crypto from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase/client';
import { WalletHttpError } from '@/services/wallet.service';
import type { UserEntity } from '@/types/database';
import type { TopupOrderEntity } from '@/types/wallet';

/**
 * Bandingkan dua string dengan timingSafeEqual yang aman terhadap perbedaan panjang.
 * Menggunakan digest SHA-256 (panjang 32 byte tetap) agar buffer selalu identik ukurannya.
 */
export function safeTimingCompare(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(Buffer.from(a, 'utf8')).digest();
  const hashB = crypto.createHash('sha256').update(Buffer.from(b, 'utf8')).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export interface ReconcileStaleSummary {
  success: boolean;
  scanned: number;
  reconciled: number;
  settled: number;
  failed: number;
  pending: number;
  errors: number;
}

export interface MidtransStatusResponse {
  transaction_status?: string;
  fraud_status?: string;
  gross_amount?: string;
  transaction_id?: string;
  status_code?: string;
  status_message?: string;
  [key: string]: unknown;
}

export interface ReconcileStaleFetchResponse {
  ok: boolean;
  status: number;
  json: () => Promise<MidtransStatusResponse>;
}

export type ReconcileStatusFetcher = (
  orderId: string,
  serverKey: string,
  isProduction: boolean
) => Promise<ReconcileStaleFetchResponse>;

export interface ReconcileStaleDbClient {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        lte: (column: string, value: string) => {
          order: (column: string, options: { ascending: boolean }) => {
            limit: (count: number) => Promise<{
              data: Array<{
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
              }> | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    };
  };
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ data?: unknown; error: { message: string; code?: string } | null }>;
}

export interface ReconcileStaleOptions {
  dbClient?: ReconcileStaleDbClient;
  statusFetcher?: ReconcileStatusFetcher;
  nowMs?: number;
  serverKey?: string;
  isProduction?: boolean;
}

const defaultStatusFetcher: ReconcileStatusFetcher = async (
  orderId: string,
  serverKey: string,
  isProduction: boolean
): Promise<ReconcileStaleFetchResponse> => {
  const baseUrl = isProduction
    ? 'https://api.midtrans.com/v2'
    : 'https://api.sandbox.midtrans.com/v2';
  const statusUrl = `${baseUrl}/${encodeURIComponent(orderId)}/status`;
  const authHeader = 'Basic ' + Buffer.from(serverKey + ':').toString('base64');

  const res = await fetch(statusUrl, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
  });

  return {
    ok: res.ok,
    status: res.status,
    json: () => res.json(),
  };
};

// Debounce cache: order_id -> timestamp (ms)
const lastCheckMap = new Map<string, number>();
const RECONCILE_DEBOUNCE_MS = 10_000; // Maksimal 1 cek per order per 10 detik
const MAX_RECONCILE_AGE_MS = 24 * 60 * 60 * 1000; // < 24 jam

function cleanupOldChecks(): void {
  if (lastCheckMap.size > 2000) {
    const now = Date.now();
    for (const [id, time] of lastCheckMap.entries()) {
      if (now - time > 60_000) {
        lastCheckMap.delete(id);
      }
    }
  }
}

export class WalletReconcileService {
  /**
   * Rekonsiliasi status order top-up ke Midtrans Status API (GET /v2/{order_id}/status).
   * Dijalankan untuk order pending atau expire yang dibuat < 24 jam lalu.
   * Debounce 10 detik per order untuk mencegah spam request ke Midtrans.
   */
  public static async reconcileAndGetOrder(
    orderId: string,
    currentUser: UserEntity
  ): Promise<TopupOrderEntity> {
    if (!supabaseAdmin) {
      throw new WalletHttpError(500, 'SERVER_CONFIG_ERROR', 'Database client belum terinisialisasi');
    }

    const { data: initialOrder, error: fetchErr } = await supabaseAdmin
      .from('topup_orders')
      .select('id, order_id, patient_id, coins, amount_rupiah, status, provider_reference, settled_at, created_at, expires_at, snap_redirect_url')
      .eq('order_id', orderId)
      .maybeSingle();

    if (fetchErr) {
      console.error('Error fetching topup order for reconcile:', fetchErr);
      throw new WalletHttpError(500, 'DB_ERROR', 'Gagal memuat pesanan');
    }

    if (!initialOrder) {
      throw new WalletHttpError(404, 'ORDER_NOT_FOUND', 'Pesanan top-up tidak ditemukan');
    }

    if (currentUser.role !== 'admin' && initialOrder.patient_id !== currentUser.id) {
      throw new WalletHttpError(403, 'FORBIDDEN', 'Anda tidak berhak mengakses pesanan ini');
    }

    let reconciledAt: string | null = null;
    const nowMs = Date.now();
    const createdMs = new Date(initialOrder.created_at).getTime();
    const isUnder24Hours = nowMs - createdMs < MAX_RECONCILE_AGE_MS;
    const isPendingOrExpire = initialOrder.status === 'pending' || initialOrder.status === 'expire';

    const lastCheck = lastCheckMap.get(orderId);
    const canCheck = !lastCheck || (nowMs - lastCheck >= RECONCILE_DEBOUNCE_MS);

    // Jalankan rekonsiliasi HANYA jika status pending/expire, umur < 24 jam, dan lolos debounce 10 detik
    if (isPendingOrExpire && isUnder24Hours && canCheck) {
      cleanupOldChecks();
      lastCheckMap.set(orderId, nowMs);

      const serverKey = process.env.PAYMENT_SERVER_KEY;
      if (serverKey) {
        const isProduction = process.env.PAYMENT_IS_PRODUCTION === 'true';
        const baseUrl = isProduction
          ? 'https://api.midtrans.com/v2'
          : 'https://api.sandbox.midtrans.com/v2';
        const statusUrl = `${baseUrl}/${encodeURIComponent(orderId)}/status`;
        const authHeader = 'Basic ' + Buffer.from(serverKey + ':').toString('base64');

        try {
          const res = await fetch(statusUrl, {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              Authorization: authHeader,
            },
          });

          if (res.ok) {
            const midtrans = (await res.json()) as {
              transaction_status?: string;
              fraud_status?: string;
              gross_amount?: string;
              transaction_id?: string;
            };

            const txStatus = String(midtrans.transaction_status ?? '');
            const fraudStatus = String(midtrans.fraud_status ?? '');
            const txId = String(midtrans.transaction_id ?? orderId);
            const paidRupiah = Math.round(Number(midtrans.gross_amount ?? '0'));

            // 1. Settlement (atau capture dengan fraud accept) dan nominal cocok -> topup_settle
            if (txStatus === 'settlement' || (txStatus === 'capture' && fraudStatus === 'accept')) {
              if (paidRupiah === Number(initialOrder.amount_rupiah)) {
                const { error: rpcErr } = await supabaseAdmin.rpc('topup_settle', {
                  p_order_id: orderId,
                  p_provider_reference: txId,
                  p_paid_amount_rupiah: paidRupiah,
                });
                if (rpcErr) {
                  console.error('Error in topup_settle during reconcile:', rpcErr);
                }
              } else {
                console.warn(`Gross amount mismatch during reconcile for ${orderId}: expected ${initialOrder.amount_rupiah}, got ${paidRupiah}`);
              }
            } else if (txStatus === 'expire' || txStatus === 'deny' || txStatus === 'cancel') {
              // 2. Expire / Deny / Cancel -> topup_fail (hanya berlaku jika status di DB masih pending)
              if (initialOrder.status === 'pending') {
                const { error: failErr } = await supabaseAdmin.rpc('topup_fail', {
                  p_order_id: orderId,
                  p_status: txStatus,
                  p_provider_reference: txId,
                });
                if (failErr) {
                  console.error('Error in topup_fail during reconcile:', failErr);
                }
              }
            }

            reconciledAt = new Date().toISOString();
          } else if (res.status === 404) {
            // Order belum ada di Midtrans (belum dibuka di payment link)
            reconciledAt = new Date().toISOString();
          } else {
            console.warn(`Midtrans status API returned ${res.status} for order ${orderId}`);
          }
        } catch (fetchErr) {
          console.error(`Midtrans status API fetch error for order ${orderId}:`, fetchErr);
        }
      }
    }

    // Ambil data terbaru jika baru direkonsiliasi
    let currentData = initialOrder;
    if (reconciledAt) {
      const { data: updated } = await supabaseAdmin
        .from('topup_orders')
        .select('id, order_id, patient_id, coins, amount_rupiah, status, provider_reference, settled_at, created_at, expires_at, snap_redirect_url')
        .eq('order_id', orderId)
        .maybeSingle();

      if (updated) {
        currentData = updated;
      }
    }

    const now = new Date();
    const isPending = currentData.status === 'pending';
    const expiresAt = currentData.expires_at ? new Date(currentData.expires_at) : null;
    const isNotExpired = expiresAt ? now < expiresAt : false;
    const snapRedirectUrl = isPending && isNotExpired ? (currentData.snap_redirect_url ?? null) : null;

    return {
      id: currentData.id,
      order_id: currentData.order_id,
      patient_id: currentData.patient_id,
      coins: Number(currentData.coins),
      amount_rupiah: Number(currentData.amount_rupiah),
      status: currentData.status,
      provider_reference: currentData.provider_reference,
      settled_at: currentData.settled_at,
      created_at: currentData.created_at,
      expires_at: currentData.expires_at ?? null,
      snap_redirect_url: snapRedirectUrl,
      reconciled_at: reconciledAt,
    };
  }

  /**
   * Rekonsiliasi batch untuk order top-up berstatus pending yang dibuat > 1 jam lalu tanpa batas 24 jam.
   * Dijalankan oleh cron job /api/cron/reconcile-stale-topup.
   */
  public static async reconcileStaleOrders(
    batchLimit = 50,
    options?: ReconcileStaleOptions
  ): Promise<ReconcileStaleSummary> {
    const limit = Math.max(1, Math.min(batchLimit, 50));
    const nowMs = options?.nowMs ?? Date.now();
    const oneHourAgoIso = new Date(nowMs - 60 * 60 * 1000).toISOString();

    const client = (options?.dbClient ?? supabaseAdmin) as unknown as ReconcileStaleDbClient | null;
    if (!client) {
      console.error('[RECONCILE_STALE] Supabase client belum terinisialisasi');
      return {
        success: false,
        scanned: 0,
        reconciled: 0,
        settled: 0,
        failed: 0,
        pending: 0,
        errors: 1,
      };
    }

    const { data: staleOrders, error: fetchErr } = await client
      .from('topup_orders')
      .select('id, order_id, patient_id, coins, amount_rupiah, status, provider_reference, settled_at, created_at, expires_at, snap_redirect_url')
      .eq('status', 'pending')
      .lte('created_at', oneHourAgoIso)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (fetchErr) {
      console.error('[RECONCILE_STALE] Gagal memuat pesanan stale:', fetchErr.message);
      return {
        success: false,
        scanned: 0,
        reconciled: 0,
        settled: 0,
        failed: 0,
        pending: 0,
        errors: 1,
      };
    }

    if (!staleOrders || staleOrders.length === 0) {
      return {
        success: true,
        scanned: 0,
        reconciled: 0,
        settled: 0,
        failed: 0,
        pending: 0,
        errors: 0,
      };
    }

    const scanned = staleOrders.length;
    let settled = 0;
    let failed = 0;
    let pending = 0;
    let reconciled = 0;
    let errors = 0;

    const serverKey = options?.serverKey ?? process.env.PAYMENT_SERVER_KEY;
    const isProduction = options?.isProduction ?? (process.env.PAYMENT_IS_PRODUCTION === 'true');
    const fetcher = options?.statusFetcher ?? defaultStatusFetcher;

    for (const order of staleOrders) {
      try {
        if (!serverKey) {
          console.warn('[RECONCILE_STALE] PAYMENT_SERVER_KEY belum dikonfigurasi');
          errors++;
          continue;
        }

        const res = await fetcher(order.order_id, serverKey, isProduction);
        if (res.ok) {
          const midtrans = await res.json();
          const txStatus = String(midtrans.transaction_status ?? '');
          const fraudStatus = String(midtrans.fraud_status ?? '');
          const txId = String(midtrans.transaction_id ?? order.order_id);
          const paidRupiah = Math.round(Number(midtrans.gross_amount ?? '0'));

          // 1. Settlement (atau capture dengan fraud accept) dan nominal cocok -> topup_settle
          if (txStatus === 'settlement' || (txStatus === 'capture' && fraudStatus === 'accept')) {
            if (paidRupiah === Number(order.amount_rupiah)) {
              const { error: rpcErr } = await client.rpc('topup_settle', {
                p_order_id: order.order_id,
                p_provider_reference: txId,
                p_paid_amount_rupiah: paidRupiah,
              });

              if (rpcErr) {
                console.error(`[RECONCILE_STALE] RPC topup_settle gagal untuk order ${order.order_id}:`, rpcErr.message);
                errors++;
              } else {
                settled++;
                reconciled++;
              }
            } else {
              console.warn(`[RECONCILE_STALE] Ketidakcocokan nominal order ${order.order_id}: ekspektasi ${order.amount_rupiah}, terbayar ${paidRupiah}`);
              errors++;
            }
          } else if (txStatus === 'deny' || txStatus === 'expire' || txStatus === 'cancel') {
            // 2. Deny / Expire / Cancel -> topup_fail
            const { error: failErr } = await client.rpc('topup_fail', {
              p_order_id: order.order_id,
              p_status: txStatus,
              p_provider_reference: txId,
            });

            if (failErr) {
              console.error(`[RECONCILE_STALE] RPC topup_fail gagal untuk order ${order.order_id}:`, failErr.message);
              errors++;
            } else {
              failed++;
              reconciled++;
            }
          } else if (txStatus === 'pending') {
            // 3. Status pending di Midtrans -> biarkan status DB tetap pending
            pending++;
          } else {
            console.warn(`[RECONCILE_STALE] Status Midtrans tidak ditangani: '${txStatus}' untuk order ${order.order_id}`);
            pending++;
          }
        } else if (res.status === 404) {
          // 4. Order belum dibuka di Snap Midtrans -> biarkan tetap pending
          pending++;
        } else {
          console.warn(`[RECONCILE_STALE] Midtrans API mengembalikan HTTP ${res.status} untuk order ${order.order_id}`);
          errors++;
        }
      } catch (err: unknown) {
        console.error(`[RECONCILE_STALE] Kesalahan tak terduga memproses order ${order.order_id}:`, err);
        errors++;
      }
    }

    return {
      success: true,
      scanned,
      reconciled,
      settled,
      failed,
      pending,
      errors,
    };
  }
}
