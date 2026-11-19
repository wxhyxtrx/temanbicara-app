import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
  logs: [] as Record<string, unknown>[],
  actors: [] as Record<string, unknown>[],
  byTable: {} as Record<string, Record<string, unknown>[]>,
  filters: [] as [string, unknown][],
}));

vi.mock('@/lib/auth/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/session')>()),
  getSessionUser: async () => (h.user ? { user: h.user } : { response: new Response(null, { status: 401 }) }),
}));

vi.mock('@/lib/supabase/client', () => {
  const logsQuery = () => {
    const q = {
      order: () => q,
      range: () => q,
      eq: (col: string, val: unknown) => {
        h.filters.push([col, val]);
        return q;
      },
      then: (resolve: (v: unknown) => void) => resolve({ data: h.logs, error: null, count: h.logs.length }),
    };
    return q;
  };
  return {
    supabaseAdmin: {
      from: (table: string) => ({
        select: () =>
          table === 'activity_logs'
            ? logsQuery()
            : { in: async () => ({ data: h.byTable[table] ?? h.actors, error: null }) },
      }),
    },
  };
});

import { GET } from '@/app/api/admin/activity-logs/route';

const req = (qs = '') => new Request(`http://localhost/api/admin/activity-logs${qs}`);

describe('GET /api/admin/activity-logs', () => {
  beforeEach(() => {
    h.user = { id: 'admin-1', role: 'admin', status: 'active' };
    h.logs = [];
    h.actors = [];
    h.filters = [];
    h.byTable = {};
  });

  it('menolak non-admin dengan 403', async () => {
    h.user = { id: 'p1', role: 'pasien', status: 'active' };
    expect((await GET(req())).status).toBe(403);
  });

  it('menolak admin tidak aktif dengan 403', async () => {
    h.user = { id: 'a2', role: 'admin', status: 'suspended' };
    expect((await GET(req())).status).toBe(403);
  });

  it('menolak filter tidak valid dengan 400', async () => {
    expect((await GET(req('?category=hacker'))).status).toBe(400);
    expect((await GET(req('?action=DROP TABLE'))).status).toBe(400);
  });

  it('meneruskan filter yang valid ke query', async () => {
    await GET(req('?category=money&actor_role=admin'));
    expect(h.filters).toEqual([
      ['category', 'money'],
      ['actor_role', 'admin'],
    ]);
  });

  it('mengembalikan data dengan nama aktor dan meta paginasi', async () => {
    h.logs = [
      { id: 'l1', created_at: '2026-11-18T00:00:00Z', actor_id: 'u1', actor_role: 'psikolog', category: 'money', action: 'payout.requested', target_type: null, target_id: null, metadata: {} },
      { id: 'l2', created_at: '2026-11-18T00:00:00Z', actor_id: null, actor_role: 'system', category: 'money', action: 'topup.settled', target_type: 'topup_order', target_id: 'o1', metadata: {} },
    ];
    h.actors = [{ id: 'u1', psikolog_profiles: { nama_lengkap_gelar: 'Dr. Contoh' } }];
    const res = await GET(req());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.map((r: { actor_name: string | null }) => r.actor_name)).toEqual(['Dr. Contoh', null]);
    expect(body.meta).toMatchObject({ page: 1, limit: 25, total: 2, totalPages: 1 });
  });

  it('menampilkan lawan interaksi & topik curhat, dan menyamarkan pasien Mode Anonim', async () => {
    h.logs = [
      { id: 'l1', created_at: '2026-11-19T00:00:00Z', actor_id: 'r1', actor_role: 'relawan', category: 'session', action: 'peer.claimed', target_type: 'peer_ticket', target_id: 't1', metadata: {} },
      { id: 'l2', created_at: '2026-11-19T00:00:00Z', actor_id: 'p2', actor_role: 'pasien', category: 'money', action: 'tip.given', target_type: 'booking', target_id: 'b1', metadata: { coins: 5 } },
    ];
    h.byTable = {
      peer_tickets: [{ id: 't1', patient_id: 'p1', claimed_by: 'r1', topic: 'Kesepian & Hampa', patient_alias: 'Senja Biru' }],
      bookings: [{ id: 'b1', patient_id: 'p2', psikolog_id: 's1' }],
      users: [
        { id: 'r1', role: 'relawan', relawan_profiles: { nama_lengkap: 'Nurul' } },
        { id: 'p1', role: 'pasien', pasien_profiles: { nama_lengkap: 'Nama Asli Pasien', is_anonim_default: true } },
        { id: 'p2', role: 'pasien', pasien_profiles: { nama_lengkap: 'Fauzi Dahlan', is_anonim_default: false } },
        { id: 's1', role: 'psikolog', psikolog_profiles: { nama_lengkap_gelar: 'Dr. Wijaya' } },
      ],
    };
    const body = await (await GET(req())).json();
    expect(body.data[0]).toMatchObject({ actor_name: 'Nurul', counterpart_name: 'Senja Biru', counterpart_role: 'pasien', topic: 'Kesepian & Hampa' });
    expect(JSON.stringify(body)).not.toContain('Nama Asli Pasien');
    expect(body.data[1]).toMatchObject({ actor_name: 'Fauzi Dahlan', counterpart_name: 'Dr. Wijaya', counterpart_role: 'psikolog', topic: null });
  });

  it('menerima filter kategori baru session dan feedback', async () => {
    expect((await GET(req('?category=session'))).status).toBe(200);
    expect((await GET(req('?category=feedback'))).status).toBe(200);
  });
});
