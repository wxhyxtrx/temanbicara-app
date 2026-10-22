import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail, getSessionUser } from '@/lib/auth/session';
import { getMaintenanceStatus } from '@/lib/maintenance';
import { peerTipSchema } from '@/lib/validations/peer-tickets';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/peer-tickets/[id]/tip
 * Pasien memberikan tip koin sukarela kepada relawan pendamping untuk tiket yang telah berstatus closed.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const maintenance = await getMaintenanceStatus();
    if (maintenance.phase === 'draining') {
      return fail(503, 'MAINTENANCE_DRAINING', 'Sistem sedang bersiap untuk pemeliharaan. Transaksi baru ditunda.');
    }
    if (maintenance.phase === 'active') {
      return fail(503, 'MAINTENANCE_ACTIVE', maintenance.message);
    }

    const session = await getSessionUser();
    if (session.response) return session.response;
    const { user } = session;

    if (user.role !== 'pasien') {
      return fail(403, 'FORBIDDEN', 'Hanya pasien yang dapat memberikan tip');
    }

    if (user.status !== 'active') {
      return fail(403, 'USER_NOT_ACTIVE', 'Akun pasien belum aktif');
    }

    const { id } = await params;
    if (!id || !UUID_RE.test(id)) {
      return fail(400, 'INVALID_PARAMETER', 'ID tiket tidak valid');
    }

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return fail(400, 'INVALID_COINS', 'Request body bukan format JSON yang valid');
    }

    const parsed = peerTipSchema.safeParse(rawBody);
    if (!parsed.success) {
      return fail(400, 'INVALID_COINS', parsed.error.issues[0]?.message || 'Data tip koin tidak valid');
    }

    // Ambil data tiket untuk validasi status dan peserta
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('peer_tickets')
      .select('id, patient_id, claimed_by, status')
      .eq('id', id)
      .maybeSingle();

    if (ticketError) {
      return fail(500, 'QUERY_FAILED', ticketError.message);
    }
    if (!ticket) {
      return fail(404, 'TICKET_NOT_FOUND', 'Tiket curhat tidak ditemukan');
    }

    if (ticket.patient_id !== user.id) {
      return fail(403, 'FORBIDDEN', 'Hanya pasien pemilik tiket yang dapat memberikan tip');
    }

    if (ticket.status !== 'closed') {
      return fail(409, 'TICKET_NOT_CLOSED', 'Hanya tiket yang telah ditutup yang dapat diberikan tip');
    }

    if (!ticket.claimed_by) {
      return fail(409, 'TICKET_NOT_CLOSED', 'Tiket tidak memiliki relawan pendamping');
    }

    const tipId = parsed.data.tip_id || crypto.randomUUID();

    // Panggil RPC peer_ticket_tip
    const { error: rpcError } = await supabaseAdmin.rpc('peer_ticket_tip', {
      p_tip_id: tipId,
      p_ticket_id: id,
      p_patient_id: user.id,
      p_coins: parsed.data.coins,
    });

    if (rpcError) {
      const msg = rpcError.message || '';
      if (msg.includes('TICKET_NOT_FOUND')) {
        return fail(404, 'TICKET_NOT_FOUND', 'Tiket curhat tidak ditemukan');
      }
      if (msg.includes('FORBIDDEN') || msg.includes('PATIENT_ROLE_REQUIRED')) {
        return fail(403, 'FORBIDDEN', 'Hanya pasien pemilik tiket yang dapat memberikan tip');
      }
      if (msg.includes('TICKET_NOT_CLOSED') || msg.includes('TICKET_NO_RELAWAN')) {
        return fail(409, 'TICKET_NOT_CLOSED', 'Hanya tiket yang telah ditutup yang dapat diberikan tip');
      }
      if (msg.includes('TIP_WINDOW_EXPIRED')) {
        return fail(409, 'TIP_WINDOW_EXPIRED', 'Batas waktu pemberian tip telah berakhir');
      }
      if (msg.includes('tips_source_once') || msg.includes('duplicate key') || msg.includes('23505')) {
        return fail(409, 'TIP_ALREADY_GIVEN', 'Anda sudah pernah memberikan tip untuk tiket ini');
      }
      if (msg.includes('INSUFFICIENT_COINS') || msg.includes('INSUFFICIENT') || msg.includes('saldo tidak mencukupi')) {
        return fail(400, 'INSUFFICIENT_COINS', 'Saldo koin Anda tidak mencukupi untuk memberikan tip ini');
      }
      if (msg.includes('TIP_OUT_OF_RANGE') || msg.includes('INVALID_COINS')) {
        return fail(400, 'INVALID_COINS', 'Jumlah tip koin berada di luar batas yang diperbolehkan');
      }
      if (msg.includes('TIP_DAILY_CAP_EXCEEDED')) {
        return fail(400, 'TIP_DAILY_CAP_EXCEEDED', 'Batas maksimal harian pemberian tip telah tercapai');
      }
      return fail(400, 'TIP_FAILED', msg || 'Gagal memberikan tip');
    }

    return NextResponse.json({
      success: true,
      data: {
        tip_id: tipId,
        coins: parsed.data.coins,
      },
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_SERVER_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}
