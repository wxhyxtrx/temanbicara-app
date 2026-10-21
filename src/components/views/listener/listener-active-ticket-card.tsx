"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Headphones,
  MessageCircle,
  Clock,
  Sparkles,
  Heart,
  Tag,
  Info,
} from "lucide-react";
import type { RelawanPeerTicketDTO } from "@/types/peer-tickets";
import { formatWibTime, formatWibDateShort } from "@/lib/booking-utils";

interface ListenerActiveTicketCardProps {
  ticket: RelawanPeerTicketDTO | null;
  loading: boolean;
}

const emotionStyles: Record<string, string> = {
  Kewalahan: "bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800",
  Cemas: "bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  Sedih: "bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  Lelah: "bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700",
  Bingung: "bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800",
};

export function ListenerActiveTicketCard({
  ticket,
  loading,
}: ListenerActiveTicketCardProps) {
  if (loading) {
    return (
      <Card className="rounded-2xl border border-teal-200/90 dark:border-teal-900/60 bg-white dark:bg-slate-900 shadow-xs min-w-0">
        <CardHeader className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between gap-3 min-w-0">
            <Skeleton className="h-5 w-48 rounded-md" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-5 space-y-4 min-w-0">
          <div className="space-y-2 min-w-0">
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
          <Skeleton className="h-10 w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  // Jika relawan tidak memiliki tiket aktif yang ditangani, seksi ini tidak ditampilkan
  if (!ticket) {
    return null;
  }

  const claimTime = ticket.claimed_at || ticket.created_at;
  const timeFormatted = claimTime ? formatWibTime(claimTime) : "";
  const dateFormatted = claimTime ? formatWibDateShort(claimTime) : "";
  const emotionClass =
    emotionStyles[ticket.emotion] ||
    "bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800";

  return (
    <Card className="rounded-2xl border-2 border-teal-500/70 dark:border-teal-600/60 bg-gradient-to-br from-teal-50/60 via-white to-emerald-50/30 dark:from-teal-950/30 dark:via-slate-900 dark:to-slate-900 shadow-sm min-w-0">
      <CardHeader className="p-4 sm:p-5 pb-3 border-b border-teal-100/80 dark:border-teal-900/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
          <div className="space-y-1 min-w-0">
            <CardTitle className="font-heading text-base sm:text-lg font-bold text-teal-950 dark:text-teal-100 flex items-center gap-2 min-w-0">
              <Headphones className="size-5 text-teal-600 dark:text-teal-400 shrink-0" />
              <span className="truncate">Tiket yang Sedang Saya Tangani</span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito flex items-center gap-1.5 min-w-0">
              <Clock className="size-3.5 shrink-0 text-slate-400" />
              <span className="truncate">
                Diklaim: {dateFormatted ? `${dateFormatted} • ` : ""}{timeFormatted}
              </span>
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Badge
              variant="outline"
              className="text-xs px-2.5 py-0.5 rounded-full font-semibold border-teal-300 dark:border-teal-800 text-teal-800 dark:text-teal-200 bg-teal-100/70 dark:bg-teal-950/80"
            >
              <span className="w-1.5 h-1.5 rounded-full mr-1.5 shrink-0 bg-teal-500 animate-pulse" />
              {ticket.status === "claimed" ? "Sedang Disiapkan" : "Sesi Aktif"}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-4 font-nunito min-w-0">
        {/* Patient Alias & Badges */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-teal-200 dark:bg-teal-800/60 flex items-center justify-center text-teal-900 dark:text-teal-100 font-bold text-xs shrink-0">
              {ticket.patient_alias ? ticket.patient_alias.slice(0, 2).toUpperCase() : "TB"}
            </div>
            <div className="min-w-0">
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate block">
                {ticket.patient_alias || "Teman Bicara"}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                Teman Curhat Sebaya
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <Badge
              variant="outline"
              className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${emotionClass}`}
            >
              <Heart className="size-3 mr-1 shrink-0" />
              {ticket.emotion}
            </Badge>
            <Badge
              variant="outline"
              className="text-xs px-2.5 py-0.5 rounded-full border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
            >
              <Tag className="size-3 mr-1 shrink-0" />
              {ticket.topic}
            </Badge>
          </div>
        </div>

        {/* Content Box */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-white/90 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 space-y-2 min-w-0">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Cerita Teman Bicara:
          </p>
          <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap break-words">
            {ticket.content}
          </p>
        </div>

        {/* Action and Note */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-200/70 dark:border-slate-800 min-w-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 min-w-0">
            <Info className="size-4 shrink-0 text-teal-600 dark:text-teal-400" />
            <span className="truncate">
              Dampingi teman bicara dengan empati dan tanpa menghakimi.
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 shrink-0">
            <Button
              type="button"
              disabled
              className="bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-semibold rounded-xl text-xs h-9 px-4 cursor-not-allowed opacity-80 gap-2 shrink-0"
            >
              <MessageCircle size={15} />
              <span>Masuk Ruang Dengar</span>
            </Button>
            <Badge
              variant="outline"
              className="border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[11px] font-medium shrink-0"
            >
              Ruang Dengar Segera Hadir di PRD-012
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
