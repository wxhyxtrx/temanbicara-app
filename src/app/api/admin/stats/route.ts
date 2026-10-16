import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { getSessionUser, fail } from '@/lib/auth/session';
import type { AdminDashboardStatsData } from '@/types/user-profile';

const ROLES = ['pasien', 'psikolog', 'relawan', 'admin'] as const;
const STATUSES = [
  'active',
  'unverified_email',
  'incomplete_profile',
  'pending_approval',
  'pending_verification',
  'rejected',
  'suspended',
] as const;

export async function GET() {
  try {
    const session = await getSessionUser();
    if (session.response) return session.response;
    if (session.user.role !== 'admin' || session.user.status !== 'active') {
      return fail(403, 'FORBIDDEN', 'Hanya admin yang dapat mengakses statistik platform');
    }

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client belum terinisialisasi');
    }

    // 1. Panggil RPC admin_dashboard_stats (STABLE, SECURITY DEFINER)
    // untuk kalkulasi SUM top-up all-time/today, payout requested, dan revenue di PostgreSQL
    const { data: dbStats, error: rpcErr } = await supabaseAdmin.rpc('admin_dashboard_stats');
    if (rpcErr) {
      console.error('Error calling admin_dashboard_stats RPC:', rpcErr);
      return fail(500, 'DB_ERROR', 'Gagal memuat statistik finansial platform');
    }

    // 2. Ambil data users untuk menghitung breakdown per role & status
    const { data: usersData, error: usersErr } = await supabaseAdmin
      .from('users')
      .select('role, status');

    if (usersErr) {
      console.error('Error fetching users for stats:', usersErr);
      return fail(500, 'DB_ERROR', 'Gagal memuat statistik pengguna');
    }

    const byRole: Record<string, number> = {};
    for (const r of ROLES) byRole[r] = 0;

    const byStatus: Record<string, number> = {};
    for (const s of STATUSES) byStatus[s] = 0;

    let pendingMitraCount = 0;
    const usersList = usersData ?? [];

    for (const u of usersList) {
      byRole[u.role] = (byRole[u.role] ?? 0) + 1;
      byStatus[u.status] = (byStatus[u.status] ?? 0) + 1;

      const isMitra = u.role === 'psikolog' || u.role === 'relawan';
      const isPending = u.status === 'pending_verification' || u.status === 'pending_approval';
      if (isMitra && isPending) {
        pendingMitraCount++;
      }
    }

    const typedStats = dbStats as {
      topup?: AdminDashboardStatsData['topup'];
      payout?: AdminDashboardStatsData['payout'];
      revenue?: AdminDashboardStatsData['revenue'];
    };

    const responseData: AdminDashboardStatsData = {
      users: {
        total: usersList.length,
        by_role: byRole,
        by_status: byStatus,
      },
      mitra_verification: {
        pending_count: pendingMitraCount,
      },
      payout: typedStats?.payout ?? {
        requested_count: 0,
        total_requested_rupiah: 0,
      },
      topup: typedStats?.topup ?? {
        all_time: { total_orders: 0, total_coins: 0, total_rupiah: 0 },
        today: { total_orders: 0, total_coins: 0, total_rupiah: 0 },
      },
      revenue: typedStats?.revenue ?? {
        total_platform_revenue_rupiah: 0,
        breakdown_by_reason: {},
      },
    };

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}
