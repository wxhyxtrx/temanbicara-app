import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/client';
import { getSessionUser } from '@/lib/auth/session';
import { getPasswordStatus } from '@/lib/auth/password';
import { passwordFormSchema } from '@/lib/validations/auth';
import { setSessionCookies, clearSessionCookies, SESSION_MAX_AGE } from '@/lib/auth/session-cookies';

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
        message: 'Gagal memuat status kata sandi. Coba lagi beberapa saat lagi.',
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
      const firstErrorMessage = parsed.error.issues[0]?.message ?? 'Validasi gagal.';

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

      if (!email) {
        throw new Error('Email pengguna auth tidak ditemukan');
      }

      // Verifikasi password lama dengan client anon per request (bukan singleton supabasePublic)
      const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });

      const { data: signInData, error: signInError } = await tempClient.auth.signInWithPassword({
        email,
        password: parsed.data.current_password!,
      });

      if (signInError || !signInData?.user) {
        const isInvalidCredentials =
          signInError?.code === 'invalid_credentials' ||
          (signInError?.status === 400 && !signInError?.code);

        if (isInvalidCredentials) {
          return NextResponse.json(
            {
              success: false,
              error: 'WRONG_CURRENT_PASSWORD',
              message: 'Kata sandi lama salah.',
            },
            { status: 400 }
          );
        }

        throw signInError || new Error('Autentikasi verifikasi gagal');
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

    let sessionRenewed = false;
    let newSessionTokens: { accessToken: string; refreshToken?: string | null } | null = null;

    try {
      if (supabaseUrl && supabaseAnonKey && email) {
        const loginClient = createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        });

        const { data: signInData, error: signInError } = await loginClient.auth.signInWithPassword({
          email,
          password: parsed.data.new_password,
        });

        if (!signInError && signInData?.session?.access_token) {
          sessionRenewed = true;
          newSessionTokens = {
            accessToken: signInData.session.access_token,
            refreshToken: signInData.session.refresh_token,
          };
        }
      }
    } catch {
      // Pembuatan sesi baru gagal, password tetap dianggap berhasil diubah.
      // Sesuai PRD-002: error dan kredensial tidak pernah di-log mentah.
    }

    if (sessionRenewed && newSessionTokens) {
      const response = NextResponse.json({
        success: true,
        data: {
          mode,
          session_renewed: true,
        },
      });

      await setSessionCookies(response, {
        accessToken: newSessionTokens.accessToken,
        refreshToken: newSessionTokens.refreshToken,
        userId: session.user.id,
        role: session.user.role,
        status: session.user.status,
        maxAge: SESSION_MAX_AGE,
      });

      return response;
    }

    // Pembuatan sesi baru gagal: tetap 200 dengan session_renewed: false dan clearSessionCookies
    const response = NextResponse.json({
      success: true,
      data: {
        mode,
        session_renewed: false,
      },
    });

    clearSessionCookies(response);

    return response;
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
