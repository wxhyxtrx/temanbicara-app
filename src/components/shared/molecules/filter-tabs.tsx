"use client";

import React from "react";
import { cn } from "@/lib/utils";

type FilterTone = "teal" | "emerald" | "amber" | "rose" | "slate" | "neutral";

// Latar aktif cukup gelap agar teks putih kontras (amber-600, bukan amber-500).
const ACTIVE: Record<FilterTone, string> = {
  teal: "bg-teal-600 text-white",
  emerald: "bg-emerald-600 text-white",
  amber: "bg-amber-600 text-white",
  rose: "bg-rose-600 text-white",
  slate: "bg-slate-700 text-white dark:bg-slate-600",
  neutral: "bg-white dark:bg-slate-900 text-slate-900 dark:text-white",
};

export interface FilterTabOption<T extends string> {
  value: T;
  label: React.ReactNode;
  tone?: FilterTone;
}

interface FilterTabsProps<T extends string> {
  options: FilterTabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
}

/** Tombol filter bergaya segmented (Menunggu / Lunas / Ditolak, dsb.). */
export function FilterTabs<T extends string>({ options, value, onChange, ariaLabel, className }: FilterTabsProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex max-w-full overflow-x-auto rounded-xl p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold",
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0",
              active
                ? cn(ACTIVE[opt.tone ?? "teal"], "shadow-2xs font-bold")
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
