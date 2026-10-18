"use client";

import React from "react";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SessionNotesPlaceholderProps {
  isOpen: boolean;
  patientDisplayName: string;
}

export function SessionNotesPlaceholder({
  isOpen,
  patientDisplayName,
}: SessionNotesPlaceholderProps) {
  if (!isOpen) return null;

  return (
    <aside className="w-80 shrink-0 border-l border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex flex-col hidden lg:flex font-nunito">
      <div className="p-3.5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-teal-700 dark:text-teal-400" />
          <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200">
            Catatan Klien (SOAP)
          </h2>
        </div>
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
        >
          Slot B7
        </Badge>
      </div>

      {/* Placeholder Content */}
      <div className="flex-1 p-4 flex flex-col items-center justify-center text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-teal-100/60 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 flex items-center justify-center">
          <FileText size={22} />
        </div>
        <div className="space-y-1 max-w-[220px]">
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
            Panel Catatan Klinis
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-nunito">
            Pencatatan SOAP, riwayat diagnosa, dan observasi klinis pasien akan hadir di sini saat modul backend B7 diintegrasikan.
          </p>
        </div>
        <div className="text-[10px] text-slate-400 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-2.5 max-w-[230px] text-left">
          <span className="font-semibold block text-slate-600 dark:text-slate-300 mb-0.5">
            Privasi Pasien:
          </span>
          Hanya nama panggilan ({patientDisplayName}) dan keluhan yang dapat diakses oleh psikolog.
        </div>
      </div>
    </aside>
  );
}
