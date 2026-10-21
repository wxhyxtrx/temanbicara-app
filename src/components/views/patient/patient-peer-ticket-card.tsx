"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  HeartHandshake,
  Users,
  MessageCircle,
  AlertCircle,
  RefreshCw,
  Clock,
  Sparkles,
} from "lucide-react";
import type { PeerTicketEntity } from "@/types/peer-tickets";
import { formatWibTime } from "@/lib/booking-utils";

interface PatientPeerTicketCardProps {
  ticket: PeerTicketEntity | null;
  loading: boolean;
  error: string | null;
  onOpenForm: () => void;
  onRetry: () => void;
}

const emotionStyles: Record<string, string> = {
  Kewalahan: "bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800",
  Cemas: "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  Sedih: "bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  Lelah: "bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700",
  Bingung: "bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800",
};

export function PatientPeerTicketCard({
  ticket,
  loading,
  error,
  onOpenForm,
  onRetry,
}: PatientPeerTicketCardProps) {
  // 1. Loading Skeleton State
  if (loading) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs space-y-3 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <Skeleton className="w-2.5 h-2.5 rounded-full shrink-0" />
            <Skeleton className="w-48 h-5 rounded-full" />
          </div>
          <Skeleton className="w-24 h-4 rounded-full self-start sm:self-auto" />
        </div>
        <div className="space-y-2 min-w-0">
          <Skeleton className="w-1/2 h-5 rounded-md" />
          <Skeleton className="w-full h-4 rounded-md" />
          <Skeleton className="w-4/5 h-4 rounded-md" />
        </div>
      </div>
    );
  }

  // 2. Error Banner State with Reload Button
  if (error) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/40 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0">
        <div className="flex items-start gap-3 min-w-0">
          <AlertCircle className="size-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
          <div className="space-y-1 min-w-0">
            <h4 className="font-bold font-heading text-sm text-rose-950 dark:text-rose-100 truncate">
              Gagal Memuat Status Tiket Curhat
            </h4>
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
    );
  }

  // 3. Empty State: No Active Ticket -> Call to Action
  if (!ticket) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-pink-200/90 dark:border-pink-900/60 bg-gradient-to-br from-pink-50/80 via-white to-rose-50/50 dark:from-pink-950/40 dark:via-slate-900 dark:to-slate-900 p-5 sm:p-6 shadow-xs min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0">
          <div className="space-y-2 max-w-xl min-w-0">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="p-1.5 rounded-lg bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300 shrink-0">
                <HeartHandshake size={16} />
              </span>
              <Badge className="bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800 text-[10px] font-semibold">
                100% Anonim & Bebas Biaya
              </Badge>
            </div>
            <h3 className="text-base sm:text-lg font-bold font-heading text-slate-900 dark:text-white leading-snug">
              Butuh Teman Cerita Tanpa Takut Dihakimi?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 font-nunito leading-relaxed">
              Ceritakan beban hari ini kepada Relawan Pendengar Sebaya terlatih PFA (Psychological First Aid). Ruang aman untuk meluapkan uneg-uneg, rasa kesepian, dan burnout kerja.
            </p>
          </div>

          <Button
            type="button"
            onClick={onOpenForm}
            className="bg-pink-600 hover:bg-pink-700 text-white font-semibold rounded-xl px-4 py-2.5 text-xs shadow-xs cursor-pointer gap-1.5 shrink-0 self-start sm:self-center whitespace-nowrap"
          >
            <Users size={14} />
            <span>Curhat Sebaya Sekarang</span>
          </Button>
        </div>
      </div>
    );
  }

  // 4. Active Ticket States (open, claimed, active)
  const emotionBadgeClass =
    emotionStyles[ticket.emotion] ||
    "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700";

  if (ticket.status === "open") {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-amber-200/90 dark:border-amber-900/60 bg-gradient-to-br from-amber-50/80 via-white to-amber-50/40 dark:from-amber-950/40 dark:via-slate-900 dark:to-slate-900 p-5 sm:p-6 shadow-xs space-y-3 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <Badge className="bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800 text-[10px] font-semibold">
              Status: Menunggu Pendengar Sebaya
            </Badge>
            {ticket.emotion && (
              <Badge variant="outline" className={`text-[10px] font-semibold ${emotionBadgeClass}`}>
                {ticket.emotion}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
            <Clock size={12} className="shrink-0" />
            <span>{formatWibTime(ticket.created_at)}</span>
          </div>
        </div>

        <div className="space-y-1 min-w-0">
          <h4 className="font-bold text-sm text-slate-900 dark:text-white font-heading truncate">
            Topik: {ticket.topic} ({ticket.is_anonymous ? ticket.patient_alias : "Kamu"})
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-300 font-nunito leading-relaxed italic line-clamp-2">
            "{ticket.content}"
          </p>
        </div>

        <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium pt-1">
          Relawan PFA sedang meninjau antrean. Kamu akan menerima pemberitahuan begitu ada pendengar yang merespons.
        </p>
      </div>
    );
  }

  if (ticket.status === "claimed") {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-sky-200/90 dark:border-sky-900/60 bg-gradient-to-br from-sky-50/80 via-white to-sky-50/40 dark:from-sky-950/40 dark:via-slate-900 dark:to-slate-900 p-5 sm:p-6 shadow-xs space-y-3 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse shrink-0" />
            <Badge className="bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800 text-[10px] font-semibold">
              Status: Sedang Disiapkan oleh Relawan
            </Badge>
            {ticket.emotion && (
              <Badge variant="outline" className={`text-[10px] font-semibold ${emotionBadgeClass}`}>
                {ticket.emotion}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
            <Clock size={12} className="shrink-0" />
            <span>{formatWibTime(ticket.claimed_at || ticket.created_at)}</span>
          </div>
        </div>

        <div className="space-y-1 min-w-0">
          <h4 className="font-bold text-sm text-slate-900 dark:text-white font-heading truncate">
            Topik: {ticket.topic} ({ticket.is_anonymous ? ticket.patient_alias : "Kamu"})
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-300 font-nunito leading-relaxed italic line-clamp-2">
            "{ticket.content}"
          </p>
        </div>

        <p className="text-[11px] text-sky-700 dark:text-sky-300 font-medium pt-1">
          Pendengar sebaya telah menerima ceritamu dan sedang bersiap memulai sesi pendampingan empati.
        </p>
      </div>
    );
  }

  if (ticket.status === "active") {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-emerald-200/90 dark:border-emerald-900/60 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/40 dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900 p-5 sm:p-6 shadow-xs space-y-4 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            <Badge className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-[10px] font-semibold">
              Status: Ruang Curhat Aktif
            </Badge>
            {ticket.emotion && (
              <Badge variant="outline" className={`text-[10px] font-semibold ${emotionBadgeClass}`}>
                {ticket.emotion}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
            <Clock size={12} className="shrink-0" />
            <span>{formatWibTime(ticket.updated_at || ticket.created_at)}</span>
          </div>
        </div>

        <div className="space-y-1 min-w-0">
          <h4 className="font-bold text-sm text-slate-900 dark:text-white font-heading truncate">
            Topik: {ticket.topic} ({ticket.is_anonymous ? ticket.patient_alias : "Kamu"})
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-300 font-nunito leading-relaxed italic line-clamp-2">
            "{ticket.content}"
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-emerald-100 dark:border-emerald-900/50 min-w-0">
          <Badge
            variant="outline"
            className="text-[10px] font-medium border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/40 py-1 px-2.5 self-start sm:self-center"
          >
            <Sparkles size={11} className="mr-1 inline text-emerald-600 dark:text-emerald-400" />
            Ruang Dengar Segera Hadir di PRD-012
          </Badge>

          <Button
            type="button"
            disabled
            className="bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed font-semibold rounded-xl px-4 py-2 text-xs gap-1.5 shrink-0 self-start sm:self-center"
            title="Fitur ruang dengar interaktif sedang dalam tahap penyelesaian (PRD-012)"
          >
            <MessageCircle size={14} />
            <span>Masuk Ruang Chat</span>
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
