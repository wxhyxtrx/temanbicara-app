import type { PublicSettings, SystemSettings } from '@/types/system-settings';

// Konstanta di kode (BUKAN settings DB, deploy-only)
export const COIN_TO_RUPIAH = 10_000;
export const SESSION_MINUTES = 45;
export const EXTENSION_MINUTES = 10;
export const OVERTIME_MINUTES = 3;
export const CLOSING_MINUTES = 2;
export const SLOT_MINUTES = 60;
export const ROOM_HARD_CAP_MINUTES = 58;
export const RELAWAN_ROOM_HOURS = 24;
export const TIMEZONE = 'Asia/Jakarta';
export const VERIFICATION_DOC_MIME = [
  'application/pdf',
  'image/jpeg',
  'image/png',
] as const;
export const CHAT_MEDIA_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
] as const;

// Default settings untuk display fallback & seed DB
export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  maintenance: {
    scheduled_start: null,
    estimated_end: null,
    message: '',
  },
  topup: {
    min_coins: 10,
    max_coins: 500,
  },
  revenue_share: {
    mitra_bps: 8000,
  },
  tip: {
    min_coins: 1,
    max_coins: 50,
    daily_cap_coins_per_patient: 50,
  },
  holding: {
    hours: 48,
  },
  payout: {
    min_rupiah: 1_000_000,
    max_rupiah: 10_000_000,
    fee_rupiah: 6_500,
  },
  refund_policy: [
    { min_minutes_before: 60, refund_pct: 100 },
    { min_minutes_before: 30, refund_pct: 65 },
    { min_minutes_before: 0, refund_pct: 0 },
  ],
  psikolog_late: {
    minutes: 10,
  },
  patient_noshow: {
    minutes: 30,
  },
  extension_price: {
    min_coins: 1,
    max_coins: 10,
  },
  relawan: {
    daily_ticket_quota: 3,
    claim_response_minutes: 10,
    unclaimed_archive_hours: 24,
    max_carry_penalty: 1,
  },
  upload: {
    verification_max_mb: 5,
    chat_media_max_mb: 10,
    voice_note_max_seconds: 180,
  },
  media_retention: {
    days: 30,
  },
};

export const DEFAULT_PUBLIC_SETTINGS: PublicSettings = {
  maintenance: {
    scheduled_start: null,
    estimated_end: null,
    message: '',
    phase: 'none',
  },
  topup: DEFAULT_SYSTEM_SETTINGS.topup,
  tip: DEFAULT_SYSTEM_SETTINGS.tip,
  payout: DEFAULT_SYSTEM_SETTINGS.payout,
  extension_price: DEFAULT_SYSTEM_SETTINGS.extension_price,
  relawan: DEFAULT_SYSTEM_SETTINGS.relawan,
  upload: DEFAULT_SYSTEM_SETTINGS.upload,
  refund_policy: DEFAULT_SYSTEM_SETTINGS.refund_policy,
  revenue_share: DEFAULT_SYSTEM_SETTINGS.revenue_share,
};
