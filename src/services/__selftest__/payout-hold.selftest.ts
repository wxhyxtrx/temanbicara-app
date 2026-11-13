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

import assert from 'node:assert/strict';
import type { UserEntity } from '@/types/database';
import type { WalletHttpError } from '@/services/wallet.service';
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

export async function runSelfTests(): Promise<boolean> {
  console.log('[SELFTEST] Memulai pengujian guardrail & proteksi payout hold (T-216)...');

  const { WalletService, WalletHttpError } = await import('@/services/wallet.service');
  const { WalletPayoutService } = await import('@/services/wallet-payout.service');

  // ========================================================
  // UJI 1: requestPayout menolak dengan 422 PAYOUT_HELD_FOR_VERIFICATION saat saldo bersih tidak cukup
  // ========================================================
  {
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

    let thrownError: WalletHttpError | null = null;
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
    assert.strictEqual(thrownError.status, 422, 'Status HTTP harus 422');
    assert.strictEqual(thrownError.code, 'PAYOUT_HELD_FOR_VERIFICATION', 'Kode error harus PAYOUT_HELD_FOR_VERIFICATION');
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
    assert.strictEqual(mock.getRpcCalls().length, 0, 'RPC payout_request tidak boleh dipanggil saat ditolak 422');
    console.log('✓ UJI 1 LULUS: requestPayout menolak 422 PAYOUT_HELD_FOR_VERIFICATION dengan pesan informatif');
  }

  // ========================================================
  // UJI 2: requestPayout berhasil jika penarikan <= withdrawable meski ada hold sengketa
  // ========================================================
  {
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

    assert.strictEqual(result.amount_rupiah, 500000);
    assert.strictEqual(result.fee_rupiah, 6500);
    assert.strictEqual(result.total_deducted, 506500);
    assert.strictEqual(result.status, 'requested');
    assert.strictEqual(mock.getRpcCalls().length, 1, 'RPC payout_request harus dipanggil');
    assert.strictEqual(mock.getRpcCalls()[0].fn, 'payout_request');
    console.log('✓ UJI 2 LULUS: requestPayout berhasil jika total penarikan berada dalam batas withdrawable');
  }

  // ========================================================
  // UJI 3: requestPayout berjalan normal jika mitra tidak memiliki hold sengketa aktif
  // ========================================================
  {
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

    assert.strictEqual(result.amount_rupiah, 600000);
    assert.strictEqual(result.status, 'requested');
    assert.strictEqual(mock.getRpcCalls().length, 1);
    console.log('✓ UJI 3 LULUS: Mitra tanpa hold aktif dapat mengajukan penarikan normal');
  }

  // ========================================================
  // UJI 4: getAdminPayouts memperkaya item dengan has_dispute_hold dan dispute_hold_amount
  // ========================================================
  {
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

    assert.strictEqual(result.items.length, 2);

    const itemA = result.items.find((i) => i.id === 'payout-1')!;
    assert.strictEqual(itemA.has_dispute_hold, true, 'Mitra A harus memiliki has_dispute_hold: true');
    assert.strictEqual(itemA.dispute_hold_amount, 240000, 'Total hold Mitra A harus 240.000 (160k + 80k)');
    assert.strictEqual(itemA.mitra_name, 'Psikolog A, M.Psi.');

    const itemB = result.items.find((i) => i.id === 'payout-2')!;
    assert.strictEqual(itemB.has_dispute_hold, false, 'Mitra B tidak memiliki hold aktif, has_dispute_hold harus false');
    assert.strictEqual(itemB.dispute_hold_amount, 0, 'dispute_hold_amount Mitra B harus 0');
    assert.strictEqual(itemB.mitra_name, 'Relawan B');

    console.log('✓ UJI 4 LULUS: getAdminPayouts memperkaya item dengan has_dispute_hold & dispute_hold_amount');
  }

  // ========================================================
  // UJI 5: markPayoutPaid menolak dengan 409 PAYOUT_HAS_ACTIVE_DISPUTE jika mitra memiliki hold aktif
  // ========================================================
  {
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

    let thrownError: WalletHttpError | null = null;
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
    assert.strictEqual(thrownError.status, 409, 'Status HTTP harus 409');
    assert.strictEqual(thrownError.code, 'PAYOUT_HAS_ACTIVE_DISPUTE', 'Kode error harus PAYOUT_HAS_ACTIVE_DISPUTE');
    assert(
      thrownError.message.includes('mitra memiliki sengketa penahanan payout aktif'),
      'Pesan harus menjelaskan penolakan karena sengketa aktif'
    );
    assert.strictEqual(mock.getRpcCalls().length, 0, 'RPC payout_mark_paid tidak boleh dipanggil saat ditolak');
    console.log('✓ UJI 5 LULUS: markPayoutPaid menolak 409 PAYOUT_HAS_ACTIVE_DISPUTE jika ada hold sengketa aktif');
  }

  // ========================================================
  // UJI 6: markPayoutPaid sukses jika mitra tidak memiliki hold aktif
  // ========================================================
  {
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
    assert.strictEqual(result.payout_id, payoutId);
    assert.strictEqual(result.status, 'paid');
    assert.strictEqual(mock.getRpcCalls().length, 1);
    assert.strictEqual(mock.getRpcCalls()[0].fn, 'payout_mark_paid');
    console.log('✓ UJI 6 LULUS: markPayoutPaid berhasil menandai paid jika mitra tidak memiliki sengketa aktif');
  }

  // ========================================================
  // UJI 7: rejectPayout tetap berjalan normal meski mitra memiliki hold sengketa aktif
  // ========================================================
  {
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
    assert.strictEqual(result.payout_id, payoutId);
    assert.strictEqual(result.status, 'rejected');
    assert.strictEqual(mock.getRpcCalls().length, 1);
    assert.strictEqual(mock.getRpcCalls()[0].fn, 'payout_reject');
    console.log('✓ UJI 7 LULUS: rejectPayout tetap berjalan normal untuk membatalkan payout mitra ber-hold');
  }

  // ========================================================
  // UJI 8: markPayoutPaid validasi status payout (404 jika tidak ditemukan, 409 jika bukan requested)
  // ========================================================
  {
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
    await assert.rejects(
      async () => {
        await WalletPayoutService.markPayoutPaid('non-existent-uuid', 'admin-uuid', mock.client);
      },
      (err: any) => err instanceof WalletHttpError && err.status === 404 && err.code === 'PAYOUT_NOT_FOUND',
      'Harus melempar 404 PAYOUT_NOT_FOUND untuk id fiktif'
    );

    // Test 409 status bukan requested
    await assert.rejects(
      async () => {
        await WalletPayoutService.markPayoutPaid('payout-already-paid', 'admin-uuid', mock.client);
      },
      (err: any) => err instanceof WalletHttpError && err.status === 409 && err.code === 'PAYOUT_NOT_PAYABLE',
      'Harus melempar 409 PAYOUT_NOT_PAYABLE jika payout sudah berstatus paid'
    );
    console.log('✓ UJI 8 LULUS: Validasi integritas status payout (404 & 409) berfungsi akurat');
  }

  console.log('[SELFTEST] SEMUA PENGUJIAN T-216 LULUS DENGAN SUKSES.');
  return true;
}

// Jalankan otomatis jika dieksekusi via tsx / node
if (process.argv[1]?.includes('payout-hold.selftest')) {
  runSelfTests()
    .then((ok) => {
      if (!ok) process.exit(1);
    })
    .catch((err) => {
      console.error('Self-test fatal error:', err);
      process.exit(1);
    });
}
