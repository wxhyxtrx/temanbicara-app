import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail, getSessionUser } from '@/lib/auth/session';
import { extensionRespondSchema } from '@/lib/validations/booking';
import { toPsikologBookingView } from '@/lib/booking/views';
import type { ExtensionRespondResult } from '@/types/booking';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/bookings/[id]/extension/respond
 * Psikolog merespons pengajuan perpanjangan sesi 10 menit (approve / decline).
 * - approve=true & saldo cukup: debit koin, status approved
 * - approve=true & saldo kurang (Review Focus #4): hasil insufficient_coins, tanpa debit, status declined
 * - approve=false: status declined
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

    if (user.role !== 'psikolog') {
      return fail(403, 'FORBIDDEN', 'Hanya psikolog yang bertugas yang dapat merespons pengajuan ekstensi');
    }

    const body = await req.json().catch(() => null);
    const parsed = extensionRespondSchema.safeParse(body);
    if (!parsed.success) {
      return fail(422, 'VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Input tidak valid');
    }

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    const { data: resultText, error: rpcError } = await supabaseAdmin.rpc('extension_respond', {
      p_booking_id: id,
      p_psikolog_id: user.id,
      p_approve: parsed.data.approve,
    });

    if (rpcError) {
      const msg = rpcError.message || '';
      if (msg.includes('BOOKING_NOT_FOUND')) {
        return fail(404, 'NOT_FOUND', 'Booking tidak ditemukan');
      }
      if (msg.includes('UNAUTHORIZED')) {
        return fail(403, 'UNAUTHORIZED', 'Anda tidak berhak merespons ekstensi untuk booking ini');
      }
      if (msg.includes('INVALID_BOOKING_STATUS')) {
        return fail(409, 'INVALID_BOOKING_STATUS', 'Hanya sesi yang sedang berjalan yang dapat diperpanjang');
      }
      if (msg.includes('NO_PENDING_EXTENSION')) {
        return fail(409, 'NO_PENDING_EXTENSION', 'Tidak ada permintaan ekstensi yang menunggu keputusan');
      }
      return fail(400, 'EXTENSION_RESPOND_FAILED', msg);
    }

    const typedResult = resultText as ExtensionRespondResult;

    const { data: updatedBooking } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single();

    return NextResponse.json({
      success: true,
      data: {
        result: typedResult,
        booking: updatedBooking ? toPsikologBookingView(updatedBooking) : null,
      },
      message: typedResult === 'approved'
        ? 'Permintaan perpanjangan sesi disetujui'
        : typedResult === 'insufficient_coins'
        ? 'Saldo koin pasien tidak mencukupi. Permintaan ekstensi otomatis ditolak.'
        : 'Permintaan perpanjangan sesi ditolak',
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}
