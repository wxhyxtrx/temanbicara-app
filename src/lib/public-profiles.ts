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

export const toPublicPsychologist = (r: PublicPsychologistRow, attendancePct: number | null = null) => ({
  id: r.user_id,
  nama_lengkap_gelar: r.nama_lengkap_gelar,
  spesialisasi: r.spesialisasi ?? [],
  tahun_pengalaman: r.tahun_pengalaman ?? 0,
  tarif_sesi: Number(r.tarif_sesi ?? 0),
  avatar_url: r.users?.avatar_url ?? null,
  attendance_pct: attendancePct,
});

/**
 * Menghitung tingkat kehadiran (attendance_pct) untuk daftar psikolog.
 * Formula: completed / (completed + cancelled_by_psikolog + auto_cancelled_late) * 100, null jika penyebut 0.
 */
export async function getPsychologistsAttendance(
  psychologistIds: string[]
): Promise<Record<string, number | null>> {
  if (!psychologistIds.length || !supabaseAdmin) return {};

  const { data: bookings, error } = await supabaseAdmin
    .from('bookings')
    .select('psikolog_id, status')
    .in('psikolog_id', psychologistIds)
    .in('status', ['completed', 'cancelled_by_psikolog', 'auto_cancelled_late']);

  const counts: Record<string, { completed: number; denominator: number }> = {};
  for (const id of psychologistIds) {
    counts[id] = { completed: 0, denominator: 0 };
  }

  if (!error && bookings) {
    for (const b of bookings) {
      if (!counts[b.psikolog_id]) {
        counts[b.psikolog_id] = { completed: 0, denominator: 0 };
      }
      counts[b.psikolog_id].denominator += 1;
      if (b.status === 'completed') {
        counts[b.psikolog_id].completed += 1;
      }
    }
  }

  const result: Record<string, number | null> = {};
  for (const id of psychologistIds) {
    const c = counts[id];
    if (!c || c.denominator === 0) {
      result[id] = null;
    } else {
      result[id] = Math.round((c.completed / c.denominator) * 100);
    }
  }
  return result;
}

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
