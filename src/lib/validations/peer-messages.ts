import { z } from 'zod';

export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ALLOWED_VOICE_MIME_TYPES = [
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/m4a',
  'audio/x-m4a',
];

export const sendPeerMessageSchema = z
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
      .max(180, 'Durasi rekaman suara maksimal 180 detik')
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

export const peerMediaUploadSchema = z
  .object({
    file_name: z.string().min(1, 'Nama file wajib diisi').max(255),
    file_type: z.string().min(1, 'Tipe file wajib diisi'),
    kind: z.enum(['image', 'voice'], {
      message: 'Kategori media harus image atau voice',
    }),
    file_size: z
      .number()
      .int('Ukuran file harus berupa bilangan bulat')
      .min(0, 'Ukuran file tidak boleh negatif')
      .max(10 * 1024 * 1024, 'Ukuran berkas gambar maksimal 10MB')
      .optional()
      .nullable(),
    duration_seconds: z
      .number()
      .int('Durasi harus berupa bilangan bulat')
      .min(0, 'Durasi tidak boleh negatif')
      .max(180, 'Durasi rekaman suara maksimal 180 detik')
      .optional()
      .nullable(),
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
      if (typeof data.file_size === 'number' && data.file_size > 10 * 1024 * 1024) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Ukuran berkas gambar maksimal 10MB',
          path: ['file_size'],
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
      if (typeof data.duration_seconds === 'number' && data.duration_seconds > 180) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Durasi rekaman suara maksimal 180 detik',
          path: ['duration_seconds'],
        });
      }
    }
  });

export type SendPeerMessageInput = z.infer<typeof sendPeerMessageSchema>;
export type PeerMediaUploadInput = z.infer<typeof peerMediaUploadSchema>;

export type PeerMessageKind = 'text' | 'image' | 'voice';

export interface PeerMessageEntity {
  id: string;
  ticket_id: string;
  sender_id: string;
  kind: PeerMessageKind;
  body: string | null;
  media_path: string | null;
  duration_seconds: number | null;
  created_at: string;
}

export interface PeerMessageView {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_role: 'pasien' | 'relawan';
  sender_name: string;
  is_mine: boolean;
  kind: PeerMessageKind;
  body: string | null;
  media_path: string | null;
  duration_seconds: number | null;
  created_at: string;
}

export interface SendPeerMessagePayload {
  kind: PeerMessageKind;
  body?: string | null;
  media_path?: string | null;
  duration_seconds?: number | null;
}

export interface PeerMediaUploadPayload {
  file_name: string;
  file_type: string;
  kind: 'image' | 'voice';
  file_size?: number | null;
  duration_seconds?: number | null;
}

export interface PeerMediaUploadResponse {
  upload_url: string;
  token?: string;
  file_path: string;
  bucket: string;
}

export interface PeerMediaUrlResponse {
  signed_url: string;
  expires_in: number;
}
