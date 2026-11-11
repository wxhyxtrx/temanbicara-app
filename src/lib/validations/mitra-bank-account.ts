import { z } from 'zod';
import { POPULAR_BANKS } from '@/constant/banks';

export const saveMitraBankAccountSchema = z.object({
  bank_name: z.enum(POPULAR_BANKS, {
    message: 'Pilihan bank tidak valid atau belum didukung',
  }),
  account_number: z
    .string()
    .trim()
    .regex(/^\d{6,20}$/, 'Nomor rekening harus berupa 6 sampai 20 digit angka'),
  bank_account_name: z
    .string()
    .trim()
    .min(1, 'Nama pemilik rekening wajib diisi')
    .max(150, 'Nama pemilik rekening maksimal 150 karakter'),
});

export type SaveMitraBankAccountInput = z.infer<typeof saveMitraBankAccountSchema>;
