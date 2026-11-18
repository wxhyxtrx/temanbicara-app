import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  calculateEstimatedRefund,
  checkRescheduleEligibility,
  isBookingRoomActive,
  tarifToCoins,
} from '@/lib/booking-utils';
import { createBookingSchema, rescheduleBookingSchema, bookingQuerySchema } from '@/lib/validations/booking';

const NOW = new Date('2026-11-18T03:00:00.000Z');
const inMin = (m: number) => new Date(NOW.getTime() + m * 60_000).toISOString();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe('tarifToCoins (1 koin = Rp10.000)', () => {
  it('konversi dan pembulatan', () => {
    expect(tarifToCoins(150000)).toBe(15);
    expect(tarifToCoins('200000')).toBe(20);
    expect(tarifToCoins(14999)).toBe(1);
  });
  it('minimal 1 koin untuk tarif kosong/tidak valid', () => {
    expect(tarifToCoins(0)).toBe(1);
    expect(tarifToCoins(null)).toBe(1);
    expect(tarifToCoins(undefined)).toBe(1);
  });
});

describe('calculateEstimatedRefund - kebijakan bawaan', () => {
  it('>= 60 menit sebelum sesi: refund 100%', () => {
    expect(calculateEstimatedRefund(inMin(60), 10)).toMatchObject({ refundPct: 100, refundCoins: 10, burnedCoins: 0 });
  });
  it('30-59 menit: refund 65% dibulatkan ke atas', () => {
    expect(calculateEstimatedRefund(inMin(45), 10)).toMatchObject({ refundPct: 65, refundCoins: 7, burnedCoins: 3 });
    expect(calculateEstimatedRefund(inMin(45), 3)).toMatchObject({ refundCoins: 2, burnedCoins: 1 });
  });
  it('< 30 menit atau sesi sudah mulai: hangus 0%', () => {
    expect(calculateEstimatedRefund(inMin(29), 10)).toMatchObject({ refundPct: 0, refundCoins: 0, burnedCoins: 10 });
    const lewat = calculateEstimatedRefund(inMin(-5), 10);
    expect(lewat).toMatchObject({ refundCoins: 0, burnedCoins: 10 });
    expect(lewat.hoursLeftFormatted).toBe('Sesi telah dimulai');
  });
  it('refund + hangus selalu sama dengan harga', () => {
    for (const m of [-10, 0, 29, 30, 59, 60, 600]) {
      const r = calculateEstimatedRefund(inMin(m), 7);
      expect(r.refundCoins + r.burnedCoins).toBe(7);
    }
  });
});

describe('calculateEstimatedRefund - snapshot kebijakan kustom', () => {
  const policy = [
    { min_minutes_before: 1440, refund_pct: 100 },
    { min_minutes_before: 0, refund_pct: 50 },
  ];
  it('memakai tier tertinggi yang terpenuhi (urutan input bebas)', () => {
    expect(calculateEstimatedRefund(inMin(1500), 10, [...policy].reverse()).refundPct).toBe(100);
    expect(calculateEstimatedRefund(inMin(600), 10, policy).refundPct).toBe(50);
  });
  it('di bawah semua tier -> 0%', () => {
    expect(calculateEstimatedRefund(inMin(-1), 10, policy).refundPct).toBe(0);
  });
  it('array kosong jatuh ke kebijakan bawaan', () => {
    expect(calculateEstimatedRefund(inMin(90), 10, []).refundPct).toBe(100);
  });
});

describe('checkRescheduleEligibility', () => {
  it('layak: belum pernah pindah dan > 24 jam', () => {
    expect(checkRescheduleEligibility(inMin(25 * 60), 0).eligible).toBe(true);
  });
  it('tidak layak: <= 24 jam sebelum sesi (batas tepat 24 jam ditolak)', () => {
    expect(checkRescheduleEligibility(inMin(24 * 60), 0).eligible).toBe(false);
    expect(checkRescheduleEligibility(inMin(2 * 60), 0).eligible).toBe(false);
  });
  it('tidak layak: sudah pernah pindah (maks 1 kali)', () => {
    const r = checkRescheduleEligibility(inMin(72 * 60), 1);
    expect(r.eligible).toBe(false);
    expect(r.reason).toMatch(/maksimal 1 kali/);
  });
});

describe('isBookingRoomActive', () => {
  const booked = (startMin: number, extra = {}) =>
    ({ status: 'booked', start_at: inMin(startMin), ...extra }) as Parameters<typeof isBookingRoomActive>[0];

  it('terbuka mulai 10 menit sebelum jadwal', () => {
    expect(isBookingRoomActive(booked(11))).toBe(false);
    expect(isBookingRoomActive(booked(10))).toBe(true);
  });
  it('tutup setelah 45 menit (55 bila ekstensi disetujui)', () => {
    expect(isBookingRoomActive(booked(-45))).toBe(true);
    expect(isBookingRoomActive(booked(-46))).toBe(false);
    expect(isBookingRoomActive(booked(-55, { extension_status: 'approved' }))).toBe(true);
    expect(isBookingRoomActive(booked(-56, { extension_status: 'approved' }))).toBe(false);
  });
  it('status selain booked/in_progress dan sesi yang sudah diakhiri tidak aktif', () => {
    expect(isBookingRoomActive({ ...booked(0), status: 'completed' })).toBe(false);
    expect(isBookingRoomActive({ ...booked(0), status: 'cancelled_by_patient' })).toBe(false);
    expect(isBookingRoomActive(booked(0, { ended_at: inMin(-1) }))).toBe(false);
  });
  it('in_progress tetap aktif sampai durasi habis, start_at rusak -> false', () => {
    expect(isBookingRoomActive({ ...booked(-30), status: 'in_progress' })).toBe(true);
    expect(isBookingRoomActive({ ...booked(-60), status: 'in_progress' })).toBe(false);
    expect(isBookingRoomActive({ status: 'booked', start_at: 'bukan-tanggal' } as Parameters<typeof isBookingRoomActive>[0])).toBe(false);
  });
});

describe('skema booking', () => {
  const uuid = '11111111-1111-4111-8111-111111111111';
  const keluhan = 'Saya merasa cemas berlebihan setiap malam.';
  it('createBookingSchema valid', () => {
    expect(createBookingSchema.safeParse({ psikolog_id: uuid, start_at: inMin(60), keluhan }).success).toBe(true);
  });
  it('menolak psikolog_id bukan UUID, tanggal rusak, dan keluhan terlalu pendek/panjang', () => {
    const base = { psikolog_id: uuid, start_at: inMin(60), keluhan };
    expect(createBookingSchema.safeParse({ ...base, psikolog_id: 'x' }).success).toBe(false);
    expect(createBookingSchema.safeParse({ ...base, start_at: 'besok' }).success).toBe(false);
    expect(createBookingSchema.safeParse({ ...base, keluhan: 'pendek' }).success).toBe(false);
    expect(createBookingSchema.safeParse({ ...base, keluhan: 'a'.repeat(1001) }).success).toBe(false);
  });
  it('rescheduleBookingSchema dan bookingQuerySchema', () => {
    expect(rescheduleBookingSchema.safeParse({ new_start_at: inMin(60) }).success).toBe(true);
    expect(rescheduleBookingSchema.safeParse({ new_start_at: 'x' }).success).toBe(false);
    expect(bookingQuerySchema.parse({})).toMatchObject({ page: 1, limit: 10 });
    expect(bookingQuerySchema.safeParse({ limit: 51 }).success).toBe(false);
    expect(bookingQuerySchema.safeParse({ scope: 'lain' }).success).toBe(false);
  });
});
