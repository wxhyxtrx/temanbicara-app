import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { z } from 'zod';
import {
  checkRateLimit,
  getClientIp,
  rateLimitExceededResponse,
} from '@/lib/rate-limit/distributed';

const uploadRequestSchema = z.object({
  file_name: z
    .string()
    .min(1, 'Nama file wajib diisi')
    .refine((name) => name.toLowerCase().endsWith('.pdf'), {
      message: 'Nama file wajib berakhiran .pdf',
    }),
  file_type: z.literal('application/pdf', {
    message: 'Tipe file hanya boleh application/pdf',
  }),
  document_type: z.enum(['cv', 'sipp_str']),
  user_email_or_temp_id: z.string().min(3),
});

export async function POST(req: Request) {
  try {
    // 1. Rate Limiting Terdistribusi: 10 request per 10 menit per IP (fail-open)
    const ip = getClientIp(req);
    const rateLimit = await checkRateLimit(`upload_presigned:${ip}`, 10, 600);
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(rateLimit.retryAfter);
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_PAYLOAD',
          message: 'Body request tidak valid',
        },
        { status: 400 }
      );
    }

    const parsed = uploadRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message || 'File wajib berformat PDF (maksimal 5MB)',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 422 }
      );
    }

    const { document_type, user_email_or_temp_id } = parsed.data;
    const sanitizedPrefix = user_email_or_temp_id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = `${sanitizedPrefix}/${document_type}-${crypto.randomUUID()}.pdf`;

    if (!supabaseAdmin) {
      console.error('[UploadPresignedUrl] supabaseAdmin client tidak tersedia');
      return NextResponse.json(
        {
          success: false,
          error: 'STORAGE_UPLOAD_URL_ERROR',
          message: 'Gagal menghasilkan URL upload berkas. Silakan coba kembali.',
        },
        { status: 500 }
      );
    }

    // Buat signed upload URL dengan opsi { upsert: false }
    const { data, error } = await supabaseAdmin.storage
      .from('dokumen-mitra')
      .createSignedUploadUrl(filePath, { upsert: false });

    if (error || !data) {
      console.error('[UploadPresignedUrl] Gagal membuat presigned upload URL:', error?.message);
      return NextResponse.json(
        {
          success: false,
          error: 'STORAGE_UPLOAD_URL_ERROR',
          message: 'Gagal menghasilkan URL upload berkas. Silakan coba kembali.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        upload_url: data.signedUrl,
        token: data.token,
        file_path: filePath,
        bucket: 'dokumen-mitra',
      },
    });
  } catch (err: unknown) {
    console.error(
      '[UploadPresignedUrl] Exception saat membuat presigned upload URL:',
      err instanceof Error ? err.message : String(err)
    );
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Gagal menghasilkan URL upload berkas. Silakan coba kembali.',
      },
      { status: 500 }
    );
  }
}
