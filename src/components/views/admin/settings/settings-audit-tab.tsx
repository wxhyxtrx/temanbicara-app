"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { History, RefreshCw, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { systemSettingsClient } from "@/services/system-settings.client";
import type { SystemSettingsAuditItem } from "@/types/system-settings";

const LIMIT = 20;

export function SettingsAuditTab() {
  const [items, setItems] = useState<SystemSettingsAuditItem[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAudit = useCallback(async (target: number) => {
    setIsLoading(true);
    setError(null);
    const res = await systemSettingsClient.getAdminSettingsAudit({ page: target, limit: LIMIT });
    setItems(res.items);
    setMeta({ total: res.total, totalPages: res.totalPages });
    if (res.error) setError(res.error);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchAudit(page);
  }, [fetchAudit, page]);

  const isFirstPage = page <= 1;
  const isLastPage = page >= meta.totalPages;

  const formatDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  const renderValuePreview = (val: unknown) => {
    if (val === null || val === undefined) return <span className="text-slate-400 italic">null</span>;
    if (typeof val === "object") {
      return (
        <code className="text-[11px] font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-800 dark:text-slate-200">
          {JSON.stringify(val)}
        </code>
      );
    }
    return <span className="font-mono text-xs">{String(val)}</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <History size={18} className="text-teal-600 dark:text-teal-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Log Riwayat Perubahan Parameter
          </h3>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fetchAudit(page)}
          disabled={isLoading}
          className="h-8 text-xs rounded-lg gap-1.5 cursor-pointer"
        >
          <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
          Segarkan
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs">
          <AlertCircle size={15} className="shrink-0" />
          <span>{error} (Audit log belum tersedia di server)</span>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
        <Table className="min-w-[720px]">
          <TableHeader className="bg-slate-50 dark:bg-slate-800/60">
            <TableRow>
              <TableHead className="w-[170px] text-xs font-semibold">Waktu (WIB)</TableHead>
              <TableHead className="w-[140px] text-xs font-semibold">Parameter Key</TableHead>
              <TableHead className="text-xs font-semibold">Nilai Lama</TableHead>
              <TableHead className="text-xs font-semibold">Nilai Baru</TableHead>
              <TableHead className="w-[180px] text-xs font-semibold">Diubah Oleh</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-xs text-slate-500">
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw size={14} className="animate-spin text-teal-600" />
                    Memuat catatan audit...
                  </div>
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-xs text-slate-500">
                  Belum ada catatan riwayat perubahan pengaturan.
                </TableCell>
              </TableRow>
            ) : (
              items.map((row) => (
                <TableRow key={row.id} className="text-xs">
                  <TableCell className="font-mono text-[11px] text-slate-500">
                    {formatDate(row.changed_at)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-[11px]">
                      {row.key}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {renderValuePreview(row.old_value)}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-emerald-600 dark:text-emerald-400">
                    {renderValuePreview(row.new_value)}
                  </TableCell>
                  <TableCell className="text-slate-600 dark:text-slate-300">
                    {row.changed_by_name || row.changed_by || "-"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>
          Halaman {page} dari {Math.max(meta.totalPages, 1)} · {meta.total} catatan
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p - 1)}
            disabled={isLoading || isFirstPage}
            className="h-8 text-xs rounded-lg gap-1 cursor-pointer"
          >
            <ChevronLeft size={13} />
            Sebelumnya
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={isLoading || isLastPage}
            className="h-8 text-xs rounded-lg gap-1 cursor-pointer"
          >
            Berikutnya
            <ChevronRight size={13} />
          </Button>
        </div>
      </div>
    </div>
  );
}
