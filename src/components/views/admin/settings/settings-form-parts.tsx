"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SystemSettings } from "@/types/system-settings";
import { AlertCircle, Calendar, Clock, Coins, HandCoins, HardDrive, type LucideIcon, ShieldAlert, Star, Upload, Users, Wallet } from "lucide-react";

export type SettingKey = keyof SystemSettings;
export type FlatKey = Exclude<SettingKey, "maintenance" | "revenue_share" | "refund_policy">;
export type FlatGroup<K extends FlatKey> = {
  title: string;
  icon: LucideIcon;
  fields: { field: keyof SystemSettings[K] & string; label: string }[];
};

export const FLAT_GROUPS: { [K in FlatKey]: FlatGroup<K> } = {
  topup: {
    title: "Batas Top-up Koin",
    icon: Coins,
    fields: [
      { field: "min_coins", label: "Minimal top-up (koin)" },
      { field: "max_coins", label: "Maksimal top-up (koin)" },
    ],
  },
  tip: {
    title: "Batas Tip Koin",
    icon: HandCoins,
    fields: [
      { field: "min_coins", label: "Minimal tip (koin)" },
      { field: "max_coins", label: "Maksimal tip (koin)" },
      { field: "daily_cap_coins_per_patient", label: "Batas harian per pasien (koin)" },
    ],
  },
  holding: {
    title: "Masa Tahan Dana",
    icon: Clock,
    fields: [{ field: "hours", label: "Durasi holding (jam)" }],
  },
  payout: {
    title: "Penarikan Dana (Payout)",
    icon: Wallet,
    fields: [
      { field: "min_rupiah", label: "Minimal penarikan (Rp)" },
      { field: "max_rupiah", label: "Maksimal penarikan (Rp)" },
      { field: "fee_rupiah", label: "Biaya penarikan (Rp)" },
    ],
  },
  psikolog_late: {
    title: "Toleransi Keterlambatan Psikolog",
    icon: Clock,
    fields: [{ field: "minutes", label: "Batas terlambat (menit)" }],
  },
  patient_noshow: {
    title: "Toleransi No-show Pasien",
    icon: Clock,
    fields: [{ field: "minutes", label: "Batas tidak hadir (menit)" }],
  },
  extension_price: {
    title: "Harga Perpanjangan Sesi",
    icon: Coins,
    fields: [
      { field: "min_coins", label: "Harga minimal (koin)" },
      { field: "max_coins", label: "Harga maksimal (koin)" },
    ],
  },
  relawan: {
    title: "Operasional Relawan",
    icon: Users,
    fields: [
      { field: "daily_ticket_quota", label: "Kuota tiket harian" },
      { field: "claim_response_minutes", label: "Batas respons klaim (menit)" },
      { field: "unclaimed_archive_hours", label: "Arsip tiket tak diklaim (jam)" },
      { field: "max_carry_penalty", label: "Maksimal penalti terbawa" },
    ],
  },
  upload: {
    title: "Batas Unggahan",
    icon: Upload,
    fields: [
      { field: "verification_max_mb", label: "Dokumen verifikasi (MB)" },
      { field: "chat_media_max_mb", label: "Media chat (MB)" },
      { field: "voice_note_max_seconds", label: "Voice note (detik)" },
    ],
  },
  media_retention: {
    title: "Retensi Media",
    icon: HardDrive,
    fields: [{ field: "days", label: "Masa simpan media (hari)" }],
  },
  booking: {
    title: "Pengaturan Booking Sesi",
    icon: Calendar,
    fields: [
      { field: "min_hours_before", label: "Minimal sebelum mulai (jam)" },
      { field: "max_days_ahead", label: "Batas booking ke depan (hari)" },
      { field: "max_active_per_patient", label: "Maksimal booking aktif per pasien" },
      { field: "max_per_psikolog_per_day", label: "Maksimal booking per psikolog per hari" },
      { field: "reschedule_min_hours", label: "Batas waktu pindah jadwal pasien (jam sebelum)" },
      { field: "psikolog_cancel_free_hours", label: "Batas pembatalan bebas penalti psikolog (jam sebelum)" },
      { field: "choice_deadline_hours", label: "Batas pasien menentukan pilihan (jam)" },
    ],
  },
  strike: {
    title: "Penalti & Strike Psikolog",
    icon: ShieldAlert,
    fields: [
      { field: "per_late_cancel", label: "Poin strike pembatalan mendadak" },
      { field: "per_noshow", label: "Poin strike tidak hadir (no-show)" },
      { field: "threshold", label: "Batas akumulasi poin strike suspensi" },
      { field: "window_days", label: "Masa berlaku poin strike (hari)" },
      { field: "suspend_days", label: "Durasi suspensi akun (hari)" },
    ],
  },
  rating: {
    title: "Rating & Ulasan Sesi",
    icon: Star,
    fields: [
      { field: "window_days", label: "Batas waktu pemberian rating (hari)" },
      { field: "min_count_to_show", label: "Minimal ulasan untuk ditampilkan ke publik" },
    ],
  },
};

// Spec §3 order; maintenance always first.
export const ORDER: SettingKey[] = [
  "topup",
  "revenue_share",
  "tip",
  "holding",
  "payout",
  "booking",
  "strike",
  "rating",
  "refund_policy",
  "psikolog_late",
  "patient_noshow",
  "extension_price",
  "relawan",
  "upload",
  "media_retention",
];

export const inputClass =
  "h-9 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl";
export const labelClass = "text-xs font-semibold text-slate-700 dark:text-slate-300";

// Empty/invalid input becomes NaN (never coerced to 0); handleSave blocks submit via invalidNumberKeys.
export const toNumber = (raw: string) => (raw.trim() === "" ? NaN : Number(raw));

const hasBadNumber = (v: unknown): boolean =>
  typeof v === "number"
    ? !Number.isFinite(v)
    : typeof v === "object" && v !== null && Object.values(v).some(hasBadNumber);

export const invalidNumberKeys = (s: SystemSettings) =>
  (Object.keys(s) as SettingKey[]).filter((k) => hasBadNumber(s[k]));

export const pad = (n: number) => String(n).padStart(2, "0");

// ISO -> `datetime-local` value in the browser's local zone.
export const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const isValidLocalInput = (value: string) => {
  if (!value) return true;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day, hour, minute] = match.map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(hour, minute, 0, 0);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day && date.getHours() === hour && date.getMinutes() === minute;
};

// Spec §3: when both are set, estimated_end must be later than scheduled_start. Empty values are allowed.
export const isMaintenanceRangeValid = (start: string, end: string) =>
  !start || !end || !isValidLocalInput(start) || !isValidLocalInput(end) || new Date(end).getTime() > new Date(start).getTime();

export const fromLocalInput = (value: string) => {
  if (!value) return null;
  if (!isValidLocalInput(value)) return null;
  return new Date(value).toISOString();
};

export function getChangedSettings(
  form: SystemSettings | null,
  original: SystemSettings | null,
  maintenanceDraft: { scheduled_start: string; estimated_end: string },
  revenueShareDraft: string | null
): Partial<SystemSettings> {
  if (!form || !original) return {};

  const changes: Partial<SystemSettings> = {};

  const origMaintStart = toLocalInput(original.maintenance.scheduled_start);
  const origMaintEnd = toLocalInput(original.maintenance.estimated_end);
  const origMaintMsg = original.maintenance.message ?? "";
  const currentMaintMsg = form.maintenance.message ?? "";

  if (
    maintenanceDraft.scheduled_start !== origMaintStart ||
    maintenanceDraft.estimated_end !== origMaintEnd ||
    currentMaintMsg !== origMaintMsg
  ) {
    changes.maintenance = {
      message: currentMaintMsg,
      scheduled_start: maintenanceDraft.scheduled_start
        ? fromLocalInput(maintenanceDraft.scheduled_start)
        : null,
      estimated_end: maintenanceDraft.estimated_end
        ? fromLocalInput(maintenanceDraft.estimated_end)
        : null,
    };
  }

  const revenueSharePercent = Number(
    revenueShareDraft ?? String(form.revenue_share.mitra_bps / 100)
  );
  const effectiveBps = Number.isFinite(revenueSharePercent)
    ? Math.round(revenueSharePercent * 100)
    : NaN;

  if (
    revenueShareDraft !== null
      ? effectiveBps !== original.revenue_share.mitra_bps
      : form.revenue_share.mitra_bps !== original.revenue_share.mitra_bps
  ) {
    changes.revenue_share = {
      mitra_bps: Number.isFinite(effectiveBps)
        ? effectiveBps
        : form.revenue_share.mitra_bps,
    };
  }

  const origRefund = original.refund_policy ?? [];
  const currentRefund = form.refund_policy ?? [];
  const refundChanged =
    currentRefund.length !== origRefund.length ||
    currentRefund.some(
      (tier, i) =>
        tier.min_minutes_before !== origRefund[i]?.min_minutes_before ||
        tier.refund_pct !== origRefund[i]?.refund_pct
    );

  if (refundChanged) {
    changes.refund_policy = currentRefund;
  }

  for (const key of ORDER) {
    if (key === "revenue_share" || key === "refund_policy") continue;
    const group = FLAT_GROUPS[key as FlatKey];
    const formGroup = form[key as FlatKey] as Record<string, number>;
    const origGroup = original[key as FlatKey] as Record<string, number>;
    const hasDiff = group.fields.some(
      ({ field }) => formGroup[field] !== origGroup[field]
    );
    if (hasDiff) {
      (changes as Record<string, unknown>)[key] = form[key as FlatKey];
    }
  }

  return changes;
}

export const formatWib = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export interface SectionProps {
  title: string;
  icon: LucideIcon;
  meta?: { updated_at: string; updated_by: string | null };
  error?: string;
  errorId?: string;
  children: React.ReactNode;
}

export function SettingSection({ title, icon: Icon, meta, error, errorId, children }: SectionProps) {
  return (
    <Card
      className={`rounded-2xl border bg-white dark:bg-slate-900 shadow-xs ${
        error ? "border-red-300 dark:border-red-800" : "border-slate-200/90 dark:border-slate-800"
      }`}
    >
      <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
        <CardTitle className="font-heading text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Icon size={18} className="text-teal-600 dark:text-teal-400 shrink-0" />
          {title}
        </CardTitle>
        {meta && (
          <CardDescription className="text-[11px] text-slate-400">
            Terakhir diubah {formatWib(meta.updated_at)} WIB
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="p-4 sm:p-6 space-y-4">
        {error && (
          <p id={errorId} role="alert" className="flex items-start gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            {error}
          </p>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

export interface NumberFieldProps {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  errorId?: string;
}

const toText = (n: number) => (Number.isFinite(n) ? String(n) : "");

export function NumberField({ id, label, value, onChange, step = 1, errorId }: NumberFieldProps) {
  // Local text keeps empty/partial input while typing; resync only when the parent value really changes.
  const [text, setText] = React.useState(() => toText(value));
  React.useEffect(() => {
    setText((prev) => (Object.is(toNumber(prev), value) ? prev : toText(value)));
  }, [value]);

  return (
    <div className="space-y-1.5 min-w-0">
      <Label htmlFor={id} className={labelClass}>
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        step={step}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(toNumber(e.target.value));
        }}
        aria-invalid={!!errorId || undefined}
        aria-describedby={errorId}
        className={inputClass}
        required
      />
    </div>
  );
}
