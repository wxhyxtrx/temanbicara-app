import { z } from 'zod';

export const phoneRegex = /^(\+62|62|0)8[1-9][0-9]{6,11}$/;

// 1. REGISTER PASIEN
export const registerPasienSchema = z
  .object({
    nama_lengkap: z.string().trim().min(2, 'Nama lengkap minimal 2 karakter'),
    nama_panggilan: z.string().trim().max(30, 'Nama panggilan maksimal 30 karakter').optional().nullable(),
    kontak_darurat_nama: z.string().trim().min(2, 'Nama kontak darurat minimal 2 karakter'),
    kontak_darurat_wa: z.string().regex(phoneRegex, 'Format nomor WhatsApp kontak darurat tidak valid (contoh: 08123456789)'),
    email: z.string().email('Format email tidak valid'),
    no_wa: z.string().regex(phoneRegex, 'Format nomor WhatsApp tidak valid (contoh: 08123456789)'),
    password: z.string().min(8, 'Password minimal 8 karakter'),
    password_confirmation: z.string().min(8, 'Konfirmasi password wajib diisi'),
  })
  .refine((data) => data.password === data.password_confirmation, {
    message: 'Konfirmasi password tidak cocok dengan password',
    path: ['password_confirmation'],
  });

export type RegisterPasienDTO = z.infer<typeof registerPasienSchema>;

// 2. REGISTER RELAWAN
export const registerRelawanSchema = z
  .object({
    nama_lengkap: z.string().trim().min(2, 'Nama lengkap minimal 2 karakter'),
    email: z.string().email('Format email tidak valid'),
    no_wa: z.string().regex(phoneRegex, 'Format nomor WhatsApp tidak valid'),
    password: z.string().min(8, 'Password minimal 8 karakter'),
    password_confirmation: z.string().min(8, 'Konfirmasi password wajib diisi'),
    latar_belakang: z.string().min(3, 'Latar belakang wajib diisi'),
    dokumen_cv_url: z.string().min(1, 'Dokumen CV wajib diunggah'),
    alasan_bergabung: z.string().min(10, 'Alasan bergabung minimal 10 karakter'),
    topik_keahlian: z
      .array(
        z
          .string()
          .trim()
          .min(1, 'Item topik keahlian tidak boleh kosong')
          .max(60, 'Item topik keahlian maksimal 60 karakter')
      )
      .optional(),
  })
  .refine((data) => data.password === data.password_confirmation, {
    message: 'Konfirmasi password tidak cocok dengan password',
    path: ['password_confirmation'],
  });

export type RegisterRelawanDTO = z.infer<typeof registerRelawanSchema>;

// 3. REGISTER PSIKOLOG
export const registerPsikologSchema = z
  .object({
    nama_lengkap_gelar: z.string().trim().min(3, 'Nama lengkap beserta gelar wajib diisi'),
    email: z.string().email('Format email tidak valid'),
    no_wa: z.string().regex(phoneRegex, 'Format nomor WhatsApp tidak valid'),
    password: z.string().min(8, 'Password minimal 8 karakter'),
    password_confirmation: z.string().min(8, 'Konfirmasi password wajib diisi'),
    nomor_sipp_str: z.string().min(5, 'Nomor SIPP / STR wajib diisi'),
    dokumen_sipp_str_url: z.string().min(1, 'Dokumen SIPP / STR wajib diunggah'),
    spesialisasi: z
      .array(
        z
          .string()
          .trim()
          .min(1, 'Item spesialisasi tidak boleh kosong')
          .max(60, 'Item spesialisasi maksimal 60 karakter')
      )
      .min(1, 'Minimal pilih 1 bidang spesialisasi'),
    tahun_pengalaman: z.number().int().min(0, 'Tahun pengalaman harus bilangan positif'),
    tarif_sesi: z.number().min(0).optional().default(0),
  })
  .refine((data) => data.password === data.password_confirmation, {
    message: 'Konfirmasi password tidak cocok dengan password',
    path: ['password_confirmation'],
  });

export type RegisterPsikologDTO = z.infer<typeof registerPsikologSchema>;

// 4. LOGIN SERAGAM
export const loginSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
  remember_me: z.boolean().optional().default(false),
});

export type LoginDTO = z.infer<typeof loginSchema>;

// 5. ADMIN CREATE PSIKOLOG (sama dengan registrasi, tanpa password_confirmation, tarif kelipatan 10.000)
export const adminCreatePsikologSchema = z.object({
  nama_lengkap_gelar: z.string().trim().min(3, 'Nama lengkap beserta gelar wajib diisi (min. 3 karakter)'),
  email: z.string().email('Format email tidak valid'),
  no_wa: z.string().regex(phoneRegex, 'Format nomor WhatsApp tidak valid (contoh: 08123456789)'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
  nomor_sipp_str: z.string().min(5, 'Nomor SIPP / STR wajib diisi (min. 5 karakter)'),
  dokumen_sipp_str_url: z.string().min(1, 'Dokumen SIPP / STR wajib diunggah'),
  spesialisasi: z
    .array(
      z
        .string()
        .trim()
        .min(1, 'Item spesialisasi tidak boleh kosong')
        .max(60, 'Item spesialisasi maksimal 60 karakter')
    )
    .min(1, 'Minimal pilih 1 bidang spesialisasi'),
  tahun_pengalaman: z.number().int().min(0, 'Tahun pengalaman harus bilangan positif (≥ 0)'),
  tarif_sesi: z
    .number()
    .min(0, 'Tarif sesi tidak boleh negatif')
    .refine((val) => val % 10000 === 0, {
      message: 'Tarif sesi harus kelipatan Rp 10.000',
    }),
});

export type AdminCreatePsikologDTO = z.infer<typeof adminCreatePsikologSchema>;

// 6. ADMIN CREATE RELAWAN (sama dengan registrasi, tanpa password_confirmation)
export const adminCreateRelawanSchema = z.object({
  nama_lengkap: z.string().trim().min(2, 'Nama lengkap minimal 2 karakter'),
  email: z.string().email('Format email tidak valid'),
  no_wa: z.string().regex(phoneRegex, 'Format nomor WhatsApp tidak valid (contoh: 08123456789)'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
  latar_belakang: z.string().min(3, 'Latar belakang wajib diisi (min. 3 karakter)'),
  dokumen_cv_url: z.string().min(1, 'Dokumen CV wajib diunggah'),
  alasan_bergabung: z.string().min(10, 'Alasan bergabung minimal 10 karakter'),
  topik_keahlian: z
    .array(
      z
        .string()
        .trim()
        .min(1, 'Item topik keahlian tidak boleh kosong')
        .max(60, 'Item topik keahlian maksimal 60 karakter')
    )
    .optional(),
});

export type AdminCreateRelawanDTO = z.infer<typeof adminCreateRelawanSchema>;

// 7. ADMIN CREATE PASIEN
export const adminCreatePasienSchema = z.object({
  nama_lengkap: z.string().trim().min(2, 'Nama lengkap minimal 2 karakter'),
  email: z.string().email('Format email tidak valid'),
  no_wa: z.string().regex(phoneRegex, 'Format nomor WhatsApp tidak valid (contoh: 08123456789)'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
});

export type AdminCreatePasienDTO = z.infer<typeof adminCreatePasienSchema>;

// 8. ADMIN CREATE ADMIN
export const adminCreateAdminSchema = z.object({
  nama_lengkap: z.string().trim().min(2, 'Nama lengkap minimal 2 karakter'),
  email: z.string().email('Format email tidak valid'),
  no_wa: z.string().regex(phoneRegex, 'Format nomor WhatsApp tidak valid (contoh: 08123456789)'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
  level: z.string().optional().default('operator'),
});

export type AdminCreateAdminDTO = z.infer<typeof adminCreateAdminSchema>;
