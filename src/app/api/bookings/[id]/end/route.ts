import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail, getSessionUser } from '@/lib/auth/session';
import { toPsikologBookingView } from '@/lib/booking/views';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/bookings/[id]/end
 * Psikolog mengakhiri sesi konseling (in_progress -> completed).
 * Menyelesaikan pembagian honor sesi mitra dan penerimaan platform (settle).
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

    if (user.role !== 'psikolog') {
      return fail(403, 'FORBIDDEN', 'Hanya psikolog yang bertugas yang dapat mengakhiri sesi konseling');
    }

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    const { data: updatedBooking, error: rpcError } = await supabaseAdmin.rpc('session_end', {
      p_booking_id: id,
      p_psikolog_id: user.id,
    });

    if (rpcError) {
      const msg = rpcError.message || '';
      if (msg.includes('BOOKING_NOT_FOUND')) {
        return fail(404, 'NOT_FOUND', 'Booking tidak ditemukan');
      }
      if (msg.includes('UNAUTHORIZED')) {
        return fail(403, 'UNAUTHORIZED', 'Anda tidak berhak mengakhiri booking ini');
      }
      if (msg.includes('INVALID_BOOKING_STATUS')) {
        return fail(409, 'INVALID_BOOKING_STATUS', 'Hanya sesi yang sedang berjalan yang dapat diakhiri');
      }
      return fail(400, 'END_SESSION_FAILED', msg);
    }

    return NextResponse.json({
      success: true,
      data: toPsikologBookingView(updatedBooking),
      message: 'Sesi konseling berhasil diakhiri',
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}
