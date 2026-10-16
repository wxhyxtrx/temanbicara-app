import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/client';
import { getRoleProfile, displayName } from '@/lib/auth/session';
import type { UserEntity, UserRole } from '@/types/database';
import type {
  AdminPayoutItem,
  LedgerEntryEntity,
  PayoutRequestEntity,
  PayoutStatus,
  TopupOrderEntity,
  WalletInfoResponse,
} from '@/types/wallet';

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

/**
 * Normalisasi nama untuk pencocokan rekening bank:
 * 1. Ambil bagian sebelum koma (buang gelar belakang seperti ", M.Psi", ", S.Psi, Psikolog", ", Sp.KJ").
 * 2. Buang gelar depan umum (Dr., dr., Drs., Dra., Prof., dsb.).
 * 3. Buang singkatan gelar belakang jika ditulis tanpa koma di ujung nama.
 * 4. Buang tanda baca, ubah huruf kecil, dan normalisasi spasi menjadi spasi tunggal.
 */
export function normalizePayeeName(name: string): string {
  if (!name) return '';

  // 1. Ambil teks sebelum koma pertama (gelar belakang umumnya setelah koma)
  let clean = name.split(',')[0] ?? '';

  // 2. Buang gelar depan berulang (misal "Prof. Dr. ...", "dr. ...", "Dra. ...")
  clean = clean.replace(/^(?:(?:prof|dr|drs|dra)\.?\s+)+/gi, '');

  // 3. Buang singkatan gelar belakang jika ditulis tanpa koma
  clean = clean.replace(/\b(?:m\.?psi(?:\.?\s*psikolog)?|s\.?psi|sp\.?kj|m\.?sc|ph\.?d|s\.?ked|s\.?sos|m\.?kes|psikolog)\b/gi, '');

  // 4. Hapus karakter non-alfanumerik (kecuali spasi), ubah ke huruf kecil, normalisasi spasi
  return clean
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
  ): Promise<{ order_id: string; coins: number; amount_rupiah: number; snap_token: string; redirect_url: string }> {
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

    // Panggil RPC topup_order_create di PostgreSQL
    const { error: rpcErr } = await supabaseAdmin.rpc('topup_order_create', {
      p_order_id: orderId,
      p_patient_id: patient.id,
      p_coins: coins,
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

    return {
      order_id: orderId,
      coins,
      amount_rupiah: amountRupiah,
      snap_token: snapToken,
      redirect_url: redirectUrl,
    };
  }

  /**
   * Cek status order top-up koin.
   */
  public static async getTopupOrder(
    orderId: string,
    currentUser: UserEntity
  ): Promise<TopupOrderEntity> {
    if (!supabaseAdmin) {
      throw new WalletHttpError(500, 'SERVER_CONFIG_ERROR', 'Database client belum terinisialisasi');
    }

    const { data, error } = await supabaseAdmin
      .from('topup_orders')
      .select('id, order_id, patient_id, coins, amount_rupiah, status, provider_reference, settled_at, created_at')
      .eq('order_id', orderId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching topup order:', error);
      throw new WalletHttpError(500, 'DB_ERROR', 'Gagal memuat status pesanan');
    }

    if (!data) {
      throw new WalletHttpError(404, 'ORDER_NOT_FOUND', 'Pesanan top-up tidak ditemukan');
    }

    if (currentUser.role !== 'admin' && data.patient_id !== currentUser.id) {
      throw new WalletHttpError(403, 'FORBIDDEN', 'Anda tidak berhak melihat pesanan ini');
    }

    return {
      id: data.id,
      order_id: data.order_id,
      patient_id: data.patient_id,
      coins: Number(data.coins),
      amount_rupiah: Number(data.amount_rupiah),
      status: data.status,
      provider_reference: data.provider_reference,
      settled_at: data.settled_at,
      created_at: data.created_at,
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

  /**
   * Mitra mengajukan penarikan dana honor ke rekening bank.
   */
  public static async requestPayout(
    mitra: UserEntity,
    input: { amount_rupiah: number; bank_name: string; account_number: string; bank_account_name: string }
  ): Promise<{ payout_id: string; amount_rupiah: number; fee_rupiah: number; total_deducted: number; status: string; requested_at: string }> {
    if (!supabaseAdmin) {
      throw new WalletHttpError(500, 'SERVER_CONFIG_ERROR', 'Database client belum terinisialisasi');
    }

    if (mitra.role !== 'psikolog' && mitra.role !== 'relawan') {
      throw new WalletHttpError(403, 'FORBIDDEN', 'Hanya mitra yang dapat mengajukan payout');
    }
    if (mitra.status !== 'active') {
      throw new WalletHttpError(403, 'USER_NOT_ACTIVE', 'Akun mitra belum aktif');
    }

    // Validasi nama rekening dengan nama profil terverifikasi (buang gelar, wajib sama persis)
    const profile = await getRoleProfile(mitra);
    const verifiedName = String(
      (profile?.nama_lengkap_gelar as string | undefined) ??
      (profile?.nama_lengkap as string | undefined) ??
      ''
    ).trim();

    if (!verifiedName) {
      throw new WalletHttpError(422, 'PROFILE_NOT_VERIFIED', 'Profil mitra belum terverifikasi');
    }

    const normAccountName = normalizePayeeName(input.bank_account_name);
    const normVerifiedName = normalizePayeeName(verifiedName);

    if (!normAccountName || normAccountName !== normVerifiedName) {
      throw new WalletHttpError(
        422,
        'INVALID_ACCOUNT_NAME',
        `Nama pemilik rekening ("${input.bank_account_name}") harus sama persis dengan nama profil terverifikasi ("${verifiedName}")`
      );
    }

    // Ambil setting payout
    const { data: settingRow, error: settingErr } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'payout')
      .maybeSingle();

    if (settingErr || !settingRow) {
      throw new WalletHttpError(500, 'SETTING_PAYOUT_INVALID', 'Konfigurasi payout tidak tersedia');
    }

    const minRupiah = Number(settingRow.value?.min_rupiah ?? 1000000);
    const maxRupiah = Number(settingRow.value?.max_rupiah ?? 10000000);
    const feeRupiah = Number(settingRow.value?.fee_rupiah ?? 6500);

    if (input.amount_rupiah < minRupiah || input.amount_rupiah > maxRupiah) {
      throw new WalletHttpError(
        422,
        'PAYOUT_OUT_OF_RANGE',
        `Nominal penarikan harus antara Rp ${minRupiah.toLocaleString('id-ID')} dan Rp ${maxRupiah.toLocaleString('id-ID')}`
      );
    }

    const payoutId = crypto.randomUUID();

    const { error: rpcErr } = await supabaseAdmin.rpc('payout_request', {
      p_payout_id: payoutId,
      p_mitra_id: mitra.id,
      p_amount: input.amount_rupiah,
      p_bank_name: input.bank_name,
      p_account_number: input.account_number,
      p_account_name: input.bank_account_name,
    });

    if (rpcErr) {
      console.error('Error calling payout_request RPC:', rpcErr);
      if (rpcErr.message.includes('INSUFFICIENT_BALANCE') || rpcErr.code === 'P0001') {
        throw new WalletHttpError(
          402,
          'INSUFFICIENT_BALANCE',
          'Saldo available tidak mencukupi untuk nominal penarikan dan biaya transfer'
        );
      }
      if (rpcErr.code === '22023') {
        throw new WalletHttpError(422, 'PAYOUT_OUT_OF_RANGE', rpcErr.message);
      }
      if (rpcErr.code === '42501') {
        throw new WalletHttpError(403, 'FORBIDDEN', rpcErr.message);
      }
      throw new WalletHttpError(500, 'RPC_ERROR', 'Gagal memproses pengajuan payout');
    }

    return {
      payout_id: payoutId,
      amount_rupiah: input.amount_rupiah,
      fee_rupiah: feeRupiah,
      total_deducted: input.amount_rupiah + feeRupiah,
      status: 'requested',
      requested_at: new Date().toISOString(),
    };
  }

  /**
   * Riwayat pengajuan payout milik mitra.
   */
  public static async getMitraPayouts(
    mitraId: string,
    options: { page: number; limit: number }
  ): Promise<{ items: PayoutRequestEntity[]; total: number }> {
    if (!supabaseAdmin) {
      throw new WalletHttpError(500, 'SERVER_CONFIG_ERROR', 'Database client belum terinisialisasi');
    }

    const { page, limit } = options;
    const from = (page - 1) * limit;
    const to = page * limit - 1;

    const { data, error, count } = await supabaseAdmin
      .from('payout_requests')
      .select('id, mitra_id, amount_rupiah, fee_rupiah, bank_name, account_number, bank_account_name, status, requested_at, decided_at, decided_by', { count: 'exact' })
      .eq('mitra_id', mitraId)
      .order('requested_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Error fetching mitra payouts:', error);
      throw new WalletHttpError(500, 'DB_ERROR', 'Gagal memuat riwayat penarikan dana');
    }

    const items: PayoutRequestEntity[] = (data ?? []).map((row) => ({
      id: row.id,
      mitra_id: row.mitra_id,
      amount_rupiah: Number(row.amount_rupiah),
      fee_rupiah: Number(row.fee_rupiah),
      bank_name: row.bank_name,
      account_number: row.account_number,
      bank_account_name: row.bank_account_name,
      status: row.status,
      requested_at: row.requested_at,
      decided_at: row.decided_at,
      decided_by: row.decided_by,
    }));

    return {
      items,
      total: count ?? items.length,
    };
  }

  /**
   * Daftar antrean pengajuan payout untuk admin.
   */
  public static async getAdminPayouts(
    options: { status?: PayoutStatus; page: number; limit: number }
  ): Promise<{ items: AdminPayoutItem[]; total: number }> {
    if (!supabaseAdmin) {
      throw new WalletHttpError(500, 'SERVER_CONFIG_ERROR', 'Database client belum terinisialisasi');
    }

    const { status, page, limit } = options;
    const from = (page - 1) * limit;
    const to = page * limit - 1;

    let query = supabaseAdmin
      .from('payout_requests')
      .select('id, mitra_id, amount_rupiah, fee_rupiah, bank_name, account_number, bank_account_name, status, requested_at, decided_at, decided_by', { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query
      .order('requested_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Error fetching admin payouts:', error);
      throw new WalletHttpError(500, 'DB_ERROR', 'Gagal memuat daftar pengajuan payout');
    }

    const mitraIds = Array.from(new Set((data ?? []).map((r) => r.mitra_id)));

    // Fetch mitra roles and profiles
    const [usersRes, psikologRes, relawanRes] = await Promise.all([
      mitraIds.length > 0 ? supabaseAdmin.from('users').select('id, role').in('id', mitraIds) : { data: [] },
      mitraIds.length > 0 ? supabaseAdmin.from('psikolog_profiles').select('user_id, nama_lengkap_gelar').in('user_id', mitraIds) : { data: [] },
      mitraIds.length > 0 ? supabaseAdmin.from('relawan_profiles').select('user_id, nama_lengkap').in('user_id', mitraIds) : { data: [] },
    ]);

    const roleMap = new Map((usersRes.data ?? []).map((u) => [u.id, u.role as UserRole]));
    const nameMap = new Map<string, string>();

    for (const p of psikologRes.data ?? []) {
      nameMap.set(p.user_id, p.nama_lengkap_gelar);
    }
    for (const r of relawanRes.data ?? []) {
      nameMap.set(r.user_id, r.nama_lengkap);
    }

    const items: AdminPayoutItem[] = (data ?? []).map((row) => ({
      id: row.id,
      mitra_id: row.mitra_id,
      mitra_name: nameMap.get(row.mitra_id) ?? row.bank_account_name,
      mitra_role: roleMap.get(row.mitra_id),
      amount_rupiah: Number(row.amount_rupiah),
      fee_rupiah: Number(row.fee_rupiah),
      bank_name: row.bank_name,
      account_number: row.account_number,
      bank_account_name: row.bank_account_name,
      status: row.status,
      requested_at: row.requested_at,
      decided_at: row.decided_at,
      decided_by: row.decided_by,
    }));

    return {
      items,
      total: count ?? items.length,
    };
  }

  /**
   * Admin menolak pengajuan payout & mengembalikan dana ke saldo available mitra.
   */
  public static async rejectPayout(payoutId: string, adminId: string): Promise<{ payout_id: string; status: 'rejected' }> {
    if (!supabaseAdmin) {
      throw new WalletHttpError(500, 'SERVER_CONFIG_ERROR', 'Database client belum terinisialisasi');
    }

    const { error: rpcErr } = await supabaseAdmin.rpc('payout_reject', {
      p_payout_id: payoutId,
      p_admin_id: adminId,
    });

    if (rpcErr) {
      console.error('Error calling payout_reject RPC:', rpcErr);
      if (rpcErr.code === 'P0002') {
        throw new WalletHttpError(404, 'PAYOUT_NOT_FOUND', 'Pengajuan payout tidak ditemukan');
      }
      if (rpcErr.code === 'P0001') {
        throw new WalletHttpError(409, 'PAYOUT_NOT_REJECTABLE', 'Pengajuan payout tidak dalam status requested');
      }
      if (rpcErr.code === '42501') {
        throw new WalletHttpError(403, 'FORBIDDEN', 'Hanya admin yang dapat menolak payout');
      }
      throw new WalletHttpError(500, 'RPC_ERROR', 'Gagal menolak pengajuan payout');
    }

    return {
      payout_id: payoutId,
      status: 'rejected',
    };
  }

  /**
   * Admin mengonfirmasi payout telah dibayarkan ke rekening mitra.
   */
  public static async markPayoutPaid(payoutId: string, adminId: string): Promise<{ payout_id: string; status: 'paid' }> {
    if (!supabaseAdmin) {
      throw new WalletHttpError(500, 'SERVER_CONFIG_ERROR', 'Database client belum terinisialisasi');
    }

    const { error: rpcErr } = await supabaseAdmin.rpc('payout_mark_paid', {
      p_payout_id: payoutId,
      p_admin_id: adminId,
    });

    if (rpcErr) {
      console.error('Error calling payout_mark_paid RPC:', rpcErr);
      if (rpcErr.code === 'P0002') {
        throw new WalletHttpError(404, 'PAYOUT_NOT_FOUND', 'Pengajuan payout tidak ditemukan');
      }
      if (rpcErr.code === 'P0001') {
        throw new WalletHttpError(409, 'PAYOUT_NOT_PAYABLE', 'Pengajuan payout tidak dalam status requested');
      }
      if (rpcErr.code === '42501') {
        throw new WalletHttpError(403, 'FORBIDDEN', 'Hanya admin yang dapat menyetujui pembayaran payout');
      }
      throw new WalletHttpError(500, 'RPC_ERROR', 'Gagal memperbarui status payout');
    }

    return {
      payout_id: payoutId,
      status: 'paid',
    };
  }
}
