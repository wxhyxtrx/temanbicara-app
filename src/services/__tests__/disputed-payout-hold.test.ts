// T-234 (PRD-053): pemetaan error RPC resolve_dispute_hold dan jalur aksi clear vs deduct.
import { catchError, type RpcResult } from '@/test/env';
import { describe, expect, it } from 'vitest';
import type { supabaseAdmin } from '@/lib/supabase/client';

const { DisputedPayoutHoldService } = await import('../disputed-payout-hold.service');
const { WalletHttpError } = await import('../wallet.service');

const resolve = DisputedPayoutHoldService.resolveDisputedHold;

function rpcClient(result: RpcResult) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return result;
    },
    from: (table: string) => {
      throw new Error(`Resolusi wajib lewat RPC, tabel ${table} tidak boleh disentuh`);
    },
  };
  return { client: client as unknown as typeof supabaseAdmin, calls };
}

const holdRow = (status: string, deducted: number) => ({
  id: 'hold-1',
  topup_order_id: 'topup-1',
  mitra_id: 'mitra-1',
  source_type: 'session',
  source_id: 'booking-1',
  disputed_amount_rupiah: '150000',
  deducted_amount_rupiah: deducted,
  status,
  reason: 'Chargeback',
  resolution_note: 'catatan admin',
  created_at: '2026-11-13T01:00:00Z',
  resolved_at: '2026-11-14T02:00:00Z',
  resolved_by: 'admin-1',
});

describe('resolveDisputedHold — pemetaan error RPC', () => {
  it.each([
    [{ code: 'P0001', message: 'HOLD_ALREADY_RESOLVED' }, 409, 'HOLD_ALREADY_RESOLVED'],
    [{ code: 'P0001', message: 'apa pun' }, 409, 'HOLD_ALREADY_RESOLVED'],
    [{ code: 'XX000', message: 'raise: HOLD_ALREADY_RESOLVED' }, 409, 'HOLD_ALREADY_RESOLVED'],
    [{ code: 'P0002', message: 'HOLD_NOT_FOUND' }, 404, 'HOLD_NOT_FOUND'],
    [{ code: 'P0002', message: 'apa pun' }, 404, 'HOLD_NOT_FOUND'],
    [{ code: 'XX000', message: 'raise: HOLD_NOT_FOUND' }, 404, 'HOLD_NOT_FOUND'],
    [{ code: '22023', message: 'INVALID_ACTION' }, 400, 'INVALID_ACTION'],
    [{ code: 'P0003', message: 'WALLET_NOT_FOUND' }, 404, 'WALLET_NOT_FOUND'],
    [{ code: '23514', message: 'wallets_check violation' }, 500, 'RPC_ERROR'],
  ])('error %j dipetakan ke %i %s', async (rpcErr, status, code) => {
    const { client } = rpcClient({ data: null, error: rpcErr });
    const err = await catchError(() => resolve('hold-1', 'admin-1', 'deduct', 'catatan', { client }));
    expect(err).toBeInstanceOf(WalletHttpError);
    expect(err).toMatchObject({ status, code });
  });

  it('RPC sukses tanpa data dipetakan 500 DB_ERROR', async () => {
    const { client } = rpcClient({ data: null, error: null });
    const err = await catchError(() => resolve('hold-1', 'admin-1', 'clear', 'catatan', { client }));
    expect(err).toMatchObject({ status: 500, code: 'DB_ERROR' });
  });
});

describe('resolveDisputedHold — aksi clear vs deduct', () => {
  it('clear: argumen RPC diteruskan apa adanya, hasil cleared tanpa potongan', async () => {
    const { client, calls } = rpcClient({ data: holdRow('cleared', 0), error: null });
    const res = await resolve('hold-1', 'admin-1', 'clear', 'Mitra tidak bersalah', { client });
    expect(calls).toStrictEqual([
      { fn: 'resolve_dispute_hold', args: { p_hold_id: 'hold-1', p_admin_id: 'admin-1', p_action: 'clear', p_note: 'Mitra tidak bersalah' } },
    ]);
    expect(res).toMatchObject({ status: 'cleared', deducted_amount_rupiah: 0, disputed_amount_rupiah: 150_000 });
  });

  it('deduct: hasil deducted dengan nominal potongan bertipe number', async () => {
    const { client, calls } = rpcClient({ data: holdRow('deducted', '120000' as unknown as number), error: null });
    const res = await resolve('hold-1', 'admin-1', 'deduct', 'Bank menang', { client });
    expect(calls[0].args.p_action).toBe('deduct');
    expect(res.status).toBe('deducted');
    expect(res.deducted_amount_rupiah).toBe(120_000);
    expect(typeof res.disputed_amount_rupiah).toBe('number');
  });
});
