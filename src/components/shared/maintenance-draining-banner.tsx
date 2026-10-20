"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";
import { usePublicSettings } from "@/hooks/use-public-settings";

export function MaintenanceDrainingBanner() {
  const { settings } = usePublicSettings();

  if (settings?.maintenance?.phase !== "draining") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full rounded-2xl bg-amber-50 border border-amber-200 p-4 sm:p-5 text-amber-950 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-200 shadow-xs min-w-0"
    >
      <div className="flex items-start gap-3 sm:gap-3.5 min-w-0">
        <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/80 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5">
          <AlertTriangle className="size-5 shrink-0" aria-hidden="true" />
        </div>
        <div className="space-y-1 min-w-0 flex-1">
          <h3 className="font-bold font-heading text-sm sm:text-base text-amber-950 dark:text-amber-100 leading-snug break-words">
            Sistem Sedang Menutup Sesi Aktif
          </h3>
          <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-300 font-nunito leading-relaxed break-words">
            Sistem sedang menyelesaikan sesi konseling yang sedang berjalan. Pembuatan janji temu dan transaksi baru ditunda sementara hingga pemeliharaan selesai.
          </p>
        </div>
      </div>
    </div>
  );
}
