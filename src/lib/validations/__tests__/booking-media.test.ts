import { describe, expect, it } from 'vitest';
import { isValidSessionMediaPath, verifySessionMediaPathValidation } from '@/lib/validations/booking';

const B = '11111111-1111-4111-8111-111111111111';
const B2 = '99999999-9999-4999-8999-999999999999';
const U = '22222222-2222-4222-8222-222222222222';
const good = `${B}/${U}-1794400000000-a1b2c3d4.jpg`;

describe('isValidSessionMediaPath', () => {
  it('menerima path valid', () => expect(isValidSessionMediaPath(B, good)).toBe(true));
  it('menolak mismatch UUID booking', () => expect(isValidSessionMediaPath(B2, good)).toBe(false));
  it('menolak traversal, separator liar, dan path absolut', () => {
    expect(isValidSessionMediaPath(B, `${B}/../${U}-1794400000000-a1b2c3d4.jpg`)).toBe(false);
    expect(isValidSessionMediaPath(B, `${B}\\${U}-1794400000000-a1b2c3d4.jpg`)).toBe(false);
    expect(isValidSessionMediaPath(B, `/${good}`)).toBe(false);
  });
  it('menolak input kosong/null, booking id bukan UUID, dan ekstensi liar', () => {
    expect(isValidSessionMediaPath(B, null)).toBe(false);
    expect(isValidSessionMediaPath(B, '')).toBe(false);
    expect(isValidSessionMediaPath('bukan-uuid', good)).toBe(false);
    expect(isValidSessionMediaPath(B, `${B}/${U}-1794400000000-a1b2c3d4.exe`)).toBe(false);
  });
  it('self-test bawaan modul lulus', () => {
    expect(verifySessionMediaPathValidation().passed).toBeGreaterThan(0);
  });
});
