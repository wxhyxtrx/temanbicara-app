export type PeerTicketStatus = 'open' | 'claimed' | 'active' | 'closed' | 'archived';

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
  archived_at: string | null;
  abandoned_by: string[];
  created_at: string;
  updated_at: string;
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
