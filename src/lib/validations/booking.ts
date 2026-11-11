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

const BOOKING_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SESSION_MEDIA_FILE_RE =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-([1-9]\d*)-([0-9a-f]{8})\.([a-z0-9]{2,5})$/i;

/**
 * Memvalidasi apakah format media_path sesi konseling aman dan terikat pada booking tertentu:
 * - Tidak boleh kosong, bukan string, atau memiliki spasi di awal/akhir
 * - Tidak boleh mengandung traversal ('..'), backslash ('\'), atau diawali slash ('/')
 * - Tidak boleh berupa path peer ('peer/...')
 * - Wajib terdiri dari tepat 2 segmen: `${bookingId}/${userId}-${timestamp}-${random}.${ext}`
 * - Segmen pertama wajib UUID valid dan cocok dengan bookingId
 * - Segmen kedua wajib memiliki userId UUID, timestamp milidetik positif, random 8 hex lowercase, dan ekstensi 2-5 alfanumerik lowercase
 */
export function isValidSessionMediaPath(bookingId: string, mediaPath?: string | null): boolean {
  if (!bookingId || typeof bookingId !== 'string' || bookingId !== bookingId.trim()) {
    return false;
  }
  if (!BOOKING_UUID_RE.test(bookingId)) {
    return false;
  }
  if (!mediaPath || typeof mediaPath !== 'string' || mediaPath !== mediaPath.trim()) {
    return false;
  }
  if (
    mediaPath.startsWith('/') ||
    mediaPath.includes('\\') ||
    mediaPath.includes('..') ||
    mediaPath.toLowerCase().startsWith('peer/')
  ) {
    return false;
  }

  const segments = mediaPath.split('/');
  if (segments.length !== 2) {
    return false;
  }

  const [folderId, fileName] = segments;
  if (!folderId || !fileName) {
    return false;
  }
  if (!BOOKING_UUID_RE.test(folderId) || folderId.toLowerCase() !== bookingId.toLowerCase()) {
    return false;
  }

  const match = SESSION_MEDIA_FILE_RE.exec(fileName);
  if (!match) {
    return false;
  }

  const [, userId, timestampStr, randomHex, ext] = match;
  if (!BOOKING_UUID_RE.test(userId)) {
    return false;
  }
  const timestamp = Number(timestampStr);
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0) {
    return false;
  }
  if (!/^[0-9a-f]{8}$/.test(randomHex)) {
    return false;
  }
  if (!/^[a-z0-9]{2,5}$/.test(ext)) {
    return false;
  }

  return true;
}

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

/**
 * Task B8: Validations untuk Review, Tip & Moderasi Ulasan
 */
export const reviewUpsertSchema = z.object({
  rating: z
    .number({ message: 'Rating wajib diisi' })
    .int('Rating harus berupa bilangan bulat')
    .min(1, 'Rating minimal 1 bintang')
    .max(5, 'Rating maksimal 5 bintang'),
  review: z
    .string()
    .trim()
    .max(500, 'Ulasan maksimal 500 karakter')
    .optional()
    .nullable(),
});

export const sessionTipSchema = z.object({
  coins: z
    .number({ message: 'Jumlah koin tip wajib diisi' })
    .int('Jumlah koin harus berupa bilangan bulat')
    .positive('Jumlah koin tip harus lebih dari 0'),
});

export const reviewHideSchema = z.object({
  is_hidden: z.boolean({
    message: 'is_hidden harus berupa boolean (true atau false)',
  }),
});

export type ReviewUpsertInput = z.infer<typeof reviewUpsertSchema>;
export type SessionTipInput = z.infer<typeof sessionTipSchema>;
export type ReviewHideInput = z.infer<typeof reviewHideSchema>;




