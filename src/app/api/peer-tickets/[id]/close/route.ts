import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail, getSessionUser } from '@/lib/auth/session';
import { getMaintenanceStatus } from '@/lib/maintenance';
import type { PeerTicketEntity } from '@/types/peer-tickets';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/peer-tickets/[id]/close
 * Menutup tiket curhat aktif secara manual oleh peserta tiket (pasien atau relawan) atau admin.
 */
export async function POST(
  _req: Request,
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

    const { id } = await params;
    if (!id || !UUID_RE.test(id)) {
      return fail(400, 'INVALID_PARAMETER', 'ID tiket tidak valid');
    }

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    // Ambil data tiket untuk verifikasi awal
    const { data: existingTicket, error: fetchError } = await supabaseAdmin
      .from('peer_tickets')
      .select('id, patient_id, claimed_by, status')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      return fail(500, 'QUERY_FAILED', fetchError.message);
    }
    if (!existingTicket) {
      return fail(404, 'TICKET_NOT_FOUND', 'Tiket curhat tidak ditemukan');
    }

    const isPatient = user.id === existingTicket.patient_id;
    const isRelawan = user.id === existingTicket.claimed_by;
    const isAdmin = user.role === 'admin';

    if (!isPatient && !isRelawan && !isAdmin) {
      return fail(403, 'FORBIDDEN', 'Hanya peserta tiket atau admin yang dapat menutup tiket ini');
    }

    if (existingTicket.status !== 'active') {
      return fail(409, 'TICKET_NOT_ACTIVE', 'Hanya tiket berstatus aktif yang dapat ditutup');
    }

    // Panggil RPC peer_ticket_close
    const { data: closedTicket, error: rpcError } = await supabaseAdmin.rpc('peer_ticket_close', {
      p_ticket_id: id,
      p_user_id: user.id,
    });

    if (rpcError) {
      const msg = rpcError.message || '';
      if (msg.includes('TICKET_NOT_FOUND')) {
        return fail(404, 'TICKET_NOT_FOUND', 'Tiket curhat tidak ditemukan');
      }
      if (msg.includes('FORBIDDEN')) {
        return fail(403, 'FORBIDDEN', 'Hanya peserta tiket atau admin yang dapat menutup tiket ini');
      }
      if (msg.includes('TICKET_NOT_ACTIVE')) {
        return fail(409, 'TICKET_NOT_ACTIVE', 'Tiket tidak dalam status aktif');
      }
      if (msg.includes('INVALID_PARAMETER')) {
        return fail(400, 'INVALID_PARAMETER', 'Parameter tidak valid');
      }
      return fail(400, 'CLOSE_FAILED', msg || 'Gagal menutup tiket curhat');
    }

    const ticket = closedTicket as PeerTicketEntity;

    if (user.role === 'relawan' && !isAdmin) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { patient_id: _discard, ...safeTicket } = ticket;
      return NextResponse.json({
        success: true,
        data: safeTicket,
      });
    }

    return NextResponse.json({
      success: true,
      data: ticket,
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_SERVER_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}
