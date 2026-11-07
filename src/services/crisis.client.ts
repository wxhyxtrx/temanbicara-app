import type {
  AdminCrisisAlertsResponse,
  CrisisAlertItem,
  UpdateCrisisAlertDTO,
} from '@/types/crisis';
import type { PatientEmergencyContactView } from '@/types/booking';

export class CrisisApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = 'CrisisApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const errorMsg = json?.message || json?.error || `HTTP ${res.status}`;
    throw new CrisisApiError(res.status, errorMsg, json?.error, json?.details);
  }
  return json as T;
}

export const crisisClient = {
  /**
   * Mengambil daftar feed alarm krisis untuk admin
   */
  async adminGetAlerts(params?: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<AdminCrisisAlertsResponse> {
    const query = new URLSearchParams();
    if (params?.status && params.status !== 'all') {
      query.set('status', params.status);
    }
    if (params?.page) {
      query.set('page', String(params.page));
    }
    if (params?.limit) {
      query.set('limit', String(params.limit));
    }

    const qs = query.toString();
    const url = `/api/admin/crisis-alerts${qs ? `?${qs}` : ''}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return handleResponse<AdminCrisisAlertsResponse>(res);
  },

  /**
   * Memperbarui status penanganan alarm krisis oleh admin (handled / false_alarm)
   */
  async adminUpdateAlert(
    id: string,
    payload: UpdateCrisisAlertDTO
  ): Promise<{ success: boolean; data?: CrisisAlertItem; error?: string }> {
    const res = await fetch(`/api/admin/crisis-alerts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    return handleResponse<{ success: boolean; data?: CrisisAlertItem; error?: string }>(res);
  },

  /**
   * Mengambil kontak darurat pasien oleh admin dengan pencatatan audit log
   */
  async adminGetEmergencyContact(
    patientId: string,
    alertId?: string
  ): Promise<{ success: boolean; data?: PatientEmergencyContactView; error?: string }> {
    const qs = alertId ? `?alert_id=${encodeURIComponent(alertId)}` : '';
    const res = await fetch(`/api/admin/users/${patientId}/emergency-contact${qs}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return handleResponse<{ success: boolean; data?: PatientEmergencyContactView; error?: string }>(res);
  },

  /**
   * Pelaporan krisis manual oleh psikolog sesi booking
   */
  async reportBookingCrisis(
    bookingId: string,
    note?: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await fetch(`/api/bookings/${bookingId}/crisis-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ note }),
    });
    return handleResponse<{ success: boolean; message?: string; error?: string }>(res);
  },

  /**
   * Pelaporan krisis manual oleh relawan tiket curhat
   */
  async reportPeerCrisis(
    ticketId: string,
    note?: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await fetch(`/api/peer-tickets/${ticketId}/crisis-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ note }),
    });
    return handleResponse<{ success: boolean; message?: string; error?: string }>(res);
  },
};
