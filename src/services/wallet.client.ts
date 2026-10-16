import { ENDPOINTS } from '@/constant/endpoint';
import { handleUnauthorized } from '@/lib/auth/unauthorized-handler';
import type {
  AdminPayoutItem,
  LedgerEntryEntity,
  PaginationMeta,
  PayoutRequestEntity,
  PayoutStatus,
  TopupOrderEntity,
  WalletInfoResponse,
} from '@/types/wallet';

export class WalletApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  handled?: boolean;

  constructor(status: number, message: string, code?: string, details?: unknown, handled?: boolean) {
    super(message);
    this.name = 'WalletApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.handled = handled;
  }
}

export function formatWalletErrorMessage(status: number, code?: string, serverMessage?: string): string {
  if (
    status === 401 ||
    code === 'UNAUTHENTICATED' ||
    code === 'INVALID_TOKEN' ||
    (status === 404 && code === 'USER_NOT_FOUND') ||
    code === 'USER_NOT_FOUND'
  ) {
    return 'Sesi login telah berakhir atau pengguna tidak ditemukan. Silakan masuk kembali ke akun Anda.';
  }
  if (status === 402 || code === 'INSUFFICIENT_COINS' || code === 'INSUFFICIENT_BALANCE') {
    return serverMessage || 'Saldo koin atau dana tidak mencukupi untuk memproses transaksi atau penarikan ini.';
  }
  if (status === 403 || code === 'FORBIDDEN' || code === 'USER_NOT_ACTIVE') {
    return serverMessage || 'Akses tidak diizinkan atau akun Anda belum aktif.';
  }
  if (status === 404 || code === 'ORDER_NOT_FOUND' || code === 'PAYOUT_NOT_FOUND') {
    return serverMessage || 'Data pesanan atau pengajuan penarikan dana tidak ditemukan.';
  }
  if (
    status === 409 ||
    code === 'DUPLICATE_ORDER' ||
    code === 'PAYOUT_NOT_REJECTABLE' ||
    code === 'PAYOUT_NOT_PAYABLE' ||
    code === 'DUPLICATE_TIP'
  ) {
    return (
      serverMessage ||
      'Permintaan ditolak: Pengajuan ini sudah pernah diproses sebelumnya atau status transaksi telah berubah.'
    );
  }
  if (
    status === 422 ||
    code === 'TOPUP_COINS_OUT_OF_RANGE' ||
    code === 'PAYOUT_OUT_OF_RANGE' ||
    code === 'INVALID_ACCOUNT_NAME' ||
    code === 'PROFILE_NOT_VERIFIED' ||
    code === 'VALIDATION_ERROR'
  ) {
    return (
      serverMessage ||
      'Data transaksi tidak valid: Pastikan nominal berada dalam batas yang ditentukan dan nama pemilik rekening sama persis dengan nama profil terverifikasi tanpa gelar.'
    );
  }
  if (status === 429 || code === 'RATE_LIMIT_EXCEEDED') {
    return (
      serverMessage ||
      'Terlalu banyak permintaan dalam waktu singkat (kuota terlampaui). Mohon tunggu beberapa saat sebelum mencoba kembali.'
    );
  }
  if (status === 502 || code === 'PAYMENT_GATEWAY_ERROR') {
    return serverMessage || 'Layanan gateway pembayaran sedang bermasalah atau sibuk. Silakan coba kembali beberapa saat lagi.';
  }
  return serverMessage || `Terjadi kesalahan pada sistem (Kode HTTP ${status}).`;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  meta?: PaginationMeta;
  error?: string;
  message?: string;
  details?: unknown;
}

async function handleWalletResponse<T>(res: Response): Promise<{ data: T; meta?: PaginationMeta; message?: string }> {
  let body: ApiEnvelope<T> | null = null;
  try {
    body = (await res.json()) as ApiEnvelope<T>;
  } catch {
    body = null;
  }

  if (!res.ok || !body?.success) {
    const status = res.status;
    const errorCode = body?.error;
    const rawMessage = body?.message;

    const isUnauthorized =
      status === 401 ||
      errorCode === 'UNAUTHENTICATED' ||
      errorCode === 'INVALID_TOKEN' ||
      (status === 404 && errorCode === 'USER_NOT_FOUND') ||
      errorCode === 'USER_NOT_FOUND';

    if (isUnauthorized) {
      handleUnauthorized(rawMessage || 'Sesi login tidak valid atau pengguna tidak ditemukan');
    }

    const friendlyMessage = formatWalletErrorMessage(status, errorCode, rawMessage);
    throw new WalletApiError(status, friendlyMessage, errorCode, body?.details, isUnauthorized);
  }

  return {
    data: body.data,
    meta: body.meta,
    message: body.message,
  };
}

export interface CreateTopupResult {
  order_id: string;
  coins: number;
  amount_rupiah: number;
  snap_token: string;
  redirect_url: string;
}

export interface RequestPayoutResult {
  payout_id: string;
  amount_rupiah: number;
  fee_rupiah: number;
  total_deducted: number;
  status: string;
  requested_at: string;
}

export interface PayoutActionResult {
  payout_id: string;
  status: 'paid' | 'rejected';
}

export const walletClient = {
  /**
   * Mengambil saldo dompet pengguna aktif (koin untuk pasien, pending & available rupiah untuk mitra)
   */
  async getWalletMe(): Promise<WalletInfoResponse> {
    const res = await fetch(ENDPOINTS.WALLET.ME, {
      method: 'GET',
      credentials: 'include',
    });
    const result = await handleWalletResponse<WalletInfoResponse>(res);
    return result.data;
  },

  /**
   * Membuat order top-up koin dan mendapatkan Snap Token Midtrans
   */
  async createTopup(coins: number): Promise<CreateTopupResult> {
    const res = await fetch(ENDPOINTS.WALLET.TOPUP, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ coins }),
    });
    const result = await handleWalletResponse<CreateTopupResult>(res);
    return result.data;
  },

  /**
   * Cek status pesanan top-up berdasarkan order_id
   */
  async getTopupOrder(orderId: string): Promise<TopupOrderEntity> {
    const res = await fetch(ENDPOINTS.WALLET.TOPUP_DETAIL(orderId), {
      method: 'GET',
      credentials: 'include',
    });
    const result = await handleWalletResponse<TopupOrderEntity>(res);
    return result.data;
  },

  /**
   * Memicu rekonsiliasi manual status pesanan top-up ke Midtrans ("Cek Status")
   */
  async checkTopupStatus(orderId: string): Promise<TopupOrderEntity> {
    const res = await fetch(ENDPOINTS.WALLET.TOPUP_CHECK(orderId), {
      method: 'POST',
      credentials: 'include',
    });
    const result = await handleWalletResponse<TopupOrderEntity>(res);
    return result.data;
  },

  /**
   * Mengambil riwayat pesanan top-up pasien
   */
  async getTopups(params?: { page?: number; limit?: number }): Promise<{
    items: TopupOrderEntity[];
    meta: PaginationMeta;
  }> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));

    const url = `${ENDPOINTS.WALLET.TOPUPS}${query.toString() ? `?${query.toString()}` : ''}`;
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    });
    const result = await handleWalletResponse<TopupOrderEntity[]>(res);
    return {
      items: result.data,
      meta: result.meta || { page: params?.page || 1, limit: params?.limit || 20, total: result.data.length, totalPages: 1 },
    };
  },

  /**
   * Mengambil riwayat mutasi buku besar pengguna aktif
   */
  async getTransactions(params?: { page?: number; limit?: number }): Promise<{
    items: LedgerEntryEntity[];
    meta: PaginationMeta;
  }> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));

    const url = `${ENDPOINTS.WALLET.TRANSACTIONS}${query.toString() ? `?${query.toString()}` : ''}`;
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    });
    const result = await handleWalletResponse<LedgerEntryEntity[]>(res);
    return {
      items: result.data || [],
      meta: result.meta || {
        page: params?.page || 1,
        limit: params?.limit || 20,
        total: result.data?.length || 0,
        totalPages: 1,
      },
    };
  },

  /**
   * Mengajukan penarikan dana honor mitra ke rekening bank
   */
  async requestPayout(payload: {
    amount_rupiah: number;
    bank_name: string;
    account_number: string;
    bank_account_name: string;
  }): Promise<RequestPayoutResult> {
    const res = await fetch(ENDPOINTS.WALLET.PAYOUT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const result = await handleWalletResponse<RequestPayoutResult>(res);
    return result.data;
  },

  /**
   * Mengambil riwayat pengajuan penarikan dana milik mitra
   */
  async getMitraPayouts(params?: { page?: number; limit?: number }): Promise<{
    items: PayoutRequestEntity[];
    meta: PaginationMeta;
  }> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));

    const url = `${ENDPOINTS.WALLET.PAYOUTS}${query.toString() ? `?${query.toString()}` : ''}`;
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    });
    const result = await handleWalletResponse<PayoutRequestEntity[]>(res);
    return {
      items: result.data || [],
      meta: result.meta || {
        page: params?.page || 1,
        limit: params?.limit || 20,
        total: result.data?.length || 0,
        totalPages: 1,
      },
    };
  },

  /**
   * Mengambil antrean pengajuan penarikan dana mitra untuk admin
   */
  async getAdminPayouts(params?: {
    status?: PayoutStatus;
    page?: number;
    limit?: number;
  }): Promise<{
    items: AdminPayoutItem[];
    meta: PaginationMeta;
  }> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));

    const url = `${ENDPOINTS.ADMIN.PAYOUTS}${query.toString() ? `?${query.toString()}` : ''}`;
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    });
    const result = await handleWalletResponse<AdminPayoutItem[]>(res);
    return {
      items: result.data || [],
      meta: result.meta || {
        page: params?.page || 1,
        limit: params?.limit || 20,
        total: result.data?.length || 0,
        totalPages: 1,
      },
    };
  },

  /**
   * Admin menolak pengajuan payout dan mengembalikan dana ke saldo mitra
   */
  async rejectAdminPayout(id: string): Promise<PayoutActionResult> {
    const res = await fetch(ENDPOINTS.ADMIN.PAYOUT_REJECT(id), {
      method: 'POST',
      credentials: 'include',
    });
    const result = await handleWalletResponse<PayoutActionResult>(res);
    return result.data;
  },

  /**
   * Admin menandai payout lunas dan membukukan pencairan
   */
  async markAdminPayoutPaid(id: string): Promise<PayoutActionResult> {
    const res = await fetch(ENDPOINTS.ADMIN.PAYOUT_PAID(id), {
      method: 'POST',
      credentials: 'include',
    });
    const result = await handleWalletResponse<PayoutActionResult>(res);
    return result.data;
  },
};
