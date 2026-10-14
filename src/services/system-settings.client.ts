import { DEFAULT_PUBLIC_SETTINGS, DEFAULT_SYSTEM_SETTINGS } from '@/constant/system-settings';
import type {
  AdminSettingsAuditResponse,
  AdminSettingsResponse,
  PublicSettings,
  SystemSettings,
  SystemSettingsAuditItem,
} from '@/types/system-settings';

export interface PublicSettingsResult {
  settings: PublicSettings;
  isFallback: boolean;
  canTransact: boolean;
  error?: string;
}

export interface AdminSettingsResult {
  settings: SystemSettings;
  meta?: AdminSettingsResponse['meta'];
  isFallback: boolean;
  error?: string;
}

async function readError(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  if (body && typeof body === 'object' && 'message' in body && typeof body.message === 'string') {
    return body.message;
  }
  return `HTTP ${response.status}`;
}

export const systemSettingsClient = {
  async getPublicSettings(): Promise<PublicSettingsResult> {
    try {
      const response = await fetch('/api/settings/public');
      if (!response.ok) throw new Error(await readError(response));
      const result = (await response.json()) as { success: boolean; data: PublicSettings };
      if (!result.success || !result.data) throw new Error('Respons public settings tidak valid');
      return { settings: result.data, isFallback: false, canTransact: true };
    } catch (error) {
      return {
        settings: DEFAULT_PUBLIC_SETTINGS,
        isFallback: true,
        canTransact: false,
        error: error instanceof Error ? error.message : 'Gagal memuat pengaturan sistem',
      };
    }
  },

  async getAdminSettings(): Promise<AdminSettingsResult> {
    try {
      const response = await fetch('/api/admin/settings', { credentials: 'include' });
      if (!response.ok) throw new Error(await readError(response));
      const result = (await response.json()) as { success: boolean; data: AdminSettingsResponse };
      if (!result.success || !result.data?.settings) throw new Error('Respons admin settings tidak valid');
      return { settings: result.data.settings, meta: result.data.meta, isFallback: false };
    } catch (error) {
      return {
        settings: DEFAULT_SYSTEM_SETTINGS,
        isFallback: true,
        error: error instanceof Error ? error.message : 'Gagal memuat pengaturan sistem',
      };
    }
  },

  async updateAdminSettings(payload: Partial<SystemSettings>): Promise<{
    success: boolean;
    settings?: SystemSettings;
    error?: string;
  }> {
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        success: boolean;
        message?: string;
        error?: string;
        data?: AdminSettingsResponse;
      };
      if (!response.ok || !result.success || !result.data?.settings) {
        throw new Error(result.message || result.error || `HTTP ${response.status}: Gagal menyimpan`);
      }
      return { success: true, settings: result.data.settings };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Gagal menyimpan konfigurasi' };
    }
  },

  async getAdminSettingsAudit(): Promise<{ items: SystemSettingsAuditItem[]; error?: string }> {
    try {
      const response = await fetch('/api/admin/settings/audit?page=1&limit=20', { credentials: 'include' });
      if (!response.ok) throw new Error(await readError(response));
      const result = (await response.json()) as AdminSettingsAuditResponse & { success: boolean };
      if (!result.success || !Array.isArray(result.data)) throw new Error('Respons audit settings tidak valid');
      return { items: result.data };
    } catch (error) {
      return { items: [], error: error instanceof Error ? error.message : 'Gagal memuat log audit' };
    }
  },
};
