import React from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  /** "compact" untuk daftar kecil di dalam kartu, "default" untuk area konten besar. */
  size?: "compact" | "default";
  className?: string;
}

/** Tampilan saat daftar kosong ("Belum ada ..."), berbingkai garis putus-putus. */
export function EmptyState({ title, description, icon, action, size = "default", className }: EmptyStateProps) {
  const compact = size === "compact";
  // Satu kalimat tanpa ikon/keterangan: tampil sebagai teks biasa, bukan judul tebal.
  const plain = compact && !icon && !description;
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 min-w-0",
        compact ? "p-6 gap-1.5" : "py-12 px-4 gap-3 bg-slate-50/50 dark:bg-slate-900/40",
        className
      )}
    >
      {icon &&
        (compact ? (
          <span className="text-slate-400 opacity-70 [&_svg]:size-7">{icon}</span>
        ) : (
          <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-100 dark:border-teal-900 flex items-center justify-center text-teal-600 dark:text-teal-400 [&_svg]:size-6">
            {icon}
          </div>
        ))}
      <div className="space-y-1 max-w-md min-w-0">
        <p
          className={cn(
            plain
              ? "text-xs text-slate-500 dark:text-slate-400"
              : compact
                ? "font-heading font-bold text-xs text-slate-700 dark:text-slate-300"
                : "font-heading font-bold text-sm sm:text-base text-slate-900 dark:text-white"
          )}
        >
          {title}
        </p>
        {description && (
          <p className={cn("font-nunito leading-relaxed text-slate-500 dark:text-slate-400", compact ? "text-[11px]" : "text-xs")}>
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
