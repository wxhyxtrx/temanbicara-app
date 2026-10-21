import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail, getSessionUser } from '@/lib/auth/session';
import { getMaintenanceStatus } from '@/lib/maintenance';
import type { RelawanPeerTicketDTO } from '@/types/peer-tickets';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/peer-tickets/[id]/claim
 * Mengklaim tiket curhat dari antrean pool.
 * Khusus relawan aktif.
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

    if (user.role !== 'relawan') {
      return fail(403, 'FORBIDDEN', 'Hanya relawan yang dapat mengklaim tiket curhat');
    }

    if (user.status !== 'active') {
      return fail(403, 'USER_NOT_ACTIVE', 'Akun relawan belum aktif');
    }

    const { id } = await params;
    if (!id || !UUID_RE.test(id)) {
      return fail(400, 'INVALID_ID', 'ID tiket tidak valid');
    }

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    const { data: ticket, error: rpcError } = await supabaseAdmin.rpc('peer_ticket_claim', {
      p_ticket_id: id,
      p_relawan_id: user.id,
    });

    if (rpcError) {
      const msg = rpcError.message || '';
      if (msg.includes('DAILY_QUOTA_EXHAUSTED')) {
        return fail(409, 'DAILY_QUOTA_EXHAUSTED', 'Kuota klaim tiket harian relawan sudah habis.');
      }
      if (msg.includes('TICKET_NOT_AVAILABLE') || msg.includes('TICKET_NOT_OPEN')) {
        return fail(409, 'TICKET_NOT_OPEN', 'Tiket tidak tersedia atau sudah diambil relawan lain.');
      }
      if (msg.includes('TICKET_PREVIOUSLY_ABANDONED') || msg.includes('RELAWAN_ABANDONED_TICKET')) {
        return fail(409, 'RELAWAN_ABANDONED_TICKET', 'Relawan tidak dapat mengklaim tiket yang pernah ditinggalkan.');
      }
      if (msg.includes('FORBIDDEN_ROLE')) {
        return fail(403, 'FORBIDDEN_ROLE', 'Hanya relawan aktif yang dapat mengklaim tiket');
      }
      if (msg.includes('USER_NOT_FOUND')) {
        return fail(404, 'USER_NOT_FOUND', 'Pengguna relawan tidak ditemukan');
      }
      if (msg.includes('INVALID_PARAMETER')) {
        return fail(422, 'INVALID_PARAMETER', 'Parameter klaim tiket tidak valid');
      }
      return fail(400, 'CLAIM_FAILED', msg || 'Gagal mengklaim tiket curhat');
    }

    // Buang patient_id demi privasi pasien
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { patient_id: _discard, ...safeTicket } = (ticket ?? {}) as Record<string, unknown>;

    return NextResponse.json({
      success: true,
      data: safeTicket as RelawanPeerTicketDTO,
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_SERVER_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}
