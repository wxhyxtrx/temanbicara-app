import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail, getSessionUser } from '@/lib/auth/session';
import type { SessionReviewEntity } from '@/types/booking';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/bookings/[id]/review/report
 * Psikolog melaporkan ulasan sesi yang melanggar kebijakan ke admin moderasi.
 * Syarat: Role psikolog aktif yang bertugas pada sesi tersebut.
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
      return fail(403, 'FORBIDDEN', 'Hanya psikolog yang dapat melaporkan ulasan sesi');
    }
    if (user.status !== 'active') {
      return fail(403, 'FORBIDDEN', 'Akun psikolog belum aktif');
    }

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    // Panggil RPC review_report
    const { data: review, error: rpcError } = await supabaseAdmin.rpc('review_report', {
      p_booking_id: id,
      p_psikolog_id: user.id,
    });

    if (rpcError) {
      const msg = rpcError.message || '';
      if (msg.includes('REVIEW_NOT_FOUND')) {
        return fail(404, 'NOT_FOUND', 'Ulasan sesi tidak ditemukan');
      }
      if (msg.includes('FORBIDDEN')) {
        return fail(403, 'FORBIDDEN', 'Anda hanya dapat melaporkan ulasan pada sesi konseling Anda sendiri');
      }
      return fail(400, 'REPORT_FAILED', msg);
    }

    return NextResponse.json({
      success: true,
      data: review as SessionReviewEntity,
      message: 'Ulasan berhasil dilaporkan untuk ditinjau oleh admin',
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}
