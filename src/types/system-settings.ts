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
  booking: {
    min_hours_before: number;
    max_days_ahead: number;
    max_active_per_patient: number;
    max_per_psikolog_per_day: number;
    reschedule_min_hours: number;
    psikolog_cancel_free_hours: number;
    choice_deadline_hours: number;
  };
  strike: {
    per_late_cancel: number;
    per_noshow: number;
    threshold: number;
    window_days: number;
    suspend_days: number;
  };
  rating: {
    window_days: number;
    min_count_to_show: number;
  };
};

export type MaintenancePhase = 'none' | 'scheduled' | 'draining' | 'active';

export type PublicSettings = Pick<
  SystemSettings,
  | 'topup'
  | 'tip'
  | 'payout'
  | 'extension_price'
  | 'relawan'
  | 'upload'
  | 'refund_policy'
  | 'booking'
  | 'rating'
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
  meta: Record<string, { updated_at: string; updated_by: string | null }>;
};

export type AdminSettingsAuditResponse = {
  data: SystemSettingsAuditItem[];
  total: number;
  page: number;
  limit: number;
};

export interface SystemSettingRow {
  key: string;
  value: unknown;
  updated_by: string | null;
  updated_at: string;
}

export interface SystemSettingAuditRow {
  id: string;
  key: string;
  old_value: unknown;
  new_value: unknown;
  changed_by: string | null;
  changed_at: string;
}
