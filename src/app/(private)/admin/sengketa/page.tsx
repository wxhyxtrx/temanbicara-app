"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tables, TablePaginationFooter, Column } from "@/components/shared/atoms/Table";
import { notify } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { listDisputedHolds, resolveDisputedHold, DisputedHoldApiError } from "@/services/disputed-payout-hold.client";
import type { DisputedHoldStatus, DisputedPayoutHoldItem, PaginationMeta } from "@/types/wallet";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  Tag,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
} from "lucide-react";

const SUMMARY_CARDS = [
  { key: "active" as const, label: "Sengketa Aktif", sub: "Dana tertahan menunggu resolusi", border: "border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300", textVal: "text-amber-900 dark:text-amber-200", iconBg: "bg-amber-500", icon: ShieldAlert },
  { key: "cleared" as const, label: "Telah Dibebaskan", sub: "Selesai tanpa potong saldo", border: "border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300", textVal: "text-emerald-900 dark:text-emerald-200", iconBg: "bg-emerald-600", icon: CheckCircle2 },
  { key: "deducted" as const, label: "Saldo Terpotong", sub: "Eksekusi potong saldo permanen", border: "border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300", textVal: "text-rose-900 dark:text-rose-200", iconBg: "bg-rose-600", icon: ShieldCheck },
];

export default function AdminSengketaPage() {
  const [holds, setHolds] = useState<DisputedPayoutHoldItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);
  const [currentTab, setCurrentTab] = useState<DisputedHoldStatus>("active");
  const [search, setSearch] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal dialog state
  const [selectedHold, setSelectedHold] = useState<DisputedPayoutHoldItem | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [action, setAction] = useState<"clear" | "deduct">("clear");
  const [note, setNote] = useState<string>("");
  const [isConfirmed, setIsConfirmed] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const fetchHolds = useCallback(async (targetPage: number, targetStatus: DisputedHoldStatus, targetLimit: number = limit) => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const res = await listDisputedHolds({ status: targetStatus, page: targetPage, limit: targetLimit });
      setHolds(res.items);
      setMeta(res.meta);
    } catch (err) {
      if (err instanceof DisputedHoldApiError && err.handled) return;
      const msg = err instanceof Error ? err.message : "Gagal memuat daftar sengketa penahanan payout";
      console.error("Gagal memuat sengketa hold:", err);
      setErrorMessage(msg);
      notify.error("Gagal Memuat Sengketa", msg);
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchHolds(page, currentTab, limit);
  }, [fetchHolds, page, currentTab, limit]);

  const handleTabChange = (newTab: DisputedHoldStatus) => {
    setCurrentTab(newTab);
    setPage(1);
    setSearch("");
  };

  const filteredHolds = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return holds;
    return holds.filter((h) => (
      h.id.toLowerCase().includes(q) ||
      (h.mitra_name && h.mitra_name.toLowerCase().includes(q)) ||
      (h.topup_order_ref && h.topup_order_ref.toLowerCase().includes(q)) ||
      (h.mitra_role && h.mitra_role.toLowerCase().includes(q)) ||
      (h.topup_status && h.topup_status.toLowerCase().includes(q)) ||
      (h.source_type && h.source_type.toLowerCase().includes(q))
    ));
  }, [holds, search]);

  const handleOpenResolveDialog = (hold: DisputedPayoutHoldItem) => {
    setSelectedHold(hold);
    setStep(1);
    setAction("clear");
    setNote("");
    setIsConfirmed(false);
    setDialogError(null);
  };

  const handleCloseDialog = () => {
    setSelectedHold(null);
    setStep(1);
    setAction("clear");
    setNote("");
    setIsConfirmed(false);
    setDialogError(null);
    setIsSubmitting(false);
  };

  const handleProceedToStep2 = () => {
    const trimmed = note.trim();
    if (!trimmed) return setDialogError("Catatan resolusi sengketa wajib diisi.");
    if (trimmed.length > 1000) return setDialogError("Catatan resolusi maksimal 1.000 karakter.");
    setDialogError(null);
    setStep(2);
  };

  const handleExecuteResolution = async () => {
    if (!selectedHold) return;
    if (!isConfirmed) return setDialogError("Anda wajib mencentang persetujuan sebelum eksekusi.");

    try {
      setIsSubmitting(true);
      setDialogError(null);
      await resolveDisputedHold(selectedHold.id, { action, note: note.trim() });
      notify.success(
        "Sengketa Berhasil Diselesaikan",
        action === "clear"
          ? "Penahanan sengketa telah dibebaskan. Mitra dapat memproses pencairan dana."
          : "Saldo mitra telah dipotong secara permanen melalui pencatatan buku besar."
      );
      handleCloseDialog();
      await fetchHolds(page, currentTab, limit);
    } catch (err: unknown) {
      if (err instanceof DisputedHoldApiError && err.code === "HOLD_ALREADY_RESOLVED") {
        notify.warning(
          "Sengketa Sudah Diselesaikan",
          "Sengketa penahanan ini telah diselesaikan sebelumnya oleh administrator lain. Daftar data diperbarui."
        );
        handleCloseDialog();
        await fetchHolds(page, currentTab, limit);
        return;
      }
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan saat menyelesaikan sengketa.";
      setDialogError(msg);
      notify.error("Gagal Menyelesaikan Sengketa", msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<DisputedPayoutHoldItem>[] = [
    {
      label: "Mitra & Peran",
      className: "w-[22%]",
      renderCell: (h) => (
        <div className="space-y-1 min-w-0">
          <p className="font-bold text-slate-900 dark:text-white text-xs truncate">{h.mitra_name || "Mitra TemanBicara"}</p>
          <Badge
            variant="outline"
            className={cn(
              "text-[9px] uppercase font-bold px-1.5 py-0",
              h.mitra_role === "psikolog" ? "border-teal-300 text-teal-700 dark:text-teal-400" : "border-indigo-300 text-indigo-700 dark:text-indigo-400"
            )}
          >
            {h.mitra_role === "psikolog" ? "Psikolog" : h.mitra_role === "relawan" ? "Relawan" : (h.mitra_role || "Mitra")}
          </Badge>
        </div>
      ),
    },
    {
      label: currentTab === "deducted" ? "Nominal Sengketa & Terpotong" : "Nominal Sengketa",
      className: "w-[22%]",
      renderCell: (h) => (
        <div className="space-y-0.5 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Sengketa:</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">Rp {h.disputed_amount_rupiah.toLocaleString("id-ID")}</span>
          </div>
          {currentTab === "deducted" && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">Terpotong:</span>
              <span className="font-mono font-bold text-rose-600 dark:text-rose-400">Rp {(h.deducted_amount_rupiah ?? 0).toLocaleString("id-ID")}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      label: "Layanan & Ref Order",
      className: "w-[22%]",
      renderCell: (h) => (
        <div className="space-y-0.5 min-w-0 text-xs">
          <div className="flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200">
            <Tag size={12} className="text-slate-400 shrink-0" />
            <span className="truncate">{h.source_type === "session" ? "Sesi Konseling" : h.source_type === "extension" ? "Perpanjangan Sesi" : "Tip Klien"}</span>
          </div>
          <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">Order: {h.topup_order_ref || h.topup_order_id.slice(0, 12)}</p>
        </div>
      ),
    },
    {
      label: "Status Transaksi",
      align: "center",
      className: "w-[12%]",
      renderCell: (h) => (
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] font-bold px-2 py-0.5 uppercase",
            h.topup_status === "chargeback"
              ? "border-rose-300 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-400"
              : "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-400"
          )}
        >
          {h.topup_status || "Sengketa"}
        </Badge>
      ),
    },
    {
      label: "Tanggal Sengketa",
      className: "w-[12%]",
      renderCell: (h) => (
        <div className="space-y-0.5 text-xs">
          <p className="text-slate-700 dark:text-slate-300 font-medium">
            {new Date(h.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" })}
          </p>
          <p className="text-[10px] text-slate-400 font-mono">
            {new Date(h.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })} WIB
          </p>
        </div>
      ),
    },
    {
      label: "Aksi",
      align: "center",
      className: "w-[10%]",
      renderCell: (h) => {
        if (h.status === "active") {
          return (
            <Button
              size="sm"
              onClick={() => handleOpenResolveDialog(h)}
              className="h-7 text-[11px] px-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg cursor-pointer shadow-2xs"
            >
              Selesaikan
            </Button>
          );
        }
        return (
          <Badge
            className={cn(
              "text-[10px] font-bold",
              h.status === "cleared" ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-200" : "bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border-rose-200"
            )}
          >
            {h.status === "cleared" ? "Dibebaskan" : "Dipotong"}
          </Badge>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8 font-nunito pb-12 text-slate-900 dark:text-slate-100 transition-colors duration-200 min-w-0 max-w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 min-w-0">
        <div className="space-y-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 dark:text-white tracking-tight truncate">
            Pengelolaan Sengketa Payout
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Peninjauan penahanan dana dan eksekusi resolusi sengketa transaksi pembayaran mitra
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchHolds(page, currentTab, limit)}
          disabled={isLoading}
          className="text-xs rounded-xl h-9 gap-1.5 border-slate-200 dark:border-slate-800 cursor-pointer shrink-0"
        >
          <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
          <span>Segarkan</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {SUMMARY_CARDS.map((card) => {
          const IconComp = card.icon;
          return (
            <Card key={card.key} className={cn("rounded-2xl border shadow-2xs", card.border)}>
              <CardContent className="p-4 sm:p-5 flex items-center justify-between">
                <div className="space-y-1 min-w-0">
                  <span className="text-[11px] font-bold uppercase tracking-wider block">{card.label}</span>
                  <p className={cn("text-xl sm:text-2xl font-mono font-bold", card.textVal)}>{currentTab === card.key ? meta.total : "—"}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{card.sub}</p>
                </div>
                <div className={cn("w-10 h-10 rounded-xl text-white flex items-center justify-center shrink-0", card.iconBg)}>
                  <IconComp size={20} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {errorMessage && (
        <div className="p-4 rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50/70 dark:bg-rose-950/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <AlertTriangle size={18} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5 min-w-0">
              <p className="text-xs font-bold text-rose-900 dark:text-rose-200">Gagal Memuat Data Sengketa</p>
              <p className="text-xs text-rose-700 dark:text-rose-300">{errorMessage}</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => fetchHolds(page, currentTab, limit)} className="text-xs rounded-xl h-8 text-rose-700 border-rose-300 hover:bg-rose-100 shrink-0">
            <RefreshCw size={12} className="mr-1" />
            Coba Lagi
          </Button>
        </div>
      )}

      <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
        <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="font-heading text-base sm:text-lg font-bold text-slate-900 dark:text-white">Daftar Penahanan Sengketa Payout</CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito">Pilih tab status di bawah untuk melihat sengketa aktif, dibebaskan, atau dipotong</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <div className="inline-flex rounded-xl p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
                {(["active", "cleared", "deducted"] as DisputedHoldStatus[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleTabChange(t)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg transition-colors cursor-pointer",
                      currentTab === t
                        ? t === "active" ? "bg-amber-500 text-white shadow-2xs font-bold" : t === "cleared" ? "bg-emerald-600 text-white shadow-2xs font-bold" : "bg-rose-600 text-white shadow-2xs font-bold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    )}
                  >
                    {t === "active" ? "Aktif" : t === "cleared" ? "Dibebaskan" : "Dipotong"}
                  </button>
                ))}
              </div>
              <div className="relative flex-1 sm:w-60 min-w-[180px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Cari mitra, order ref..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 size={24} className="animate-spin text-teal-600" />
              <span className="text-xs">Memuat daftar sengketa...</span>
            </div>
          ) : filteredHolds.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400 text-center px-4">
              <AlertCircle size={28} className="text-slate-300 dark:text-slate-600" />
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                {currentTab === "active" ? "Tidak ada penahanan sengketa aktif" : currentTab === "cleared" ? "Belum ada sengketa yang dibebaskan" : "Belum ada sengketa yang dipotong"}
              </p>
              <p className="text-[11px] text-slate-400 max-w-sm">
                {currentTab === "active" ? "Semua penahanan sengketa telah diselesaikan atau belum ada transaksi bermasalah baru." : currentTab === "cleared" ? "Daftar sengketa yang dibebaskan tanpa pemotongan saldo mitra akan muncul di sini." : "Daftar sengketa yang diselesaikan dengan pemotongan saldo mitra akan tercatat di sini."}
              </p>
            </div>
          ) : (
            <Tables<DisputedPayoutHoldItem> columns={columns} data={filteredHolds} rowKey={(h) => h.id} />
          )}

          <TablePaginationFooter totalItems={meta.total} page={page} limit={limit} onPageChange={setPage} onChangeLimit={setLimit} />
        </CardContent>
      </Card>

      {/* Dialog Penyelesaian Sengketa (Konfirmasi 2-Langkah) */}
      <Dialog open={!!selectedHold} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="sm:max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-base font-bold flex items-center gap-2">
              <ShieldAlert size={20} className="text-teal-600 shrink-0" />
              <span>{step === 1 ? "Selesaikan Sengketa Penahanan" : "Konfirmasi Resolusi Sengketa"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              {step === 1 ? "Pilih tindakan resolusi untuk penahanan sengketa payout mitra." : "Langkah 2 dari 2: Periksa kembali rincian resolusi sebelum eksekusi permanen."}
            </DialogDescription>
          </DialogHeader>

          {selectedHold && (
            <div className="space-y-4 py-2 text-xs">
              {dialogError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  <span className="leading-snug">{dialogError}</span>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Nama Mitra:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedHold.mitra_name || "Mitra"} ({selectedHold.mitra_role || "Mitra"})</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Nominal Sengketa:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">Rp {selectedHold.disputed_amount_rupiah.toLocaleString("id-ID")}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Ref Order Midtrans:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{selectedHold.topup_order_ref || selectedHold.topup_order_id}</span>
                </div>
              </div>

              {step === 1 ? (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Tindakan Resolusi</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <label className={cn("flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all", action === "clear" ? "border-teal-500 bg-teal-50/60 dark:bg-teal-950/30 text-teal-950 dark:text-teal-100 ring-1 ring-teal-500" : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700")}>
                        <input type="radio" name="resolutionAction" value="clear" checked={action === "clear"} onChange={() => setAction("clear")} className="mt-0.5 accent-teal-600 cursor-pointer" />
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold">Bebaskan (Clear)</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">Buka penahanan sengketa tanpa memotong saldo mitra.</p>
                        </div>
                      </label>
                      <label className={cn("flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all", action === "deduct" ? "border-rose-500 bg-rose-50/60 dark:bg-rose-950/30 text-rose-950 dark:text-rose-100 ring-1 ring-rose-500" : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700")}>
                        <input type="radio" name="resolutionAction" value="deduct" checked={action === "deduct"} onChange={() => setAction("deduct")} className="mt-0.5 accent-rose-600 cursor-pointer" />
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-rose-700 dark:text-rose-400">Potong Saldo (Deduct)</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">Potong saldo dompet mitra permanen untuk mengganti sengketa.</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {action === "deduct" && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2.5">
                      <AlertTriangle size={18} className="shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                      <div className="space-y-0.5 min-w-0">
                        <p className="font-bold text-rose-900 dark:text-rose-200">Peringatan Pemotongan Saldo Permanen</p>
                        <p className="text-[11px] leading-relaxed text-rose-700 dark:text-rose-300">
                          Aksi ini akan memotong saldo dompet mitra secara permanen melalui pencatatan buku besar (ledger). Tindakan ini tidak dapat dibatalkan setelah dikonfirmasi.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Catatan Resolusi <span className="text-rose-500">*</span></label>
                      <span className={cn("text-[10px] font-mono", note.length > 1000 ? "text-rose-500 font-bold" : "text-slate-400")}>{note.length} / 1.000</span>
                    </div>
                    <textarea
                      rows={3}
                      placeholder="Contoh: Refund disetujui bank penerbit atas permintaan chargeback pasien..."
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={1000}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <Button variant="outline" size="sm" onClick={handleCloseDialog} className="text-xs rounded-xl h-8 cursor-pointer">Batal</Button>
                    <Button
                      size="sm"
                      onClick={handleProceedToStep2}
                      disabled={!note.trim() || note.length > 1000}
                      className="text-xs rounded-xl h-8 bg-teal-600 hover:bg-teal-700 text-white font-bold gap-1 cursor-pointer"
                    >
                      <span>Lanjutkan</span>
                      <ArrowRight size={13} />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 space-y-2">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Ringkasan Resolusi</p>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Tindakan:</span>
                        <span className={cn("font-bold", action === "deduct" ? "text-rose-600 dark:text-rose-400" : "text-teal-600 dark:text-teal-400")}>
                          {action === "deduct" ? "Potong Saldo Permanen (Deduct)" : "Bebaskan Penahanan (Clear)"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Dampak Saldo:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {action === "deduct" ? "Saldo mitra akan berkurang sebatas sengketa" : "Saldo mitra tidak berkurang sama sekali"}
                        </span>
                      </div>
                      <div className="pt-1 border-t border-slate-200 dark:border-slate-700">
                        <span className="text-slate-500 block mb-0.5">Catatan:</span>
                        <p className="text-slate-800 dark:text-slate-200 italic bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px]">&ldquo;{note.trim()}&rdquo;</p>
                      </div>
                    </div>
                  </div>

                  <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 cursor-pointer select-none">
                    <input type="checkbox" checked={isConfirmed} onChange={(e) => setIsConfirmed(e.target.checked)} className="mt-0.5 accent-teal-600 rounded cursor-pointer" />
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white">Konfirmasi Persetujuan Eksekusi</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">Saya telah memverifikasi bukti transaksi dan menyetujui resolusi sengketa ini secara sah.</p>
                    </div>
                  </label>

                  <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
                    <Button variant="outline" size="sm" onClick={() => setStep(1)} disabled={isSubmitting} className="text-xs rounded-xl h-8 gap-1 cursor-pointer">
                      <ArrowLeft size={13} />
                      <span>Kembali</span>
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleExecuteResolution}
                      disabled={!isConfirmed || isSubmitting}
                      className={cn("text-xs rounded-xl h-8 text-white font-bold gap-1.5 cursor-pointer shadow-2xs", action === "deduct" ? "bg-rose-600 hover:bg-rose-700" : "bg-teal-600 hover:bg-teal-700")}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          <span>Memproses...</span>
                        </>
                      ) : (
                        <>
                          <Check size={13} />
                          <span>Eksekusi Resolusi</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
