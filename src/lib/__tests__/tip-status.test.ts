import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
  row: null as Record<string, unknown> | null,
  filters: [] as [string, unknown][],
}));

vi.mock('@/lib/auth/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/session')>()),
  getSessionUser: async () => (h.user ? { user: h.user } : { response: new Response(null, { status: 401 }) }),
}));

vi.mock('@/lib/supabase/client', () => {
  const q = {
    select: () => q,
    eq: (col: string, val: unknown) => {
      h.filters.push([col, val]);
      return q;
    },
    maybeSingle: async () => ({ data: h.row, error: null }),
  };
  return { supabaseAdmin: { from: () => q } };
});

import { getMyTipStatus } from '@/lib/tip-status';

const ID = '92985e84-5ea5-4ffc-bbae-6252f64bc752';

describe('getMyTipStatus', () => {
  beforeEach(() => {
    h.user = { id: 'p1', role: 'pasien', status: 'active' };
    h.row = null;
    h.filters = [];
  });

  it('menolak ID tidak valid dan peran selain pasien', async () => {
    expect((await getMyTipStatus('ticket', 'bukan-uuid')).status).toBe(400);
    h.user = { id: 'r1', role: 'relawan', status: 'active' };
    expect((await getMyTipStatus('ticket', ID)).status).toBe(403);
  });

  it('hanya membaca tip milik pasien yang login untuk sumber tersebut', async () => {
    await getMyTipStatus('session', ID);
    expect(h.filters).toEqual([
      ['source_type', 'session'],
      ['source_id', ID],
      ['patient_id', 'p1'],
    ]);
  });

  it('mengembalikan tipped=false bila belum ada tip, dan jumlah koin bila sudah', async () => {
    let body = await (await getMyTipStatus('ticket', ID)).json();
    expect(body.data).toEqual({ tipped: false, coins: null });

    h.row = { coins: '20' };
    body = await (await getMyTipStatus('ticket', ID)).json();
    expect(body.data).toEqual({ tipped: true, coins: 20 });
  });
});
