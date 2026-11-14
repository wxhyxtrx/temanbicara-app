// Test T-223 (PRD-051): resolusi sengketa payout (deduct bertingkat, clear, idempotensi) & held_rupiah.
//
// ponytail: RPC resolve_dispute_hold dijalankan oleh fake in-memory yang meniru persis aritmetika
// migrasi 20261114000035 (LEAST available, lalu LEAST pending, ledger per akun > 0). SQL aslinya
// diverifikasi oleh supabase/tests/20261114000035_resolve_dispute_hold_dryrun.sql (DRYRUN_OK).
// Upgrade: jalankan test ini terhadap Postgres lokal (supabase start) bila tersedia di CI.

// Environment fallback sebelum modul supabase client di-import
if (!process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://dummy.supabase.co';
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && !process.env.SUPABASE_ANON_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'dummy-anon-key';
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'dummy-service-role-key';
}

import { assert, describe, expect, it } from 'vitest';
import type { supabaseAdmin } from '@/lib/supabase/client';

type DbClient = typeof supabaseAdmin;

interface HoldRow {
  id: string;
  topup_order_id: string;
  mitra_id: string;
  source_type: 'session' | 'extension' | 'tip';
  source_id: string;
  disputed_amount_rupiah: number;
  deducted_amount_rupiah: number;
  status: 'active' | 'cleared' | 'deducted';
  reason: string;
  resolution_note: string | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

interface WalletRow {
  user_id: string;
  coin_balance: number;
  available_rupiah: number;
  pending_rupiah: number;
  updated_at: string;
}

interface LedgerRow {
  user_id: string;
  account: 'mitra_available' | 'mitra_pending';
  amount: number;
  unit: 'rupiah';
  reason: 'dispute_deduct';
  ref_type: 'dispute_hold';
  ref_id: string;
}

interface RpcArgs {
  p_hold_id: string;
  p_admin_id: string;
  p_action: string;
  p_note: string;
}

type RpcResult = { data: HoldRow | null; error: { code: string; message: string } | null };

function makeHold(id: string, mitraId: string, amount: number, status: HoldRow['status'] = 'active'): HoldRow {
  return {
    id,
    topup_order_id: `topup-${id}`,
    mitra_id: mitraId,
    source_type: 'session',
    source_id: `booking-${id}`,
    disputed_amount_rupiah: amount,
    deducted_amount_rupiah: 0,
    status,
    reason: `Hold sengketa ${id}`,
    resolution_note: null,
    created_at: '2026-11-13T01:00:00Z',
    resolved_at: status === 'active' ? null : '2026-11-13T02:00:00Z',
    resolved_by: status === 'active' ? null : 'admin-lama',
  };
}

/**
 * Fake DB: rpc('resolve_dispute_hold') meniru migrasi 20261114000035, plus from() untuk
 * wallets & disputed_payout_holds (dipakai WalletService.getWalletInfo).
 */
function createFakeDb(init: { holds: HoldRow[]; wallets: WalletRow[] }) {
  const holds = init.holds.map((h) => ({ ...h }));
  const wallets = init.wallets.map((w) => ({ ...w }));
  const ledger: LedgerRow[] = [];
  const rpcCalls: Array<{ fn: string; args: RpcArgs }> = [];
  const touchedTables: string[] = [];

  function resolveDisputeHold(args: RpcArgs): RpcResult {
    const hold = holds.find((h) => h.id === args.p_hold_id);
    if (!hold) return { data: null, error: { code: 'P0002', message: 'HOLD_NOT_FOUND' } };
    if (hold.status !== 'active') return { data: null, error: { code: 'P0001', message: 'HOLD_ALREADY_RESOLVED' } };

    const now = '2026-11-14T08:30:00.000Z';
    if (args.p_action === 'clear') {
      Object.assign(hold, { status: 'cleared', resolved_at: now, resolved_by: args.p_admin_id, resolution_note: args.p_note, deducted_amount_rupiah: 0 });
      return { data: { ...hold }, error: null };
    }
    if (args.p_action !== 'deduct') return { data: null, error: { code: '22023', message: 'INVALID_ACTION' } };

    let wallet = wallets.find((w) => w.user_id === hold.mitra_id);
    if (!wallet) {
      wallet = { user_id: hold.mitra_id, coin_balance: 0, available_rupiah: 0, pending_rupiah: 0, updated_at: now };
      wallets.push(wallet);
    }
    const target = hold.disputed_amount_rupiah;
    const deductAvail = Math.max(0, Math.min(wallet.available_rupiah, target));
    const deductPending = Math.max(0, Math.min(wallet.pending_rupiah, target - deductAvail));
    wallet.available_rupiah -= deductAvail;
    wallet.pending_rupiah -= deductPending;
    // Constraint CHECK (>= 0) pada wallets
    if (wallet.available_rupiah < 0 || wallet.pending_rupiah < 0) {
      return { data: null, error: { code: '23514', message: 'wallets_check violation' } };
    }
    const base = { user_id: hold.mitra_id, unit: 'rupiah', reason: 'dispute_deduct', ref_type: 'dispute_hold', ref_id: hold.id } as const;
    if (deductAvail > 0) ledger.push({ ...base, account: 'mitra_available', amount: -deductAvail });
    if (deductPending > 0) ledger.push({ ...base, account: 'mitra_pending', amount: -deductPending });

    Object.assign(hold, {
      status: 'deducted',
      resolved_at: now,
      resolved_by: args.p_admin_id,
      resolution_note: args.p_note,
      deducted_amount_rupiah: deductAvail + deductPending,
    });
    return { data: { ...hold }, error: null };
  }

  function query<T extends object>(rows: T[]) {
    let filtered = [...rows];
    const q = {
      eq(col: string, val: unknown) {
        filtered = filtered.filter((r) => (r as Record<string, unknown>)[col] === val);
        return q;
      },
      async maybeSingle() {
        return { data: filtered[0] ?? null, error: null };
      },
      then<R>(onfulfilled?: (v: { data: T[]; error: null }) => R) {
        return Promise.resolve({ data: filtered, error: null }).then(onfulfilled);
      },
    };
    return q;
  }

  const client = {
    rpc: async (fn: string, args: RpcArgs): Promise<RpcResult> => {
      rpcCalls.push({ fn, args });
      assert.strictEqual(fn, 'resolve_dispute_hold', 'Service wajib memanggil RPC resolve_dispute_hold');
      return resolveDisputeHold(args);
    },
    from: (table: string) => {
      touchedTables.push(table);
      if (table === 'wallets') return { select: () => query(wallets) };
      if (table === 'disputed_payout_holds') return { select: () => query(holds) };
      throw new Error(`Tabel tidak diharapkan: ${table}`);
    },
  };

  return { client: client as unknown as DbClient, holds, wallets, ledger, rpcCalls, touchedTables };
}

const wallet = (userId: string, available: number, pending: number): WalletRow => ({
  user_id: userId,
  coin_balance: 0,
  available_rupiah: available,
  pending_rupiah: pending,
  updated_at: '2026-11-13T00:00:00Z',
});


const { DisputedPayoutHoldService } = await import('../disputed-payout-hold.service');
const { WalletService, WalletHttpError } = await import('../wallet.service');

describe('Resolusi sengketa payout (T-223)', () => {
  const resolve = DisputedPayoutHoldService.resolveDisputedHold;

  it('Skenario 1: deduct memotong available_rupiah terlebih dahulu', async () => {
    const db = createFakeDb({ holds: [makeHold('h1', 'mitra-1', 100_000)], wallets: [wallet('mitra-1', 500_000, 200_000)] });
    const res = await resolve('h1', 'admin-1', 'deduct', 'Chargeback dimenangkan bank', { client: db.client });
    expect(db.rpcCalls[0].args).toStrictEqual({ p_hold_id: 'h1', p_admin_id: 'admin-1', p_action: 'deduct', p_note: 'Chargeback dimenangkan bank' });
    expect(res.status).toBe('deducted');
    expect(res.deducted_amount_rupiah).toBe(100_000);
    expect(res.resolution_note).toBe('Chargeback dimenangkan bank');
    expect(db.wallets[0].available_rupiah).toBe(400_000);
    expect(db.wallets[0].pending_rupiah).toBe(200_000);
    expect(db.ledger.map((l) => [l.account, l.amount, l.reason, l.ref_type, l.ref_id])).toStrictEqual([
      ['mitra_available', -100_000, 'dispute_deduct', 'dispute_hold', 'h1'],
    ]);
  });

  it('Skenario 2: deduct meluber memotong pending_rupiah', async () => {
    const db = createFakeDb({ holds: [makeHold('h2', 'mitra-2', 200_000)], wallets: [wallet('mitra-2', 50_000, 300_000)] });
    const res = await resolve('h2', 'admin-1', 'deduct', 'Refund disetujui', { client: db.client });
    expect(res.deducted_amount_rupiah).toBe(200_000);
    expect(db.wallets[0].available_rupiah).toBe(0);
    expect(db.wallets[0].pending_rupiah).toBe(150_000);
    expect(db.ledger.map((l) => [l.account, l.amount])).toStrictEqual([
      ['mitra_available', -50_000],
      ['mitra_pending', -150_000],
    ]);
  });

  it('Skenario 3: deduct parsial aman tanpa saldo negatif', async () => {
    const db = createFakeDb({ holds: [makeHold('h3', 'mitra-3', 100_000)], wallets: [wallet('mitra-3', 30_000, 0)] });
    const res = await resolve('h3', 'admin-1', 'deduct', 'Potong sebatas saldo', { client: db.client });
    expect(res.status).toBe('deducted');
    expect(res.deducted_amount_rupiah).toBe(30_000);
    expect(db.wallets[0].available_rupiah).toBe(0);
    expect(db.wallets[0].pending_rupiah).toBe(0);
    expect(db.ledger.map((l) => [l.account, l.amount])).toStrictEqual([['mitra_available', -30_000]]);
    assert(db.ledger.every((l) => l.account !== 'mitra_pending'), 'Pending nol tidak boleh menerbitkan ledger');
  });

  it('Skenario 4: clear tidak mengubah saldo dompet', async () => {
    const db = createFakeDb({ holds: [makeHold('h4', 'mitra-4', 250_000)], wallets: [wallet('mitra-4', 1_000_000, 0)] });
    const res = await resolve('h4', 'admin-1', 'clear', 'Mitra tidak bersalah', { client: db.client });
    expect(res.status).toBe('cleared');
    expect(res.deducted_amount_rupiah).toBe(0);
    expect(res.resolved_by).toBe('admin-1');
    expect(db.wallets[0].available_rupiah).toBe(1_000_000);
    expect(db.wallets[0].pending_rupiah).toBe(0);
    expect(db.ledger.length).toBe(0);
    expect(db.touchedTables.length, 'Resolusi wajib lewat RPC, bukan query tabel langsung').toBe(0);
  });

  it('Skenario 5: resolusi berulang ditolak 409 HOLD_ALREADY_RESOLVED', async () => {
    const db = createFakeDb({ holds: [makeHold('h5', 'mitra-5', 100_000)], wallets: [wallet('mitra-5', 500_000, 0)] });
    await resolve('h5', 'admin-1', 'deduct', 'Eksekusi pertama', { client: db.client });
    for (const action of ['deduct', 'clear'] as const) {
      await expect((() => resolve('h5', 'admin-2', action, 'Eksekusi ulang', { client: db.client }))()).rejects.toSatisfy((err: unknown) => {
          assert(err instanceof WalletHttpError);
          expect(err.status).toBe(409);
          expect(err.code).toBe('HOLD_ALREADY_RESOLVED');
          return true;
        });
    }
    expect(db.wallets[0].available_rupiah, 'Saldo hanya terpotong sekali').toBe(400_000);
    expect(db.ledger.length).toBe(1);
    await expect((() => resolve('tidak-ada', 'admin-1', 'clear', 'x', { client: db.client }))()).rejects.toSatisfy((err: unknown) => err instanceof WalletHttpError && err.status === 404 && err.code === 'HOLD_NOT_FOUND');
  });

  it('Skenario 6: held_rupiah tepat untuk mitra bersengketa vs bersih', async () => {
    const db = createFakeDb({
      holds: [
        makeHold('a1', 'mitra-sengketa', 100_000),
        makeHold('a2', 'mitra-sengketa', 50_000),
        makeHold('c1', 'mitra-sengketa', 70_000, 'cleared'),
        makeHold('d1', 'mitra-sengketa', 30_000, 'deducted'),
        makeHold('p1', 'pasien-1', 99_000),
      ],
      wallets: [wallet('mitra-sengketa', 400_000, 150_000), wallet('mitra-bersih', 200_000, 0), wallet('pasien-1', 0, 0)],
    });
    const disputed = await WalletService.getWalletInfo('mitra-sengketa', 'psikolog', db.client);
    expect(disputed.held_rupiah, 'Hanya hold active yang dihitung').toBe(150_000);
    expect(disputed.available_rupiah).toBe(400_000);
    const clean = await WalletService.getWalletInfo('mitra-bersih', 'relawan', db.client);
    expect(clean.held_rupiah).toBe(0);
    const patient = await WalletService.getWalletInfo('pasien-1', 'pasien', db.client);
    expect(patient.held_rupiah, 'Non-mitra selalu 0').toBe(0);
  });
});
