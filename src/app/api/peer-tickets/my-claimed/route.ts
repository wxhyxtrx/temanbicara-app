import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail, getSessionUser } from '@/lib/auth/session';
import { getMaintenanceStatus } from '@/lib/maintenance';
import type { RelawanPeerTicketDTO } from '@/types/peer-tickets';

/**
 * GET /api/peer-tickets/my-claimed
 * Mengambil tiket aktif yang sedang ditangani oleh relawan (status: 'claimed' atau 'active').
 * Khusus relawan aktif.
 * Mengembalikan RelawanPeerTicketDTO atau null.
 */
export async function GET() {
  try {
    const maintenance = await getMaintenanceStatus();
    if (maintenance.phase === 'active') {
      return fail(503, 'MAINTENANCE_ACTIVE', maintenance.message);
    }

    const session = await getSessionUser();
    if (session.response) return session.response;
    const { user } = session;

    if (user.role !== 'relawan') {
      return fail(403, 'FORBIDDEN', 'Hanya pengguna dengan peran relawan yang dapat mengakses fitur ini');
    }

    if (user.status !== 'active') {
      return fail(403, 'USER_NOT_ACTIVE', 'Akun relawan belum aktif');
    }

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    const { data: ticket, error } = await supabaseAdmin
      .from('peer_tickets')
      .select(
        'id, patient_alias, topic, emotion, content, is_anonymous, status, claimed_by, claimed_at, first_response_at, closed_at, archived_at, abandoned_by, created_at, updated_at'
      )
      .eq('claimed_by', user.id)
      .in('status', ['claimed', 'active'])
      .order('claimed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return fail(500, 'QUERY_FAILED', error.message);
    }

    if (!ticket) {
      return NextResponse.json({
        success: true,
        data: null,
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { patient_id: _discard, ...safeTicket } = ticket as unknown as { patient_id?: unknown } & RelawanPeerTicketDTO;

    return NextResponse.json({
      success: true,
      data: safeTicket as RelawanPeerTicketDTO,
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_SERVER_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}
