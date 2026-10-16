import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { registerRelawanSchema } from '@/lib/validations/auth';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registerRelawanSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Validasi form relawan gagal',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const {
      nama_lengkap,
      email,
      no_wa,
      password,
      latar_belakang,
      dokumen_cv_url,
      alasan_bergabung,
      topik_keahlian,
    } = parsed.data;

    // 1. Cek duplikasi email
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
          message: 'Email sudah terdaftar. Silakan gunakan email lain.',
        },
        { status: 409 }
      );
    }

    // 2. Buat akun auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: 'relawan',
        nama_lengkap,
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

    // 3. Insert entitas public.users dengan status pending_approval
    const { error: userError } = await supabaseAdmin.from('users').insert({
      id: userId,
      email,
      no_wa,
      role: 'relawan',
      status: 'pending_approval',
      is_email_verified: true,
    });

    if (userError) {
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

    // 4. Insert profil relawan
    const { error: profileError } = await supabaseAdmin.from('relawan_profiles').insert({
      user_id: userId,
      nama_lengkap,
      latar_belakang,
      dokumen_cv_url,
      alasan_bergabung,
      total_sesi: 0,
      alias_name: nama_lengkap.split(' ')[0] || 'Relawan',
      is_available: false,
      topik_keahlian: topik_keahlian ?? [],
    });

    if (profileError) {
      // Rollback kompensasi anti-zombie user
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
        message: 'Registrasi relawan berhasil diajukan. Menunggu verifikasi admin.',
        data: {
          user_id: userId,
          email,
          role: 'relawan',
          status: 'pending_approval',
          redirect_to: '/register/listener',
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: err.message || 'Terjadi kesalahan sistem',
      },
      { status: 500 }
    );
  }
}
