import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/client', () => ({ supabaseAdmin: null }));

import { logActivity, sanitizeActivityMetadata } from '@/lib/activity-log';

function mockClient(result: { error: unknown } = { error: null }) {
  const insert = vi.fn().mockResolvedValue(result);
  const from = vi.fn(() => ({ insert }));
  return { client: { from } as never, from, insert };
}

describe('sanitizeActivityMetadata', () => {
  it('membuang kunci berisi data pribadi/rahasia', () => {
    const clean = sanitizeActivityMetadata({
      amount_rupiah: 500000,
      email: 'a@b.co',
      password: 'x',
      account_number: '123',
      no_wa: '0812',
      access_token: 't',
      bank: 'BCA',
    });
    expect(clean).toEqual({ amount_rupiah: 500000, bank: 'BCA' });
  });

  it('memotong string panjang dan membuang angka tidak valid', () => {
    const clean = sanitizeActivityMetadata({ note: 'a'.repeat(500), bad: Number.NaN });
    expect((clean.note as string).length).toBe(200);
    expect('bad' in clean).toBe(false);
  });
});

describe('logActivity', () => {
  it('menyisipkan baris dengan kolom yang benar', async () => {
    const m = mockClient();
    await logActivity(
      { actorId: 'u1', actorRole: 'admin', category: 'money', action: 'payout.paid', targetType: 'payout_request', targetId: 'p1', metadata: { email: 'x', amount_rupiah: 1 } },
      { client: m.client }
    );
    expect(m.from).toHaveBeenCalledWith('activity_logs');
    expect(m.insert).toHaveBeenCalledWith({
      actor_id: 'u1',
      actor_role: 'admin',
      category: 'money',
      action: 'payout.paid',
      target_type: 'payout_request',
      target_id: 'p1',
      metadata: { amount_rupiah: 1 },
    });
  });

  it('mengabaikan format action yang salah tanpa menyentuh DB', async () => {
    const m = mockClient();
    await logActivity({ actorRole: 'guest', category: 'auth', action: 'Bukan Format' }, { client: m.client });
    expect(m.from).not.toHaveBeenCalled();
  });

  it('tidak pernah melempar error walau DB gagal atau melempar', async () => {
    const failing = mockClient({ error: { code: '42501' } });
    await expect(logActivity({ actorRole: 'system', category: 'money', action: 'topup.settled' }, { client: failing.client })).resolves.toBeUndefined();

    const throwing = { from: () => { throw new Error('down'); } } as never;
    await expect(logActivity({ actorRole: 'system', category: 'money', action: 'topup.settled' }, { client: throwing })).resolves.toBeUndefined();
  });

  it('tanpa client DB (supabaseAdmin null) diam saja', async () => {
    await expect(logActivity({ actorRole: 'guest', category: 'auth', action: 'auth.login_failed' })).resolves.toBeUndefined();
  });
});
