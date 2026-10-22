import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail, getSessionUser } from '@/lib/auth/session';
import { getMaintenanceStatus } from '@/lib/maintenance';
import {
  sendPeerMessageSchema,
  isValidPeerMediaPath,
} from '@/lib/validations/peer-messages';
import type { PeerMessageEntity, PeerMessageView } from '@/lib/validations/peer-messages';
import type { PeerTicketEntity } from '@/types/peer-tickets';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/peer-tickets/[id]/messages
 * Mengambil riwayat pesan obrolan Ruang Dengar secara kronologis.
 * Akses khusus peserta tiket (pasien atau relawan pengklaim) atau admin.
 * Identitas asli pasien dimasking dengan patient_alias.
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
      .select('id, patient_id, patient_alias, status, claimed_by, first_response_at')
      .eq('id', id)
      .maybeSingle();

    if (ticketError) {
      return fail(500, 'QUERY_FAILED', ticketError.message);
    }
    if (!ticket) {
      return fail(404, 'NOT_FOUND', 'Tiket curhat tidak ditemukan');
    }

    const isPatient = user.id === ticket.patient_id;
    const isRelawan = user.id === ticket.claimed_by;
    const isAdmin = user.role === 'admin';

    if (!isPatient && !isRelawan && !isAdmin) {
      return fail(403, 'FORBIDDEN', 'Hanya peserta tiket atau admin yang dapat mengakses pesan obrolan');
    }

    const [messagesRes, relawanProfileRes] = await Promise.all([
      supabaseAdmin
        .from('peer_messages')
        .select('*')
        .eq('ticket_id', id)
        .order('created_at', { ascending: true }),
      ticket.claimed_by
        ? supabaseAdmin
            .from('relawan_profiles')
            .select('alias_name')
            .eq('user_id', ticket.claimed_by)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (messagesRes.error) {
      return fail(500, 'QUERY_FAILED', messagesRes.error.message);
    }

    const relawanName = relawanProfileRes.data?.alias_name?.trim() || 'Pendengar Sebaya';
    const patientName = ticket.patient_alias || 'Teman Curhat';

    const rawMessages = (messagesRes.data || []) as PeerMessageEntity[];

    const messagesView: PeerMessageView[] = rawMessages.map((msg) => {
      const isMsgFromRelawan = msg.sender_id === ticket.claimed_by;
      return {
        id: msg.id,
        ticket_id: msg.ticket_id,
        sender_id: msg.sender_id,
        sender_role: isMsgFromRelawan ? 'relawan' : 'pasien',
        sender_name: isMsgFromRelawan ? relawanName : patientName,
        is_mine: msg.sender_id === user.id,
        kind: msg.kind,
        body: msg.body,
        media_path: msg.media_path,
        duration_seconds: msg.duration_seconds,
        created_at: msg.created_at,
      };
    });

    return NextResponse.json({
      success: true,
      data: messagesView,
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_SERVER_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}

/**
 * POST /api/peer-tickets/[id]/messages
 * Mengirim pesan baru ke Ruang Dengar.
 * Menegakkan sapaan pertama relawan (10 menit) dan batas durasi sesi 24 jam.
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

    const { id } = await params;
    if (!id || !UUID_RE.test(id)) {
      return fail(400, 'INVALID_ID', 'ID tiket tidak valid');
    }

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return fail(400, 'BAD_REQUEST', 'Request body bukan format JSON yang valid');
    }

    const parsed = sendPeerMessageSchema.safeParse(rawBody);
    if (!parsed.success) {
      return fail(422, 'VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Data pesan tidak valid');
    }

    if (parsed.data.media_path || parsed.data.kind === 'image' || parsed.data.kind === 'voice') {
      if (!isValidPeerMediaPath(id, parsed.data.media_path)) {
        return fail(
          400,
          'INVALID_MEDIA_PATH',
          'Format media_path tidak valid atau berada di luar tiket ini.'
        );
      }
    }

    const { data: ticketData, error: ticketError } = await supabaseAdmin
      .from('peer_tickets')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (ticketError) {
      return fail(500, 'QUERY_FAILED', ticketError.message);
    }
    if (!ticketData) {
      return fail(404, 'NOT_FOUND', 'Tiket curhat tidak ditemukan');
    }

    let ticket = ticketData as PeerTicketEntity;

    const isPatient = user.id === ticket.patient_id;
    const isRelawan = user.id === ticket.claimed_by;

    if (!isPatient && !isRelawan) {
      return fail(403, 'FORBIDDEN', 'Hanya peserta tiket yang berhak mengirim pesan');
    }

    // 1. Penegakan status siklus tiket
    if (ticket.status === 'open') {
      return fail(409, 'INVALID_TICKET_STATUS', 'Tiket belum diambil oleh relawan pendamping.');
    }

    if (ticket.status === 'claimed') {
      if (isPatient) {
        return fail(409, 'SESSION_NOT_ACTIVE', 'Sesi belum aktif. Menunggu sapaan pertama dari relawan.');
      }

      // Relawan mengirim balasan pertama: panggil RPC peer_ticket_first_response
      const { data: rpcTicket, error: rpcError } = await supabaseAdmin.rpc('peer_ticket_first_response', {
        p_ticket_id: id,
        p_relawan_id: user.id,
      });

      if (rpcError) {
        const msg = rpcError.message || '';
        if (msg.includes('TIMEOUT') || msg.includes('FIRST_RESPONSE_TIMEOUT')) {
          return fail(409, 'FIRST_RESPONSE_TIMEOUT', 'Batas waktu respon pertama (10 menit) telah terlewati. Tiket telah dikembalikan ke antrean.');
        }
        return fail(400, 'FIRST_RESPONSE_FAILED', msg || 'Gagal memproses respon pertama');
      }

      const updatedTicket = rpcTicket as PeerTicketEntity | null;
      if (!updatedTicket || updatedTicket.status === 'open') {
        return fail(409, 'FIRST_RESPONSE_TIMEOUT', 'Batas waktu respon pertama (10 menit) telah terlewati. Tiket telah dikembalikan ke antrean.');
      }

      if (updatedTicket.status !== 'active') {
        return fail(409, 'INVALID_TICKET_STATUS', 'Status tiket tidak valid untuk memulai sesi.');
      }

      ticket = updatedTicket;
    } else if (ticket.status === 'active') {
      // 2. Penegakan jendela 24 jam sejak first_response_at
      if (ticket.first_response_at) {
        const startMs = new Date(ticket.first_response_at).getTime();
        const expireMs = startMs + 24 * 60 * 60 * 1000;
        if (Date.now() > expireMs) {
          return fail(409, 'PEER_SESSION_EXPIRED', 'Waktu sesi pendampingan sebaya telah berakhir (maksimal 24 jam).');
        }
      }
    } else {
      // closed, archived, dll.
      return fail(409, 'PEER_SESSION_CLOSED', 'Sesi curhat sebaya telah ditutup atau diarsipkan.');
    }

    // 3. Simpan pesan baru ke tabel peer_messages
    const { data: newMsg, error: insertError } = await supabaseAdmin
      .from('peer_messages')
      .insert({
        ticket_id: id,
        sender_id: user.id,
        kind: parsed.data.kind,
        body: parsed.data.kind === 'text'
          ? parsed.data.body?.trim()
          : (parsed.data.body?.trim() || null),
        media_path: parsed.data.media_path || null,
        duration_seconds: parsed.data.duration_seconds ?? null,
      })
      .select('*')
      .single();

    if (insertError) {
      return fail(500, 'INSERT_FAILED', insertError.message);
    }

    const insertedEntity = newMsg as PeerMessageEntity;

    // 4. Susun nama tampilan pengirim
    let senderName = ticket.patient_alias || 'Teman Curhat';
    if (isRelawan) {
      const { data: relawanProfile } = await supabaseAdmin
        .from('relawan_profiles')
        .select('alias_name')
        .eq('user_id', user.id)
        .maybeSingle();
      senderName = relawanProfile?.alias_name?.trim() || 'Pendengar Sebaya';
    }

    const responseView: PeerMessageView = {
      id: insertedEntity.id,
      ticket_id: insertedEntity.ticket_id,
      sender_id: insertedEntity.sender_id,
      sender_role: isRelawan ? 'relawan' : 'pasien',
      sender_name: senderName,
      is_mine: true,
      kind: insertedEntity.kind,
      body: insertedEntity.body,
      media_path: insertedEntity.media_path,
      duration_seconds: insertedEntity.duration_seconds,
      created_at: insertedEntity.created_at,
    };

    return NextResponse.json(
      {
        success: true,
        data: responseView,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_SERVER_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}
