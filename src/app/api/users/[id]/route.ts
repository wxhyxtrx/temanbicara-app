import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { getSessionUser, fail, displayName } from '@/lib/auth/session';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = [
  'active',
  'unverified_email',
  'incomplete_profile',
  'pending_approval',
  'pending_verification',
  'rejected',
  'suspended',
] as const;

const PROFILE_TABLE = {
  pasien: 'pasien_profiles',
  relawan: 'relawan_profiles',
  psikolog: 'psikolog_profiles',
  admin: 'admin_profiles',
} as const;

/**
 * GET /api/users/[id]
 * Detail satu pengguna beserta profil lengkap (Khusus Admin)
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionUser();
    if (session.response) return session.response;
    if (session.user.role !== 'admin' || session.user.status !== 'active') {
      return fail(403, 'FORBIDDEN', 'Hanya admin yang dapat mengakses data ini');
    }

    const { id } = await params;
    if (!UUID_RE.test(id)) return fail(400, 'INVALID_ID', 'ID pengguna tidak valid');

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (userError) return fail(500, 'QUERY_FAILED', userError.message);
    if (!user) return fail(404, 'NOT_FOUND', 'Pengguna tidak ditemukan');

    const profileTable = PROFILE_TABLE[user.role as keyof typeof PROFILE_TABLE];
    let profile: Record<string, unknown> | null = null;
    if (profileTable) {
      const { data: profData } = await supabaseAdmin
        .from(profileTable)
        .select('*')
        .eq('user_id', id)
        .maybeSingle();
      profile = profData ?? null;
    }

    const fullName = displayName(user, profile);

    return NextResponse.json({
      success: true,
      data: {
        user: { ...user, fullName },
        profile,
        fullName,
      },
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}

/**
 * PATCH /api/users/[id]
 * Update data atau status akun pengguna (Khusus Admin)
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionUser();
    if (session.response) return session.response;
    if (session.user.role !== 'admin' || session.user.status !== 'active') {
      return fail(403, 'FORBIDDEN', 'Hanya admin yang dapat memperbarui data pengguna');
    }

    const { id } = await params;
    if (!UUID_RE.test(id)) return fail(400, 'INVALID_ID', 'ID pengguna tidak valid');

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return fail(400, 'INVALID_BODY', 'Body request tidak valid');
    }

    // 1. Cek keberadaan user target
    const { data: targetUser, error: checkError } = await supabaseAdmin
      .from('users')
      .select('id, role, status, email')
      .eq('id', id)
      .maybeSingle();

    if (checkError) return fail(500, 'QUERY_FAILED', checkError.message);
    if (!targetUser) return fail(404, 'NOT_FOUND', 'Pengguna tidak ditemukan');

    // 2. Proteksi self-lockout bagi Admin
    const isSelf = session.user.id === targetUser.id;
    if (isSelf) {
      if (body.status && body.status !== 'active') {
        return fail(400, 'CANNOT_SUSPEND_SELF', 'Admin tidak dapat menonaktifkan akun sendiri');
      }
      if (body.role && body.role !== 'admin') {
        return fail(400, 'CANNOT_DEMOTE_SELF', 'Admin tidak dapat mengubah peran akun sendiri');
      }
    }

    // 3. Validasi status jika ada
    if (body.status && !STATUSES.includes(body.status as (typeof STATUSES)[number])) {
      return fail(400, 'VALIDATION_ERROR', 'Status akun yang diminta tidak valid');
    }

    // 4. Update tabel induk public.users
    const userUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (body.status) userUpdates.status = body.status;
    if (body.no_wa !== undefined) userUpdates.no_wa = body.no_wa ? String(body.no_wa).trim() : null;
    if (body.role && ['pasien', 'relawan', 'psikolog', 'admin'].includes(body.role)) {
      userUpdates.role = body.role;
    }

    const { error: updateUserError } = await supabaseAdmin
      .from('users')
      .update(userUpdates)
      .eq('id', id);

    if (updateUserError) return fail(500, 'UPDATE_FAILED', updateUserError.message);

    // 5. Update profil anak jika ada perubahan nama atau catatan penolakan
    const profileTable = PROFILE_TABLE[targetUser.role as keyof typeof PROFILE_TABLE];
    const newName = (body.fullName || body.nama_lengkap || '').trim();

    if (profileTable && newName) {
      const nameCol = targetUser.role === 'psikolog' ? 'nama_lengkap_gelar' : 'nama_lengkap';
      await supabaseAdmin
        .from(profileTable)
        .update({ [nameCol]: newName })
        .eq('user_id', id);
    }

    // Khusus psikolog: jika status diubah ke active -> set verified_at; jika rejected -> set rejection_reason
    if (targetUser.role === 'psikolog') {
      const psikologUpdates: Record<string, unknown> = {};
      if (body.status === 'active') {
        psikologUpdates.verified_at = new Date().toISOString();
        psikologUpdates.rejection_reason = null;
      } else if (body.status === 'rejected' && body.rejection_reason) {
        psikologUpdates.rejection_reason = String(body.rejection_reason).trim();
      }
      if (Object.keys(psikologUpdates).length > 0) {
        await supabaseAdmin.from('psikolog_profiles').update(psikologUpdates).eq('user_id', id);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Data pengguna dan status akun berhasil diperbarui',
      data: {
        id,
        status: body.status || targetUser.status,
        updated_fields: Object.keys(userUpdates),
      },
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}

/**
 * DELETE /api/users/[id]
 * Hapus pengguna secara permanen (Khusus Admin)
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionUser();
    if (session.response) return session.response;
    if (session.user.role !== 'admin' || session.user.status !== 'active') {
      return fail(403, 'FORBIDDEN', 'Hanya admin yang dapat menghapus pengguna');
    }

    const { id } = await params;
    if (!UUID_RE.test(id)) return fail(400, 'INVALID_ID', 'ID pengguna tidak valid');

    // 1. Cek keberadaan user
    const { data: targetUser, error: findError } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('id', id)
      .maybeSingle();

    if (findError) return fail(500, 'QUERY_FAILED', findError.message);
    if (!targetUser) return fail(404, 'NOT_FOUND', 'Pengguna tidak ditemukan');

    // Proteksi self-delete (ID atau email admin yang sedang login)
    if (session.user.id === id || session.user.email === targetUser.email) {
      return fail(400, 'CANNOT_DELETE_SELF', 'Admin tidak dapat menghapus akun sendiri');
    }

    // 2. Hapus dari public.users (cascade akan menghapus profile anak)
    const { error: deleteDbError } = await supabaseAdmin.from('users').delete().eq('id', id);
    if (deleteDbError) return fail(500, 'DELETE_DB_FAILED', deleteDbError.message);

    // 3. Hapus dari Supabase Auth
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (deleteAuthError) {
      console.warn('[WARN] Gagal menghapus user dari Supabase Auth:', deleteAuthError.message);
    }

    return NextResponse.json({
      success: true,
      message: `Pengguna ${targetUser.email} berhasil dihapus permanen`,
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}
