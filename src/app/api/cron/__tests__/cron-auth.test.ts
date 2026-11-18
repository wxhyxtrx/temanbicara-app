import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ reconcile: vi.fn() }));

// supabaseAdmin null: bila auth lolos, purge-session-media berhenti di 500 SERVER_CONFIG_ERROR (bukan 401).
vi.mock('@/lib/supabase/client', () => ({ supabaseAdmin: null }));
vi.mock('@/services/wallet-reconcile.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/wallet-reconcile.service')>()),
  WalletReconcileService: { reconcileStaleOrders: h.reconcile },
}));

import { GET as purge } from '@/app/api/cron/purge-session-media/route';
import { GET as reconcile } from '@/app/api/cron/reconcile-stale-topup/route';

const SECRET = 'dummy-cron-secret';
const req = (auth?: string) =>
  new Request('http://localhost/api/cron/x', { headers: auth ? { authorization: auth } : {} });

describe.each([
  ['reconcile-stale-topup', reconcile, 200],
  ['purge-session-media', purge, 500],
] as const)('cron %s', (_name, handler, okStatus) => {
  const prev = process.env.CRON_SECRET;
  beforeEach(() => {
    process.env.CRON_SECRET = SECRET;
    h.reconcile.mockReset();
    h.reconcile.mockResolvedValue({ processed: 0 });
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prev;
  });

  it('tanpa header Authorization -> 401', async () => {
    const res = await handler(req());
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('UNAUTHORIZED');
  });
  it('secret salah -> 401', async () => {
    expect((await handler(req('Bearer salah'))).status).toBe(401);
  });
  it('tanpa prefix Bearer -> 401', async () => {
    expect((await handler(req(SECRET))).status).toBe(401);
  });
  it('CRON_SECRET belum diset -> 401 (fail closed)', async () => {
    delete process.env.CRON_SECRET;
    expect((await handler(req('Bearer undefined'))).status).toBe(401);
  });
  it('secret benar lolos autentikasi', async () => {
    expect((await handler(req(`Bearer ${SECRET}`))).status).toBe(okStatus);
  });
});
