"use client";

import React, { useState, useMemo } from "react";
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
  AlertTriangle,
  Clock,
  XCircle,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Calendar as CalendarIcon,
  User,
} from "lucide-react";
import type { PsikologBookingView } from "@/types/booking";
import {
  formatWibDateFull,
  formatWibTime,
} from "@/lib/booking-utils";
import { bookingClient, BookingApiError } from "@/services/booking.client";

interface CounselorCancelBookingModalProps {
  booking: PsikologBookingView | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CounselorCancelBookingModal({
  booking,
  isOpen,
  onClose,
  onSuccess,
}: CounselorCancelBookingModalProps) {
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Periksa apakah pembatalan dilakukan < 24 jam sebelum sesi
  const { isLateCancel, hoursLeftFormatted, diffHours } = useMemo(() => {
    if (!booking) return { isLateCancel: false, hoursLeftFormatted: "", diffHours: 0 };
    const now = Date.now();
    const startAt = new Date(booking.start_at).getTime();
    const diffMs = startAt - now;
    const diffH = diffMs / (3600 * 1000);

    let formatted = "";
    if (diffMs <= 0) {
      formatted = "Sesi telah melewati jam mulai";
    } else {
      const h = Math.floor(diffMs / (3600 * 1000));
      const m = Math.floor((diffMs % (3600 * 1000)) / (60 * 1000));
      formatted = `${h} jam ${m} menit lagi`;
    }

    return {
      isLateCancel: diffH < 24,
      hoursLeftFormatted: formatted,
      diffHours: diffH,
    };
  }, [booking]);

  if (!booking) return null;

  const handleConfirmCancel = async () => {
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await bookingClient.cancelBooking(booking.id);
      if (res?.success) {
        onSuccess();
        onClose();
      }
    } catch (err: unknown) {
      console.error("Gagal membatalkan booking (psikolog):", err);
      if (err instanceof BookingApiError) {
        setErrorMessage(err.message || "Gagal membatalkan jadwal booking");
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Terjadi kesalahan sistem saat membatalkan jadwal");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !submitting && onClose()}>
      <DialogContent className="max-w-md font-nunito p-4 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-2xl">
        <DialogHeader className="space-y-1 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <AlertTriangle size={18} />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold font-heading text-slate-900 dark:text-white">
                Batalkan Janji Temu Pasien
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                Konfirmasi pembatalan sesi konseling oleh psikolog
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* PERINGATAN STRIKE < 24 JAM */}
          {isLateCancel ? (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border-2 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 space-y-1.5 animate-in fade-in">
              <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-rose-700 dark:text-rose-300">
                <AlertTriangle size={17} className="shrink-0 text-rose-600" />
                <span>Peringatan Sanksi Strike Terhadap Akun</span>
              </div>
              <p className="text-xs font-semibold leading-relaxed">
                Membatalkan &lt; 24 jam sebelum sesi akan memberi 1 strike.
              </p>
              <p className="text-[11px] text-rose-800/80 dark:text-rose-300/80 leading-relaxed">
                Sisa waktu menuju sesi adalah <span className="font-mono font-bold">{hoursLeftFormatted}</span>. Akumulasi 3 poin strike dalam 30 hari akan menyebabkan penangguhan sementara izin praktik selama 7 hari kalender.
              </p>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 text-teal-900 dark:text-teal-200 space-y-1 text-xs">
              <p className="font-bold text-teal-800 dark:text-teal-300">
                Pembatalan Bebas Strike (&gt; 24 Jam)
              </p>
              <p className="text-[11px] leading-relaxed text-teal-800/80 dark:text-teal-300/80">
                Pembatalan diajukan lebih dari 24 jam sebelum sesi dimulai. Klien akan segera diberitahu dan diberikan pilihan untuk memindahkan slot atau mengambil refund 100%.
              </p>
            </div>
          )}

          {/* Ringkasan Sesi Pasien (Data Tersaring) */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Nama Pasien:</span>
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <User size={13} className="text-teal-600" />
                {booking.patient_display_name}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Jadwal Sesi:</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {formatWibDateFull(booking.start_at)}, {formatWibTime(booking.start_at)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Sisa Waktu:</span>
              <Badge
                variant="outline"
                className={`font-mono text-[11px] ${
                  isLateCancel
                    ? "bg-rose-50 text-rose-700 border-rose-300"
                    : "bg-slate-100 text-slate-700 border-slate-300"
                }`}
              >
                {hoursLeftFormatted}
              </Badge>
            </div>
            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Keluhan yang Dikirim Klien:
              </span>
              <p className="italic text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                "{booking.keluhan}"
              </p>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={submitting}
              className="text-xs rounded-xl h-8 px-4"
            >
              Kembali
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleConfirmCancel}
              disabled={submitting}
              className="text-xs bg-rose-600 hover:bg-rose-700 text-white rounded-xl h-8 px-4 font-semibold shadow-xs gap-1.5"
            >
              {submitting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Membatalkan...</span>
                </>
              ) : (
                <>
                  <XCircle size={13} />
                  <span>{isLateCancel ? "Batalkan (+1 Strike)" : "Batalkan Sesi"}</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
