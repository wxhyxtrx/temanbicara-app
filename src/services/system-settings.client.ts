import { DEFAULT_PUBLIC_SETTINGS, DEFAULT_SYSTEM_SETTINGS } from '@/constant/system-settings';
import type {
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

export interface AdminSettingsAuditResult {
  items: SystemSettingsAuditItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  error?: string;
}

export interface UpdateAdminSettingsResult {
  success: boolean;
  settings?: SystemSettings;
  error?: string;
  details?: Record<string, string>;
}

function readDetails(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const entries = Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string');
  return entries.length ? Object.fromEntries(entries) : undefined;
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

  async updateAdminSettings(payload: Partial<SystemSettings>): Promise<UpdateAdminSettingsResult> {
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as {
        success?: boolean;
        message?: string;
        error?: string;
        details?: unknown;
        data?: AdminSettingsResponse;
      } | null;
      if (!response.ok || !result?.success || !result.data?.settings) {
        return {
          success: false,
          error: result?.message || result?.error || `HTTP ${response.status}: Gagal menyimpan`,
          details: readDetails(result?.details),
        };
      }
      return { success: true, settings: result.data.settings };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Gagal menyimpan konfigurasi' };
    }
  },

  async getAdminSettingsAudit({ page, limit }: { page: number; limit: number }): Promise<AdminSettingsAuditResult> {
    try {
      const query = new URLSearchParams({ page: String(page), limit: String(limit) });
      const response = await fetch(`/api/admin/settings/audit?${query}`, { credentials: 'include' });
      if (!response.ok) throw new Error(await readError(response));
      const result = (await response.json()) as {
        success: boolean;
        data: SystemSettingsAuditItem[];
        meta?: { page: number; limit: number; total: number; totalPages: number };
      };
      if (!result.success || !Array.isArray(result.data) || !result.meta) {
        throw new Error('Respons audit settings tidak valid');
      }
      const { meta } = result;
      return { items: result.data, page: meta.page, limit: meta.limit, total: meta.total, totalPages: meta.totalPages };
    } catch (error) {
      return {
        items: [],
        page,
        limit,
        total: 0,
        totalPages: 0,
        error: error instanceof Error ? error.message : 'Gagal memuat log audit',
      };
    }
  },
};
