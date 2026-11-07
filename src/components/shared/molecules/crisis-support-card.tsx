"use client";

import React from "react";
import { Heart, PhoneCall, ShieldCheck } from "lucide-react";

interface CrisisSupportCardProps {
  className?: string;
}

export function CrisisSupportCard({ className = "" }: CrisisSupportCardProps) {
  return (
    <div
      role="region"
      aria-label="Informasi Bantuan Darurat"
      className={`w-full rounded-2xl border border-rose-200/90 dark:border-rose-900/70 bg-gradient-to-br from-rose-50/90 via-amber-50/50 to-teal-50/70 dark:from-rose-950/40 dark:via-slate-900 dark:to-teal-950/40 p-3.5 sm:p-4 shadow-xs font-nunito min-w-0 ${className}`}
    >
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-300 flex items-center justify-center shrink-0 border border-rose-200 dark:border-rose-800">
          <Heart size={20} className="fill-rose-500/20 text-rose-600 dark:text-rose-400" />
        </div>

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <h3 className="text-xs sm:text-sm font-bold font-heading text-rose-950 dark:text-rose-100 truncate">
              Bantuan &amp; Dukungan Selalu Ada Untukmu
            </h3>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/70 text-rose-800 dark:text-rose-200 shrink-0">
              <ShieldCheck size={11} />
              <span>Privat &amp; 24 Jam</span>
            </span>
          </div>

          <p className="text-[11px] sm:text-xs text-slate-700 dark:text-slate-300 leading-relaxed break-words">
            Perasaanmu berharga, dan kamu tidak harus menanggung semuanya sendirian. Jika kamu sedang merasa sangat lelah, cemas, atau membutuhkan bantuan keselamatan saat ini, ada layanan profesional gratis dan rahasia yang siap mendampingimu:
          </p>

          {/* Kartu Kontak Hotline */}
          <div className="pt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
            {/* Hotline 119 Ext 8 */}
            <div className="rounded-xl bg-white/90 dark:bg-slate-900/90 border border-rose-200/80 dark:border-rose-900/50 p-2.5 flex flex-col justify-between gap-2 min-w-0">
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-1 min-w-0">
                  <span className="text-xs font-bold text-rose-700 dark:text-rose-300 truncate">
                    Hotline 119 ext 8
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
                    Kemenkes RI
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight mt-0.5 break-words">
                  Layanan Krisis Jiwa &amp; Pencegahan Bunuh Diri
                </p>
              </div>

              <a
                href="tel:119"
                className="inline-flex items-center justify-center gap-1.5 w-full h-7 sm:h-8 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold transition-colors shadow-2xs shrink-0 cursor-pointer"
                title="Panggil 119 ext 8"
              >
                <PhoneCall size={12} className="shrink-0" />
                <span className="truncate">Panggil 119 (ext 8)</span>
              </a>
            </div>

            {/* Hotline 112 */}
            <div className="rounded-xl bg-white/90 dark:bg-slate-900/90 border border-teal-200/80 dark:border-teal-900/50 p-2.5 flex flex-col justify-between gap-2 min-w-0">
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-1 min-w-0">
                  <span className="text-xs font-bold text-teal-700 dark:text-teal-300 truncate">
                    Panggilan Darurat 112
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
                    Bebas Pulsa
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight mt-0.5 break-words">
                  Layanan Darurat &amp; Medis Cepat Nasional
                </p>
              </div>

              <a
                href="tel:112"
                className="inline-flex items-center justify-center gap-1.5 w-full h-7 sm:h-8 px-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-semibold transition-colors shadow-2xs shrink-0 cursor-pointer"
                title="Panggil 112"
              >
                <PhoneCall size={12} className="shrink-0" />
                <span className="truncate">Panggil 112</span>
              </a>
            </div>
          </div>

          <p className="text-[10px] text-slate-500 dark:text-slate-400 italic pt-1">
            * Layanan hotline di atas dikelola resmi oleh instansi pemerintah dan dapat dihubungi 24 jam sehari.
          </p>
        </div>
      </div>
    </div>
  );
}
