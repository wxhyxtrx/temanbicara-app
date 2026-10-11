import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin, supabasePublic } from '@/lib/supabase/client';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('tb_access_token')?.value;

    if (!token) {
      return NextResponse.json({ success: false, message: 'Belum terautentikasi' }, { status: 401 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ success: false, message: 'Server configuration error' }, { status: 500 });
    }

    // 1. Validasi token dengan Supabase Auth
    let authUserId: string | null = null;
    let authEmail: string | null = null;

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (!authError && authData?.user) {
      authUserId = authData.user.id;
      authEmail = authData.user.email || null;
    } else {
      // Fallback jika token adalah UUID user ID langsung (misal OAuth callback fallback)
      authUserId = token;
    }

    // 2. Lookup data profil di public.users
    let query = supabaseAdmin.from('users').select('id, auth_id, email, role, status, avatar_url, no_wa');
    if (authEmail) {
      query = query.or(`auth_id.eq.${authUserId},email.eq.${authEmail},id.eq.${authUserId}`);
    } else {
      query = query.or(`auth_id.eq.${authUserId},id.eq.${authUserId}`);
    }

    const { data: userRecord, error: userError } = await query.maybeSingle();

    if (userError || !userRecord) {
      return NextResponse.json({ success: false, message: 'Pengguna tidak ditemukan' }, { status: 404 });
    }

    // 3. Ambil nama lengkap sesuai role
    let fullName = userRecord.email.split('@')[0];

    if (userRecord.role === 'pasien') {
      const { data: p } = await supabaseAdmin
        .from('pasien_profiles')
        .select('nama_lengkap')
        .eq('user_id', userRecord.id)
        .maybeSingle();
      if (p?.nama_lengkap) fullName = p.nama_lengkap;
    } else if (userRecord.role === 'relawan') {
      const { data: r } = await supabaseAdmin
        .from('relawan_profiles')
        .select('nama_lengkap')
        .eq('user_id', userRecord.id)
        .maybeSingle();
      if (r?.nama_lengkap) fullName = r.nama_lengkap;
    } else if (userRecord.role === 'psikolog') {
      const { data: ps } = await supabaseAdmin
        .from('psikolog_profiles')
        .select('nama_lengkap_gelar')
        .eq('user_id', userRecord.id)
        .maybeSingle();
      if (ps?.nama_lengkap_gelar) fullName = ps.nama_lengkap_gelar;
    } else if (userRecord.role === 'admin') {
      const { data: a } = await supabaseAdmin
        .from('admin_profiles')
        .select('nama_lengkap')
        .eq('user_id', userRecord.id)
        .maybeSingle();
      if (a?.nama_lengkap) fullName = a.nama_lengkap;
    }

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: userRecord.id,
          email: userRecord.email,
          role: userRecord.role,
          status: userRecord.status,
          avatar_url: userRecord.avatar_url,
          fullName,
        },
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Kesalahan sistem';
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
