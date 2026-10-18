"use client";

import React, { useState } from "react";
import { FileText, ChevronDown, ChevronUp, Coins, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ExtensionStatus } from "@/types/booking";

interface SessionComplaintBannerProps {
  role: "pasien" | "psikolog";
  keluhan?: string;
  extensionStatus?: ExtensionStatus | null;
  isReadOnly: boolean;
  isRespondingExtension: boolean;
  onRespondExtension: (approve: boolean) => void;
  insufficientCoinsError: string | null;
  onDismissCoinsError: () => void;
}

export function SessionComplaintBanner({
  role,
  keluhan,
  extensionStatus,
  isReadOnly,
  isRespondingExtension,
  onRespondExtension,
  insufficientCoinsError,
  onDismissCoinsError,
}: SessionComplaintBannerProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  return (
    <>
      {/* 1. Banner Keluhan Pasien (Khusus Psikolog) */}
      {role === "psikolog" && keluhan && (
        <div className="shrink-0 bg-teal-50/90 dark:bg-teal-950/70 border-b border-teal-200/80 dark:border-teal-800/80 px-4 py-2 transition-all font-nunito">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 min-w-0">
              <FileText size={15} className="text-teal-700 dark:text-teal-400 shrink-0 mt-0.5" />
              <div className="min-w-0 text-xs">
                <span className="font-bold text-teal-900 dark:text-teal-200 mr-2">
                  Keluhan Pasien:
                </span>
                <span
                  className={`text-slate-700 dark:text-slate-300 leading-relaxed ${
                    !isExpanded ? "line-clamp-1" : ""
                  }`}
                >
                  {keluhan}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="text-teal-700 dark:text-teal-300 hover:text-teal-900 p-0.5 shrink-0 cursor-pointer"
              aria-label={isExpanded ? "Sembunyikan keluhan" : "Lihat keluhan lengkap"}
            >
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>
      )}

      {/* 2. Banner Notifikasi Ekstensi Menunggu Keputusan (Khusus Psikolog) */}
      {role === "psikolog" && extensionStatus === "requested" && !isReadOnly && (
        <div className="shrink-0 bg-amber-50 dark:bg-amber-950/80 border-b border-amber-300 dark:border-amber-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 animate-in fade-in font-nunito">
          <div className="flex items-center gap-2">
            <Coins size={16} className="text-amber-600 shrink-0" />
            <div className="text-xs text-amber-900 dark:text-amber-200">
              <span className="font-bold">Permintaan Perpanjangan Sesi: </span>
              Pasien mengajukan perpanjangan durasi sesi +10 menit.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={isRespondingExtension}
              onClick={() => onRespondExtension(false)}
              className="text-xs h-7 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg cursor-pointer"
            >
              Tolak
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isRespondingExtension}
              onClick={() => onRespondExtension(true)}
              className="text-xs h-7 px-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg shadow-xs cursor-pointer font-semibold"
            >
              {isRespondingExtension ? <Loader2 size={12} className="animate-spin" /> : "Setujui (+10m)"}
            </Button>
          </div>
        </div>
      )}

      {/* 3. Banner Error Insufficient Coins (Jika Ekstensi Ditolak Karena Saldo Kurang) */}
      {insufficientCoinsError && (
        <div className="shrink-0 bg-rose-50 dark:bg-rose-950/80 border-b border-rose-300 dark:border-rose-800 px-4 py-2 text-xs text-rose-800 dark:text-rose-200 flex items-center justify-between font-nunito">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="text-rose-600 shrink-0" />
            <span>{insufficientCoinsError}</span>
          </div>
          <button
            type="button"
            onClick={onDismissCoinsError}
            className="text-rose-600 font-bold text-xs p-1 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}
    </>
  );
}
