import { supabaseAdmin } from '@/lib/supabase/client';
import { SystemSettingsService } from '@/services/system-settings.service';
import type { MaintenancePhase, MaintenanceSetting } from '@/types/system-settings';

export interface MaintenanceStatus {
  phase: MaintenancePhase;
  scheduled_start: string | null;
  estimated_end: string | null;
  message: string;
}

export const DEFAULT_MAINTENANCE_MESSAGE =
  'Sistem sedang dalam pemeliharaan. Silakan coba beberapa saat lagi.';

let maintenanceCache: { data: MaintenanceStatus; expiresAt: number } | null = null;
const CACHE_TTL_MS = 5_000; // Cache 5 detik untuk efisiensi request middleware

export function clearMaintenanceCache(): void {
  maintenanceCache = null;
}

/**
 * Mengambil status maintenance terkini dengan cache in-memory singkat (5 detik).
 * Mengembalikan fase (none/scheduled/draining/active), jadwal mulai/selesai, dan pesan admin.
 */
export async function getMaintenanceStatus(): Promise<MaintenanceStatus> {
  const now = Date.now();
  if (maintenanceCache && maintenanceCache.expiresAt > now) {
    return maintenanceCache.data;
  }

  try {
    let setting: MaintenanceSetting | null = null;

    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('system_settings')
        .select('value')
        .eq('key', 'maintenance')
        .maybeSingle();

      if (!error && data?.value) {
        setting = data.value as MaintenanceSetting;
      }
    }

    const scheduled_start = setting?.scheduled_start ?? null;
    const estimated_end = setting?.estimated_end ?? null;
    const rawMessage = typeof setting?.message === 'string' ? setting.message.trim() : '';
    const message = rawMessage || DEFAULT_MAINTENANCE_MESSAGE;

    const phase = await SystemSettingsService.calculateMaintenancePhase(scheduled_start);

    const result: MaintenanceStatus = {
      phase,
      scheduled_start,
      estimated_end,
      message,
    };

    maintenanceCache = { data: result, expiresAt: now + CACHE_TTL_MS };
    return result;
  } catch (err) {
    console.error('Error fetching maintenance status:', err);
    return {
      phase: 'none',
      scheduled_start: null,
      estimated_end: null,
      message: DEFAULT_MAINTENANCE_MESSAGE,
    };
  }
}
