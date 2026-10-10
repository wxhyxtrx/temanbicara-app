"use client";

import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Clock,
  AlertCircle,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  X,
  Hourglass,
  Bell,
} from "lucide-react";

interface SessionTimerBarProps {
  initialMinutes?: number;
  sessionTitle?: string;
  isCounselor?: boolean;
  onSessionFinish?: () => void;
}

export function SessionTimerBar({
  initialMinutes = 48,
  sessionTitle = "Sesi Konseling Aktif",
  isCounselor = false,
  onSessionFinish,
}: SessionTimerBarProps) {
  const [secondsLeft, setSecondsLeft] = useState<number>(initialMinutes * 60);
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [dismissedNotice, setDismissedNotice] = useState<boolean>(false);

  useEffect(() => {
    if (!isRunning || secondsLeft <= 0) return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, secondsLeft]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const isCritical = secondsLeft <= 300; // Sisa 5 menit
  const isWarning = secondsLeft <= 600 && !isCritical; // 10 menit - 5 menit

  return (
    <div className="w-full space-y-2 font-nunito transition-all duration-300">
      {/* 1. Timer Strip */}
      <div
        className={`flex items-center justify-between px-3 sm:px-4 py-2 rounded-xl border text-xs transition-colors ${
          isCritical
            ? "bg-rose-50 dark:bg-rose-950/70 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 shadow-xs"
            : isWarning
            ? "bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200"
            : "bg-teal-50/80 dark:bg-teal-950/60 border-teal-200/90 dark:border-teal-800 text-teal-900 dark:text-teal-200"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              isCritical
                ? "bg-rose-500 animate-ping"
                : isRunning
                ? "bg-emerald-500 animate-pulse"
                : "bg-slate-400"
            }`}
          />
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-bold text-[11px] sm:text-xs tracking-tight truncate">
              {sessionTitle}
            </span>
            <span className="hidden sm:inline text-slate-400">•</span>
            <span className="hidden sm:inline text-[11px] text-slate-500 dark:text-slate-400 font-normal">
              Batas Durasi 60 Menit
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Digital Countdown Display */}
          <div
            className={`flex items-center gap-1 font-mono font-bold px-2.5 py-1 rounded-lg text-xs sm:text-sm border ${
              isCritical
                ? "bg-rose-100 dark:bg-rose-900 border-rose-300 text-rose-800 dark:text-rose-100 animate-pulse"
                : isWarning
                ? "bg-amber-100 dark:bg-amber-900 border-amber-300 text-amber-800 dark:text-amber-100"
                : "bg-white dark:bg-slate-900 border-teal-200 dark:border-teal-700 text-teal-900 dark:text-teal-100 shadow-2xs"
            }`}
          >
            <Clock size={13} className="shrink-0" />
            <span>{formattedTime}</span>
          </div>

          {/* Pause / Play Toggle for Counselor */}
          {isCounselor && (
            <button
              type="button"
              onClick={() => setIsRunning(!isRunning)}
              className="p-1 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              title={isRunning ? "Jeda Timer" : "Lanjutkan Timer"}
            >
              {isRunning ? <Pause size={14} /> : <Play size={14} />}
            </button>
          )}

          {/* End Session Button if provided */}
          {onSessionFinish && (
            <Button
              type="button"
              size="sm"
              onClick={onSessionFinish}
              className={`h-7 px-2.5 text-[11px] font-semibold rounded-lg shadow-2xs cursor-pointer ${
                isCritical
                  ? "bg-rose-600 hover:bg-rose-700 text-white"
                  : "bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white"
              }`}
            >
              Akhiri Sesi
            </Button>
          )}
        </div>
      </div>

      {/* 2. Wrap-up Alert Banner at 5 Minutes Remaining */}
      {isCritical && !dismissedNotice && (
        <div className="flex items-start justify-between gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs animate-in slide-in-from-top-1">
          <div className="flex items-start gap-2 min-w-0">
            <Bell size={15} className="text-amber-600 shrink-0 mt-0.5 animate-bounce" />
            <div className="space-y-0.5">
              <p className="font-bold">Sisa 5 Menit Terakhir Sesi Konseling!</p>
              <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed font-nunito">
                {isCounselor
                  ? "Waktunya merumuskan kesimpulan refleksi bersama klien, mengonfirmasi kondisi afek terakhir, dan menyepakati tugas mandiri (Plan) sebelum sesi berakhir."
                  : "Sesi konseling akan segera selesai. Jangan ragu menanyakan tugas mandiri atau poin refleksi penting sebelum meninggalkan ruang konseling."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setDismissedNotice(true)}
            className="p-1 text-amber-600 hover:text-amber-900 cursor-pointer shrink-0"
            title="Tutup Pengingat"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
