export type BookingStatus =
  | 'booked'
  | 'in_progress'
  | 'completed'
  | 'cancelled_by_patient'
  | 'cancelled_by_psikolog'
  | 'awaiting_patient_choice'
  | 'auto_cancelled_late'
  | 'no_show';

export type ExtensionStatus = 'requested' | 'approved' | 'declined';

export interface RefundPolicyTier {
  min_minutes_before: number;
  refund_pct: number;
}

export interface BookingEntity {
  id: string;
  patient_id: string;
  psikolog_id: string;
  start_at: string;
  status: BookingStatus;
  keluhan: string;
  price_coins: number;
  mitra_share_bps: number;
  extension_price_coins: number | null;
  refund_policy: RefundPolicyTier[];
  patient_display_name: string;
  reschedule_count: number;
  psikolog_first_msg_at: string | null;
  patient_first_msg_at: string | null;
  psikolog_late: boolean;
  extension_status: ExtensionStatus | null;
  extension_coins: number | null;
  ended_at: string | null;
  cancelled_at: string | null;
  choice_deadline_at: string | null;
  refund_coins: number;
  created_at: string;
  updated_at: string;
}

/**
 * Bentuk data booking yang dikirim ke psikolog.
 * Review Focus #5 & Task B4: Bebas dari data pribadi pasien (nama_lengkap, email, no_wa, kontak darurat).
 */
export interface PsikologBookingView {
  id: string;
  start_at: string;
  status: BookingStatus;
  keluhan: string;
  patient_display_name: string;
  price_coins: number;
  extension_status: ExtensionStatus | null;
  extension_price_coins: number | null;
  extension_coins: number | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PsychologistSummary {
  id: string;
  nama_lengkap_gelar: string;
  nomor_sipp_str?: string;
  spesialisasi: string[];
  tahun_pengalaman: number;
  avatar_url: string | null;
  tarif_sesi: number;
  attendance_pct?: number | null;
}

export interface PatientBookingView extends BookingEntity {
  psikolog?: PsychologistSummary;
}

export interface CreateBookingPayload {
  psikolog_id: string;
  start_at: string;
  keluhan: string;
}

export interface RescheduleBookingPayload {
  new_start_at: string;
}

export interface BookingListQuery {
  scope?: 'upcoming' | 'history';
  page?: number;
  limit?: number;
}

export type SessionMessageKind = 'text' | 'image' | 'voice';

export interface SessionMessageEntity {
  id: string;
  booking_id: string;
  sender_id: string;
  kind: SessionMessageKind;
  body: string | null;
  media_path: string | null;
  duration_seconds: number | null;
  created_at: string;
}

export interface SessionMessageView {
  id: string;
  booking_id: string;
  sender_id: string;
  sender_role: 'pasien' | 'psikolog';
  sender_name: string;
  is_mine: boolean;
  kind: SessionMessageKind;
  body: string | null;
  media_path: string | null;
  duration_seconds: number | null;
  created_at: string;
}

export interface SendSessionMessagePayload {
  kind: SessionMessageKind;
  body?: string | null;
  media_path?: string | null;
  duration_seconds?: number | null;
}

export interface SessionMediaUploadPayload {
  file_name: string;
  file_type: string;
  kind: 'image' | 'voice';
}

export interface SessionMediaUploadResponse {
  upload_url: string;
  token?: string;
  file_path: string;
  bucket: string;
}

export interface SessionMediaUrlResponse {
  signed_url: string;
  expires_in: number;
}

