import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  files: [] as { name: string }[],
  listError: null as unknown,
  existing: null as unknown,
}));

vi.mock('@/lib/supabase/client', () => ({
  supabaseAdmin: {
    storage: { from: () => ({ list: async () => ({ data: h.files, error: h.listError }) }) },
    from: () => ({
      select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: h.existing, error: null }) }) }) }),
    }),
  },
}));

import { validateMitraDocument } from '@/lib/validations/mitra-documents';

const EMAIL = 'dr.budi@gmail.com';
const PREFIX = 'dr_budi_gmail_com';
const NAME = 'sipp_str-12345678-1234-1234-1234-123456789abc.pdf';
const KEY = `${PREFIX}/${NAME}`;
const run = (key: string) => validateMitraDocument(EMAIL, key, 'sipp_str', 'psikolog_profiles', 'dokumen_sipp_str_url');

describe('validateMitraDocument', () => {
  beforeEach(() => {
    h.files = [{ name: NAME }];
    h.listError = null;
    h.existing = null;
  });

  it('menerima key valid yang ada di storage dan belum dipakai', async () => {
    expect(await run(KEY)).toEqual({ ok: true });
  });
  it('menolak URL penuh', async () => {
    expect((await run(`https://x.co/${KEY}`)).ok).toBe(false);
  });
  it('menolak traversal dan key milik email lain', async () => {
    expect((await run(`${PREFIX}/../x/${NAME}`)).ok).toBe(false);
    expect((await run(`dr_andi_gmail_com/${NAME}`)).ok).toBe(false);
  });
  it('menolak ekstensi selain PDF (kebijakan: PDF saja, maks 5 MB di bucket)', async () => {
    expect((await run(`${PREFIX}/sipp_str-12345678-1234-1234-1234-123456789abc.png`)).ok).toBe(false);
  });
  it('menolak bila berkas belum ada di storage', async () => {
    h.files = [];
    expect((await run(KEY)).ok).toBe(false);
  });
  it('menolak bila key sudah dipakai profil lain', async () => {
    h.existing = { user_id: 'lain' };
    expect((await run(KEY)).ok).toBe(false);
  });
});
