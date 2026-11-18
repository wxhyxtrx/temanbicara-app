"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tables, TablePaginationFooter, Column } from "@/components/shared/atoms/Table";
import { cn } from "@/lib/utils";
import { listActivityLogs, type ActivityCategory, type ActivityLogItem } from "@/services/activity-log.client";
import type { PaginationMeta } from "@/types/wallet";
import { AlertCircle, AlertTriangle, Loader2, RefreshCw } from "lucide-react";

const ACTION_LABELS: Record<string, string> = {
  "auth.login": "Masuk ke akun",
  "auth.login_failed": "Gagal masuk (kredensial salah)",
  "auth.logout": "Keluar dari akun",
  "auth.password_changed": "Mengganti kata sandi",
  "auth.password_created": "Membuat kata sandi",
  "auth.password_reset": "Memulihkan kata sandi",
  "user.created": "Membuat pengguna",
  "user.updated": "Memperbarui data pengguna",
  "user.status_changed": "Mengubah status akun",
  "user.deleted": "Menghapus pengguna",
  "settings.updated": "Mengubah pengaturan sistem",
  "review.hidden": "Menyembunyikan ulasan",
  "review.shown": "Menampilkan ulasan",
  "payout.requested": "Mengajukan payout",
  "payout.paid": "Menandai payout lunas",
  "payout.rejected": "Menolak payout",
  "dispute.cleared": "Membebaskan sengketa",
  "dispute.deducted": "Memotong saldo sengketa",
  "topup.settled": "Top-up berhasil",
  "topup.refunded": "Top-up direfund",
  "topup.chargeback": "Top-up chargeback",
};

const ROLE_LABELS: Record<string, string> = {
  pasien: "Pasien",
  psikolog: "Psikolog",
  relawan: "Relawan",
  admin: "Admin",
  system: "Sistem",
  guest: "Tamu",
};

const CATEGORY_TABS: { key: ActivityCategory | "all"; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "auth", label: "Akun & Login" },
  { key: "admin", label: "Aksi Admin" },
  { key: "money", label: "Transaksi Uang" },
];

const CATEGORY_STYLE: Record<ActivityCategory, string> = {
  auth: "border-sky-300 text-sky-700 dark:border-sky-800 dark:text-sky-400",
  admin: "border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400",
  money: "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400",
};

function formatMetadata(meta: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(meta ?? {})) {
    if (value === null || value === undefined || value === "") continue;
    const text = key.includes("rupiah") && typeof value === "number" ? `Rp ${value.toLocaleString("id-ID")}` : String(value);
    parts.push(`${key.replace(/_/g, " ")}: ${text}`);
  }
  return parts.join(" · ");
}

export default function AdminActivityLogPage() {
  const [items, setItems] = useState<ActivityLogItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [category, setCategory] = useState<ActivityCategory | "all">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const res = await listActivityLogs({ page, limit, category: category === "all" ? undefined : category });
      setItems(res.items);
      setMeta(res.meta);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Gagal memuat log aktivitas");
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, category]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const columns: Column<ActivityLogItem>[] = [
    {
      label: "Waktu",
      className: "w-[16%]",
      renderCell: (r) => (
        <div className="space-y-0.5 text-xs">
          <p className="text-slate-700 dark:text-slate-300 font-medium">
            {new Date(r.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" })}
          </p>
          <p className="text-[10px] text-slate-400 font-mono">
            {new Date(r.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Jakarta" })} WIB
          </p>
        </div>
      ),
    },
    {
      label: "Pelaku",
      className: "w-[20%]",
      renderCell: (r) => (
        <div className="space-y-1 min-w-0">
          <p className="font-bold text-slate-900 dark:text-white text-xs truncate">
            {r.actor_name || (r.actor_role === "system" ? "Sistem (otomatis)" : r.actor_role === "guest" ? "Tidak dikenal" : "Pengguna dihapus")}
          </p>
          <Badge variant="outline" className="text-[9px] uppercase font-bold px-1.5 py-0">
            {ROLE_LABELS[r.actor_role] ?? r.actor_role}
          </Badge>
        </div>
      ),
    },
    {
      label: "Aktivitas",
      className: "w-[26%]",
      renderCell: (r) => (
        <div className="space-y-1 min-w-0">
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{ACTION_LABELS[r.action] ?? r.action}</p>
          <Badge variant="outline" className={cn("text-[9px] uppercase font-bold px-1.5 py-0", CATEGORY_STYLE[r.category])}>
            {CATEGORY_TABS.find((t) => t.key === r.category)?.label ?? r.category}
          </Badge>
        </div>
      ),
    },
    {
      label: "Detail",
      className: "w-[38%]",
      renderCell: (r) => {
        const detail = formatMetadata(r.metadata);
        return (
          <div className="space-y-0.5 min-w-0 text-[11px] text-slate-500 dark:text-slate-400">
            {r.target_type && (
              <p className="font-mono truncate">
                {r.target_type}
                {r.target_id ? `: ${r.target_id.slice(0, 13)}` : ""}
              </p>
            )}
            {detail && <p className="break-words">{detail}</p>}
            {!r.target_type && !detail && <p>—</p>}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8 font-nunito pb-12 text-slate-900 dark:text-slate-100 transition-colors duration-200 min-w-0 max-w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 min-w-0">
        <div className="space-y-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 dark:text-white tracking-tight truncate">
            Log Aktivitas
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Jejak audit seluruh pengguna: login, aksi admin, dan transaksi uang. Catatan tidak dapat diubah atau dihapus.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void fetchLogs()}
          disabled={isLoading}
          className="text-xs rounded-xl h-9 gap-1.5 border-slate-200 dark:border-slate-800 cursor-pointer shrink-0"
        >
          <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
          <span>Segarkan</span>
        </Button>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50/70 dark:bg-rose-950/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <AlertTriangle size={18} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5 min-w-0">
              <p className="text-xs font-bold text-rose-900 dark:text-rose-200">Gagal Memuat Log Aktivitas</p>
              <p className="text-xs text-rose-700 dark:text-rose-300">{errorMessage}</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => void fetchLogs()} className="text-xs rounded-xl h-8 text-rose-700 border-rose-300 hover:bg-rose-100 shrink-0">
            <RefreshCw size={12} className="mr-1" />
            Coba Lagi
          </Button>
        </div>
      )}

      <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
        <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="font-heading text-base sm:text-lg font-bold text-slate-900 dark:text-white">Riwayat Aktivitas</CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
                {meta.total.toLocaleString("id-ID")} catatan, terbaru di atas
              </CardDescription>
            </div>
            <div className="inline-flex flex-wrap rounded-xl p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
              {CATEGORY_TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  aria-pressed={category === t.key}
                  onClick={() => {
                    setCategory(t.key);
                    setPage(1);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition-colors cursor-pointer",
                    category === t.key ? "bg-teal-600 text-white shadow-2xs font-bold" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 size={24} className="animate-spin text-teal-600" />
              <span className="text-xs">Memuat log aktivitas...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400 text-center px-4">
              <AlertCircle size={28} className="text-slate-300 dark:text-slate-600" />
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Belum ada aktivitas tercatat</p>
              <p className="text-[11px] text-slate-400 max-w-sm">Aktivitas login, aksi admin, dan transaksi uang akan muncul di sini secara otomatis.</p>
            </div>
          ) : (
            <Tables<ActivityLogItem> columns={columns} data={items} rowKey={(r) => r.id} />
          )}

          <TablePaginationFooter totalItems={meta.total} page={page} limit={limit} onPageChange={setPage} onChangeLimit={setLimit} />
        </CardContent>
      </Card>
    </div>
  );
}
