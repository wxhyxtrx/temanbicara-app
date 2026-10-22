import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail, getSessionUser } from '@/lib/auth/session';
import { getMaintenanceStatus } from '@/lib/maintenance';
import type { PeerRatingSummaryDTO } from '@/types/peer-tickets';

/**
 * GET /api/listener/rating-summary
 * Mengambil agregat ulasan dan rata-rata rating relawan sebaya yang sedang login.
 * Rata-rata hanya ditampilkan jika jumlah ulasan telah mencapai batas min_count_to_show.
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
      return fail(403, 'FORBIDDEN', 'Hanya relawan yang dapat mengakses ringkasan rating');
    }

    if (user.status !== 'active') {
      return fail(403, 'USER_NOT_ACTIVE', 'Akun relawan belum aktif');
    }

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    const { data, error: rpcError } = await supabaseAdmin.rpc('peer_rating_summary', {
      p_relawan_id: user.id,
    });

    if (rpcError) {
      return fail(500, 'QUERY_FAILED', rpcError.message);
    }

    const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : (data as Record<string, unknown> | undefined);
    const rating_avg = row?.rating_avg !== null && row?.rating_avg !== undefined
      ? Number(row.rating_avg)
      : null;
    const rating_count = row?.rating_count !== null && row?.rating_count !== undefined
      ? Number(row.rating_count)
      : 0;

    const summary: PeerRatingSummaryDTO = {
      rating_avg,
      rating_count,
    };

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_SERVER_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}
