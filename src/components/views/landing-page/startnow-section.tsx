import React from "react";
import Layouts from "@/components/shared/layouts";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, Sparkles, HeartPulse, ShieldCheck } from "lucide-react";

export default function StartNowSection() {
  return (
    <Layouts>
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-50 via-emerald-50/60 to-white dark:from-teal-950/50 dark:via-slate-900 dark:to-slate-950 border border-teal-200/80 dark:border-teal-800/60 p-8 sm:p-12 md:p-16 my-8 sm:my-12 shadow-sm">
        {/* Soft background soundwave patterns */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-40">
          <div className="absolute w-72 h-72 rounded-full border border-teal-300 dark:border-teal-700 -top-20 -left-20 opacity-30" />
          <div className="absolute w-96 h-96 rounded-full border border-emerald-300 dark:border-emerald-700 top-1/2 -right-20 transform -translate-y-1/2 opacity-25" />
          <div className="absolute w-48 h-48 rounded-full bg-teal-200/40 dark:bg-teal-700/20 bottom-0 left-1/3 blur-2xl" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8 md:gap-12">
          <div className="space-y-4 max-w-2xl text-center lg:text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 text-xs font-semibold shadow-xs">
              <Sparkles size={13} className="text-teal-600 dark:text-teal-400" />
              <span>Ruang Konseling & Terapi Mental</span>
            </div>

            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold font-heading text-slate-900 dark:text-white leading-tight">
              Langkah Pertama untuk Pulih Dimulai dengan Berbicara
            </h2>

            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 font-nunito leading-relaxed">
              Beri dirimu izin untuk merasa lebih tenang. Mulai sesi pertamamu bersama psikolog klinis atau luapkan perasaanmu ke AI pendengar empatik kapan pun kamu butuh.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
              <Link href="/register" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl px-8 py-6 text-base shadow-md shadow-teal-700/20 cursor-pointer gap-2">
                  Mulai Konseling Sekarang
                  <ArrowRight size={17} />
                </Button>
              </Link>
              <Link href="/login" className="w-full sm:w-auto">
                <Button variant="outline" size="lg" className="w-full sm:w-auto border-slate-300 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold rounded-xl px-7 py-6 text-base cursor-pointer">
                  Masuk ke Akun
                </Button>
              </Link>
            </div>
          </div>

          {/* Quick Care Indicator Card */}
          <div className="w-full lg:w-auto flex-shrink-0">
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-3 max-w-sm mx-auto">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-bold font-heading text-slate-900 dark:text-white">Privasi Terjamin 100%</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-nunito">Terenkripsi & Bebas Stigma</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-nunito leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-3">
                "Setiap percakapan di TemanBicara berada dalam suaka perlindungan etika profesi psikolog. Kamu memegang kendali atas apa yang ingin kamu bagikan."
              </p>
              <div className="pt-1 flex items-center gap-1.5 text-[11px] text-teal-700 dark:text-teal-400 font-semibold">
                <HeartPulse size={13} className="text-teal-600 dark:text-teal-400" />
                <span>Siap Mendampingi 24 Jam</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layouts>
  );
}
