"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Clock, X } from "lucide-react";
import { usePublicSettings } from "@/hooks/use-public-settings";

const DEFAULT_MAINTENANCE_MESSAGE = "Pemeliharaan sistem terjadwal";

export function formatWibDateTimeRange(
  startIso: string | null | undefined,
  endIso: string | null | undefined
): string | null {
  if (!startIso || typeof startIso !== "string" || !startIso.trim()) return null;
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return null;

  try {
    const formatParts = (d: Date) => {
      const parts = new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(d);

      const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
      const day = get("day");
      const month = get("month").replace(".", "");
      const year = get("year");
      const hour = get("hour").padStart(2, "0");
      const minute = get("minute").padStart(2, "0");
      return { day, month, year, hour, minute, dateKey: `${year}-${month}-${day}` };
    };

    const s = formatParts(start);

    if (!endIso || typeof endIso !== "string" || !endIso.trim()) {
      return `Mulai: ${s.day} ${s.month} ${s.year}, ${s.hour}:${s.minute} WIB`;
    }

    const end = new Date(endIso);
    if (Number.isNaN(end.getTime())) {
      return `Mulai: ${s.day} ${s.month} ${s.year}, ${s.hour}:${s.minute} WIB`;
    }

    const e = formatParts(end);

    if (s.dateKey === e.dateKey) {
      return `${s.day} ${s.month} ${s.year} ${s.hour}:${s.minute} - ${e.hour}:${e.minute} WIB`;
    }

    return `${s.day} ${s.month} ${s.year} ${s.hour}:${s.minute} - ${e.day} ${e.month} ${e.year} ${e.hour}:${e.minute} WIB`;
  } catch {
    return null;
  }
}

export function MaintenanceScheduledBanner() {
  const pathname = usePathname();
  const { settings } = usePublicSettings();
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    setIsDismissed(false);
  }, [pathname]);

  if (isDismissed) return null;
  if (settings?.maintenance?.phase !== "scheduled") return null;

  const rawMessage = settings.maintenance?.message;
  const message =
    rawMessage && typeof rawMessage === "string" && rawMessage.trim()
      ? rawMessage.trim()
      : DEFAULT_MAINTENANCE_MESSAGE;

  const scheduleRange = formatWibDateTimeRange(
    settings.maintenance?.scheduled_start,
    settings.maintenance?.estimated_end
  );

  return (
    <aside
      aria-label="Pengumuman pemeliharaan sistem terjadwal"
      className="w-full bg-amber-500/10 border-b border-amber-500/30 text-amber-950 dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-200 px-3 sm:px-6 py-2 transition-colors min-w-0"
    >
      <div className="w-full flex items-center justify-between gap-2 sm:gap-3 min-w-0 max-w-[1520px] mx-auto">
        <div className="flex items-start sm:items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/60 dark:text-amber-200 dark:border-amber-700 shrink-0 mt-0.5 sm:mt-0">
            <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">Pemeliharaan Terjadwal</span>
            <span className="sm:hidden">Terjadwal</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 text-xs sm:text-sm min-w-0 flex-1">
            {scheduleRange && (
              <span className="font-semibold text-amber-900 dark:text-amber-100 truncate min-w-0">
                {scheduleRange}
              </span>
            )}
            {scheduleRange && (
              <span
                className="hidden sm:inline text-amber-600 dark:text-amber-400 select-none"
                aria-hidden="true"
              >
                •
              </span>
            )}
            <span className="text-amber-800 dark:text-amber-300/90 truncate min-w-0">
              {message}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          aria-label="Tutup pengumuman pemeliharaan"
          className="text-amber-700 hover:text-amber-950 dark:text-amber-400 dark:hover:text-amber-100 p-1 rounded-md hover:bg-amber-200/50 dark:hover:bg-amber-900/60 transition-colors shrink-0 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
