import type {
  PeerMessageView,
  SendPeerMessagePayload,
  PeerMediaUploadPayload,
  PeerMediaUploadResponse,
  PeerMediaUrlResponse,
} from '@/types/peer-messages';

export class PeerMessageApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = 'PeerMessageApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const errorMsg = json?.message || json?.error || `HTTP ${res.status}`;
    throw new PeerMessageApiError(res.status, errorMsg, json?.error, json?.details);
  }
  return json;
}

export const peerMessagesClient = {
  /**
   * Mengambil riwayat seluruh pesan obrolan pada sesi tiket Ruang Dengar
   */
  async getMessages(
    ticketId: string
  ): Promise<{ success: boolean; data: PeerMessageView[] }> {
    const res = await fetch(`/api/peer-tickets/${encodeURIComponent(ticketId)}/messages`, {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<{ success: boolean; data: PeerMessageView[] }>(res);
  },

  /**
   * Mengirim pesan obrolan baru ke Ruang Dengar
   */
  async sendMessage(
    ticketId: string,
    payload: SendPeerMessagePayload
  ): Promise<{ success: boolean; data: PeerMessageView }> {
    const res = await fetch(`/api/peer-tickets/${encodeURIComponent(ticketId)}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    return handleResponse<{ success: boolean; data: PeerMessageView }>(res);
  },

  /**
   * Mendapatkan presigned upload URL untuk mengunggah media ke bucket session-media
   */
  async getUploadUrl(
    ticketId: string,
    payload: PeerMediaUploadPayload
  ): Promise<{ success: boolean; data: PeerMediaUploadResponse }> {
    const res = await fetch(`/api/peer-tickets/${encodeURIComponent(ticketId)}/media-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    return handleResponse<{ success: boolean; data: PeerMediaUploadResponse }>(res);
  },

  /**
   * Mendapatkan signed view URL untuk melihat/mengunduh berkas media
   */
  async getViewUrl(
    ticketId: string,
    mediaPath: string
  ): Promise<{ success: boolean; data: PeerMediaUrlResponse }> {
    const res = await fetch(
      `/api/peer-tickets/${encodeURIComponent(ticketId)}/media-url?path=${encodeURIComponent(mediaPath)}`,
      {
        method: 'GET',
        credentials: 'include',
      }
    );
    return handleResponse<{ success: boolean; data: PeerMediaUrlResponse }>(res);
  },

  /**
   * Mengunggah file biner langsung ke signed upload URL (storage Supabase)
   */
  async uploadMediaBinary(
    uploadUrl: string,
    file: Blob | File
  ): Promise<void> {
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: file,
    });
    if (!res.ok) {
      throw new Error(`Gagal mengunggah berkas ke penyimpanan (${res.status})`);
    }
  },
};
