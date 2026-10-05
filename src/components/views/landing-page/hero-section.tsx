import Layouts from "@/components/shared/layouts";
import { Button } from "@/components/ui/button";
import React from "react";
import Link from "next/link";
import { ShieldCheck, MessageCircle, Calendar, Sparkles, HeartHandshake, Lock, Award, Clock } from "lucide-react";
import HeroVector from "./hero-vector";

export default function HeroSection() {
  return (
    <div className="relative pt-6 pb-16 md:pt-12 md:pb-24 overflow-hidden">
      {/* Background Soft Calming Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-teal-50/50 via-slate-50/30 to-white dark:from-teal-950/20 dark:via-slate-950/40 dark:to-slate-950 pointer-events-none" />

      <Layouts className="relative z-10 space-y-12 md:space-y-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          {/* Left Column: Value Proposition */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            {/* Clinical Trust Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-50 dark:bg-teal-950/60 border border-teal-200/80 dark:border-teal-800 text-teal-800 dark:text-teal-300 text-xs font-semibold shadow-xs">
              <span className="flex h-2 w-2 rounded-full bg-teal-600 animate-pulse" />
              <span>Layanan Konseling Psikologi & Suaka Kesehatan Mental</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[46px] xl:text-[54px] font-bold text-slate-900 dark:text-white leading-[1.18] tracking-tight font-heading">
              Ruang Tenang untuk Didengar, Dipahami, dan{" "}
              <span className="text-teal-600 dark:text-teal-400 relative inline-block">
                Pulih Kembali
                <svg
                  className="absolute left-0 -bottom-2 w-full h-3 text-teal-300/70 dark:text-teal-500/40 -z-10"
                  viewBox="0 0 100 12"
                  preserveAspectRatio="none"
                >
                  <path d="M0,8 Q50,0 100,8" stroke="currentColor" strokeWidth="4" fill="none" />
                </svg>
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 font-nunito leading-relaxed max-w-2xl mx-auto lg:mx-0">
              TemanBicara menghubungkanmu dengan psikolog klinis berlisensi (SIPPK) dan AI pendengar empatik 24/7. Curahkan isi hati tanpa rasa takut, tanpa stigma, dan dengan privasi 100% terenkripsi.
            </p>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 sm:gap-4 pt-2">
              <Link href="/register" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl px-7 py-6 text-base shadow-md shadow-teal-700/20 cursor-pointer gap-2">
                  <MessageCircle size={19} />
                  Mulai Konseling Sekarang
                </Button>
              </Link>
              <Link href="#features" className="w-full sm:w-auto">
                <Button variant="outline" size="lg" className="w-full sm:w-auto border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white text-slate-700 dark:text-slate-200 font-semibold rounded-xl px-6 py-6 text-base cursor-pointer gap-2">
                  <Calendar size={18} />
                  Lihat Pendekatan Terapi
                </Button>
              </Link>
            </div>

            {/* Micro Trust Indicators */}
            <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-4 sm:gap-6 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={16} className="text-teal-600 dark:text-teal-400" />
                <span>Privasi Terlindungi Kode Etik</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Lock size={15} className="text-teal-600 dark:text-teal-400" />
                <span>Bebas Pilih Mode Anonim</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Award size={15} className="text-teal-600 dark:text-teal-400" />
                <span>Psikolog Berizin Resmi</span>
              </div>
            </div>
          </div>

          {/* Right Column: High-End Vector Illustration */}
          <div className="lg:col-span-5 flex justify-center">
            <HeroVector />
          </div>
        </div>

        {/* Barometer / Social Proof Strip */}
        <div className="rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 p-5 sm:p-7 shadow-xs">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-800">
            <div className="pt-2 md:pt-0">
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white font-heading">15.000+</p>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-nunito mt-1 flex items-center justify-center gap-1">
                <HeartHandshake size={14} className="text-teal-600 dark:text-teal-400" /> Sesi Konseling Selesai
              </p>
            </div>
            <div className="pt-2 md:pt-0">
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white font-heading">100+</p>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-nunito mt-1 flex items-center justify-center gap-1">
                <Award size={14} className="text-teal-600 dark:text-teal-400" /> Psikolog & Konselor
              </p>
            </div>
            <div className="pt-2 md:pt-0">
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white font-heading">4.9 / 5.0</p>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-nunito mt-1 flex items-center justify-center gap-1">
                <Sparkles size={14} className="text-amber-500" /> Kepuasan Klien
              </p>
            </div>
            <div className="pt-2 md:pt-0">
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white font-heading">24/7</p>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-nunito mt-1 flex items-center justify-center gap-1">
                <Clock size={14} className="text-teal-600 dark:text-teal-400" /> Pendamping Emosional
              </p>
            </div>
          </div>
        </div>
      </Layouts>
    </div>
  );
}
