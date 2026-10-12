export type UserRole = 'pasien' | 'relawan' | 'psikolog' | 'admin';

export type AccountStatus =
  | 'active'
  | 'unverified_email'
  | 'incomplete_profile'
  | 'pending_approval'
  | 'pending_verification'
  | 'rejected'
  | 'suspended';

export type VerificationStatus = 'pending' | 'approved' | 'rejected';

export interface UserEntity {
  id: string;
  email: string;
  no_wa: string | null;
  google_id: string | null;
  role: UserRole;
  status: AccountStatus;
  avatar_url: string | null;
  is_email_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface PasienProfileEntity {
  user_id: string;
  nama_lengkap: string;
  kontak_darurat_nama?: string | null;
  kontak_darurat_wa?: string | null;
  is_anonim_default?: boolean;
  created_at: string;
  updated_at: string;
}

export interface RelawanProfileEntity {
  user_id: string;
  nama_lengkap: string;
  latar_belakang: string;
  dokumen_cv_url: string;
  alasan_bergabung: string;
  total_sesi: number;
  alias_name?: string | null;
  is_available?: boolean;
  topik_keahlian?: string[];
  rating_rata_rata?: number | null;
  created_at: string;
  updated_at: string;
}

export interface PsikologProfileEntity {
  user_id: string;
  nama_lengkap_gelar: string;
  nomor_sipp_str: string;
  dokumen_sipp_str_url: string;
  spesialisasi: string[];
  tahun_pengalaman: number;
  tarif_sesi: number;
  saldo: number;
  verified_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminProfileEntity {
  user_id: string;
  nama_lengkap: string;
  level: string;
  created_at: string;
}
