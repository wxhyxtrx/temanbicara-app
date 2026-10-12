import { NextResponse } from 'next/server';
import { supabaseAdmin, supabasePublic } from '@/lib/supabase/client';
import { loginSchema } from '@/lib/validations/auth';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'Format email atau password tidak valid',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    // 1. Verifikasi kredensial via Supabase Auth
    const { data: authData, error: authError } = await supabasePublic.auth.signInWithPassword({
      email,
      password,
    });

    // Supabase menolak akun belum konfirmasi email sebelum cek profil di bawah
    if (authError?.code === 'email_not_confirmed') {
      return NextResponse.json(
        {
          error: 'EMAIL_UNVERIFIED',
          message: 'Email belum diverifikasi. Silakan periksa inbox email Anda.',
        },
        { status: 403 }
      );
    }

    if (authError || !authData.user) {
      return NextResponse.json(
        {
          error: 'INVALID_CREDENTIALS',
          message: 'Email atau password salah',
        },
        { status: 401 }
      );
    }

    const userId = authData.user.id;

    // 2. Ambil entitas public.users untuk memeriksa status akun & role
    const { data: userProfile, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, role, status, is_email_verified, avatar_url')
      .eq('id', userId)
      .maybeSingle();

    if (userError || !userProfile) {
      return NextResponse.json(
        {
          error: 'USER_PROFILE_NOT_FOUND',
          message: 'Data profil pengguna tidak ditemukan di sistem',
        },
        { status: 404 }
      );
    }

    // 3. Evaluasi status akun
    if (userProfile.status === 'suspended') {
      return NextResponse.json(
        {
          error: 'ACCOUNT_SUSPENDED',
          message: 'Akun Anda telah dinonaktifkan oleh administrator. Hubungi bantuan.',
        },
        { status: 403 }
      );
    }

    if (userProfile.status === 'rejected') {
      return NextResponse.json(
        {
          error: 'ACCOUNT_REJECTED',
          message: 'Pengajuan akun ditolak oleh administrator.',
        },
        { status: 403 }
      );
    }

    if (userProfile.status === 'unverified_email' || !userProfile.is_email_verified) {
      return NextResponse.json(
        {
          error: 'EMAIL_UNVERIFIED',
          message: 'Email belum diverifikasi. Silakan periksa inbox email Anda.',
        },
        { status: 403 }
      );
    }

    // 4. Penentuan redirect URL berdasarkan role & status
    let redirectTo = '/patient/beranda';

    if (userProfile.status === 'incomplete_profile') {
      redirectTo = '/register';
    } else if (userProfile.status === 'pending_approval') {
      redirectTo = '/register/listener';
    } else if (userProfile.status === 'pending_verification') {
      redirectTo = '/register/counselor';
    } else {
      // Status aktif: redirect sesuai role
      switch (userProfile.role) {
        case 'admin':
          redirectTo = '/admin/beranda';
          break;
        case 'psikolog':
          redirectTo = '/counselor/beranda';
          break;
        case 'relawan':
          redirectTo = '/listener/beranda';
          break;
        case 'pasien':
        default:
          redirectTo = '/patient/beranda';
          break;
      }
    }

    // 5. Kembalikan session data dan metadata role
    const response = NextResponse.json({
      success: true,
      message: 'Login berhasil',
      data: {
        user: {
          id: userProfile.id,
          email: userProfile.email,
          role: userProfile.role,
          status: userProfile.status,
          avatar_url: userProfile.avatar_url,
        },
        session: {
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
          expires_at: authData.session.expires_at,
        },
        redirect_to: redirectTo,
      },
    });

    response.cookies.set('tb_access_token', authData.session.access_token, {
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
    });
    response.cookies.set('tb_user_role', userProfile.role, {
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
    });
    response.cookies.set('tb_user_status', userProfile.status, {
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      {
        error: 'INTERNAL_SERVER_ERROR',
        message: err.message || 'Terjadi kesalahan sistem saat proses login',
      },
      { status: 500 }
    );
  }
}
