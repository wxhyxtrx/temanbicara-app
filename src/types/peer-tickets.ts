export type PeerTicketStatus = 'open' | 'claimed' | 'active' | 'closed' | 'archived';

export type PeerTicketClosedBy = 'pasien' | 'relawan' | 'system';

export interface PeerTicketEntity {
  id: string;
  patient_id: string;
  patient_alias: string;
  topic: string;
  emotion: string;
  content: string;
  is_anonymous: boolean;
  status: PeerTicketStatus;
  claimed_by: string | null;
  claimed_at: string | null;
  first_response_at: string | null;
  closed_at: string | null;
  closed_by?: PeerTicketClosedBy | null;
  archived_at: string | null;
  abandoned_by: string[];
  created_at: string;
  updated_at: string;
}

export interface PeerReviewEntity {
  ticket_id: string;
  patient_id: string;
  relawan_id: string;
  rating: number;
  review: string | null;
  is_hidden?: boolean;
  created_at: string;
  updated_at: string;
}

export interface PeerRatingSummaryDTO {
  rating_avg: number | null;
  rating_count: number;
}

export interface RelawanDailyQuotaEntity {
  relawan_id: string;
  quota_date: string; // YYYY-MM-DD (WIB)
  tickets_claimed: number;
  penalty_points: number;
}

export type RelawanPeerTicketDTO = Omit<PeerTicketEntity, 'patient_id'>;

export interface RelawanQuotaInfo {
  quota_date: string;
  daily_limit: number;
  tickets_claimed: number;
  penalty_points: number;
  carry_penalty: number;
  consumed: number;
  remaining: number;
}

export interface CreatePeerTicketPayload {
  patient_alias: string;
  topic: string;
  emotion: string;
  content: string;
  is_anonymous?: boolean;
}

export interface PeerTicketDetailView {
  id: string;
  patient_id?: string; // Hanya untuk pasien dan admin
  patient_alias: string;
  topic: string;
  emotion: string;
  content: string;
  is_anonymous: boolean;
  status: PeerTicketStatus;
  claimed_by: string | null;
  claimed_at: string | null;
  first_response_at: string | null;
  closed_at: string | null;
  closed_by?: PeerTicketClosedBy | null;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
  relawan_alias: string | null;
}

export type RelawanPeerTicketDetailView = Omit<PeerTicketDetailView, 'patient_id'>;
