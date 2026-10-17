import type {
  BookingEntity,
  CreateBookingPayload,
  PatientBookingView,
  PsikologBookingView,
  RescheduleBookingPayload,
  BookingListQuery,
} from '@/types/booking';

export class BookingApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = 'BookingApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const errorMsg = json?.message || json?.error || `HTTP ${res.status}`;
    throw new BookingApiError(res.status, errorMsg, json?.error, json?.details);
  }
  return json;
}

export const bookingClient = {
  /**
   * Membuat booking sesi baru (pasien)
   */
  async createBooking(
    payload: CreateBookingPayload
  ): Promise<{ success: boolean; data: BookingEntity }> {
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    return handleResponse<{ success: boolean; data: BookingEntity }>(res);
  },

  /**
   * Mengambil daftar booking (role-aware: upcoming / history)
   */
  async getBookings(
    query?: BookingListQuery
  ): Promise<{
    success: boolean;
    data: (PatientBookingView | PsikologBookingView)[];
    pagination: { page: number; limit: number; total: number };
  }> {
    const searchParams = new URLSearchParams();
    if (query?.scope) searchParams.set('scope', query.scope);
    if (query?.page) searchParams.set('page', String(query.page));
    if (query?.limit) searchParams.set('limit', String(query.limit));

    const qs = searchParams.toString();
    const url = `/api/bookings${qs ? `?${qs}` : ''}`;

    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<{
      success: boolean;
      data: (PatientBookingView | PsikologBookingView)[];
      pagination: { page: number; limit: number; total: number };
    }>(res);
  },

  /**
   * Mengambil detail satu booking
   */
  async getBookingDetail(
    id: string
  ): Promise<{ success: boolean; data: PatientBookingView | PsikologBookingView }> {
    const res = await fetch(`/api/bookings/${id}`, {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<{ success: boolean; data: PatientBookingView | PsikologBookingView }>(res);
  },

  /**
   * Membatalkan booking (oleh pasien atau psikolog)
   */
  async cancelBooking(
    id: string
  ): Promise<{ success: boolean; data: BookingEntity | PsikologBookingView }> {
    const res = await fetch(`/api/bookings/${id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return handleResponse<{ success: boolean; data: BookingEntity | PsikologBookingView }>(res);
  },

  /**
   * Memilih opsi refund 100% setelah pembatalan oleh psikolog (oleh pasien)
   */
  async chooseRefund(
    id: string
  ): Promise<{ success: boolean; data: BookingEntity }> {
    const res = await fetch(`/api/bookings/${id}/choose-refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return handleResponse<{ success: boolean; data: BookingEntity }>(res);
  },

  /**
   * Memindahkan jadwal booking mandiri (oleh pasien)
   */
  async rescheduleBooking(
    id: string,
    payload: RescheduleBookingPayload
  ): Promise<{ success: boolean; data: BookingEntity }> {
    const res = await fetch(`/api/bookings/${id}/reschedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    return handleResponse<{ success: boolean; data: BookingEntity }>(res);
  },
};
