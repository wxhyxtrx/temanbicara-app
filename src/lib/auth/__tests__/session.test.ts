import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  bearer: null as string | null,
  cookie: null as string | null,
  getUser: vi.fn(),
  dbUser: null as Record<string, unknown> | null,
}));

vi.mock('next/headers', () => ({
  headers: async () => ({ get: () => (h.bearer ? `Bearer ${h.bearer}` : null) }),
  cookies: async () => ({ get: () => (h.cookie ? { value: h.cookie } : undefined) }),
}));
vi.mock('@/lib/supabase/client', () => ({
  supabaseAdmin: {
    auth: { getUser: h.getUser },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: h.dbUser }) }) }) }),
  },
}));

import { getSessionUser } from '@/lib/auth/session';

async function body(res: Response) {
  return { status: res.status, json: await res.json() };
}

describe('getSessionUser', () => {
  beforeEach(() => {
    h.bearer = null;
    h.cookie = null;
    h.dbUser = { id: 'u1', email: 'a@b.c', role: 'pasien', status: 'active' };
    h.getUser.mockReset();
    h.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
  });

  it('tanpa token -> 401 UNAUTHENTICATED', async () => {
    const r = await getSessionUser();
    expect(r.user).toBeUndefined();
    expect(await body(r.response!)).toMatchObject({ status: 401, json: { error: 'UNAUTHENTICATED' } });
    expect(h.getUser).not.toHaveBeenCalled();
  });

  it('token cacat/kedaluwarsa -> 401 INVALID_TOKEN', async () => {
    h.bearer = 'jwt-cacat';
    h.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'jwt expired' } });
    const r = await getSessionUser();
    expect(await body(r.response!)).toMatchObject({ status: 401, json: { error: 'INVALID_TOKEN' } });
  });

  it('token dari cookie juga diterima', async () => {
    h.cookie = 'jwt-ok';
    const r = await getSessionUser();
    expect(r.user?.id).toBe('u1');
    expect(h.getUser).toHaveBeenCalledWith('jwt-ok');
  });

  it('user tidak ada di tabel users -> 404 USER_NOT_FOUND', async () => {
    h.bearer = 't';
    h.dbUser = null;
    const r = await getSessionUser();
    expect(await body(r.response!)).toMatchObject({ status: 404, json: { error: 'USER_NOT_FOUND' } });
  });

  it('suspended -> 403 ACCOUNT_SUSPENDED', async () => {
    h.bearer = 't';
    h.dbUser = { ...h.dbUser!, status: 'suspended' };
    const r = await getSessionUser();
    expect(await body(r.response!)).toMatchObject({ status: 403, json: { error: 'ACCOUNT_SUSPENDED' } });
  });

  it('rejected -> 403 ACCOUNT_REJECTED', async () => {
    h.bearer = 't';
    h.dbUser = { ...h.dbUser!, status: 'rejected' };
    const r = await getSessionUser();
    expect(await body(r.response!)).toMatchObject({ status: 403, json: { error: 'ACCOUNT_REJECTED' } });
  });

  it('allowInactive: true meloloskan suspended dan rejected', async () => {
    h.bearer = 't';
    for (const status of ['suspended', 'rejected']) {
      h.dbUser = { ...h.dbUser!, status };
      const r = await getSessionUser({ allowInactive: true });
      expect(r.user?.status).toBe(status);
    }
  });

  it('akun aktif lolos', async () => {
    h.bearer = 't';
    const r = await getSessionUser();
    expect(r.user).toMatchObject({ id: 'u1', status: 'active' });
  });
});
