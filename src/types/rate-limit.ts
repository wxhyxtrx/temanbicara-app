/**
 * Tipe data kembalian fungsi RPC Supabase `public.rate_limit_increment` (JSONB)
 */
export interface RateLimitRpcResult {
  allowed: boolean;
  count: number;
  remaining: number;
  retry_after: number;
}

/**
 * Tipe data hasil evaluasi rate limiting di sisi server Next.js (camelCase)
 */
export interface RateLimitResult {
  allowed: boolean;
  count: number;
  remaining: number;
  retryAfter: number;
}

/**
 * Tipe data representasi record pada tabel `public.rate_limits`
 */
export interface RateLimitEntity {
  key: string;
  count: number;
  expires_at: string;
  created_at: string;
}
