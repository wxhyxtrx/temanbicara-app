import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail, getSessionUser } from '@/lib/auth/session';
import { sessionTipSchema } from '@/lib/validations/booking';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/bookings/[id]/tip
 * Pasien memberikan tip koin kepada psikolog untuk sesi yang selesai.
 * Syarat: Role pasien, booking completed, dalam rating.window_days, 1 tip per sesi.
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
      return fail(403, 'FORBIDDEN', 'Hanya pasien yang dapat memberikan tip');
    }
    if (user.status !== 'active') {
      return fail(403, 'FORBIDDEN', 'Akun pasien belum aktif');
    }

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    const rawBody = await req.json().catch(() => null);
    const parsed = sessionTipSchema.safeParse(rawBody);
    if (!parsed.success) {
      return fail(422, 'VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Data tip tidak valid');
    }

    const tipId = crypto.randomUUID();

    // Panggil RPC session_tip
    const { error: rpcError } = await supabaseAdmin.rpc('session_tip', {
      p_tip_id: tipId,
      p_booking_id: id,
      p_patient_id: user.id,
      p_coins: parsed.data.coins,
    });

    if (rpcError) {
      const msg = rpcError.message || '';
      if (msg.includes('BOOKING_NOT_FOUND')) {
        return fail(404, 'NOT_FOUND', 'Booking sesi tidak ditemukan');
      }
      if (msg.includes('FORBIDDEN')) {
        return fail(403, 'FORBIDDEN', 'Anda tidak memiliki hak akses untuk memberikan tip pada sesi ini');
      }
      if (msg.includes('BOOKING_NOT_COMPLETED')) {
        return fail(400, 'BOOKING_NOT_COMPLETED', 'Tip hanya dapat diberikan pada sesi yang telah selesai normal');
      }
      if (msg.includes('TIP_WINDOW_EXPIRED')) {
        return fail(400, 'TIP_WINDOW_EXPIRED', 'Batas waktu pemberian tip untuk sesi ini telah berakhir');
      }
      if (msg.includes('tips_source_once') || msg.includes('duplicate key') || msg.includes('23505')) {
        return fail(409, 'TIP_ALREADY_GIVEN', 'Anda sudah pernah memberikan tip untuk sesi ini');
      }
      if (msg.includes('INSUFFICIENT') || msg.includes('saldo tidak mencukupi') || msg.includes('COIN_BALANCE_INSUFFICIENT')) {
        return fail(402, 'INSUFFICIENT_COINS', 'Saldo koin Anda tidak mencukupi untuk memberikan tip ini');
      }
      if (msg.includes('TIP_OUT_OF_RANGE')) {
        return fail(422, 'TIP_OUT_OF_RANGE', 'Jumlah tip koin berada di luar batas yang diperbolehkan');
      }
      if (msg.includes('TIP_DAILY_CAP_EXCEEDED')) {
        return fail(422, 'TIP_DAILY_CAP_EXCEEDED', 'Batas maksimal harian pemberian tip telah tercapai');
      }
      return fail(400, 'TIP_FAILED', msg);
    }

    return NextResponse.json({
      success: true,
      data: {
        tip_id: tipId,
        booking_id: id,
        coins: parsed.data.coins,
      },
      message: 'Tip berhasil diberikan kepada psikolog',
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}
