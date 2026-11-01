import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/client';
import { resetPasswordApiSchema } from '@/lib/validations/auth';
import {
  checkRateLimit,
  getClientIp,
  rateLimitExceededResponse,
} from '@/lib/rate-limit/distributed';
import { internalErrorResponse, sanitizeLogMessage } from '@/lib/api/error-response';

function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const jsonStr =
      typeof Buffer !== 'undefined'
        ? Buffer.from(base64, 'base64').toString('utf-8')
        : atob(base64);
    return JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  // 1. Rate Limiting Terdistribusi: 5 percobaan per IP per 15 menit (fail-open)
  const ip = getClientIp(req);
  const rateLimit = await checkRateLimit(`auth_reset:${ip}`, 5, 900);
  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(rateLimit.retryAfter);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Format body request tidak valid.',
      },
      { status: 400 }
    );
  }

  const parsed = resetPasswordApiSchema.safeParse(body);
  if (!parsed.success) {
    const firstErrorMessage =
      parsed.error.issues[0]?.message ?? 'Validasi gagal.';

    return NextResponse.json(
      {
        success: false,
        error: 'VALIDATION_ERROR',
        message: firstErrorMessage,
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !supabaseAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'SERVER_CONFIG_ERROR',
          message: 'Konfigurasi server bermasalah',
        },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: authData, error: authError } = await supabase.auth.getUser(
      parsed.data.access_token
    );

    if (authError || !authData?.user) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_TOKEN',
          message: 'Tautan pemulihan tidak valid atau sudah kedaluwarsa.',
        },
        { status: 401 }
      );
    }

    const user = authData.user;

    const jwtPayload = parseJwtPayload(parsed.data.access_token);
    const isOtpSession =
      Array.isArray(jwtPayload?.amr) &&
      jwtPayload.amr.some((entry: unknown) => {
        if (typeof entry === 'string') return entry === 'otp';
        if (entry && typeof entry === 'object' && 'method' in entry) {
          return (entry as { method: string }).method === 'otp';
        }
        return false;
      });

    const hasNonOtpLoginMethod =
      Array.isArray(jwtPayload?.amr) &&
      jwtPayload.amr.some((entry: unknown) => {
        const method =
          typeof entry === 'string'
            ? entry
            : entry && typeof entry === 'object' && 'method' in entry
              ? (entry as { method: string }).method
              : null;
        return method === 'password' || method === 'oauth';
      });

    if (!isOtpSession || hasNonOtpLoginMethod) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_OTP_SESSION',
          message: 'Sesi tidak valid atau bukan berasal dari tautan pemulihan kata sandi.',
        },
        { status: 401 }
      );
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      {
        password: parsed.data.password,
        app_metadata: {
          ...(user.app_metadata || {}),
          has_password: true,
        },
      }
    );

    if (updateError) {
      console.error('[RESET_PASSWORD_ERROR]:', sanitizeLogMessage(updateError.message));
      return NextResponse.json(
        {
          success: false,
          error: 'INTERNAL_ERROR',
          message: 'Gagal memperbarui kata sandi. Silakan coba beberapa saat lagi.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Kata sandi berhasil diperbarui. Silakan masuk dengan kata sandi baru Anda.',
    });
  } catch (err: unknown) {
    return internalErrorResponse(err, 'Gagal memperbarui kata sandi. Silakan coba beberapa saat lagi.');
  }
}
