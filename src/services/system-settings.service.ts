import { DEFAULT_PUBLIC_SETTINGS, DEFAULT_SYSTEM_SETTINGS } from "@/constant/system-settings";
import type {
  AdminSettingsAuditResponse,
  AdminSettingsResponse,
  PublicSettings,
  SystemSettings,
  SystemSettingsAuditItem,
} from "@/types/system-settings";

export interface PublicSettingsResult {
  settings: PublicSettings;
  isFallback: boolean;
  canTransact: boolean;
  error?: string;
}

export interface AdminSettingsResult {
  settings: SystemSettings;
  meta?: Record<string, { updated_at: string; updated_by: string | null }>;
  isFallback: boolean;
  error?: string;
}

export const systemSettingsService = {
  /**
   * Mengambil konfigurasi sistem publik dari API (/api/settings/public).
   * Jika gagal atau belum ada, mengembalikan fallback default untuk TAMPILAN SAJA.
   * DILARANG memakai fallback untuk transaksi (top-up, tip, payout, booking, ekstensi).
   */
  async getPublicSettings(): Promise<PublicSettingsResult> {
    try {
      const res = await fetch("/api/settings/public", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Gagal memuat public settings`);
      }

      const data = (await res.json()) as PublicSettings;
      return {
        settings: data,
        isFallback: false,
        canTransact: true,
      };
    } catch (err) {
      console.warn(
        "[SystemSettings] Menggunakan fallback default untuk TAMPILAN SAJA. Transaksi dinonaktifkan.",
        err
      );
      return {
        settings: DEFAULT_PUBLIC_SETTINGS,
        isFallback: true,
        canTransact: false,
        error: err instanceof Error ? err.message : "Gagal memuat pengaturan sistem",
      };
    }
  },

  /**
   * Mengambil konfigurasi lengkap sistem untuk portal admin (/api/admin/settings).
   */
  async getAdminSettings(): Promise<AdminSettingsResult> {
    try {
      const res = await fetch("/api/admin/settings", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Gagal memuat pengaturan admin`);
      }

      const json = await res.json();
      const settings = (json.settings || json) as SystemSettings;
      return {
        settings,
        meta: json.meta,
        isFallback: false,
      };
    } catch (err) {
      console.warn(
        "[SystemSettings] Endpoint /api/admin/settings belum tersedia atau gagal. Menggunakan default:",
        err
      );
      return {
        settings: DEFAULT_SYSTEM_SETTINGS,
        isFallback: true,
        error: err instanceof Error ? err.message : "Gagal memuat pengaturan sistem",
      };
    }
  },

  /**
   * Memperbarui konfigurasi sistem (/api/admin/settings).
   */
  async updateAdminSettings(
    payload: Partial<SystemSettings>
  ): Promise<{ success: boolean; settings?: SystemSettings; error?: string }> {
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorMsg = json.message || json.error || `HTTP ${res.status}: Gagal menyimpan`;
        throw new Error(errorMsg);
      }

      const updatedSettings = (json.settings || json) as SystemSettings;
      return {
        success: true,
        settings: updatedSettings,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : "Gagal menyimpan konfigurasi";
      return {
        success: false,
        error,
      };
    }
  },

  /**
   * Mengambil log audit riwayat perubahan pengaturan sistem (/api/admin/settings/audit).
   */
  async getAdminSettingsAudit(): Promise<{ items: SystemSettingsAuditItem[]; error?: string }> {
    try {
      const res = await fetch("/api/admin/settings/audit", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Gagal memuat audit settings`);
      }

      const json = (await res.json()) as AdminSettingsAuditResponse | SystemSettingsAuditItem[];
      const items = Array.isArray(json) ? json : json.data || [];
      return { items };
    } catch (err) {
      return {
        items: [],
        error: err instanceof Error ? err.message : "Gagal memuat log audit",
      };
    }
  },
};
