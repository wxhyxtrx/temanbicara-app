import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/client';
import { fail, getSessionUser } from '@/lib/auth/session';
import { getMaintenanceStatus } from '@/lib/maintenance';

export interface RelawanQuotaResponse {
  quota_date: string;
  daily_limit: number;
  tickets_claimed: number;
  penalty_points: number;
  carry_penalty: number;
  consumed: number;
  remaining: number;
}

/**
 * GET /api/peer-tickets/quota
 * Mengambil informasi kuota harian relawan untuk tanggal kalender WIB (Asia/Jakarta),
 * konsumsi tiket, poin penalti, carry penalty kemarin, dan sisa kuota.
 * Khusus relawan aktif.
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
      return fail(403, 'FORBIDDEN', 'Hanya pengguna dengan peran relawan yang dapat mengakses informasi kuota');
    }

    if (user.status !== 'active') {
      return fail(403, 'USER_NOT_ACTIVE', 'Akun relawan belum aktif');
    }

    if (!supabaseAdmin) {
      return fail(500, 'SERVER_CONFIG_ERROR', 'Database client tidak tersedia');
    }

    // Tanggal WIB hari ini dan kemarin
    const todayWib = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
    const [y, m, d] = todayWib.split('-').map(Number);
    const prevDate = new Date(Date.UTC(y, m - 1, d));
    prevDate.setUTCDate(prevDate.getUTCDate() - 1);
    const yesterdayWib = prevDate.toISOString().slice(0, 10);

    // Default konfigurasi dari system_settings ('relawan')
    let dailyLimit = 3;
    let maxCarryPenalty = 1;

    try {
      const { data: settingRow } = await supabaseAdmin
        .from('system_settings')
        .select('value')
        .eq('key', 'relawan')
        .maybeSingle();

      if (settingRow?.value && typeof settingRow.value === 'object') {
        const val = settingRow.value as Record<string, unknown>;
        if (typeof val.daily_ticket_quota === 'number') {
          dailyLimit = val.daily_ticket_quota;
        }
        if (typeof val.max_carry_penalty === 'number') {
          maxCarryPenalty = val.max_carry_penalty;
        }
      }
    } catch {
      // fallback default (3 dan 1)
    }

    // Ambil baris kuota hari ini dan kemarin
    const { data: quotaRows, error: quotaError } = await supabaseAdmin
      .from('relawan_daily_quota')
      .select('quota_date, tickets_claimed, penalty_points')
      .eq('relawan_id', user.id)
      .in('quota_date', [todayWib, yesterdayWib]);

    if (quotaError) {
      return fail(500, 'QUERY_FAILED', quotaError.message);
    }

    const todayRow = (quotaRows ?? []).find((r) => r.quota_date === todayWib);
    const yesterdayRow = (quotaRows ?? []).find((r) => r.quota_date === yesterdayWib);

    // Perhitungan carry penalty kemarin
    const yesterdayTicketsClaimed = Number(yesterdayRow?.tickets_claimed ?? 0);
    const yesterdayPenaltyPoints = Number(yesterdayRow?.penalty_points ?? 0);
    const yesterdayConsumed = yesterdayTicketsClaimed + yesterdayPenaltyPoints;

    const carryPenalty =
      yesterdayConsumed > dailyLimit
        ? Math.min(yesterdayConsumed - dailyLimit, maxCarryPenalty)
        : 0;

    // Perhitungan konsumsi hari ini
    const ticketsClaimed = Number(todayRow?.tickets_claimed ?? 0);
    const penaltyPoints = Number(todayRow?.penalty_points ?? 0);
    const consumed = ticketsClaimed + penaltyPoints + carryPenalty;
    const remaining = Math.max(0, dailyLimit - consumed);

    const quotaData: RelawanQuotaResponse = {
      quota_date: todayWib,
      daily_limit: dailyLimit,
      tickets_claimed: ticketsClaimed,
      penalty_points: penaltyPoints,
      carry_penalty: carryPenalty,
      consumed,
      remaining,
    };

    return NextResponse.json({
      success: true,
      data: quotaData,
    });
  } catch (err: unknown) {
    return fail(500, 'INTERNAL_SERVER_ERROR', err instanceof Error ? err.message : 'Kesalahan sistem');
  }
}
