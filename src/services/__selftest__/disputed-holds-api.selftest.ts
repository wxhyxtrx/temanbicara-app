// Environment fallback sebelum modul client di-import
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
import type { UserRole, AccountStatus } from '@/types/database';
import type { DisputedPayoutHoldEntity } from '@/types/wallet';
import type { supabaseAdmin } from '@/lib/supabase/client';

type DbClient = typeof supabaseAdmin;

interface MockHoldRow {
  id: string;
  topup_order_id: string;
  mitra_id: string;
  source_type: 'session' | 'extension' | 'tip';
  source_id: string;
  disputed_amount_rupiah: number;
  status: string;
  reason: string;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

function createMockDb(initialHolds: MockHoldRow[]) {
  const holds: MockHoldRow[] = initialHolds.map((h) => ({ ...h }));
  const touchedTables: string[] = [];

  const client = {
    from: (table: string) => {
      touchedTables.push(table);

      if (table !== 'disputed_payout_holds') {
        throw new Error(`Tabel tidak diharapkan disentuh oleh DisputedPayoutHoldService: ${table}`);
      }

      return {
        select: (_cols?: string, opts?: { count?: string }) => {
          let filtered = [...holds];
          const query = {
            eq: (col: string, val: unknown) => {
              filtered = filtered.filter((row: any) => row[col] === val);
              return query;
            },
            order: (col: string, orderOpts?: { ascending?: boolean }) => {
              const asc = orderOpts?.ascending ?? true;
              filtered.sort((a: any, b: any) => {
                if (a[col] < b[col]) return asc ? -1 : 1;
                if (a[col] > b[col]) return asc ? 1 : -1;
                return 0;
              });
              return query;
            },
            range: (from: number, to: number) => {
              const paged = filtered.slice(from, to + 1);
              return {
                then: (onfulfilled?: (val: any) => any, onrejected?: (err: any) => any) => {
                  return Promise.resolve({
                    data: paged,
                    count: opts?.count === 'exact' ? filtered.length : null,
                    error: null,
                  }).then(onfulfilled, onrejected);
                },
              };
            },
            maybeSingle: async () => {
              return { data: filtered[0] ?? null, error: null };
            },
            single: async () => {
              if (filtered.length === 0) return { data: null, error: { message: 'Row not found' } };
              return { data: filtered[0], error: null };
            },
          };
          return query;
        },
        update: (values: Partial<MockHoldRow>) => {
          const conditions: Array<{ col: string; val: unknown }> = [];
          const query = {
            eq: (col: string, val: unknown) => {
              conditions.push({ col, val });
              return query;
            },
            select: () => query,
            maybeSingle: async () => {
              const target = holds.find((row: any) =>
                conditions.every((c) => row[c.col] === c.val)
              );
              if (!target) return { data: null, error: null };
              Object.assign(target, values);
              return { data: { ...target }, error: null };
            },
            single: async () => {
              const target = holds.find((row: any) =>
                conditions.every((c) => row[c.col] === c.val)
              );
              if (!target) return { data: null, error: { message: 'Row not found' } };
              Object.assign(target, values);
              return { data: { ...target }, error: null };
            },
          };
          return query;
        },
      };
    },
  };

  return {
    client: client as unknown as DbClient,
    holds,
    touchedTables,
  };
}

async function runSelfTest() {
  console.log('[SELFTEST] Memulai pengujian endpoint admin & resolusi sengketa hold (T-217)...');

  // Dynamic import agar process.env fallback terpasang sebelum supabase client diinisialisasi
  const {
    DisputedPayoutHoldService,
    resolveDisputedHoldSchema,
    checkActiveAdmin,
  } = await import('../disputed-payout-hold.service');
  const { WalletHttpError } = await import('../wallet.service');
  const { GET } = await import('@/app/api/admin/disputed-holds/route');
  const { PATCH } = await import('@/app/api/admin/disputed-holds/[id]/route');

  // ========================================================
  // UJI 1: Autorisasi Hak Akses Admin Aktif
  // ========================================================
  {
    // Role non-admin harus ditolak 403 FORBIDDEN
    const nonAdminRoles: UserRole[] = ['pasien', 'psikolog', 'relawan'];
    for (const role of nonAdminRoles) {
      const check = checkActiveAdmin({ role, status: 'active' });
      assert(check !== null, `Role ${role} harus ditolak`);
      assert.strictEqual(check.status, 403);
      assert.strictEqual(check.code, 'FORBIDDEN');
    }

    // Admin dengan status non-active harus ditolak 403 USER_NOT_ACTIVE
    const inactiveStatuses: AccountStatus[] = ['suspended', 'pending_approval', 'rejected', 'unverified_email'];
    for (const status of inactiveStatuses) {
      const check = checkActiveAdmin({ role: 'admin', status });
      assert(check !== null, `Admin status ${status} harus ditolak`);
      assert.strictEqual(check.status, 403);
      assert.strictEqual(check.code, 'USER_NOT_ACTIVE');
    }

    // Admin aktif harus lolos (null)
    const activeCheck = checkActiveAdmin({ role: 'admin', status: 'active' });
    assert.strictEqual(activeCheck, null, 'Admin aktif harus lolos tanpa error');

    console.log('✓ UJI 1 LULUS: Hak akses admin aktif terlindungi ketat');
  }

  // ========================================================
  // UJI 2: Validasi Skema Payload Zod (PATCH /api/admin/disputed-holds/[id])
  // ========================================================
  {
    // Payload valid: action 'clear'
    const validClear = resolveDisputedHoldSchema.safeParse({
      action: 'clear',
      note: 'Chargeback dimenangkan merchant berdasarkan bukti sesi',
    });
    assert.strictEqual(validClear.success, true);
    if (validClear.success) {
      assert.strictEqual(validClear.data.action, 'clear');
      assert.strictEqual(validClear.data.note, 'Chargeback dimenangkan merchant berdasarkan bukti sesi');
    }

    // Payload valid: action 'deduct'
    const validDeduct = resolveDisputedHoldSchema.safeParse({
      action: 'deduct',
      note: 'Bank memenangkan pemegang kartu, sengketa deduct tercatat',
    });
    assert.strictEqual(validDeduct.success, true);
    if (validDeduct.success) {
      assert.strictEqual(validDeduct.data.action, 'deduct');
    }

    // Action invalid (misal: 'refund', 'cancel', '')
    const invalidAction = resolveDisputedHoldSchema.safeParse({
      action: 'refund',
      note: 'Catatan valid',
    });
    assert.strictEqual(invalidAction.success, false, 'Action selain clear/deduct harus ditolak');

    // Note kosong / hanya spasi harus ditolak
    const emptyNote = resolveDisputedHoldSchema.safeParse({
      action: 'clear',
      note: '    ',
    });
    assert.strictEqual(emptyNote.success, false, 'Note whitespace harus ditolak');

    // Note missing harus ditolak
    const missingNote = resolveDisputedHoldSchema.safeParse({
      action: 'clear',
    });
    assert.strictEqual(missingNote.success, false, 'Note missing harus ditolak');

    console.log('✓ UJI 2 LULUS: Validasi skema Zod (clear|deduct, note) tepat sasaran');
  }

  // ========================================================
  // UJI 3: List Disputed Holds Terpaginasi & Filter Status
  // ========================================================
  {
    const mockData: MockHoldRow[] = [
      {
        id: 'hold-1',
        topup_order_id: 'topup-1',
        mitra_id: 'mitra-a',
        source_type: 'session',
        source_id: 'booking-1',
        disputed_amount_rupiah: 80000,
        status: 'active',
        reason: 'Hold sengketa pesanan 1',
        created_at: '2026-11-13T01:00:00Z',
        resolved_at: null,
        resolved_by: null,
      },
      {
        id: 'hold-2',
        topup_order_id: 'topup-2',
        mitra_id: 'mitra-b',
        source_type: 'extension',
        source_id: 'ext-1',
        disputed_amount_rupiah: 40000,
        status: 'active',
        reason: 'Hold sengketa pesanan 2',
        created_at: '2026-11-13T02:00:00Z',
        resolved_at: null,
        resolved_by: null,
      },
      {
        id: 'hold-3',
        topup_order_id: 'topup-3',
        mitra_id: 'mitra-c',
        source_type: 'tip',
        source_id: 'tip-1',
        disputed_amount_rupiah: 10000,
        status: 'cleared',
        reason: 'Hold sengketa pesanan 3',
        created_at: '2026-11-13T00:30:00Z',
        resolved_at: '2026-11-13T03:00:00Z',
        resolved_by: 'admin-1',
      },
    ];

    const mockDb = createMockDb(mockData);

    // Default status: 'active'
    const resultActive = await DisputedPayoutHoldService.listDisputedHolds(
      { page: 1, limit: 10 },
      { client: mockDb.client }
    );
    assert.strictEqual(resultActive.total, 2, 'Total active hold harus 2');
    assert.strictEqual(resultActive.items.length, 2);
    assert.strictEqual(resultActive.items[0].status, 'active');
    assert.strictEqual(resultActive.items[1].status, 'active');
    assert.strictEqual(typeof resultActive.items[0].disputed_amount_rupiah, 'number');

    // Filter status 'cleared'
    const resultCleared = await DisputedPayoutHoldService.listDisputedHolds(
      { status: 'cleared', page: 1, limit: 10 },
      { client: mockDb.client }
    );
    assert.strictEqual(resultCleared.total, 1);
    assert.strictEqual(resultCleared.items[0].id, 'hold-3');
    assert.strictEqual(resultCleared.items[0].status, 'cleared');

    // Filter status 'deducted' (kosong)
    const resultDeducted = await DisputedPayoutHoldService.listDisputedHolds(
      { status: 'deducted', page: 1, limit: 10 },
      { client: mockDb.client }
    );
    assert.strictEqual(resultDeducted.total, 0);
    assert.strictEqual(resultDeducted.items.length, 0);

    console.log('✓ UJI 3 LULUS: Query terpaginasi & filter status berfungsi akurat');
  }

  // ========================================================
  // UJI 4: Aksi Resolusi Sengketa (Clear & Deduct)
  // ========================================================
  {
    const mockData: MockHoldRow[] = [
      {
        id: 'hold-active-1',
        topup_order_id: 'topup-1',
        mitra_id: 'mitra-a',
        source_type: 'session',
        source_id: 'booking-1',
        disputed_amount_rupiah: 80000,
        status: 'active',
        reason: 'Hold sengketa awal',
        created_at: '2026-11-13T01:00:00Z',
        resolved_at: null,
        resolved_by: null,
      },
      {
        id: 'hold-active-2',
        topup_order_id: 'topup-2',
        mitra_id: 'mitra-b',
        source_type: 'session',
        source_id: 'booking-2',
        disputed_amount_rupiah: 120000,
        status: 'active',
        reason: 'Hold sengketa kedua',
        created_at: '2026-11-13T01:30:00Z',
        resolved_at: null,
        resolved_by: null,
      },
    ];

    const mockDb = createMockDb(mockData);
    const fixedNow = new Date('2026-11-13T10:00:00.000Z');

    // 4a. Resolusi clear
    const resClear = await DisputedPayoutHoldService.resolveDisputedHold(
      'hold-active-1',
      'admin-super-1',
      'clear',
      'Sengketa selesai, mitra tidak bersalah',
      { client: mockDb.client, now: () => fixedNow }
    );
    assert.strictEqual(resClear.id, 'hold-active-1');
    assert.strictEqual(resClear.status, 'cleared');
    assert.strictEqual(resClear.resolved_at, fixedNow.toISOString());
    assert.strictEqual(resClear.resolved_by, 'admin-super-1');
    assert(resClear.reason.includes('mitra tidak bersalah'), 'Catatan resolusi harus tercantum');
    assert(resClear.reason.includes('Resolusi cleared'), 'Label status resolusi harus ada');

    // 4b. Resolusi deduct
    const resDeduct = await DisputedPayoutHoldService.resolveDisputedHold(
      'hold-active-2',
      'admin-super-2',
      'deduct',
      'Chargeback bank dieksekusi, dana dipotong',
      { client: mockDb.client, now: () => fixedNow }
    );
    assert.strictEqual(resDeduct.id, 'hold-active-2');
    assert.strictEqual(resDeduct.status, 'deducted');
    assert.strictEqual(resDeduct.resolved_at, fixedNow.toISOString());
    assert.strictEqual(resDeduct.resolved_by, 'admin-super-2');
    assert(resDeduct.reason.includes('dana dipotong'), 'Catatan resolusi harus tercantum');
    assert(resDeduct.reason.includes('Resolusi deducted'), 'Label status resolusi harus ada');

    console.log('✓ UJI 4 LULUS: Aksi clear dan deduct memperbarui status, timestamp, dan identitas admin');
  }

  // ========================================================
  // UJI 5: Idempotensi Resolusi (409 HOLD_ALREADY_RESOLVED)
  // ========================================================
  {
    const mockData: MockHoldRow[] = [
      {
        id: 'hold-cleared',
        topup_order_id: 'topup-1',
        mitra_id: 'mitra-a',
        source_type: 'session',
        source_id: 'booking-1',
        disputed_amount_rupiah: 80000,
        status: 'cleared',
        reason: 'Sudah diselesaikan',
        created_at: '2026-11-13T01:00:00Z',
        resolved_at: '2026-11-13T02:00:00Z',
        resolved_by: 'admin-1',
      },
      {
        id: 'hold-deducted',
        topup_order_id: 'topup-2',
        mitra_id: 'mitra-b',
        source_type: 'session',
        source_id: 'booking-2',
        disputed_amount_rupiah: 80000,
        status: 'deducted',
        reason: 'Sudah diselesaikan',
        created_at: '2026-11-13T01:00:00Z',
        resolved_at: '2026-11-13T02:00:00Z',
        resolved_by: 'admin-1',
      },
    ];

    const mockDb = createMockDb(mockData);

    // Coba resolve ulang hold 'cleared'
    await assert.rejects(
      async () => {
        await DisputedPayoutHoldService.resolveDisputedHold(
          'hold-cleared',
          'admin-2',
          'clear',
          'Coba resolve ulang',
          { client: mockDb.client }
        );
      },
      (err: unknown) => {
        assert(err instanceof WalletHttpError);
        assert.strictEqual(err.status, 409);
        assert.strictEqual(err.code, 'HOLD_ALREADY_RESOLVED');
        return true;
      },
      'Resolusi pada hold cleared harus ditolak 409'
    );

    // Coba resolve ulang hold 'deducted'
    await assert.rejects(
      async () => {
        await DisputedPayoutHoldService.resolveDisputedHold(
          'hold-deducted',
          'admin-2',
          'deduct',
          'Coba resolve ulang',
          { client: mockDb.client }
        );
      },
      (err: unknown) => {
        assert(err instanceof WalletHttpError);
        assert.strictEqual(err.status, 409);
        assert.strictEqual(err.code, 'HOLD_ALREADY_RESOLVED');
        return true;
      },
      'Resolusi pada hold deducted harus ditolak 409'
    );

    // ID tidak ditemukan harus 404 HOLD_NOT_FOUND
    await assert.rejects(
      async () => {
        await DisputedPayoutHoldService.resolveDisputedHold(
          'hold-non-existent',
          'admin-2',
          'clear',
          'ID ngawur',
          { client: mockDb.client }
        );
      },
      (err: unknown) => {
        assert(err instanceof WalletHttpError);
        assert.strictEqual(err.status, 404);
        assert.strictEqual(err.code, 'HOLD_NOT_FOUND');
        return true;
      },
      'Hold tidak ditemukan harus 404'
    );

    console.log('✓ UJI 5 LULUS: Idempotensi terjamin (409 HOLD_ALREADY_RESOLVED) & 404 saat tidak ditemukan');
  }

  // ========================================================
  // UJI 6: Integritas Buku Besar (TIDAK menyentuh wallets / ledger_entries)
  // ========================================================
  {
    const mockData: MockHoldRow[] = [
      {
        id: 'hold-isolated',
        topup_order_id: 'topup-99',
        mitra_id: 'mitra-x',
        source_type: 'session',
        source_id: 'booking-99',
        disputed_amount_rupiah: 50000,
        status: 'active',
        reason: 'Uji isolasi buku besar',
        created_at: '2026-11-13T01:00:00Z',
        resolved_at: null,
        resolved_by: null,
      },
    ];

    const mockDb = createMockDb(mockData);

    await DisputedPayoutHoldService.resolveDisputedHold(
      'hold-isolated',
      'admin-audit',
      'deduct',
      'Deduct sengketa tanpa mutasi ledger langsung',
      { client: mockDb.client }
    );

    // Pastikan HANYA tabel disputed_payout_holds yang disentuh
    assert(
      !mockDb.touchedTables.includes('wallets'),
      'Tabel wallets DILARANG dimanipulasi dari endpoint resolusi'
    );
    assert(
      !mockDb.touchedTables.includes('ledger_entries'),
      'Tabel ledger_entries DILARANG dimanipulasi dari endpoint resolusi'
    );
    assert(
      mockDb.touchedTables.every((t) => t === 'disputed_payout_holds'),
      'Hanya tabel disputed_payout_holds yang boleh diakses'
    );

    console.log('✓ UJI 6 LULUS: Tidak ada mutasi pada tabel wallets atau ledger_entries');
  }

  // ========================================================
  // UJI 7: Proteksi Endpoint Route (GET & PATCH Unauthenticated)
  // ========================================================
  {
    // 7a. GET tanpa token -> 401 UNAUTHENTICATED
    const reqGet = new Request('http://localhost/api/admin/disputed-holds');
    const resGet = await GET(reqGet);
    assert.strictEqual(resGet.status, 401, 'GET tanpa auth harus 401');
    const jsonGet = (await resGet.json()) as { success: boolean; error: string };
    assert.strictEqual(jsonGet.success, false);
    assert.strictEqual(jsonGet.error, 'UNAUTHENTICATED');

    // 7b. PATCH tanpa token -> 401 UNAUTHENTICATED
    const reqPatch = new Request('http://localhost/api/admin/disputed-holds/00000000-0000-0000-0000-000000000001', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clear', note: 'Unauthenticated test' }),
    });
    const resPatch = await PATCH(reqPatch, {
      params: Promise.resolve({ id: '00000000-0000-0000-0000-000000000001' }),
    });
    assert.strictEqual(resPatch.status, 401, 'PATCH tanpa auth harus 401');
    const jsonPatch = (await resPatch.json()) as { success: boolean; error: string };
    assert.strictEqual(jsonPatch.success, false);
    assert.strictEqual(jsonPatch.error, 'UNAUTHENTICATED');

    console.log('✓ UJI 7 LULUS: Endpoint API terlindungi otentikasi sesi (401)');
  }

  console.log('[SELFTEST] SEMUA PENGUJIAN T-217 LULUS DENGAN SUKSES.');
}

runSelfTest().catch((err) => {
  console.error('[SELFTEST FAILED]', err);
  process.exit(1);
});
