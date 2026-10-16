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
import { History, RefreshCw, AlertCircle } from "lucide-react";
import { TablePaginationFooter } from "@/components/shared/atoms/Table";
import { systemSettingsClient } from "@/services/system-settings.client";
import type { SystemSettingsAuditItem } from "@/types/system-settings";

const LIMIT = 20;

export function SettingsAuditTab() {
  const [items, setItems] = useState<SystemSettingsAuditItem[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(LIMIT);
  const [meta, setMeta] = useState({ page: 1, limit: LIMIT, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAudit = useCallback(async (target: number, targetLimit: number = limit) => {
    setIsLoading(true);
    setError(null);
    const res = await systemSettingsClient.getAdminSettingsAudit({ page: target, limit: targetLimit });
    setItems(res.items);
    // Error result carries placeholder totals; keep last known meta.
    if (res.error) setError(res.error);
    else setMeta({ page: res.page, limit: res.limit, total: res.total, totalPages: res.totalPages });
    setIsLoading(false);
  }, [limit]);

  useEffect(() => {
    fetchAudit(page, limit);
  }, [fetchAudit, page, limit]);

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return isoString;
    return date.toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Truncate on an inner block (table cells ignore max-width); title keeps full value readable.
  const renderValuePreview = (val: unknown) => {
    const isNull = val === null || val === undefined;
    const isObject = !isNull && typeof val === "object";
    const text = isNull ? "null" : isObject ? JSON.stringify(val) : String(val);
    const style = isNull
      ? "text-slate-400 italic"
      : isObject
        ? "text-[11px] font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-800 dark:text-slate-200"
        : "font-mono text-xs";
    const Tag = isObject ? "code" : "span";
    return (
      <Tag title={text} className={`block max-w-[200px] truncate ${style}`}>
        {text}
      </Tag>
    );
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
            ) : error ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-xs text-red-600 dark:text-red-400">
                  <div role="alert" className="flex items-center justify-center gap-2">
                    <AlertCircle size={15} className="shrink-0" />
                    {error}
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
                  <TableCell>
                    {renderValuePreview(row.old_value)}
                  </TableCell>
                  <TableCell className="text-emerald-600 dark:text-emerald-400">
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

      {!error && (
        <TablePaginationFooter
          totalItems={meta.total}
          page={page}
          limit={limit}
          onPageChange={setPage}
          onChangeLimit={handleLimitChange}
          className="border-t-0 px-0 py-1"
        />
      )}
    </div>
  );
}
