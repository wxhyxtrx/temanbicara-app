import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/client';

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  remaining: number;
  retryAfter: number;
}

/**
 * Ekstraksi IP klien dari header Vercel tepercaya.
 * Dilarang membaca elemen paling kiri dari x-forwarded-for karena rentan terhadap pemalsuan (IP spoofing) oleh klien.
 */
export function getClientIp(req: Request): string {
  const realIp = req.headers.get('x-real-ip');
  if (realIp && realIp.trim()) {
    return realIp.trim();
  }

  const vercelForwarded = req.headers.get('x-vercel-forwarded-for');
  if (vercelForwarded && vercelForwarded.trim()) {
    return vercelForwarded.split(',')[0].trim();
  }

  return '127.0.0.1';
}

/**
 * Menghasilkan hash SHA-256 dari email untuk digunakan sebagai bagian dari kunci rate limit.
 * Mencegah penyimpanan email mentah di dalam basis data rate limit.
 */
export function hashEmail(email: string): string {
  if (!email || typeof email !== 'string') {
    return createHash('sha256').update('').digest('hex');
  }
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

/**
 * Menghasilkan respons HTTP 429 Too Many Requests standar dengan header Retry-After.
 */
export function rateLimitExceededResponse(retryAfter: number): NextResponse {
  const retrySeconds = Math.max(1, Math.ceil(retryAfter || 60));
  return NextResponse.json(
    {
      success: false,
      error: 'TOO_MANY_REQUESTS',
      message: 'Terlalu banyak percobaan. Silakan coba kembali dalam beberapa menit.',
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retrySeconds),
      },
    }
  );
}

/**
 * Memeriksa dan memperbarui hitungan rate limit terdistribusi via RPC Supabase `rate_limit_increment`.
 * Menerapkan prinsip fail-open: jika RPC gagal, koneksi bermasalah, atau terjadi exception,
 * error dicatat secara aman ke log server dan request pengguna tetap diizinkan (allowed: true).
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  try {
    if (!supabaseAdmin) {
      console.error('[RateLimit] supabaseAdmin client tidak tersedia (fail-open)');
      return { allowed: true, count: 0, remaining: limit, retryAfter: 0 };
    }

    const { data, error } = await supabaseAdmin.rpc('rate_limit_increment', {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });

    if (error || !data) {
      console.error(
        '[RateLimit] Gagal mengeksekusi RPC rate_limit_increment (fail-open):',
        error?.message || 'Data respons RPC kosong'
      );
      return { allowed: true, count: 0, remaining: limit, retryAfter: 0 };
    }

    const res = data as {
      allowed?: boolean;
      count?: number;
      remaining?: number;
      retry_after?: number;
    };

    const allowed = typeof res.allowed === 'boolean' ? res.allowed : true;
    const count = typeof res.count === 'number' ? res.count : 0;
    const remaining = typeof res.remaining === 'number' ? res.remaining : limit;
    const retryAfter =
      typeof res.retry_after === 'number'
        ? res.retry_after
        : typeof (res as { retryAfter?: number }).retryAfter === 'number'
          ? (res as { retryAfter?: number }).retryAfter!
          : 0;

    return {
      allowed,
      count,
      remaining,
      retryAfter,
    };
  } catch (err: unknown) {
    console.error(
      '[RateLimit] Exception pada evaluasi rate limit (fail-open):',
      err instanceof Error ? err.message : String(err)
    );
    return { allowed: true, count: 0, remaining: limit, retryAfter: 0 };
  }
}
