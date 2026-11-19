"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tables, TablePaginationFooter, Column } from "@/components/shared/atoms/Table";
import { cn } from "@/lib/utils";
import { listActivityLogs, type ActivityCategory, type ActivityLogItem } from "@/services/activity-log.client";
import type { PaginationMeta } from "@/types/wallet";
import { Input } from "@/components/ui/input";
import { AlertCircle, AlertTriangle, Loader2, RefreshCw, Search, UserRound, X } from "lucide-react";

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
  "peer.created": "Membuat curhat",
  "peer.claimed": "Mengambil curhat",
  "peer.closed": "Menutup curhat",
  "booking.created": "Memesan sesi psikolog",
  "booking.cancelled": "Membatalkan sesi",
  "booking.rescheduled": "Memindah jadwal sesi",
  "booking.refund_chosen": "Memilih refund penuh",
  "booking.ended": "Mengakhiri sesi",
  "booking.extension_requested": "Mengajukan perpanjangan sesi",
  "booking.extension_approved": "Menyetujui perpanjangan sesi",
  "booking.extension_rejected": "Menolak perpanjangan sesi",
  "review.submitted": "Memberi ulasan",
  "review.reported": "Melaporkan ulasan",
  "tip.given": "Memberi tip",
  "booking.auto_cancelled": "Sesi batal otomatis (psikolog tidak hadir)",
  "booking.no_show": "Pasien tidak hadir",
  "booking.auto_completed": "Sesi selesai otomatis",
  "booking.auto_refunded": "Refund otomatis (pasien tidak memilih)",
  "peer.reopened": "Curhat kembali ke antrean (relawan tidak menyapa)",
  "peer.expired": "Curhat kedaluwarsa (tidak terambil)",
  "peer.auto_closed": "Curhat ditutup otomatis (24 jam)",
  "crisis.reported": "Melaporkan krisis",
  "crisis.handled": "Menangani laporan krisis",
  "crisis.false_alarm": "Menandai alarm palsu",
  "contact.viewed": "Membuka kontak darurat pasien",
  "strike.added": "Psikolog mendapat strike",
  "psikolog.suspended": "Psikolog ditangguhkan",
  "auth.registered": "Mendaftar akun",
  "profile.updated": "Memperbarui profil",
  "availability.changed": "Mengubah status siaga",
  "schedule.updated": "Memperbarui pola jadwal",
  "time_off.created": "Menambah waktu libur",
  "time_off.deleted": "Menghapus waktu libur",
  "bank.saved": "Menyimpan rekening bank",
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
  { key: "session", label: "Sesi & Curhat" },
  { key: "feedback", label: "Ulasan" },
  { key: "safety", label: "Keselamatan" },
  { key: "money", label: "Transaksi Uang" },
];

const CATEGORY_STYLE: Record<ActivityCategory, string> = {
  auth: "border-sky-300 text-sky-700 dark:border-sky-800 dark:text-sky-400",
  admin: "border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400",
  money: "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400",
  session: "border-violet-300 text-violet-700 dark:border-violet-800 dark:text-violet-400",
  feedback: "border-rose-300 text-rose-700 dark:border-rose-800 dark:text-rose-400",
  safety: "border-red-400 text-red-700 dark:border-red-800 dark:text-red-400",
};

const ROLE_WORD: Record<string, string> = { pasien: "pasien", psikolog: "psikolog", relawan: "relawan", admin: "admin" };

/** Kalimat ringkas yang mudah dibaca: lawan interaksi, topik, koin, rating. Tanpa isi percakapan. */
function describe(r: ActivityLogItem): string {
  const m = r.metadata ?? {};
  const parts: string[] = [];
  if (r.counterpart_name) {
    const role = r.counterpart_role ? ROLE_WORD[r.counterpart_role] : null;
    parts.push(`dengan ${role ? `${role} ` : ""}${r.counterpart_name}`);
  }
  if (r.topic) parts.push(`topik ${r.topic}`);
  if (typeof m.coins === "number") parts.push(`${m.coins} koin`);
  if (typeof m.price_coins === "number") parts.push(`biaya ${m.price_coins} koin`);
  if (typeof m.refund_coins === "number") parts.push(`refund ${m.refund_coins} koin`);
  if (typeof m.rating === "number") parts.push(`rating ${m.rating}/5`);
  if (m.by === "psikolog") parts.push("dibatalkan oleh psikolog");
  if (typeof m.points === "number") parts.push(`${m.points} poin strike${m.reason === "noshow" ? " (tidak hadir)" : m.reason === "late_cancel" ? " (batal mendadak)" : ""}`);
  if (typeof m.until === "string") parts.push(`sampai ${m.until} WIB`);
  if (typeof m.available === "boolean") parts.push(m.available ? "siaga" : "tidak siaga");
  if (typeof m.fields === "string" && m.fields) parts.push(`kolom: ${m.fields.replace(/_/g, " ")}`);
  if (typeof m.bank === "string") parts.push(`bank ${m.bank}`);
  if (typeof m.ranges === "number") parts.push(`${m.ranges} rentang jam`);
  if (typeof m.new_start_at === "string") {
    parts.push(
      `jadwal baru ${new Date(m.new_start_at).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })} WIB`
    );
  }
  return parts.join(" · ");
}

const HUMANIZED_KEYS = new Set([
  "coins", "price_coins", "refund_coins", "rating", "by", "new_start_at", "topic", "emotion",
  "points", "reason", "until", "available", "fields", "bank", "ranges", "booking_id", "missed_by",
]);

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
  // Filter tahap 2: pelaku tertentu (dari tautan detail pengguna), kata kunci nama, rentang tanggal WIB.
  const [actorFilter, setActorFilter] = useState<{ id: string; name: string } | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [ready, setReady] = useState(false);
  // "involved" juga menampilkan baris saat pengguna menjadi pihak lawan (peserta booking/curhat, target).
  const [actorScope, setActorScope] = useState<"actor" | "involved">("involved");

  // Baca ?actor_id=&actor_name= dari tautan "Lihat log aktivitas" di detail pengguna.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const id = sp.get("actor_id");
    if (id && /^[0-9a-f-]{36}$/i.test(id)) setActorFilter({ id, name: sp.get("actor_name") || "Pengguna" });
    setReady(true);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchLogs = useCallback(async () => {
    if (!ready) return;
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const res = await listActivityLogs({
        page,
        limit,
        category: category === "all" ? undefined : category,
        actorId: actorFilter?.id,
        scope: actorFilter ? actorScope : undefined,
        q: actorFilter ? undefined : q,
        from: fromDate || undefined,
        to: toDate || undefined,
      });
      setItems(res.items);
      setMeta(res.meta);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Gagal memuat log aktivitas");
    } finally {
      setIsLoading(false);
    }
  }, [ready, page, limit, category, actorFilter, actorScope, q, fromDate, toDate]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const clearActorFilter = () => {
    setActorFilter(null);
    setPage(1);
    window.history.replaceState(null, "", "/admin/activity-log");
  };
  const hasFilter = Boolean(actorFilter || q || fromDate || toDate);
  const resetFilters = () => {
    clearActorFilter();
    setSearchInput("");
    setQ("");
    setFromDate("");
    setToDate("");
  };

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
          {r.actor_id && r.actor_name ? (
            <button
              type="button"
              onClick={() => {
                setActorFilter({ id: r.actor_id as string, name: r.actor_name as string });
                setPage(1);
              }}
              title="Tampilkan semua aktivitas pengguna ini"
              className="block max-w-full text-left font-bold text-slate-900 dark:text-white text-xs truncate hover:text-teal-700 dark:hover:text-teal-400 hover:underline underline-offset-2 cursor-pointer"
            >
              {r.actor_name}
            </button>
          ) : (
            <p className="font-bold text-slate-900 dark:text-white text-xs truncate">
              {r.actor_name || (r.actor_role === "system" ? "Sistem (otomatis)" : r.actor_role === "guest" ? "Tidak dikenal" : "Pengguna dihapus")}
            </p>
          )}
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
        const sentence = describe(r);
        const rest = Object.fromEntries(Object.entries(r.metadata ?? {}).filter(([k]) => !HUMANIZED_KEYS.has(k)));
        const detail = formatMetadata(rest);
        return (
          <div className="space-y-0.5 min-w-0 text-[11px] text-slate-500 dark:text-slate-400">
            {sentence && <p className="text-xs text-slate-700 dark:text-slate-200 break-words">{sentence}</p>}
            {r.target_type && (
              <p className="font-mono truncate">
                {r.target_type}
                {r.target_id ? `: ${r.target_id.slice(0, 13)}` : ""}
              </p>
            )}
            {detail && <p className="break-words">{detail}</p>}
            {!r.target_type && !detail && !sentence && <p>—</p>}
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
            Jejak audit seluruh pengguna: akun, sesi & curhat, ulasan, keselamatan, aksi admin, transaksi uang, dan kejadian otomatis sistem. Isi percakapan tidak pernah dicatat. Catatan tidak dapat diubah atau dihapus.
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

          <div className="mt-4 flex flex-col gap-2.5 min-w-0 w-full">
            {actorFilter ? (
              <div className="flex flex-col sm:flex-row gap-2 min-w-0 w-full">
                <div className="flex items-center gap-2 h-9 px-3 rounded-xl border border-teal-300 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/50 text-xs text-teal-900 dark:text-teal-200 min-w-0 sm:min-w-[12rem] flex-1">
                  <UserRound size={14} className="shrink-0" />
                  <span className="truncate">
                    Aktivitas: <strong>{actorFilter.name}</strong>
                  </span>
                  <button type="button" onClick={clearActorFilter} aria-label="Hapus filter pengguna" className="ml-auto p-1 -m-1 rounded hover:bg-teal-100 dark:hover:bg-teal-900 cursor-pointer">
                    <X size={14} />
                  </button>
                </div>
                <div role="group" aria-label="Cakupan aktivitas pengguna" className="grid grid-cols-2 rounded-xl p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold sm:w-72 shrink-0">
                  {([
                    ["involved", "Semua yang melibatkan"],
                    ["actor", "Yang dilakukan"],
                  ] as const).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={actorScope === key}
                      onClick={() => {
                        setActorScope(key);
                        setPage(1);
                      }}
                      className={cn(
                        "px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer leading-tight text-center",
                        actorScope === key ? "bg-teal-600 text-white shadow-2xs" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="relative w-full min-w-0">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Cari nama pelaku (min. 2 huruf)..."
                  aria-label="Cari nama pelaku"
                  className="pl-9 h-9 text-xs rounded-xl"
                />
              </div>
            )}
            <div className="flex flex-wrap items-end sm:items-center gap-2.5">
            <div className="grid grid-cols-2 gap-2.5 flex-1 sm:flex-none sm:flex sm:items-center">
              <label className="flex flex-col gap-1 text-[11px] text-slate-500 dark:text-slate-400 sm:flex-row sm:items-center sm:gap-2">
                Dari
                <Input type="date" value={fromDate} max={toDate || undefined} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} className="h-9 text-xs rounded-xl" />
              </label>
              <label className="flex flex-col gap-1 text-[11px] text-slate-500 dark:text-slate-400 sm:flex-row sm:items-center sm:gap-2">
                Sampai
                <Input type="date" value={toDate} min={fromDate || undefined} onChange={(e) => { setToDate(e.target.value); setPage(1); }} className="h-9 text-xs rounded-xl" />
              </label>
            </div>
            {hasFilter && (
              <Button type="button" variant="ghost" size="sm" onClick={resetFilters} className="h-9 text-xs rounded-xl cursor-pointer">
                Reset filter
              </Button>
            )}
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
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{hasFilter ? "Tidak ada aktivitas yang cocok dengan filter" : "Belum ada aktivitas tercatat"}</p>
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
