import type {
  PeerTicketEntity,
  RelawanPeerTicketDTO,
  RelawanQuotaInfo,
  CreatePeerTicketPayload,
  PeerTicketDetailView,
  PeerReviewEntity,
  PeerRatingSummaryDTO,
} from '@/types/peer-tickets';

export class PeerTicketApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = 'PeerTicketApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const errorMsg = json?.message || json?.error || `HTTP ${res.status}`;
    throw new PeerTicketApiError(res.status, errorMsg, json?.error, json?.details);
  }
  return json;
}

export const peerTicketClient = {
  /**
   * Mengambil detail satu tiket curhat sebaya berdasarkan ID
   */
  async getTicket(
    ticketId: string
  ): Promise<{ success: boolean; data: PeerTicketDetailView }> {
    const res = await fetch(`/api/peer-tickets/${encodeURIComponent(ticketId)}`, {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<{ success: boolean; data: PeerTicketDetailView }>(res);
  },

  /**
   * Membuat tiket curhat baru (pasien)
   */
  async createTicket(
    payload: CreatePeerTicketPayload
  ): Promise<{ success: boolean; data: PeerTicketEntity }> {
    const res = await fetch('/api/peer-tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    return handleResponse<{ success: boolean; data: PeerTicketEntity }>(res);
  },

  /**
   * Mengambil tiket aktif milik pasien saat ini
   */
  async getMyActiveTicket(): Promise<{ success: boolean; data: PeerTicketEntity | null }> {
    const res = await fetch('/api/peer-tickets/my-active', {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<{ success: boolean; data: PeerTicketEntity | null }>(res);
  },

  /**
   * Mengambil antrean tiket curhat yang tersedia di pool (relawan)
   */
  async getPoolTickets(): Promise<{ success: boolean; data: RelawanPeerTicketDTO[] }> {
    const res = await fetch('/api/peer-tickets/pool', {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<{ success: boolean; data: RelawanPeerTicketDTO[] }>(res);
  },

  /**
   * Mengklaim tiket curhat dari pool (relawan)
   */
  async claimTicket(
    ticketId: string
  ): Promise<{ success: boolean; data: RelawanPeerTicketDTO }> {
    const res = await fetch(`/api/peer-tickets/${encodeURIComponent(ticketId)}/claim`, {
      method: 'POST',
      credentials: 'include',
    });
    return handleResponse<{ success: boolean; data: RelawanPeerTicketDTO }>(res);
  },

  /**
   * Mengambil tiket aktif yang sedang diklaim/ditangani oleh relawan saat ini
   */
  async getMyClaimedTicket(): Promise<{ success: boolean; data: RelawanPeerTicketDTO | null }> {
    const res = await fetch('/api/peer-tickets/my-claimed', {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<{ success: boolean; data: RelawanPeerTicketDTO | null }>(res);
  },

  /**
   * Mengambil informasi kuota harian relawan
   */
  async getQuotaInfo(): Promise<{ success: boolean; data: RelawanQuotaInfo }> {
    const res = await fetch('/api/peer-tickets/quota', {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<{ success: boolean; data: RelawanQuotaInfo }>(res);
  },

  /**
   * Menutup sesi tiket curhat aktif (pasien / relawan)
   */
  async closeTicket(
    ticketId: string
  ): Promise<{ success: boolean; data: PeerTicketEntity }> {
    const res = await fetch(`/api/peer-tickets/${encodeURIComponent(ticketId)}/close`, {
      method: 'POST',
      credentials: 'include',
    });
    return handleResponse<{ success: boolean; data: PeerTicketEntity }>(res);
  },

  /**
   * Mengirimkan rating & ulasan untuk sesi tiket yang telah ditutup
   */
  async createReview(
    ticketId: string,
    payload: { rating: number; review?: string | null }
  ): Promise<{ success: boolean; data: PeerReviewEntity }> {
    const res = await fetch(`/api/peer-tickets/${encodeURIComponent(ticketId)}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    return handleResponse<{ success: boolean; data: PeerReviewEntity }>(res);
  },

  /**
   * Mengambil ulasan yang sudah diberikan pada tiket curhat
   */
  async getReview(
    ticketId: string
  ): Promise<{ success: boolean; data: PeerReviewEntity | null }> {
    const res = await fetch(`/api/peer-tickets/${encodeURIComponent(ticketId)}/review`, {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<{ success: boolean; data: PeerReviewEntity | null }>(res);
  },

  /**
   * Memberikan tip koin kepada relawan pendamping
   */
  async sendTip(
    ticketId: string,
    coins: number
  ): Promise<{ success: boolean; data: { tip_id: string; coins: number } }> {
    const res = await fetch(`/api/peer-tickets/${encodeURIComponent(ticketId)}/tip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ coins }),
    });
    return handleResponse<{ success: boolean; data: { tip_id: string; coins: number } }>(res);
  },

  /**
   * Mengambil agregat ringkasan rating & jumlah ulasan relawan
   */
  async getRatingSummary(): Promise<{ success: boolean; data: PeerRatingSummaryDTO }> {
    const res = await fetch('/api/listener/rating-summary', {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<{ success: boolean; data: PeerRatingSummaryDTO }>(res);
  },
};
