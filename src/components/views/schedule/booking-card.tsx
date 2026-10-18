"use client";

import React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar as CalendarIcon,
  Clock,
  Eye,
  RotateCcw,
  XCircle,
  Coins,
  AlertCircle,
  ArrowRight,
  ShieldAlert,
  Lock,
} from "lucide-react";
import { MdVerified } from "react-icons/md";
import type { PatientBookingView } from "@/types/booking";
import {
  formatWibDateFull,
  formatWibTime,
  getInitials,
  formatRupiah,
  BOOKING_STATUS_CONFIG,
  checkRescheduleEligibility,
  isBookingRoomActive,
} from "@/lib/booking-utils";

interface BookingCardProps {
  booking: PatientBookingView;
  onViewDetail: (booking: PatientBookingView) => void;
  onCancel?: (booking: PatientBookingView) => void;
  onReschedule?: (booking: PatientBookingView) => void;
  onChooseRefund?: (booking: PatientBookingView) => void;
}

export function BookingCard({
  booking,
  onViewDetail,
  onCancel,
  onReschedule,
  onChooseRefund,
}: BookingCardProps) {
  const psychName = booking.psikolog?.nama_lengkap_gelar || "Psikolog Terverifikasi";
  const initials = getInitials(psychName);
  const statusConfig = BOOKING_STATUS_CONFIG[booking.status] || {
    label: booking.status,
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
    description: "",
  };

  const isAwaitingChoice = booking.status === "awaiting_patient_choice";
  const isBooked = booking.status === "booked";
  const isInProgress = booking.status === "in_progress";
  const isRoomActive = isBookingRoomActive(booking);

  return (
    <div
      className={`p-4 sm:p-5 rounded-2xl border transition-all shadow-2xs space-y-4 ${
        isAwaitingChoice
          ? "border-amber-300 dark:border-amber-700/80 bg-gradient-to-br from-amber-50/40 via-white to-amber-50/20 dark:from-amber-950/20 dark:via-slate-900 dark:to-slate-900"
          : "border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-teal-300 dark:hover:border-teal-700"
      }`}
    >
      {/* Top Bar: Psychologist, Status, Badges */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="relative shrink-0">
            {booking.psikolog?.avatar_url ? (
              <img
                src={booking.psikolog.avatar_url}
                alt={psychName}
                className="w-12 h-12 rounded-xl object-cover border border-teal-200 dark:border-teal-800 shadow-xs"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-600 to-teal-800 text-white font-bold text-xs flex items-center justify-center font-heading border border-teal-200 dark:border-teal-800 shadow-xs">
                {initials}
              </div>
            )}
          </div>

          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="font-bold text-slate-900 dark:text-white text-sm font-heading truncate">
                {psychName}
              </p>
              <MdVerified className="text-sky-500 text-xs shrink-0" />
              <Badge className={`${statusConfig.badgeClass} text-[10px] font-semibold py-0.5 px-2`}>
                {statusConfig.label}
              </Badge>
              {booking.reschedule_count > 0 && (
                <Badge
                  variant="outline"
                  className="text-[10px] bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                >
                  Pernah dipindah 1x
                </Badge>
              )}
            </div>
            <p className="text-xs text-teal-700 dark:text-teal-400 font-medium truncate">
              {booking.psikolog?.spesialisasi.join(", ") || "Konseling Klinis Dewasa"}
            </p>
          </div>
        </div>

        {/* Schedule & Price Info */}
        <div className="flex flex-wrap sm:flex-col sm:items-end justify-between sm:justify-start gap-1 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
            <CalendarIcon size={13} className="text-teal-600 dark:text-teal-400 shrink-0" />
            <span>{formatWibDateFull(booking.start_at)}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-[11px]">
            <span className="flex items-center gap-1">
              <Clock size={12} className="text-teal-600 dark:text-teal-400 shrink-0" />
              {formatWibTime(booking.start_at)}
            </span>
            <span>•</span>
            <span className="font-bold text-teal-700 dark:text-teal-400 font-mono">
              {booking.price_coins} Koin
            </span>
          </div>
        </div>
      </div>

      {/* Middle: Keluhan Preview */}
      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 text-xs text-slate-600 dark:text-slate-300">
        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">
          Keluhan Sesi:
        </span>
        <p className="line-clamp-2 italic leading-relaxed">"{booking.keluhan}"</p>
      </div>

      {/* Special Banner Point 4: awaiting_patient_choice */}
      {isAwaitingChoice && (
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-200 space-y-2.5">
          <div className="flex items-start gap-2.5">
            <ShieldAlert size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold text-xs sm:text-sm">
                Psikolog Membatalkan Sesi
              </p>
              <p className="text-[11px] leading-relaxed text-amber-900/80 dark:text-amber-300/80">
                Psikolog berhalangan hadir pada jadwal ini. Anda dapat memilih untuk memindahkan sesi ke slot lain bersama psikolog ini (bebas biaya) atau meminta pengembalian 100% koin ke dompet.
              </p>
              {booking.choice_deadline_at && (
                <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-400 pt-0.5">
                  Batas waktu pilihan: {formatWibDateFull(booking.choice_deadline_at)}, {formatWibTime(booking.choice_deadline_at)}
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons for awaiting_patient_choice */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-200/80 dark:border-amber-800">
            {onReschedule && (
              <Button
                type="button"
                size="sm"
                onClick={() => onReschedule(booking)}
                className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl h-8 px-3.5 gap-1.5 shadow-2xs"
              >
                <RotateCcw size={13} />
                <span>Pindah Jadwal (Gratis)</span>
              </Button>
            )}

            {onChooseRefund && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onChooseRefund(booking)}
                className="text-xs border-amber-400 text-amber-900 dark:text-amber-200 hover:bg-amber-100/60 dark:hover:bg-amber-900/40 rounded-xl h-8 px-3.5 font-semibold gap-1.5"
              >
                <Coins size={13} />
                <span>Refund 100% ({booking.price_coins} Koin)</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Bottom Bar: Action Buttons & Badges */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          {/* Refund indicator if already refunded */}
          {booking.refund_coins > 0 && (
            <Badge className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-[11px] font-semibold py-0.5 px-2.5">
              Refund: +{booking.refund_coins} Koin
            </Badge>
          )}

          {/* Actions for booked status */}
          {isBooked && (
            <>
              {onReschedule && (() => {
                const eligibility = checkRescheduleEligibility(
                  booking.start_at,
                  booking.reschedule_count
                );
                return eligibility.eligible ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onReschedule(booking)}
                    className="text-xs border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl h-8 px-3 gap-1.5 cursor-pointer"
                  >
                    <RotateCcw size={12} />
                    <span>Pindah Jadwal</span>
                  </Button>
                ) : (
                  <div className="relative group inline-block">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled
                      title={eligibility.reason}
                      className="text-xs border-slate-200/60 dark:border-slate-800 text-slate-400 dark:text-slate-600 rounded-xl h-8 px-3 gap-1.5 cursor-not-allowed opacity-60"
                    >
                      <RotateCcw size={12} />
                      <span>Pindah Jadwal</span>
                    </Button>
                  </div>
                );
              })()}

              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onCancel(booking)}
                  className="text-xs border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl h-8 px-3 gap-1.5"
                >
                  <XCircle size={12} />
                  <span>Batalkan</span>
                </Button>
              )}
            </>
          )}
        </div>

        {/* Right side primary action */}
        <div className="flex flex-col items-end gap-1 ml-auto">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onViewDetail(booking)}
              className="text-xs border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl h-8 px-3 gap-1 cursor-pointer"
            >
              <Eye size={12} />
              <span>Detail</span>
            </Button>

            {(isBooked || isInProgress) && (
              isRoomActive ? (
                <Link href={`/patient/session/${booking.id}`}>
                  <Button
                    size="sm"
                    className="text-xs bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl h-8 px-3.5 gap-1.5 shadow-xs cursor-pointer"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                    <span>Masuk Sesi</span>
                  </Button>
                </Link>
              ) : (
                <Button
                  size="sm"
                  disabled
                  title="Ruang sesi dibuka 10 menit sebelum jadwal"
                  className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200/80 dark:border-slate-700/80 rounded-xl h-8 px-3.5 gap-1.5 cursor-not-allowed opacity-70"
                >
                  <Lock size={12} className="text-slate-400" />
                  <span>Masuk Sesi</span>
                </Button>
              )
            )}
          </div>
          {(isBooked || isInProgress) && !isRoomActive && (
            <span className="text-[10px] text-slate-400 dark:text-slate-500 text-right">
              Ruang sesi dibuka 10 menit sebelum jadwal
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
