import { supabaseAdmin } from '@/lib/supabase/client';

export interface PublicPsychologistRow {
  user_id: string;
  nama_lengkap_gelar: string;
  spesialisasi?: string[] | null;
  tahun_pengalaman?: number | null;
  tarif_sesi?: number | string | null;
  users?: {
    avatar_url?: string | null;
    status?: string | null;
  } | null;
}

export interface PublicVolunteerRow {
  user_id: string;
  alias_name?: string | null;
  topik_keahlian?: string[] | null;
  total_sesi?: number | null;
  rating_rata_rata?: number | string | null;
  is_available?: boolean | null;
  users?: {
    avatar_url?: string | null;
    status?: string | null;
  } | null;
}

export const toPublicPsychologist = (r: PublicPsychologistRow) => ({
  id: r.user_id,
  nama_lengkap_gelar: r.nama_lengkap_gelar,
  spesialisasi: r.spesialisasi ?? [],
  tahun_pengalaman: r.tahun_pengalaman ?? 0,
  tarif_sesi: Number(r.tarif_sesi ?? 0),
  avatar_url: r.users?.avatar_url ?? null,
});

export const toPublicVolunteer = (r: PublicVolunteerRow) => ({
  id: r.user_id,
  // Jangan pernah fallback ke nama_lengkap: identitas asli relawan harus tetap tersembunyi
  alias_name: r.alias_name || `Teman Pendengar ${String(r.user_id).slice(0, 4).toUpperCase()}`,
  avatar_url: r.users?.avatar_url ?? null,
  topik_keahlian: r.topik_keahlian ?? [],
  total_sesi: r.total_sesi ?? 0,
  rating_rata_rata: r.rating_rata_rata == null ? null : Number(r.rating_rata_rata),
  is_available: r.is_available ?? false,
});

export const activeProfiles = (table: 'psikolog_profiles' | 'relawan_profiles') =>
  supabaseAdmin
    .from(table)
    .select('*, users!inner(avatar_url, status)', { count: 'exact' })
    .eq('users.status', 'active');
