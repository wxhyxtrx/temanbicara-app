import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { getMaintenanceStatus } from '@/lib/maintenance';
import { registerPasienSchema } from '@/lib/validations/auth';
import { normalizePhone } from '@/lib/validations/phone';
import {
  checkRateLimit,
  getClientIp,
  rateLimitExceededResponse,
} from '@/lib/rate-limit/distributed';
import { internalErrorResponse } from '@/lib/api/error-response';

export async function POST(req: Request) {
  try {
    // 1. Rate Limiting Terdistribusi: 5 registrasi per IP per jam (fail-open)
    const ip = getClientIp(req);
    const rateLimit = await checkRateLimit(`auth_register:${ip}`, 5, 3600);
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(rateLimit.retryAfter);
    }

    const maintenance = await getMaintenanceStatus();
    if (maintenance.phase === 'active') {
      return NextResponse.json(
        {
          success: false,
          error: 'MAINTENANCE_ACTIVE',
          message: maintenance.message,
        },
        { status: 503 }
      );
    }

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

    // 2. Cek apakah email sudah terdaftar di public.users
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

    // 3. Buat akun di Supabase Auth
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
      console.error('[RegisterPasien] Gagal membuat akun auth:', authError?.message);
      return NextResponse.json(
        {
          success: false,
          error: 'AUTH_CREATION_FAILED',
          message: 'Gagal membuat akun auth pengguna. Silakan coba kembali.',
        },
        { status: 500 }
      );
    }

    const userId = authData.user.id;
    const normalizedNoWa = normalizePhone(no_wa);
    const normalizedEmergencyWa = normalizePhone(kontak_darurat_wa);

    // 4. Insert entitas public.users
    const { error: userError } = await supabaseAdmin.from('users').insert({
      id: userId,
      email,
      no_wa: normalizedNoWa,
      role: 'pasien',
      status: 'active',
      is_email_verified: true,
    });

    if (userError) {
      console.error('[RegisterPasien] Gagal insert public.users:', userError.message);
      // Rollback auth jika gagal
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        {
          success: false,
          error: 'USER_PROFILE_INSERT_FAILED',
          message: 'Gagal menyimpan data pengguna. Silakan coba kembali.',
        },
        { status: 500 }
      );
    }

    // 5. Insert ke public.pasien_profiles
    const { error: profileError } = await supabaseAdmin.from('pasien_profiles').insert({
      user_id: userId,
      nama_lengkap,
      nama_panggilan: nama_panggilan?.trim() || null,
      kontak_darurat_nama: kontak_darurat_nama.trim(),
      kontak_darurat_wa: normalizedEmergencyWa,
    });

    if (profileError) {
      console.error('[RegisterPasien] Gagal insert public.pasien_profiles:', profileError.message);
      // Rollback kompensasi: bersihkan data di users dan auth agar tidak menjadi zombie user
      await supabaseAdmin.from('users').delete().eq('id', userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        {
          success: false,
          error: 'PROFILE_INSERT_FAILED',
          message: 'Gagal menyimpan profil pasien. Silakan coba kembali.',
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
    return internalErrorResponse(err, 'Terjadi kesalahan sistem saat registrasi pasien');
  }
}
