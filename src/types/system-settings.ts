export type MaintenanceSetting = {
  scheduled_start: string | null;
  estimated_end: string | null;
  message: string;
};

export type RefundTier = {
  min_minutes_before: number;
  refund_pct: number;
};

export type SystemSettings = {
  maintenance: MaintenanceSetting;
  topup: { min_coins: number; max_coins: number };
  revenue_share: { mitra_bps: number };
  tip: { min_coins: number; max_coins: number; daily_cap_coins_per_patient: number };
  holding: { hours: number };
  payout: { min_rupiah: number; max_rupiah: number; fee_rupiah: number };
  refund_policy: RefundTier[];
  psikolog_late: { minutes: number };
  patient_noshow: { minutes: number };
  extension_price: { min_coins: number; max_coins: number };
  relawan: {
    daily_ticket_quota: number;
    claim_response_minutes: number;
    unclaimed_archive_hours: number;
    max_carry_penalty: number;
  };
  upload: {
    verification_max_mb: number;
    chat_media_max_mb: number;
    voice_note_max_seconds: number;
  };
  media_retention: { days: number };
};

export type MaintenancePhase = 'none' | 'scheduled' | 'draining' | 'active';

export type PublicSettings = Pick<
  SystemSettings,
  'topup' | 'tip' | 'payout' | 'extension_price' | 'relawan' | 'upload' | 'refund_policy'
> & {
  maintenance: MaintenanceSetting & { phase: MaintenancePhase };
  revenue_share: { mitra_bps: number };
};

export type SystemSettingsAuditItem = {
  id: string;
  key: keyof SystemSettings | string;
  old_value: unknown;
  new_value: unknown;
  changed_by: string | null;
  changed_by_name?: string | null;
  changed_at: string;
};

export type AdminSettingsResponse = {
  settings: SystemSettings;
  meta?: Record<string, { updated_at: string; updated_by: string | null }>;
};

export type AdminSettingsAuditResponse = {
  data: SystemSettingsAuditItem[];
  total?: number;
};
