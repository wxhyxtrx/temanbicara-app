"use client";

import React, { useState } from "react";
import { AlertTriangle, Loader2, ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface CrisisReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (note?: string) => Promise<void>;
  isLoading?: boolean;
  targetName?: string;
  role: "psikolog" | "relawan";
}

export function CrisisReportModal({
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
  targetName,
  role,
}: CrisisReportModalProps) {
  const [note, setNote] = useState("");

  const handleClose = (newOpen: boolean) => {
    if (isLoading) return;
    if (!newOpen) {
      setNote("");
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    await onSubmit(note.trim() || undefined);
  };

  const isPsikolog = role === "psikolog";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md w-full font-nunito p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1.5 text-left">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800 flex items-center justify-center shrink-0">
              <ShieldAlert size={18} />
            </div>
            <DialogTitle className="text-base font-bold font-heading text-slate-900 dark:text-white">
              Laporkan Eskalasi Krisis
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed pt-1">
            Gunakan pelaporan ini jika {targetName ? `pasien (${targetName})` : "pasien"} menunjukkan indikasi risiko bahaya keselamatan akut (seperti ideasi bunuh diri atau melukai diri).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Penjelasan Konsekuensi Pelaporan */}
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/40 p-3 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200">
              <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Konsekuensi Pelaporan:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed pl-1">
              <li>Peringatan darurat akan diteruskan ke tim Admin TemanBicara untuk keperluan audit &amp; kontak darurat.</li>
              <li>Pasien akan otomatis menerima rujukan hotline darurat nasional (119 ext 8 &amp; 112) bernada suportif.</li>
              <li>Sesi percakapan tetap berlangsung dengan mengedepankan empati dan keselamatan pasien.</li>
            </ul>
          </div>

          {/* Input Catatan Observasi */}
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <label
                htmlFor="crisis_note"
                className="font-semibold text-slate-700 dark:text-slate-300"
              >
                {isPsikolog ? "Catatan Observasi Klinis" : "Catatan Observasi Situasi"}{" "}
                <span className="text-slate-400 font-normal">(Opsional)</span>
              </label>
              <span className="text-[10px] text-slate-400">
                {note.length}/500
              </span>
            </div>

            <textarea
              id="crisis_note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={3}
              disabled={isLoading}
              placeholder={
                isPsikolog
                  ? "Tuliskan observasi singkat risiko keselamatan pasien demi koordinasi tim medis/admin..."
                  : "Tuliskan konteks situasi krisis yang teramati pada obrolan curhat..."
              }
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-rose-500 resize-none transition-all disabled:opacity-50"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 flex flex-col-reverse sm:flex-row">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={() => handleClose(false)}
              className="text-xs rounded-xl cursor-pointer w-full sm:w-auto"
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isLoading}
              className="text-xs bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold shadow-xs cursor-pointer w-full sm:w-auto"
            >
              {isLoading ? (
                <>
                  <Loader2 size={13} className="animate-spin mr-1.5 shrink-0" />
                  <span>Mengirim Laporan...</span>
                </>
              ) : (
                <>
                  <ShieldAlert size={13} className="mr-1.5 shrink-0" />
                  <span>Kirim Laporan Krisis</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
