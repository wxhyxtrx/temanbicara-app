import React from "react";
import { cn } from "@/lib/utils";

interface PageShellProps {
  children: React.ReactNode;
  className?: string;
}

/** Pembungkus standar konten halaman di portal privat (jarak antar seksi, font, warna teks). */
export function PageShell({ children, className }: PageShellProps) {
  return (
    <div
      className={cn(
        "space-y-6 sm:space-y-8 font-nunito pb-12 text-slate-900 dark:text-slate-100 transition-colors duration-200 min-w-0 max-w-full",
        className
      )}
    >
      {children}
    </div>
  );
}
