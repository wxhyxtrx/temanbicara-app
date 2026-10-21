"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  Inbox,
  RefreshCw,
  Clock,
  Heart,
  Tag,
  HeartHandshake,
  Shield,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import type { RelawanPeerTicketDTO } from "@/types/peer-tickets";
import { formatWibTime, formatWibDateShort } from "@/lib/booking-utils";

interface ListenerPoolListProps {
  tickets: RelawanPeerTicketDTO[];
  loading: boolean;
  isRefreshing: boolean;
  isAvailable: boolean;
  remainingQuota: number;
  onClaimClick: (ticket: RelawanPeerTicketDTO) => void;
  onManualRefresh: () => void;
}

const emotionStyles: Record<string, string> = {
  Kewalahan: "bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800",
  Cemas: "bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  Sedih: "bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  Lelah: "bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700",
  Bingung: "bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800",
};

export function ListenerPoolList({
  tickets,
  loading,
  isRefreshing,
  isAvailable,
  remainingQuota,
  onClaimClick,
  onManualRefresh,
}: ListenerPoolListProps) {
  // Sort pool tickets FIFO (oldest created_at first)
  const sortedTickets = React.useMemo(() => {
    return [...tickets].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [tickets]);

  const canClaim = isAvailable && remainingQuota > 0;

  const getDisabledReason = () => {
    if (!isAvailable) {
      return "Aktifkan status Siaga terlebih dahulu di Beranda";
    }
    if (remainingQuota <= 0) {
      return "Kuota harian Anda telah habis (3 sesi/hari)";
    }
    return "";
  };

  const disabledReason = getDisabledReason();

  return (
    <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs min-w-0">
      <CardHeader className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <CardTitle className="font-heading text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 min-w-0">
                <Inbox className="size-5 text-teal-600 dark:text-teal-400 shrink-0" />
                <span className="truncate">Antrean Pool Tiket Menunggu</span>
              </CardTitle>
              <Badge
                variant="outline"
                className="text-xs px-2 py-0.5 rounded-full border-teal-300 dark:border-teal-800 text-teal-800 dark:text-teal-200 bg-teal-50 dark:bg-teal-950/60 font-semibold shrink-0"
              >
                {sortedTickets.length} Tiket
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
              Tersortir FIFO (waktu tunggu terlama lebih dulu) • Polling otomatis setiap 15 detik
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onManualRefresh}
              disabled={loading || isRefreshing}
              className="rounded-xl border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs h-8 px-3 gap-1.5 cursor-pointer shrink-0"
            >
              <RefreshCw
                size={13}
                className={loading || isRefreshing ? "animate-spin text-teal-600" : ""}
              />
              <span>{loading || isRefreshing ? "Memuat..." : "Muat Ulang Antrean"}</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-4 font-nunito min-w-0">
        {/* Loading Skeleton */}
        {loading && sortedTickets.length === 0 ? (
          <div className="space-y-3 min-w-0">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-3 min-w-0"
              >
                <div className="flex items-center justify-between gap-3 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <Skeleton className="w-7 h-7 rounded-full shrink-0" />
                    <Skeleton className="w-28 h-4 rounded" />
                  </div>
                  <Skeleton className="w-20 h-4 rounded" />
                </div>
                <Skeleton className="w-3/4 h-4 rounded" />
                <Skeleton className="w-full h-8 rounded-lg" />
              </div>
            ))}
          </div>
        ) : sortedTickets.length === 0 ? (
          /* Empty State */
          <div className="py-12 px-4 flex flex-col items-center justify-center text-center gap-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-100 dark:border-teal-900 flex items-center justify-center text-teal-600 dark:text-teal-400">
              <HeartHandshake size={24} />
            </div>
            <div className="space-y-1 max-w-md min-w-0">
              <p className="font-heading font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                Belum Ada Teman Bicara di Antrean
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-nunito leading-relaxed">
                Belum ada teman bicara yang membutuhkan pendengar saat ini. Terima kasih telah bersiap siaga.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/80 px-3 py-1 rounded-full border border-teal-200 dark:border-teal-800">
              <Sparkles size={12} />
              <span>Sistem terus memantau antrean secara otomatis</span>
            </div>
          </div>
        ) : (
          /* Tickets Pool List */
          <div className="space-y-3 min-w-0">
            {sortedTickets.map((ticket, index) => {
              const timeFormatted = ticket.created_at ? formatWibTime(ticket.created_at) : "";
              const dateFormatted = ticket.created_at ? formatWibDateShort(ticket.created_at) : "";
              const emotionClass =
                emotionStyles[ticket.emotion] ||
                "bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800";

              return (
                <div
                  key={ticket.id}
                  className="p-4 sm:p-4.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800/70 hover:border-teal-300 dark:hover:border-teal-700 transition-colors duration-150 space-y-3 min-w-0"
                >
                  {/* Top Bar: Alias, Position Badge, Time */}
                  <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-teal-100 dark:bg-teal-900/60 flex items-center justify-center text-teal-800 dark:text-teal-200 font-bold text-xs shrink-0">
                        {ticket.patient_alias ? ticket.patient_alias.slice(0, 2).toUpperCase() : "TB"}
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                          {ticket.patient_alias}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold bg-slate-200/70 dark:bg-slate-700 px-1.5 py-0.2 rounded shrink-0">
                          #{index + 1}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                      <Clock className="size-3 text-slate-400" />
                      <span>
                        {dateFormatted ? `${dateFormatted} • ` : ""}{timeFormatted}
                      </span>
                    </div>
                  </div>

                  {/* Badges: Topic & Emotion */}
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
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

                  {/* Curhat Story Content */}
                  <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700/60 min-w-0">
                    <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap break-words">
                      {ticket.content}
                    </p>
                  </div>

                  {/* Bottom Footer: Privacy indicator & Claim Action Button */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-800 min-w-0">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 min-w-0">
                      <Shield className="size-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                      <span className="truncate">Data Terlindungi • Privasi Anonim Terjaga</span>
                    </div>

                    <div className="shrink-0 self-end sm:self-auto">
                      {canClaim ? (
                        <Button
                          type="button"
                          onClick={() => onClaimClick(ticket)}
                          className="bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs h-8 px-4 cursor-pointer gap-1.5 shadow-xs"
                        >
                          <HeartHandshake size={14} />
                          <span>Ambil Tiket</span>
                        </Button>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-block">
                              <Button
                                type="button"
                                disabled
                                className="bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-semibold rounded-xl text-xs h-8 px-4 cursor-not-allowed opacity-75 gap-1.5"
                              >
                                <HeartHandshake size={14} />
                                <span>Ambil Tiket</span>
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{disabledReason}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
