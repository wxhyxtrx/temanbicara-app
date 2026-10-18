import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail, getSessionUser } from '@/lib/auth/session';
import { updateClientNoteSchema } from '@/lib/validations/booking';
import type { BookingEntity, ClientNoteEntity } from '@/types/booking';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/bookings/[id]/note
 * Mengambil catatan klinis sesi konseling.
 * Akses khusus untuk psikolog yang bertugas pada booking tersebut (pasien & admin tidak memiliki akses).
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

    if (user.role !== 'psikolog') {
      return fail(403, 'FORBIDDEN', 'Akses ditolak. Catatan klien hanya dapat diakses oleh psikolog');
    }
    if (user.status !== 'active') {
      return fail(403, 'FORBIDDEN', 'Akun psikolog belum aktif');
    }

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    // Verifikasi booking dan kepemilikan psikolog
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('id, psikolog_id, status, patient_id')
      .eq('id', id)
      .maybeSingle();

    if (bookingError) {
      return fail(500, 'QUERY_FAILED', bookingError.message);
    }
    if (!booking) {
      return fail(404, 'NOT_FOUND', 'Booking sesi tidak ditemukan');
    }

    const bookingRow = booking as BookingEntity;
    if (bookingRow.psikolog_id !== user.id) {
      return fail(403, 'FORBIDDEN', 'Hanya psikolog yang bertugas pada sesi ini yang dapat mengakses catatan');
    }

    // Ambil catatan jika sudah ada
    const { data: note, error: noteError } = await supabaseAdmin
      .from('client_notes')
      .select('booking_id, psikolog_id, patient_id, body, created_at, updated_at')
      .eq('booking_id', id)
      .maybeSingle();

    if (noteError) {
      return fail(500, 'QUERY_FAILED', noteError.message);
    }

    return NextResponse.json({
      success: true,
      data: (note as ClientNoteEntity | null) ?? null,
      patient_id: bookingRow.patient_id,
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}

/**
 * PUT /api/bookings/[id]/note
 * Membuat atau memperbarui catatan klinis sesi konseling (bebas teks ≤ 5000 karakter).
 * Syarat: Hanya psikolog yang bertugas, status booking 'in_progress' atau 'completed'.
 */
export async function PUT(
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

    if (user.role !== 'psikolog') {
      return fail(403, 'FORBIDDEN', 'Hanya psikolog yang dapat membuat atau mengubah catatan klien');
    }
    if (user.status !== 'active') {
      return fail(403, 'FORBIDDEN', 'Akun psikolog belum aktif');
    }

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    const rawBody = await req.json().catch(() => null);
    const parsed = updateClientNoteSchema.safeParse(rawBody);
    if (!parsed.success) {
      return fail(422, 'VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Data catatan tidak valid');
    }

    // Eksekusi upsert atomik via RPC client_note_upsert
    const { data: note, error: rpcError } = await supabaseAdmin.rpc('client_note_upsert', {
      p_booking_id: id,
      p_psikolog_id: user.id,
      p_body: parsed.data.body,
    });

    if (rpcError) {
      const msg = rpcError.message || '';
      if (msg.includes('BOOKING_NOT_FOUND')) {
        return fail(404, 'NOT_FOUND', 'Booking sesi tidak ditemukan');
      }
      if (msg.includes('FORBIDDEN_NOT_BOOKING_PSIKOLOG')) {
        return fail(403, 'FORBIDDEN', 'Hanya psikolog yang bertugas pada sesi ini yang dapat menyimpan catatan');
      }
      if (msg.includes('INVALID_BOOKING_STATUS')) {
        return fail(409, 'INVALID_BOOKING_STATUS', 'Catatan hanya dapat dibuat atau diubah pada sesi yang sedang berlangsung atau sudah selesai');
      }
      if (msg.includes('BODY_TOO_LONG')) {
        return fail(422, 'BODY_TOO_LONG', 'Catatan maksimal 5000 karakter');
      }
      return fail(400, 'SAVE_NOTE_FAILED', msg);
    }

    return NextResponse.json({
      success: true,
      data: note as ClientNoteEntity,
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}
