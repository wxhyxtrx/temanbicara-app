"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Download,
  Building2,
  Calendar,
  CheckCircle2,
  CreditCard,
  History,
} from "lucide-react";

interface PlatformTransaction {
  id: string;
  refNo: string;
  date: string;
  partyName: string;
  partyRole: string;
  type: "Top Up Koin" | "Sesi Konseling" | "Payout Honor";
  amountCoins: number;
  amountRupiah: number;
  paymentChannel: string;
  status: "Sukses" | "Diproses";
}

const mockTransactions: PlatformTransaction[] = [
  {
    id: "tx-1",
    refNo: "INV-20261010-091",
    date: "10 Okt 2026, 11:20 WIB",
    partyName: "Wahyu Tricahyo (Pasien)",
    partyRole: "Pasien",
    type: "Top Up Koin",
    amountCoins: 100,
    amountRupiah: 1000000,
    paymentChannel: "QRIS Mandiri",
    status: "Sukses",
  },
  {
    id: "tx-2",
    refNo: "INV-20261010-088",
    date: "10 Okt 2026, 10:45 WIB",
    partyName: "Dr. Sarah Alatas, M.Psi",
    partyRole: "Psikolog",
    type: "Payout Honor",
    amountCoins: 500,
    amountRupiah: 5000000,
    paymentChannel: "Transfer Bank BCA",
    status: "Sukses",
  },
  {
    id: "tx-3",
    refNo: "INV-20261010-082",
    date: "10 Okt 2026, 09:15 WIB",
    partyName: "Budi Santoso & Dr. Sarah Alatas",
    partyRole: "Sesi Klinis",
    type: "Sesi Konseling",
    amountCoins: 60,
    amountRupiah: 600000,
    paymentChannel: "Debet Saldo Koin",
    status: "Sukses",
  },
  {
    id: "tx-4",
    refNo: "INV-20261009-041",
    date: "9 Okt 2026, 16:30 WIB",
    partyName: "Nadia Putri (Pasien)",
    partyRole: "Pasien",
    type: "Top Up Koin",
    amountCoins: 50,
    amountRupiah: 500000,
    paymentChannel: "BCA Virtual Account",
    status: "Sukses",
  },
];

export default function AdminTransactionsPage() {
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filtered = mockTransactions.filter((tx) => {
    const matchType =
      filterType === "all" ||
      (filterType === "topup" && tx.type === "Top Up Koin") ||
      (filterType === "session" && tx.type === "Sesi Konseling") ||
      (filterType === "payout" && tx.type === "Payout Honor");

    const matchSearch =
      tx.refNo.toLowerCase().includes(search.toLowerCase()) ||
      tx.partyName.toLowerCase().includes(search.toLowerCase());

    return matchType && matchSearch;
  });

  return (
    <div className="space-y-6 sm:space-y-8 font-nunito pb-12 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 dark:text-white tracking-tight">
            Audit Transaksi Finansial & Mutasi Koin
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Log audit terpadu arus kas masuk, pengeluaran honor psikolog, dan komisi platform
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

      {/* 2. Stat Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1.5">
          <span className="text-xs text-slate-500 font-medium">Total Volume Pembelian Koin</span>
          <p className="text-xl sm:text-2xl font-bold font-heading text-emerald-700 dark:text-emerald-400">
            Rp 485.000.000
          </p>
          <span className="text-[11px] text-slate-400 font-nunito">Bulan Oktober 2026</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1.5">
          <span className="text-xs text-slate-500 font-medium">Total Pencairan Honor Psikolog</span>
          <p className="text-xl sm:text-2xl font-bold font-heading text-slate-900 dark:text-white">
            Rp 392.400.000
          </p>
          <span className="text-[11px] text-slate-400 font-nunito">Ditransfer ke 28 psikolog</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1.5">
          <span className="text-xs text-slate-500 font-medium">Pendapatan Platform Bersih</span>
          <p className="text-xl sm:text-2xl font-bold font-heading text-teal-800 dark:text-teal-300">
            Rp 92.600.000
          </p>
          <span className="text-[11px] text-teal-600 dark:text-teal-400 font-semibold font-nunito">
            Margin Operasional & Server
          </span>
        </div>
      </div>

      {/* 3. Filter Bar & Table */}
      <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
        <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { key: "all", label: "Semua Transaksi" },
                { key: "topup", label: "Top Up Koin" },
                { key: "session", label: "Sesi Konseling" },
                { key: "payout", label: "Pencairan Honor" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilterType(tab.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    filterType === tab.key
                      ? "bg-teal-600 text-white shadow-2xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="w-full sm:w-64">
              <input
                type="text"
                placeholder="Cari ref invoice / nama..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 sm:p-2">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 text-slate-600 dark:text-slate-400 font-semibold">
                  <th className="p-3.5 pl-4">Waktu & Ref</th>
                  <th className="p-3.5">Pihak Terkait</th>
                  <th className="p-3.5">Jenis Mutasi</th>
                  <th className="p-3.5">Koin</th>
                  <th className="p-3.5">Nominal Riil (IDR)</th>
                  <th className="p-3.5">Metode Bayar</th>
                  <th className="p-3.5 pr-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="p-3.5 pl-4">
                      <p className="font-mono font-semibold text-slate-900 dark:text-white">{tx.refNo}</p>
                      <span className="text-[10px] text-slate-400 font-nunito">{tx.date}</span>
                    </td>
                    <td className="p-3.5">
                      <p className="font-bold text-slate-800 dark:text-slate-200">{tx.partyName}</p>
                      <span className="text-[10px] text-slate-400">{tx.partyRole}</span>
                    </td>
                    <td className="p-3.5">
                      <span className="font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950 px-2 py-0.5 rounded text-[11px]">
                        {tx.type}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono font-bold text-slate-900 dark:text-white">
                      {tx.amountCoins} Koin
                    </td>
                    <td className="p-3.5 font-mono font-semibold text-slate-900 dark:text-white">
                      Rp {tx.amountRupiah.toLocaleString("id-ID")}
                    </td>
                    <td className="p-3.5 text-slate-600 dark:text-slate-400">{tx.paymentChannel}</td>
                    <td className="p-3.5 pr-4 text-right">
                      <Badge className="bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-200 text-[10px]">
                        {tx.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
