"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useUserStore } from "@/store/user-store";
import { useTransactionStore, TransactionRecord } from "@/store/transaction-store";
import { InvoiceModal } from "@/components/views/top-up/invoice-modal";
import {
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  FileText,
  Building2,
  Calendar,
  Wallet,
  CheckCircle2,
  Clock,
  ArrowLeft,
  PlusCircle,
  Eye,
  CreditCard,
  Sparkles,
} from "lucide-react";

export default function PatientTransactionHistoryPage() {
  const user = useUserStore((state) => state.user);
  const rawTransactions = useTransactionStore((state) => state.transactions);

  const [mounted, setMounted] = useState<boolean>(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedTx, setSelectedTx] = useState<TransactionRecord | null>(null);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const transactions = mounted ? rawTransactions : [];

  // Filtered List
  const filteredList = useMemo(() => {
    return transactions.filter((tx) => {
      const matchType =
        filterType === "all" ||
        (filterType === "topup" && tx.type === "topup") ||
        (filterType === "usage" && tx.type === "usage") ||
        (filterType === "refund" && tx.type === "refund");

      const q = searchQuery.toLowerCase();
      const matchQuery =
        !q ||
        tx.title.toLowerCase().includes(q) ||
        tx.targetParty.toLowerCase().includes(q) ||
        tx.invoiceNumber.toLowerCase().includes(q) ||
        tx.category.toLowerCase().includes(q) ||
        tx.paymentMethod.toLowerCase().includes(q);

      return matchType && matchQuery;
    });
  }, [transactions, filterType, searchQuery]);

  // Aggregate metrics
  const totalCoinsIn = useMemo(
    () =>
      transactions
        .filter((t) => t.coinChange > 0)
        .reduce((acc, curr) => acc + curr.coinChange, 0),
    [transactions]
  );

  const totalCoinsOut = useMemo(
    () =>
      transactions
        .filter((t) => t.coinChange < 0)
        .reduce((acc, curr) => acc + Math.abs(curr.coinChange), 0),
    [transactions]
  );

  const totalSpentRupiah = useMemo(
    () =>
      transactions
        .filter((t) => t.type === "topup" && t.amountRupiah)
        .reduce((acc, curr) => acc + (curr.amountRupiah || 0), 0),
    [transactions]
  );

  const handleOpenInvoice = (tx: TransactionRecord) => {
    setSelectedTx(tx);
    setIsInvoiceOpen(true);
  };

  return (
    <div className="flex flex-col gap-6 font-nunito pb-12 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href="/patient/top-up">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                title="Kembali ke Halaman Top Up"
              >
                <ArrowLeft size={16} />
              </Button>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 dark:text-white tracking-tight">
              Mutasi & Riwayat Koin
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 pl-10">
            Transparansi arus koin masuk, penggunaan sesi konsultasi, dan kuitansi pembayaran resmi
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-center">
          <Link href="/patient/top-up">
            <Button className="text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-xl px-4 py-2 h-9 font-semibold shadow-xs gap-1.5 cursor-pointer">
              <PlusCircle size={15} />
              <span>Beli Koin Baru</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Ringkasan Dompet & Arus Finansial Pasien (4 Metrik) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Saldo Koin Aktif */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Saldo Koin Aktif</span>
            <span className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-400">
              <Wallet size={15} />
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-heading text-teal-900 dark:text-teal-300">
            {mounted ? user.coins : 50} <span className="text-xs font-semibold text-teal-600 dark:text-teal-400">Koin</span>
          </p>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-nunito">Siap digunakan konsultasi</span>
        </div>

        {/* Card 2: Total Koin Masuk */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Total Koin Masuk</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400">
              <ArrowDownLeft size={15} />
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-heading text-emerald-700 dark:text-emerald-400">
            +{totalCoinsIn} <span className="text-xs font-semibold">Koin</span>
          </p>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-nunito">Top up & bonus registrasi</span>
        </div>

        {/* Card 3: Total Koin Digunakan */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Koin Terpakai</span>
            <span className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-400">
              <ArrowUpRight size={15} />
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-heading text-rose-700 dark:text-rose-400">
            -{totalCoinsOut} <span className="text-xs font-semibold">Koin</span>
          </p>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-nunito">Sesi chat & voice call</span>
        </div>

        {/* Card 4: Total Belanja IDR */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Total Pembelian</span>
            <span className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <CreditCard size={15} />
            </span>
          </div>
          <p className="text-lg sm:text-xl font-bold font-heading text-slate-900 dark:text-white truncate">
            Rp {totalSpentRupiah.toLocaleString("id-ID")}
          </p>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-nunito">Nominal riil terverifikasi</span>
        </div>
      </div>

      {/* 3. Main Data Container: Filter Tabs & Mutations Table */}
      <Card className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs rounded-2xl overflow-hidden">
        <CardHeader className="p-4 sm:p-6 pb-4 border-b border-slate-100 dark:border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base sm:text-lg font-bold font-heading text-slate-900 dark:text-white">
                Log Mutasi Koin & Tagihan
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
                Menampilkan total {filteredList.length} riwayat transaksi koin dan invoice
              </CardDescription>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={15} />
              <Input
                placeholder="Cari transaksi / psikolog / invoice..."
                className="pl-9 h-9 text-xs bg-slate-50/60 dark:bg-slate-800/60 dark:text-slate-100 border-slate-200/90 dark:border-slate-700 rounded-xl focus-visible:ring-teal-600"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {[
              { key: "all", label: "Semua Mutasi", count: transactions.length },
              { key: "topup", label: "Koin Masuk (Top Up)", count: transactions.filter((t) => t.type === "topup").length },
              { key: "usage", label: "Koin Keluar (Konseling)", count: transactions.filter((t) => t.type === "usage").length },
              { key: "refund", label: "Pengembalian (Refund)", count: transactions.filter((t) => t.type === "refund").length },
            ].map((tab) => {
              const isActive = filterType === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilterType(tab.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? "bg-teal-600 text-white shadow-2xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700"
                  }`}
                >
                  {tab.label} <span className="opacity-80 text-[11px]">({tab.count})</span>
                </button>
              );
            })}
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-4">
          {/* A. MOBILE VIEW: Responsive Mutation Cards */}
          <div className="block md:hidden space-y-3">
            {filteredList.length > 0 ? (
              filteredList.map((tx: TransactionRecord) => {
                const isPlus = tx.coinChange > 0;
                return (
                  <div
                    key={tx.id}
                    className="p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-teal-200 dark:hover:border-teal-800 transition-all shadow-2xs space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                            isPlus
                              ? "bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                              : "bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900"
                          }`}
                        >
                          {isPlus ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white font-heading truncate">
                            {tx.title}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-nunito">{tx.date}</p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p
                          className={`font-mono font-bold text-sm ${
                            isPlus ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
                          }`}
                        >
                          {isPlus ? `+${tx.coinChange}` : tx.coinChange} Koin
                        </p>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                          Saldo: {tx.coinBalanceAfter}
                        </span>
                      </div>
                    </div>

                    {/* Strip Detail Kanal */}
                    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800 text-xs">
                      <span className="text-slate-500 dark:text-slate-400 font-nunito text-[11px] truncate">
                        {tx.paymentMethod}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenInvoice(tx)}
                        className="h-6 text-xs text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-slate-800 px-2 gap-1 font-semibold cursor-pointer"
                      >
                        <Eye size={12} />
                        <span>Kuitansi</span>
                      </Button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-10 text-xs text-slate-400 dark:text-slate-500">
                Tidak ada data transaksi yang cocok.
              </div>
            )}
          </div>

          {/* B. DESKTOP VIEW: High-Res Mutation Table */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200/90 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 select-none">
                  <th className="py-3 px-4">Tanggal & Invoice</th>
                  <th className="py-3 px-4">Deskripsi Mutasi</th>
                  <th className="py-3 px-4">Kategori / Kanal</th>
                  <th className="py-3 px-4 text-right">Perubahan Koin</th>
                  <th className="py-3 px-4 text-right">Sisa Saldo</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filteredList.length > 0 ? (
                  filteredList.map((tx) => {
                    const isPlus = tx.coinChange > 0;
                    return (
                      <tr key={tx.id} className="hover:bg-teal-50/30 dark:hover:bg-teal-950/20 transition-colors">
                        {/* 1. Date & Invoice */}
                        <td className="py-3.5 px-4 font-nunito">
                          <p className="font-semibold text-slate-900 dark:text-white">{tx.date}</p>
                          <span className="text-[10px] font-mono text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950 px-1.5 py-0.5 rounded border border-teal-200/80 dark:border-teal-800">
                            {tx.invoiceNumber}
                          </span>
                        </td>

                        {/* 2. Description */}
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-slate-900 dark:text-white font-heading">{tx.title}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-nunito">{tx.targetParty}</p>
                        </td>

                        {/* 3. Category & Method */}
                        <td className="py-3.5 px-4">
                          <span className="inline-block font-semibold text-slate-700 dark:text-slate-300">
                            {tx.category}
                          </span>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">{tx.paymentMethod}</p>
                        </td>

                        {/* 4. Coin Change */}
                        <td className="py-3.5 px-4 text-right">
                          <span
                            className={`font-mono font-bold text-sm ${
                              isPlus ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
                            }`}
                          >
                            {isPlus ? `+${tx.coinChange}` : tx.coinChange} Koin
                          </span>
                          {tx.amountRupiah && (
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-nunito">
                              Rp {tx.amountRupiah.toLocaleString("id-ID")}
                            </p>
                          )}
                        </td>

                        {/* 5. Balance After */}
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                          {tx.coinBalanceAfter} Koin
                        </td>

                        {/* 6. Invoice Button */}
                        <td className="py-3.5 px-4 text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenInvoice(tx)}
                            className="h-8 text-xs border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 px-2.5 gap-1 font-semibold cursor-pointer"
                            title="Buka Kuitansi Resmi"
                          >
                            <FileText size={13} className="text-teal-600 dark:text-teal-400" />
                            <span>Kuitansi</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400 dark:text-slate-500">
                      Tidak ada mutasi koin yang sesuai dengan filter pencarian.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 4. Invoice Modal Dialog */}
      <InvoiceModal
        transaction={selectedTx}
        isOpen={isInvoiceOpen}
        onClose={() => setIsInvoiceOpen(false)}
      />
    </div>
  );
}
