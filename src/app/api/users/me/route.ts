import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { getSessionUser, getRoleProfile, displayName, fail } from '@/lib/auth/session';
import { ROLE_UPDATE_SCHEMAS } from '@/lib/validations/user';
import type { UserEntity } from '@/types/database';

export { GET } from '@/app/api/auth/me/route';

const PROFILE_TABLE = {
  pasien: 'pasien_profiles',
  relawan: 'relawan_profiles',
  psikolog: 'psikolog_profiles',
  admin: 'admin_profiles',
} as const;

export async function PATCH(req: Request) {
  try {
    // 1. Verifikasi Sesi & Status Pengguna (Hanya 'active')
    const session = await getSessionUser();
    if (session.response) return session.response;

    if (session.user.status !== 'active') {
      return fail(403, 'FORBIDDEN', 'Hanya akun berstatus aktif yang dapat memperbarui pengaturan profil');
    }

    // 2. Parse Body JSON
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return fail(422, 'VALIDATION_ERROR', 'Format body JSON tidak valid atau kosong');
    }

    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length === 0) {
      return fail(422, 'VALIDATION_ERROR', 'Body request tidak boleh kosong');
    }

    // 3. Ambil Skema Berdasarkan Role di Session (BUKAN dari body)
    const userRole = session.user.role;
    const schema = ROLE_UPDATE_SCHEMAS[userRole as keyof typeof ROLE_UPDATE_SCHEMAS];

    if (!schema) {
      return fail(403, 'FORBIDDEN', `Peran ${userRole} tidak didukung untuk pembaruan profil`);
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message || 'Validasi data gagal',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 422 }
      );
    }

    const validatedData = parsed.data as Record<string, unknown>;

    // Cek apakah ada field yang terisi (bukan undefined semua)
    const updateKeys = Object.keys(validatedData).filter((k) => validatedData[k] !== undefined);
    if (updateKeys.length === 0) {
      return fail(422, 'VALIDATION_ERROR', 'Tidak ada data yang diperbarui');
    }

    // 4. Update no_wa pada tabel users (jika disertakan)
    if (validatedData.no_wa !== undefined) {
      const cleanNoWa = String(validatedData.no_wa).trim();

      // Cek bentrok unik nomor WhatsApp dengan akun lain
      const { data: existingPhoneUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('no_wa', cleanNoWa)
        .neq('id', session.user.id)
        .maybeSingle();

      if (existingPhoneUser) {
        return fail(409, 'PHONE_ALREADY_EXISTS', 'Nomor WhatsApp sudah digunakan oleh pengguna lain');
      }

      const { error: userUpdateError } = await supabaseAdmin
        .from('users')
        .update({
          no_wa: cleanNoWa,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.user.id);

      if (userUpdateError) {
        if (userUpdateError.code === '23505' || userUpdateError.message?.toLowerCase().includes('unique')) {
          return fail(409, 'PHONE_ALREADY_EXISTS', 'Nomor WhatsApp sudah digunakan oleh pengguna lain');
        }
        return fail(500, 'USER_UPDATE_FAILED', userUpdateError.message);
      }
    }

    // 5. Update tabel profil spesifik per role
    const profileUpdates: Record<string, unknown> = {};

    if (userRole === 'pasien') {
      if (validatedData.nama_lengkap !== undefined) {
        profileUpdates.nama_lengkap = String(validatedData.nama_lengkap).trim();
      }
      if (validatedData.nama_panggilan !== undefined) {
        profileUpdates.nama_panggilan = validatedData.nama_panggilan
          ? String(validatedData.nama_panggilan).trim()
          : null;
      }
      if (validatedData.kontak_darurat_nama !== undefined) {
        profileUpdates.kontak_darurat_nama = String(validatedData.kontak_darurat_nama).trim();
      }
      if (validatedData.kontak_darurat_wa !== undefined) {
        profileUpdates.kontak_darurat_wa = String(validatedData.kontak_darurat_wa).trim();
      }
      if (validatedData.is_anonim_default !== undefined) {
        profileUpdates.is_anonim_default = Boolean(validatedData.is_anonim_default);
      }
    } else if (userRole === 'psikolog') {
      if (validatedData.spesialisasi !== undefined) {
        profileUpdates.spesialisasi = validatedData.spesialisasi;
      }
      if (validatedData.tahun_pengalaman !== undefined) {
        profileUpdates.tahun_pengalaman = Number(validatedData.tahun_pengalaman);
      }
      if (validatedData.tarif_sesi !== undefined) {
        profileUpdates.tarif_sesi = Number(validatedData.tarif_sesi);
      }
    } else if (userRole === 'relawan') {
      if (validatedData.alias_name !== undefined) {
        profileUpdates.alias_name = String(validatedData.alias_name).trim();
      }
      if (validatedData.topik_keahlian !== undefined) {
        profileUpdates.topik_keahlian = validatedData.topik_keahlian;
      }
      if (validatedData.is_available !== undefined) {
        profileUpdates.is_available = Boolean(validatedData.is_available);
      }
    }
    // admin: tidak ada field di tabel profil

    if (Object.keys(profileUpdates).length > 0) {
      profileUpdates.updated_at = new Date().toISOString();
      const profileTable = PROFILE_TABLE[userRole as keyof typeof PROFILE_TABLE];

      const { error: profileUpdateError } = await supabaseAdmin
        .from(profileTable)
        .update(profileUpdates)
        .eq('user_id', session.user.id);

      if (profileUpdateError) {
        return fail(500, 'PROFILE_UPDATE_FAILED', profileUpdateError.message);
      }
    }

    // 6. Ambil data terbaru pengguna & profil untuk response
    const { data: updatedUser, error: fetchUserError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (fetchUserError || !updatedUser) {
      return fail(500, 'FETCH_UPDATED_USER_FAILED', 'Gagal memuat profil pengguna terbaru');
    }

    const { google_id: _googleId, ...userToReturn } = updatedUser as UserEntity;
    const updatedProfile = await getRoleProfile(updatedUser as UserEntity);
    const fullName = displayName(userToReturn, updatedProfile);

    return NextResponse.json({
      success: true,
      data: {
        user: { ...userToReturn, fullName },
        profile: updatedProfile,
      },
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}
