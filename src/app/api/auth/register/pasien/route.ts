import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { registerPasienSchema } from '@/lib/validations/auth';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registerPasienSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'Validasi form pasien gagal',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { nama_lengkap, email, no_wa, password } = parsed.data;

    // 1. Cek apakah email sudah terdaftar di public.users
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json(
        {
          error: 'EMAIL_ALREADY_EXISTS',
          message: 'Email sudah terdaftar. Silakan gunakan email lain atau login.',
        },
        { status: 409 }
      );
    }

    // 2. Buat akun di Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: 'pasien',
        nama_lengkap,
      },
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        {
          error: 'AUTH_CREATION_FAILED',
          message: authError?.message || 'Gagal membuat akun auth',
        },
        { status: 500 }
      );
    }

    const userId = authData.user.id;

    // 3. Insert entitas public.users
    const { error: userError } = await supabaseAdmin.from('users').insert({
      id: userId,
      email,
      no_wa,
      role: 'pasien',
      status: 'active',
      is_email_verified: true,
    });

    if (userError) {
      // Rollback auth jika gagal
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        {
          error: 'USER_PROFILE_INSERT_FAILED',
          message: userError.message,
        },
        { status: 500 }
      );
    }

    // 4. Insert ke public.pasien_profiles
    const { error: profileError } = await supabaseAdmin.from('pasien_profiles').insert({
      user_id: userId,
      nama_lengkap,
    });

    if (profileError) {
      return NextResponse.json(
        {
          error: 'PROFILE_INSERT_FAILED',
          message: profileError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Registrasi pasien berhasil. Silakan login.',
        data: {
          user_id: userId,
          email,
          role: 'pasien',
          status: 'active',
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        error: 'INTERNAL_SERVER_ERROR',
        message: err.message || 'Terjadi kesalahan sistem',
      },
      { status: 500 }
    );
  }
}
