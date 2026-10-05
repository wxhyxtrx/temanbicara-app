"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/atoms/theme-toggle";
import {
  Home,
  MessageCircle,
  ArrowLeft,
  HeartPulse,
  Compass,
  Sparkles,
  Phone,
} from "lucide-react";
import { Logo } from "@/components/shared/atoms/Logo";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-nunito relative overflow-hidden select-none transition-colors duration-200">
      {/* Background Calming Sanctuary Ambient Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[720px] h-[360px] bg-gradient-to-b from-teal-100/50 via-teal-50/20 to-transparent dark:from-teal-950/30 dark:via-teal-950/10 blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-0 right-10 w-80 h-80 bg-teal-50/40 dark:bg-teal-900/10 rounded-full blur-2xl pointer-events-none -z-10" />

      {/* Header Bar */}
      <header className="px-5 sm:px-8 py-5 max-w-6xl w-full mx-auto flex items-center justify-between z-10">
        <Link href="/" className="hover:opacity-90 transition-opacity">
          <Logo size="md" showTagline />
        </Link>

        <div className="flex items-center gap-2.5">
          <Link
            href="/help-center"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors shadow-2xs"
          >
            <HeartPulse size={14} className="text-rose-600 dark:text-rose-400" />
            <span>Hotline 119</span>
          </Link>

          <ThemeToggle />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-10 z-10">
        <div className="max-w-xl w-full text-center space-y-7">
          {/* Visual Therapeutic Compass Illustration */}
          <div className="relative inline-block mx-auto">
            {/* Outer Soft Ring */}
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-teal-50/80 dark:bg-teal-950/60 border-2 border-teal-100/80 dark:border-teal-800 p-2 flex items-center justify-center mx-auto shadow-xs">
              {/* Inner Gradient Circle */}
              <div className="w-full h-full rounded-full bg-gradient-to-br from-teal-600 to-teal-800 text-white flex items-center justify-center shadow-lg border-2 border-white dark:border-slate-800 relative">
                <Compass size={44} className="text-teal-100 animate-spin [animation-duration:20s]" />
              </div>
            </div>

            {/* 404 Small Badge */}
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-700 text-teal-800 dark:text-teal-300 font-mono font-bold text-[11px] shadow-2xs">
              404
            </span>
          </div>

          {/* Copywriting Section with Balanced Rhythm */}
          <div className="space-y-3 max-w-md mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-950/60 border border-teal-200/80 dark:border-teal-800 text-teal-800 dark:text-teal-300 text-xs font-semibold tracking-wide">
              <Sparkles size={13} className="text-teal-600 dark:text-teal-400 shrink-0" />
              <span>Halaman Tidak Ditemukan</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-slate-900 dark:text-white tracking-tight leading-snug">
              Tarik Napas Sejenak,<br className="hidden sm:inline" />
              Kamu Tidak Tersesat.
            </h1>

            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-nunito px-2 sm:px-0">
              Halaman yang kamu cari mungkin telah dipindahkan atau tautan belum tersedia. Ambil jeda sejenak, mari kami pandu kembali ke ruang amanmu.
            </p>
          </div>

          {/* Navigation Action Buttons Group */}
          <div className="space-y-3.5 max-w-sm mx-auto pt-1">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
              <Link href="/beranda" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 text-white rounded-xl px-5 py-2.5 h-10 text-xs font-semibold shadow-xs gap-2 cursor-pointer">
                  <Home size={15} />
                  <span>Kembali ke Beranda</span>
                </Button>
              </Link>

              <Link href="/room" className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto border-slate-200 dark:border-slate-800 hover:border-teal-200 text-slate-700 dark:text-slate-200 hover:text-teal-800 dark:hover:text-white hover:bg-teal-50/50 dark:hover:bg-slate-900 bg-white dark:bg-slate-900/80 rounded-xl px-5 py-2.5 h-10 text-xs font-semibold shadow-2xs gap-2 cursor-pointer"
                >
                  <MessageCircle size={15} className="text-teal-600 dark:text-teal-400" />
                  <span>Ruang Curhat AI</span>
                </Button>
              </Link>
            </div>

            {/* Back to previous page link */}
            <div>
              <button
                type="button"
                onClick={() => window.history.back()}
                className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors inline-flex items-center gap-1.5 cursor-pointer py-1 font-medium"
              >
                <ArrowLeft size={13} />
                <span>Kembali ke halaman sebelumnya</span>
              </button>
            </div>
          </div>

          {/* Emergency Crisis Hotline Strip */}
          <div className="pt-6 border-t border-slate-200/70 dark:border-slate-800 max-w-md mx-auto">
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs flex items-center justify-between text-left gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <Phone size={14} />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <p className="font-bold text-xs text-slate-800 dark:text-white font-heading truncate">
                    Krisis Emosional Akut?
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-nunito truncate">
                    Bantuan 24 Jam Kemenkes SEJIWA
                  </p>
                </div>
              </div>

              <Link
                href="tel:119"
                className="shrink-0 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 !text-white font-bold text-xs transition-colors shadow-2xs"
              >
                119 (ext. 8)
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Subtle Copyright Footer */}
      <footer className="py-4 text-center text-[11px] text-slate-400 dark:text-slate-600 font-nunito z-10">
        © 2026 TemanBicara Healthcare Services • Berlisensi SIPPK & Standar Etika Medis HIMPSI
      </footer>
    </div>
  );
}
