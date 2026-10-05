"use client";

import React from "react";
import { ShieldCheck, Heart, Sparkles, CheckCircle2, Star, TrendingDown } from "lucide-react";

export function HeroVector() {
  return (
    <div className="relative w-full max-w-[560px] mx-auto select-none">
      {/* Ambient Radial Therapy Glow */}
      <div className="absolute -top-12 -left-12 w-72 h-72 rounded-full bg-teal-200/40 dark:bg-teal-700/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -right-10 w-80 h-80 rounded-full bg-emerald-200/35 dark:bg-emerald-700/15 blur-3xl pointer-events-none" />

      {/* Main Sanctuary Card Container */}
      <div className="relative z-10 rounded-3xl p-6 sm:p-8 bg-gradient-to-b from-white/95 to-slate-50/90 dark:from-slate-900/95 dark:to-slate-950/90 border border-slate-200/90 dark:border-slate-800 shadow-xl shadow-teal-900/5 backdrop-blur-sm overflow-hidden">
        {/* Fine background grid and peaceful therapeutic soundwaves */}
        <div className="absolute inset-0 opacity-[0.035] dark:opacity-[0.06] pointer-events-none bg-[radial-gradient(#0d9488_1px,transparent_1px)] [background-size:16px_16px]" />

        {/* Central Vector Composition */}
        <div className="relative flex flex-col items-center justify-center py-4">
          {/* Calming Ripple Aura SVG */}
          <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
            <svg
              viewBox="0 0 280 280"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-full"
            >
              <defs>
                <linearGradient id="zenGrad1" x1="40" y1="40" x2="240" y2="240" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#ccfbf1" stopOpacity="0.8" />
                  <stop offset="1" stopColor="#a7f3d0" stopOpacity="0.3" />
                </linearGradient>
                <linearGradient id="zenGrad2" x1="80" y1="80" x2="200" y2="200" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#0d9488" stopOpacity="0.15" />
                  <stop offset="1" stopColor="#059669" stopOpacity="0.05" />
                </linearGradient>
                <linearGradient id="zenStone1" x1="100" y1="120" x2="180" y2="220" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#0f766e" />
                  <stop offset="1" stopColor="#115e59" />
                </linearGradient>
                <linearGradient id="zenStone2" x1="110" y1="150" x2="170" y2="190" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#14b8a6" />
                  <stop offset="1" stopColor="#0d9488" />
                </linearGradient>
                <linearGradient id="zenStone3" x1="120" y1="180" x2="160" y2="210" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#2dd4bf" />
                  <stop offset="1" stopColor="#10b981" />
                </linearGradient>
              </defs>

              {/* Soothing Breath Resonance Rings */}
              <circle cx="140" cy="140" r="130" stroke="#0d9488" strokeWidth="1" strokeDasharray="4 6" opacity="0.25" />
              <circle cx="140" cy="140" r="105" fill="url(#zenGrad1)" />
              <circle cx="140" cy="140" r="78" fill="url(#zenGrad2)" />

              {/* Zen Balance Composition & Safe Haven */}
              {/* Ground base stone */}
              <ellipse cx="140" cy="205" rx="55" ry="18" fill="url(#zenStone1)" />
              {/* Mid stone */}
              <ellipse cx="140" cy="178" rx="42" ry="15" fill="url(#zenStone2)" />
              {/* Top sanctuary stone */}
              <ellipse cx="140" cy="154" rx="28" ry="12" fill="url(#zenStone3)" />

              {/* Gentle Water Ripple Line */}
              <path
                d="M80 158 C100 148 120 150 140 150 C160 150 180 148 200 158"
                stroke="#10b981"
                strokeWidth="1.5"
                strokeLinecap="round"
                opacity="0.3"
              />
            </svg>

            {/* Micro Sparkle Points */}
            <div className="absolute top-8 right-12 text-teal-600 dark:text-teal-400 animate-pulse">
              <Sparkles size={18} />
            </div>
            <div className="absolute bottom-10 left-10 text-emerald-600 dark:text-emerald-400 animate-pulse delay-300">
              <Heart size={16} fill="#10b981" className="text-emerald-500 opacity-60" />
            </div>
          </div>
        </div>

        {/* Floating Badge 1: Top Right - Privacy & Ethics Guarantee */}
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6 bg-white/95 dark:bg-slate-900/95 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-2.5 sm:p-3 shadow-lg shadow-slate-900/5 backdrop-blur-md flex items-center gap-2.5 max-w-[210px]">
          <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 flex items-center justify-center flex-shrink-0">
            <ShieldCheck size={18} />
          </div>
          <div className="leading-tight min-w-0">
            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">100% Rahasia & Anonim</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">Standar Etika HIMPSI</p>
          </div>
        </div>

        {/* Floating Badge 2: Left Middle - Verified Psychologist */}
        <div className="absolute top-28 left-3 sm:left-6 bg-white/95 dark:bg-slate-900/95 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-2.5 sm:p-3 shadow-lg shadow-slate-900/5 backdrop-blur-md flex items-center gap-2.5 max-w-[220px]">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-600 to-emerald-700 text-white font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-xs">
            AW
          </div>
          <div className="leading-tight min-w-0">
            <div className="flex items-center gap-1">
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">Dr. Anita Wijaya</p>
              <CheckCircle2 size={12} className="text-teal-600 dark:text-teal-400 flex-shrink-0" />
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Psikolog Klinis (SIPPK)</p>
            <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
              <Star size={10} className="fill-amber-400 text-amber-400" />
              <span>4.9 (240+ ulasan)</span>
            </div>
          </div>
        </div>

        {/* Floating Badge 3: Bottom Full - Mental Health Outcome */}
        <div className="relative mt-2 bg-gradient-to-r from-teal-50/90 via-emerald-50/80 to-white dark:from-teal-950/70 dark:via-slate-900 dark:to-slate-950 border border-teal-200/70 dark:border-slate-800 rounded-2xl p-3 sm:p-3.5 shadow-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
              <TrendingDown size={16} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">Penurunan Tingkat Stres</p>
              <p className="text-[11px] text-slate-600 dark:text-slate-300">87% pengguna merasa lebih lega setelah 1 sesi</p>
            </div>
          </div>
          <span className="hidden sm:inline-block px-2.5 py-1 rounded-full text-[10px] font-bold bg-white dark:bg-slate-800 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-slate-700">
            Terbukti Efektif
          </span>
        </div>
      </div>
    </div>
  );
}

export default HeroVector;
