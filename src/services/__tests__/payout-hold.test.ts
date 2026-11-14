// Pastikan environment fallback terpasang sebelum modul supabase client di-import
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
import type { UserEntity } from '@/types/database';
import type { WalletHttpError as WalletHttpErrorType } from '@/services/wallet.service';
import type { supabaseAdmin } from '@/lib/supabase/client';

type SupabaseAdminType = typeof supabaseAdmin;

interface MockState {
  settings?: Record<string, unknown>;
  wallets?: Array<{ user_id: string; available_rupiah: number }>;
  holds?: Array<{
    id?: string;
    mitra_id: string;
    disputed_amount_rupiah: number;
    status: string;
  }>;
  payouts?: Array<{
    id: string;
    mitra_id: string;
    amount_rupiah: number;
    fee_rupiah: number;
    bank_name: string;
    account_number: string;
    bank_account_name: string;
    status: string;
    requested_at: string;
    decided_at: string | null;
    decided_by: string | null;
  }>;
  users?: Array<{ id: string; role: string }>;
  psikologProfiles?: Array<{ user_id: string; nama_lengkap_gelar: string }>;
  relawanProfiles?: Array<{ user_id: string; nama_lengkap: string }>;
}

function createMockQuery(initialData: any[], totalCount?: number) {
  let data = [...initialData];
  const queryObj = {
    eq(col: string, val: any) {
      data = data.filter((item) => item[col] === val);
      return queryObj;
    },
    in(col: string, vals: any[]) {
      data = data.filter((item) => vals.includes(item[col]));
      return queryObj;
    },
    order(_col: string, _opts?: any) {
      return queryObj;
    },
    range(from: number, to: number) {
      data = data.slice(from, to + 1);
      return queryObj;
    },
    limit(n: number) {
      data = data.slice(0, n);
      return queryObj;
    },
    async maybeSingle() {
      return { data: data[0] ?? null, error: null };
    },
    then(onfulfilled?: (val: any) => any, onrejected?: (err: any) => any) {
      const res = { data, error: null, count: totalCount ?? initialData.length };
      return Promise.resolve(res).then(onfulfilled, onrejected);
    },
  };
  return queryObj;
}

function createMockDbClient(state: MockState) {
  const rpcCalls: Array<{ fn: string; args: unknown }> = [];

  const mockDb = {
    from: (table: string) => {
      if (table === 'system_settings') {
        const settingVal = state.settings ?? {
          min_rupiah: 500000,
          max_rupiah: 10000000,
          fee_rupiah: 6500,
        };
        return {
          select: () => ({
            eq: (_col: string, _val: string) => ({
              maybeSingle: async () => ({
                data: { value: settingVal },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'wallets') {
        return {
          select: () => createMockQuery(state.wallets ?? []),
        };
      }

      if (table === 'disputed_payout_holds') {
        return {
          select: () => createMockQuery(state.holds ?? []),
        };
      }

      if (table === 'payout_requests') {
        return {
          select: (_cols: string, opts?: { count?: string }) => {
            const list = state.payouts ?? [];
            return createMockQuery(list, list.length);
          },
        };
      }

      if (table === 'users') {
        return {
          select: () => createMockQuery(state.users ?? []),
        };
      }

      if (table === 'psikolog_profiles') {
        return {
          select: () => createMockQuery(state.psikologProfiles ?? []),
        };
      }

      if (table === 'relawan_profiles') {
        return {
          select: () => createMockQuery(state.relawanProfiles ?? []),
        };
      }

      throw new Error(`Tabel tidak dikenal di mockDb: ${table}`);
    },
    rpc: async (fn: string, args: unknown) => {
      rpcCalls.push({ fn, args });
      return { data: true, error: null };
    },
  };

  return {
    client: mockDb as unknown as SupabaseAdminType,
    getRpcCalls: () => [...rpcCalls],
  };
}

const mockMitraPsikolog: UserEntity = {
  id: 'mitra-psikolog-001',
  email: 'psikolog1@temanbicara.test',
  no_wa: '08123456789',
  google_id: null,
  role: 'psikolog',
  status: 'active',
  avatar_url: null,
  is_email_verified: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockGetProfile = async () => ({
  nama_lengkap_gelar: 'Dr. Jane Doe, M.Psi.',
});


const { WalletService, WalletHttpError } = await import('@/services/wallet.service');
const { WalletPayoutService } = await import('@/services/wallet-payout.service');

describe('Payout hold guardrail (T-216)', () => {
  it('UJI 1 LULUS: requestPayout menolak 422 PAYOUT_HELD_FOR_VERIFICATION dengan pesan informatif', async () => {
    // Saldo 1.000.000, hold sengketa 400.000 -> withdrawable = 600.000
    // Pengajuan: 600.000 + fee 6.500 = 606.500 > 600.000
    const mock = createMockDbClient({
      wallets: [{ user_id: mockMitraPsikolog.id, available_rupiah: 1000000 }],
      holds: [
        {
          mitra_id: mockMitraPsikolog.id,
          disputed_amount_rupiah: 400000,
          status: 'active',
        },
      ],
    });

    let thrownError: WalletHttpErrorType | null = null;
    try {
      await WalletPayoutService.requestPayout(
        mockMitraPsikolog,
        {
          amount_rupiah: 600000,
          bank_name: 'BCA',
          account_number: '1234567890',
          bank_account_name: 'Jane Doe',
        },
        { client: mock.client, getProfile: mockGetProfile }
      );
    } catch (err) {
      if (err instanceof WalletHttpError) {
        thrownError = err;
      } else {
        throw err;
      }
    }

    assert(thrownError !== null, 'requestPayout harus melempar WalletHttpError');
    expect(thrownError.status, 'Status HTTP harus 422').toBe(422);
    expect(thrownError.code, 'Kode error harus PAYOUT_HELD_FOR_VERIFICATION').toBe('PAYOUT_HELD_FOR_VERIFICATION');
    assert(
      thrownError.message.includes('Sebagian saldo Anda'),
      'Pesan harus dimulai dengan "Sebagian saldo Anda"'
    );
    assert(
      thrownError.message.includes('Rp 400.000'),
      'Pesan harus memuat nominal hold Rp 400.000'
    );
    assert(
      thrownError.message.includes('Rp 593.500'),
      'Pesan harus memuat batas pencairan Rp 593.500 (600.000 - 6.500)'
    );
    expect(mock.getRpcCalls().length, 'RPC payout_request tidak boleh dipanggil saat ditolak 422').toBe(0);
  });

  it('UJI 2 LULUS: requestPayout berhasil jika total penarikan berada dalam batas withdrawable', async () => {
    // Saldo 1.000.000, hold sengketa 400.000 -> withdrawable = 600.000
    // Pengajuan: 500.000 + fee 6.500 = 506.500 <= 600.000
    const mock = createMockDbClient({
      wallets: [{ user_id: mockMitraPsikolog.id, available_rupiah: 1000000 }],
      holds: [
        {
          mitra_id: mockMitraPsikolog.id,
          disputed_amount_rupiah: 400000,
          status: 'active',
        },
      ],
    });

    const result = await WalletPayoutService.requestPayout(
      mockMitraPsikolog,
      {
        amount_rupiah: 500000,
        bank_name: 'BCA',
        account_number: '1234567890',
        bank_account_name: 'Jane Doe',
      },
      { client: mock.client, getProfile: mockGetProfile }
    );

    expect(result.amount_rupiah).toBe(500000);
    expect(result.fee_rupiah).toBe(6500);
    expect(result.total_deducted).toBe(506500);
    expect(result.status).toBe('requested');
    expect(mock.getRpcCalls().length, 'RPC payout_request harus dipanggil').toBe(1);
    expect(mock.getRpcCalls()[0].fn).toBe('payout_request');
  });

  it('UJI 3 LULUS: Mitra tanpa hold aktif dapat mengajukan penarikan normal', async () => {
    const mock = createMockDbClient({
      wallets: [{ user_id: mockMitraPsikolog.id, available_rupiah: 1000000 }],
      holds: [], // Tidak ada hold
    });

    const result = await WalletPayoutService.requestPayout(
      mockMitraPsikolog,
      {
        amount_rupiah: 600000,
        bank_name: 'BCA',
        account_number: '1234567890',
        bank_account_name: 'Jane Doe',
      },
      { client: mock.client, getProfile: mockGetProfile }
    );

    expect(result.amount_rupiah).toBe(600000);
    expect(result.status).toBe('requested');
    expect(mock.getRpcCalls().length).toBe(1);
  });

  it('UJI 4 LULUS: getAdminPayouts memperkaya item dengan has_dispute_hold & dispute_hold_amount', async () => {
    const mitraAId = 'mitra-a-uuid';
    const mitraBId = 'mitra-b-uuid';

    const mock = createMockDbClient({
      payouts: [
        {
          id: 'payout-1',
          mitra_id: mitraAId,
          amount_rupiah: 750000,
          fee_rupiah: 6500,
          bank_name: 'BCA',
          account_number: '111111',
          bank_account_name: 'Mitra A',
          status: 'requested',
          requested_at: '2026-11-13T10:00:00Z',
          decided_at: null,
          decided_by: null,
        },
        {
          id: 'payout-2',
          mitra_id: mitraBId,
          amount_rupiah: 1200000,
          fee_rupiah: 6500,
          bank_name: 'Mandiri',
          account_number: '222222',
          bank_account_name: 'Mitra B',
          status: 'requested',
          requested_at: '2026-11-13T09:00:00Z',
          decided_at: null,
          decided_by: null,
        },
      ],
      holds: [
        {
          mitra_id: mitraAId,
          disputed_amount_rupiah: 160000,
          status: 'active',
        },
        {
          mitra_id: mitraAId,
          disputed_amount_rupiah: 80000,
          status: 'active',
        },
        {
          mitra_id: mitraBId,
          disputed_amount_rupiah: 50000,
          status: 'cleared', // status cleared bukan active
        },
      ],
      users: [
        { id: mitraAId, role: 'psikolog' },
        { id: mitraBId, role: 'relawan' },
      ],
      psikologProfiles: [{ user_id: mitraAId, nama_lengkap_gelar: 'Psikolog A, M.Psi.' }],
      relawanProfiles: [{ user_id: mitraBId, nama_lengkap: 'Relawan B' }],
    });

    const result = await WalletPayoutService.getAdminPayouts(
      { page: 1, limit: 10 },
      mock.client
    );

    expect(result.items.length).toBe(2);

    const itemA = result.items.find((i) => i.id === 'payout-1')!;
    expect(itemA.has_dispute_hold, 'Mitra A harus memiliki has_dispute_hold: true').toBe(true);
    expect(itemA.dispute_hold_amount, 'Total hold Mitra A harus 240.000 (160k + 80k)').toBe(240000);
    expect(itemA.mitra_name).toBe('Psikolog A, M.Psi.');

    const itemB = result.items.find((i) => i.id === 'payout-2')!;
    expect(itemB.has_dispute_hold, 'Mitra B tidak memiliki hold aktif, has_dispute_hold harus false').toBe(false);
    expect(itemB.dispute_hold_amount, 'dispute_hold_amount Mitra B harus 0').toBe(0);
    expect(itemB.mitra_name).toBe('Relawan B');
  });

  it('UJI 5 LULUS: markPayoutPaid menolak 409 PAYOUT_HAS_ACTIVE_DISPUTE jika ada hold sengketa aktif', async () => {
    const mitraWithHoldId = 'mitra-hold-active-uuid';
    const payoutId = 'payout-held-uuid';

    const mock = createMockDbClient({
      payouts: [
        {
          id: payoutId,
          mitra_id: mitraWithHoldId,
          amount_rupiah: 800000,
          fee_rupiah: 6500,
          bank_name: 'BCA',
          account_number: '999888',
          bank_account_name: 'Mitra Sengketa',
          status: 'requested',
          requested_at: '2026-11-13T10:00:00Z',
          decided_at: null,
          decided_by: null,
        },
      ],
      holds: [
        {
          id: 'hold-1',
          mitra_id: mitraWithHoldId,
          disputed_amount_rupiah: 200000,
          status: 'active',
        },
      ],
    });

    let thrownError: WalletHttpErrorType | null = null;
    try {
      await WalletPayoutService.markPayoutPaid(payoutId, 'admin-uuid', mock.client);
    } catch (err) {
      if (err instanceof WalletHttpError) {
        thrownError = err;
      } else {
        throw err;
      }
    }

    assert(thrownError !== null, 'markPayoutPaid harus melempar WalletHttpError');
    expect(thrownError.status, 'Status HTTP harus 409').toBe(409);
    expect(thrownError.code, 'Kode error harus PAYOUT_HAS_ACTIVE_DISPUTE').toBe('PAYOUT_HAS_ACTIVE_DISPUTE');
    assert(
      thrownError.message.includes('mitra memiliki sengketa penahanan payout aktif'),
      'Pesan harus menjelaskan penolakan karena sengketa aktif'
    );
    expect(mock.getRpcCalls().length, 'RPC payout_mark_paid tidak boleh dipanggil saat ditolak').toBe(0);
  });

  it('UJI 6 LULUS: markPayoutPaid berhasil menandai paid jika mitra tidak memiliki sengketa aktif', async () => {
    const cleanMitraId = 'clean-mitra-uuid';
    const payoutId = 'clean-payout-uuid';

    const mock = createMockDbClient({
      payouts: [
        {
          id: payoutId,
          mitra_id: cleanMitraId,
          amount_rupiah: 800000,
          fee_rupiah: 6500,
          bank_name: 'BCA',
          account_number: '999888',
          bank_account_name: 'Mitra Bersih',
          status: 'requested',
          requested_at: '2026-11-13T10:00:00Z',
          decided_at: null,
          decided_by: null,
        },
      ],
      holds: [],
    });

    const result = await WalletPayoutService.markPayoutPaid(payoutId, 'admin-uuid', mock.client);
    expect(result.payout_id).toBe(payoutId);
    expect(result.status).toBe('paid');
    expect(mock.getRpcCalls().length).toBe(1);
    expect(mock.getRpcCalls()[0].fn).toBe('payout_mark_paid');
  });

  it('UJI 7 LULUS: rejectPayout tetap berjalan normal untuk membatalkan payout mitra ber-hold', async () => {
    const mitraWithHoldId = 'mitra-hold-active-uuid';
    const payoutId = 'payout-to-reject-uuid';

    const mock = createMockDbClient({
      payouts: [
        {
          id: payoutId,
          mitra_id: mitraWithHoldId,
          amount_rupiah: 800000,
          fee_rupiah: 6500,
          bank_name: 'BCA',
          account_number: '999888',
          bank_account_name: 'Mitra Sengketa',
          status: 'requested',
          requested_at: '2026-11-13T10:00:00Z',
          decided_at: null,
          decided_by: null,
        },
      ],
      holds: [
        {
          mitra_id: mitraWithHoldId,
          disputed_amount_rupiah: 200000,
          status: 'active',
        },
      ],
    });

    const result = await WalletPayoutService.rejectPayout(payoutId, 'admin-uuid', mock.client);
    expect(result.payout_id).toBe(payoutId);
    expect(result.status).toBe('rejected');
    expect(mock.getRpcCalls().length).toBe(1);
    expect(mock.getRpcCalls()[0].fn).toBe('payout_reject');
  });

  it('UJI 8 LULUS: Validasi integritas status payout (404 & 409) berfungsi akurat', async () => {
    const mock = createMockDbClient({
      payouts: [
        {
          id: 'payout-already-paid',
          mitra_id: 'mitra-uuid',
          amount_rupiah: 500000,
          fee_rupiah: 6500,
          bank_name: 'BCA',
          account_number: '123',
          bank_account_name: 'Mitra',
          status: 'paid', // bukan requested
          requested_at: '2026-11-13T10:00:00Z',
          decided_at: '2026-11-13T10:05:00Z',
          decided_by: 'admin-uuid',
        },
      ],
    });

    // Test 404
    await expect((async () => {
        await WalletPayoutService.markPayoutPaid('non-existent-uuid', 'admin-uuid', mock.client);
      })(), 'Harus melempar 404 PAYOUT_NOT_FOUND untuk id fiktif').rejects.toSatisfy((err: any) => err instanceof WalletHttpError && err.status === 404 && err.code === 'PAYOUT_NOT_FOUND');

    // Test 409 status bukan requested
    await expect((async () => {
        await WalletPayoutService.markPayoutPaid('payout-already-paid', 'admin-uuid', mock.client);
      })(), 'Harus melempar 409 PAYOUT_NOT_PAYABLE jika payout sudah berstatus paid').rejects.toSatisfy((err: any) => err instanceof WalletHttpError && err.status === 409 && err.code === 'PAYOUT_NOT_PAYABLE');
  });
});
