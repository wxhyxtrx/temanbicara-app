import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail, getSessionUser } from '@/lib/auth/session';
import { getMaintenanceStatus } from '@/lib/maintenance';
import type { PeerTicketEntity } from '@/types/peer-tickets';

/**
 * GET /api/peer-tickets/my-active
 * Mengambil tiket curhat aktif milik pasien (status: open, claimed, active).
 * Jika tidak ada tiket aktif, memeriksa dan mengembalikan tiket terakhir jika berstatus 'archived'.
 * Mengembalikan data: null jika tiket terakhir closed atau belum pernah membuat tiket.
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

    // 1. Cari tiket aktif (open, claimed, active)
    const { data: activeTicket, error: activeError } = await supabaseAdmin
      .from('peer_tickets')
      .select('*')
      .eq('patient_id', user.id)
      .in('status', ['open', 'claimed', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<PeerTicketEntity>();

    if (activeError) {
      return fail(500, 'QUERY_FAILED', activeError.message);
    }

    if (activeTicket) {
      return NextResponse.json({
        success: true,
        data: activeTicket,
      });
    }

    // 2. Jika tidak ada tiket aktif, periksa tiket terakhir pasien
    const { data: lastTicket, error: lastError } = await supabaseAdmin
      .from('peer_tickets')
      .select('*')
      .eq('patient_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<PeerTicketEntity>();

    if (lastError) {
      return fail(500, 'QUERY_FAILED', lastError.message);
    }

    // 3. Jika tiket terakhir berstatus 'archived', kembalikan untuk kartu empati di beranda
    if (lastTicket && lastTicket.status === 'archived') {
      return NextResponse.json({
        success: true,
        data: lastTicket,
      });
    }

    // 4. Jika tiket terakhir closed atau tidak ada tiket sama sekali
    return NextResponse.json({
      success: true,
      data: null,
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_SERVER_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}
