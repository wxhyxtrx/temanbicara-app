import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail, getSessionUser } from '@/lib/auth/session';
import { getMaintenanceStatus } from '@/lib/maintenance';
import { peerReviewSchema } from '@/lib/validations/peer-tickets';
import type { PeerReviewEntity } from '@/types/peer-tickets';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/peer-tickets/[id]/review
 * Membaca data ulasan yang sudah diberikan pada tiket curhat sebaya.
 * Akses khusus peserta tiket (pasien atau relawan pendamping) atau admin.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const maintenance = await getMaintenanceStatus();
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

    // Ambil data tiket untuk otorisasi peserta
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('peer_tickets')
      .select('id, patient_id, claimed_by')
      .eq('id', id)
      .maybeSingle();

    if (ticketError) {
      return fail(500, 'QUERY_FAILED', ticketError.message);
    }
    if (!ticket) {
      return fail(404, 'TICKET_NOT_FOUND', 'Tiket curhat tidak ditemukan');
    }

    const isParticipant = user.id === ticket.patient_id || user.id === ticket.claimed_by;
    const isAdmin = user.role === 'admin';

    if (!isParticipant && !isAdmin) {
      return fail(403, 'FORBIDDEN', 'Hanya peserta tiket atau admin yang dapat melihat ulasan tiket ini');
    }

    // Ambil ulasan dari tabel peer_reviews
    const { data: review, error: reviewError } = await supabaseAdmin
      .from('peer_reviews')
      .select('ticket_id, patient_id, relawan_id, rating, review, is_hidden, created_at, updated_at')
      .eq('ticket_id', id)
      .maybeSingle();

    if (reviewError) {
      return fail(500, 'QUERY_FAILED', reviewError.message);
    }

    return NextResponse.json({
      success: true,
      data: (review as PeerReviewEntity | null) ?? null,
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_SERVER_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}

/**
 * POST /api/peer-tickets/[id]/review
 * Pasien memberikan ulasan bintang (1-5) dan teks umpan balik untuk tiket yang telah berstatus closed.
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
      return fail(403, 'FORBIDDEN', 'Hanya pasien yang dapat memberikan ulasan tiket');
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
      return fail(400, 'VALIDATION_ERROR', 'Request body bukan format JSON yang valid');
    }

    const parsed = peerReviewSchema.safeParse(rawBody);
    if (!parsed.success) {
      return fail(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Data ulasan tidak valid');
    }

    // Ambil data tiket untuk validasi status dan kepemilikan
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
      return fail(403, 'FORBIDDEN', 'Hanya pasien pemilik tiket yang dapat memberikan ulasan');
    }

    if (ticket.status !== 'closed') {
      return fail(409, 'TICKET_NOT_CLOSED', 'Hanya tiket yang telah ditutup yang dapat diulas');
    }

    // Panggil RPC peer_review_create
    const { data: review, error: rpcError } = await supabaseAdmin.rpc('peer_review_create', {
      p_ticket_id: id,
      p_patient_id: user.id,
      p_rating: parsed.data.rating,
      p_review: parsed.data.review ?? null,
    });

    if (rpcError) {
      const msg = rpcError.message || '';
      if (msg.includes('ALREADY_REVIEWED') || msg.includes('duplicate key') || msg.includes('23505')) {
        return fail(409, 'REVIEW_ALREADY_EXISTS', 'Ulasan untuk tiket ini sudah pernah dibuat');
      }
      if (msg.includes('RATING_WINDOW_EXPIRED')) {
        return fail(409, 'RATING_WINDOW_EXPIRED', 'Batas waktu pemberian ulasan telah berakhir');
      }
      if (msg.includes('TICKET_NOT_CLOSED')) {
        return fail(409, 'TICKET_NOT_CLOSED', 'Hanya tiket yang telah ditutup yang dapat diulas');
      }
      if (msg.includes('TICKET_NOT_FOUND')) {
        return fail(404, 'TICKET_NOT_FOUND', 'Tiket curhat tidak ditemukan');
      }
      if (msg.includes('FORBIDDEN')) {
        return fail(403, 'FORBIDDEN', 'Hanya pasien pemilik tiket yang dapat memberikan ulasan');
      }
      if (msg.includes('INVALID_RATING') || msg.includes('REVIEW_TOO_LONG') || msg.includes('INVALID_PARAMETER')) {
        return fail(400, 'VALIDATION_ERROR', msg);
      }
      return fail(400, 'REVIEW_FAILED', msg || 'Gagal menyimpan ulasan');
    }

    return NextResponse.json(
      {
        success: true,
        data: review as PeerReviewEntity,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_SERVER_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}
