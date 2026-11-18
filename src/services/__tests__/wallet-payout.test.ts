// T-234 (PRD-053): payout mitra — rekening bank, batas min/max, fee, saldo, guardrail sengketa aktif.
import { catchError, type RpcResult } from '@/test/env';
import { describe, expect, it } from 'vitest';
import type { supabaseAdmin } from '@/lib/supabase/client';
import type { UserEntity } from '@/types/database';

// Muat facade lebih dulu: wallet.service mengevaluasi delegasi statis ke payout service.
await import('../wallet.service');
const { WalletPayoutService } = await import('../wallet-payout.service');
const { requestPayoutSchema } = await import('@/lib/validations/wallet');

const SETTINGS = { min_rupiah: 500_000, max_rupiah: 5_000_000, fee_rupiah: 6_500 };

interface State {
  available: number;
  holds: number[];
  payoutStatus?: string;
  rpcError?: RpcResult['error'];
}

/** Fake DB: payout_request meniru cek saldo SQL (amount + fee > available -> INSUFFICIENT_BALANCE P0001). */
function createDb(s: State) {
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const rows = (table: string): Array<Record<string, unknown>> => {
    if (table === 'system_settings') return [{ value: SETTINGS }];
    if (table === 'wallets') return [{ available_rupiah: s.available }];
    if (table === 'disputed_payout_holds') return s.holds.map((amt, i) => ({ id: `h${i}`, disputed_amount_rupiah: amt }));
    if (table === 'payout_requests') return s.payoutStatus ? [{ mitra_id: 'mitra-1', status: s.payoutStatus }] : [];
    throw new Error(`Tabel tidak diharapkan: ${table}`);
  };
  const client = {
    from: (table: string) => ({
      select: () => {
        const data = rows(table);
        const q = {
          eq: () => q,
          limit: () => q,
          maybeSingle: async () => ({ data: data[0] ?? null, error: null }),
          then: <R>(f: (v: { data: typeof data; error: null }) => R) => Promise.resolve({ data, error: null }).then(f),
        };
        return q;
      },
    }),
    rpc: async (fn: string, args: Record<string, unknown>): Promise<RpcResult> => {
      rpcCalls.push({ fn, args });
      if (s.rpcError) return { data: null, error: s.rpcError };
      if (fn === 'payout_request') {
        const total = Number(args.p_amount) + SETTINGS.fee_rupiah;
        if (total > s.available) return { data: null, error: { code: 'P0001', message: 'INSUFFICIENT_BALANCE' } };
        s.available -= total;
      }
      return { data: null, error: null };
    },
  };
  return { client: client as unknown as typeof supabaseAdmin, rpcCalls, state: s };
}

const mitra: UserEntity = {
  id: 'mitra-1',
  email: 'mitra@example.test',
  no_wa: '080000000000',
  google_id: null,
  role: 'psikolog',
  status: 'active',
  avatar_url: null,
  is_email_verified: true,
  created_at: '2026-11-01T00:00:00Z',
  updated_at: '2026-11-01T00:00:00Z',
};
const getProfile = async () => ({ nama_lengkap_gelar: 'Dr. Budi Santoso, M.Psi., Psikolog' });
const bank = { bank_name: 'BCA', account_number: '1234567890', bank_account_name: 'Budi Santoso' };

const request = (db: ReturnType<typeof createDb>, amount: number, extra: Partial<typeof bank> = {}, user = mitra) =>
  WalletPayoutService.requestPayout(user, { amount_rupiah: amount, ...bank, ...extra }, { client: db.client, getProfile });

describe('Payout — validasi rekening bank', () => {
  it('skema Zod menolak nama bank, nomor rekening, nama pemilik yang tidak valid', () => {
    const base = { amount_rupiah: 1_000_000, ...bank };
    expect(requestPayoutSchema.safeParse(base).success).toBe(true);
    for (const bad of [
      { bank_name: 'B' },
      { account_number: '123' },
      { account_number: '1'.repeat(31) },
      { bank_account_name: ' ' },
      { amount_rupiah: 1_000_000.5 },
    ]) {
      expect(requestPayoutSchema.safeParse({ ...base, ...bad }).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it('nama rekening beda dari profil terverifikasi ditolak 422 INVALID_ACCOUNT_NAME', async () => {
    const db = createDb({ available: 2_000_000, holds: [] });
    const err = await catchError(() => request(db, 1_000_000, { bank_account_name: 'Andi Wijaya' }));
    expect(err).toMatchObject({ status: 422, code: 'INVALID_ACCOUNT_NAME' });
    expect(db.rpcCalls.length).toBe(0);
  });

  it('nama rekening tanpa gelar & beda kapitalisasi diterima', async () => {
    const db = createDb({ available: 2_000_000, holds: [] });
    const res = await request(db, 1_000_000, { bank_account_name: 'BUDI SANTOSO' });
    expect(res.status).toBe('requested');
  });

  it('non-mitra ditolak 403 FORBIDDEN', async () => {
    const db = createDb({ available: 2_000_000, holds: [] });
    const err = await catchError(() => request(db, 1_000_000, {}, { ...mitra, role: 'pasien' }));
    expect(err).toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });
});

describe('Payout — batas nominal, fee, saldo', () => {
  it.each([SETTINGS.min_rupiah - 1, SETTINGS.max_rupiah + 1])('nominal %i di luar batas ditolak 422 PAYOUT_OUT_OF_RANGE', async (amount) => {
    const db = createDb({ available: 10_000_000, holds: [] });
    const err = await catchError(() => request(db, amount));
    expect(err).toMatchObject({ status: 422, code: 'PAYOUT_OUT_OF_RANGE' });
    expect(db.rpcCalls.length).toBe(0);
  });

  it.each([SETTINGS.min_rupiah, SETTINGS.max_rupiah])('nominal batas %i diterima, fee dipotong dari saldo', async (amount) => {
    const db = createDb({ available: 10_000_000, holds: [] });
    const res = await request(db, amount);
    expect(res).toMatchObject({ amount_rupiah: amount, fee_rupiah: 6_500, total_deducted: amount + 6_500 });
    expect(db.state.available).toBe(10_000_000 - amount - 6_500);
    expect(db.rpcCalls[0].args).toMatchObject({ p_mitra_id: 'mitra-1', p_amount: amount, p_account_number: '1234567890' });
  });

  it('saldo tidak cukup untuk nominal + fee ditolak 402 INSUFFICIENT_BALANCE', async () => {
    const db = createDb({ available: 1_000_000, holds: [] });
    const err = await catchError(() => request(db, 1_000_000));
    expect(err).toMatchObject({ status: 402, code: 'INSUFFICIENT_BALANCE' });
    expect(db.state.available, 'Saldo tidak berubah').toBe(1_000_000);
  });
});

describe('Payout — guardrail sengketa aktif', () => {
  it('withdrawable < requested ditolak 422 PAYOUT_HELD_FOR_VERIFICATION sebelum RPC', async () => {
    // available 1.000.000 - hold 300.000 = 700.000; 700.000 + fee > 700.000
    const db = createDb({ available: 1_000_000, holds: [200_000, 100_000] });
    const err = await catchError(() => request(db, 700_000));
    expect(err).toMatchObject({ status: 422, code: 'PAYOUT_HELD_FOR_VERIFICATION' });
    expect(err.message).toContain('Rp 693.500');
    expect(db.rpcCalls.length).toBe(0);
  });

  it('nominal dalam batas withdrawable tetap diproses walau ada hold', async () => {
    const db = createDb({ available: 1_000_000, holds: [300_000] });
    const res = await request(db, 693_500);
    expect(res.total_deducted).toBe(700_000);
  });

  it('admin mark paid ditolak 409 PAYOUT_HAS_ACTIVE_DISPUTE bila ada hold aktif', async () => {
    const db = createDb({ available: 0, holds: [50_000], payoutStatus: 'requested' });
    const err = await catchError(() => WalletPayoutService.markPayoutPaid('payout-1', 'admin-1', db.client));
    expect(err).toMatchObject({ status: 409, code: 'PAYOUT_HAS_ACTIVE_DISPUTE' });
    expect(db.rpcCalls.length).toBe(0);
  });

  it('admin mark paid lolos tanpa hold aktif', async () => {
    const db = createDb({ available: 0, holds: [], payoutStatus: 'requested' });
    const res = await WalletPayoutService.markPayoutPaid('payout-1', 'admin-1', db.client);
    expect(res).toStrictEqual({ payout_id: 'payout-1', status: 'paid' });
    expect(db.rpcCalls.map((c) => c.fn)).toStrictEqual(['payout_mark_paid']);
  });
});
