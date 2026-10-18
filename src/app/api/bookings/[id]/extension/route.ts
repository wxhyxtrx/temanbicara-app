import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail, getSessionUser } from '@/lib/auth/session';
import type { BookingEntity } from '@/types/booking';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/bookings/[id]/extension
 * Pasien mengajukan perpanjangan sesi 10 menit.
 * Syarat: sesi in_progress, psikolog tidak telat, belum pernah diajukan,
 * ada tarif ekstensi, dan waktu belum melewati 45 menit dari start_at.
 */
export async function POST(
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

    if (user.role !== 'pasien') {
      return fail(403, 'FORBIDDEN', 'Hanya pasien pemilik booking yang dapat mengajukan ekstensi sesi');
    }

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    const { data: updatedBooking, error: rpcError } = await supabaseAdmin.rpc('extension_request', {
      p_booking_id: id,
      p_patient_id: user.id,
    });

    if (rpcError) {
      const msg = rpcError.message || '';
      if (msg.includes('BOOKING_NOT_FOUND')) {
        return fail(404, 'NOT_FOUND', 'Booking tidak ditemukan');
      }
      if (msg.includes('UNAUTHORIZED')) {
        return fail(403, 'UNAUTHORIZED', 'Anda tidak berhak mengajukan ekstensi untuk booking ini');
      }
      if (msg.includes('INVALID_BOOKING_STATUS')) {
        return fail(409, 'INVALID_BOOKING_STATUS', 'Ekstensi hanya dapat diajukan saat sesi sedang berlangsung');
      }
      if (msg.includes('PSIKOLOG_LATE')) {
        return fail(409, 'PSIKOLOG_LATE', 'Psikolog terlambat memulai sesi sehingga hak ekstensi tidak tersedia');
      }
      if (msg.includes('EXTENSION_ALREADY_REQUESTED')) {
        return fail(409, 'EXTENSION_ALREADY_REQUESTED', 'Ekstensi sudah pernah diajukan untuk sesi ini');
      }
      if (msg.includes('EXTENSION_NOT_OFFERED')) {
        return fail(422, 'EXTENSION_NOT_OFFERED', 'Psikolog tidak menyediakan opsi ekstensi untuk sesi ini');
      }
      if (msg.includes('EXTENSION_WINDOW_EXPIRED')) {
        return fail(409, 'EXTENSION_WINDOW_EXPIRED', 'Batas waktu 45 menit pengajuan ekstensi telah berakhir');
      }
      return fail(400, 'EXTENSION_REQUEST_FAILED', msg);
    }

    return NextResponse.json({
      success: true,
      data: updatedBooking as BookingEntity,
      message: 'Permintaan perpanjangan sesi 10 menit berhasil diajukan',
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}
