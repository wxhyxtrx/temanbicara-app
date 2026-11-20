import React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Ikon kecil di depan judul (opsional). */
  icon?: React.ReactNode;
  /** Tombol/aksi di sisi kanan (turun ke bawah judul di HP). */
  actions?: React.ReactNode;
  className?: string;
}

/** Judul halaman standar untuk semua halaman non-beranda di setiap peran. */
export function PageHeader({ title, description, icon, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 min-w-0", className)}>
      <div className="space-y-1 min-w-0">
        <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5 min-w-0">
          {icon}
          <span className="min-w-0">{title}</span>
        </h1>
        {description && (
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 max-w-full">{actions}</div>}
    </div>
  );
}
