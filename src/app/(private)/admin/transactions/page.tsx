"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tables, TablePaginationFooter, Column } from "@/components/shared/atoms/Table";
import { notify } from "@/lib/toast";
import { walletClient, WalletApiError } from "@/services/wallet.client";
import type { AdminPayoutItem, PaginationMeta, PayoutStatus } from "@/types/wallet";
import {
  CheckCircle2,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Check,
  X,
  FileText,
  Search,
  Loader2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { PageHeader } from "@/components/shared/molecules/page-header";
import { PageShell } from "@/components/shared/templates/page-shell";
import { FilterTabs } from "@/components/shared/molecules/filter-tabs";
import { LoadingState } from "@/components/shared/atoms/loading-state";

export default function AdminTransactionsPage() {
  const [mounted, setMounted] = useState<boolean>(false);
  const [payouts, setPayouts] = useState<AdminPayoutItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);
  const [statusFilter, setStatusFilter] = useState<PayoutStatus | "all">("requested");
  const [search, setSearch] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Modal dialog state
  const [selectedPayout, setSelectedPayout] = useState<AdminPayoutItem | null>(null);
  const [actionType, setActionType] = useState<"paid" | "reject" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchPayouts = useCallback(async (targetPage: number, status: PayoutStatus | "all", targetLimit: number = limit) => {
    try {
      setIsLoading(true);
      const queryStatus = status === "all" ? undefined : status;
      const res = await walletClient.getAdminPayouts({
        status: queryStatus,
        page: targetPage,
        limit: targetLimit,
      });
      setPayouts(res.items);
      setMeta(res.meta);
    } catch (err) {
      if (err instanceof WalletApiError && err.handled) return;
      console.error("Gagal memuat antrean payout admin:", err);
      if (err instanceof WalletApiError) {
        notify.error("Gagal Memuat Antrean", err.message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    setMounted(true);
    fetchPayouts(page, statusFilter, limit);
  }, [fetchPayouts, page, statusFilter, limit]);

  const handleFilterChange = (newStatus: PayoutStatus | "all") => {
    setStatusFilter(newStatus);
    setPage(1);
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  };

  // Filtered search list
  const filteredPayouts = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return payouts;
    return payouts.filter((p) => {
      return (
        p.id.toLowerCase().includes(q) ||
        (p.mitra_name && p.mitra_name.toLowerCase().includes(q)) ||
        p.bank_name.toLowerCase().includes(q) ||
        p.account_number.toLowerCase().includes(q) ||
        p.bank_account_name.toLowerCase().includes(q) ||
        (p.mitra_role && p.mitra_role.toLowerCase().includes(q))
      );
    });
  }, [payouts, search]);

  // Aggregate metrics
  const pendingCount = useMemo(() => {
    return payouts.filter((p) => p.status === "requested").length;
  }, [payouts]);

  const totalPendingNominal = useMemo(() => {
    return payouts
      .filter((p) => p.status === "requested")
      .reduce((acc, curr) => acc + curr.amount_rupiah, 0);
  }, [payouts]);

  // Actions
  const handleOpenPaidModal = (item: AdminPayoutItem) => {
    setSelectedPayout(item);
    setActionType("paid");
    setActionError(null);
  };

  const handleOpenRejectModal = (item: AdminPayoutItem) => {
    setSelectedPayout(item);
    setActionType("reject");
    setActionError(null);
  };

  const handleConfirmAction = async () => {
    if (!selectedPayout || !actionType) return;

    try {
      setIsProcessing(true);
      setActionError(null);
      if (actionType === "paid") {
        if (selectedPayout.has_dispute_hold) {
          setActionError("Permohonan ini memiliki sengketa aktif. Selesaikan sengketa terlebih dahulu.");
          notify.error("Tidak Dapat Memproses", "Selesaikan sengketa terlebih dahulu.");
          return;
        }
        await walletClient.markAdminPayoutPaid(selectedPayout.id);
        notify.success(
          "Payout Ditandai Lunas!",
          `Pencairan dana Rp ${selectedPayout.amount_rupiah.toLocaleString("id-ID")} ke ${selectedPayout.bank_account_name} (${selectedPayout.bank_name}) telah dicatat lunas.`
        );
      } else if (actionType === "reject") {
        await walletClient.rejectAdminPayout(selectedPayout.id);
        notify.warning(
          "Pengajuan Payout Ditolak",
          `Pengajuan payout telah ditolak. Saldo sebesar Rp ${(selectedPayout.amount_rupiah + selectedPayout.fee_rupiah).toLocaleString("id-ID")} telah dikembalikan ke dompet mitra.`
        );
      }

      setActionType(null);
      setSelectedPayout(null);
      fetchPayouts(page, statusFilter);
    } catch (err) {
      if (err instanceof WalletApiError) {
        setActionError(err.message);
        notify.error("Gagal Memproses Aksi", err.message);
      } else {
        const msg = "Terjadi kesalahan sistem saat memperbarui status payout.";
        setActionError(msg);
        notify.error("Kesalahan Sistem", msg);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const columns: Column<AdminPayoutItem>[] = [
    {
      label: "Waktu Pengajuan",
      className: "w-[18%]",
      renderCell: (p) => {
        const dateStr = new Date(p.requested_at).toLocaleString("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        return (
          <div className="space-y-0.5">
            <p className="font-semibold text-slate-900 dark:text-white text-xs">{dateStr} WIB</p>
            <span className="text-[10px] font-mono text-slate-400 block truncate max-w-[120px]" title={p.id}>
              ID: {p.id.slice(0, 8)}...
            </span>
          </div>
        );
      },
    },
    {
      label: "Mitra Pemohon",
      className: "w-[22%]",
      renderCell: (p) => (
        <div className="space-y-0.5">
          <p className="font-bold text-slate-900 dark:text-white text-xs">
            {p.mitra_name || "Mitra TemanBicara"}
          </p>
          <div className="flex items-center gap-1.5">
            <Badge
              variant="outline"
              className={`text-[9px] uppercase font-bold px-1.5 py-0 ${
                p.mitra_role === "psikolog"
                  ? "border-teal-300 text-teal-700 dark:text-teal-400"
                  : "border-indigo-300 text-indigo-700 dark:text-indigo-400"
              }`}
            >
              {p.mitra_role || "Mitra"}
            </Badge>
          </div>
        </div>
      ),
    },
    {
      label: "Rekening Bank & Pemilik",
      className: "w-[24%]",
      renderCell: (p) => (
        <div>
          <p className="font-bold text-slate-800 dark:text-slate-200 text-xs">{p.bank_name}</p>
          <p className="text-[11px] font-mono text-slate-600 dark:text-slate-400 font-semibold">
            {p.account_number}
          </p>
          <span className="text-[11px] text-slate-500 block">a.n. {p.bank_account_name}</span>
        </div>
      ),
    },
    {
      label: "Nominal & Fee",
      className: "w-[18%]",
      renderCell: (p) => (
        <div>
          <p className="font-mono font-bold text-xs text-slate-900 dark:text-white">
            Rp {p.amount_rupiah.toLocaleString("id-ID")}
          </p>
          <span className="text-[10px] text-slate-400 font-mono block">
            +Fee: Rp {p.fee_rupiah.toLocaleString("id-ID")}
          </span>
          <span className="text-[10px] font-mono font-semibold text-rose-600 dark:text-rose-400 block">
            Total: Rp {(p.amount_rupiah + p.fee_rupiah).toLocaleString("id-ID")}
          </span>
        </div>
      ),
    },
    {
      label: "Status & Aksi",
      align: "center",
      className: "w-[18%]",
      renderCell: (p) => {
        if (p.status === "requested") {
          const isHeld = p.has_dispute_hold === true;
          const holdHint = "Selesaikan sengketa terlebih dahulu";
          return (
            <div className="flex flex-col items-center gap-1.5 min-w-0">
              {isHeld && (
                <Badge className="max-w-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-900 text-[10px] font-bold gap-1 whitespace-normal text-center">
                  <ShieldAlert size={11} className="shrink-0" />
                  <span className="min-w-0">
                    Tertahan sengketa Rp {(p.dispute_hold_amount ?? 0).toLocaleString("id-ID")}
                  </span>
                </Badge>
              )}
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenRejectModal(p)}
                  className="h-7 text-[11px] px-2 text-rose-700 border-rose-200 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950 font-bold rounded-lg cursor-pointer"
                  title="Tolak pengajuan dan kembalikan saldo ke mitra"
                >
                  <X size={12} className="mr-0.5" />
                  <span>Tolak</span>
                </Button>
                {/* span pembungkus: tombol disabled tidak menerima hover, jadi tooltip dipasang di sini juga */}
                <span title={isHeld ? holdHint : undefined} className={isHeld ? "cursor-not-allowed" : undefined}>
                  <Button
                    size="sm"
                    onClick={() => handleOpenPaidModal(p)}
                    disabled={isHeld}
                    aria-label={isHeld ? `Tandai Lunas — ${holdHint}` : undefined}
                    className="h-7 text-[11px] px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer shadow-2xs"
                    title={isHeld ? holdHint : "Tandai pembayaran telah ditransfer ke rekening mitra"}
                  >
                    <Check size={12} className="mr-0.5" />
                    <span>Tandai Lunas</span>
                  </Button>
                </span>
              </div>
              {isHeld && (
                <Link
                  href="/admin/sengketa"
                  className="text-[11px] font-bold text-rose-700 dark:text-rose-400 underline underline-offset-2 hover:text-rose-800 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                >
                  Lihat Sengketa
                </Link>
              )}
            </div>
          );
        }

        if (p.status === "paid") {
          return (
            <Badge className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-200 text-[10px] font-bold">
              Lunas Ditransfer
            </Badge>
          );
        }

        return (
          <Badge className="bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border-rose-200 text-[10px] font-bold">
            Ditolak & Saldo Pulih
          </Badge>
        );
      },
    },
  ];

  return (
    <PageShell>
      {/* 1. Header Halaman */}
      <PageHeader
        title="Antrean Payout & Audit Transaksi"
        description="Verifikasi pengajuan penarikan dana honor psikolog klinis & relawan pendengar TemanBicara"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchPayouts(page, statusFilter)}
              disabled={isLoading}
              className="text-xs rounded-xl h-9 gap-1.5 border-slate-200 dark:border-slate-800"
            >
              <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
              <span>Segarkan Antrean</span>
            </Button>
          </>
        }
      />

      {/* 2. Kartu Ringkasan Antrean */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 shadow-2xs">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider block">
                Menunggu Konfirmasi
              </span>
              <p className="text-xl sm:text-2xl font-bold font-heading text-slate-900 dark:text-white font-mono">
                {pendingCount} Permintaan
              </p>
              <p className="text-[11px] text-amber-700/80 dark:text-amber-400 font-mono">
                Total: Rp {totalPendingNominal.toLocaleString("id-ID")}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
              <Clock size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Total Pengajuan
              </span>
              <p className="text-xl sm:text-2xl font-bold font-heading text-slate-900 dark:text-white font-mono">
                {meta.total} Pengajuan
              </p>
              <p className="text-[11px] text-slate-400">Seluruh status di sistem</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
              <FileText size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-teal-200 dark:border-teal-800/80 bg-teal-50/40 dark:bg-teal-950/20 shadow-2xs">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-teal-800 dark:text-teal-300 uppercase tracking-wider block">
                Integritas Buku Besar
              </span>
              <p className="text-sm font-bold text-teal-900 dark:text-teal-200 pt-1">
                Buku Besar Tercatat
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Setiap mutasi saldo dicatat di ledger_entries
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0">
              <ShieldCheck size={20} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Antrean Payout Table */}
      <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
        <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="font-heading text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Daftar Pengajuan Penarikan Dana Mitra
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
                Gunakan tombol aksi untuk menyetujui transfer atau menolak pengajuan
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto min-w-0">
              {/* Status Filter Buttons */}
              <FilterTabs
                ariaLabel="Filter status payout"
                value={statusFilter}
                onChange={handleFilterChange}
                options={[
                  { value: "requested", label: "Menunggu", tone: "amber" },
                  { value: "paid", label: "Lunas", tone: "emerald" },
                  { value: "rejected", label: "Ditolak", tone: "rose" },
                  { value: "all", label: "Semua", tone: "neutral" },
                ]}
              />

              {/* Search Bar */}
              <div className="relative flex-1 w-full sm:w-60 min-w-0">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Cari mitra, bank, nama..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl w-full"
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <LoadingState label="Memuat antrean payout..." className="py-16" />
          ) : filteredPayouts.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400 text-center px-4">
              <AlertCircle size={28} className="text-slate-300 dark:text-slate-600" />
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Tidak ada pengajuan payout pada filter ini
              </p>
              <p className="text-[11px] text-slate-400 max-w-sm">
                Permintaan penarikan dana dari mitra yang berstatus {statusFilter === "all" ? "apa pun" : statusFilter} akan muncul di sini.
              </p>
            </div>
          ) : (
            <Tables<AdminPayoutItem>
              columns={columns}
              data={filteredPayouts}
              rowKey={(p) => p.id}
            />
          )}

          {/* Pagination Footer */}
          <TablePaginationFooter
            totalItems={meta.total}
            page={page}
            limit={limit}
            onPageChange={setPage}
            onChangeLimit={handleLimitChange}
          />
        </CardContent>
      </Card>

      {/* Dialog Konfirmasi: Tandai Lunas atau Tolak */}
      <Dialog open={!!selectedPayout && !!actionType} onOpenChange={(open) => !open && setActionType(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="font-heading text-base font-bold flex items-center gap-2">
              {actionType === "paid" ? (
                <>
                  <CheckCircle2 size={20} className="text-emerald-600" />
                  <span>Konfirmasi Pembayaran Payout</span>
                </>
              ) : (
                <>
                  <AlertTriangle size={20} className="text-rose-600" />
                  <span>Konfirmasi Penolakan Payout</span>
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {actionType === "paid"
                ? "Pastikan dana telah berhasil ditransfer melalui sistem kliring perbankan."
                : "Dana penarikan beserta biaya admin akan dikembalikan ke saldo mitra."}
            </DialogDescription>
          </DialogHeader>

          {selectedPayout && (
            <div className="space-y-3 py-2 text-xs">
              {actionError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                <span className="leading-snug">{actionError}</span>
              </div>
            )}

            {selectedPayout.has_dispute_hold && actionType === "paid" && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                <span className="leading-snug">
                  Mitra ini memiliki penahanan sengketa aktif sebesar Rp {(selectedPayout.dispute_hold_amount ?? 0).toLocaleString("id-ID")}. Selesaikan sengketa terlebih dahulu di{" "}
                  <Link href="/admin/sengketa" className="underline font-bold text-rose-800 dark:text-rose-200">
                    /admin/sengketa
                  </Link>
                  .
                </span>
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Nama Pemohon:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {selectedPayout.mitra_name || "Mitra"} ({selectedPayout.mitra_role || "Mitra"})
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Bank & No Rekening:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {selectedPayout.bank_name} - {selectedPayout.account_number}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Nama Pemilik Rekening:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {selectedPayout.bank_account_name}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <span className="text-slate-500">Nominal Penarikan:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    Rp {selectedPayout.amount_rupiah.toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Biaya Transfer Bank:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    Rp {selectedPayout.fee_rupiah.toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <span className="font-bold text-slate-900 dark:text-white">Total Terpotong:</span>
                  <span className="font-mono font-bold text-rose-600 text-sm">
                    Rp {(selectedPayout.amount_rupiah + selectedPayout.fee_rupiah).toLocaleString("id-ID")}
                  </span>
                </div>
              </div>

              {actionType === "paid" ? (
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 leading-snug">
                  Dengan mengklik &quot;Tandai Lunas&quot;, buku besar akan mendebit kas keluar platform dan menandai pengajuan telah selesai.
                </p>
              ) : (
                <p className="text-[11px] text-rose-700 dark:text-rose-400 leading-snug">
                  Dengan mengklik &quot;Tolak Pengajuan&quot;, saldo sebesar Rp {(selectedPayout.amount_rupiah + selectedPayout.fee_rupiah).toLocaleString("id-ID")} akan dikembalikan secara atomik ke saldo siap cair mitra.
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setActionType(null);
                setSelectedPayout(null);
              }}
              disabled={isProcessing}
              className="text-xs rounded-xl"
            >
              Batal
            </Button>
            {actionType === "paid" ? (
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmAction}
                disabled={isProcessing}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-xl gap-1.5"
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <span>Tandai Lunas & Bukukan</span>
                )}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmAction}
                disabled={isProcessing}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs rounded-xl gap-1.5"
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <span>Tolak & Kembalikan Saldo</span>
                )}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
