export type PeerMessageKind = 'text' | 'image' | 'voice';

export interface PeerMessageEntity {
  id: string;
  ticket_id: string;
  sender_id: string;
  kind: PeerMessageKind;
  body: string | null;
  media_path: string | null;
  duration_seconds: number | null;
  created_at: string;
}

export interface PeerMessageView {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_role: 'pasien' | 'relawan';
  sender_name: string;
  is_mine: boolean;
  kind: PeerMessageKind;
  body: string | null;
  media_path: string | null;
  duration_seconds: number | null;
  created_at: string;
}

export interface SendPeerMessagePayload {
  kind: PeerMessageKind;
  body?: string | null;
  media_path?: string | null;
  duration_seconds?: number | null;
}

export interface PeerMediaUploadPayload {
  file_name: string;
  file_type: string;
  kind: 'image' | 'voice';
  file_size?: number | null;
  duration_seconds?: number | null;
}

export interface PeerMediaUploadResponse {
  upload_url: string;
  token?: string;
  file_path: string;
  bucket: string;
}

export interface PeerMediaUrlResponse {
  signed_url: string;
  expires_in: number;
}
