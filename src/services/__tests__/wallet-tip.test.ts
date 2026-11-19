import { existsSync, readFileSync } from 'node:fs';
import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ supabaseAdmin: db }));
vi.mock('@/lib/auth/session', () => ({
  getSessionUser: async () => ({ user: { id: 'patient-test', role: 'pasien', status: 'active' } }),
  fail: (status: number, error: string, message: string) => NextResponse.json({ success: false, error, message }, { status }),
}));
const { POST } = await import('@/app/api/bookings/[id]/tip/route');
const bookingId = '00000000-0000-4000-8000-000000000001';

// ponytail: aritmetika RPC dimodelkan di memori; constraint/ledger SQL tetap tugas dry-run PostgreSQL.
function tipWallet(balance: number) {
  const state = { coins: balance, pending: 0, platform: 0, ledger: [] as number[] };
  db.rpc.mockImplementation(async (fn: string, args: { p_coins: number }) => {
    expect(fn).toBe('session_tip');
    if (args.p_coins > state.coins) return { error: { message: 'COIN_BALANCE_INSUFFICIENT' } };
    const gross = args.p_coins * 10_000;
    const share = Math.floor(gross * 8_000 / 10_000);
    state.coins -= args.p_coins;
    state.pending += share;
    state.platform += gross - share;
    state.ledger.push(-args.p_coins);
    return { error: null };
  });
  return state;
}
const sendTip = (coins: number) => POST(new Request('http://localhost/api/bookings/' + bookingId + '/tip', {
  method: 'POST', body: JSON.stringify({ coins }), headers: { 'Content-Type': 'application/json' },
}), { params: Promise.resolve({ id: bookingId }) });

beforeEach(() => { db.rpc.mockReset(); });

describe('Tip konseling — batas saldo pasien', () => {
  it('tip melebihi saldo ditolak 402 tanpa mutasi atau ledger', async () => {
    const state = tipWallet(10);
    const res = await sendTip(11);
    expect(res.status).toBe(402);
    expect(await res.json()).toMatchObject({ success: false, error: 'INSUFFICIENT_COINS' });
    expect(state).toEqual({ coins: 10, pending: 0, platform: 0, ledger: [] });
    expect(db.rpc).toHaveBeenCalledWith('session_tip', expect.objectContaining({ p_booking_id: bookingId, p_patient_id: 'patient-test', p_coins: 11 }));
  });

  it('tip tepat saldo diterima; saldo habis, hasil 80% dan 20% tetap konservatif', async () => {
    const state = tipWallet(3);
    const res = await sendTip(3);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, data: { booking_id: bookingId, coins: 3 } });
    expect(state).toEqual({ coins: 0, pending: 24_000, platform: 6_000, ledger: [-3] });
  });

  it.each([0, -1, 1.5])('tip invalid %s ditolak sebelum RPC', async (coins) => {
    expect((await sendTip(coins)).status).toBe(422);
    expect(db.rpc).not.toHaveBeenCalled();
  });
});

describe('Bagi hasil 80% — pembulatan ke bawah', () => {
  // Produksi menghitung di PostgreSQL, bukan TS. Ikat model ke rumus SQL yang dipakai tip_create.
  // Folder supabase/ tidak dipublikasikan ke GitHub; tes ini hanya jalan bila migrasi tersedia lokal.
  const migration = 'supabase/migrations/20261014000002_wallet_ledger.sql';
  it.skipIf(!existsSync(migration))('SQL tip_create memakai floor pada nilai gross * bps, bukan pembulatan terdekat', () => {
    const sql = readFileSync(migration, 'utf8');
    const tipSql = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.tip_create('));
    expect(tipSql).toContain('v_mitra := pg_catalog.floor((v_gross::NUMERIC * v_bps) / 10000.0)::BIGINT;');
  });

  it.each([[1, 0], [2, 1], [3, 2], [101, 80], [10_001, 8_000], [30_000, 24_000]])(
    'gross %i menghasilkan bagian mitra %i tanpa pecahan', (gross, expected) => {
      const share = Math.floor(gross * 8_000 / 10_000);
      expect(share).toBe(expected);
      expect(Number.isInteger(share)).toBe(true);
      expect(share + (gross - share)).toBe(gross);
    },
  );
});
