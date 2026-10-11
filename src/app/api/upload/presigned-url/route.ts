import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { z } from 'zod';

const uploadRequestSchema = z.object({
  file_name: z.string().min(1, 'Nama file wajib diisi'),
  file_type: z.enum(['application/pdf', 'image/jpeg', 'image/png'], {
    message: 'Tipe file harus PDF, JPG, atau PNG',
  }),
  document_type: z.enum(['cv', 'sipp_str']),
  user_email_or_temp_id: z.string().min(3),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = uploadRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'Payload request upload tidak valid',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { file_name, document_type, user_email_or_temp_id } = parsed.data;
    const fileExt = file_name.split('.').pop();
    const sanitizedPrefix = user_email_or_temp_id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = `${sanitizedPrefix}/${document_type}-${Date.now()}.${fileExt}`;

    // Buat signed upload URL (berlaku 120 detik)
    const { data, error } = await supabaseAdmin.storage
      .from('dokumen-mitra')
      .createSignedUploadUrl(filePath);

    if (error) {
      return NextResponse.json(
        {
          error: 'STORAGE_UPLOAD_URL_ERROR',
          message: error.message,
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
  } catch (err: any) {
    return NextResponse.json(
      {
        error: 'INTERNAL_SERVER_ERROR',
        message: err.message || 'Gagal menghasilkan URL upload berkas',
      },
      { status: 500 }
    );
  }
}
