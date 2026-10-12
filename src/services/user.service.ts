import {
  AdminUserQuery,
  AdminUserListResponse,
  MeResponse,
  PsychologistDetailResponse,
  PsychologistListResponse,
  VolunteerDetailResponse,
  VolunteerListResponse,
} from '@/types/user-profile';

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = data.message || data.error || 'Terjadi kesalahan pada server';
    throw new Error(errorMsg);
  }
  return data as T;
}

export const userService = {
  /**
   * Mengambil data pengguna login saat ini dan profil per role
   */
  async getMe(): Promise<MeResponse> {
    const res = await fetch('/api/users/me', {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<MeResponse>(res);
  },

  /**
   * Katalog publik psikolog aktif (beranda pasien)
   */
  async getPsychologists(params?: { page?: number; limit?: number }): Promise<PsychologistListResponse> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));

    const url = `/api/psychologists${query.toString() ? `?${query.toString()}` : ''}`;
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<PsychologistListResponse>(res);
  },

  /**
   * Detail satu psikolog aktif
   */
  async getPsychologistById(id: string): Promise<PsychologistDetailResponse> {
    const res = await fetch(`/api/psychologists/${encodeURIComponent(id)}`, {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<PsychologistDetailResponse>(res);
  },

  /**
   * Direktori relawan pendengar aktif
   */
  async getVolunteers(params?: { page?: number; limit?: number }): Promise<VolunteerListResponse> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));

    const url = `/api/volunteers${query.toString() ? `?${query.toString()}` : ''}`;
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<VolunteerListResponse>(res);
  },

  /**
   * Detail satu relawan pendengar aktif
   */
  async getVolunteerById(id: string): Promise<VolunteerDetailResponse> {
    const res = await fetch(`/api/volunteers/${encodeURIComponent(id)}`, {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<VolunteerDetailResponse>(res);
  },

  /**
   * Daftar seluruh pengguna (khusus admin aktif)
   */
  async getAdminUsers(params?: AdminUserQuery): Promise<AdminUserListResponse> {
    const query = new URLSearchParams();
    if (params?.role) query.set('role', params.role);
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));

    const url = `/api/users${query.toString() ? `?${query.toString()}` : ''}`;
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<AdminUserListResponse>(res);
  },
};
