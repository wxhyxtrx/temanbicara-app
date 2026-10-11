import {
  LoginDTO,
  RegisterPasienDTO,
  RegisterPsikologDTO,
  RegisterRelawanDTO,
} from '@/lib/validations/auth';
import { AccountStatus, UserRole } from '@/types/database';

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
};
