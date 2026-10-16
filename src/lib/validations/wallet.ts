import { z } from 'zod';

export const createTopupOrderSchema = z.object({
  coins: z
    .number()
    .int('Jumlah koin harus berupa bilangan bulat')
    .min(1, 'Jumlah koin minimal 1'),
});

export const requestPayoutSchema = z.object({
  amount_rupiah: z
    .number()
    .int('Nominal penarikan harus berupa bilangan bulat')
    .min(10000, 'Nominal penarikan minimal Rp 10.000'),
  bank_name: z
    .string()
    .trim()
    .min(2, 'Nama bank minimal 2 karakter')
    .max(50, 'Nama bank maksimal 50 karakter'),
  account_number: z
    .string()
    .trim()
    .min(4, 'Nomor rekening minimal 4 karakter')
    .max(30, 'Nomor rekening maksimal 30 karakter'),
  bank_account_name: z
    .string()
    .trim()
    .min(2, 'Nama pemilik rekening minimal 2 karakter')
    .max(150, 'Nama pemilik rekening maksimal 150 karakter'),
});

export const adminPayoutQuerySchema = z.object({
  status: z.enum(['requested', 'paid', 'rejected']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
