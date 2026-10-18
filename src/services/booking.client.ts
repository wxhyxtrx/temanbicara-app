import type {
  BookingEntity,
  CreateBookingPayload,
  PatientBookingView,
  PsikologBookingView,
  RescheduleBookingPayload,
  BookingListQuery,
  ExtensionRespondPayload,
  ExtensionRespondResponse,
  ReviewUpsertPayload,
  SessionTipPayload,
  ReviewHidePayload,
  SessionReviewEntity,
  AdminReviewItem,
  AdminReviewStats,
  PublicReviewItem,
  SessionMessageView,
  SendSessionMessagePayload,
  SessionMediaUploadPayload,
  SessionMediaUploadResponse,
  SessionMediaUrlResponse,
  ClientNoteEntity,
  PatientNotesResponse,
  UpdateClientNotePayload,
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

  /**
   * Mengajukan perpanjangan sesi 10 menit (oleh pasien)
   */
  async requestExtension(
    id: string
  ): Promise<{ success: boolean; data: BookingEntity; message: string }> {
    const res = await fetch(`/api/bookings/${id}/extension`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return handleResponse<{ success: boolean; data: BookingEntity; message: string }>(res);
  },

  /**
   * Merespons pengajuan ekstensi sesi (oleh psikolog: approve atau decline)
   */
  async respondExtension(
    id: string,
    payload: ExtensionRespondPayload
  ): Promise<{ success: boolean; data: ExtensionRespondResponse; message: string }> {
    const res = await fetch(`/api/bookings/${id}/extension/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    return handleResponse<{ success: boolean; data: ExtensionRespondResponse; message: string }>(res);
  },

  /**
   * Mengakhiri sesi konseling (oleh psikolog)
   */
  async endSession(
    id: string
  ): Promise<{ success: boolean; data: PsikologBookingView; message: string }> {
    const res = await fetch(`/api/bookings/${id}/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return handleResponse<{ success: boolean; data: PsikologBookingView; message: string }>(res);
  },

  /**
   * Mengisi atau memperbarui rating & ulasan sesi (pasien)
   */
  async submitReview(
    bookingId: string,
    payload: ReviewUpsertPayload
  ): Promise<{ success: boolean; data: SessionReviewEntity }> {
    const res = await fetch(`/api/bookings/${bookingId}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    return handleResponse<{ success: boolean; data: SessionReviewEntity }>(res);
  },

  /**
   * Mengambil ulasan pada booking tertentu
   */
  async getReview(
    bookingId: string
  ): Promise<{ success: boolean; data: SessionReviewEntity | null }> {
    const res = await fetch(`/api/bookings/${bookingId}/review`, {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<{ success: boolean; data: SessionReviewEntity | null }>(res);
  },

  /**
   * Memberikan tip koin untuk sesi yang selesai (pasien)
   */
  async sendTip(
    bookingId: string,
    payload: SessionTipPayload
  ): Promise<{ success: boolean; data: { tip_id: string; booking_id: string; coins: number }; message: string }> {
    const res = await fetch(`/api/bookings/${bookingId}/tip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    return handleResponse<{ success: boolean; data: { tip_id: string; booking_id: string; coins: number }; message: string }>(res);
  },

  /**
   * Melaporkan ulasan sesi oleh psikolog
   */
  async reportReview(
    bookingId: string
  ): Promise<{ success: boolean; data: SessionReviewEntity; message: string }> {
    const res = await fetch(`/api/bookings/${bookingId}/review/report`, {
      method: 'POST',
      credentials: 'include',
    });
    return handleResponse<{ success: boolean; data: SessionReviewEntity; message: string }>(res);
  },

  /**
   * Mengambil daftar ulasan publik seorang psikolog
   */
  async getPublicReviews(
    psychologistId: string,
    query?: { page?: number; limit?: number }
  ): Promise<{ success: boolean; data: PublicReviewItem[]; meta: { page: number; limit: number; total: number } }> {
    const searchParams = new URLSearchParams();
    if (query?.page) searchParams.set('page', String(query.page));
    if (query?.limit) searchParams.set('limit', String(query.limit));
    const qs = searchParams.toString();

    const res = await fetch(`/api/psychologists/${psychologistId}/reviews${qs ? `?${qs}` : ''}`, {
      method: 'GET',
    });
    return handleResponse<{ success: boolean; data: PublicReviewItem[]; meta: { page: number; limit: number; total: number } }>(res);
  },

  /**
   * Moderasi admin: mengambil daftar ulasan dengan filter & pagination
   */
  async adminGetReviews(query?: {
    filter?: 'reported' | 'hidden' | 'semua' | 'all';
    page?: number;
    limit?: number;
  }): Promise<{
    success: boolean;
    data: AdminReviewItem[];
    stats?: AdminReviewStats;
    pagination: { page: number; limit: number; total: number; totalPages: number };
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const searchParams = new URLSearchParams();
    if (query?.filter) searchParams.set('filter', query.filter);
    if (query?.page) searchParams.set('page', String(query.page));
    if (query?.limit) searchParams.set('limit', String(query.limit));
    const qs = searchParams.toString();

    const res = await fetch(`/api/admin/reviews${qs ? `?${qs}` : ''}`, {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<{
      success: boolean;
      data: AdminReviewItem[];
      stats?: AdminReviewStats;
      pagination: { page: number; limit: number; total: number; totalPages: number };
      meta: { page: number; limit: number; total: number; totalPages: number };
    }>(res);
  },

  /**
   * Moderasi admin: sembunyikan atau tampilkan ulasan
   */
  async adminSetReviewHidden(
    bookingId: string,
    payload: ReviewHidePayload
  ): Promise<{ success: boolean; data: SessionReviewEntity; message: string }> {
    const res = await fetch(`/api/admin/reviews/${bookingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    return handleResponse<{ success: boolean; data: SessionReviewEntity; message: string }>(res);
  },

  /**
   * Mengambil riwayat pesan dalam sesi konseling
   */
  async getSessionMessages(
    bookingId: string
  ): Promise<{ success: boolean; data: SessionMessageView[] }> {
    const res = await fetch(`/api/bookings/${bookingId}/messages`, {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<{ success: boolean; data: SessionMessageView[] }>(res);
  },

  /**
   * Mengirim pesan teks, gambar, atau suara ke sesi konseling
   */
  async sendSessionMessage(
    bookingId: string,
    payload: SendSessionMessagePayload
  ): Promise<{ success: boolean; data: SessionMessageView }> {
    const res = await fetch(`/api/bookings/${bookingId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    return handleResponse<{ success: boolean; data: SessionMessageView }>(res);
  },

  /**
   * Mendapatkan signed upload URL untuk unggah berkas gambar atau pesan suara
   */
  async createSessionMediaUploadUrl(
    bookingId: string,
    payload: SessionMediaUploadPayload
  ): Promise<{ success: boolean; data: SessionMediaUploadResponse }> {
    const res = await fetch(`/api/bookings/${bookingId}/media-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    return handleResponse<{ success: boolean; data: SessionMediaUploadResponse }>(res);
  },

  /**
   * Mendapatkan signed download URL untuk berkas media di bucket session-media
   */
  async getSessionMediaDownloadUrl(
    bookingId: string,
    mediaPath: string
  ): Promise<{ success: boolean; data: SessionMediaUrlResponse }> {
    const url = `/api/bookings/${bookingId}/media-url?path=${encodeURIComponent(mediaPath)}`;
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<{ success: boolean; data: SessionMediaUrlResponse }>(res);
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

  /**
   * Mengambil catatan klinis sesi konseling (psikolog)
   */
  async getClientNote(
    bookingId: string
  ): Promise<{ success: boolean; data: ClientNoteEntity | null; patient_id?: string }> {
    const res = await fetch(`/api/bookings/${bookingId}/note`, {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<{ success: boolean; data: ClientNoteEntity | null; patient_id?: string }>(res);
  },

  /**
   * Menyimpan / memperbarui catatan klinis sesi konseling (psikolog)
   */
  async updateClientNote(
    bookingId: string,
    payload: UpdateClientNotePayload
  ): Promise<{ success: boolean; data: ClientNoteEntity }> {
    const res = await fetch(`/api/bookings/${bookingId}/note`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    return handleResponse<{ success: boolean; data: ClientNoteEntity }>(res);
  },

  /**
   * Mengambil seluruh riwayat catatan klinis pasien untuk psikolog ini (baca saja)
   */
  async getPatientNotes(
    patientId: string
  ): Promise<{ success: boolean; data: PatientNotesResponse }> {
    const res = await fetch(`/api/counselor/patients/${patientId}/notes`, {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<{ success: boolean; data: PatientNotesResponse }>(res);
  },
};
