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
import { Badge } from "@/components/ui/badge";
import { crisisClient, CrisisApiError } from "@/services/crisis.client";
import type { CrisisAlertItem } from "@/types/crisis";
import type { PatientEmergencyContactView } from "@/types/booking";
import {
  PhoneCall,
  ShieldAlert,
  Loader2,
  AlertTriangle,
  User,
  ExternalLink,
  Info,
} from "lucide-react";

interface CrisisEmergencyContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  alert: CrisisAlertItem | null;
}

export function CrisisEmergencyContactModal({
  isOpen,
  onClose,
  alert,
}: CrisisEmergencyContactModalProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [contactData, setContactData] = useState<PatientEmergencyContactView | null>(null);

  useEffect(() => {
    if (!isOpen || !alert) {
      setContactData(null);
      setError(null);
      setLoading(false);
      return;
    }

    let isCancelled = false;
    async function loadContact() {
      if (!alert) return;
      try {
        setLoading(true);
        setError(null);
        const res = await crisisClient.adminGetEmergencyContact(alert.patient_id, alert.id);
        if (isCancelled) return;
        if (res.success && res.data) {
          setContactData(res.data);
        } else {
          setError(res.error || "Gagal memuat kontak darurat pasien");
        }
      } catch (err: unknown) {
        if (isCancelled) return;
        const msg =
          err instanceof CrisisApiError
            ? err.message
            : err instanceof Error
            ? err.message
            : "Terjadi kesalahan saat memuat kontak darurat";
        setError(msg);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    loadContact();
    return () => {
      isCancelled = true;
    };
  }, [isOpen, alert]);

  const cleanWaNumber = (wa?: string | null) => {
    if (!wa) return "";
    let clean = wa.replace(/\D/g, "");
    if (clean.startsWith("0")) {
      clean = "62" + clean.slice(1);
    }
    return clean;
  };

  const waHref = contactData?.kontak_darurat_wa
    ? `https://wa.me/${cleanWaNumber(contactData.kontak_darurat_wa)}`
    : null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 font-nunito shadow-xl">
        <DialogHeader className="space-y-1.5">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <ShieldAlert size={20} className="shrink-0" />
            <DialogTitle className="text-base sm:text-lg font-bold font-heading text-slate-900 dark:text-white">
              Kontak Darurat Pasien
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
            Informasi kontak darurat pasien untuk protokol penanganan krisis keselamatan diri.
          </DialogDescription>
        </DialogHeader>

        {/* Audit Warning Banner */}
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/40 p-3 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
          <Info size={16} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0 space-y-0.5">
            <p className="font-semibold">Catatan Audit Keamanan</p>
            <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
              Akses ke kontak darurat ini dicatat dalam log audit resmi beserta identitas admin dan ID alert krisis.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 size={24} className="animate-spin text-teal-600" />
            <p className="text-xs">Mengambil data kontak darurat...</p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/80 dark:bg-rose-950/40 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Gagal Memuat Kontak</p>
              <p className="text-[11px]">{error}</p>
            </div>
          </div>
        ) : alert ? (
          <div className="space-y-3.5 py-1 min-w-0 text-xs">
            {/* Informasi Pasien & Kasus */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">Nama Pasien</span>
                <span className="font-bold text-slate-900 dark:text-white truncate">
                  {alert.patient_display_name}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">Sumber Sesi</span>
                <Badge
                  className={
                    alert.source === "booking"
                      ? "bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 text-[10px]"
                      : "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 text-[10px]"
                  }
                >
                  {alert.source === "booking" ? "Konseling Klinis" : "Ruang Curhat Sebaya"}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">ID Alert</span>
                <span className="font-mono text-[10px] text-slate-600 dark:text-slate-300 truncate max-w-[180px]">
                  {alert.id}
                </span>
              </div>
            </div>

            {/* Detail Kontak Darurat */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 bg-white dark:bg-slate-900">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-100 dark:border-slate-800 pb-2">
                <User size={15} className="text-teal-600 dark:text-teal-400" />
                <span>Data Kontak</span>
              </div>

              <div className="space-y-2">
                <div>
                  <span className="text-[11px] text-slate-400 block mb-0.5">Nama Kontak Darurat:</span>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {contactData?.kontak_darurat_nama?.trim() || (
                      <span className="text-slate-400 italic">Belum dicantumkan oleh pasien</span>
                    )}
                  </p>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 block mb-0.5">Nomor Telepon / WhatsApp:</span>
                  <p className="font-mono font-semibold text-slate-900 dark:text-white">
                    {contactData?.kontak_darurat_wa?.trim() || (
                      <span className="text-slate-400 italic font-sans font-normal">
                        Belum dicantumkan oleh pasien
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {waHref && (
                <div className="pt-2">
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition-colors"
                  >
                    <PhoneCall size={14} />
                    <span>Hubungi via WhatsApp</span>
                    <ExternalLink size={12} className="opacity-75" />
                  </a>
                </div>
              )}
            </div>
          </div>
        ) : null}

        <DialogFooter className="mt-2 sm:mt-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto text-xs rounded-xl"
          >
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
