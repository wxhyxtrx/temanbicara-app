"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BookOpen,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Heart,
  Eye,
  Ear,
  Link as LinkIcon,
  PhoneCall,
  Sparkles,
} from "lucide-react";

export default function ListenerGuidelinesPage() {
  return (
    <div className="space-y-6 sm:space-y-8 font-nunito pb-12 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* 1. Header */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 dark:text-white tracking-tight">
          Panduan Etika & Pertolongan Pertama Psikologis (PFA)
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Pedoman operasional pendengar sebaya berbasis standar WHO dan kode etik kerelawanan HIMPSI
        </p>
      </div>

      {/* 2. Kerangka Kerja 3L (Look, Listen, Link) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <CardHeader className="p-5 pb-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-400 flex items-center justify-center font-bold text-base mb-2">
              <Eye size={20} />
            </div>
            <CardTitle className="font-heading text-base font-bold text-slate-900 dark:text-white">
              1. LOOK (Amati)
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 font-nunito">
              Perhatikan tingkat kegentingan emosi
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0 text-xs text-slate-600 dark:text-slate-300 font-nunito leading-relaxed space-y-2">
            <p>• Cermati pesan yang menunjukkan tanda keputusasaan akut atau ide melukai diri.</p>
            <p>• Kenali apakah teman bicara berada di tempat yang aman untuk bercerita.</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <CardHeader className="p-5 pb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-base mb-2">
              <Ear size={20} />
            </div>
            <CardTitle className="font-heading text-base font-bold text-slate-900 dark:text-white">
              2. LISTEN (Dengarkan)
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 font-nunito">
              Mendengar aktif dengan empati
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0 text-xs text-slate-600 dark:text-slate-300 font-nunito leading-relaxed space-y-2">
            <p>• Berikan ruang bagi mereka untuk mengekspresikan kesedihan tanpa dipotong.</p>
            <p>• Jangan buru-buru menghakimi atau menyederhanakan masalah dengan "kamu kurang bersyukur".</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <CardHeader className="p-5 pb-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 flex items-center justify-center font-bold text-base mb-2">
              <LinkIcon size={20} />
            </div>
            <CardTitle className="font-heading text-base font-bold text-slate-900 dark:text-white">
              3. LINK (Hubungkan)
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 font-nunito">
              Jembatani ke bantuan profesional
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0 text-xs text-slate-600 dark:text-slate-300 font-nunito leading-relaxed space-y-2">
            <p>• Arahkan teman bicara ke psikolog klinis berlisensi di TemanBicara bila butuh intervensi.</p>
            <p>• Berikan informasi hotline darurat krisis SEJIWA 119 bila terdapat risiko jiwa.</p>
          </CardContent>
        </Card>
      </div>

      {/* 3. Do's and Don'ts Table Card */}
      <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
          <CardTitle className="font-heading text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            Pedoman Perilaku: Hal yang Disarankan vs Dilarang (Do's & Don'ts)
          </CardTitle>
          <CardDescription className="text-xs text-slate-500 font-nunito">
            Jaga keselamatan psikologis diri Anda dan teman curhat
          </CardDescription>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Hal yang Disarankan */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
              <CheckCircle2 size={16} />
              <span>SANGAT DIANJURKAN (DO'S)</span>
            </div>
            <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300 font-nunito leading-relaxed">
              <li className="p-2.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40">
                ✓ Validasi emosi mereka: "Wajar sekali merasa lelah di situasi yang berat seperti ini."
              </li>
              <li className="p-2.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40">
                ✓ Hormati privasi dan anonimitas teman curhat, jangan meminta data pribadi di luar platform.
              </li>
              <li className="p-2.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40">
                ✓ Tahu kapan harus berhenti jika kapasitas emosional Anda sendiri sedang menurun.
              </li>
            </ul>
          </div>

          {/* Hal yang Dilarang */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold text-xs">
              <XCircle size={16} />
              <span>DILARANG KERAS (DON'TS)</span>
            </div>
            <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300 font-nunito leading-relaxed">
              <li className="p-2.5 rounded-xl bg-rose-50/50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/40">
                ✗ Memberikan diagnosis medis atau menyarankan obat penenang/antidepresan apapun.
              </li>
              <li className="p-2.5 rounded-xl bg-rose-50/50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/40">
                ✗ Membandingkan penderitaan: "Masalahmu belum seberapa dibanding si A..." (toxic positivity).
              </li>
              <li className="p-2.5 rounded-xl bg-rose-50/50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/40">
                ✗ Mengajak bertemu secara langsung di luar platform untuk keamanan kedua belah pihak.
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* 4. Protokol Darurat Nasional SEJIWA 119 */}
      <div className="rounded-2xl p-5 bg-gradient-to-br from-rose-50 via-rose-100/50 to-white dark:from-rose-950/60 dark:via-slate-900 dark:to-slate-900 border border-rose-200 dark:border-rose-900 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-bold text-sm">
            <PhoneCall size={18} />
            <span>Hotline Bantuan Darurat Kesehatan Mental Nasional</span>
          </div>
          <p className="text-xs text-rose-700 dark:text-rose-300 font-nunito max-w-xl leading-relaxed">
            Kementerian Kesehatan Republik Indonesia menyediakan layanan SEJIWA di <strong className="font-bold underline">119 ext. 8</strong> (Bebas Pulsa 24 Jam) bagi individu yang menghadapi krisis keselamatan jiwa.
          </p>
        </div>

        <a href="tel:119" className="shrink-0">
          <Button className="bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl px-5 py-2 text-xs shadow-xs">
            Hubungi 119 ext. 8
          </Button>
        </a>
      </div>
    </div>
  );
}
