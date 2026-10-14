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
  details?: Partial<Record<keyof SystemSettings, string>>;
}

function detailMessage(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const messages = value.map(detailMessage).filter((item): item is string => !!item);
    return messages.length ? messages.join('; ') : undefined;
  }
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.message === 'string') return record.message;
  const messages = Object.values(record).map(detailMessage).filter((item): item is string => !!item);
  return messages.length ? messages.join('; ') : undefined;
}

// Map details to known settings cards; retain useful messages from structured server responses.
function readDetails(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const entries = Object.entries(value)
    .filter(([key]) => Object.hasOwn(DEFAULT_SYSTEM_SETTINGS, key))
    .map(([key, detail]) => [key, detailMessage(detail)] as const)
    .filter((entry): entry is readonly [string, string] => !!entry[1]);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

// Number.isInteger rejects NaN/Infinity, so it also covers finiteness.
function readInt(source: Record<string, unknown>, key: string, min: number): number {
  const value = source[key];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
    throw new Error('Respons audit settings tidak valid');
  }
  return value;
}

const toPositiveInt = (value: number, fallback: number) =>
  Number.isFinite(value) && value >= 1 ? Math.floor(value) : fallback;

async function readError(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    if (typeof record.message === 'string' && record.message.trim()) return record.message;
    const nested = detailMessage(record.details);
    if (nested) return nested;
    if (typeof record.error === 'string' && record.error.trim()) return record.error;
  }
  return `HTTP ${response.status}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isSystemSettings(value: unknown): value is SystemSettings {
  const expectedKeys = Object.keys(DEFAULT_SYSTEM_SETTINGS);
  if (!isRecord(value) || expectedKeys.some((key) => !Object.hasOwn(value, key))) return false;
  const validDate = (date: unknown) => date === null || (typeof date === 'string' && date.length > 0 && Number.isFinite(Date.parse(date)));
  if (!isRecord(value.maintenance) || !validDate(value.maintenance.scheduled_start) || !validDate(value.maintenance.estimated_end) || typeof value.maintenance.message !== 'string') return false;
  if (!isRecord(value.revenue_share) || typeof value.revenue_share.mitra_bps !== 'number' || !Number.isFinite(value.revenue_share.mitra_bps)) return false;
  if (!Array.isArray(value.refund_policy) || !value.refund_policy.every((tier) => isRecord(tier) && typeof tier.min_minutes_before === 'number' && Number.isFinite(tier.min_minutes_before) && typeof tier.refund_pct === 'number' && Number.isFinite(tier.refund_pct))) return false;
  return expectedKeys.filter((key) => key !== 'maintenance' && key !== 'refund_policy').every((key) => {
    const group = value[key];
    const expectedGroup = DEFAULT_SYSTEM_SETTINGS[key as keyof SystemSettings];
    return isRecord(group) && isRecord(expectedGroup) && Object.keys(expectedGroup).every((field) => typeof group[field] === 'number' && Number.isFinite(group[field]));
  });
}

function readSettingsEnvelope(value: unknown): AdminSettingsResponse | undefined {
  if (!isRecord(value) || value.success !== true || !isRecord(value.data) || !isSystemSettings(value.data.settings) || !isRecord(value.data.meta)) return undefined;
  return { settings: value.data.settings, meta: value.data.meta as AdminSettingsResponse['meta'] };
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
      const result = readSettingsEnvelope(await response.json());
      if (!result) throw new Error('Respons admin settings tidak valid');
      return { settings: result.settings, meta: result.meta, isFallback: false };
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
      const body: unknown = await response.json().catch(() => null);
      const result = isRecord(body) ? body : undefined;
      const envelope = result && readSettingsEnvelope(result);
      if (!response.ok || !envelope) {
        return {
          success: false,
          error: result && typeof result.message === 'string' ? result.message : result && typeof result.error === 'string' ? result.error : result ? detailMessage(result.details) ?? `HTTP ${response.status}: Gagal menyimpan` : `HTTP ${response.status}: Gagal menyimpan`,
          details: readDetails(result?.details),
        };
      }
      return { success: true, settings: envelope.settings };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Gagal menyimpan konfigurasi' };
    }
  },

  async getAdminSettingsAudit(params: { page: number; limit: number }): Promise<AdminSettingsAuditResult> {
    const page = toPositiveInt(params.page, 1);
    const limit = toPositiveInt(params.limit, 20);
    try {
      const query = new URLSearchParams({ page: String(page), limit: String(limit) });
      const response = await fetch(`/api/admin/settings/audit?${query}`, { credentials: 'include' });
      if (!response.ok) throw new Error(await readError(response));
      const result = (await response.json().catch(() => null)) as {
        success?: unknown;
        data?: unknown;
        meta?: unknown;
      } | null;
      const meta = result?.meta;
      if (result?.success !== true || !Array.isArray(result.data) || !meta || typeof meta !== 'object' || Array.isArray(meta)) {
        throw new Error('Respons audit settings tidak valid');
      }
      const fields = meta as Record<string, unknown>;
      return {
        items: result.data as SystemSettingsAuditItem[],
        page: readInt(fields, 'page', 1),
        limit: readInt(fields, 'limit', 1),
        total: readInt(fields, 'total', 0),
        totalPages: readInt(fields, 'totalPages', 0),
      };
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
