import { supabaseAdmin } from '@/lib/supabase/client';
import { DEFAULT_SYSTEM_SETTINGS } from '@/constant/system-settings';
import { clearMaintenanceCache } from '@/lib/maintenance';
import {
  systemSettingsValidators,
  type SettingKey,
} from '@/lib/validations/system-settings';
import type {
  AdminSettingsAuditResponse,
  AdminSettingsResponse,
  MaintenancePhase,
  PublicSettings,
  SystemSettingAuditRow,
  SystemSettingRow,
  SystemSettings,
  SystemSettingsAuditItem,
} from '@/types/system-settings';

export class SystemSettingsService {
  private static publicCache: { data: PublicSettings; expiresAt: number } | null = null;
  private static readonly CACHE_TTL_MS = 5_000;

  public static invalidateCache(): void {
    this.publicCache = null;
  }

  public static async calculateMaintenancePhase(
    scheduledStart: string | null,
    estimatedEnd?: string | null
  ): Promise<MaintenancePhase> {
    if (!scheduledStart) return 'none';
    const startTime = new Date(scheduledStart).getTime();
    if (!Number.isFinite(startTime)) return 'none';

    if (estimatedEnd) {
      const endTime = new Date(estimatedEnd).getTime();
      if (Number.isFinite(endTime) && Date.now() >= endTime) {
        return 'none';
      }
    }

    if (Date.now() < startTime) return 'scheduled';

    if (!supabaseAdmin) {
      console.error('Database client tidak tersedia untuk calculateMaintenancePhase');
      return 'none';
    }

    try {
      const { count, error } = await supabaseAdmin
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'in_progress');

      if (error) {
        console.error('Gagal memeriksa booking in_progress untuk fase maintenance:', error.message);
        return 'none';
      }

      return (count ?? 0) > 0 ? 'draining' : 'active';
    } catch (err) {
      console.error('Error calculating maintenance phase:', err);
      return 'none';
    }
  }

  public static async getPublicSettings(): Promise<PublicSettings> {
    const now = Date.now();
    if (this.publicCache && this.publicCache.expiresAt > now) return this.publicCache.data;

    const { settings } = await this.getRawSettingsMap();
    const result: PublicSettings = {
      topup: settings.topup,
      tip: settings.tip,
      payout: settings.payout,
      extension_price: settings.extension_price,
      relawan: settings.relawan,
      upload: settings.upload,
      refund_policy: settings.refund_policy,
      revenue_share: settings.revenue_share,
      booking: settings.booking,
      rating: settings.rating,
      maintenance: {
        ...settings.maintenance,
        phase: await this.calculateMaintenancePhase(
          settings.maintenance.scheduled_start,
          settings.maintenance.estimated_end
        ),
      },
    };

    this.publicCache = { data: result, expiresAt: now + this.CACHE_TTL_MS };
    return result;
  }

  public static async getAdminSettings(): Promise<AdminSettingsResponse> {
    return this.getRawSettingsMap();
  }

  private static async getRawSettingsMap(): Promise<AdminSettingsResponse> {
    const settings: SystemSettings = { ...DEFAULT_SYSTEM_SETTINGS };
    const meta: AdminSettingsResponse['meta'] = {};
    const defaultTimestamp = new Date(0).toISOString();

    for (const key of Object.keys(DEFAULT_SYSTEM_SETTINGS) as (keyof SystemSettings)[]) {
      meta[key] = { updated_at: defaultTimestamp, updated_by: null };
    }

    if (!supabaseAdmin) return { settings, meta };

    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('key, value, updated_by, updated_at');
    if (error) throw new Error(`Gagal membaca system settings: ${error.message}`);
    if (!data) return { settings, meta };

    for (const row of data as SystemSettingRow[]) {
      if (row.key in settings) {
        const key = row.key as keyof SystemSettings;
        (settings as Record<string, unknown>)[key] = row.value;
        meta[key] = { updated_at: row.updated_at, updated_by: row.updated_by };
      }
    }
    return { settings, meta };
  }

  public static async updateSettings(
    updates: Record<string, unknown>,
    userId: string
  ): Promise<{
    success: boolean;
    error?: string;
    details?: Record<string, string>;
    data?: AdminSettingsResponse;
  }> {
    if (!supabaseAdmin) {
      return { success: false, error: 'SERVER_CONFIG_ERROR', details: { message: 'Database client tidak tersedia' } };
    }

    const validationErrors: Record<string, string> = {};
    const validUpdates: Record<string, unknown> = {};
    for (const [key, rawValue] of Object.entries(updates)) {
      if (!(key in systemSettingsValidators)) {
        validationErrors[key] = `Key '${key}' bukan konfigurasi yang valid`;
        continue;
      }
      const parsed = systemSettingsValidators[key as SettingKey].safeParse(rawValue);
      if (!parsed.success) {
        validationErrors[key] = parsed.error.issues[0]?.message ?? 'Nilai tidak valid';
      } else {
        validUpdates[key] = parsed.data;
      }
    }

    if (Object.keys(validationErrors).length) {
      return { success: false, error: 'VALIDATION_ERROR', details: validationErrors };
    }
    if (!Object.keys(validUpdates).length) {
      return { success: false, error: 'NO_UPDATES_PROVIDED', details: { message: 'Tidak ada konfigurasi yang diubah' } };
    }

    const { error } = await supabaseAdmin.rpc('update_system_settings_batch', {
      p_entries: validUpdates,
      p_user_id: userId,
    });
    if (error) {
      console.error('Atomic settings update RPC failed:', error.message);
      return { success: false, error: 'DB_ERROR', details: { message: 'Gagal memperbarui pengaturan secara atomik' } };
    }

    this.invalidateCache();
    clearMaintenanceCache();
    return { success: true, data: await this.getRawSettingsMap() };
  }

  public static async getAuditLog(params: {
    page: number;
    limit: number;
    key?: string | null;
  }): Promise<AdminSettingsAuditResponse> {
    const { page, limit, key } = params;
    if (!supabaseAdmin) return { data: [], total: 0, page, limit };

    let query = supabaseAdmin
      .from('system_settings_audit')
      .select('id, key, old_value, new_value, changed_by, changed_at', { count: 'exact' })
      .order('changed_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    if (key) query = query.eq('key', key);

    const { data: rows, count, error } = await query;
    if (error) throw new Error(`Gagal membaca audit settings: ${error.message}`);
    if (!rows) return { data: [], total: count ?? 0, page, limit };

    const auditRows = rows as SystemSettingAuditRow[];
    const userIds = Array.from(new Set(auditRows.map((row) => row.changed_by).filter((id): id is string => Boolean(id))));
    const nameMap = new Map<string, string>();
    if (userIds.length) {
      const { data: profiles, error: profileError } = await supabaseAdmin
        .from('admin_profiles').select('user_id, nama_lengkap').in('user_id', userIds);
      if (profileError) throw new Error(`Gagal membaca nama admin audit: ${profileError.message}`);
      for (const profile of profiles ?? []) nameMap.set(profile.user_id, profile.nama_lengkap);

      const { data: users, error: usersError } = await supabaseAdmin
        .from('users').select('id, email').in('id', userIds);
      if (usersError) throw new Error(`Gagal membaca email admin audit: ${usersError.message}`);
      for (const user of users ?? []) if (!nameMap.has(user.id)) nameMap.set(user.id, user.email);
    }

    const items: SystemSettingsAuditItem[] = auditRows.map((row) => ({
      id: row.id,
      key: row.key,
      old_value: row.old_value,
      new_value: row.new_value,
      changed_by: row.changed_by,
      changed_by_name: row.changed_by ? nameMap.get(row.changed_by) ?? null : null,
      changed_at: row.changed_at,
    }));
    return { data: items, total: count ?? items.length, page, limit };
  }
}
