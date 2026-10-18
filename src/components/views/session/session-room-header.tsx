"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Coins, XCircle, PanelRightClose, PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SessionTimer } from "./session-timer";
import { formatWibTime, getInitials } from "@/lib/booking-utils";
import type {
  BookingStatus,
  ExtensionStatus,
  PatientBookingView,
  PsikologBookingView,
} from "@/types/booking";

interface SessionRoomHeaderProps {
  role: "pasien" | "psikolog";
  booking: PatientBookingView | PsikologBookingView;
  isReadOnly: boolean;
  partnerName: string;
  isNotesPanelOpen: boolean;
  onToggleNotesPanel: () => void;
  onRequestExtensionOpen: () => void;
  onEndSessionOpen: () => void;
}

export function SessionRoomHeader({
  role,
  booking,
  isReadOnly,
  partnerName,
  isNotesPanelOpen,
  onToggleNotesPanel,
  onRequestExtensionOpen,
  onEndSessionOpen,
}: SessionRoomHeaderProps) {
  return (
    <header className="shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 px-4 py-2.5 flex items-center justify-between gap-3 font-nunito">
      <div className="flex items-center gap-3 min-w-0">
        <Link
          href={role === "psikolog" ? "/counselor/beranda" : "/patient/schedule"}
          className="p-1.5 -ml-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors shrink-0"
          title="Keluar Ruang Sesi"
        >
          <ArrowLeft size={18} />
        </Link>

        {/* Avatar & Display Name (Psikolog strictly only sees patient_display_name) */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200 font-bold text-xs flex items-center justify-center shrink-0 border border-teal-200/80 dark:border-teal-700/80">
            {getInitials(partnerName)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-bold font-heading text-slate-900 dark:text-white truncate">
                {partnerName}
              </h1>
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-4 font-normal bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800"
              >
                {role === "psikolog" ? "Pasien" : "Psikolog"}
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              Mulai: {formatWibTime(booking.start_at)} WIB
            </p>
          </div>
        </div>
      </div>

      {/* Timer Sisa Waktu & Action Buttons */}
      <div className="flex items-center gap-2 shrink-0">
        <SessionTimer
          startAt={booking.start_at}
          extensionStatus={booking.extension_status}
          status={booking.status}
        />

        {/* Patient Action: Ajukan Ekstensi */}
        {role === "pasien" && !isReadOnly && (
          booking.extension_status === "requested" ? (
            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-300 text-xs py-1 px-2.5">
              Menunggu Persetujuan Psikolog
            </Badge>
          ) : booking.extension_status === "approved" ? (
            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 border-emerald-300 text-xs py-1 px-2.5">
              +10 Menit Disetujui
            </Badge>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onRequestExtensionOpen}
              className="text-xs h-8 rounded-xl border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/50 gap-1.5 cursor-pointer"
            >
              <Coins size={13} className="text-amber-500" />
              <span className="hidden sm:inline">Tambah Waktu (+10m)</span>
              <span className="sm:hidden">+10m</span>
            </Button>
          )
        )}

        {/* Counselor Actions: Akhiri Sesi & Toggle Notes Panel */}
        {role === "psikolog" && (
          <>
            {!isReadOnly && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onEndSessionOpen}
                className="text-xs h-8 rounded-xl border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 gap-1 cursor-pointer"
              >
                <XCircle size={13} />
                <span className="hidden sm:inline">Akhiri Sesi</span>
                <span className="sm:hidden">Akhiri</span>
              </Button>
            )}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onToggleNotesPanel}
              className="text-xs h-8 px-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 rounded-xl"
              title="Buka/Tutup Catatan Klien"
            >
              {isNotesPanelOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
