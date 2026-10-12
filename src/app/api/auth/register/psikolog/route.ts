import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { registerPsikologSchema } from '@/lib/validations/auth';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registerPsikologSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Validasi form psikolog gagal',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const {
      nama_lengkap_gelar,
      email,
      no_wa,
      password,
      nomor_sipp_str,
      dokumen_sipp_str_url,
      spesialisasi,
      tahun_pengalaman,
      tarif_sesi,
    } = parsed.data;

    // 1. Cek duplikasi email
    const { data: existingEmail } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingEmail) {
      return NextResponse.json(
        {
          success: false,
          error: 'EMAIL_ALREADY_EXISTS',
          message: 'Email sudah terdaftar. Silakan gunakan email lain.',
        },
        { status: 409 }
      );
    }

    // 2. Cek keunikan nomor SIPP/STR
    const { data: existingSipp } = await supabaseAdmin
      .from('psikolog_profiles')
      .select('user_id')
      .eq('nomor_sipp_str', nomor_sipp_str)
      .maybeSingle();

    if (existingSipp) {
      return NextResponse.json(
        {
          success: false,
          error: 'SIPP_STR_ALREADY_EXISTS',
          message: 'Nomor SIPP / STR sudah terdaftar di sistem TemanBicara.',
        },
        { status: 409 }
      );
    }

    // 3. Buat akun di Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: 'psikolog',
        nama_lengkap: nama_lengkap_gelar,
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

    // 4. Insert public.users dengan status pending_verification
    const { error: userError } = await supabaseAdmin.from('users').insert({
      id: userId,
      email,
      no_wa,
      role: 'psikolog',
      status: 'pending_verification',
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

    // 5. Insert profil psikolog
    const { error: profileError } = await supabaseAdmin.from('psikolog_profiles').insert({
      user_id: userId,
      nama_lengkap_gelar,
      nomor_sipp_str,
      dokumen_sipp_str_url,
      spesialisasi,
      tahun_pengalaman,
      tarif_sesi: tarif_sesi || 0,
      saldo: 0,
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
        message: 'Registrasi tenaga psikolog berhasil diajukan. Menunggu verifikasi dokumen oleh admin.',
        data: {
          user_id: userId,
          email,
          role: 'psikolog',
          status: 'pending_verification',
          redirect_to: '/register/counselor',
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
