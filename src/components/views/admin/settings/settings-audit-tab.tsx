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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { History, RefreshCw, AlertCircle, Clock, User, ArrowRight } from "lucide-react";
import { TablePaginationFooter } from "@/components/shared/atoms/Table";
import { systemSettingsClient } from "@/services/system-settings.client";
import type { SystemSettingsAuditItem } from "@/types/system-settings";
import { cn } from "@/lib/utils";

const LIMIT = 20;

const KEY_LABELS: Record<string, string> = {
  topup: "Batas Top-up Koin",
  revenue_share: "Bagi Hasil Mitra",
  tip: "Batas Tip Koin",
  holding: "Masa Tahan Dana",
  payout: "Penarikan Dana (Payout)",
  refund_policy: "Kebijakan Refund Pembatalan",
  psikolog_late: "Toleransi Keterlambatan Psikolog",
  patient_noshow: "Toleransi No-show Pasien",
  extension_price: "Harga Perpanjangan Sesi",
  relawan: "Operasional Relawan",
  maintenance: "Jadwal Pemeliharaan Server",
  upload: "Batas Unggahan",
  media_retention: "Retensi Media",
};

const FIELD_LABELS: Record<string, Record<string, string>> = {
  topup: {
    min_coins: "Minimal top-up (koin)",
    max_coins: "Maksimal top-up (koin)",
  },
  revenue_share: {
    mitra_bps: "Porsi mitra (%)",
  },
  tip: {
    min_coins: "Minimal tip (koin)",
    max_coins: "Maksimal tip (koin)",
    daily_cap_coins_per_patient: "Batas harian per pasien (koin)",
  },
  holding: {
    hours: "Durasi holding (jam)",
  },
  payout: {
    min_rupiah: "Minimal penarikan (Rp)",
    max_rupiah: "Maksimal penarikan (Rp)",
    fee_rupiah: "Biaya penarikan (Rp)",
  },
  psikolog_late: {
    minutes: "Batas terlambat (menit)",
  },
  patient_noshow: {
    minutes: "Batas tidak hadir (menit)",
  },
  extension_price: {
    min_coins: "Harga minimal (koin)",
    max_coins: "Harga maksimal (koin)",
  },
  relawan: {
    daily_ticket_quota: "Kuota tiket harian",
    claim_response_minutes: "Batas respons klaim (menit)",
    unclaimed_archive_hours: "Arsip tiket tak diklaim (jam)",
    max_carry_penalty: "Maksimal penalti terbawa",
  },
  upload: {
    verification_max_mb: "Dokumen verifikasi (MB)",
    chat_media_max_mb: "Media chat (MB)",
    voice_note_max_seconds: "Voice note (detik)",
  },
  media_retention: {
    days: "Masa simpan media (hari)",
  },
  maintenance: {
    scheduled_start: "Mulai terjadwal",
    estimated_end: "Estimasi selesai",
    message: "Pesan maintenance",
  },
};

interface AuditFieldDiff {
  fieldName: string;
  fieldLabel: string;
  oldValText: string;
  newValText: string;
  isChanged: boolean;
}

function formatFieldValue(settingKey: string, fieldKey: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "(Kosong)";

  if (settingKey === "revenue_share" && fieldKey === "mitra_bps") {
    const num = Number(value);
    return Number.isFinite(num) ? `${num / 100}% (${num} bps)` : String(value);
  }

  if (fieldKey.includes("rupiah") && typeof value === "number") {
    return `Rp ${value.toLocaleString("id-ID")}`;
  }

  if ((fieldKey === "scheduled_start" || fieldKey === "estimated_end") && typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return (
        d.toLocaleString("id-ID", {
          timeZone: "Asia/Jakarta",
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }) + " WIB"
      );
    }
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function parseSettingDiff(key: string, oldVal: unknown, newVal: unknown): AuditFieldDiff[] {
  const diffs: AuditFieldDiff[] = [];
  const labels = FIELD_LABELS[key] || {};

  // Case 1: refund_policy (array of tiers)
  if (key === "refund_policy" && (Array.isArray(oldVal) || Array.isArray(newVal))) {
    const oldArr = Array.isArray(oldVal) ? oldVal : [];
    const newArr = Array.isArray(newVal) ? newVal : [];
    const maxLen = Math.max(oldArr.length, newArr.length);

    for (let i = 0; i < maxLen; i++) {
      const o = oldArr[i];
      const n = newArr[i];
      const oText = o ? `≥ ${o.min_minutes_before} menit sebelum sesi: refund ${o.refund_pct}%` : "(Belum ada tier)";
      const nText = n ? `≥ ${n.min_minutes_before} menit sebelum sesi: refund ${n.refund_pct}%` : "(Dihapus)";
      diffs.push({
        fieldName: `tier_${i + 1}`,
        fieldLabel: `Tier ${i + 1}`,
        oldValText: oText,
        newValText: nText,
        isChanged: JSON.stringify(o) !== JSON.stringify(n),
      });
    }
    return diffs;
  }

  // Case 2: Object with key-value pairs
  const oldObj = oldVal && typeof oldVal === "object" && !Array.isArray(oldVal) ? (oldVal as Record<string, unknown>) : {};
  const newObj = newVal && typeof newVal === "object" && !Array.isArray(newVal) ? (newVal as Record<string, unknown>) : {};

  // Preserve form label order first, then append any remaining keys
  const allFieldKeys = Array.from(new Set([...Object.keys(labels), ...Object.keys(oldObj), ...Object.keys(newObj)]));

  for (const fieldKey of allFieldKeys) {
    const oVal = oldObj[fieldKey];
    const nVal = newObj[fieldKey];
    const oText = formatFieldValue(key, fieldKey, oVal);
    const nText = formatFieldValue(key, fieldKey, nVal);
    const isChanged = JSON.stringify(oVal) !== JSON.stringify(nVal);

    diffs.push({
      fieldName: fieldKey,
      fieldLabel: labels[fieldKey] || fieldKey,
      oldValText: oText,
      newValText: nText,
      isChanged,
    });
  }

  return diffs;
}

export function SettingsAuditTab() {
  const [items, setItems] = useState<SystemSettingsAuditItem[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(LIMIT);
  const [meta, setMeta] = useState({ page: 1, limit: LIMIT, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<SystemSettingsAuditItem | null>(null);

  const fetchAudit = useCallback(
    async (target: number, targetLimit: number = limit) => {
      setIsLoading(true);
      setError(null);
      const res = await systemSettingsClient.getAdminSettingsAudit({ page: target, limit: targetLimit });
      setItems(res.items);
      if (res.error) setError(res.error);
      else setMeta({ page: res.page, limit: res.limit, total: res.total, totalPages: res.totalPages });
      setIsLoading(false);
    },
    [limit]
  );

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
              <TableHead className="w-[160px] text-xs font-semibold">Parameter</TableHead>
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
                <TableRow
                  key={row.id}
                  onClick={() => setSelectedItem(row)}
                  className="text-xs cursor-pointer hover:bg-teal-50/50 dark:hover:bg-slate-800/80 transition-colors"
                  title="Klik untuk melihat detail per isian parameter"
                >
                  <TableCell className="font-mono text-[11px] text-slate-500">
                    {formatDate(row.changed_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {KEY_LABELS[row.key] || row.key}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">{row.key}</span>
                    </div>
                  </TableCell>
                  <TableCell>{renderValuePreview(row.old_value)}</TableCell>
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

      {/* Modal Detail Per Isian */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-h-[85vh] overflow-y-auto">
          {selectedItem && (
            <>
              <DialogHeader className="space-y-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="font-mono text-xs px-2 py-0.5 bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800"
                  >
                    {selectedItem.key}
                  </Badge>
                  <span className="text-xs text-slate-400">ID: {selectedItem.id.slice(0, 8)}...</span>
                </div>
                <DialogTitle className="text-lg font-bold font-heading text-slate-900 dark:text-white">
                  Detail Perubahan: {KEY_LABELS[selectedItem.key] || selectedItem.key}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                  Rincian nilai setiap isian parameter sebelum dan sesudah perubahan konfigurasi.
                </DialogDescription>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-xs bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-slate-400 shrink-0" />
                    <span className="text-slate-500">Diubah oleh:</span>
                    <strong className="text-slate-800 dark:text-slate-200">
                      {selectedItem.changed_by_name || selectedItem.changed_by || "Admin Sistem"}
                    </strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-slate-400 shrink-0" />
                    <span className="text-slate-500">Waktu:</span>
                    <strong className="text-slate-800 dark:text-slate-200">
                      {formatDate(selectedItem.changed_at)} WIB
                    </strong>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-3 pt-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Daftar Isian Parameter
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    {parseSettingDiff(selectedItem.key, selectedItem.old_value, selectedItem.new_value).filter((d) => d.isChanged).length} isian berubah
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {parseSettingDiff(selectedItem.key, selectedItem.old_value, selectedItem.new_value).map(
                    (diff, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "p-3.5 text-xs transition-colors",
                          diff.isChanged
                            ? "bg-amber-50/40 dark:bg-amber-950/20"
                            : "bg-white dark:bg-slate-900"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {diff.fieldLabel}
                          </span>
                          {diff.isChanged ? (
                            <Badge className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-[10px] font-bold">
                              Berubah
                            </Badge>
                          ) : (
                            <span className="text-[10px] text-slate-400">Tidak Berubah</span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60">
                            <span className="text-[10px] text-slate-400 block font-medium mb-0.5">
                              Nilai Sebelum
                            </span>
                            <span className="text-xs text-slate-700 dark:text-slate-300 font-medium break-words">
                              {diff.oldValText}
                            </span>
                          </div>
                          <div
                            className={cn(
                              "p-2.5 rounded-lg border",
                              diff.isChanged
                                ? "bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-semibold"
                                : "bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 font-medium"
                            )}
                          >
                            <span className="text-[10px] text-slate-400 block font-medium mb-0.5 flex items-center gap-1">
                              <span>Nilai Sesudah</span>
                              {diff.isChanged && <ArrowRight size={10} className="text-emerald-600" />}
                            </span>
                            <span className="text-xs break-words">{diff.newValText}</span>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
