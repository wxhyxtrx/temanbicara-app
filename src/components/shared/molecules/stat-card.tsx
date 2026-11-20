import React from "react";
import { cn } from "@/lib/utils";
import { IconChip, type Tone } from "../atoms/icon-chip";

interface StatCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Satuan kecil di samping angka, mis. "Sesi", "Koin". */
  unit?: React.ReactNode;
  /** Keterangan kecil di bawah angka. */
  hint?: React.ReactNode;
  icon: React.ReactNode;
  tone?: Tone;
  /** Ganti angka dengan teks "Memuat..." saat data belum siap. */
  loading?: boolean;
  valueClassName?: string;
  className?: string;
}

/** Kartu KPI: label + ikon di atas, angka besar, keterangan kecil. */
export function StatCard({
  label,
  value,
  unit,
  hint,
  icon,
  tone = "teal",
  loading,
  valueClassName,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1.5 min-w-0",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span className="min-w-0">{label}</span>
        <IconChip icon={icon} tone={tone} />
      </div>
      <p className={cn("text-xl sm:text-2xl font-bold font-heading text-slate-900 dark:text-white", valueClassName)}>
        {loading ? (
          <span className="text-base text-slate-400 font-normal">Memuat...</span>
        ) : (
          <>
            {value}
            {unit && <span className="text-xs font-semibold text-slate-500 dark:text-slate-400"> {unit}</span>}
          </>
        )}
      </p>
      {hint && <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-nunito">{hint}</span>}
    </div>
  );
}
