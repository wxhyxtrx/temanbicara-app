export type ApiRole = "pasien" | "relawan" | "psikolog" | "admin";

export type ApiAccountStatus =
  | "active"
  | "unverified_email"
  | "incomplete_profile"
  | "pending_approval"
  | "pending_verification"
  | "rejected"
  | "suspended";

export interface ApiError {
  success: false;
  error: string;
  message: string;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
}

// ---------- /api/users/me ----------
export interface MeUser {
  id: string;
  email: string;
  no_wa: string | null;
  role: ApiRole;
  status: ApiAccountStatus;
  avatar_url: string | null;
  is_email_verified: boolean;
  created_at: string;
  updated_at: string;
  fullName: string;
}

export interface PasienProfile {
  user_id: string;
  nama_lengkap: string;
  kontak_darurat_nama?: string | null;
  kontak_darurat_wa?: string | null;
  is_anonim_default?: boolean;
  created_at: string;
  updated_at: string;
}

export interface RelawanProfile {
  user_id: string;
  nama_lengkap: string;
  latar_belakang: string;
  dokumen_cv_url: string;
  alasan_bergabung: string;
  total_sesi: number;
  alias_name?: string | null;
  is_available?: boolean;
  topik_keahlian?: string[];
  rating_rata_rata?: number | string | null;
  created_at: string;
  updated_at: string;
}

export interface PsikologProfile {
  user_id: string;
  nama_lengkap_gelar: string;
  nomor_sipp_str: string;
  dokumen_sipp_str_url: string;
  spesialisasi: string[];
  tahun_pengalaman: number;
  tarif_sesi: number | string; // numeric Postgres, gunakan Number()
  saldo: number | string;
  verified_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminProfile {
  user_id: string;
  nama_lengkap: string;
  level: string;
  created_at: string;
}

export type MeProfile = PasienProfile | RelawanProfile | PsikologProfile | AdminProfile;

export type MeResponse =
  | {
      success: true;
      data: {
        user: MeUser;
        profile: MeProfile | null;
        fullName?: string;
      };
    }
  | ApiError;

// ---------- /api/psychologists ----------
export interface PublicPsychologist {
  id: string;
  nama_lengkap_gelar: string;
  spesialisasi: string[];
  tahun_pengalaman: number;
  tarif_sesi: number;
  avatar_url: string | null;
}

export type PsychologistListResponse =
  | { success: true; data: PublicPsychologist[]; meta: PageMeta }
  | ApiError;

export type PsychologistDetailResponse =
  | { success: true; data: PublicPsychologist }
  | ApiError;

// ---------- /api/volunteers ----------
export interface PublicVolunteer {
  id: string;
  alias_name: string;
  avatar_url: string | null;
  topik_keahlian: string[];
  total_sesi: number;
  rating_rata_rata: number | null;
  is_available: boolean;
}

export type VolunteerListResponse =
  | { success: true; data: PublicVolunteer[]; meta: PageMeta }
  | ApiError;

export type VolunteerDetailResponse =
  | { success: true; data: PublicVolunteer }
  | ApiError;

// ---------- /api/users (admin) ----------
export interface AdminUserRow {
  id: string;
  email: string;
  no_wa: string | null;
  role: ApiRole;
  status: ApiAccountStatus;
  avatar_url: string | null;
  is_email_verified: boolean;
  created_at: string;
  fullName: string;
  profile:
    | { nama_lengkap: string }
    | { nama_lengkap_gelar: string; verified_at: string | null }
    | { nama_lengkap: string; level: string }
    | null;
}

export interface AdminUserQuery {
  role?: ApiRole;
  status?: ApiAccountStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export type AdminUserListResponse =
  | { success: true; data: AdminUserRow[]; meta: PageMeta & { totalPages: number } }
  | ApiError;

export interface AdminCreateUserPayload {
  email: string;
  password: string;
  role: ApiRole;
  fullName: string;
  no_wa?: string | null;
  status?: ApiAccountStatus;
  level?: string;
  nomor_sipp_str?: string;
  spesialisasi?: string[];
  tarif_sesi?: number;
  tahun_pengalaman?: number;
  dokumen_sipp_str_url?: string;
  dokumen_cv_url?: string;
  latar_belakang?: string;
  alasan_bergabung?: string;
}

export interface AdminUpdateUserPayload {
  status?: ApiAccountStatus;
  no_wa?: string | null;
  fullName?: string;
  role?: ApiRole;
  rejection_reason?: string;
}

export interface AdminUpdateStatusPayload {
  status: ApiAccountStatus;
  rejection_reason?: string;
}

export type AdminUserDetailResponse =
  | {
      success: true;
      data: {
        user: AdminUserRow;
        profile: Record<string, unknown> | null;
        fullName: string;
      };
    }
  | ApiError;

export type AdminUserActionResponse =
  | {
      success: true;
      message: string;
      data?: Record<string, unknown>;
    }
  | ApiError;
