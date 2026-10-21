"use client";

import React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Headphones,
  Users,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Clock,
} from "lucide-react";
import type { RelawanPeerTicketDTO, RelawanQuotaInfo } from "@/types/peer-tickets";
import { formatWibTime } from "@/lib/booking-utils";

interface ListenerQueueSummaryCardProps {
  poolTickets: RelawanPeerTicketDTO[];
  quota: RelawanQuotaInfo | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  isAvailable?: boolean;
}

const emotionStyles: Record<string, string> = {
  Kewalahan: "bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800",
  Cemas: "bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  Sedih: "bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  Lelah: "bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700",
  Bingung: "bg-teal-100 dark:bg-teal-950/70 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800",
};

export function ListenerQueueSummaryCard({
  poolTickets,
  quota,
  loading,
  error,
  onRetry,
  isAvailable = true,
}: ListenerQueueSummaryCardProps) {
  // 1. Loading Skeleton State
  if (loading) {
    return (
      <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs min-w-0">
        <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
            <div className="space-y-1.5 min-w-0">
              <Skeleton className="h-5 w-52 sm:w-64 rounded-md" />
              <Skeleton className="h-3.5 w-64 sm:w-80 rounded-md" />
            </div>
            <Skeleton className="h-6 w-24 rounded-full shrink-0" />
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-4 min-w-0">
          <Skeleton className="h-10 w-full rounded-xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
            <Skeleton className="h-4 w-56 rounded-md" />
            <Skeleton className="h-10 w-44 rounded-xl" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // 2. Error State with Retry Button
  if (error) {
    return (
      <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs min-w-0">
        <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800 min-w-0">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="space-y-1 min-w-0">
              <CardTitle className="font-heading text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 min-w-0">
                <Headphones size={18} className="text-teal-600 dark:text-teal-400 shrink-0" />
                <span className="truncate">Antrean Teman Bicara Membutuhkan Pendengar</span>
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito truncate">
                Pilih percakapan yang sesuai dengan kapasitas emosional Anda saat ini
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 min-w-0">
          <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
            <div className="flex items-start gap-2.5 min-w-0">
              <AlertCircle className="size-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              <div className="space-y-0.5 min-w-0">
                <p className="font-bold font-heading text-sm text-rose-950 dark:text-rose-100 truncate">
                  Gagal Memuat Ringkasan Antrean
                </p>
                <p className="text-xs text-rose-800 dark:text-rose-300 font-nunito leading-relaxed">
                  {error}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-xl text-xs h-8 px-3 shrink-0 self-start sm:self-center cursor-pointer gap-1.5"
            >
              <RefreshCw size={13} />
              <span>Coba Lagi</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 3. Loaded State with Real Data
  const waitingCount = poolTickets.length;
  const quotaDaily = quota?.daily_limit ?? 3;
  const quotaRemaining = quota?.remaining ?? 3;
  const ticketsClaimed = quota?.tickets_claimed ?? 0;
  const isQuotaExhausted = quotaRemaining <= 0;

  // Preview up to 2 top waiting tickets (patient-safe: alias, topic, emotion, created_at)
  const previewTickets = poolTickets.slice(0, 2);

  return (
    <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs min-w-0">
      <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 min-w-0">
          <div className="space-y-1 min-w-0">
            <CardTitle className="font-heading text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 min-w-0">
              <Headphones size={18} className="text-teal-600 dark:text-teal-400 shrink-0" />
              <span className="truncate">Antrean Teman Bicara Membutuhkan Pendengar</span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito truncate">
              Pilih percakapan yang sesuai dengan kapasitas emosional Anda saat ini
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Badge
              variant="outline"
              className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                waitingCount > 0
                  ? "border-teal-300 dark:border-teal-800 text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60"
                  : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full mr-1.5 shrink-0 ${
                  waitingCount > 0 ? "bg-teal-500 animate-pulse" : "bg-slate-400"
                }`}
              />
              {waitingCount > 0 ? `${waitingCount} Menunggu` : "Antrean Lengang"}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-4 min-w-0 font-nunito">
        {/* Ringkasan Antrean & Kuota Utama (Sesuai Spesifikasi PRD-011) */}
        <div className="p-3 sm:p-3.5 rounded-xl border border-teal-200/80 dark:border-teal-900/60 bg-teal-50/70 dark:bg-teal-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="size-4 text-teal-600 dark:text-teal-400 shrink-0" />
            <p className="text-xs sm:text-sm font-bold text-teal-950 dark:text-teal-100 truncate">
              {waitingCount} Teman Menunggu di Antrean • Sisa Kuota: {quotaRemaining}/{quotaDaily} Sesi Hari Ini
            </p>
          </div>
          <span className="text-[11px] text-teal-700 dark:text-teal-300 shrink-0 font-medium">
            Zona Waktu: WIB
          </span>
        </div>

        {/* 2 Metrik Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
          {/* Card 1: Antrean Pool */}
          <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-1.5 min-w-0">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 min-w-0">
              <span className="font-medium truncate">Teman Menunggu di Pool</span>
              <span className="p-1 rounded-md bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-400 shrink-0">
                <Users size={14} />
              </span>
            </div>
            <p className="text-xl sm:text-2xl font-bold font-heading text-teal-900 dark:text-teal-300">
              {waitingCount}{" "}
              <span className="text-xs font-semibold text-teal-600 dark:text-teal-400">
                Teman Menunggu
              </span>
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight truncate">
              {waitingCount > 0
                ? "Menunggu relawan pendamping empati"
                : "Belum ada tiket curhat dalam antrean"}
            </p>
          </div>

          {/* Card 2: Sisa Kuota Hari Ini */}
          <div
            className={`p-4 rounded-xl border space-y-1.5 min-w-0 ${
              isQuotaExhausted
                ? "border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/30"
                : "border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40"
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 min-w-0">
              <span className="font-medium truncate">Sisa Kuota Hari Ini</span>
              <span className="p-1 rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 shrink-0">
                <ShieldCheck size={14} />
              </span>
            </div>
            <p
              className={`text-xl sm:text-2xl font-bold font-heading ${
                isQuotaExhausted
                  ? "text-rose-700 dark:text-rose-400"
                  : "text-slate-900 dark:text-slate-100"
              }`}
            >
              {quotaRemaining}{" "}
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                / {quotaDaily} Sesi
              </span>
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight truncate">
              Sisa Kuota: {quotaRemaining} dari {quotaDaily} Sesi Hari Ini (Terpakai: {ticketsClaimed})
            </p>
          </div>
        </div>

        {/* Preview Tiket Terdepan (Jika Ada Tiket Menunggu) */}
        {waitingCount > 0 ? (
          <div className="space-y-2 min-w-0 pt-1">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Pratinjau Antrean Terdepan
            </span>
            <div className="space-y-2 min-w-0">
              {previewTickets.map((ticket) => {
                const emotionStyle =
                  emotionStyles[ticket.emotion] ||
                  "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700";

                return (
                  <div
                    key={ticket.id}
                    className="p-3 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between gap-3 min-w-0"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {ticket.patient_alias}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-2 py-0 rounded-md font-medium border ${emotionStyle}`}
                        >
                          {ticket.emotion}
                        </Badge>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          • {ticket.topic}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1">
                        &quot;{ticket.content}&quot;
                      </p>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                      <Clock size={12} className="shrink-0" />
                      <span>{formatWibTime(ticket.created_at)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {waitingCount > 2 && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 text-right">
                + {waitingCount - 2} tiket lainnya menunggu di antrean
              </p>
            )}
          </div>
        ) : (
          <div className="py-5 flex flex-col items-center justify-center text-center gap-2 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20 p-4 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-100 dark:border-teal-900 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
              <Headphones size={20} />
            </div>
            <p className="font-heading font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200">
              Antrean Sedang Lengang
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
              Belum ada teman bicara yang membutuhkan pendengar saat ini. Terima kasih telah bersiap siaga.
            </p>
          </div>
        )}

        {/* Status Notices */}
        {!isAvailable && (
          <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 flex items-start gap-2 text-xs text-amber-900 dark:text-amber-200 min-w-0">
            <AlertCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="space-y-0.5 min-w-0">
              <p className="font-bold">Mode Istirahat Emosi Aktif</p>
              <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                Anda sedang dalam mode istirahat. Aktifkan status Siaga pada sakelar di atas saat Anda siap menerima teman bicara.
              </p>
            </div>
          </div>
        )}

        {isQuotaExhausted && (
          <div className="p-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 flex items-start gap-2 text-xs text-rose-900 dark:text-rose-200 min-w-0">
            <AlertCircle className="size-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            <div className="space-y-0.5 min-w-0">
              <p className="font-bold">Batas Aman Harian Telah Tercapai</p>
              <p className="text-[11px] text-rose-800 dark:text-rose-300 leading-relaxed">
                Anda telah menyelesaikan {quotaDaily} sesi hari ini. Istirahatlah sejenak untuk memulihkan energi emosional Anda.
              </p>
            </div>
          </div>
        )}

        {/* Tombol Navigasi Langsung ke /listener/queue */}
        <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0 border-t border-slate-100 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed min-w-0">
            {waitingCount > 0
              ? `${waitingCount} teman bicara menunggu pendampingan empati. Masuk ke ruang antrean untuk meninjau dan mengambil tiket.`
              : "Buka ruang antrean untuk memantau tiket masuk secara langsung."}
          </p>
          <Link href="/listener/queue" className="shrink-0">
            <Button className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl px-5 py-2.5 text-sm cursor-pointer shadow-sm gap-2">
              <Headphones size={16} />
              <span>Buka Ruang Antrean</span>
              <ArrowRight size={14} className="ml-0.5" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
