import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { forgotPasswordSchema } from '@/lib/validations/auth';
import {
  checkRateLimit,
  getClientIp,
  hashEmail,
  rateLimitExceededResponse,
} from '@/lib/rate-limit/distributed';
import { sanitizeLogMessage } from '@/lib/api/error-response';

export async function POST(req: Request) {
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

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    const firstErrorMessage =
      parsed.error.issues[0]?.message ?? 'Format email tidak valid (contoh: nama@email.com)';

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

  // Rate Limiting Terdistribusi: 3 permintaan per IP + email hash per 15 menit (fail-open)
  const ip = getClientIp(req);
  const emailHash = hashEmail(parsed.data.email);
  const rateLimit = await checkRateLimit(`auth_forgot:${ip}:${emailHash}`, 3, 900);
  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(rateLimit.retryAfter);
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[FORGOT_PASSWORD_ERROR]: Konfigurasi Supabase tidak lengkap');
    } else {
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });

      const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
      const redirectTo = `${appUrl}/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
        redirectTo,
      });

      if (error) {
        console.error('[FORGOT_PASSWORD_ERROR]:', sanitizeLogMessage(error.message));
      }
    }
  } catch (err: unknown) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    console.error('[FORGOT_PASSWORD_ERROR]:', sanitizeLogMessage(rawMsg));
  }

  // Respons netral: tidak membocorkan apakah email terdaftar di sistem atau tidak
  return NextResponse.json({
    success: true,
    message: 'Jika email terdaftar, tautan pemulihan kata sandi telah dikirim ke kotak masuk Anda.',
  });
}
