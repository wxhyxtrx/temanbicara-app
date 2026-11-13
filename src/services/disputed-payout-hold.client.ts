import { handleUnauthorized } from '@/lib/auth/unauthorized-handler';
import type {
  DisputedHoldStatus,
  DisputedPayoutHoldItem,
  PaginationMeta,
} from '@/types/wallet';

export class DisputedHoldApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  handled?: boolean;

  constructor(status: number, message: string, code?: string, details?: unknown, handled?: boolean) {
    super(message);
    this.name = 'DisputedHoldApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.handled = handled;
  }
}

export function formatDisputedHoldErrorMessage(
  status: number,
  code?: string,
  serverMessage?: string
): string {
  if (
    status === 401 ||
    code === 'UNAUTHENTICATED' ||
    code === 'INVALID_TOKEN' ||
    code === 'USER_NOT_FOUND'
  ) {
    return 'Sesi login telah berakhir atau pengguna tidak ditemukan. Silakan masuk kembali ke akun Anda.';
  }
  if (status === 403 || code === 'FORBIDDEN' || code === 'USER_NOT_ACTIVE') {
    return serverMessage || 'Akses tidak diizinkan. Hanya administrator aktif yang dapat mengelola sengketa.';
  }
  if (status === 404 || code === 'HOLD_NOT_FOUND') {
    return serverMessage || 'Data sengketa penahanan payout tidak ditemukan.';
  }
  if (status === 409 || code === 'HOLD_ALREADY_RESOLVED') {
    return (
      serverMessage ||
      'Sengketa penahanan payout ini telah diselesaikan sebelumnya oleh administrator lain.'
    );
  }
  if (status === 400 || code === 'VALIDATION_ERROR' || code === 'INVALID_STATUS' || code === 'INVALID_ID') {
    return serverMessage || 'Data masukan tidak valid. Periksa kembali form penyelesaian.';
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

async function handleDisputedHoldResponse<T>(
  res: Response
): Promise<{ data: T; meta?: PaginationMeta; message?: string }> {
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
      errorCode === 'USER_NOT_FOUND';

    if (isUnauthorized) {
      handleUnauthorized(rawMessage || 'Sesi login tidak valid atau pengguna tidak ditemukan');
    }

    const friendlyMessage = formatDisputedHoldErrorMessage(status, errorCode, rawMessage);
    throw new DisputedHoldApiError(status, friendlyMessage, errorCode, body?.details, isUnauthorized);
  }

  return {
    data: body.data,
    meta: body.meta,
    message: body.message,
  };
}

export interface ListDisputedHoldsOptions {
  status?: DisputedHoldStatus;
  page?: number;
  limit?: number;
}

export interface ListDisputedHoldsResult {
  items: DisputedPayoutHoldItem[];
  meta: PaginationMeta;
}

export interface ResolveDisputedHoldPayload {
  action: 'clear' | 'deduct';
  note: string;
}

const DISPUTED_HOLDS_ENDPOINT = '/api/admin/disputed-holds';

/**
 * Mengambil daftar sengketa penahanan payout mitra
 */
export async function listDisputedHolds(
  options?: ListDisputedHoldsOptions
): Promise<ListDisputedHoldsResult> {
  const query = new URLSearchParams();
  if (options?.status) query.set('status', options.status);
  if (options?.page) query.set('page', String(options.page));
  if (options?.limit) query.set('limit', String(options.limit));

  const url = `${DISPUTED_HOLDS_ENDPOINT}${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await fetch(url, {
    method: 'GET',
    credentials: 'include',
  });

  const result = await handleDisputedHoldResponse<DisputedPayoutHoldItem[]>(res);
  return {
    items: result.data || [],
    meta: result.meta || {
      page: options?.page || 1,
      limit: options?.limit || 20,
      total: result.data?.length || 0,
      totalPages: 1,
    },
  };
}

/**
 * Menyelesaikan sengketa penahanan payout mitra (action: 'clear' | 'deduct')
 */
export async function resolveDisputedHold(
  id: string,
  payload: ResolveDisputedHoldPayload
): Promise<DisputedPayoutHoldItem> {
  const res = await fetch(`${DISPUTED_HOLDS_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  const result = await handleDisputedHoldResponse<DisputedPayoutHoldItem>(res);
  return result.data;
}

export const disputedPayoutHoldClient = {
  listDisputedHolds,
  resolveDisputedHold,
};
