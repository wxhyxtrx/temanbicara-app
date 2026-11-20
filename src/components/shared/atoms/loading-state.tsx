import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  label?: string;
  /** true = spinner dan teks sebaris (untuk area kecil di dalam kartu). */
  inline?: boolean;
  className?: string;
}

/** Spinner di tengah area konten saat data dimuat. */
export function LoadingState({ label = "Memuat data...", inline = false, className }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center justify-center text-center font-nunito",
        inline ? "gap-2" : "flex-col gap-2.5 py-10",
        className
      )}
    >
      <Loader2 size={inline ? 16 : 24} className="animate-spin text-teal-600 dark:text-teal-400 shrink-0" />
      {label && <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>}
    </div>
  );
}
