import type { BookingStatus, RefundPolicyTier, ExtensionStatus, PatientBookingView } from '@/types/booking';

/**
 * Utilitas pembantu untuk alur pencarian, perhitungan koin, dan booking psikolog (WIB)
 */

export const BOOKING_STATUS_CONFIG: Record<
  BookingStatus,
  { label: string; badgeClass: string; description: string }
> = {
  booked: {
    label: 'Terkonfirmasi',
    badgeClass: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    description: 'Sesi konseling telah terkonfirmasi dan siap dilaksanakan sesuai jadwal.',
  },
  in_progress: {
    label: 'Sesi Sedang Berlangsung',
    badgeClass: 'bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800',
    description: 'Ruang sesi konseling saat ini sedang aktif berlangsung.',
  },
  completed: {
    label: 'Selesai',
    badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    description: 'Sesi konseling telah selesai dilaksanakan.',
  },
  cancelled_by_patient: {
    label: 'Dibatalkan Pasien',
    badgeClass: 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-900',
    description: 'Sesi konseling dibatalkan oleh pasien.',
  },
  cancelled_by_psikolog: {
    label: 'Dibatalkan Psikolog',
    badgeClass: 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900',
    description: 'Sesi dibatalkan oleh psikolog dan koin telah dikembalikan 100%.',
  },
  awaiting_patient_choice: {
    label: 'Menunggu Pilihan Pasien',
    badgeClass: 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700',
    description: 'Psikolog membatalkan jadwal. Pasien dapat memilih pindah slot atau refund 100%.',
  },
  auto_cancelled_late: {
    label: 'Dibatalkan Otomatis (Psikolog Tidak Hadir)',
    badgeClass: 'bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    description: 'Sesi dibatalkan otomatis oleh sistem karena psikolog tidak hadir tepat waktu.',
  },
  no_show: {
    label: 'Pasien Tidak Hadir',
    badgeClass: 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700',
    description: 'Pasien tidak hadir dalam sesi konseling.',
  },
};

/**
 * Menghitung estimasi pengembalian koin berdasarkan snapshot refund_policy booking
 * Snapshot default: >=60 menit 100%, 30-60 menit 65% (dibulatkan ke atas / ceil), <30 menit 0%
 */
export function calculateEstimatedRefund(
  startAtIso: string,
  priceCoins: number,
  refundPolicy?: RefundPolicyTier[] | null
): {
  minutesBefore: number;
  refundPct: number;
  refundCoins: number;
  burnedCoins: number;
  hoursLeftFormatted: string;
} {
  const now = Date.now();
  const startAt = new Date(startAtIso).getTime();
  const diffMs = startAt - now;
  const minutesBefore = Math.floor(diffMs / (60 * 1000));

  let refundPct = 0;
  if (Array.isArray(refundPolicy) && refundPolicy.length > 0) {
    const sorted = [...refundPolicy].sort((a, b) => b.min_minutes_before - a.min_minutes_before);
    for (const tier of sorted) {
      if (minutesBefore >= tier.min_minutes_before) {
        refundPct = Number(tier.refund_pct);
        break;
      }
    }
  } else {
    if (minutesBefore >= 60) refundPct = 100;
    else if (minutesBefore >= 30) refundPct = 65;
    else refundPct = 0;
  }

  const refundCoins = Math.min(priceCoins, Math.max(0, Math.ceil((priceCoins * refundPct) / 100)));
  const burnedCoins = Math.max(0, priceCoins - refundCoins);

  let hoursLeftFormatted = '';
  if (diffMs <= 0) {
    hoursLeftFormatted = 'Sesi telah dimulai';
  } else {
    const hours = Math.floor(diffMs / (3600 * 1000));
    const mins = Math.floor((diffMs % (3600 * 1000)) / (60 * 1000));
    hoursLeftFormatted = hours > 0 ? `${hours} jam ${mins} menit lagi` : `${mins} menit lagi`;
  }

  return {
    minutesBefore,
    refundPct,
    refundCoins,
    burnedCoins,
    hoursLeftFormatted,
  };
}

/**
 * Mengecek kelayakan pasien untuk memindahkan jadwal mandiri (Mode A - status booked)
 * Aturan: reschedule_count = 0 dan > 24 jam sebelum sesi
 */
export function checkRescheduleEligibility(
  startAtIso: string,
  rescheduleCount: number,
  minHoursBefore = 24
): {
  eligible: boolean;
  reason?: string;
  hoursBefore: number;
} {
  if (rescheduleCount >= 1) {
    return {
      eligible: false,
      reason: 'Jadwal sesi ini sudah pernah dipindahkan (maksimal 1 kali pemindahan).',
      hoursBefore: 0,
    };
  }

  const now = Date.now();
  const startAt = new Date(startAtIso).getTime();
  const diffHours = (startAt - now) / (3600 * 1000);

  if (diffHours <= minHoursBefore) {
    const remainingMins = Math.max(0, Math.floor((startAt - now) / (60 * 1000)));
    const remHours = Math.floor(remainingMins / 60);
    const remMins = remainingMins % 60;
    return {
      eligible: false,
      reason: `Pindah jadwal hanya dapat dilakukan paling lambat 24 jam sebelum sesi dimulai (sisa waktu: ${remHours} jam ${remMins} menit).`,
      hoursBefore: diffHours,
    };
  }

  return {
    eligible: true,
    hoursBefore: diffHours,
  };
}

/**
 * Mengecek apakah ruang sesi konseling dapat dimasuki (tombol "Masuk Sesi" aktif).
 * Aturan:
 * - Status harus 'booked' atau 'in_progress'
 * - Belum diakhiri (ended_at null / falsy)
 * - Aktif mulai 10 menit sebelum start_at (start_at - 10 menit)
 * - Berakhir setelah durasi sesi selesai:
 *   - Durasi default 45 menit (55 menit jika ekstensi disetujui, batas maksimal 58 menit)
 */
export function isBookingRoomActive(
  booking: Pick<PatientBookingView, 'status' | 'start_at'> & {
    ended_at?: string | null;
    extension_status?: ExtensionStatus | null;
  }
): boolean {
  if (booking.status !== 'booked' && booking.status !== 'in_progress') {
    return false;
  }
  if (booking.ended_at) {
    return false;
  }

  const startMs = new Date(booking.start_at).getTime();
  if (!Number.isFinite(startMs)) return false;

  const nowMs = Date.now();
  const openMs = startMs - 10 * 60 * 1000;
  const durationMinutes = booking.extension_status === 'approved' ? 55 : 45;
  const endMs = startMs + Math.min(durationMinutes, 58) * 60 * 1000;

  if (booking.status === 'in_progress') {
    return nowMs <= endMs;
  }

  return nowMs >= openMs && nowMs <= endMs;
}



export function tarifToCoins(tarifSesi: number | string | null | undefined): number {
  const num = Number(tarifSesi || 0);
  return Math.max(1, Math.round(num / 10000));
}

export function formatRupiah(amount: number | string | null | undefined): string {
  const num = Number(amount || 0);
  return `Rp ${num.toLocaleString('id-ID')}`;
}

export function getInitials(name: string): string {
  if (!name) return 'PS';
  return (
    name
      .replace(/(Dr\.|dr\.|M\.Psi|S\.Psi|Psikolog|,|\.)/gi, '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || '')
      .join('') || 'PS'
  );
}

export function getWibDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(date);
}

export function formatWibTime(isoString: string): string {
  const d = new Date(isoString);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const hour = parts.find((p) => p.type === 'hour')?.value || '00';
  const minute = parts.find((p) => p.type === 'minute')?.value || '00';
  return `${hour}:${minute} WIB`;
}

export function formatWibDateShort(dateStrOrIso: string): string {
  const d = new Date(dateStrOrIso.includes('T') ? dateStrOrIso : `${dateStrOrIso}T00:00:00+07:00`);
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(d);
}

export function formatWibDateFull(dateStrOrIso: string): string {
  const d = new Date(dateStrOrIso.includes('T') ? dateStrOrIso : `${dateStrOrIso}T00:00:00+07:00`);
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

export interface WibDayItem {
  dateStr: string; // YYYY-MM-DD
  dayLabel: string; // "Hari ini", "Besok", "Sen", "Sel", etc.
  formattedDate: string; // "17 Okt"
  fullLabel: string; // "Minggu, 18 Oktober 2026"
}

/**
 * Menghasilkan deret 14 hari kalender ke depan dalam zona waktu WIB (Asia/Jakarta)
 */
export function generate14DaysWib(): WibDayItem[] {
  const now = new Date();
  const wibTodayStr = getWibDateString(now);
  const [year, month, day] = wibTodayStr.split('-').map(Number);

  const days: WibDayItem[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(Date.UTC(year, month - 1, day + i, 12, 0, 0));
    const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(d);

    let dayLabel: string;
    if (i === 0) dayLabel = 'Hari ini';
    else if (i === 1) dayLabel = 'Besok';
    else if (i === 2) dayLabel = 'Lusa';
    else {
      dayLabel = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'short' }).format(d);
    }

    const formattedDate = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric',
      month: 'short',
    }).format(d);

    const fullLabel = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);

    days.push({
      dateStr,
      dayLabel,
      formattedDate,
      fullLabel,
    });
  }
  return days;
}
