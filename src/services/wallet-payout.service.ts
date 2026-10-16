import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/client';
import { getRoleProfile } from '@/lib/auth/session';
import { normalizePayeeName } from '@/lib/wallet/payee-name';
import { WalletHttpError } from '@/services/wallet.service';
import type { UserEntity, UserRole } from '@/types/database';
import type {
  AdminPayoutItem,
  PayoutRequestEntity,
  PayoutStatus,
} from '@/types/wallet';

export class WalletPayoutService {
  /**
   * Mitra mengajukan penarikan dana honor ke rekening bank.
   */
  public static async requestPayout(
    mitra: UserEntity,
    input: { amount_rupiah: number; bank_name: string; account_number: string; bank_account_name: string }
  ): Promise<{ payout_id: string; amount_rupiah: number; fee_rupiah: number; total_deducted: number; status: string; requested_at: string }> {
    if (!supabaseAdmin) {
      throw new WalletHttpError(500, 'SERVER_CONFIG_ERROR', 'Database client belum terinisialisasi');
    }

    if (mitra.role !== 'psikolog' && mitra.role !== 'relawan') {
      throw new WalletHttpError(403, 'FORBIDDEN', 'Hanya mitra yang dapat mengajukan payout');
    }
    if (mitra.status !== 'active') {
      throw new WalletHttpError(403, 'USER_NOT_ACTIVE', 'Akun mitra belum aktif');
    }

    // Validasi nama rekening dengan nama profil terverifikasi (buang gelar, wajib sama persis)
    const profile = await getRoleProfile(mitra);
    const verifiedName = String(
      (profile?.nama_lengkap_gelar as string | undefined) ??
      (profile?.nama_lengkap as string | undefined) ??
      ''
    ).trim();

    if (!verifiedName) {
      throw new WalletHttpError(422, 'PROFILE_NOT_VERIFIED', 'Profil mitra belum terverifikasi');
    }

    const normAccountName = normalizePayeeName(input.bank_account_name);
    const normVerifiedName = normalizePayeeName(verifiedName);

    if (!normAccountName || normAccountName !== normVerifiedName) {
      throw new WalletHttpError(
        422,
        'INVALID_ACCOUNT_NAME',
        `Nama pemilik rekening ("${input.bank_account_name}") harus sama persis dengan nama profil terverifikasi ("${verifiedName}")`
      );
    }

    // Ambil setting payout
    const { data: settingRow, error: settingErr } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'payout')
      .maybeSingle();

    if (settingErr || !settingRow) {
      throw new WalletHttpError(500, 'SETTING_PAYOUT_INVALID', 'Konfigurasi payout tidak tersedia');
    }

    const minRupiah = Number(settingRow.value?.min_rupiah ?? 1000000);
    const maxRupiah = Number(settingRow.value?.max_rupiah ?? 10000000);
    const feeRupiah = Number(settingRow.value?.fee_rupiah ?? 6500);

    if (input.amount_rupiah < minRupiah || input.amount_rupiah > maxRupiah) {
      throw new WalletHttpError(
        422,
        'PAYOUT_OUT_OF_RANGE',
        `Nominal penarikan harus antara Rp ${minRupiah.toLocaleString('id-ID')} dan Rp ${maxRupiah.toLocaleString('id-ID')}`
      );
    }

    const payoutId = crypto.randomUUID();

    const { error: rpcErr } = await supabaseAdmin.rpc('payout_request', {
      p_payout_id: payoutId,
      p_mitra_id: mitra.id,
      p_amount: input.amount_rupiah,
      p_bank_name: input.bank_name,
      p_account_number: input.account_number,
      p_account_name: input.bank_account_name,
    });

    if (rpcErr) {
      console.error('Error calling payout_request RPC:', rpcErr);
      if (rpcErr.message.includes('INSUFFICIENT_BALANCE') || rpcErr.code === 'P0001') {
        throw new WalletHttpError(
          402,
          'INSUFFICIENT_BALANCE',
          'Saldo available tidak mencukupi untuk nominal penarikan dan biaya transfer'
        );
      }
      if (rpcErr.code === '22023') {
        throw new WalletHttpError(422, 'PAYOUT_OUT_OF_RANGE', rpcErr.message);
      }
      if (rpcErr.code === '42501') {
        throw new WalletHttpError(403, 'FORBIDDEN', rpcErr.message);
      }
      throw new WalletHttpError(500, 'RPC_ERROR', 'Gagal memproses pengajuan payout');
    }

    return {
      payout_id: payoutId,
      amount_rupiah: input.amount_rupiah,
      fee_rupiah: feeRupiah,
      total_deducted: input.amount_rupiah + feeRupiah,
      status: 'requested',
      requested_at: new Date().toISOString(),
    };
  }

  /**
   * Riwayat pengajuan payout milik mitra.
   */
  public static async getMitraPayouts(
    mitraId: string,
    options: { page: number; limit: number }
  ): Promise<{ items: PayoutRequestEntity[]; total: number }> {
    if (!supabaseAdmin) {
      throw new WalletHttpError(500, 'SERVER_CONFIG_ERROR', 'Database client belum terinisialisasi');
    }

    const { page, limit } = options;
    const from = (page - 1) * limit;
    const to = page * limit - 1;

    const { data, error, count } = await supabaseAdmin
      .from('payout_requests')
      .select('id, mitra_id, amount_rupiah, fee_rupiah, bank_name, account_number, bank_account_name, status, requested_at, decided_at, decided_by', { count: 'exact' })
      .eq('mitra_id', mitraId)
      .order('requested_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Error fetching mitra payouts:', error);
      throw new WalletHttpError(500, 'DB_ERROR', 'Gagal memuat riwayat penarikan dana');
    }

    const items: PayoutRequestEntity[] = (data ?? []).map((row) => ({
      id: row.id,
      mitra_id: row.mitra_id,
      amount_rupiah: Number(row.amount_rupiah),
      fee_rupiah: Number(row.fee_rupiah),
      bank_name: row.bank_name,
      account_number: row.account_number,
      bank_account_name: row.bank_account_name,
      status: row.status,
      requested_at: row.requested_at,
      decided_at: row.decided_at,
      decided_by: row.decided_by,
    }));

    return {
      items,
      total: count ?? items.length,
    };
  }

  /**
   * Daftar antrean pengajuan payout untuk admin.
   */
  public static async getAdminPayouts(
    options: { status?: PayoutStatus; page: number; limit: number }
  ): Promise<{ items: AdminPayoutItem[]; total: number }> {
    if (!supabaseAdmin) {
      throw new WalletHttpError(500, 'SERVER_CONFIG_ERROR', 'Database client belum terinisialisasi');
    }

    const { status, page, limit } = options;
    const from = (page - 1) * limit;
    const to = page * limit - 1;

    let query = supabaseAdmin
      .from('payout_requests')
      .select('id, mitra_id, amount_rupiah, fee_rupiah, bank_name, account_number, bank_account_name, status, requested_at, decided_at, decided_by', { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query
      .order('requested_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Error fetching admin payouts:', error);
      throw new WalletHttpError(500, 'DB_ERROR', 'Gagal memuat daftar pengajuan payout');
    }

    const mitraIds = Array.from(new Set((data ?? []).map((r) => r.mitra_id)));

    // Fetch mitra roles and profiles
    const [usersRes, psikologRes, relawanRes] = await Promise.all([
      mitraIds.length > 0 ? supabaseAdmin.from('users').select('id, role').in('id', mitraIds) : { data: [] },
      mitraIds.length > 0 ? supabaseAdmin.from('psikolog_profiles').select('user_id, nama_lengkap_gelar').in('user_id', mitraIds) : { data: [] },
      mitraIds.length > 0 ? supabaseAdmin.from('relawan_profiles').select('user_id, nama_lengkap').in('user_id', mitraIds) : { data: [] },
    ]);

    const roleMap = new Map((usersRes.data ?? []).map((u) => [u.id, u.role as UserRole]));
    const nameMap = new Map<string, string>();

    for (const p of psikologRes.data ?? []) {
      nameMap.set(p.user_id, p.nama_lengkap_gelar);
    }
    for (const r of relawanRes.data ?? []) {
      nameMap.set(r.user_id, r.nama_lengkap);
    }

    const items: AdminPayoutItem[] = (data ?? []).map((row) => ({
      id: row.id,
      mitra_id: row.mitra_id,
      mitra_name: nameMap.get(row.mitra_id) ?? row.bank_account_name,
      mitra_role: roleMap.get(row.mitra_id),
      amount_rupiah: Number(row.amount_rupiah),
      fee_rupiah: Number(row.fee_rupiah),
      bank_name: row.bank_name,
      account_number: row.account_number,
      bank_account_name: row.bank_account_name,
      status: row.status,
      requested_at: row.requested_at,
      decided_at: row.decided_at,
      decided_by: row.decided_by,
    }));

    return {
      items,
      total: count ?? items.length,
    };
  }

  /**
   * Admin menolak pengajuan payout & mengembalikan dana ke saldo available mitra.
   */
  public static async rejectPayout(payoutId: string, adminId: string): Promise<{ payout_id: string; status: 'rejected' }> {
    if (!supabaseAdmin) {
      throw new WalletHttpError(500, 'SERVER_CONFIG_ERROR', 'Database client belum terinisialisasi');
    }

    const { error: rpcErr } = await supabaseAdmin.rpc('payout_reject', {
      p_payout_id: payoutId,
      p_admin_id: adminId,
    });

    if (rpcErr) {
      console.error('Error calling payout_reject RPC:', rpcErr);
      if (rpcErr.code === 'P0002') {
        throw new WalletHttpError(404, 'PAYOUT_NOT_FOUND', 'Pengajuan payout tidak ditemukan');
      }
      if (rpcErr.code === 'P0001') {
        throw new WalletHttpError(409, 'PAYOUT_NOT_REJECTABLE', 'Pengajuan payout tidak dalam status requested');
      }
      if (rpcErr.code === '42501') {
        throw new WalletHttpError(403, 'FORBIDDEN', 'Hanya admin yang dapat menolak payout');
      }
      throw new WalletHttpError(500, 'RPC_ERROR', 'Gagal menolak pengajuan payout');
    }

    return {
      payout_id: payoutId,
      status: 'rejected',
    };
  }

  /**
   * Admin mengonfirmasi payout telah dibayarkan ke rekening mitra.
   */
  public static async markPayoutPaid(payoutId: string, adminId: string): Promise<{ payout_id: string; status: 'paid' }> {
    if (!supabaseAdmin) {
      throw new WalletHttpError(500, 'SERVER_CONFIG_ERROR', 'Database client belum terinisialisasi');
    }

    const { error: rpcErr } = await supabaseAdmin.rpc('payout_mark_paid', {
      p_payout_id: payoutId,
      p_admin_id: adminId,
    });

    if (rpcErr) {
      console.error('Error calling payout_mark_paid RPC:', rpcErr);
      if (rpcErr.code === 'P0002') {
        throw new WalletHttpError(404, 'PAYOUT_NOT_FOUND', 'Pengajuan payout tidak ditemukan');
      }
      if (rpcErr.code === 'P0001') {
        throw new WalletHttpError(409, 'PAYOUT_NOT_PAYABLE', 'Pengajuan payout tidak dalam status requested');
      }
      if (rpcErr.code === '42501') {
        throw new WalletHttpError(403, 'FORBIDDEN', 'Hanya admin yang dapat menyetujui pembayaran payout');
      }
      throw new WalletHttpError(500, 'RPC_ERROR', 'Gagal memperbarui status payout');
    }

    return {
      payout_id: payoutId,
      status: 'paid',
    };
  }
}
