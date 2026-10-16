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

function extractStoragePath(rawPath?: string | null): string | null {
  if (!rawPath || typeof rawPath !== 'string') return null;
  let p = rawPath.trim();
  if (!p) return null;

  p = p.split('?')[0];
  if (p.startsWith('http://') || p.startsWith('https://')) {
    const marker = '/dokumen-mitra/';
    const idx = p.indexOf(marker);
    if (idx !== -1) {
      p = p.substring(idx + marker.length);
    } else {
      return null;
    }
  }

  p = p.replace(/^\/+/, '');
  if (p.startsWith('dokumen-mitra/')) {
    p = p.substring('dokumen-mitra/'.length);
  }
  p = p.replace(/^\/+/, '');

  return p || null;
}

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

    // 1. Ambil last_sign_in_at dari Supabase Auth
    let lastSignInAt: string | null = null;
    try {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(id);
      lastSignInAt = authUser?.user?.last_sign_in_at ?? null;
    } catch (authErr) {
      console.warn('Could not fetch auth user for last_sign_in_at:', authErr);
    }

    // 2. Ambil verified_at jika ada di profil (psikolog_profiles.verified_at)
    // Relawan tidak memiliki tabel/kolom verified_at -> wajib null (bukan string)
    const verifiedAt =
      user.role === 'psikolog'
        ? ((profile?.verified_at as string | undefined) ?? null)
        : null;

    // 3. Signed URL dokumen mitra (600 detik) dari bucket private 'dokumen-mitra'
    let dokumenSignedUrl: string | null = null;
    if (user.role === 'psikolog' || user.role === 'relawan') {
      const rawDoc =
        user.role === 'psikolog'
          ? (profile?.dokumen_sipp_str_url as string | undefined)
          : (profile?.dokumen_cv_url as string | undefined);

      const storagePath = extractStoragePath(rawDoc);
      if (storagePath) {
        try {
          const { data: signedData, error: signedError } = await supabaseAdmin.storage
            .from('dokumen-mitra')
            .createSignedUrl(storagePath, 600);

          if (!signedError && signedData?.signedUrl) {
            dokumenSignedUrl = signedData.signedUrl;
          } else if (signedError) {
            console.warn('Gagal membuat signed URL dokumen mitra:', signedError.message);
          }
        } catch (storageErr) {
          console.warn('Exception saat createSignedUrl:', storageErr);
        }
      }
    }

    // 4. Saldo dompet lengkap dari tabel wallets
    const { data: walletRow } = await supabaseAdmin
      .from('wallets')
      .select('coin_balance, pending_rupiah, available_rupiah')
      .eq('user_id', id)
      .maybeSingle();

    const wallet = {
      coin_balance: Number(walletRow?.coin_balance ?? 0),
      pending_rupiah: Number(walletRow?.pending_rupiah ?? 0),
      available_rupiah: Number(walletRow?.available_rupiah ?? 0),
    };

    // 5. Khusus pasien: total top-up berhasil (koin & rupiah)
    let topupSummary: { total_coins: number; total_rupiah: number; successful_orders_count: number } | null = null;
    if (user.role === 'pasien') {
      const { data: topupRows } = await supabaseAdmin
        .from('topup_orders')
        .select('coins, amount_rupiah')
        .eq('patient_id', id)
        .eq('status', 'settlement');

      const orders = topupRows ?? [];
      topupSummary = {
        total_coins: orders.reduce((acc, row) => acc + Number(row.coins), 0),
        total_rupiah: orders.reduce((acc, row) => acc + Number(row.amount_rupiah), 0),
        successful_orders_count: orders.length,
      };
    }

    // 6. Khusus mitra: total payout dibayar
    let payoutSummary: { total_paid_rupiah: number; paid_requests_count: number } | null = null;
    if (user.role === 'psikolog' || user.role === 'relawan') {
      const { data: payoutRows } = await supabaseAdmin
        .from('payout_requests')
        .select('amount_rupiah')
        .eq('mitra_id', id)
        .eq('status', 'paid');

      const payouts = payoutRows ?? [];
      payoutSummary = {
        total_paid_rupiah: payouts.reduce((acc, row) => acc + Number(row.amount_rupiah), 0),
        paid_requests_count: payouts.length,
      };
    }

    const fullName = displayName(user, profile);

    return NextResponse.json({
      success: true,
      data: {
        user: {
          ...user,
          fullName,
          last_sign_in_at: lastSignInAt,
          verified_at: verifiedAt,
          dokumen_signed_url: dokumenSignedUrl,
        },
        profile: profile
          ? {
              ...profile,
              dokumen_signed_url: dokumenSignedUrl,
              ...(user.role === 'relawan' ? { verified_at: null } : {}),
            }
          : null,
        fullName,
        wallet,
        topup_summary: topupSummary,
        payout_summary: payoutSummary,
        dokumen_signed_url: dokumenSignedUrl,
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
