import { z } from 'zod';

export const phoneRegex = /^(\+62|62|0)8[1-9][0-9]{6,11}$/;

// 1. REGISTER PASIEN
export const registerPasienSchema = z
  .object({
    nama_lengkap: z.string().min(2, 'Nama lengkap minimal 2 karakter'),
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
    nama_lengkap: z.string().min(2, 'Nama lengkap minimal 2 karakter'),
    email: z.string().email('Format email tidak valid'),
    no_wa: z.string().regex(phoneRegex, 'Format nomor WhatsApp tidak valid'),
    password: z.string().min(8, 'Password minimal 8 karakter'),
    password_confirmation: z.string().min(8, 'Konfirmasi password wajib diisi'),
    latar_belakang: z.string().min(3, 'Latar belakang wajib diisi'),
    dokumen_cv_url: z.string().min(1, 'Dokumen CV wajib diunggah'),
    alasan_bergabung: z.string().min(10, 'Alasan bergabung minimal 10 karakter'),
  })
  .refine((data) => data.password === data.password_confirmation, {
    message: 'Konfirmasi password tidak cocok dengan password',
    path: ['password_confirmation'],
  });

export type RegisterRelawanDTO = z.infer<typeof registerRelawanSchema>;

// 3. REGISTER PSIKOLOG
export const registerPsikologSchema = z
  .object({
    nama_lengkap_gelar: z.string().min(3, 'Nama lengkap beserta gelar wajib diisi'),
    email: z.string().email('Format email tidak valid'),
    no_wa: z.string().regex(phoneRegex, 'Format nomor WhatsApp tidak valid'),
    password: z.string().min(8, 'Password minimal 8 karakter'),
    password_confirmation: z.string().min(8, 'Konfirmasi password wajib diisi'),
    nomor_sipp_str: z.string().min(5, 'Nomor SIPP / STR wajib diisi'),
    dokumen_sipp_str_url: z.string().min(1, 'Dokumen SIPP / STR wajib diunggah'),
    spesialisasi: z.array(z.string()).min(1, 'Minimal pilih 1 bidang spesialisasi'),
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
