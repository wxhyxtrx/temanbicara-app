import { handleUnauthorized } from '@/lib/auth/unauthorized-handler';
import {
  AdminUserQuery,
  AdminUserListResponse,
  AdminUserDetailResponse,
  AdminUserActionResponse,
  AdminCreateUserPayload,
  AdminUpdateUserPayload,
  AdminDashboardStatsResponse,
  ApiAccountStatus,
  MeResponse,
  UpdateMePayload,
  PsychologistDetailResponse,
  PsychologistListResponse,
  VolunteerDetailResponse,
  VolunteerListResponse,
} from '@/types/user-profile';

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 || data.error === 'INVALID_TOKEN' || data.error === 'UNAUTHENTICATED') {
      handleUnauthorized(data.message || 'Sesi tidak valid atau kedaluwarsa');
    }
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
   * Memperbarui data profil/pengaturan pengguna login saat ini
   */
  async updateMe(payload: UpdateMePayload): Promise<MeResponse> {
    const res = await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
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
    if (params?.role) {
      const roleVal = Array.isArray(params.role) ? params.role.join(',') : params.role;
      query.set('role', roleVal);
    }
    if (params?.status) {
      const statusVal = Array.isArray(params.status) ? params.status.join(',') : params.status;
      query.set('status', statusVal);
    }
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

  /**
   * Mengambil detail lengkap 1 user (khusus admin aktif)
   */
  async getUserById(id: string): Promise<AdminUserDetailResponse> {
    const res = await fetch(`/api/users/${encodeURIComponent(id)}`, {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<AdminUserDetailResponse>(res);
  },

  /**
   * Membuat pengguna baru (khusus admin aktif)
   */
  async createUser(payload: AdminCreateUserPayload): Promise<AdminUserActionResponse> {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    return handleResponse<AdminUserActionResponse>(res);
  },

  /**
   * Memperbarui data profil atau status pengguna (khusus admin aktif)
   */
  async updateUser(id: string, payload: AdminUpdateUserPayload): Promise<AdminUserActionResponse> {
    const res = await fetch(`/api/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    return handleResponse<AdminUserActionResponse>(res);
  },

  /**
   * Memperbarui status akun pengguna (active, suspended, rejected, dll)
   */
  async updateUserStatus(
    id: string,
    status: ApiAccountStatus,
    rejection_reason?: string
  ): Promise<AdminUserActionResponse> {
    const res = await fetch(`/api/users/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status, rejection_reason }),
    });
    return handleResponse<AdminUserActionResponse>(res);
  },

  /**
   * Menghapus pengguna secara permanen (khusus admin aktif)
   */
  async deleteUser(id: string): Promise<AdminUserActionResponse> {
    const res = await fetch(`/api/users/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return handleResponse<AdminUserActionResponse>(res);
  },

  /**
   * Mengambil statistik & KPI platform untuk dashboard admin
   */
  async getAdminStats(): Promise<AdminDashboardStatsResponse> {
    const res = await fetch('/api/admin/stats', {
      method: 'GET',
      credentials: 'include',
    });
    return handleResponse<AdminDashboardStatsResponse>(res);
  },
};
