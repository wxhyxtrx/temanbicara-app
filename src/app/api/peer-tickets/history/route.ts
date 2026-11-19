import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail, getSessionUser, pageParams } from '@/lib/auth/session';
import type { PeerTicketHistoryItem } from '@/types/peer-tickets';

/**
 * GET /api/peer-tickets/history?page=&limit=
 * Riwayat curhat yang sudah selesai.
 * - Pasien: tiket miliknya yang closed/archived, dengan alias relawan pendamping.
 * - Relawan: tiket yang pernah ia dampingi (closed), hanya alias pasien (tanpa identitas asli).
 */
export async function GET(req: Request) {
  try {
    const session = await getSessionUser();
    if (session.response) return session.response;
    const { user } = session;

    if (user.role !== 'pasien' && user.role !== 'relawan') {
      return fail(403, 'FORBIDDEN', 'Riwayat curhat hanya untuk pasien dan relawan');
    }
    if (user.status !== 'active') {
      return fail(403, 'USER_NOT_ACTIVE', 'Akun belum aktif');
    }
    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    const { page, limit, from, to } = pageParams(new URL(req.url), 10);
    const isPatient = user.role === 'pasien';

    let query = supabaseAdmin
      .from('peer_tickets')
      .select('id, patient_alias, topic, emotion, status, claimed_by, created_at, closed_at, archived_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);
    query = isPatient
      ? query.eq('patient_id', user.id).in('status', ['closed', 'archived'])
      : query.eq('claimed_by', user.id).eq('status', 'closed');

    const { data: tickets, error, count } = await query;
    if (error) {
      console.error('[PEER_TICKET_HISTORY_ERROR]:', error);
      return fail(500, 'QUERY_FAILED', 'Gagal memuat riwayat curhat');
    }

    const rows = tickets ?? [];
    const ids = rows.map((t) => t.id);
    const relawanIds = [...new Set(rows.map((t) => t.claimed_by).filter(Boolean))] as string[];

    const [reviewsRes, relawanRes] = await Promise.all([
      ids.length
        ? supabaseAdmin.from('peer_reviews').select('ticket_id, rating').in('ticket_id', ids)
        : Promise.resolve({ data: [] as { ticket_id: string; rating: number }[] }),
      isPatient && relawanIds.length
        ? supabaseAdmin.from('relawan_profiles').select('user_id, alias_name').in('user_id', relawanIds)
        : Promise.resolve({ data: [] as { user_id: string; alias_name: string | null }[] }),
    ]);

    const ratingByTicket = new Map((reviewsRes.data ?? []).map((r) => [r.ticket_id, Number(r.rating)]));
    const aliasByRelawan = new Map((relawanRes.data ?? []).map((r) => [r.user_id, r.alias_name]));

    const data: PeerTicketHistoryItem[] = rows.map((t) => ({
      id: t.id,
      topic: t.topic,
      emotion: t.emotion,
      status: t.status,
      created_at: t.created_at,
      ended_at: t.closed_at ?? t.archived_at ?? null,
      // Pasien melihat alias relawan; relawan hanya melihat alias pasien.
      counterpart_name: isPatient
        ? (t.claimed_by ? aliasByRelawan.get(t.claimed_by) || 'Pendengar Sebaya' : null)
        : t.patient_alias || 'Teman Curhat',
      rating: ratingByTicket.get(t.id) ?? null,
    }));

    const total = count ?? 0;
    return NextResponse.json({
      success: true,
      data,
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (err: unknown) {
    console.error('[PEER_TICKET_HISTORY_INTERNAL_ERROR]:', err);
    return fail(500, 'INTERNAL_SERVER_ERROR', 'Terjadi kesalahan sistem saat memuat riwayat curhat');
  }
}
