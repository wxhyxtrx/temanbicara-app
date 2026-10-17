/**
 * Utilitas pembantu untuk alur pencarian, perhitungan koin, dan booking psikolog (WIB)
 */

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
