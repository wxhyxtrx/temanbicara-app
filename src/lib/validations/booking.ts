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

export const SESSION_IMAGE_MIME_EXTENSIONS: Record<string, readonly string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
};

export const SESSION_VOICE_MIME_EXTENSIONS: Record<string, readonly string[]> = {
  'audio/webm': ['webm'],
  'audio/ogg': ['ogg'],
  'audio/mp4': ['m4a', 'mp4'],
  'audio/mpeg': ['mp3', 'mpeg'],
  'audio/wav': ['wav'],
  'audio/m4a': ['m4a'],
  'audio/x-m4a': ['m4a'],
};

export const ALLOWED_IMAGE_MIME_TYPES = Object.keys(SESSION_IMAGE_MIME_EXTENSIONS);
export const ALLOWED_VOICE_MIME_TYPES = Object.keys(SESSION_VOICE_MIME_EXTENSIONS);

export const ALLOWED_SESSION_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const;
export const ALLOWED_SESSION_VOICE_EXTENSIONS = [
  'webm',
  'ogg',
  'm4a',
  'mp4',
  'mp3',
  'mpeg',
  'wav',
] as const;
export const ALLOWED_SESSION_MEDIA_EXTENSIONS = [
  ...ALLOWED_SESSION_IMAGE_EXTENSIONS,
  ...ALLOWED_SESSION_VOICE_EXTENSIONS,
] as const;

export interface SessionMediaPathValidationOptions {
  kind?: 'image' | 'voice';
  mimeType?: string;
}

const BOOKING_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SESSION_MEDIA_FILE_RE =
  /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})-([1-9]\d*)-([0-9a-f]{8})\.([a-z0-9]{2,5})$/;

/**
 * Menentukan ekstensi berkas media sesi konseling yang aman berdasarkan MIME type dan kategori media.
 * Hanya mengizinkan ekstensi yang terdaftar untuk MIME type terkait; jika nama berkas asli memiliki
 * ekstensi lain (misal .exe, .png pada image/jpeg, atau tanpa ekstensi), fallback ke ekstensi kanonik MIME.
 */
export function resolveSessionMediaExtension(
  fileName: string,
  fileType: string,
  kind: 'image' | 'voice'
): string {
  const mime = (fileType || '').trim().toLowerCase();
  const mimeMap =
    kind === 'image' ? SESSION_IMAGE_MIME_EXTENSIONS : SESSION_VOICE_MIME_EXTENSIONS;
  const allowedForMime = mimeMap[mime] ?? (kind === 'image' ? ['jpg'] : ['webm']);

  const trimmedName = (fileName || '').trim();
  const dotIndex = trimmedName.lastIndexOf('.');
  const rawExt = dotIndex > 0 ? trimmedName.slice(dotIndex + 1).toLowerCase() : '';

  if (rawExt && allowedForMime.includes(rawExt)) {
    return rawExt;
  }
  return allowedForMime[0];
}

/**
 * Memvalidasi apakah format media_path sesi konseling aman dan terikat pada booking tertentu:
 * - Tidak boleh kosong, bukan string, atau memiliki spasi di awal/akhir
 * - Tidak boleh mengandung traversal ('..'), backslash ('\'), atau diawali slash ('/')
 * - Tidak boleh berupa path peer ('peer/...')
 * - Wajib terdiri dari tepat 2 segmen: `${bookingId}/${userId}-${timestamp}-${random}.${ext}`
 * - Segmen pertama wajib UUID valid dan cocok dengan bookingId
 * - Segmen kedua wajib memiliki userId UUID, timestamp milidetik positif, random 8 hex lowercase,
 *   dan ekstensi yang diizinkan oleh generator media sesi (serta cocok dengan kind/mimeType bila diberikan)
 */
export function isValidSessionMediaPath(
  bookingId: string,
  mediaPath?: string | null,
  kindOrOptions?: 'image' | 'voice' | SessionMediaPathValidationOptions
): boolean {
  if (!bookingId || typeof bookingId !== 'string' || bookingId !== bookingId.trim()) {
    return false;
  }
  if (!BOOKING_UUID_RE.test(bookingId)) {
    return false;
  }
  if (
    !mediaPath ||
    typeof mediaPath !== 'string' ||
    mediaPath !== mediaPath.trim() ||
    mediaPath.length > 500
  ) {
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
  if (!(ALLOWED_SESSION_MEDIA_EXTENSIONS as readonly string[]).includes(ext)) {
    return false;
  }

  const expectedKind =
    typeof kindOrOptions === 'string' ? kindOrOptions : kindOrOptions?.kind;
  const expectedMime =
    typeof kindOrOptions === 'object' && kindOrOptions !== null
      ? kindOrOptions.mimeType?.trim().toLowerCase()
      : undefined;

  if (expectedKind === 'image') {
    if (!(ALLOWED_SESSION_IMAGE_EXTENSIONS as readonly string[]).includes(ext)) {
      return false;
    }
  } else if (expectedKind === 'voice') {
    if (!(ALLOWED_SESSION_VOICE_EXTENSIONS as readonly string[]).includes(ext)) {
      return false;
    }
  }

  if (expectedMime) {
    const allowedByMime =
      expectedKind === 'image'
        ? SESSION_IMAGE_MIME_EXTENSIONS[expectedMime]
        : expectedKind === 'voice'
          ? SESSION_VOICE_MIME_EXTENSIONS[expectedMime]
          : (SESSION_IMAGE_MIME_EXTENSIONS[expectedMime] ??
            SESSION_VOICE_MIME_EXTENSIONS[expectedMime]);

    if (!allowedByMime || !allowedByMime.includes(ext)) {
      return false;
    }
  }

  return true;
}

/**
 * Self-test terstruktur untuk memverifikasi perilaku isValidSessionMediaPath dan resolveSessionMediaExtension.
 * Dapat dijalankan langsung melalui:
 *   npx tsx src/lib/validations/booking.ts
 */
export function verifySessionMediaPathValidation(): { passed: number } {
  const bookingA = '11111111-1111-4111-8111-111111111111';
  const bookingB = '99999999-9999-4999-8999-999999999999';
  const userA = '22222222-2222-4222-8222-222222222222';
  const ts = '1794400000000';
  const rand = 'a1b2c3d4';

  const assertCase = (condition: boolean, label: string) => {
    if (!condition) {
      throw new Error(`Session media path validation self-test failed: ${label}`);
    }
  };

  let passed = 0;
  const check = (condition: boolean, label: string) => {
    assertCase(condition, label);
    passed += 1;
  };

  // 1. Resolusi ekstensi generator server berdasarkan MIME & kind
  check(
    resolveSessionMediaExtension('evil.exe', 'image/jpeg', 'image') === 'jpg',
    'image/jpeg dengan nama .exe wajib menghasilkan .jpg'
  );
  check(
    resolveSessionMediaExtension('photo.jpeg', 'image/jpeg', 'image') === 'jpeg',
    'image/jpeg dengan nama .jpeg tetap .jpeg'
  );
  check(
    resolveSessionMediaExtension('spoof.jpg', 'image/png', 'image') === 'png',
    'image/png dengan nama .jpg wajib mengikuti MIME .png'
  );
  check(
    resolveSessionMediaExtension('banner.webp', 'image/webp', 'image') === 'webp',
    'image/webp menghasilkan .webp'
  );
  check(
    resolveSessionMediaExtension('payload.exe', 'audio/webm', 'voice') === 'webm',
    'audio/webm dengan nama .exe wajib menghasilkan .webm'
  );
  check(
    resolveSessionMediaExtension('voice.mp3', 'audio/mpeg', 'voice') === 'mp3',
    'audio/mpeg dengan nama .mp3 menghasilkan .mp3'
  );
  check(
    resolveSessionMediaExtension('voice.mp4', 'audio/mp4', 'voice') === 'mp4',
    'audio/mp4 dengan nama .mp4 menghasilkan .mp4'
  );
  check(
    resolveSessionMediaExtension('blob', 'audio/x-m4a', 'voice') === 'm4a',
    'audio/x-m4a tanpa ekstensi menghasilkan .m4a'
  );

  // 2. Seluruh ekstensi valid hasil generator diterima
  for (const ext of ALLOWED_SESSION_IMAGE_EXTENSIONS) {
    const path = `${bookingA}/${userA}-${ts}-${rand}.${ext}`;
    check(isValidSessionMediaPath(bookingA, path), `ekstensi image valid .${ext} diterima`);
    check(
      isValidSessionMediaPath(bookingA, path, 'image'),
      `ekstensi image .${ext} diterima untuk kind=image`
    );
    check(
      !isValidSessionMediaPath(bookingA, path, 'voice'),
      `ekstensi image .${ext} ditolak untuk kind=voice`
    );
  }

  for (const ext of ALLOWED_SESSION_VOICE_EXTENSIONS) {
    const path = `${bookingA}/${userA}-${ts}-${rand}.${ext}`;
    check(isValidSessionMediaPath(bookingA, path), `ekstensi voice valid .${ext} diterima`);
    check(
      isValidSessionMediaPath(bookingA, path, 'voice'),
      `ekstensi voice .${ext} diterima untuk kind=voice`
    );
    check(
      !isValidSessionMediaPath(bookingA, path, 'image'),
      `ekstensi voice .${ext} ditolak untuk kind=image`
    );
  }

  // 3. Kasus lintas booking, peer path, traversal, ekstensi terlarang, dan bentuk salah ditolak
  const validWebp = `${bookingA}/${userA}-${ts}-${rand}.webp`;
  check(
    isValidSessionMediaPath(bookingA.toUpperCase(), validWebp),
    'bookingId case-insensitive UUID tetap cocok'
  );
  check(
    !isValidSessionMediaPath(bookingB, validWebp),
    'path milik booking lain wajib ditolak'
  );
  check(
    !isValidSessionMediaPath(bookingA, `peer/${bookingA}/${userA}-${ts}-${rand}.webp`),
    'path peer/ dengan bookingId sama wajib ditolak'
  );
  check(
    !isValidSessionMediaPath(bookingA, `peer/${bookingA}/file.webp`),
    'path peer singkat wajib ditolak'
  );
  check(
    !isValidSessionMediaPath(bookingA, `${bookingA}/../${bookingA}/${userA}-${ts}-${rand}.webp`),
    'traversal .. wajib ditolak'
  );
  check(
    !isValidSessionMediaPath(bookingA, `/${validWebp}`),
    'leading slash wajib ditolak'
  );
  check(
    !isValidSessionMediaPath(bookingA, `${bookingA}\\${userA}-${ts}-${rand}.webp`),
    'backslash wajib ditolak'
  );
  check(
    !isValidSessionMediaPath(bookingA, `${bookingA}/sub/${userA}-${ts}-${rand}.webp`),
    'segmen tambahan wajib ditolak'
  );
  check(
    !isValidSessionMediaPath(bookingA, `${bookingA}/${userA}-${ts}-${rand}.exe`),
    'ekstensi .exe wajib ditolak'
  );
  check(
    !isValidSessionMediaPath(bookingA, `${bookingA}/${userA}-${ts}-${rand}.svg`),
    'ekstensi .svg wajib ditolak'
  );
  check(
    !isValidSessionMediaPath(bookingA, `${bookingA}/${userA}-${ts}-${rand}.html`),
    'ekstensi .html wajib ditolak'
  );
  check(
    !isValidSessionMediaPath(bookingA, `${bookingA}/${userA}-${ts}-${rand}.WEBP`),
    'ekstensi uppercase wajib ditolak'
  );
  check(
    !isValidSessionMediaPath(bookingA, `${bookingA}/not-a-uuid-${ts}-${rand}.webp`),
    'userId bukan UUID wajib ditolak'
  );
  check(
    !isValidSessionMediaPath(bookingA, `${bookingA}/${userA}-0-${rand}.webp`),
    'timestamp 0 wajib ditolak'
  );
  check(
    !isValidSessionMediaPath(bookingA, `${bookingA}/${userA}-${ts}-A1B2C3D4.webp`),
    'random hex uppercase wajib ditolak'
  );
  check(
    !isValidSessionMediaPath(bookingA, `${bookingA}/${userA}-${ts}-a1b2c3.webp`),
    'random hex kurang dari 8 karakter wajib ditolak'
  );
  check(
    !isValidSessionMediaPath(bookingA, ` ${validWebp}`),
    'spasi di awal path wajib ditolak'
  );
  check(!isValidSessionMediaPath(bookingA, ''), 'path kosong wajib ditolak');
  check(!isValidSessionMediaPath(bookingA, null), 'path null wajib ditolak');
  check(!isValidSessionMediaPath('not-a-uuid', validWebp), 'bookingId invalid wajib ditolak');
  check(
    !isValidSessionMediaPath(bookingA, validWebp, { kind: 'image', mimeType: 'image/png' }),
    'mismatch ekstensi .webp terhadap mimeType image/png wajib ditolak'
  );
  check(
    isValidSessionMediaPath(bookingA, validWebp, { kind: 'image', mimeType: 'image/webp' }),
    'kecocokan ekstensi .webp terhadap mimeType image/webp diterima'
  );

  return { passed };
}

if (
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  typeof process.argv[1] === 'string' &&
  process.argv[1].replace(/\\/g, '/').endsWith('src/lib/validations/booking.ts')
) {
  const result = verifySessionMediaPathValidation();
  console.log(`SESSION_MEDIA_PATH_SELFTEST_OK (${result.passed} assertions passed)`);
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




