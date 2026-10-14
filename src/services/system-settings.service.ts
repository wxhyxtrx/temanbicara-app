import { supabaseAdmin } from '@/lib/supabase/client';
import {
  DEFAULT_PUBLIC_SETTINGS,
  DEFAULT_SYSTEM_SETTINGS,
} from '@/constant/system-settings';
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
  // In-memory cache untuk public settings (TTL 30 detik)
  private static publicCache: { data: PublicSettings; expiresAt: number } | null = null;
  private static readonly CACHE_TTL_MS = 30 * 1000;

  /**
   * Reset cache publik secara instan (dipanggil otomatis setelah PATCH setting)
   */
  public static invalidateCache(): void {
    this.publicCache = null;
  }

  /**
   * Menghitung fase maintenance secara dinamis berdasarkan waktu saat ini (§8 spec).
   *
   * Catatan Fase 1:
   * Tabel `bookings` baru diimplementasikan di Fase 3, sehingga penghitungan fase 'draining'
   * (mengecek booking yang in_progress saat maintenance dimulai) belum tersedia.
   * Untuk sementara di Fase 1: jika now >= scheduled_start, fase langsung dianggap 'active'.
   *
   * TODO (Fase 3/4): Setelah tabel `bookings` aktif, tambahkan pengecekan:
   * if (now >= scheduled_start && count(bookings.status = 'in_progress') > 0) return 'draining';
   */
  public static async calculateMaintenancePhase(
    scheduledStart: string | null
  ): Promise<MaintenancePhase> {
    if (!scheduledStart) return 'none';

    const now = Date.now();
    const startTime = new Date(scheduledStart).getTime();
    if (isNaN(startTime)) return 'none';

    if (now < startTime) {
      return 'scheduled';
    }

    // TODO (Fase 3/4): Cek booking in_progress untuk fase 'draining'.
    // Sementara Fase 1: langsung 'active'.
    return 'active';
  }

  /**
   * Mengambil setting yang aman dibaca publik / frontend umum (§3 & §9 spec).
   * Dilengkapi in-memory cache 30 detik yang di-reset saat PATCH.
   */
  public static async getPublicSettings(): Promise<PublicSettings> {
    const now = Date.now();
    if (this.publicCache && this.publicCache.expiresAt > now) {
      return this.publicCache.data;
    }

    const adminSettings = await this.getRawSettingsMap();
    const maintenance = adminSettings.settings.maintenance;
    const phase = await this.calculateMaintenancePhase(maintenance.scheduled_start);

    const publicData: PublicSettings = {
      topup: adminSettings.settings.topup,
      tip: adminSettings.settings.tip,
      payout: adminSettings.settings.payout,
      extension_price: adminSettings.settings.extension_price,
      relawan: adminSettings.settings.relawan,
      upload: adminSettings.settings.upload,
      refund_policy: adminSettings.settings.refund_policy,
      revenue_share: adminSettings.settings.revenue_share,
      maintenance: {
        ...maintenance,
        phase,
      },
    };

    this.publicCache = {
      data: publicData,
      expiresAt: now + this.CACHE_TTL_MS,
    };

    return publicData;
  }

  /**
   * Mengambil seluruh setting lengkap beserta metadata per key untuk Admin.
   */
  public static async getAdminSettings(): Promise<AdminSettingsResponse> {
    return this.getRawSettingsMap();
  }

  /**
   * Mengambil map raw settings dari DB dengan fallback nilai default.
   */
  private static async getRawSettingsMap(): Promise<AdminSettingsResponse> {
    const settings: SystemSettings = { ...DEFAULT_SYSTEM_SETTINGS };
    const meta: Record<string, { updated_at: string; updated_by: string | null }> = {};

    // Inisialisasi metadata default
    for (const key of Object.keys(DEFAULT_SYSTEM_SETTINGS)) {
      meta[key] = {
        updated_at: new Date(0).toISOString(),
        updated_by: null,
      };
    }

    if (!supabaseAdmin) {
      return { settings, meta };
    }

    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('key, value, updated_by, updated_at');

    if (error || !data) {
      return { settings, meta };
    }

    for (const row of data as SystemSettingRow[]) {
      if (row.key in settings) {
        const key = row.key as keyof SystemSettings;
        (settings as Record<string, unknown>)[key] = row.value;
        meta[key] = {
          updated_at: row.updated_at,
          updated_by: row.updated_by,
        };
      }
    }

    return { settings, meta };
  }

  /**
   * Memperbarui satu atau lebih key setting dengan validasi Zod ketat
   * dan mencatat audit dalam SATU transaksi atomik DB (RPC/Trigger).
   */
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
      return { success: false, error: 'Database client tidak tersedia' };
    }

    const validationErrors: Record<string, string> = {};
    const validUpdates: Record<string, unknown> = {};

    // 1. Validasi Zod per key
    for (const [key, rawVal] of Object.entries(updates)) {
      if (!(key in systemSettingsValidators)) {
        validationErrors[key] = `Key '${key}' bukan konfigurasi yang valid`;
        continue;
      }

      const validator = systemSettingsValidators[key as SettingKey];
      const parsed = validator.safeParse(rawVal);
      if (!parsed.success) {
        const firstIssue = parsed.error.issues[0]?.message || 'Nilai tidak valid';
        validationErrors[key] = firstIssue;
      } else {
        validUpdates[key] = parsed.data;
      }
    }

    if (Object.keys(validationErrors).length > 0) {
      return {
        success: false,
        error: 'VALIDATION_ERROR',
        details: validationErrors,
      };
    }

    if (Object.keys(validUpdates).length === 0) {
      return {
        success: false,
        error: 'NO_UPDATES_PROVIDED',
        details: { message: 'Tidak ada konfigurasi yang diubah' },
      };
    }

    // 2. Eksekusi atomik: Panggil RPC update_system_settings_batch (transaksi tunggal di DB)
    // Trigger trg_system_settings_audit di DB secara otomatis mencatat audit per baris
    // dalam transaksi yang sama.
    const { error: rpcError } = await supabaseAdmin.rpc('update_system_settings_batch', {
      p_entries: validUpdates,
      p_user_id: userId,
    });

    if (rpcError) {
      // Jangan fallback ke beberapa upsert terpisah: akan melanggar atomisitas batch.
      console.error('Atomic settings update RPC failed:', rpcError.message);
      return {
        success: false,
        error: 'DB_ERROR',
        details: { message: 'Gagal memperbarui pengaturan secara atomik' },
      };
    }

    // 3. Reset in-memory cache agar GET /api/settings/public langsung fresh
    this.invalidateCache();

    const latest = await this.getRawSettingsMap();
    return { success: true, data: latest };
  }

  /**
   * Mengambil riwayat audit konfigurasi sistem dengan pagination.
   */
  public static async getAuditLog(params: {
    page: number;
    limit: number;
    key?: string | null;
  }): Promise<AdminSettingsAuditResponse> {
    const { page, limit, key } = params;
    const from = (page - 1) * limit;
    const to = page * limit - 1;

    if (!supabaseAdmin) {
      return { data: [], total: 0, page, limit };
    }

    let query = supabaseAdmin
      .from('system_settings_audit')
      .select('id, key, old_value, new_value, changed_by, changed_at', {
        count: 'exact',
      })
      .order('changed_at', { ascending: false })
      .range(from, to);

    if (key) {
      query = query.eq('key', key);
    }

    const { data: rows, count, error } = await query;

    if (error || !rows) {
      return { data: [], total: 0, page, limit };
    }

    // Ambil nama admin pengubah (enrichment data)
    const userIds = Array.from(
      new Set(
        (rows as SystemSettingAuditRow[])
          .map((r) => r.changed_by)
          .filter((id): id is string => Boolean(id))
      )
    );

    const nameMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: adminProfiles } = await supabaseAdmin
        .from('admin_profiles')
        .select('user_id, nama_lengkap')
        .in('user_id', userIds);

      for (const p of adminProfiles || []) {
        nameMap.set(p.user_id, p.nama_lengkap);
      }

      const { data: users } = await supabaseAdmin
        .from('users')
        .select('id, email')
        .in('id', userIds);

      for (const u of users || []) {
        if (!nameMap.has(u.id)) {
          nameMap.set(u.id, u.email);
        }
      }
    }

    const items: SystemSettingsAuditItem[] = (rows as SystemSettingAuditRow[]).map(
      (r) => ({
        id: r.id,
        key: r.key,
        old_value: r.old_value,
        new_value: r.new_value,
        changed_by: r.changed_by,
        changed_by_name: r.changed_by ? nameMap.get(r.changed_by) ?? null : null,
        changed_at: r.changed_at,
      })
    );

    return {
      data: items,
      total: count ?? items.length,
      page,
      limit,
    };
  }
}
