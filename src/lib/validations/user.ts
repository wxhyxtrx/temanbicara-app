import { z } from 'zod';
import { phoneRegex } from '@/lib/validations/auth';

// 1. UPDATE ME - PASIEN
export const updateMePasienSchema = z
  .object({
    no_wa: z
      .string()
      .regex(phoneRegex, 'Format nomor WhatsApp tidak valid (contoh: 08123456789)')
      .optional(),
    nama_lengkap: z
      .string()
      .trim()
      .min(2, 'Nama lengkap minimal 2 karakter')
      .max(100, 'Nama lengkap maksimal 100 karakter')
      .optional(),
    nama_panggilan: z
      .string()
      .trim()
      .max(30, 'Nama panggilan maksimal 30 karakter')
      .nullable()
      .optional(),
    kontak_darurat_nama: z
      .string()
      .trim()
      .min(2, 'Nama kontak darurat minimal 2 karakter')
      .optional(),
    kontak_darurat_wa: z
      .string()
      .regex(phoneRegex, 'Format nomor WhatsApp kontak darurat tidak valid (contoh: 08123456789)')
      .optional(),
    is_anonim_default: z.boolean().optional(),
  })
  .strict();

export type UpdateMePasienDTO = z.infer<typeof updateMePasienSchema>;

// 2. UPDATE ME - PSIKOLOG
export const updateMePsikologSchema = z
  .object({
    no_wa: z
      .string()
      .regex(phoneRegex, 'Format nomor WhatsApp tidak valid (contoh: 08123456789)')
      .optional(),
    spesialisasi: z
      .array(
        z
          .string()
          .trim()
          .min(1, 'Item spesialisasi tidak boleh kosong')
          .max(60, 'Item spesialisasi maksimal 60 karakter')
      )
      .min(1, 'Minimal pilih 1 bidang spesialisasi')
      .max(10, 'Maksimal 10 bidang spesialisasi')
      .optional(),
    tahun_pengalaman: z
      .number()
      .int('Tahun pengalaman harus berupa bilangan bulat')
      .min(0, 'Tahun pengalaman minimal 0 tahun')
      .max(60, 'Tahun pengalaman maksimal 60 tahun')
      .optional(),
    tarif_sesi: z
      .number()
      .int('Tarif sesi harus berupa bilangan bulat')
      .min(10000, 'Tarif sesi minimal Rp10.000')
      .max(5000000, 'Tarif sesi maksimal Rp5.000.000')
      .refine((val) => val % 10000 === 0, {
        message: 'Tarif sesi harus merupakan kelipatan Rp10.000',
      })
      .optional(),
    booking_paused: z.boolean().optional(),
    extension_price_coins: z
      .number()
      .int('Harga ekstensi harus berupa bilangan bulat')
      .positive('Harga ekstensi harus lebih besar dari 0')
      .nullable()
      .optional(),
  })
  .strict();

export type UpdateMePsikologDTO = z.infer<typeof updateMePsikologSchema>;

// 3. UPDATE ME - RELAWAN
export const updateMeRelawanSchema = z
  .object({
    no_wa: z
      .string()
      .regex(phoneRegex, 'Format nomor WhatsApp tidak valid (contoh: 08123456789)')
      .optional(),
    alias_name: z
      .string()
      .trim()
      .min(2, 'Nama samaran minimal 2 karakter')
      .max(30, 'Nama samaran maksimal 30 karakter')
      .optional(),
    topik_keahlian: z
      .array(
        z
          .string()
          .trim()
          .min(1, 'Item topik keahlian tidak boleh kosong')
          .max(60, 'Item topik keahlian maksimal 60 karakter')
      )
      .max(10, 'Maksimal 10 topik keahlian')
      .optional(),
    is_available: z.boolean().optional(),
  })
  .strict();

export type UpdateMeRelawanDTO = z.infer<typeof updateMeRelawanSchema>;

// 4. UPDATE ME - ADMIN
export const updateMeAdminSchema = z
  .object({
    no_wa: z
      .string()
      .regex(phoneRegex, 'Format nomor WhatsApp tidak valid (contoh: 08123456789)')
      .optional(),
  })
  .strict();

export type UpdateMeAdminDTO = z.infer<typeof updateMeAdminSchema>;

export const ROLE_UPDATE_SCHEMAS = {
  pasien: updateMePasienSchema,
  psikolog: updateMePsikologSchema,
  relawan: updateMeRelawanSchema,
  admin: updateMeAdminSchema,
} as const;
