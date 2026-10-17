import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail, getSessionUser } from '@/lib/auth/session';
import { sessionMediaUploadSchema } from '@/lib/validations/booking';
import type { BookingEntity, SessionMediaUploadResponse, SessionMediaUrlResponse } from '@/types/booking';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNED_URL_EXPIRES_IN_SECONDS = 600; // 600 detik sesuai spesifikasi Task B6a

/**
 * GET /api/bookings/[id]/media-url?path=...
 * Menghasilkan signed download URL (berlaku 600 detik) untuk berkas di bucket private 'session-media'.
 * Akses khusus peserta sesi (pasien atau psikolog terkait) atau admin.
 * Verifikasi keamanan: berkas harus terdaftar di tabel session_messages pada booking terkait.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return fail(400, 'INVALID_ID', 'ID booking tidak valid');
    }

    const { searchParams } = new URL(req.url);
    const mediaPath = searchParams.get('path')?.trim();
    if (!mediaPath) {
      return fail(400, 'INVALID_PAYLOAD', 'Parameter query "path" wajib disertakan');
    }

    // Mencegah path traversal sederhana
    if (mediaPath.includes('..') || mediaPath.startsWith('/')) {
      return fail(400, 'INVALID_PATH', 'Format path berkas tidak valid');
    }

    const session = await getSessionUser();
    if (session.response) return session.response;
    const { user } = session;

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    // Ambil booking untuk cek otorisasi peserta
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('id, patient_id, psikolog_id')
      .eq('id', id)
      .maybeSingle();

    if (bookingError) {
      return fail(500, 'QUERY_FAILED', bookingError.message);
    }
    if (!booking) {
      return fail(404, 'NOT_FOUND', 'Booking sesi tidak ditemukan');
    }

    const isPatient = user.id === booking.patient_id;
    const isPsikolog = user.id === booking.psikolog_id;
    const isAdmin = user.role === 'admin';

    if (!isPatient && !isPsikolog && !isAdmin) {
      return fail(403, 'FORBIDDEN', 'Hanya peserta sesi yang dapat mengakses berkas media ini');
    }

    // Verifikasi media_path terdaftar pada booking ini
    const { data: msgMatch, error: matchError } = await supabaseAdmin
      .from('session_messages')
      .select('id')
      .eq('booking_id', id)
      .eq('media_path', mediaPath)
      .maybeSingle();

    if (matchError) {
      return fail(500, 'QUERY_FAILED', matchError.message);
    }
    if (!msgMatch) {
      return fail(404, 'MEDIA_NOT_FOUND', 'Berkas media tidak ditemukan pada riwayat obrolan sesi ini');
    }

    // Buat signed URL dari bucket session-media
    const { data: signedData, error: signError } = await supabaseAdmin.storage
      .from('session-media')
      .createSignedUrl(mediaPath, SIGNED_URL_EXPIRES_IN_SECONDS);

    if (signError || !signedData?.signedUrl) {
      return fail(
        500,
        'STORAGE_ERROR',
        signError?.message || 'Gagal menghasilkan signed URL media'
      );
    }

    const responseData: SessionMediaUrlResponse = {
      signed_url: signedData.signedUrl,
      expires_in: SIGNED_URL_EXPIRES_IN_SECONDS,
    };

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (err: unknown) {
    return fail(
      500,
      'INTERNAL_SERVER_ERROR',
      err instanceof Error ? err.message : 'Gagal memproses permintaan media URL'
    );
  }
}

/**
 * POST /api/bookings/[id]/media-url
 * Menghasilkan signed upload URL untuk mengunggah gambar atau rekaman suara ke bucket 'session-media'.
 * Akses khusus peserta sesi saat status aktif (booked/in_progress) dan dalam jendela waktu sesi.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return fail(400, 'INVALID_ID', 'ID booking tidak valid');
    }

    const session = await getSessionUser();
    if (session.response) return session.response;
    const { user } = session;

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return fail(400, 'INVALID_PAYLOAD', 'Body request tidak valid');
    }

    const parsed = sessionMediaUploadSchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        422,
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message || 'Data berkas unggahan tidak valid'
      );
    }

    // Ambil data booking lengkap
    const { data: bookingData, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (bookingError) {
      return fail(500, 'QUERY_FAILED', bookingError.message);
    }
    if (!bookingData) {
      return fail(404, 'NOT_FOUND', 'Booking sesi tidak ditemukan');
    }

    const booking = bookingData as BookingEntity;

    const isPatient = user.id === booking.patient_id;
    const isPsikolog = user.id === booking.psikolog_id;

    if (!isPatient && !isPsikolog) {
      return fail(403, 'FORBIDDEN', 'Hanya peserta sesi yang dapat mengunggah berkas');
    }

    if (booking.status !== 'booked' && booking.status !== 'in_progress') {
      return fail(
        400,
        'INVALID_BOOKING_STATUS',
        `Unggah berkas tidak diizinkan saat status sesi ${booking.status}`
      );
    }

    // Verifikasi jendela waktu sesi (10 menit sebelum s/d selesai)
    const nowMs = Date.now();
    const startMs = new Date(booking.start_at).getTime();
    const openMs = startMs - 10 * 60 * 1000;
    const durationMinutes = booking.extension_status === 'approved' ? 55 : 45;
    const endMs = Math.min(
      startMs + durationMinutes * 60 * 1000,
      startMs + 58 * 60 * 1000
    );

    if (nowMs < openMs) {
      return fail(400, 'SESSION_NOT_STARTED', 'Unggah berkas baru dibuka 10 menit sebelum sesi dimulai');
    }
    if (nowMs > endMs) {
      return fail(400, 'SESSION_WINDOW_CLOSED', 'Waktu sesi telah berakhir, tidak dapat mengunggah berkas');
    }

    // Tentukan ekstensi berkas yang aman
    const rawExt = parsed.data.file_name.split('.').pop()?.toLowerCase() || '';
    const safeExt = /^[a-z0-9]{2,5}$/.test(rawExt)
      ? rawExt
      : (parsed.data.kind === 'image' ? 'jpg' : 'webm');

    const randomSuffix = crypto.randomBytes(4).toString('hex');
    const filePath = `${id}/${user.id}-${Date.now()}-${randomSuffix}.${safeExt}`;

    // Buat signed upload URL dari bucket session-media
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('session-media')
      .createSignedUploadUrl(filePath);

    if (uploadError || !uploadData?.signedUrl) {
      return fail(
        500,
        'STORAGE_UPLOAD_ERROR',
        uploadError?.message || 'Gagal menghasilkan URL unggah media'
      );
    }

    const responsePayload: SessionMediaUploadResponse = {
      upload_url: uploadData.signedUrl,
      token: uploadData.token,
      file_path: filePath,
      bucket: 'session-media',
    };

    return NextResponse.json({
      success: true,
      data: responsePayload,
    });
  } catch (err: unknown) {
    return fail(
      500,
      'INTERNAL_SERVER_ERROR',
      err instanceof Error ? err.message : 'Gagal menghasilkan upload URL'
    );
  }
}
