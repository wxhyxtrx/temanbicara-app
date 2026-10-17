"use client";

import React, { useState } from "react";
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
  Coins,
  Clock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import type { PatientBookingView } from "@/types/booking";
import {
  formatWibDateFull,
  formatWibTime,
  formatRupiah,
} from "@/lib/booking-utils";
import { bookingClient, BookingApiError } from "@/services/booking.client";

interface ChooseRefundModalProps {
  booking: PatientBookingView | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (refundCoins: number) => void;
}

export function ChooseRefundModal({
  booking,
  isOpen,
  onClose,
  onSuccess,
}: ChooseRefundModalProps) {
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!booking) return null;

  const psychName = booking.psikolog?.nama_lengkap_gelar || "Psikolog Terverifikasi";

  const handleConfirmRefund = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await bookingClient.chooseRefund(booking.id);
      if (res?.success) {
        onSuccess(booking.price_coins);
        onClose();
      }
    } catch (err: unknown) {
      console.error("Gagal memproses pilihan refund:", err);
      if (err instanceof BookingApiError) {
        setErrorMessage(err.message || "Gagal memproses refund");
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Terjadi kesalahan sistem saat memproses refund");
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
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Coins size={18} />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold font-heading text-slate-900 dark:text-white">
                Konfirmasi Refund 100% Koin
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                Koin akan dikembalikan penuh ke saldo akun Anda
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Sesi info */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Psikolog:</span>
              <span className="font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                {psychName}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Jadwal Sebelumnya:</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {formatWibDateFull(booking.start_at)}, {formatWibTime(booking.start_at)}
              </span>
            </div>
            {booking.choice_deadline_at && (
              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Clock size={12} className="text-amber-600" />
                  Batas Waktu Pilihan:
                </span>
                <span className="font-semibold text-amber-800 dark:text-amber-300">
                  {formatWibDateFull(booking.choice_deadline_at)}, {formatWibTime(booking.choice_deadline_at)}
                </span>
              </div>
            )}
          </div>

          {/* Refund Box */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-emerald-50/50 dark:from-amber-950/40 dark:to-emerald-950/30 border border-amber-200 dark:border-amber-800 space-y-2 text-center">
            <span className="text-[11px] font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider block">
              Jumlah Koin yang Dikembalikan (100% Penuh):
            </span>
            <div className="flex items-center justify-center gap-1.5 text-2xl font-black font-mono text-emerald-700 dark:text-emerald-300">
              <Coins size={24} />
              <span>+{booking.price_coins} Koin</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Setara {formatRupiah(booking.price_coins * 10000)} langsung masuk ke saldo dompet tanpa potongan komitmen karena pembatalan dilakukan oleh pihak psikolog.
            </p>
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
              onClick={handleConfirmRefund}
              disabled={submitting}
              className="text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-xl h-8 px-4 font-semibold shadow-xs gap-1.5"
            >
              {submitting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Memproses Refund...</span>
                </>
              ) : (
                <>
                  <Coins size={13} />
                  <span>Ambil Refund 100%</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
