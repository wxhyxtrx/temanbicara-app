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
  AlertCircle,
  Coins,
  Clock,
  CheckCircle2,
  XCircle,
  Calendar as CalendarIcon,
  HelpCircle,
  Loader2,
} from "lucide-react";
import type { PatientBookingView } from "@/types/booking";
import {
  calculateEstimatedRefund,
  formatWibDateFull,
  formatWibTime,
  formatRupiah,
} from "@/lib/booking-utils";
import { bookingClient, BookingApiError } from "@/services/booking.client";

interface CancelBookingModalProps {
  booking: PatientBookingView | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (refundCoins: number) => void;
}

export function CancelBookingModal({
  booking,
  isOpen,
  onClose,
  onSuccess,
}: CancelBookingModalProps) {
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    refundCoins: number;
    burnedCoins: number;
  } | null>(null);

  // Hitung estimasi refund
  const refundEstimate = useMemo(() => {
    if (!booking) return null;
    return calculateEstimatedRefund(
      booking.start_at,
      booking.price_coins,
      booking.refund_policy
    );
  }, [booking]);

  if (!booking || !refundEstimate) return null;

  const psychName = booking.psikolog?.nama_lengkap_gelar || "Psikolog Terverifikasi";

  const handleConfirmCancel = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await bookingClient.cancelBooking(booking.id);
      if (res?.success) {
        const refunded =
          typeof (res.data as any)?.refund_coins === "number"
            ? (res.data as any).refund_coins
            : refundEstimate.refundCoins;

        const burned = Math.max(0, booking.price_coins - refunded);
        setSuccessResult({
          refundCoins: refunded,
          burnedCoins: burned,
        });
      }
    } catch (err: unknown) {
      console.error("Gagal membatalkan booking:", err);
      if (err instanceof BookingApiError) {
        setErrorMessage(err.message || "Gagal membatalkan sesi");
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Terjadi kesalahan sistem saat membatalkan sesi");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinish = () => {
    const refunded = successResult ? successResult.refundCoins : 0;
    setSuccessResult(null);
    setErrorMessage(null);
    onClose();
    onSuccess(refunded);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !submitting) {
          setSuccessResult(null);
          setErrorMessage(null);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-md font-nunito p-4 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-2xl">
        <DialogHeader className="space-y-1 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <XCircle size={18} />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold font-heading text-slate-900 dark:text-white">
                {successResult ? "Sesi Berhasil Dibatalkan" : "Batalkan Jadwal Sesi"}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                {successResult
                  ? "Pengembalian koin telah diproses ke saldo akun Anda"
                  : "Periksa estimasi pengembalian koin sebelum melanjutkan"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {successResult ? (
          /* SUCCESS VIEW: Tampilkan refund_coins dari response */
          <div className="space-y-4 pt-2 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 size={32} />
            </div>

            <div className="space-y-1">
              <h3 className="font-heading font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                Pembatalan Telah Selesai
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Sesi konseling bersama <span className="font-semibold text-slate-800 dark:text-slate-200">{psychName}</span> telah resmi dibatalkan.
              </p>
            </div>

            {/* Koin yang berhasil dikembalikan */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/40 border border-emerald-200 dark:border-emerald-800 space-y-1.5 text-center">
              <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block">
                Total Koin Dikembalikan:
              </span>
              <div className="flex items-center justify-center gap-1.5 text-2xl font-black font-mono text-emerald-700 dark:text-emerald-300">
                <Coins size={22} />
                <span>+{successResult.refundCoins} Koin</span>
              </div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                Setara {formatRupiah(successResult.refundCoins * 10000)} (Saldo dompet otomatis bertambah)
              </p>
              {successResult.burnedCoins > 0 && (
                <p className="text-[10px] text-slate-500 dark:text-slate-400 pt-1 border-t border-emerald-200/60 dark:border-emerald-800/60">
                  {successResult.burnedCoins} Koin terpotong sesuai tier waktu pembatalan.
                </p>
              )}
            </div>

            <Button
              type="button"
              onClick={handleFinish}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white rounded-xl h-9 text-xs font-semibold shadow-xs"
            >
              Selesai & Tutup
            </Button>
          </div>
        ) : (
          /* CONFIRMATION VIEW: ESTIMASI REFUND & SISA WAKTU */
          <div className="space-y-4 pt-2">
            {/* Sesi Info Strip */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Psikolog:</span>
                <span className="font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                  {psychName}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Jadwal Sesi:</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {formatWibDateFull(booking.start_at)}, {formatWibTime(booking.start_at)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Biaya Sesi:</span>
                <span className="font-bold text-teal-700 dark:text-teal-400 font-mono">
                  {booking.price_coins} Koin
                </span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Clock size={12} className="text-teal-600 dark:text-teal-400" />
                  Sisa Waktu:
                </span>
                <Badge
                  variant="outline"
                  className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-mono text-[11px]"
                >
                  {refundEstimate.hoursLeftFormatted}
                </Badge>
              </div>
            </div>

            {/* ESTIMASI PENGEMBALIAN KOIN BOX */}
            <div className="p-4 rounded-xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-900 dark:text-rose-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Coins size={14} className="text-rose-600 dark:text-rose-400" />
                  <span>Estimasi Pengembalian</span>
                </span>
                <Badge className="bg-rose-600 text-white font-mono text-xs">
                  {refundEstimate.refundPct}% Refund
                </Badge>
              </div>

              <div className="flex items-baseline justify-between pt-1">
                <span className="text-xs text-slate-600 dark:text-slate-300">
                  Koin Kembali ke Dompet:
                </span>
                <span className="text-lg font-black font-mono text-rose-700 dark:text-rose-300">
                  {refundEstimate.refundCoins} Koin
                </span>
              </div>

              {refundEstimate.burnedCoins > 0 && (
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-rose-200/60 dark:border-rose-900/60 pt-1.5">
                  <span>Koin Hangus (Biaya Komitmen):</span>
                  <span className="font-mono font-semibold text-rose-600">
                    -{refundEstimate.burnedCoins} Koin
                  </span>
                </div>
              )}
            </div>

            {/* ATURAN KEBIJAKAN REFUND TIER */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 text-[11px] space-y-1.5 text-slate-600 dark:text-slate-400">
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                <HelpCircle size={13} className="text-teal-600 dark:text-teal-400" />
                Ketentuan Kebijakan Pembatalan Pasien:
              </span>
              <ul className="space-y-1 pl-4 list-disc leading-relaxed">
                <li className={refundEstimate.minutesBefore >= 60 ? "font-bold text-emerald-700 dark:text-emerald-400" : ""}>
                  ≥ 60 menit sebelum sesi: Refund 100% koin
                </li>
                <li className={refundEstimate.minutesBefore >= 30 && refundEstimate.minutesBefore < 60 ? "font-bold text-amber-700 dark:text-amber-400" : ""}>
                  30 s/d 59 menit sebelum sesi: Refund 65% koin (dibulatkan ke atas)
                </li>
                <li className={refundEstimate.minutesBefore < 30 ? "font-bold text-rose-700 dark:text-rose-400" : ""}>
                  &lt; 30 menit sebelum sesi: Refund 0% (koin hangus)
                </li>
              </ul>
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
                Batal
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
                    <span>Ya, Batalkan Sesi</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
