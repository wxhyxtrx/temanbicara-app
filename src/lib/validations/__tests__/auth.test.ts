import { describe, expect, it } from 'vitest';
import {
  loginSchema,
  registerPasienSchema,
  registerRelawanSchema,
  passwordFormSchema,
  sanitizeEmailPrefix,
  buildDocumentKeyRegex,
} from '@/lib/validations/auth';

describe('loginSchema', () => {
  it('menolak email tidak valid', () => {
    expect(loginSchema.safeParse({ email: 'bukan-email', password: 'x' }).success).toBe(false);
  });
  it('menolak password kosong; password pendek TETAP boleh (keputusan Kapten: login min(1))', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
  });
  it('remember_me default false', () => {
    expect(loginSchema.parse({ email: 'a@b.co', password: 'x' }).remember_me).toBe(false);
  });
});

describe('skema daftar menolak password < 8 karakter', () => {
  const passwordIssues = (
    schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: { path: PropertyKey[] }[] } } },
    pwd: string
  ) => {
    const r = schema.safeParse({ email: 'a@b.co', password: pwd, password_confirmation: pwd });
    return r.success ? [] : r.error!.issues.filter((i) => i.path[0] === 'password');
  };
  it('pasien', () => {
    expect(passwordIssues(registerPasienSchema, '1234567').length).toBeGreaterThan(0);
    expect(passwordIssues(registerPasienSchema, '12345678')).toHaveLength(0);
  });
  it('relawan', () => {
    expect(passwordIssues(registerRelawanSchema, '1234567').length).toBeGreaterThan(0);
    expect(passwordIssues(registerRelawanSchema, '12345678')).toHaveLength(0);
  });
});

describe('passwordFormSchema (ganti password)', () => {
  const ok = { current_password: 'lama-12345', new_password: 'baru-12345', confirm_password: 'baru-12345' };
  it('valid', () => expect(passwordFormSchema(true).safeParse(ok).success).toBe(true));
  it('menolak < 8 dan > 72 karakter', () => {
    expect(passwordFormSchema(true).safeParse({ ...ok, new_password: 'pendek', confirm_password: 'pendek' }).success).toBe(false);
    const long = 'a'.repeat(73);
    expect(passwordFormSchema(true).safeParse({ ...ok, new_password: long, confirm_password: long }).success).toBe(false);
  });
  it('menolak konfirmasi beda dan password baru sama dengan lama', () => {
    expect(passwordFormSchema(true).safeParse({ ...ok, confirm_password: 'beda-12345' }).success).toBe(false);
    expect(
      passwordFormSchema(true).safeParse({ ...ok, new_password: ok.current_password, confirm_password: ok.current_password }).success
    ).toBe(false);
  });
  it('akun tanpa password lama tidak butuh current_password', () => {
    expect(passwordFormSchema(false).safeParse({ new_password: 'baru-12345', confirm_password: 'baru-12345' }).success).toBe(true);
  });
});

describe('kunci dokumen mitra (regex)', () => {
  const prefix = sanitizeEmailPrefix('Dr.Budi@gmail.com');
  const uuid = '12345678-1234-1234-1234-123456789abc';
  const sipp = buildDocumentKeyRegex(prefix, 'sipp_str');
  const cv = buildDocumentKeyRegex(prefix, 'cv');
  it('prefix email dinormalkan', () => expect(prefix).toBe('dr_budi_gmail_com'));
  it('menerima key valid PDF', () => {
    expect(sipp.test(`${prefix}/sipp_str-${uuid}.pdf`)).toBe(true);
    expect(cv.test(`${prefix}/cv-${uuid}.pdf`)).toBe(true);
  });
  it('menolak URL penuh, traversal, tipe tertukar, email lain, dan ekstensi non-PDF', () => {
    expect(sipp.test(`https://x.co/${prefix}/sipp_str-${uuid}.pdf`)).toBe(false);
    expect(sipp.test(`${prefix}/../../sipp_str-${uuid}.pdf`)).toBe(false);
    expect(sipp.test(`${prefix}/cv-${uuid}.pdf`)).toBe(false);
    expect(sipp.test(`${sanitizeEmailPrefix('lain@gmail.com')}/sipp_str-${uuid}.pdf`)).toBe(false);
    expect(sipp.test(`${prefix}/sipp_str-${uuid}.png`)).toBe(false);
  });
});
