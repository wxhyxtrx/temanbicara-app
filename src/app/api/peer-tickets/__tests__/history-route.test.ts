import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
  tickets: [] as Record<string, unknown>[],
  reviews: [] as Record<string, unknown>[],
  relawan: [] as Record<string, unknown>[],
  filters: [] as [string, unknown][],
}));

vi.mock('@/lib/auth/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/session')>()),
  getSessionUser: async () => (h.user ? { user: h.user } : { response: new Response(null, { status: 401 }) }),
}));

vi.mock('@/lib/supabase/client', () => {
  const ticketsQuery = () => {
    const q = {
      order: () => q,
      range: () => q,
      eq: (c: string, v: unknown) => (h.filters.push([c, v]), q),
      in: (c: string, v: unknown) => (h.filters.push([c, v]), q),
      then: (resolve: (v: unknown) => void) => resolve({ data: h.tickets, error: null, count: h.tickets.length }),
    };
    return q;
  };
  return {
    supabaseAdmin: {
      from: (table: string) => ({
        select: () =>
          table === 'peer_tickets'
            ? ticketsQuery()
            : { in: async () => ({ data: table === 'peer_reviews' ? h.reviews : h.relawan, error: null }) },
      }),
    },
  };
});

import { GET } from '@/app/api/peer-tickets/history/route';

const req = () => new Request('http://localhost/api/peer-tickets/history');
const ticket = { id: 't1', patient_alias: 'Senja Biru', topic: 'Kerja', emotion: 'Lelah', status: 'closed', claimed_by: 'r1', created_at: '2026-11-19T00:00:00Z', closed_at: '2026-11-19T01:00:00Z', archived_at: null };

describe('GET /api/peer-tickets/history', () => {
  beforeEach(() => {
    h.user = { id: 'p1', role: 'pasien', status: 'active' };
    h.tickets = [ticket];
    h.reviews = [{ ticket_id: 't1', rating: 5 }];
    h.relawan = [{ user_id: 'r1', alias_name: 'Kak Nurul' }];
    h.filters = [];
  });

  it('menolak peran selain pasien/relawan', async () => {
    h.user = { id: 'a1', role: 'admin', status: 'active' };
    expect((await GET(req())).status).toBe(403);
  });

  it('pasien: hanya tiket miliknya yang selesai, dengan alias relawan & rating', async () => {
    const body = await (await GET(req())).json();
    expect(h.filters).toEqual([['patient_id', 'p1'], ['status', ['closed', 'archived']]]);
    expect(body.data[0]).toMatchObject({ id: 't1', counterpart_name: 'Kak Nurul', rating: 5, ended_at: ticket.closed_at });
  });

  it('relawan: hanya tiket yang ia dampingi, hanya alias pasien tanpa patient_id', async () => {
    h.user = { id: 'r1', role: 'relawan', status: 'active' };
    const body = await (await GET(req())).json();
    expect(h.filters).toEqual([['claimed_by', 'r1'], ['status', 'closed']]);
    expect(body.data[0].counterpart_name).toBe('Senja Biru');
    expect(JSON.stringify(body)).not.toContain('patient_id');
  });
});
