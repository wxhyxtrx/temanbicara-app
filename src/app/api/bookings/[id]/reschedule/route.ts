import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail, getSessionUser } from '@/lib/auth/session';
import { rescheduleBookingSchema } from '@/lib/validations/booking';
import type { BookingEntity } from '@/types/booking';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/bookings/[id]/reschedule
 * Memindahkan jadwal booking sesi konseling oleh pasien.
 * Aturan:
 * - Mode A (status booked): Maksimal 1 kali, minimal >24 jam sebelum sesi, ke slot psikolog yang sama
 * - Mode B (status awaiting_patient_choice): Pilihan pasien setelah psikolog membatalkan jadwal (tanpa batas 24 jam)
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

    if (user.role !== 'pasien') {
      return fail(403, 'FORBIDDEN', 'Hanya pasien pemilik yang dapat memindahkan jadwal');
    }

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    const rawBody = await req.json().catch(() => null);
    const parsed = rescheduleBookingSchema.safeParse(rawBody);
    if (!parsed.success) {
      return fail(422, 'VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Data input tidak valid');
    }

    const { data: updatedBooking, error: rpcError } = await supabaseAdmin.rpc('booking_reschedule', {
      p_booking_id: id,
      p_patient_id: user.id,
      p_new_start_at: parsed.data.new_start_at,
    });

    if (rpcError) {
      const msg = rpcError.message || '';
      if (msg.includes('BOOKING_NOT_FOUND')) {
        return fail(404, 'NOT_FOUND', 'Booking tidak ditemukan');
      }
      if (msg.includes('UNAUTHORIZED')) {
        return fail(403, 'UNAUTHORIZED', 'Anda tidak berhak memindahkan jadwal booking milik pasien lain');
      }
      if (msg.includes('RESCHEDULE_LIMIT_EXCEEDED')) {
        return fail(409, 'RESCHEDULE_LIMIT_EXCEEDED', 'Jadwal sesi hanya dapat dipindahkan mandiri sebanyak 1 kali');
      }
      if (msg.includes('RESCHEDULE_TOO_LATE')) {
        return fail(409, 'RESCHEDULE_TOO_LATE', 'Pindah jadwal hanya dapat dilakukan paling lambat 24 jam sebelum sesi dimulai');
      }
      if (msg.includes('SLOT_UNAVAILABLE')) {
        return fail(409, 'SLOT_UNAVAILABLE', 'Slot jadwal baru tidak tersedia atau telah dipesan');
      }
      if (msg.includes('LIMIT_DAILY')) {
        return fail(409, 'LIMIT_DAILY', 'Anda telah memiliki jadwal lain dengan psikolog ini di hari kalender yang sama');
      }
      if (msg.includes('SAME_SLOT_SELECTED')) {
        return fail(422, 'SAME_SLOT_SELECTED', 'Slot waktu baru tidak boleh sama dengan slot saat ini');
      }
      if (msg.includes('INVALID_BOOKING_STATUS')) {
        return fail(409, 'INVALID_BOOKING_STATUS', 'Status booking saat ini tidak mengizinkan pemindahan jadwal');
      }
      return fail(400, 'RESCHEDULE_FAILED', msg);
    }

    return NextResponse.json({
      success: true,
      data: updatedBooking as BookingEntity,
      message: 'Jadwal sesi berhasil dipindahkan',
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}
