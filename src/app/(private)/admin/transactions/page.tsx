"use client";

import React, { useState, useEffect } from "react";
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
import {
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Download,
  Building2,
  Calendar,
  CheckCircle2,
  XCircle,
  CreditCard,
  History,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Check,
  X,
  FileText,
} from "lucide-react";
import { usePayoutStore, PayoutRecord } from "@/store/payout-store";
import { useTransactionStore } from "@/store/transaction-store";

export default function AdminTransactionsPage() {
  const [mounted, setMounted] = useState(false);
  const payouts = usePayoutStore((state) => state.payouts);
  const approvePayout = usePayoutStore((state) => state.approvePayout);
  const rejectPayout = usePayoutStore((state) => state.rejectPayout);
  const transactions = useTransactionStore((state) => state.transactions);

  const [activeTab, setActiveTab] = useState<"all" | "payout" | "topup" | "session">("payout");
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Modal approval/rejection state
  const [selectedPayout, setSelectedPayout] = useState<PayoutRecord | null>(null);
  const [modalMode, setModalMode] = useState<"approve" | "reject" | null>(null);
  const [rejectReason, setRejectReason] = useState("Nomor rekening bank atau nama pemilik tidak sesuai SIPPK.");

  useEffect(() => {
    setMounted(true);
  }, []);

  const pendingPayouts = payouts.filter((p) => p.status === "Diproses");
  const approvedPayouts = payouts.filter((p) => p.status === "Berhasil");

  const totalWithdrawnRupiah = approvedPayouts.reduce((acc, curr) => acc + curr.amountRupiah, 0);
  const pendingWithdrawnRupiah = pendingPayouts.reduce((acc, curr) => acc + curr.amountRupiah, 0);

  const handleOpenApprove = (payout: PayoutRecord) => {
    setSelectedPayout(payout);
    setModalMode("approve");
  };

  const handleOpenReject = (payout: PayoutRecord) => {
    setSelectedPayout(payout);
    setModalMode("reject");
    setRejectReason("Data nomor rekening tidak sesuai dokumen verifikasi SIPPK.");
  };

  const handleConfirmApprove = () => {
    if (!selectedPayout) return;
    const ok = approvePayout(selectedPayout.id);
    if (ok) {
      setFeedback({
        type: "success",
        message: `Transfer honor ${selectedPayout.invoiceNo} sebesar Rp ${selectedPayout.amountRupiah.toLocaleString("id-ID")} berhasil disetujui & dicatat.`,
      });
      setTimeout(() => setFeedback(null), 4000);
    }
    setModalMode(null);
    setSelectedPayout(null);
  };

  const handleConfirmReject = () => {
    if (!selectedPayout) return;
    const ok = rejectPayout(selectedPayout.id, rejectReason);
    if (ok) {
      setFeedback({
        type: "error",
        message: `Pengajuan ${selectedPayout.invoiceNo} ditolak. ${selectedPayout.coinsDeducted} Koin telah dikembalikan ke dompet psikolog.`,
      });
      setTimeout(() => setFeedback(null), 4000);
    }
    setModalMode(null);
    setSelectedPayout(null);
  };

  // Filter payouts
  const filteredPayouts = payouts.filter((p) => {
    const matchSearch =
      p.invoiceNo.toLowerCase().includes(search.toLowerCase()) ||
      p.counselorName.toLowerCase().includes(search.toLowerCase()) ||
      p.bankName.toLowerCase().includes(search.toLowerCase()) ||
      p.accountNo.includes(search);
    return matchSearch;
  });

  // Filter transactions
  const filteredTransactions = transactions.filter((tx) => {
    const matchSearch =
      tx.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      tx.title.toLowerCase().includes(search.toLowerCase()) ||
      tx.targetParty.toLowerCase().includes(search.toLowerCase());

    if (activeTab === "topup") return matchSearch && tx.type === "topup";
    if (activeTab === "session") return matchSearch && tx.type === "usage";
    return matchSearch;
  });

  return (
    <div className="space-y-6 sm:space-y-8 font-nunito pb-12 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 dark:text-white tracking-tight">
            Audit Finansial & Persetujuan Payout
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Log audit terpadu arus kas masuk platform, verifikasi transfer honor psikolog, dan komisi sistem (10%)
          </p>
        </div>

        <Button
          onClick={() => alert("Mengunduh laporan audit finansial format CSV...")}
          className="text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-xl px-4 py-2 h-9 font-semibold shadow-xs gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <Download size={15} />
          <span>Ekspor Laporan CSV</span>
        </Button>
      </div>

      {/* Alert Banner Feedback */}
      {feedback && (
        <div
          className={`flex items-center gap-2.5 p-3.5 rounded-xl border text-xs font-semibold animate-in fade-in ${
            feedback.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/70 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950/70 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle size={16} className="text-rose-600 dark:text-rose-400 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* 2. Stat Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Total Volume Pembelian Koin</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600">
              <Coins size={14} />
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-heading text-emerald-700 dark:text-emerald-400">
            Rp 485.000.000
          </p>
          <span className="text-[11px] text-slate-400 font-nunito">Arus kas masuk bruto (Pasien)</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Total Pencairan Honor Psikolog</span>
            <span className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950 text-teal-600">
              <Building2 size={14} />
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-heading text-slate-900 dark:text-white">
            Rp {(totalWithdrawnRupiah || 17000000).toLocaleString("id-ID")}
          </p>
          <span className="text-[11px] text-slate-400 font-nunito">
            {approvedPayouts.length} transfer telah terverifikasi sukses
          </span>
        </div>

        <div
          className={`p-5 rounded-2xl border shadow-2xs space-y-1.5 transition-all ${
            pendingPayouts.length > 0
              ? "bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800/80"
              : "bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-medium">
            <span className={pendingPayouts.length > 0 ? "text-amber-800 dark:text-amber-300 font-bold" : "text-slate-500"}>
              Pengajuan Payout Tertunda
            </span>
            <Badge
              className={`text-[10px] ${
                pendingPayouts.length > 0
                  ? "bg-amber-600 text-white animate-pulse"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-500"
              }`}
            >
              {pendingPayouts.length} Menunggu
            </Badge>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-heading text-amber-700 dark:text-amber-400">
            Rp {pendingWithdrawnRupiah.toLocaleString("id-ID")}
          </p>
          <span className="text-[11px] text-amber-700/80 dark:text-amber-400/80 font-nunito font-semibold">
            {pendingPayouts.length > 0 ? "Memerlukan otorisasi transfer admin" : "Semua pengajuan telah diproses"}
          </span>
        </div>
      </div>

      {/* 3. Filter Bar & Table */}
      <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
        <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                {
                  key: "payout" as const,
                  label: "Pencairan Honor (Payout)",
                  badge: pendingPayouts.length > 0 ? pendingPayouts.length : undefined,
                },
                { key: "all" as const, label: "Semua Transaksi Koin" },
                { key: "topup" as const, label: "Top Up Koin" },
                { key: "session" as const, label: "Sesi Konseling" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === tab.key
                      ? "bg-teal-600 text-white shadow-2xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center font-bold">
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="w-full sm:w-64">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari invoice / nama / bank..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-9 pl-8 pr-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 sm:p-2">
          {activeTab === "payout" ? (
            /* TAB 1: PAYOUT HONOR APPROVAL TABLE */
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 text-slate-600 dark:text-slate-400 font-semibold">
                    <th className="p-3.5 pl-4">No Invoice & Waktu</th>
                    <th className="p-3.5">Psikolog</th>
                    <th className="p-3.5">Rekening Tujuan</th>
                    <th className="p-3.5">Koin Ditukar</th>
                    <th className="p-3.5">Nominal Transfer</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 pr-4 text-right">Otorisasi & Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredPayouts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        Tidak ada riwayat pengajuan payout yang sesuai.
                      </td>
                    </tr>
                  ) : (
                    filteredPayouts.map((p) => {
                      const isPending = p.status === "Diproses";
                      return (
                        <tr
                          key={p.id}
                          className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors ${
                            isPending ? "bg-amber-50/30 dark:bg-amber-950/20" : ""
                          }`}
                        >
                          <td className="p-3.5 pl-4">
                            <p className="font-mono font-semibold text-slate-900 dark:text-white">{p.invoiceNo}</p>
                            <span className="text-[10px] text-slate-400 font-nunito">{p.date}</span>
                          </td>
                          <td className="p-3.5">
                            <p className="font-bold text-slate-800 dark:text-slate-200">{p.counselorName}</p>
                            <span className="text-[10px] text-teal-700 dark:text-teal-400 font-medium">Praktisi SIPPK</span>
                          </td>
                          <td className="p-3.5">
                            <p className="font-semibold text-slate-900 dark:text-white">{p.bankName}</p>
                            <p className="font-mono text-[11px] text-slate-500">
                              {p.accountNo} <span className="text-[10px]">({p.accountHolder})</span>
                            </p>
                          </td>
                          <td className="p-3.5 font-mono font-bold text-rose-600 dark:text-rose-400">
                            -{p.coinsDeducted} Koin
                          </td>
                          <td className="p-3.5 font-mono font-bold text-slate-900 dark:text-white">
                            Rp {p.amountRupiah.toLocaleString("id-ID")}
                          </td>
                          <td className="p-3.5">
                            <Badge
                              className={`text-[10px] ${
                                p.status === "Berhasil"
                                  ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200"
                                  : p.status === "Diproses"
                                  ? "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200"
                                  : "bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200"
                              }`}
                            >
                              {p.status}
                            </Badge>
                          </td>
                          <td className="p-3.5 pr-4 text-right">
                            {isPending ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  onClick={() => handleOpenApprove(p)}
                                  className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg px-2.5 shadow-2xs gap-1 cursor-pointer"
                                >
                                  <Check size={12} />
                                  <span>Setujui Transfer</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenReject(p)}
                                  className="h-7 text-[11px] border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/40 rounded-lg px-2.5 cursor-pointer gap-1"
                                >
                                  <X size={12} />
                                  <span>Tolak</span>
                                </Button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">
                                {p.status === "Berhasil" ? "Transfer Selesai" : "Pengajuan Dibatalkan"}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* TAB 2: AUDIT MUTASI KOIN & TRANSAKSI PASIEN */
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 text-slate-600 dark:text-slate-400 font-semibold">
                    <th className="p-3.5 pl-4">No Transaksi & Waktu</th>
                    <th className="p-3.5">Kategori & Judul</th>
                    <th className="p-3.5">Pihak Terkait</th>
                    <th className="p-3.5">Mutasi Koin</th>
                    <th className="p-3.5">Metode Bayar</th>
                    <th className="p-3.5">Catatan Audit</th>
                    <th className="p-3.5 pr-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        Tidak ada log transaksi koin yang sesuai.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-3.5 pl-4">
                          <p className="font-mono font-semibold text-slate-900 dark:text-white">{tx.invoiceNumber}</p>
                          <span className="text-[10px] text-slate-400 font-nunito">{tx.date}</span>
                        </td>
                        <td className="p-3.5">
                          <p className="font-bold text-slate-800 dark:text-slate-200">{tx.title}</p>
                          <span className="text-[10px] text-teal-700 dark:text-teal-400 font-semibold">
                            {tx.category}
                          </span>
                        </td>
                        <td className="p-3.5 font-medium text-slate-700 dark:text-slate-300">
                          {tx.targetParty}
                        </td>
                        <td className="p-3.5 font-mono font-bold">
                          <span
                            className={
                              tx.coinChange >= 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400"
                            }
                          >
                            {tx.coinChange >= 0 ? `+${tx.coinChange}` : tx.coinChange} Koin
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-600 dark:text-slate-400 font-medium">
                          {tx.paymentMethod}
                        </td>
                        <td className="p-3.5 text-slate-500 text-[11px] max-w-xs truncate">
                          {tx.notes || "-"}
                        </td>
                        <td className="p-3.5 pr-4 text-right">
                          <Badge className="bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-200 text-[10px]">
                            {tx.status}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. DIALOG: KONFIRMASI APPROVE PAYOUT */}
      <Dialog open={modalMode === "approve"} onOpenChange={() => setModalMode(null)}>
        <DialogContent className="max-w-md font-nunito p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
          <DialogHeader className="space-y-1 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <ShieldCheck size={18} />
              </div>
              <div>
                <DialogTitle className="text-base font-bold font-heading text-slate-900 dark:text-white">
                  Otorisasi Pencairan Honor
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Konfirmasi pengiriman dana transfer bank ke psikolog
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {selectedPayout && (
            <div className="space-y-4 pt-2 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">No Invoice:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{selectedPayout.invoiceNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Nama Psikolog:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{selectedPayout.counselorName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Rekening Tujuan:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {selectedPayout.bankName} - {selectedPayout.accountNo}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Atas Nama:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{selectedPayout.accountHolder}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Nominal Transfer Riil:</span>
                  <span className="text-base font-bold font-mono text-emerald-700 dark:text-emerald-400">
                    Rp {selectedPayout.amountRupiah.toLocaleString("id-ID")}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed font-nunito">
                Dengan menyetujui, Anda memastikan transfer antarbank telah berhasil dilakukan. Status payout akan diperbarui menjadi <strong>Berhasil</strong> dan psikolog akan menerima notifikasi konfirmasi.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalMode(null)}
                  className="text-xs h-9 rounded-xl px-4 cursor-pointer"
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmApprove}
                  className="text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl px-4 cursor-pointer gap-1.5"
                >
                  <CheckCircle2 size={14} />
                  <span>Setujui & Konfirmasi Transfer</span>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 5. DIALOG: REJECT PAYOUT */}
      <Dialog open={modalMode === "reject"} onOpenChange={() => setModalMode(null)}>
        <DialogContent className="max-w-md font-nunito p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
          <DialogHeader className="space-y-1 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} />
              </div>
              <div>
                <DialogTitle className="text-base font-bold font-heading text-slate-900 dark:text-white">
                  Tolak Pengajuan Payout
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Koin yang ditarik akan secara otomatis dikembalikan ke dompet psikolog
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {selectedPayout && (
            <div className="space-y-4 pt-2 text-xs">
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/60 space-y-1 text-rose-900 dark:text-rose-300">
                <p className="font-semibold">
                  {selectedPayout.counselorName} • {selectedPayout.invoiceNo}
                </p>
                <p className="font-mono">
                  {selectedPayout.coinsDeducted} Koin (Rp {selectedPayout.amountRupiah.toLocaleString("id-ID")})
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Alasan Penolakan:
                </label>
                <Input
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Contoh: Nomor rekening tidak cocok dengan nama SIPPK"
                  className="h-9 text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalMode(null)}
                  className="text-xs h-9 rounded-xl px-4 cursor-pointer"
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmReject}
                  className="text-xs h-9 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl px-4 cursor-pointer gap-1.5"
                >
                  <XCircle size={14} />
                  <span>Tolak & Kembalikan Koin</span>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
