import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail, getSessionUser } from '@/lib/auth/session';
import { getMaintenanceStatus } from '@/lib/maintenance';
import type { PeerTicketEntity } from '@/types/peer-tickets';

/**
 * GET /api/peer-tickets/my-active
 * Mengambil tiket curhat aktif milik pasien (status: open, claimed, active).
 * Mengembalikan data tiket atau null bila tidak ada tiket aktif.
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

    if (user.role !== 'pasien') {
      return fail(403, 'FORBIDDEN', 'Hanya pengguna dengan peran pasien yang dapat mengakses fitur ini');
    }

    if (user.status !== 'active') {
      return fail(403, 'USER_NOT_ACTIVE', 'Akun pasien belum aktif');
    }

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    const { data: ticket, error } = await supabaseAdmin
      .from('peer_tickets')
      .select('*')
      .eq('patient_id', user.id)
      .in('status', ['open', 'claimed', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return fail(500, 'QUERY_FAILED', error.message);
    }

    return NextResponse.json({
      success: true,
      data: (ticket ?? null) as PeerTicketEntity | null,
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_SERVER_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}
