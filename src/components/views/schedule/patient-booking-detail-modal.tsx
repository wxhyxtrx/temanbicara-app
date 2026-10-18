"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar as CalendarIcon,
  Clock,
  ShieldCheck,
  FileText,
  AlertCircle,
  Coins,
  RotateCcw,
  Sparkles,
  Lock,
} from "lucide-react";
import { MdVerified } from "react-icons/md";
import Link from "next/link";
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

interface PatientBookingDetailModalProps {
  booking: PatientBookingView | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenCancel?: (booking: PatientBookingView) => void;
  onOpenReschedule?: (booking: PatientBookingView) => void;
  onOpenChooseRefund?: (booking: PatientBookingView) => void;
  onRebook?: (booking: PatientBookingView) => void;
}

export function PatientBookingDetailModal({
  booking,
  isOpen,
  onClose,
  onOpenCancel,
  onOpenReschedule,
  onOpenChooseRefund,
  onRebook,
}: PatientBookingDetailModalProps) {
  if (!booking) return null;

  const psychName = booking.psikolog?.nama_lengkap_gelar || "Psikolog Terverifikasi";
  const initials = getInitials(psychName);
  const statusConfig = BOOKING_STATUS_CONFIG[booking.status] || {
    label: booking.status,
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
    description: "Status sesi konseling",
  };

  const isUpcoming =
    booking.status === "booked" ||
    booking.status === "in_progress" ||
    booking.status === "awaiting_patient_choice";
  const isRoomActive = isBookingRoomActive(booking);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-lg max-h-[92vh] overflow-y-auto overflow-x-hidden font-nunito p-4 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-2xl">
        <DialogHeader className="space-y-1 pb-3 border-b border-slate-100 dark:border-slate-800 w-full min-w-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-400 flex items-center justify-center shrink-0">
                <FileText size={16} />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold font-heading text-slate-900 dark:text-white">
                  Detail Reservasi Konseling
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  ID: {booking.id.slice(0, 8)}...{booking.id.slice(-4)}
                </DialogDescription>
              </div>
            </div>
            <Badge className={`${statusConfig.badgeClass} text-xs font-semibold py-0.5 px-2.5`}>
              {statusConfig.label}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2 w-full min-w-0">
          {/* Status Explanation Banner */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2">
            <ShieldCheck size={16} className="text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{statusConfig.description}</p>
          </div>

          {/* Psikolog Profile */}
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
            <div className="relative shrink-0">
              {booking.psikolog?.avatar_url ? (
                <img
                  src={booking.psikolog.avatar_url}
                  alt={psychName}
                  className="w-12 h-12 rounded-xl object-cover border border-teal-200 dark:border-teal-800 shadow-xs"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-600 to-teal-800 text-white font-bold text-sm flex items-center justify-center font-heading border border-teal-200 dark:border-teal-800 shadow-xs">
                  {initials}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h4 className="font-heading font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                  {psychName}
                </h4>
                <MdVerified className="text-sky-500 text-sm shrink-0" />
              </div>
              <p className="text-xs text-teal-700 dark:text-teal-400 font-medium truncate">
                {booking.psikolog?.spesialisasi.join(", ") || "Konseling Klinis Dewasa"}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {booking.psikolog?.nomor_sipp_str
                  ? `SIPPK: ${booking.psikolog.nomor_sipp_str}`
                  : "SIPPK Terverifikasi HIMPSI"}
              </p>
            </div>
          </div>

          {/* Schedule & Price Box */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 space-y-1">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                Jadwal Konseling (WIB)
              </span>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                <CalendarIcon size={14} className="text-teal-600 dark:text-teal-400 shrink-0" />
                <span>{formatWibDateFull(booking.start_at)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                <Clock size={13} className="text-teal-600 dark:text-teal-400 shrink-0" />
                <span>{formatWibTime(booking.start_at)} (45 Menit)</span>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 space-y-1">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                Tarif Sesi
              </span>
              <div className="flex items-center gap-1.5 text-xs font-bold text-teal-700 dark:text-teal-400 font-mono">
                <Coins size={14} className="shrink-0" />
                <span>{booking.price_coins} Koin</span>
                <span className="text-slate-400 font-normal">({formatRupiah(booking.price_coins * 10000)})</span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {booking.reschedule_count > 0 ? (
                  <span className="text-amber-600 font-medium">Sudah dipindahkan 1 kali</span>
                ) : (
                  <span>Belum pernah dipindahkan</span>
                )}
              </div>
            </div>
          </div>

          {/* Keluhan Pasien */}
          <div className="space-y-1 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
              Keluhan yang Disampaikan
            </span>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed italic mt-0.5">
              "{booking.keluhan}"
            </p>
          </div>

          {/* Refund Result if Cancelled */}
          {booking.refund_coins > 0 && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins size={16} className="text-emerald-600 shrink-0" />
                <span>Koin Dikembalikan ke Dompet:</span>
              </div>
              <span className="font-bold font-mono text-sm">+{booking.refund_coins} Koin</span>
            </div>
          )}

          {/* Choice Deadline if Awaiting Choice */}
          {booking.status === "awaiting_patient_choice" && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-200 space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold text-xs">Psikolog Membatalkan Sesi</p>
                  <p className="text-[11px] leading-relaxed text-amber-900/80 dark:text-amber-300/80">
                    Sesi konseling ini dibatalkan oleh pihak psikolog. Anda berhak memindahkan jadwal ke slot lain tanpa biaya atau mengambil pengembalian penuh 100% koin.
                  </p>
                  {booking.choice_deadline_at && (
                    <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 pt-0.5">
                      Batas waktu pilihan: {formatWibDateFull(booking.choice_deadline_at)}, {formatWibTime(booking.choice_deadline_at)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800 w-full min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {booking.status === "awaiting_patient_choice" && (
                <>
                  {onOpenReschedule && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        onClose();
                        onOpenReschedule(booking);
                      }}
                      className="text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-xl h-8 px-3 font-semibold gap-1.5 shadow-2xs"
                    >
                      <RotateCcw size={13} />
                      <span>Pindah Jadwal (Gratis)</span>
                    </Button>
                  )}
                  {onOpenChooseRefund && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onClose();
                        onOpenChooseRefund(booking);
                      }}
                      className="text-xs border-amber-400 text-amber-900 dark:text-amber-200 hover:bg-amber-100/60 dark:hover:bg-amber-900/40 rounded-xl h-8 px-3 font-semibold gap-1.5"
                    >
                      <Coins size={13} />
                      <span>Refund 100%</span>
                    </Button>
                  )}
                </>
              )}

              {booking.status === "booked" && (
                <>
                  {onOpenReschedule && (() => {
                    const eligibility = checkRescheduleEligibility(
                      booking.start_at,
                      booking.reschedule_count
                    );
                    return eligibility.eligible ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          onClose();
                          onOpenReschedule(booking);
                        }}
                        className="text-xs border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl h-8 px-3 gap-1.5"
                      >
                        <RotateCcw size={13} />
                        <span>Pindah Jadwal</span>
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled
                        title={eligibility.reason}
                        className="text-xs border-slate-200/60 dark:border-slate-800 text-slate-400 dark:text-slate-600 rounded-xl h-8 px-3 gap-1.5 cursor-not-allowed opacity-60"
                      >
                        <RotateCcw size={13} />
                        <span>Pindah Jadwal</span>
                      </Button>
                    );
                  })()}
                  {onOpenCancel && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onClose();
                        onOpenCancel(booking);
                      }}
                      className="text-xs border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl h-8 px-3"
                    >
                      Batalkan Sesi
                    </Button>
                  )}
                </>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5 sm:gap-2 ml-auto">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  className="text-xs rounded-xl h-8 px-4 cursor-pointer"
                >
                  Tutup
                </Button>

                {(booking.status === "booked" || booking.status === "in_progress") && (
                  isRoomActive ? (
                    <Link href={`/patient/session/${booking.id}`} onClick={onClose}>
                      <Button
                        size="sm"
                        className="text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-xl h-8 px-4 font-semibold gap-1.5 shadow-xs cursor-pointer"
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
                      className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200/80 dark:border-slate-700/80 rounded-xl h-8 px-4 font-semibold gap-1.5 cursor-not-allowed opacity-70"
                    >
                      <Lock size={12} className="text-slate-400" />
                      <span>Masuk Sesi</span>
                    </Button>
                  )
                )}

                {booking.status === "completed" && (
                  <>
                    {onRebook && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          onClose();
                          onRebook(booking);
                        }}
                        className="text-xs border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/40 rounded-xl h-8 px-3 font-semibold gap-1.5 cursor-pointer"
                      >
                        <RotateCcw size={12} />
                        <span>Booking Lagi</span>
                      </Button>
                    )}
                    <Link href={`/patient/session/${booking.id}`} onClick={onClose}>
                      <Button
                        size="sm"
                        className="text-xs bg-slate-800 hover:bg-slate-900 dark:bg-slate-200 dark:hover:bg-white text-white dark:text-slate-900 rounded-xl h-8 px-4 font-semibold gap-1.5 shadow-xs cursor-pointer"
                      >
                        <span>Buka Ruang Sesi (Read-Only)</span>
                      </Button>
                    </Link>
                  </>
                )}
              </div>
              {(booking.status === "booked" || booking.status === "in_progress") && !isRoomActive && (
                <span className="text-[10px] text-slate-400 dark:text-slate-500 text-right">
                  Ruang sesi dibuka 10 menit sebelum jadwal
                </span>
              )}
              {booking.status === "completed" && (
                <span className="text-[10px] text-slate-400 dark:text-slate-500 text-right">
                  Sesi selesai • Riwayat percakapan bersifat read-only
                </span>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
