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
  nama_panggilan?: string | null;
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
  alias_name: string | null;
  is_available: boolean;
  topik_keahlian: string[];
  rating_rata_rata: number | string | null;
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
  booking_paused?: boolean;
  extension_price_coins?: number | null;
  suspended_until?: string | null;
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

// ---------- /api/users/me PATCH ----------
export interface UpdateMePasienPayload {
  no_wa?: string;
  nama_lengkap?: string;
  nama_panggilan?: string | null;
  kontak_darurat_nama?: string;
  kontak_darurat_wa?: string;
  is_anonim_default?: boolean;
}

export interface UpdateMePsikologPayload {
  no_wa?: string;
  spesialisasi?: string[];
  tahun_pengalaman?: number;
  tarif_sesi?: number;
  booking_paused?: boolean;
  extension_price_coins?: number | null;
}

export interface UpdateMeRelawanPayload {
  no_wa?: string;
  alias_name?: string;
  topik_keahlian?: string[];
  is_available?: boolean;
}

export interface UpdateMeAdminPayload {
  no_wa?: string;
}

export type UpdateMePayload =
  | UpdateMePasienPayload
  | UpdateMePsikologPayload
  | UpdateMeRelawanPayload
  | UpdateMeAdminPayload;

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
  coin_balance?: number;
  pending_rupiah?: number;
  available_rupiah?: number;
}

export interface UserWalletSummary {
  coin_balance: number;
  pending_rupiah: number;
  available_rupiah: number;
}

export interface PatientTopupSummary {
  total_coins: number;
  total_rupiah: number;
  successful_orders_count: number;
}

export interface MitraPayoutSummary {
  total_paid_rupiah: number;
  paid_requests_count: number;
}

export interface AdminDashboardStatsData {
  users: {
    total: number;
    by_role: Record<string, number>;
    by_status: Record<string, number>;
  };
  mitra_verification: {
    pending_count: number;
  };
  payout: {
    requested_count: number;
    total_requested_rupiah: number;
  };
  topup: {
    all_time: {
      total_orders: number;
      total_coins: number;
      total_rupiah: number;
    };
    today: {
      total_orders: number;
      total_coins: number;
      total_rupiah: number;
    };
  };
  revenue: {
    total_platform_revenue_rupiah: number;
    breakdown_by_reason: Record<string, number>;
  };
}

export type AdminDashboardStatsResponse =
  | {
      success: true;
      data: AdminDashboardStatsData;
    }
  | ApiError;

export interface AdminUserQuery {
  role?: ApiRole | ApiRole[] | string;
  status?: ApiAccountStatus | ApiAccountStatus[] | string;
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
        user: AdminUserRow & {
          last_sign_in_at?: string | null;
          verified_at?: string | null;
          updated_at?: string;
          dokumen_signed_url?: string | null;
        };
        profile: Record<string, unknown> | null;
        fullName: string;
        wallet?: UserWalletSummary;
        topup_summary?: PatientTopupSummary | null;
        payout_summary?: MitraPayoutSummary | null;
        dokumen_signed_url?: string | null;
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
