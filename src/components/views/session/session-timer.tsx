"use client";

import React, { useEffect, useState } from "react";
import { Clock, AlertTriangle, CheckCircle, Hourglass } from "lucide-react";
import type { BookingStatus, ExtensionStatus } from "@/types/booking";

interface SessionTimerProps {
  startAt: string;
  extensionStatus: ExtensionStatus | null;
  status: BookingStatus;
  onExpire?: () => void;
  className?: string;
}

export function SessionTimer({
  startAt,
  extensionStatus,
  status,
  onExpire,
  className = "",
}: SessionTimerProps) {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const startMs = new Date(startAt).getTime();
  const durationMinutes = extensionStatus === "approved" ? 55 : 45;
  const hardCappedMinutes = Math.min(durationMinutes, 58);
  const endMs = startMs + hardCappedMinutes * 60 * 1000;

  const isTerminalStatus =
    status === "completed" ||
    status === "auto_cancelled_late" ||
    status === "no_show" ||
    status === "cancelled_by_patient" ||
    status === "cancelled_by_psikolog";

  if (isTerminalStatus) {
    let label = "Sesi Telah Selesai";
    if (status === "auto_cancelled_late") label = "Dibatalkan (Psikolog Terlambat)";
    if (status === "no_show") label = "Sesi Berakhir (Pasien Tidak Hadir)";
    if (status.startsWith("cancelled")) label = "Sesi Dibatalkan";

    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 ${className}`}
      >
        <CheckCircle size={14} className="text-slate-400" />
        <span>{label}</span>
        <span className="font-mono text-[11px] text-slate-400">(00:00)</span>
      </div>
    );
  }

  // Sebelum waktu mulai sesi (start_at)
  if (nowMs < startMs) {
    const diffSec = Math.max(0, Math.floor((startMs - nowMs) / 1000));
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    const timeFormatted = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 ${className}`}
      >
        <Hourglass size={14} className="animate-spin text-amber-600 dark:text-amber-400" />
        <span>Sesi dimulai dalam</span>
        <span className="font-mono font-bold">{timeFormatted}</span>
      </div>
    );
  }

  // Saat sesi sedang berlangsung
  const diffSec = Math.floor((endMs - nowMs) / 1000);
  const isExpired = diffSec <= 0;

  if (isExpired) {
    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold bg-rose-50 dark:bg-rose-950/70 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 ${className}`}
      >
        <AlertTriangle size={14} className="text-rose-600 dark:text-rose-400" />
        <span>Waktu Sesi Berakhir</span>
        <span className="font-mono">00:00</span>
      </div>
    );
  }

  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  const timeFormatted = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  const isCritical = diffSec <= 300; // <= 5 menit
  const isWarning = diffSec <= 600 && !isCritical; // 5-10 menit

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
        isCritical
          ? "bg-rose-50 dark:bg-rose-950/80 border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-200 animate-pulse"
          : isWarning
          ? "bg-amber-50 dark:bg-amber-950/70 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200"
          : "bg-teal-50 dark:bg-teal-950/60 border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-200"
      } ${className}`}
    >
      <Clock size={14} className={isCritical ? "text-rose-600" : isWarning ? "text-amber-600" : "text-teal-600"} />
      <span>Sisa Waktu Sesi:</span>
      <span className="font-mono text-sm tracking-tight">{timeFormatted}</span>
      {extensionStatus === "approved" && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-teal-200/80 dark:bg-teal-800/80 text-teal-900 dark:text-teal-100 font-bold">
          +10m
        </span>
      )}
    </div>
  );
}
