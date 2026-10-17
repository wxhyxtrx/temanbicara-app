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
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Validasi form pasien gagal',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const {
      nama_lengkap,
      nama_panggilan,
      kontak_darurat_nama,
      kontak_darurat_wa,
      email,
      no_wa,
      password,
    } = parsed.data;

    // 1. Cek apakah email sudah terdaftar di public.users
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
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
        nama_panggilan: nama_panggilan?.trim() || null,
      },
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        {
          success: false,
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
          success: false,
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
      nama_panggilan: nama_panggilan?.trim() || null,
      kontak_darurat_nama: kontak_darurat_nama.trim(),
      kontak_darurat_wa,
    });

    if (profileError) {
      // Rollback kompensasi: bersihkan data di users dan auth agar tidak menjadi zombie user
      await supabaseAdmin.from('users').delete().eq('id', userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        {
          success: false,
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
          redirect_to: '/patient/beranda',
        },
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: err instanceof Error ? err.message : 'Terjadi kesalahan sistem',
      },
      { status: 500 }
    );
  }
}
