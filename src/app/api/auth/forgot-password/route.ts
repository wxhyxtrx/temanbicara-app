import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { forgotPasswordSchema } from '@/lib/validations/auth';

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

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase environment variables missing');
    }

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
      console.error('[FORGOT_PASSWORD_ERROR]:', error.message);
    }
  } catch (err: unknown) {
    console.error('[FORGOT_PASSWORD_ERROR]:', err instanceof Error ? err.message : 'Unknown error');
  }

  return NextResponse.json({
    success: true,
    message: 'Jika email terdaftar, tautan pemulihan kata sandi telah dikirim ke kotak masuk Anda.',
  });
}
