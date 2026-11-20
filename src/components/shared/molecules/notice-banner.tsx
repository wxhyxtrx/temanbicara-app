import React from "react";
import { AlertCircle, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type NoticeTone = "warning" | "danger" | "info";

const TONES: Record<NoticeTone, { box: string; icon: string; title: string; body: string; Icon: typeof AlertCircle }> = {
  warning: {
    box: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60",
    icon: "text-amber-600 dark:text-amber-400",
    title: "text-amber-950 dark:text-amber-100",
    body: "text-amber-800 dark:text-amber-300",
    Icon: AlertCircle,
  },
  danger: {
    box: "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900",
    icon: "text-rose-600 dark:text-rose-400",
    title: "text-rose-950 dark:text-rose-100",
    body: "text-rose-800 dark:text-rose-200",
    Icon: AlertTriangle,
  },
  info: {
    box: "bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-900/60",
    icon: "text-sky-600 dark:text-sky-400",
    title: "text-sky-950 dark:text-sky-100",
    body: "text-sky-800 dark:text-sky-300",
    Icon: Info,
  },
};

interface NoticeBannerProps {
  tone?: NoticeTone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  /** Tombol di kanan (turun ke bawah di HP). */
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

/** Banner pemberitahuan (peringatan, galat, info) dengan aksi opsional. */
export function NoticeBanner({ tone = "warning", title, children, action, icon, className }: NoticeBannerProps) {
  const t = TONES[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 rounded-2xl border shadow-xs",
        t.box,
        className
      )}
    >
      <div className="flex items-start gap-3 min-w-0">
        <span className={cn("shrink-0 mt-0.5", t.icon)}>{icon ?? <t.Icon className="size-5" />}</span>
        <div className="space-y-0.5 min-w-0">
          {title && <h4 className={cn("font-bold font-heading text-sm", t.title)}>{title}</h4>}
          {children && <div className={cn("text-xs font-nunito leading-relaxed", t.body)}>{children}</div>}
        </div>
      </div>
      {action && <div className="shrink-0 self-start sm:self-center">{action}</div>}
    </div>
  );
}
