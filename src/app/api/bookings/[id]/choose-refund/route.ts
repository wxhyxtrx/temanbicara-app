import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail, getSessionUser } from '@/lib/auth/session';
import type { BookingEntity } from '@/types/booking';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/bookings/[id]/choose-refund
 * Pasien memilih opsi pengembalian koin penuh 100% setelah sesi dibatalkan oleh psikolog.
 * Status berubah dari awaiting_patient_choice menjadi cancelled_by_psikolog.
 * Idempoten: pemanggilan ulang mengembalikan status tanpa menduplikasi refund.
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
      return fail(403, 'FORBIDDEN', 'Hanya pasien pemilik yang dapat memilih refund pada booking ini');
    }

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    const { data: updatedBooking, error: rpcError } = await supabaseAdmin.rpc('booking_choose_refund', {
      p_booking_id: id,
      p_patient_id: user.id,
    });

    if (rpcError) {
      const msg = rpcError.message || '';
      if (msg.includes('BOOKING_NOT_FOUND')) {
        return fail(404, 'NOT_FOUND', 'Booking tidak ditemukan');
      }
      if (msg.includes('UNAUTHORIZED')) {
        return fail(403, 'UNAUTHORIZED', 'Anda tidak berhak memilih refund untuk booking ini');
      }
      if (msg.includes('INVALID_BOOKING_STATUS')) {
        return fail(409, 'INVALID_BOOKING_STATUS', 'Pilihan refund hanya tersedia untuk booking dengan status awaiting_patient_choice');
      }
      return fail(400, 'CHOOSE_REFUND_FAILED', msg);
    }

    return NextResponse.json({
      success: true,
      data: updatedBooking as BookingEntity,
      message: 'Pilihan refund berhasil diproses. Koin telah dikembalikan penuh ke saldo Anda.',
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}
