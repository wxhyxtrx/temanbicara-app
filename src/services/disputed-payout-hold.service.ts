import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/client';
import { WalletHttpError } from '@/services/wallet.service';
import type { UserEntity } from '@/types/database';
import type { DisputedHoldStatus, DisputedPayoutHoldEntity } from '@/types/wallet';

type DbClient = typeof supabaseAdmin;

export const DISPUTED_HOLD_STATUSES: DisputedHoldStatus[] = ['active', 'cleared', 'deducted'];

export const resolveDisputedHoldSchema = z.object({
  action: z.enum(['clear', 'deduct'], {
    message: "Aksi resolusi harus 'clear' atau 'deduct'",
  }),
  note: z
    .string({ message: 'Catatan resolusi sengketa wajib diisi' })
    .trim()
    .min(1, 'Catatan resolusi sengketa wajib diisi')
    .max(1000, 'Catatan resolusi maksimal 1000 karakter'),
});

export type ResolveDisputedHoldInput = z.infer<typeof resolveDisputedHoldSchema>;

/**
 * Cek hak akses admin aktif. Return null bila lolos, atau detail error 403.
 */
export function checkActiveAdmin(
  user: Pick<UserEntity, 'role' | 'status'>
): { status: 403; code: string; message: string } | null {
  if (user.role !== 'admin') {
    return { status: 403, code: 'FORBIDDEN', message: 'Hanya admin yang dapat mengelola sengketa penahanan payout' };
  }
  if (user.status !== 'active') {
    return { status: 403, code: 'USER_NOT_ACTIVE', message: 'Akun admin belum aktif' };
  }
  return null;
}

function toEntity(row: Record<string, unknown>): DisputedPayoutHoldEntity {
  return {
    id: String(row.id),
    topup_order_id: String(row.topup_order_id),
    mitra_id: String(row.mitra_id),
    source_type: row.source_type as DisputedPayoutHoldEntity['source_type'],
    source_id: String(row.source_id),
    disputed_amount_rupiah: Number(row.disputed_amount_rupiah),
    status: row.status as DisputedHoldStatus,
    reason: String(row.reason ?? ''),
    created_at: String(row.created_at),
    resolved_at: (row.resolved_at as string | null) ?? null,
    resolved_by: (row.resolved_by as string | null) ?? null,
  };
}

export class DisputedPayoutHoldService {
  /**
   * Daftar hold sengketa terpaginasi, filter status (default 'active').
   */
  public static async listDisputedHolds(
    options: { status?: DisputedHoldStatus; page: number; limit: number },
    deps?: { client?: DbClient }
  ): Promise<{ items: DisputedPayoutHoldEntity[]; total: number }> {
    const db = deps?.client ?? supabaseAdmin;
    if (!db) {
      throw new WalletHttpError(500, 'SERVER_CONFIG_ERROR', 'Database client belum terinisialisasi');
    }

    const status = options.status ?? 'active';
    const from = (options.page - 1) * options.limit;

    const { data, count, error } = await db
      .from('disputed_payout_holds')
      .select('*', { count: 'exact' })
      .eq('status', status)
      .order('created_at', { ascending: false })
      .range(from, from + options.limit - 1);

    if (error) {
      console.error('[disputed-holds] list error:', error.message);
      throw new WalletHttpError(500, 'DB_ERROR', 'Gagal memuat daftar sengketa penahanan payout');
    }

    const rows = (data ?? []) as Record<string, unknown>[];
    return { items: rows.map(toEntity), total: count ?? 0 };
  }

  /**
   * Selesaikan hold sengketa (clear -> cleared, deduct -> deducted).
   * Hanya mengubah baris disputed_payout_holds; TIDAK menyentuh wallets / ledger_entries.
   * Hold yang sudah tidak 'active' ditolak 409 HOLD_ALREADY_RESOLVED.
   */
  public static async resolveDisputedHold(
    holdId: string,
    adminId: string,
    action: 'clear' | 'deduct',
    note: string,
    deps?: { client?: DbClient; now?: () => Date }
  ): Promise<DisputedPayoutHoldEntity> {
    const db = deps?.client ?? supabaseAdmin;
    if (!db) {
      throw new WalletHttpError(500, 'SERVER_CONFIG_ERROR', 'Database client belum terinisialisasi');
    }

    const { data: hold, error: fetchErr } = await db
      .from('disputed_payout_holds')
      .select('*')
      .eq('id', holdId)
      .maybeSingle();

    if (fetchErr) {
      console.error('[disputed-holds] fetch error:', fetchErr.message);
      throw new WalletHttpError(500, 'DB_ERROR', 'Gagal memuat data sengketa hold');
    }
    if (!hold) {
      throw new WalletHttpError(404, 'HOLD_NOT_FOUND', 'Data sengketa hold tidak ditemukan');
    }

    const current = hold as Record<string, unknown>;
    if (current.status !== 'active') {
      throw new WalletHttpError(409, 'HOLD_ALREADY_RESOLVED', 'Sengketa hold sudah diselesaikan sebelumnya');
    }

    const newStatus: DisputedHoldStatus = action === 'clear' ? 'cleared' : 'deducted';
    // ponytail: catatan resolusi disisipkan ke kolom reason (tabel belum punya kolom note); tambah kolom resolution_note bila butuh audit terpisah.
    const reason = `${String(current.reason ?? '')} [Resolusi ${newStatus}: ${note.trim()}]`.trim();

    // Guard status='active' di UPDATE: dua admin bersamaan -> hanya satu yang menang, sisanya 409.
    const { data: updated, error: updateErr } = await db
      .from('disputed_payout_holds')
      .update({
        status: newStatus,
        resolved_at: (deps?.now?.() ?? new Date()).toISOString(),
        resolved_by: adminId,
        reason,
      })
      .eq('id', holdId)
      .eq('status', 'active')
      .select('*')
      .maybeSingle();

    if (updateErr) {
      console.error('[disputed-holds] update error:', updateErr.message);
      throw new WalletHttpError(500, 'DB_ERROR', 'Gagal memperbarui status sengketa hold');
    }
    if (!updated) {
      throw new WalletHttpError(409, 'HOLD_ALREADY_RESOLVED', 'Sengketa hold sudah diselesaikan sebelumnya');
    }

    return toEntity(updated as Record<string, unknown>);
  }
}
