import { z } from 'zod';

export const createBookingSchema = z.object({
  psikolog_id: z
    .string()
    .uuid('Format ID psikolog tidak valid'),
  start_at: z
    .string()
    .refine((val) => Number.isFinite(Date.parse(val)), {
      message: 'Format start_at harus berupa timestamp ISO yang valid',
    }),
  keluhan: z
    .string()
    .trim()
    .min(20, 'Keluhan minimal 20 karakter')
    .max(1000, 'Keluhan maksimal 1000 karakter'),
});

export const rescheduleBookingSchema = z.object({
  new_start_at: z
    .string()
    .refine((val) => Number.isFinite(Date.parse(val)), {
      message: 'Format new_start_at harus berupa timestamp ISO yang valid',
    }),
});

export const bookingQuerySchema = z.object({
  scope: z.enum(['upcoming', 'history']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type RescheduleBookingInput = z.infer<typeof rescheduleBookingSchema>;
export type BookingQueryInput = z.infer<typeof bookingQuerySchema>;

const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_VOICE_MIME_TYPES = [
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/m4a',
  'audio/x-m4a',
];

export const sendSessionMessageSchema = z
  .object({
    kind: z.enum(['text', 'image', 'voice'], {
      message: 'Jenis pesan harus text, image, atau voice',
    }),
    body: z
      .string()
      .max(4000, 'Pesan teks maksimal 4000 karakter')
      .optional()
      .nullable(),
    media_path: z
      .string()
      .max(500, 'Path media maksimal 500 karakter')
      .optional()
      .nullable(),
    duration_seconds: z
      .number()
      .int('Durasi harus berupa bilangan bulat')
      .min(0, 'Durasi tidak boleh negatif')
      .optional()
      .nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.kind === 'text') {
      if (!data.body || data.body.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Pesan teks tidak boleh kosong',
          path: ['body'],
        });
      }
    } else {
      if (!data.media_path || data.media_path.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Path berkas media wajib diisi untuk pesan media',
          path: ['media_path'],
        });
      }
    }
  });

export const sessionMediaUploadSchema = z
  .object({
    file_name: z.string().min(1, 'Nama file wajib diisi').max(255),
    file_type: z.string().min(1, 'Tipe file wajib diisi'),
    kind: z.enum(['image', 'voice'], {
      message: 'Kategori media harus image atau voice',
    }),
  })
  .superRefine((data, ctx) => {
    const mime = data.file_type.toLowerCase();
    if (data.kind === 'image') {
      if (!ALLOWED_IMAGE_MIME_TYPES.includes(mime)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Format gambar hanya boleh JPG, PNG, atau WebP',
          path: ['file_type'],
        });
      }
    } else if (data.kind === 'voice') {
      if (!ALLOWED_VOICE_MIME_TYPES.includes(mime)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Format rekaman suara tidak didukung (harus webm, ogg, mp4, mpeg, wav, atau m4a)',
          path: ['file_type'],
        });
      }
    }
  });

export type SendSessionMessageInput = z.infer<typeof sendSessionMessageSchema>;
export type SessionMediaUploadInput = z.infer<typeof sessionMediaUploadSchema>;

export const extensionRespondSchema = z.object({
  approve: z.boolean({
    message: 'Keputusan approve harus berupa boolean (true atau false)',
  }),
});

export type ExtensionRespondInput = z.infer<typeof extensionRespondSchema>;

export const updateClientNoteSchema = z.object({
  body: z
    .string({ message: 'Catatan wajib diisi' })
    .max(5000, 'Catatan maksimal 5000 karakter'),
});

export type UpdateClientNoteInput = z.infer<typeof updateClientNoteSchema>;



