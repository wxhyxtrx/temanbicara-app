"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Headphones,
  Heart,
  MessageCircle,
  Clock,
  ShieldCheck,
  Star,
  BookOpen,
  ArrowRight,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  Users,
} from "lucide-react";
import { useUserStore } from "@/store/user-store";
import { usePeerVentStore } from "@/store/peer-vent-store";

export default function ListenerBerandaPage() {
  const user = useUserStore((state) => state.user);
  const posts = usePeerVentStore((state) => state.posts);
  const dailySessionsCompleted = usePeerVentStore((state) => state.dailySessionsCompleted);
  const maxDailySessions = usePeerVentStore((state) => state.maxDailySessions);
  const isOnBreak = usePeerVentStore((state) => state.isOnBreak);
  const toggleBreakMode = usePeerVentStore((state) => state.toggleBreakMode);

  const waitingPosts = React.useMemo(() => posts.filter((p) => p.status === "menunggu"), [posts]);

  const listenerData = {
    listenerBadge: user.listenerData?.listenerBadge || "Pendengar Empatik Terlatih",
    sessionsCompleted: user.listenerData?.sessionsCompleted ?? 0,
    rating: user.listenerData?.rating ?? 5.0,
  };

  const displayName = user.fullName || user.alias || "Sahabat Pendengar";

  return (
    <div className="space-y-6 sm:space-y-8 font-nunito pb-12 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* 1. Header Hero Sanctuary */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-900 via-teal-950 to-slate-950 text-white p-6 sm:p-8 md:p-10 shadow-lg border border-teal-800/60 dark:border-teal-900/40">
        <div className="absolute top-0 right-10 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 left-10 w-60 h-60 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 md:gap-8">
          <div className="space-y-3.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-800/60 border border-teal-700/60 text-teal-200 text-xs font-semibold backdrop-blur-md">
              <span className={`w-2 h-2 rounded-full ${!isOnBreak ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
              <span>{!isOnBreak ? "Status: Siaga Menerima Curhat" : "Status: Sedang Istirahat Emosi (Break)"}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold font-heading text-white tracking-tight leading-snug">
              Halo, {displayName}
            </h1>

            <p className="text-sm sm:text-base text-teal-100/80 leading-relaxed max-w-xl">
              Hadir dan mendengarkan dengan penuh penerimaan tanpa menghakimi adalah obat terbaik bagi jiwa yang lelah. Terima kasih telah menjadi suaka bagi sesama.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link href="/listener/queue">
                <Button className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl px-5 py-5 text-sm cursor-pointer shadow-md shadow-emerald-500/20 gap-2">
                  <Headphones size={17} />
                  Buka Ruang Dengar
                </Button>
              </Link>
              <Link href="/listener/guidelines">
                <Button variant="outline" className="border-teal-700/80 bg-teal-900/50 hover:bg-teal-800/60 text-teal-100 font-semibold rounded-xl px-5 py-5 text-sm cursor-pointer gap-2">
                  <BookOpen size={17} />
                  Panduan Etika PFA
                </Button>
              </Link>
            </div>
          </div>

          {/* Burnout Guard Status Card */}
          <div className="rounded-2xl bg-teal-900/40 border border-teal-700/50 p-4 sm:p-5 backdrop-blur-md max-w-xs space-y-3 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-emerald-300">Burnout Guard Relawan</p>
                <p className="text-[11px] text-teal-100/70 font-nunito">
                  {isOnBreak ? "Sedang istirahat sejenak" : `Beban: ${dailySessionsCompleted}/${maxDailySessions} sesi hari ini`}
                </p>
              </div>
              <Switch checked={!isOnBreak} onCheckedChange={(checked) => toggleBreakMode(!checked)} className="cursor-pointer" />
            </div>
            <div className="pt-2 border-t border-teal-800/80 flex items-center justify-between text-[11px] text-teal-300">
              <span>Batas Aman: {maxDailySessions} Sesi/Hari</span>
              <span className="flex items-center gap-1 text-amber-300 font-bold">
                <Star size={12} className="fill-amber-300" /> {listenerData.rating}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. KPI Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Jiwa Didampingi</span>
            <span className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-400">
              <Heart size={15} />
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-heading text-teal-900 dark:text-teal-300">
            {listenerData.sessionsCompleted} <span className="text-xs font-semibold text-teal-600">Teman</span>
          </p>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-nunito">Percakapan empatik selesai</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Skor Kehangatan</span>
            <span className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400">
              <Star size={15} className="fill-amber-400 text-amber-400" />
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-heading text-amber-700 dark:text-amber-400">
            {listenerData.rating} <span className="text-xs font-semibold text-slate-500">/ 5.0</span>
          </p>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-nunito">Evaluasi apresiasi anonim</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Waktu Mendengar</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400">
              <Clock size={15} />
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-heading text-emerald-700 dark:text-emerald-400">
            124 <span className="text-xs font-semibold">Jam</span>
          </p>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-nunito">Dedikasi kerelawanan aktif</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Sertifikasi</span>
            <span className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-400">
              <ShieldCheck size={15} />
            </span>
          </div>
          <p className="text-sm sm:text-base font-bold font-heading text-slate-900 dark:text-white truncate">
            PFA Certified
          </p>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-nunito font-semibold">
            Standar Pertolongan Pertama
          </span>
        </div>
      </div>

      {/* 3. Antrean Curhat Masuk & Panduan Pendengar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
        {/* Left: Antrean Masuk (8 Cols) */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="font-heading text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Headphones size={18} className="text-teal-600 dark:text-teal-400" />
                    Antrean Teman Bicara Membutuhkan Pendengar
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
                    Pilih percakapan yang sesuai dengan kapasitas emosional Anda saat ini
                  </CardDescription>
                </div>
                <Badge variant="outline" className="border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 text-xs">
                  {waitingPosts.length} Menunggu
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-6 space-y-4">
              {waitingPosts.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 font-bold text-xs flex items-center justify-center">
                        {item.patientAlias.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white font-heading">
                          {item.patientAlias}
                        </p>
                        <span className="text-[10px] text-slate-400 font-nunito">{item.createdAt}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${item.emotionColor}`}>
                        {item.emotion}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                        {item.topic}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 dark:text-slate-300 font-nunito bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-800 italic leading-relaxed">
                    "{item.content}"
                  </p>

                  <div className="flex justify-end pt-1">
                    <Link href="/listener/queue">
                      <Button
                        size="sm"
                        className="text-xs bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg px-4 py-1.5 h-8 gap-1.5 cursor-pointer shadow-xs"
                      >
                        <MessageCircle size={14} />
                        Mulai Dengarkan Sesi Ini
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right: Golden Rules & Emergency Escalation (4 Cols) */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardHeader className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="font-heading text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BookOpen size={16} className="text-teal-600 dark:text-teal-400" />
                3 Prinsip Emas Pendengar Sebaya
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 space-y-3 text-xs font-nunito leading-relaxed">
              <div className="p-2.5 rounded-xl bg-teal-50/60 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 space-y-1">
                <p className="font-bold text-teal-900 dark:text-teal-200">1. Validasi, Bukan Solusi Instan</p>
                <p className="text-slate-600 dark:text-slate-300 text-[11px]">
                  Fokus pada perasaan mereka terlebih dahulu. Hindari langsung memberi nasihat sebelum mereka merasa didengarkan.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 space-y-1">
                <p className="font-bold text-slate-800 dark:text-slate-200">2. Jaga Batasan Diri (Boundaries)</p>
                <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                  Kamu adalah pendengar sebaya, bukan terapis. Jangan ragu menyarankan bantuan profesional bila keluhan berada di luar ranah sebaya.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 space-y-1 text-rose-900 dark:text-rose-200">
                <p className="font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1">
                  <AlertCircle size={13} /> 3. Eskalasi Krisis SEJIWA 119
                </p>
                <p className="text-rose-700 dark:text-rose-300 text-[11px]">
                  Bila teman bicara mengindikasikan bahaya melukai diri, segera rujuk ke Hotline SEJIWA 119 ext. 8 bebas pulsa.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
