import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail, getSessionUser } from '@/lib/auth/session';
import { getMaintenanceStatus } from '@/lib/maintenance';
import type {
  PeerTicketDetailView,
  RelawanPeerTicketDetailView,
  PeerTicketEntity,
} from '@/types/peer-tickets';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/peer-tickets/[id]
 * Mengambil detail tiket curhat sebaya.
 * Akses khusus peserta tiket (pasien atau relawan pengklaim) atau admin.
 * Identitas pasien dilindungi: patient_id dihapus untuk pengakses relawan.
 */
export async function GET(
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
      return fail(400, 'INVALID_ID', 'ID tiket tidak valid');
    }

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('peer_tickets')
      .select('*')
      .eq('id', id)
      .maybeSingle<PeerTicketEntity>();

    if (ticketError) {
      return fail(500, 'QUERY_FAILED', ticketError.message);
    }
    if (!ticket) {
      return fail(404, 'NOT_FOUND', 'Tiket curhat tidak ditemukan');
    }

    const isPatient = user.id === ticket.patient_id;
    const isClaimedRelawan = user.id === ticket.claimed_by;
    const isAdmin = user.role === 'admin';

    if (!isPatient && !isClaimedRelawan && !isAdmin) {
      return fail(403, 'FORBIDDEN', 'Hanya peserta tiket atau admin yang dapat mengakses tiket ini');
    }

    let relawanAlias: string | null = null;
    if (ticket.claimed_by) {
      const { data: profile } = await supabaseAdmin
        .from('relawan_profiles')
        .select('alias_name')
        .eq('user_id', ticket.claimed_by)
        .maybeSingle();

      relawanAlias = profile?.alias_name?.trim() || 'Pendengar Sebaya';
    }

    const isRelawanViewer = user.role === 'relawan' || (!isPatient && !isAdmin);

    if (isRelawanViewer && !isAdmin) {
      const data: RelawanPeerTicketDetailView = {
        id: ticket.id,
        patient_alias: ticket.patient_alias,
        topic: ticket.topic,
        emotion: ticket.emotion,
        content: ticket.content,
        is_anonymous: ticket.is_anonymous,
        status: ticket.status,
        claimed_by: ticket.claimed_by,
        claimed_at: ticket.claimed_at,
        first_response_at: ticket.first_response_at,
        closed_at: ticket.closed_at,
        archived_at: ticket.archived_at ?? null,
        created_at: ticket.created_at,
        updated_at: ticket.updated_at,
        relawan_alias: relawanAlias,
      };

      return NextResponse.json({
        success: true,
        data,
      });
    }

    const data: PeerTicketDetailView = {
      id: ticket.id,
      patient_id: ticket.patient_id,
      patient_alias: ticket.patient_alias,
      topic: ticket.topic,
      emotion: ticket.emotion,
      content: ticket.content,
      is_anonymous: ticket.is_anonymous,
      status: ticket.status,
      claimed_by: ticket.claimed_by,
      claimed_at: ticket.claimed_at,
      first_response_at: ticket.first_response_at,
      closed_at: ticket.closed_at,
      archived_at: ticket.archived_at ?? null,
      created_at: ticket.created_at,
      updated_at: ticket.updated_at,
      relawan_alias: relawanAlias,
    };

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan pada server';
    return fail(500, 'INTERNAL_SERVER_ERROR', message);
  }
}
