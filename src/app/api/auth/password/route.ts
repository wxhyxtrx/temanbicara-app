import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/client';
import { getSessionUser } from '@/lib/auth/session';
import { getPasswordStatus } from '@/lib/auth/password';
import { passwordFormSchema } from '@/lib/validations/auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

export async function GET() {
  try {
    const session = await getSessionUser();
    if (session.response) return session.response;

    if (session.user.role !== 'pasien' && session.user.role !== 'psikolog') {
      return NextResponse.json(
        {
          success: false,
          error: 'FORBIDDEN_ROLE',
          message: 'Fitur ini hanya untuk pasien dan psikolog.',
        },
        { status: 403 }
      );
    }

    const { hasPassword } = await getPasswordStatus(session.user.id);

    return NextResponse.json({
      success: true,
      data: {
        has_password: hasPassword,
      },
    });
  } catch (err: unknown) {
    console.error('[GET /api/auth/password] Gagal mengambil status password');
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Gagal menyimpan kata sandi. Coba lagi beberapa saat lagi.',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionUser();
    if (session.response) return session.response;

    if (session.user.role !== 'pasien' && session.user.role !== 'psikolog') {
      return NextResponse.json(
        {
          success: false,
          error: 'FORBIDDEN_ROLE',
          message: 'Fitur ini hanya untuk pasien dan psikolog.',
        },
        { status: 403 }
      );
    }

    const { hasPassword, email, appMetadata } = await getPasswordStatus(session.user.id);

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

    const schema = passwordFormSchema(hasPassword);
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      const firstErrorMessage =
        parsed.error.issues?.[0]?.message ||
        (parsed.error as unknown as { errors?: Array<{ message?: string }> }).errors?.[0]?.message ||
        'Validasi gagal.';

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

    if (hasPassword) {
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase client environment variables missing');
      }

      // Verifikasi password lama dengan client anon per request (bukan singleton supabasePublic)
      const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });

      const userEmail = email || session.user.email;
      const { data: signInData, error: signInError } = await tempClient.auth.signInWithPassword({
        email: userEmail,
        password: parsed.data.current_password!,
      });

      if (signInError || !signInData?.user) {
        return NextResponse.json(
          {
            success: false,
            error: 'WRONG_CURRENT_PASSWORD',
            message: 'Kata sandi lama salah.',
          },
          { status: 400 }
        );
      }

      try {
        await tempClient.auth.signOut({ scope: 'local' });
      } catch {
        // Abaikan error cleanup client sementara
      }
    }

    if (!supabaseAdmin) {
      throw new Error('Supabase admin client tidak tersedia');
    }

    // Update password via Supabase Admin dan tandai has_password = true di app_metadata
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(session.user.id, {
      password: parsed.data.new_password,
      app_metadata: {
        ...(appMetadata ?? {}),
        has_password: true,
      },
    });

    if (updateError) {
      throw updateError;
    }

    const mode = hasPassword ? 'change' : 'create';

    // Response 200 tanpa Set-Cookie
    return NextResponse.json({
      success: true,
      data: {
        mode,
      },
    });
  } catch (err: unknown) {
    // Keamanan: Password dan err.message mentah TIDAK PERNAH di-log
    console.error('[POST /api/auth/password] Gagal memproses pembaruan kata sandi');
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Gagal menyimpan kata sandi. Coba lagi beberapa saat lagi.',
      },
      { status: 500 }
    );
  }
}
