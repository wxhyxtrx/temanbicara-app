import {
  LoginDTO,
  RegisterPasienDTO,
  RegisterPsikologDTO,
  RegisterRelawanDTO,
} from '@/lib/validations/auth';
import { AccountStatus, UserRole } from '@/types/database';
import { supabasePublic } from '@/lib/supabase/client';
import { handleUnauthorized } from '@/lib/auth/unauthorized-handler';

export interface UserAuthSession {
  id: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  avatar_url: string | null;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    user: UserAuthSession;
    session: {
      access_token: string;
      refresh_token: string;
      expires_at: number;
    };
    redirect_to: string;
  };
}

export interface RegisterPasienResponse {
  success: boolean;
  message: string;
  data: {
    user_id: string;
    email: string;
    role: UserRole;
    status: AccountStatus;
  };
}

export interface RegisterMitraResponse {
  success: boolean;
  message: string;
  data: {
    user_id: string;
    email: string;
    role: UserRole;
    status: AccountStatus;
    redirect_to: string;
  };
}

export interface PresignedUrlPayload {
  file_name: string;
  file_type: string;
  document_type: 'cv' | 'sipp_str';
  user_email_or_temp_id: string;
}

export interface PresignedUrlResponse {
  success: boolean;
  data: {
    upload_url: string;
    token: string;
    file_path: string;
    bucket: string;
  };
}

export interface ApiErrorResponse {
  error?: string;
  message?: string;
  issues?: { path: string[]; message: string }[];
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const isLoginEndpoint = typeof res.url === 'string' && res.url.includes('/api/auth/login');
    if (!isLoginEndpoint && (res.status === 401 || data.error === 'INVALID_TOKEN' || data.error === 'UNAUTHENTICATED')) {
      handleUnauthorized(data.message || 'Sesi tidak valid atau kedaluwarsa');
    }
    const errorMsg = data.message || data.error || 'Terjadi kesalahan pada server';
    throw new Error(errorMsg);
  }
  return data as T;
}

export const authService = {
  async login(payload: LoginDTO): Promise<LoginResponse> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<LoginResponse>(res);
  },

  async registerPasien(payload: RegisterPasienDTO): Promise<RegisterPasienResponse> {
    const res = await fetch('/api/auth/register/pasien', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<RegisterPasienResponse>(res);
  },

  async registerRelawan(payload: RegisterRelawanDTO): Promise<RegisterMitraResponse> {
    const res = await fetch('/api/auth/register/relawan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<RegisterMitraResponse>(res);
  },

  async registerPsikolog(payload: RegisterPsikologDTO): Promise<RegisterMitraResponse> {
    const res = await fetch('/api/auth/register/psikolog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<RegisterMitraResponse>(res);
  },

  async getPresignedUrl(payload: PresignedUrlPayload): Promise<PresignedUrlResponse> {
    const res = await fetch('/api/upload/presigned-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<PresignedUrlResponse>(res);
  },

  async uploadBinaryFile(uploadUrl: string, file: File): Promise<void> {
    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
      },
      body: file,
    });
    if (!res.ok) {
      throw new Error('Gagal mengunggah berkas ke penyimpanan.');
    }
  },

  async logout(): Promise<void> {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    }
    try {
      if (typeof window !== 'undefined') {
        await Promise.race([
          supabasePublic.auth.signOut(),
          new Promise((resolve) => setTimeout(resolve, 2000)),
        ]);
      }
    } catch {
      // Ignore supabase client signOut error if already logged out
    }
  },
};
