import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail, getSessionUser } from '@/lib/auth/session';
import type { BookingEntity } from '@/types/booking';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/bookings/[id]/cancel
 * Membatalkan booking sesi konseling oleh pasien pemilik.
 * Menghitung refund otomatis sesuai tier kebijakan pembatalan (100% / 65% / 0%)
 * dan mengalokasikan sisa koin hangus ke mitra dan platform secara transaksional.
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
      return fail(403, 'FORBIDDEN', 'Hanya pasien pemilik yang dapat membatalkan booking di endpoint ini');
    }

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    const { data: updatedBooking, error: rpcError } = await supabaseAdmin.rpc('booking_cancel_by_patient', {
      p_booking_id: id,
      p_patient_id: user.id,
    });

    if (rpcError) {
      const msg = rpcError.message || '';
      if (msg.includes('BOOKING_NOT_FOUND')) {
        return fail(404, 'NOT_FOUND', 'Booking tidak ditemukan');
      }
      if (msg.includes('UNAUTHORIZED')) {
        return fail(403, 'UNAUTHORIZED', 'Anda tidak berhak membatalkan booking milik pasien lain');
      }
      if (msg.includes('INVALID_BOOKING_STATUS')) {
        return fail(409, 'INVALID_BOOKING_STATUS', 'Hanya booking berstatus booked yang dapat dibatalkan');
      }
      return fail(400, 'CANCEL_FAILED', msg);
    }

    return NextResponse.json({
      success: true,
      data: updatedBooking as BookingEntity,
      message: 'Booking berhasil dibatalkan',
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}
