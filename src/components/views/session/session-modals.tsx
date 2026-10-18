"use client";

import React from "react";
import { Coins, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SessionModalsProps {
  extensionModalOpen: boolean;
  setExtensionModalOpen: (val: boolean) => void;
  isRequestingExtension: boolean;
  onRequestExtension: () => void;
  extensionPriceCoins: number | null;

  endSessionModalOpen: boolean;
  setEndSessionModalOpen: (val: boolean) => void;
  isEndingSession: boolean;
  onEndSession: () => void;
  patientDisplayName: string;
}

export function SessionModals({
  extensionModalOpen,
  setExtensionModalOpen,
  isRequestingExtension,
  onRequestExtension,
  extensionPriceCoins,
  endSessionModalOpen,
  setEndSessionModalOpen,
  isEndingSession,
  onEndSession,
  patientDisplayName,
}: SessionModalsProps) {
  return (
    <>
      {/* Confirmation Dialog: Pasien Ajukan Ekstensi */}
      <Dialog open={extensionModalOpen} onOpenChange={setExtensionModalOpen}>
        <DialogContent className="max-w-md font-nunito p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold font-heading text-slate-900 dark:text-white flex items-center gap-2">
              <Coins className="text-amber-500" size={18} />
              <span>Ajukan Perpanjangan Sesi</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed pt-2">
              Anda akan mengajukan perpanjangan durasi sesi konseling sebesar{" "}
              <strong className="text-slate-800 dark:text-slate-200">+10 Menit</strong>.
              Biaya ekstensi sebesar{" "}
              <strong className="text-amber-600 font-bold">
                {extensionPriceCoins || 10} Koin
              </strong>{" "}
              akan didebit dari dompet Anda setelah psikolog menyetujui permintaan ini.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isRequestingExtension}
              onClick={() => setExtensionModalOpen(false)}
              className="text-xs rounded-xl"
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isRequestingExtension}
              onClick={onRequestExtension}
              className="text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold shadow-xs"
            >
              {isRequestingExtension ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                "Kirim Permintaan (+10m)"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog: Psikolog Akhiri Sesi */}
      <Dialog open={endSessionModalOpen} onOpenChange={setEndSessionModalOpen}>
        <DialogContent className="max-w-md font-nunito p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold font-heading text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="text-rose-600" size={18} />
              <span>Akhiri Sesi Konseling</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed pt-2">
              Apakah Anda yakin ingin menyelesaikan dan mengakhiri sesi konseling dengan{" "}
              <strong>{patientDisplayName}</strong>? Setelah diakhiri, ruang obrolan akan beralih ke mode hanya-baca dan penerimaan honor sesi akan segera diselesaikan ke saldo Anda.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isEndingSession}
              onClick={() => setEndSessionModalOpen(false)}
              className="text-xs rounded-xl"
            >
              Lanjutkan Sesi
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isEndingSession}
              onClick={onEndSession}
              className="text-xs bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold shadow-xs"
            >
              {isEndingSession ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                "Ya, Akhiri Sesi"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
