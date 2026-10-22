import { z } from 'zod';

export const createPeerTicketSchema = z
  .object({
    patient_alias: z
      .string()
      .trim()
      .min(2, 'Nama samaran minimal 2 karakter')
      .max(50, 'Nama samaran maksimal 50 karakter')
      .optional(),
    alias: z
      .string()
      .trim()
      .min(2, 'Nama samaran minimal 2 karakter')
      .max(50, 'Nama samaran maksimal 50 karakter')
      .optional(),
    topic: z
      .string({ message: 'Topik curhat wajib diisi' })
      .trim()
      .min(2, 'Topik curhat minimal 2 karakter')
      .max(50, 'Topik curhat maksimal 50 karakter'),
    emotion: z
      .string({ message: 'Kondisi perasaan wajib diisi' })
      .trim()
      .min(2, 'Kondisi perasaan minimal 2 karakter')
      .max(50, 'Kondisi perasaan maksimal 50 karakter'),
    content: z
      .string({ message: 'Cerita curhat wajib diisi' })
      .trim()
      .min(10, 'Cerita curhat minimal 10 karakter')
      .max(2000, 'Cerita curhat maksimal 2000 karakter'),
    is_anonymous: z.boolean().default(true),
  })
  .transform((data) => {
    const finalAlias = data.patient_alias || data.alias;
    return {
      ...data,
      patient_alias: finalAlias!,
    };
  })
  .refine((data) => Boolean(data.patient_alias), {
    message: 'Nama samaran wajib diisi',
    path: ['patient_alias'],
  });

export type CreatePeerTicketInput = z.infer<typeof createPeerTicketSchema>;

export const peerReviewSchema = z.object({
  rating: z
    .number({ message: 'Rating wajib diisi' })
    .int('Rating harus berupa bilangan bulat')
    .min(1, 'Rating minimal 1 bintang')
    .max(5, 'Rating maksimal 5 bintang'),
  review: z
    .string()
    .trim()
    .max(500, 'Ulasan maksimal 500 karakter')
    .nullable()
    .optional(),
});

export type PeerReviewInput = z.infer<typeof peerReviewSchema>;

export const peerTipSchema = z.object({
  coins: z
    .number({ message: 'Jumlah koin wajib diisi' })
    .int('Jumlah koin harus berupa bilangan bulat')
    .positive('Jumlah koin harus lebih dari 0'),
  tip_id: z.string().uuid('Format tip_id tidak valid').optional(),
});

export type PeerTipInput = z.infer<typeof peerTipSchema>;
