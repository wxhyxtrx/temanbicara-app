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
    input: { amount_rupiah: number; bank_name: string; account_number: string; bank_account_name: string },
    options?: {
      client?: typeof supabaseAdmin;
      getProfile?: (mitra: UserEntity) => Promise<Record<string, unknown> | null>;
    }
  ): Promise<{ payout_id: string; amount_rupiah: number; fee_rupiah: number; total_deducted: number; status: string; requested_at: string }> {
    const db = options?.client ?? supabaseAdmin;
    if (!db) {
      throw new WalletHttpError(500, 'SERVER_CONFIG_ERROR', 'Database client belum terinisialisasi');
    }

    if (mitra.role !== 'psikolog' && mitra.role !== 'relawan') {
      throw new WalletHttpError(403, 'FORBIDDEN', 'Hanya mitra yang dapat mengajukan payout');
    }
    if (mitra.status !== 'active') {
      throw new WalletHttpError(403, 'USER_NOT_ACTIVE', 'Akun mitra belum aktif');
    }

    // Validasi nama rekening dengan nama profil terverifikasi (buang gelar, wajib sama persis)
    const profile = options?.getProfile ? await options.getProfile(mitra) : await getRoleProfile(mitra);
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
    const { data: settingRow, error: settingErr } = await db
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

    // Guardrail saldo sengketa (PRD-050 / T-216):
    // Periksa apakah mitra memiliki penahanan payout sengketa aktif
    const [walletRes, holdsRes] = await Promise.all([
      db
        .from('wallets')
        .select('available_rupiah')
        .eq('user_id', mitra.id)
        .maybeSingle(),
      db
        .from('disputed_payout_holds')
        .select('disputed_amount_rupiah')
        .eq('mitra_id', mitra.id)
        .eq('status', 'active'),
    ]);

    if (walletRes.error) {
      console.error('Error fetching wallet for payout request:', walletRes.error);
      throw new WalletHttpError(500, 'DB_ERROR', 'Gagal memverifikasi saldo wallet');
    }
    if (holdsRes.error) {
      console.error('Error fetching disputed holds for payout request:', holdsRes.error);
      throw new WalletHttpError(500, 'DB_ERROR', 'Gagal memeriksa status sengketa penahanan payout');
    }

    const currentAvailable = Number(walletRes.data?.available_rupiah ?? 0);
    const totalHeld = (holdsRes.data ?? []).reduce(
      (sum: number, row: { disputed_amount_rupiah: number | string }) => sum + Number(row.disputed_amount_rupiah ?? 0),
      0
    );

    if (totalHeld > 0) {
      const withdrawable = Math.max(0, currentAvailable - totalHeld);
      if (input.amount_rupiah + feeRupiah > withdrawable) {
        const maxWithdrawAmount = Math.max(0, withdrawable - feeRupiah);
        throw new WalletHttpError(
          422,
          'PAYOUT_HELD_FOR_VERIFICATION',
          `Sebagian saldo Anda (Rp ${totalHeld.toLocaleString('id-ID')}) sedang dalam status peninjauan verifikasi sengketa transaksi platform. Maksimal pencairan yang dapat diproses saat ini adalah Rp ${maxWithdrawAmount.toLocaleString('id-ID')}.`
        );
      }
    }

    const payoutId = crypto.randomUUID();

    const { error: rpcErr } = await db.rpc('payout_request', {
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
    options: { page: number; limit: number },
    client: typeof supabaseAdmin = supabaseAdmin
  ): Promise<{ items: PayoutRequestEntity[]; total: number }> {
    const db = client ?? supabaseAdmin;
    if (!db) {
      throw new WalletHttpError(500, 'SERVER_CONFIG_ERROR', 'Database client belum terinisialisasi');
    }

    const { page, limit } = options;
    const from = (page - 1) * limit;
    const to = page * limit - 1;

    const { data, error, count } = await db
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
    options: { status?: PayoutStatus; page: number; limit: number },
    client: typeof supabaseAdmin = supabaseAdmin
  ): Promise<{ items: AdminPayoutItem[]; total: number }> {
    const db = client ?? supabaseAdmin;
    if (!db) {
      throw new WalletHttpError(500, 'SERVER_CONFIG_ERROR', 'Database client belum terinisialisasi');
    }

    const { status, page, limit } = options;
    const from = (page - 1) * limit;
    const to = page * limit - 1;

    let query = db
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

    // Fetch mitra roles, profiles, and active dispute holds
    const [usersRes, psikologRes, relawanRes, holdsRes] = await Promise.all([
      mitraIds.length > 0 ? db.from('users').select('id, role').in('id', mitraIds) : { data: [] },
      mitraIds.length > 0 ? db.from('psikolog_profiles').select('user_id, nama_lengkap_gelar').in('user_id', mitraIds) : { data: [] },
      mitraIds.length > 0 ? db.from('relawan_profiles').select('user_id, nama_lengkap').in('user_id', mitraIds) : { data: [] },
      mitraIds.length > 0
        ? db
            .from('disputed_payout_holds')
            .select('mitra_id, disputed_amount_rupiah')
            .in('mitra_id', mitraIds)
            .eq('status', 'active')
        : { data: [] },
    ]);

    const roleMap = new Map((usersRes.data ?? []).map((u) => [u.id, u.role as UserRole]));
    const nameMap = new Map<string, string>();

    for (const p of psikologRes.data ?? []) {
      nameMap.set(p.user_id, p.nama_lengkap_gelar);
    }
    for (const r of relawanRes.data ?? []) {
      nameMap.set(r.user_id, r.nama_lengkap);
    }

    const holdsMap = new Map<string, number>();
    for (const hold of (holdsRes.data ?? [])) {
      const current = holdsMap.get(hold.mitra_id) ?? 0;
      holdsMap.set(hold.mitra_id, current + Number(hold.disputed_amount_rupiah ?? 0));
    }

    const items: AdminPayoutItem[] = (data ?? []).map((row) => {
      const holdAmount = holdsMap.get(row.mitra_id) ?? 0;
      return {
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
        has_dispute_hold: holdAmount > 0,
        dispute_hold_amount: holdAmount,
        requested_at: row.requested_at,
        decided_at: row.decided_at,
        decided_by: row.decided_by,
      };
    });

    return {
      items,
      total: count ?? items.length,
    };
  }

  /**
   * Admin menolak pengajuan payout & mengembalikan dana ke saldo available mitra.
   */
  public static async rejectPayout(
    payoutId: string,
    adminId: string,
    client: typeof supabaseAdmin = supabaseAdmin
  ): Promise<{ payout_id: string; status: 'rejected' }> {
    const db = client ?? supabaseAdmin;
    if (!db) {
      throw new WalletHttpError(500, 'SERVER_CONFIG_ERROR', 'Database client belum terinisialisasi');
    }

    const { error: rpcErr } = await db.rpc('payout_reject', {
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
  public static async markPayoutPaid(
    payoutId: string,
    adminId: string,
    client: typeof supabaseAdmin = supabaseAdmin
  ): Promise<{ payout_id: string; status: 'paid' }> {
    const db = client ?? supabaseAdmin;
    if (!db) {
      throw new WalletHttpError(500, 'SERVER_CONFIG_ERROR', 'Database client belum terinisialisasi');
    }

    // 1. Ambil data pengajuan payout untuk mengetahui mitra_id dan status
    const { data: payoutRow, error: payoutErr } = await db
      .from('payout_requests')
      .select('mitra_id, status')
      .eq('id', payoutId)
      .maybeSingle();

    if (payoutErr) {
      console.error('Error fetching payout request:', payoutErr);
      throw new WalletHttpError(500, 'DB_ERROR', 'Gagal memverifikasi pengajuan payout');
    }

    if (!payoutRow) {
      throw new WalletHttpError(404, 'PAYOUT_NOT_FOUND', 'Pengajuan payout tidak ditemukan');
    }

    if (payoutRow.status !== 'requested') {
      throw new WalletHttpError(409, 'PAYOUT_NOT_PAYABLE', 'Pengajuan payout tidak dalam status requested');
    }

    // 2. Proteksi hold sengketa aktif mitra (PRD-050 / T-216):
    // Admin dilarang menandai paid jika mitra memiliki sengketa penahanan payout aktif
    const { data: activeHolds, error: holdsErr } = await db
      .from('disputed_payout_holds')
      .select('id')
      .eq('mitra_id', payoutRow.mitra_id)
      .eq('status', 'active')
      .limit(1);

    if (holdsErr) {
      console.error('Error checking active dispute holds:', holdsErr);
      throw new WalletHttpError(500, 'DB_ERROR', 'Gagal memeriksa status sengketa penahanan payout');
    }

    if (activeHolds && activeHolds.length > 0) {
      throw new WalletHttpError(
        409,
        'PAYOUT_HAS_ACTIVE_DISPUTE',
        'Tidak dapat menandai paid: mitra memiliki sengketa penahanan payout aktif yang belum diselesaikan.'
      );
    }

    // 3. Panggil RPC payout_mark_paid
    const { error: rpcErr } = await db.rpc('payout_mark_paid', {
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
