"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { crisisClient, CrisisApiError } from "@/services/crisis.client";
import { notify } from "@/lib/toast";
import type { CrisisAlertItem } from "@/types/crisis";
import { CheckCircle2, AlertTriangle, Loader2, ShieldCheck, XCircle } from "lucide-react";

interface CrisisHandleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  alert: CrisisAlertItem | null;
  targetStatus: "handled" | "false_alarm";
  onSuccess: () => void;
}

export function CrisisHandleDialog({
  isOpen,
  onClose,
  alert,
  targetStatus,
  onSuccess,
}: CrisisHandleDialogProps) {
  const [adminNote, setAdminNote] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAdminNote("");
      setError(null);
      setLoading(false);
    }
  }, [isOpen]);

  const isHandled = targetStatus === "handled";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alert) return;

    try {
      setLoading(true);
      setError(null);
      const res = await crisisClient.adminUpdateAlert(alert.id, {
        status: targetStatus,
        admin_note: adminNote.trim() ? adminNote.trim() : undefined,
      });

      if (res.success) {
        notify.success(
          isHandled ? "Alarm Ditandai Ditangani" : "Alarm Ditandai Alarm Palsu",
          isHandled
            ? "Status alarm berhasil diperbarui dan catatan admin tersimpan."
            : "Alarm berhasil diklasifikasikan sebagai alarm palsu."
        );
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("crisis:refresh"));
        }
        onSuccess();
        onClose();
      } else {
        setError(res.error || "Gagal memperbarui status alarm");
      }
    } catch (err: unknown) {
      const msg =
        err instanceof CrisisApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat memproses pembaruan status alarm";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !loading && onClose()}>
      <DialogContent className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 font-nunito shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader className="space-y-1.5">
            <div
              className={`flex items-center gap-2 ${
                isHandled ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
              }`}
            >
              {isHandled ? <ShieldCheck size={20} /> : <XCircle size={20} />}
              <DialogTitle className="text-base sm:text-lg font-bold font-heading text-slate-900 dark:text-white">
                {isHandled ? "Tandai Kasus Ditangani" : "Tandai sebagai Alarm Palsu"}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {isHandled
                ? "Konfirmasi bahwa protokol intervensi krisis telah dilaksanakan bersama pasien atau kontak darurat."
                : "Klasifikasikan alarm ini sebagai alarm palsu jika pesan atau konteks bukan merupakan ancaman keselamatan diri nyata."}
            </DialogDescription>
          </DialogHeader>

          {alert && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Pasien:</span>
                <span className="font-bold text-slate-900 dark:text-white truncate">
                  {alert.patient_display_name}
                </span>
              </div>
              {alert.snippet && (
                <div className="pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                  <span className="text-slate-500 dark:text-slate-400 text-[11px] block">Potongan Pemicu:</span>
                  <p className="text-[11px] italic text-slate-700 dark:text-slate-300 font-mono mt-0.5 line-clamp-2">
                    &quot;{alert.snippet}&quot;
                  </p>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/80 dark:bg-rose-950/40 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">{error}</p>
            </div>
          )}

          {/* Input Catatan Admin */}
          <div className="space-y-1.5 text-xs">
            <label
              htmlFor="admin_note"
              className="block font-semibold text-slate-700 dark:text-slate-300"
            >
              Catatan Penanganan Admin{" "}
              <span className="text-slate-400 font-normal">(Opsional, maks. 1000 karakter)</span>
            </label>
            <textarea
              id="admin_note"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder={
                isHandled
                  ? "Contoh: Telah menghubungi kontak darurat pasien via WhatsApp dan mengarahkan ke layanan hotline 119."
                  : "Contoh: Pasien membicarakan lirik lagu / dialog novel, tidak ada indikasi bahaya keselamatan nyata."
              }
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500 resize-none transition-all"
            />
            <div className="flex justify-end text-[10px] text-slate-400">
              {adminNote.length}/1000
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={onClose}
              className="text-xs rounded-xl"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className={`text-xs rounded-xl font-semibold gap-1.5 ${
                isHandled
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-amber-600 hover:bg-amber-700 text-white"
              }`}
            >
              {loading ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : isHandled ? (
                <>
                  <CheckCircle2 size={13} />
                  <span>Konfirmasi Ditangani</span>
                </>
              ) : (
                <>
                  <AlertTriangle size={13} />
                  <span>Konfirmasi Alarm Palsu</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
