import React from "react";
import { cn } from "@/lib/utils";

export type Tone = "teal" | "emerald" | "sky" | "amber" | "rose" | "violet" | "slate";

/** Warna lembut (latar tipis + teks gelap) per tone; dipakai ulang oleh molecule lain. */
export const TONE_SOFT: Record<Tone, string> = {
  teal: "bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-400",
  emerald: "bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400",
  sky: "bg-sky-50 dark:bg-sky-950/80 text-sky-700 dark:text-sky-400",
  amber: "bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400",
  rose: "bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-400",
  violet: "bg-violet-50 dark:bg-violet-950/80 text-violet-700 dark:text-violet-400",
  slate: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300",
};

interface IconChipProps {
  icon: React.ReactNode;
  tone?: Tone;
  size?: "sm" | "md";
  className?: string;
}

/** Kotak ikon berwarna kecil (pojok kartu statistik, judul seksi). */
export function IconChip({ icon, tone = "teal", size = "sm", className }: IconChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center shrink-0",
        size === "sm" ? "p-1.5 rounded-lg" : "p-2 rounded-xl",
        TONE_SOFT[tone],
        className
      )}
    >
      {icon}
    </span>
  );
}
