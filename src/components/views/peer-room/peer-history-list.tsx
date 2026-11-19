"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TablePaginationFooter } from "@/components/shared/atoms/Table";
import { peerTicketClient } from "@/services/peer-tickets.client";
import type { PeerTicketHistoryItem } from "@/types/peer-tickets";
import type { PaginationMeta } from "@/types/wallet";
import { ChevronRight, History, Loader2, RefreshCw, Star } from "lucide-react";

const formatWib = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });

interface PeerHistoryListProps {
  role: "pasien" | "relawan";
}

/** Riwayat curhat sebaya yang sudah selesai; tiap item membuka ruang curhat dalam mode hanya-baca. */
export function PeerHistoryList({ role }: PeerHistoryListProps) {
  const [items, setItems] = useState<PeerTicketHistoryItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 5, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await peerTicketClient.getHistory(page, limit);
      setItems(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat riwayat curhat");
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  const roomBase = role === "pasien" ? "/patient/peer-room" : "/listener/peer-room";
  const counterpartLabel = role === "pasien" ? "Pendengar" : "Teman curhat";

  return (
    <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs min-w-0">
      <CardHeader className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="font-heading text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <History size={17} className="text-teal-600 dark:text-teal-400 shrink-0" />
              Riwayat Curhat
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
              {role === "pasien"
                ? "Curhat yang sudah selesai. Buka untuk membaca ulang percakapannya."
                : "Curhat yang pernah kamu dampingi. Hanya nama samaran yang ditampilkan."}
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Muat ulang riwayat curhat"
            className="h-9 w-9 rounded-xl shrink-0 cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="py-10 flex items-center justify-center gap-2 text-xs text-slate-400">
            <Loader2 size={16} className="animate-spin text-teal-600" />
            Memuat riwayat curhat...
          </div>
        ) : error ? (
          <p className="py-8 px-4 text-center text-xs text-rose-600 dark:text-rose-400">{error}</p>
        ) : items.length === 0 ? (
          <p className="py-10 px-4 text-center text-xs text-slate-500 dark:text-slate-400">
            Belum ada curhat yang selesai.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((t) => {
              const unclaimed = t.status === "archived";
              const content = (
                <div className="flex items-center gap-3 p-4 min-w-0">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{t.topic}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{t.emotion}</Badge>
                      {unclaimed && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-700 border-amber-300 dark:text-amber-300 dark:border-amber-800">
                          Tidak terambil
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {formatWib(t.created_at)}
                      {t.counterpart_name ? ` • ${counterpartLabel}: ${t.counterpart_name}` : ""}
                    </p>
                    {t.rating !== null && (
                      <p className="flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                        <Star size={12} className="fill-amber-400 text-amber-400" /> {t.rating}/5
                      </p>
                    )}
                  </div>
                  {!unclaimed && <ChevronRight size={18} className="text-slate-400 shrink-0" />}
                </div>
              );
              return (
                <li key={t.id}>
                  {unclaimed ? (
                    content
                  ) : (
                    <Link href={`${roomBase}/${t.id}`} className="block hover:bg-teal-50/40 dark:hover:bg-teal-950/20 transition-colors">
                      {content}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {meta.total > 0 && (
          <TablePaginationFooter
            totalItems={meta.total}
            page={page}
            limit={limit}
            onPageChange={setPage}
            onChangeLimit={(l) => {
              setLimit(l);
              setPage(1);
            }}
            limitList={[5, 10, 20]}
          />
        )}
      </CardContent>
    </Card>
  );
}
