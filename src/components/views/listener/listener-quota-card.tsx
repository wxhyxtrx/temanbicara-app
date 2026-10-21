"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Moon,
  Clock,
  Sparkles,
  BarChart3,
} from "lucide-react";
import type { RelawanQuotaInfo } from "@/types/peer-tickets";
import { formatWibDateFull } from "@/lib/booking-utils";

interface ListenerQuotaCardProps {
  quota: RelawanQuotaInfo | null;
  loading: boolean;
  isAvailable: boolean;
}

export function ListenerQuotaCard({
  quota,
  loading,
  isAvailable,
}: ListenerQuotaCardProps) {
  if (loading || !quota) {
    return (
      <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs min-w-0">
        <CardHeader className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
            <div className="space-y-1.5 min-w-0">
              <Skeleton className="h-5 w-44 rounded-md" />
              <Skeleton className="h-4 w-60 rounded-md" />
            </div>
            <Skeleton className="h-6 w-28 rounded-full" />
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-5 space-y-4 min-w-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 min-w-0">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-2 min-w-0">
                <Skeleton className="h-3 w-16 rounded" />
                <Skeleton className="h-6 w-12 rounded" />
              </div>
            ))}
          </div>
          <Skeleton className="h-10 w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  const isExhausted = quota.remaining <= 0;
  const formattedDate = quota.quota_date ? formatWibDateFull(quota.quota_date) : "Hari Ini";

  return (
    <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs min-w-0">
      <CardHeader className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
          <div className="space-y-1 min-w-0">
            <CardTitle className="font-heading text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 min-w-0">
              <ShieldCheck className="size-5 text-teal-600 dark:text-teal-400 shrink-0" />
              <span className="truncate">Ringkasan Kuota Harian Relawan</span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito flex items-center gap-1.5 min-w-0">
              <Clock className="size-3.5 shrink-0 text-slate-400" />
              <span className="truncate">{formattedDate} (WIB)</span>
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Badge
              variant="outline"
              className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                isAvailable
                  ? "border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60"
                  : "border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full mr-1.5 shrink-0 ${
                  isAvailable ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                }`}
              />
              {isAvailable ? "Mode Siaga" : "Istirahat Emosi"}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-4 min-w-0 font-nunito">
        {/* Metric Badges Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 min-w-0">
          {/* Daily Limit */}
          <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-1 min-w-0">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block truncate">
              Batas Harian
            </span>
            <p className="text-lg sm:text-xl font-bold font-heading text-slate-900 dark:text-slate-100">
              {quota.daily_limit} <span className="text-xs font-normal text-slate-500">Sesi</span>
            </p>
          </div>

          {/* Consumed / Claimed */}
          <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-1 min-w-0">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block truncate">
              Tiket Terpakai
            </span>
            <p className="text-lg sm:text-xl font-bold font-heading text-teal-700 dark:text-teal-400">
              {quota.tickets_claimed} <span className="text-xs font-normal text-slate-500">Sesi</span>
            </p>
          </div>

          {/* Carry Penalty */}
          <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-1 min-w-0">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block truncate">
              Carry Penalty
            </span>
            <p className={`text-lg sm:text-xl font-bold font-heading ${
              quota.carry_penalty > 0
                ? "text-rose-600 dark:text-rose-400"
                : "text-slate-700 dark:text-slate-300"
            }`}>
              {quota.carry_penalty}
            </p>
          </div>

          {/* Remaining Quota */}
          <div className={`p-3 rounded-xl border space-y-1 min-w-0 ${
            isExhausted
              ? "border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/30"
              : "border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/30"
          }`}>
            <span className="text-[11px] font-medium block truncate text-slate-600 dark:text-slate-400">
              Sisa Kuota Hari Ini
            </span>
            <p className={`text-lg sm:text-xl font-bold font-heading ${
              isExhausted
                ? "text-rose-700 dark:text-rose-400"
                : "text-emerald-700 dark:text-emerald-400"
            }`}>
              {quota.remaining} <span className="text-xs font-normal text-slate-500">Sesi</span>
            </p>
          </div>
        </div>

        {/* Quota Summary Banner */}
        <div className="p-3 sm:p-3.5 rounded-xl border border-teal-200/80 dark:border-teal-900/60 bg-teal-50/70 dark:bg-teal-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <BarChart3 className="size-4 text-teal-700 dark:text-teal-300 shrink-0" />
            <span className="text-xs font-bold text-teal-950 dark:text-teal-100 truncate">
              Sisa Kuota: {quota.remaining} / {quota.daily_limit} Sesi Hari Ini (Beban: {quota.tickets_claimed}, Penalti: {quota.carry_penalty})
            </span>
          </div>
          <span className="text-[11px] text-teal-800 dark:text-teal-300 shrink-0 font-medium">
            Zona Waktu: WIB (Asia/Jakarta)
          </span>
        </div>

        {/* State Notice Banners */}
        {!isAvailable && (
          <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200 min-w-0">
            <Moon className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="space-y-0.5 min-w-0">
              <p className="font-bold">Mode Istirahat Emosi Aktif</p>
              <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                Anda sedang dalam mode istirahat emosi sehingga tombol klaim dinonaktifkan. Aktifkan status Siaga terlebih dahulu di Beranda untuk dapat mengambil tiket curhat.
              </p>
            </div>
          </div>
        )}

        {isExhausted && (
          <div className="p-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 flex items-start gap-2.5 text-xs text-rose-900 dark:text-rose-200 min-w-0">
            <AlertTriangle className="size-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            <div className="space-y-0.5 min-w-0">
              <p className="font-bold">Kuota Harian Habis</p>
              <p className="text-[11px] text-rose-800 dark:text-rose-300 leading-relaxed">
                Anda telah menyelesaikan batas aman pendampingan hari ini ({quota.daily_limit} sesi/hari). Istirahatlah sejenak untuk memulihkan energi mental Anda. Kuota akan tereset otomatis pukul 00:00 WIB.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
