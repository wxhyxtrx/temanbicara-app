import { z } from 'zod';

export const maintenanceSchema = z
  .object({
    scheduled_start: z.string().datetime({ offset: true }).nullable().or(z.null()),
    estimated_end: z.string().datetime({ offset: true }).nullable().or(z.null()),
    message: z.string().max(500, 'Pesan maintenance maksimal 500 karakter'),
  })
  .refine(
    (data) => {
      if (data.scheduled_start && data.estimated_end) {
        return new Date(data.estimated_end).getTime() > new Date(data.scheduled_start).getTime();
      }
      return true;
    },
    { message: 'Waktu selesai harus lebih besar dari waktu mulai', path: ['estimated_end'] }
  );

export const topupSchema = z
  .object({
    min_coins: z.number().int().min(1, 'Minimal koin harus >= 1'),
    max_coins: z.number().int().min(1, 'Maksimal koin harus >= 1'),
  })
  .refine((data) => data.min_coins <= data.max_coins, {
    message: 'min_coins tidak boleh lebih besar dari max_coins',
    path: ['max_coins'],
  });

export const revenueShareSchema = z.object({
  mitra_bps: z.number().int().min(0, 'BPS minimal 0').max(10000, 'BPS maksimal 10000 (100%)'),
});

export const tipSchema = z
  .object({
    min_coins: z.number().int().min(1, 'Minimal tip koin harus >= 1'),
    max_coins: z.number().int().min(1, 'Maksimal tip koin harus >= 1'),
    daily_cap_coins_per_patient: z.number().int().min(1, 'Batas harian koin harus >= 1'),
  })
  .refine((data) => data.min_coins <= data.max_coins, {
    message: 'min_coins tidak boleh lebih besar dari max_coins',
    path: ['max_coins'],
  })
  .refine((data) => data.max_coins <= data.daily_cap_coins_per_patient, {
    message: 'max_coins tidak boleh lebih besar dari daily_cap_coins_per_patient',
    path: ['daily_cap_coins_per_patient'],
  });

export const holdingSchema = z.object({
  hours: z.number().int().min(0, 'Holding hours minimal 0').max(720, 'Holding hours maksimal 720 (30 hari)'),
});

export const payoutSchema = z
  .object({
    min_rupiah: z.number().int().min(0, 'Minimal penarikan minimal 0'),
    max_rupiah: z.number().int().min(0, 'Maksimal penarikan minimal 0'),
    fee_rupiah: z.number().int().min(0, 'Biaya penarikan minimal 0'),
  })
  .refine((data) => data.min_rupiah <= data.max_rupiah, {
    message: 'min_rupiah tidak boleh lebih besar dari max_rupiah',
    path: ['max_rupiah'],
  });

export const refundTierSchema = z.object({
  min_minutes_before: z.number().int().min(0, 'Menit pembatalan harus >= 0'),
  refund_pct: z.number().int().min(0, 'Persen refund minimal 0').max(100, 'Persen refund maksimal 100'),
});

export const refundPolicySchema = z
  .array(refundTierSchema)
  .min(1, 'Minimal harus ada 1 aturan refund')
  .refine(
    (arr) => {
      // Wajib urut menurun berdasarkan min_minutes_before
      for (let i = 0; i < arr.length - 1; i++) {
        if (arr[i].min_minutes_before <= arr[i + 1].min_minutes_before) return false;
      }
      return true;
    },
    { message: 'Aturan refund wajib diurutkan menurun berdasarkan min_minutes_before' }
  )
  .refine((arr) => arr[arr.length - 1].min_minutes_before === 0, {
    message: 'Entri terakhir refund policy wajib memiliki min_minutes_before = 0',
  });

export const psikologLateSchema = z.object({
  minutes: z.number().int().min(1, 'Toleransi keterlambatan minimal 1 menit').max(30, 'Maksimal 30 menit'),
});

export const patientNoshowSchema = z.object({
  minutes: z.number().int().min(1, 'Toleransi no-show minimal 1 menit').max(45, 'Maksimal 45 menit'),
});

export const extensionPriceSchema = z
  .object({
    min_coins: z.number().int().min(1, 'Harga ekstensi minimal 1 koin'),
    max_coins: z.number().int().min(1, 'Harga ekstensi maksimal >= 1 koin'),
  })
  .refine((data) => data.min_coins <= data.max_coins, {
    message: 'min_coins tidak boleh lebih besar dari max_coins',
    path: ['max_coins'],
  });

export const relawanSchema = z
  .object({
    daily_ticket_quota: z.number().int().min(1, 'Kuota harian relawan minimal 1'),
    claim_response_minutes: z.number().int().min(1, 'Batas respons klaim minimal 1 menit'),
    unclaimed_archive_hours: z.number().int().min(1, 'Batas arsip tiket minimal 1 jam'),
    max_carry_penalty: z.number().int().min(0, 'Penalti sisa hari berikutnya minimal 0'),
  })
  .refine((data) => data.max_carry_penalty < data.daily_ticket_quota, {
    message: 'max_carry_penalty harus lebih kecil dari daily_ticket_quota',
    path: ['max_carry_penalty'],
  });

export const uploadSchema = z.object({
  verification_max_mb: z.number().int().positive('Ukuran berkas verifikasi harus > 0 MB'),
  chat_media_max_mb: z.number().int().positive('Ukuran berkas chat harus > 0 MB'),
  voice_note_max_seconds: z.number().int().positive('Durasi voice note harus > 0 detik'),
});

export const mediaRetentionSchema = z.object({
  days: z.number().int().min(1, 'Retensi media minimal 1 hari').max(365, 'Retensi media maksimal 365 hari'),
});

export const systemSettingsValidators = {
  maintenance: maintenanceSchema,
  topup: topupSchema,
  revenue_share: revenueShareSchema,
  tip: tipSchema,
  holding: holdingSchema,
  payout: payoutSchema,
  refund_policy: refundPolicySchema,
  psikolog_late: psikologLateSchema,
  patient_noshow: patientNoshowSchema,
  extension_price: extensionPriceSchema,
  relawan: relawanSchema,
  upload: uploadSchema,
  media_retention: mediaRetentionSchema,
} as const;

export type SettingKey = keyof typeof systemSettingsValidators;
