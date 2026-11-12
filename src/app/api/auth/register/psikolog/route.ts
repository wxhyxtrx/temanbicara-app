import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { getMaintenanceStatus } from '@/lib/maintenance';
import { registerPsikologSchema } from '@/lib/validations/auth';
import { validateMitraDocument } from '@/lib/validations/mitra-documents';
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

    // 2. Validasi kepemilikan dan integritas dokumen pendaftaran
    const docValidation = await validateMitraDocument(
      email,
      dokumen_sipp_str_url,
      'sipp_str',
      'psikolog_profiles',
      'dokumen_sipp_str_url'
    );

    if (!docValidation.ok) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_DOCUMENT',
          message: docValidation.reason,
        },
        { status: 400 }
      );
    }

    // 3. Cek duplikasi email
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

    // 4. Cek keunikan nomor SIPP/STR
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

    // 5. Buat akun di Supabase Auth
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
      console.error('[RegisterPsikolog] Gagal membuat akun auth:', authError?.message);
      return NextResponse.json(
        {
          success: false,
          error: 'AUTH_CREATION_FAILED',
          message: 'Gagal membuat akun psikolog. Silakan coba kembali.',
        },
        { status: 500 }
      );
    }

    const userId = authData.user.id;
    const normalizedNoWa = normalizePhone(no_wa);

    // 6. Insert public.users dengan status pending_verification
    const { error: userError } = await supabaseAdmin.from('users').insert({
      id: userId,
      email,
      no_wa: normalizedNoWa,
      role: 'psikolog',
      status: 'pending_verification',
      is_email_verified: true,
    });

    if (userError) {
      console.error('[RegisterPsikolog] Gagal insert public.users:', userError.message);
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

    // 7. Insert profil psikolog
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
      console.error('[RegisterPsikolog] Gagal insert public.psikolog_profiles:', profileError.message);
      // Rollback kompensasi anti-zombie user
      await supabaseAdmin.from('users').delete().eq('id', userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        {
          success: false,
          error: 'PROFILE_INSERT_FAILED',
          message: 'Gagal menyimpan profil psikolog. Silakan coba kembali.',
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
  } catch (err: unknown) {
    return internalErrorResponse(err, 'Terjadi kesalahan sistem saat registrasi psikolog');
  }
}
