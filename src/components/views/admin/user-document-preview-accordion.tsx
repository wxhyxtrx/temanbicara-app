"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileCheck2,
  FileText,
  Download,
  ExternalLink,
  AlertTriangle,
  FileX,
  Loader2,
  Info,
  ChevronDown,
} from "lucide-react";
import { notify } from "@/lib/toast";

interface UserDocumentPreviewAccordionProps {
  role: "psikolog" | "relawan" | string;
  userName: string;
  documentUrl?: string | null;
  licenseNumber?: string | null;
  isLoading?: boolean;
}

/**
 * Normalisasi URL dokumen: mendukung URL langsung (signed URL) atau data/blob URI
 */
function getResolvedDocUrl(rawUrl?: string | null): string | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed;
  }

  return null;
}

export function UserDocumentPreviewAccordion({
  role,
  userName,
  documentUrl,
  licenseNumber,
  isLoading = false,
}: UserDocumentPreviewAccordionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const resolvedUrl = getResolvedDocUrl(documentUrl);
  const hasDocument = Boolean(resolvedUrl);

  const isPsikolog = role === "psikolog";
  const docTypeLabel = isPsikolog ? "SIPP / STR" : "CV & Sertifikat";

  const isPdf = Boolean(
    resolvedUrl &&
      (resolvedUrl.toLowerCase().includes(".pdf") ||
        resolvedUrl.startsWith("data:application/pdf"))
  );
  const isImage = Boolean(
    resolvedUrl &&
      (resolvedUrl.toLowerCase().match(/\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i) ||
        resolvedUrl.startsWith("data:image/"))
  );

  const handleDownload = async () => {
    if (!resolvedUrl) return;
    setDownloading(true);
    try {
      const ext = isPdf ? "pdf" : isImage ? "png" : "pdf";
      const cleanName = (userName || "pengguna").replace(/[^a-zA-Z0-9_-]/g, "_");
      const filename = `Berkas_${isPsikolog ? "SIPP_STR" : "CV"}_${cleanName}.${ext}`;

      const res = await fetch(resolvedUrl);
      if (!res.ok) throw new Error("Gagal mengambil file");
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
      notify.success("Unduhan Berhasil", `Berkas ${filename} telah diunduh.`);
    } catch {
      // Fallback direct window download/open
      window.open(resolvedUrl, "_blank", "noopener,noreferrer");
      notify.info("Mengunduh", "Membuka dokumen pada tab baru untuk diunduh.");
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-3 rounded-xl border border-teal-100 dark:border-teal-900/40 bg-white/60 dark:bg-slate-900/60 flex items-center justify-center gap-2 text-xs text-slate-500">
        <Loader2 size={13} className="animate-spin text-teal-600" />
        <span>Memeriksa lampiran berkas dokumen...</span>
      </div>
    );
  }

  return (
    <div className="pt-1.5 border-t border-teal-100 dark:border-teal-900/40">
      <div className="border border-teal-200/90 dark:border-teal-900/70 rounded-xl overflow-hidden bg-white/80 dark:bg-slate-900/80 shadow-2xs">
        {/* Trigger Header */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between text-left cursor-pointer hover:bg-teal-50/40 dark:hover:bg-slate-800/40 transition-colors"
        >
          <div className="flex items-center gap-2">
            {hasDocument ? (
              <FileCheck2 size={15} className="text-teal-600 dark:text-teal-400 shrink-0" />
            ) : (
              <FileText size={15} className="text-amber-500 shrink-0" />
            )}
            <div>
              <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                Pratinjau Dokumen {docTypeLabel}
              </span>
              <span className="block text-[10px] font-normal text-slate-500 dark:text-slate-400">
                Syarat verifikasi kelayakan approval mitra
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasDocument ? (
              <Badge className="text-[10px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 shrink-0 font-semibold">
                Tersedia
              </Badge>
            ) : (
              <Badge className="text-[10px] bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 shrink-0 font-semibold">
                Tidak Tersedia
              </Badge>
            )}
            <ChevronDown
              size={15}
              className={`text-slate-400 transition-transform duration-200 shrink-0 ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </div>
        </button>

        {/* Content Body */}
        {isOpen && (
          <div className="px-3.5 pb-3.5 pt-1 space-y-3 border-t border-teal-100/60 dark:border-teal-900/40 animate-in fade-in duration-150">
            {hasDocument && resolvedUrl ? (
              <div className="space-y-3">
                {/* Header Action Bar: Download & Open */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-teal-50/60 dark:bg-teal-950/30 border border-teal-100 dark:border-teal-900/40">
                  <div className="flex items-center gap-1.5 text-[11px] text-teal-900 dark:text-teal-200 font-semibold">
                    <FileCheck2 size={13} className="text-teal-600" />
                    <span>Berkas Resmi Terlampir</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={downloading}
                      onClick={handleDownload}
                      className="h-7 text-[11px] gap-1 px-2.5 rounded-lg border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-200 hover:bg-teal-100/60 dark:hover:bg-teal-950 cursor-pointer font-semibold"
                    >
                      {downloading ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <Download size={11} />
                      )}
                      <span>Unduh Dokumen</span>
                    </Button>

                    <a
                      href={resolvedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 h-7 text-[11px] px-2.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-semibold shadow-2xs transition-colors"
                    >
                      <ExternalLink size={11} />
                      <span>Buka Tab Baru</span>
                    </a>
                  </div>
                </div>

                {/* Checklist Kriteria Approval */}
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-1.5 text-[11px]">
                  <div className="flex items-center gap-1 font-bold text-slate-700 dark:text-slate-200 text-[11px]">
                    <Info size={12} className="text-teal-600" />
                    <span>Panduan Validasi Syarat Approval:</span>
                  </div>
                  <ul className="space-y-1 text-slate-600 dark:text-slate-300 pl-4 list-disc text-[10px]">
                    <li>
                      Nama di dokumen wajib sesuai dengan <strong>{userName || "nama akun"}</strong>.
                    </li>
                    {isPsikolog && (
                      <li>
                        Nomor SIPPK/STR tercantum & valid:{" "}
                        <span className="font-mono font-semibold">{licenseNumber || "-"}</span>.
                      </li>
                    )}
                    <li>
                      Masa berlaku izin/dokumen masih aktif dan stempel/legalisir terbaca jelas.
                    </li>
                  </ul>
                </div>

                {/* Pratinjau Dokumen Kontainer */}
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>Pratinjau Langsung:</span>
                    <span className="text-[10px] text-slate-400">
                      {isPdf ? "Format Dokumen: PDF" : isImage ? "Format Dokumen: Gambar" : "Dokumen Web"}
                    </span>
                  </div>

                  {isImage ? (
                    <div className="w-full max-h-96 overflow-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-900/5 dark:bg-slate-950 flex items-center justify-center p-2">
                      <img
                        src={resolvedUrl}
                        alt="Pratinjau Berkas Kredensial"
                        className="max-h-80 w-auto rounded object-contain shadow-xs"
                      />
                    </div>
                  ) : (
                    <div className="relative w-full h-80 sm:h-96 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-inner">
                      <iframe
                        src={`${resolvedUrl}#toolbar=0&navpanes=0`}
                        title="Pratinjau Berkas Kredensial"
                        className="w-full h-full border-0"
                      />
                    </div>
                  )}

                  <p className="text-[10px] text-slate-400 text-center pt-0.5">
                    Jika pratinjau browser tidak muncul, klik &quot;Buka Tab Baru&quot; atau &quot;Unduh Dokumen&quot;.
                  </p>
                </div>
              </div>
            ) : (
              /* State saat berkas tidak tersedia */
              <div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/30 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={15} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-rose-900 dark:text-rose-200">
                      Dokumen {docTypeLabel} Tidak Tersedia
                    </p>
                    <p className="text-[11px] text-rose-800/80 dark:text-rose-300/80 leading-relaxed">
                      Dokumen fisik {docTypeLabel} tidak tersedia atau belum dilampirkan. Lampiran dokumen asli merupakan salah satu <strong>syarat wajib approval</strong> akun mitra.
                    </p>
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-rose-200/60 dark:border-rose-900/40 text-[10px] text-rose-700 dark:text-rose-300 flex items-center gap-1.5 font-medium">
                  <FileX size={12} className="shrink-0 text-rose-500" />
                  <span>Rekomendasi: Jangan setujui akun sebelum pendaftar melampirkan dokumen resmi yang sah.</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
