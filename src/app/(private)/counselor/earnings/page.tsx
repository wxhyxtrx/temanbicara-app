"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Wallet,
  ArrowDownLeft,
  Building2,
  CheckCircle2,
  Clock,
  Download,
  CreditCard,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";

import { usePayoutStore, PayoutRecord } from "@/store/payout-store";
import { useUserStore } from "@/store/user-store";

export default function CounselorEarningsPage() {
  const user = useUserStore((state) => state.user);
  const updateCoins = useUserStore((state) => state.updateCoins);
  const payouts = usePayoutStore((state) => state.payouts);
  const requestPayout = usePayoutStore((state) => state.requestPayout);

  const [mounted, setMounted] = useState(false);
  const [withdrawAmountCoins, setWithdrawAmountCoins] = useState(50);
  const [isProcessing, setIsProcessing] = useState(false);
  const [payoutSuccessMsg, setPayoutSuccessMsg] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const balanceCoins = mounted ? (user.coins || 620) : 620;

  const totalWithdrawnRupiah = payouts
    .filter((p) => p.status === "Berhasil")
    .reduce((acc, curr) => acc + curr.amountRupiah, 0);

  const handleRequestPayout = (e: React.FormEvent) => {
    e.preventDefault();
    if (withdrawAmountCoins <= 0 || withdrawAmountCoins > balanceCoins) {
      alert("Jumlah koin penarikan tidak mencukupi saldo.");
      return;
    }

    setIsProcessing(true);
    setTimeout(() => {
      // Deduct coins from counselor wallet
      updateCoins(-withdrawAmountCoins, true);

      // Add to central payout store
      requestPayout({
        counselorName: user.fullName || "Dr. Sarah Alatas, M.Psi",
        coinsDeducted: withdrawAmountCoins,
        amountRupiah: withdrawAmountCoins * 10000,
        bankName: "Bank Central Asia (BCA)",
        accountNo: "8820491823",
        accountHolder: user.fullName ? user.fullName.toUpperCase() : "DR. SARAH ALATAS",
      });

      setIsProcessing(false);
      setPayoutSuccessMsg(true);
      setTimeout(() => setPayoutSuccessMsg(false), 3500);
    }, 400);
  };

  return (
    <div className="space-y-6 sm:space-y-8 font-nunito pb-12 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* 1. Header */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 dark:text-white tracking-tight">
          Honor Praktik & Payout Sesi
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Transparansi konversi honor koin konsultasi dan pencairan dana langsung ke rekening bank Anda
        </p>
      </div>

      {payoutSuccessMsg && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>Pengajuan penarikan dana berhasil dikirim! Tim operasional TemanBicara akan memproses transfer dalam 1x24 jam kerja.</span>
        </div>
      )}

      {/* 2. Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Saldo Honor Koin Siap Tarik</span>
            <span className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-400">
              <Wallet size={18} />
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold font-heading text-teal-900 dark:text-teal-300">
            {balanceCoins} <span className="text-sm font-semibold text-teal-600 dark:text-teal-400">Koin</span>
          </p>
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            ≈ Rp {(balanceCoins * 10000).toLocaleString("id-ID")}
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Total Honor Dicairkan</span>
            <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400">
              <ArrowDownLeft size={18} />
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 dark:text-white">
            Rp 17.000.000
          </p>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 block font-nunito">
            Total transfer ke rekening
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Rekening Bank Penerima</span>
            <span className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <Building2 size={18} />
            </span>
          </div>
          <p className="text-base sm:text-lg font-bold font-heading text-slate-900 dark:text-white truncate">
            BCA - 8820****12
          </p>
          <span className="text-[11px] text-teal-700 dark:text-teal-400 font-semibold block">
            a.n. Dr. Sarah Alatas
          </span>
        </div>
      </div>

      {/* 3. Form Penarikan Dana & Mutasi */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
        {/* Left: Withdraw form */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="font-heading text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ArrowUpRight size={18} className="text-teal-600 dark:text-teal-400" />
                Form Tarik Honor ke Rekening
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
                1 Koin Konseling = Rp 10.000 (Bebas Biaya Admin)
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 sm:p-6 space-y-4">
              <form onSubmit={handleRequestPayout} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Jumlah Koin Ditarik (Maks: {balanceCoins} Koin)
                  </label>
                  <Input
                    type="number"
                    min={50}
                    max={balanceCoins}
                    value={withdrawAmountCoins}
                    onChange={(e) => setWithdrawAmountCoins(Number(e.target.value))}
                    className="h-10 text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span>Estimasi Rupiah diterima:</span>
                    <strong className="text-teal-700 dark:text-teal-400 font-bold">
                      Rp {(withdrawAmountCoins * 10000).toLocaleString("id-ID")}
                    </strong>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 space-y-1 text-xs">
                  <p className="font-bold text-slate-800 dark:text-slate-200">Rekening Tujuan:</p>
                  <p className="text-slate-600 dark:text-slate-400 font-nunito">Bank Central Asia (BCA) • 8820491823</p>
                  <p className="text-[11px] text-slate-400">Atas Nama: DR. SARAH ALATAS</p>
                </div>

                <Button
                  type="submit"
                  disabled={isProcessing || withdrawAmountCoins <= 0 || withdrawAmountCoins > balanceCoins}
                  className="w-full text-xs sm:text-sm bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl py-2.5 h-10 shadow-xs cursor-pointer"
                >
                  {isProcessing ? "Memproses Transfer..." : "Ajukan Pencairan Honor"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right: History Table */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
            <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="font-heading text-base font-bold text-slate-900 dark:text-white">
                Riwayat Pencairan Honor
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
                Daftar pengajuan mutasi dana ke rekening psikolog
              </CardDescription>
            </CardHeader>

            <CardContent className="p-0 sm:p-2">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 text-slate-600 dark:text-slate-400">
                      <th className="p-3 pl-4">Tanggal & Ref</th>
                      <th className="p-3">Koin Ditukar</th>
                      <th className="p-3">Nominal Rupiah</th>
                      <th className="p-3 pr-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {payouts.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-3 pl-4">
                          <p className="font-bold text-slate-900 dark:text-white">{p.date}</p>
                          <span className="font-mono text-[10px] text-slate-400">{p.invoiceNo}</span>
                        </td>
                        <td className="p-3 font-mono font-semibold text-rose-600 dark:text-rose-400">
                          -{p.coinsDeducted} Koin
                        </td>
                        <td className="p-3 font-semibold text-slate-900 dark:text-white font-mono">
                          Rp {p.amountRupiah.toLocaleString("id-ID")}
                        </td>
                        <td className="p-3 pr-4 text-right">
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
                          {p.notes && (
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 max-w-[200px] ml-auto truncate" title={p.notes}>
                              {p.notes}
                            </p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
