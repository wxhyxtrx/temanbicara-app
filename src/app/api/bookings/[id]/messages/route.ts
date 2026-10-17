import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail, getSessionUser } from '@/lib/auth/session';
import { sendSessionMessageSchema } from '@/lib/validations/booking';
import { SystemSettingsService } from '@/services/system-settings.service';
import type { BookingEntity, SessionMessageEntity, SessionMessageView } from '@/types/booking';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/bookings/[id]/messages
 * Mengambil daftar pesan sesi konseling (teks, gambar, pesan suara).
 * Akses khusus untuk peserta sesi (pasien atau psikolog) dan admin.
 * Data pribadi pasien tetap disaring (psikolog hanya melihat patient_display_name).
 */
export async function GET(
  _req: Request,
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

    // Ambil data booking untuk verifikasi peserta
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('id, patient_id, psikolog_id, status, start_at, patient_display_name, extension_status')
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
      return fail(403, 'FORBIDDEN', 'Hanya peserta sesi yang dapat mengakses pesan obrolan');
    }

    // Ambil pesan dan nama tampilan psikolog secara paralel
    const [messagesRes, profileRes] = await Promise.all([
      supabaseAdmin
        .from('session_messages')
        .select('*')
        .eq('booking_id', id)
        .order('created_at', { ascending: true }),
      supabaseAdmin
        .from('psikolog_profiles')
        .select('nama_lengkap_gelar')
        .eq('user_id', booking.psikolog_id)
        .maybeSingle(),
    ]);

    if (messagesRes.error) {
      return fail(500, 'QUERY_FAILED', messagesRes.error.message);
    }

    const psikologName = profileRes.data?.nama_lengkap_gelar || 'Psikolog';
    const patientName = booking.patient_display_name || 'Pasien Anonim';

    const rawMessages = (messagesRes.data || []) as SessionMessageEntity[];

    const messagesView: SessionMessageView[] = rawMessages.map((msg) => {
      const isMsgFromPsikolog = msg.sender_id === booking.psikolog_id;
      return {
        id: msg.id,
        booking_id: msg.booking_id,
        sender_id: msg.sender_id,
        sender_role: isMsgFromPsikolog ? 'psikolog' : 'pasien',
        sender_name: isMsgFromPsikolog ? psikologName : patientName,
        is_mine: msg.sender_id === user.id,
        kind: msg.kind,
        body: msg.body,
        media_path: msg.media_path,
        duration_seconds: msg.duration_seconds,
        created_at: msg.created_at,
      };
    });

    return NextResponse.json({
      success: true,
      data: messagesView,
    });
  } catch (err: unknown) {
    return fail(
      500,
      'INTERNAL_SERVER_ERROR',
      err instanceof Error ? err.message : 'Gagal memuat pesan sesi'
    );
  }
}

/**
 * POST /api/bookings/[id]/messages
 * Mengirim pesan baru dalam sesi konseling.
 * Batasan:
 * - Hanya peserta sesi (pasien atau psikolog).
 * - Status booking harus 'booked' atau 'in_progress'.
 * - Waktu kirim harus antara start_at - 10 menit s/d batas akhir:
 *   (start_at + 45 menit; +55 menit jika extension_status = 'approved'; plafon maksimal +58 menit).
 * - Trigger di database akan otomatis mengubah status booked -> in_progress saat pesan pertama psikolog,
 *   serta menandai psikolog_late jika pesan pertama psikolog > start_at.
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

    const parsed = sendSessionMessageSchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        422,
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message || 'Data pesan tidak valid'
      );
    }

    // Ambil data booking lengkap untuk verifikasi peserta, status, dan jendela waktu sesi
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

    // Verifikasi kepesertaan (hanya pasien atau psikolog terkait yang dapat mengirim pesan)
    const isPatient = user.id === booking.patient_id;
    const isPsikolog = user.id === booking.psikolog_id;

    if (!isPatient && !isPsikolog) {
      return fail(403, 'FORBIDDEN', 'Hanya peserta sesi yang berhak mengirim pesan');
    }

    // Verifikasi status booking: hanya 'booked' atau 'in_progress'
    if (booking.status !== 'booked' && booking.status !== 'in_progress') {
      return fail(
        400,
        'INVALID_BOOKING_STATUS',
        `Pesan tidak dapat dikirim karena status sesi saat ini adalah ${booking.status}`
      );
    }

    // Verifikasi jendela waktu pengiriman pesan:
    // Mulai: start_at - 10 menit
    // Akhir: start_at + 45 menit (+55 jika extension approved; plafon batas maksimal 58 menit)
    const nowMs = Date.now();
    const startMs = new Date(booking.start_at).getTime();
    if (!Number.isFinite(startMs)) {
      return fail(500, 'INVALID_SESSION_TIME', 'Format jadwal booking tidak valid');
    }

    const openMs = startMs - 10 * 60 * 1000;
    const durationMinutes = booking.extension_status === 'approved' ? 55 : 45;
    const endMs = Math.min(
      startMs + durationMinutes * 60 * 1000,
      startMs + 58 * 60 * 1000
    );

    if (nowMs < openMs) {
      return fail(
        400,
        'SESSION_NOT_STARTED',
        'Ruang obrolan sesi baru dibuka 10 menit sebelum waktu mulai konseling'
      );
    }

    if (nowMs > endMs) {
      return fail(
        400,
        'SESSION_WINDOW_CLOSED',
        'Waktu sesi telah berakhir, pesan baru tidak dapat dikirim'
      );
    }

    // Validasi tambahan jika jenis pesan adalah rekaman suara (voice note)
    if (parsed.data.kind === 'voice') {
      const publicSettings = await SystemSettingsService.getPublicSettings().catch(() => null);
      const maxSeconds = publicSettings?.upload?.voice_note_max_seconds ?? 180;

      if (parsed.data.duration_seconds && parsed.data.duration_seconds > maxSeconds) {
        return fail(
          422,
          'VOICE_NOTE_TOO_LONG',
          `Durasi rekaman suara melebihi batas maksimal (${maxSeconds} detik)`
        );
      }
    }

    // Simpan pesan ke tabel session_messages (service role bypass RLS INSERT)
    const { data: newMsg, error: insertError } = await supabaseAdmin
      .from('session_messages')
      .insert({
        booking_id: id,
        sender_id: user.id,
        kind: parsed.data.kind,
        body: parsed.data.kind === 'text'
          ? parsed.data.body?.trim()
          : (parsed.data.body?.trim() || null),
        media_path: parsed.data.media_path || null,
        duration_seconds: parsed.data.duration_seconds ?? null,
      })
      .select('*')
      .single();

    if (insertError) {
      return fail(500, 'INSERT_FAILED', insertError.message);
    }

    const insertedEntity = newMsg as SessionMessageEntity;

    // Ambil nama pengirim untuk tampilan respon yang rapi
    let senderName = booking.patient_display_name || 'Pasien Anonim';
    if (isPsikolog) {
      const { data: psikoProfile } = await supabaseAdmin
        .from('psikolog_profiles')
        .select('nama_lengkap_gelar')
        .eq('user_id', booking.psikolog_id)
        .maybeSingle();
      senderName = psikoProfile?.nama_lengkap_gelar || 'Psikolog';
    }

    const responseView: SessionMessageView = {
      id: insertedEntity.id,
      booking_id: insertedEntity.booking_id,
      sender_id: insertedEntity.sender_id,
      sender_role: isPsikolog ? 'psikolog' : 'pasien',
      sender_name: senderName,
      is_mine: true,
      kind: insertedEntity.kind,
      body: insertedEntity.body,
      media_path: insertedEntity.media_path,
      duration_seconds: insertedEntity.duration_seconds,
      created_at: insertedEntity.created_at,
    };

    return NextResponse.json(
      {
        success: true,
        data: responseView,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    return fail(
      500,
      'INTERNAL_SERVER_ERROR',
      err instanceof Error ? err.message : 'Gagal mengirim pesan sesi'
    );
  }
}
