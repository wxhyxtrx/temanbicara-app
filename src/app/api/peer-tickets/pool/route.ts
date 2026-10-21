import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail, getSessionUser } from '@/lib/auth/session';
import { getMaintenanceStatus } from '@/lib/maintenance';
import type { RelawanPeerTicketDTO } from '@/types/peer-tickets';

/**
 * GET /api/peer-tickets/pool
 * Mengambil antrean tiket curhat yang sedang menunggu (status: 'open').
 * Khusus relawan aktif.
 * Menyaring tiket yang abandoned_by memuat ID relawan.
 * Mengembalikan RelawanPeerTicketDTO tanpa kolom patient_id.
 * Urutan FIFO (created_at asc).
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
      return fail(403, 'FORBIDDEN', 'Hanya pengguna dengan peran relawan yang dapat mengakses antrean tiket');
    }

    if (user.status !== 'active') {
      return fail(403, 'USER_NOT_ACTIVE', 'Akun relawan belum aktif');
    }

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    const { data: tickets, error } = await supabaseAdmin
      .from('peer_tickets')
      .select(
        'id, patient_alias, topic, emotion, content, is_anonymous, status, claimed_by, claimed_at, first_response_at, closed_at, archived_at, abandoned_by, created_at, updated_at'
      )
      .eq('status', 'open')
      .order('created_at', { ascending: true });

    if (error) {
      return fail(500, 'QUERY_FAILED', error.message);
    }

    const filtered = (tickets ?? []).filter((t) => {
      if (Array.isArray(t.abandoned_by) && t.abandoned_by.includes(user.id)) {
        return false;
      }
      return true;
    });

    const safeTickets: RelawanPeerTicketDTO[] = filtered.map((t) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { patient_id: _discard, ...rest } = t as unknown as { patient_id?: unknown } & RelawanPeerTicketDTO;
      return rest;
    });

    return NextResponse.json({
      success: true,
      data: safeTickets,
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_SERVER_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}
