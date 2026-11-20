import React from "react";
import { Badge } from "@/components/ui/badge";
import { BOOKING_STATUS_CONFIG } from "@/lib/booking-utils";
import type { BookingStatus } from "@/types/booking";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: BookingStatus | string;
  className?: string;
}

/** Badge status booking; label & warna satu sumber dari BOOKING_STATUS_CONFIG. */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const cfg = BOOKING_STATUS_CONFIG[status as BookingStatus] ?? {
    label: status,
    badgeClass: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700",
  };
  return (
    <Badge className={cn(cfg.badgeClass, "text-[10px] font-semibold py-0.5 px-2", className)}>
      {cfg.label}
    </Badge>
  );
}
