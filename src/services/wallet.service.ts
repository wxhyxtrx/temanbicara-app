import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/client';
import { getRoleProfile, displayName } from '@/lib/auth/session';
import { TOPUP_PAYMENT_EXPIRY_MINUTES } from '@/constant/wallet';
import { normalizePayeeName } from '@/lib/wallet/payee-name';
import { WalletPayoutService } from '@/services/wallet-payout.service';
import { WalletReconcileService } from '@/services/wallet-reconcile.service';
import type { UserEntity, UserRole } from '@/types/database';
import type {
  AdminPayoutItem,
  LedgerEntryEntity,
  PayoutRequestEntity,
  PayoutStatus,
  TopupOrderEntity,
  WalletInfoResponse,
} from '@/types/wallet';

export { normalizePayeeName };

export class WalletHttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'WalletHttpError';
  }
}

export class WalletService {
  /**
   * Mengambil saldo dompet pengguna aktif.
   */
  public static async getWalletInfo(userId: string, role: UserRole): Promise<WalletInfoResponse> {
    if (!supabaseAdmin) {
      throw new WalletHttpError(500, 'SERVER_CONFIG_ERROR', 'Database client belum terinisialisasi');
    }

    const { data, error } = await supabaseAdmin
      .from('wallets')
      .select('coin_balance, pending_rupiah, available_rupiah, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching wallet info:', error);
      throw new WalletHttpError(500, 'DB_ERROR', 'Gagal memuat saldo dompet');
    }

    return {
      role,
      coin_balance: Number(data?.coin_balance ?? 0),
      pending_rupiah: Number(data?.pending_rupiah ?? 0),
      available_rupiah: Number(data?.available_rupiah ?? 0),
      updated_at: data?.updated_at ?? new Date().toISOString(),
    };
  }

  /**
   * Mengambil riwayat mutasi buku besar (ledger_entries) terpaginasi.
   */
  public static async getLedgerTransactions(
    userId: string,
    options: { page: number; limit: number }
  ): Promise<{ items: LedgerEntryEntity[]; total: number }> {
    if (!supabaseAdmin) {
      throw new WalletHttpError(500, 'SERVER_CONFIG_ERROR', 'Database client belum terinisialisasi');
    }

    const { page, limit } = options;
    const from = (page - 1) * limit;
    const to = page * limit - 1;

    const { data, error, count } = await supabaseAdmin
      .from('ledger_entries')
      .select('id, user_id, account, amount, unit, reason, ref_type, ref_id, created_at', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Error fetching ledger entries:', error);
      throw new WalletHttpError(500, 'DB_ERROR', 'Gagal memuat riwayat transaksi');
    }

    const items: LedgerEntryEntity[] = (data ?? []).map((row) => ({
      id: row.id,
      user_id: row.user_id,
      account: row.account,
      amount: Number(row.amount),
      unit: row.unit,
      reason: row.reason,
      ref_type: row.ref_type,
      ref_id: row.ref_id,
      created_at: row.created_at,
    }));

    return {
      items,
      total: count ?? items.length,
    };
  }

  /**
   * Membuat order top-up koin pasien & menginisialisasi transaksi Midtrans Snap.
   */
  public static async createTopupOrder(
    patient: UserEntity,
    coins: number
  ): Promise<{
    order_id: string;
    coins: number;
    amount_rupiah: number;
    snap_token: string;
    redirect_url: string;
    expires_at: string;
    snap_redirect_url: string;
  }> {
    if (!supabaseAdmin) {
      throw new WalletHttpError(500, 'SERVER_CONFIG_ERROR', 'Database client belum terinisialisasi');
    }

    if (patient.role !== 'pasien') {
      throw new WalletHttpError(403, 'FORBIDDEN', 'Hanya pasien yang dapat melakukan top-up koin');
    }
    if (patient.status !== 'active') {
      throw new WalletHttpError(403, 'USER_NOT_ACTIVE', 'Akun pasien belum aktif');
    }

    // Ambil batas min/max dari system_settings
    const { data: settingRow, error: settingErr } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'topup')
      .maybeSingle();

    if (settingErr || !settingRow) {
      throw new WalletHttpError(500, 'SETTING_TOPUP_INVALID', 'Konfigurasi top-up tidak tersedia');
    }

    const minCoins = Number(settingRow.value?.min_coins ?? 10);
    const maxCoins = Number(settingRow.value?.max_coins ?? 500);

    if (coins < minCoins || coins > maxCoins) {
      throw new WalletHttpError(
        422,
        'TOPUP_COINS_OUT_OF_RANGE',
        `Jumlah koin top-up harus antara ${minCoins} dan ${maxCoins} koin`
      );
    }

    const randomSuffix = crypto.randomBytes(4).toString('hex').toUpperCase();
    const orderId = `TOPUP-${Date.now()}-${randomSuffix}`;
    const amountRupiah = coins * 10000;
    const expiresAt = new Date(Date.now() + TOPUP_PAYMENT_EXPIRY_MINUTES * 60 * 1000);

    // Panggil RPC topup_order_create di PostgreSQL
    const { error: rpcErr } = await supabaseAdmin.rpc('topup_order_create', {
      p_order_id: orderId,
      p_patient_id: patient.id,
      p_coins: coins,
      p_expires_at: expiresAt.toISOString(),
    });

    if (rpcErr) {
      console.error('Error calling topup_order_create:', rpcErr);
      if (rpcErr.code === '22023') {
        throw new WalletHttpError(422, 'TOPUP_COINS_OUT_OF_RANGE', rpcErr.message);
      }
      if (rpcErr.code === '42501') {
        throw new WalletHttpError(403, 'FORBIDDEN', rpcErr.message);
      }
      throw new WalletHttpError(500, 'RPC_ERROR', 'Gagal membuat pesanan top-up');
    }

    // Panggil Midtrans Snap API
    const serverKey = process.env.PAYMENT_SERVER_KEY;
    if (!serverKey) {
      throw new WalletHttpError(500, 'SERVER_CONFIG_ERROR', 'Payment gateway belum dikonfigurasi');
    }

    const isProduction = process.env.PAYMENT_IS_PRODUCTION === 'true';
    const snapUrl = isProduction
      ? 'https://app.midtrans.com/snap/v1/transactions'
      : 'https://app.sandbox.midtrans.com/snap/v1/transactions';

    const authHeader = 'Basic ' + Buffer.from(serverKey + ':').toString('base64');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: authHeader,
    };

    if (process.env.PAYMENT_NOTIFICATION_URL) {
      headers['X-Override-Notification'] = process.env.PAYMENT_NOTIFICATION_URL;
    }

    const profile = await getRoleProfile(patient);
    const customerName = displayName(patient, profile);
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const finishUrl = `${appUrl}/patient/top-up/history`;

    const snapPayload = {
      transaction_details: {
        order_id: orderId,
        gross_amount: amountRupiah,
      },
      customer_details: {
        first_name: customerName,
        email: patient.email,
      },
      item_details: [
        {
          id: `COIN-${coins}`,
          price: 10000,
          quantity: coins,
          name: `Top-up ${coins} Koin Teman Bicara`,
        },
      ],
      expiry: {
        unit: 'minutes',
        duration: TOPUP_PAYMENT_EXPIRY_MINUTES,
      },
      callbacks: {
        finish: finishUrl,
      },
    };

    let snapToken = '';
    let redirectUrl = '';

    try {
      const snapResponse = await fetch(snapUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(snapPayload),
      });

      if (!snapResponse.ok) {
        const errText = await snapResponse.text();
        console.error('Midtrans Snap API error:', snapResponse.status, errText);
        throw new WalletHttpError(502, 'PAYMENT_GATEWAY_ERROR', 'Gagal menghubungi payment provider');
      }

      const snapData = (await snapResponse.json()) as { token: string; redirect_url: string };
      snapToken = snapData.token;
      redirectUrl = snapData.redirect_url;
    } catch (err) {
      if (err instanceof WalletHttpError) throw err;
      console.error('Midtrans fetch network error:', err);
      throw new WalletHttpError(502, 'PAYMENT_GATEWAY_ERROR', 'Koneksi ke payment gateway bermasalah');
    }

    // Catat snap_redirect_url via RPC SECURITY DEFINER (direct UPDATE topup_orders di-REVOKE dari service_role)
    const { error: attachErr } = await supabaseAdmin.rpc('topup_attach_snap', {
      p_order_id: orderId,
      p_redirect_url: redirectUrl,
    });

    if (attachErr) {
      console.error('Error attaching snap redirect URL via RPC:', attachErr);
    }

    return {
      order_id: orderId,
      coins,
      amount_rupiah: amountRupiah,
      snap_token: snapToken,
      redirect_url: redirectUrl,
      expires_at: expiresAt.toISOString(),
      snap_redirect_url: redirectUrl,
    };
  }

  /**
   * Cek status order top-up koin dengan rekonsiliasi otomatis Midtrans.
   */
  public static async getTopupOrder(
    orderId: string,
    currentUser: UserEntity
  ): Promise<TopupOrderEntity> {
    return WalletReconcileService.reconcileAndGetOrder(orderId, currentUser);
  }

  /**
   * Mengambil riwayat order top-up milik pasien dengan pagination { data, meta }.
   * snap_redirect_url HANYA dikirim jika status pending DAN now < expires_at.
   */
  public static async getPatientTopups(
    patientId: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<{ items: TopupOrderEntity[]; total: number }> {
    if (!supabaseAdmin) {
      throw new WalletHttpError(500, 'SERVER_CONFIG_ERROR', 'Database client belum terinisialisasi');
    }

    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabaseAdmin
      .from('topup_orders')
      .select(
        'id, order_id, patient_id, coins, amount_rupiah, status, provider_reference, settled_at, created_at, expires_at, snap_redirect_url',
        { count: 'exact' }
      )
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Error fetching patient topup orders:', error);
      throw new WalletHttpError(500, 'DB_ERROR', 'Gagal memuat riwayat top-up');
    }

    const now = new Date();
    const items: TopupOrderEntity[] = (data ?? []).map((row) => {
      const isPending = row.status === 'pending';
      const expiresAt = row.expires_at ? new Date(row.expires_at) : null;
      const isNotExpired = expiresAt ? now < expiresAt : false;
      const showSnapUrl = isPending && isNotExpired;

      return {
        id: row.id,
        order_id: row.order_id,
        patient_id: row.patient_id,
        coins: Number(row.coins),
        amount_rupiah: Number(row.amount_rupiah),
        status: row.status,
        provider_reference: row.provider_reference,
        settled_at: row.settled_at,
        created_at: row.created_at,
        expires_at: row.expires_at ?? null,
        snap_redirect_url: showSnapUrl ? (row.snap_redirect_url ?? null) : null,
      };
    });

    return {
      items,
      total: count ?? 0,
    };
  }

  /**
   * Menangani webhook notifikasi Midtrans secara atomik dan idempoten.
   */
  public static async handleMidtransWebhook(payload: Record<string, unknown>): Promise<{ success: boolean; message: string }> {
    if (!supabaseAdmin) {
      throw new WalletHttpError(500, 'SERVER_CONFIG_ERROR', 'Database client belum terinisialisasi');
    }

    const orderId = String(payload.order_id ?? '');
    const statusCode = String(payload.status_code ?? '');
    const grossAmount = String(payload.gross_amount ?? '');
    const signatureKey = String(payload.signature_key ?? '');
    const transactionStatus = String(payload.transaction_status ?? '');
    const fraudStatus = String(payload.fraud_status ?? '');
    const transactionId = String(payload.transaction_id ?? orderId);

    const serverKey = process.env.PAYMENT_SERVER_KEY ?? '';
    if (!serverKey) {
      console.error('PAYMENT_SERVER_KEY is missing on server');
      throw new WalletHttpError(500, 'SERVER_CONFIG_ERROR', 'Server configuration error');
    }

    // Verifikasi signature secara timing-safe: SHA512(order_id + status_code + gross_amount + server_key)
    const expectedSignature = crypto
      .createHash('sha512')
      .update(orderId + statusCode + grossAmount + serverKey)
      .digest('hex');

    const sigBuffer = Buffer.from(signatureKey.toLowerCase(), 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature.toLowerCase(), 'utf8');

    if (
      sigBuffer.length === 0 ||
      sigBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      console.warn('Invalid Midtrans webhook signature received for order:', orderId);
      throw new WalletHttpError(401, 'INVALID_SIGNATURE', 'Signature notification tidak valid');
    }

    // Cek apakah order ada di DB
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('topup_orders')
      .select('id, order_id, amount_rupiah, status')
      .eq('order_id', orderId)
      .maybeSingle();

    if (orderErr || !order) {
      console.warn('Order not found for notification:', orderId);
      throw new WalletHttpError(404, 'ORDER_NOT_FOUND', 'Pesanan tidak ditemukan');
    }

    const paidRupiah = Math.round(Number(grossAmount));

    // Evaluasi status pembayaran
    if (transactionStatus === 'settlement' || (transactionStatus === 'capture' && fraudStatus === 'accept')) {
      const { data: settled, error: rpcErr } = await supabaseAdmin.rpc('topup_settle', {
        p_order_id: orderId,
        p_provider_reference: transactionId,
        p_paid_amount_rupiah: paidRupiah,
      });

      if (rpcErr) {
        console.error('Error in topup_settle RPC:', rpcErr);
        if (rpcErr.code === '22023') {
          throw new WalletHttpError(422, 'TOPUP_AMOUNT_MISMATCH', rpcErr.message);
        }
        throw new WalletHttpError(500, 'RPC_ERROR', 'Gagal memproses settlement top-up');
      }

      return {
        success: true,
        message: settled ? 'Order settled successfully' : 'Order already settled',
      };
    }

    if (transactionStatus === 'deny' || transactionStatus === 'expire' || transactionStatus === 'cancel') {
      const { error: failErr } = await supabaseAdmin.rpc('topup_fail', {
        p_order_id: orderId,
        p_status: transactionStatus,
        p_provider_reference: transactionId,
      });

      if (failErr) {
        console.error('Error in topup_fail RPC:', failErr);
      }

      return {
        success: true,
        message: `Order marked as ${transactionStatus}`,
      };
    }

    return {
      success: true,
      message: `Status ${transactionStatus} recorded`,
    };
  }

  // Delegasi operasi Payout Mitra & Admin ke WalletPayoutService
  public static requestPayout = WalletPayoutService.requestPayout;
  public static getMitraPayouts = WalletPayoutService.getMitraPayouts;
  public static getAdminPayouts = WalletPayoutService.getAdminPayouts;
  public static rejectPayout = WalletPayoutService.rejectPayout;
  public static markPayoutPaid = WalletPayoutService.markPayoutPaid;
}
