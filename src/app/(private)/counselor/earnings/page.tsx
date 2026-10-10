"use client";

import React, { useState, useMemo } from "react";
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
  Smartphone,
  ShieldCheck,
  Receipt,
  Coins,
  History,
  Check,
} from "lucide-react";

import { usePayoutStore, PayoutRecord } from "@/store/payout-store";
import { useUserStore } from "@/store/user-store";
import { notify } from "@/lib/toast";

const payoutChannels = [
  { id: "bca", name: "Bank Central Asia (BCA)", type: "bank", icon: Building2 },
  { id: "mandiri", name: "Bank Mandiri", type: "bank", icon: Building2 },
  { id: "bni", name: "Bank Negara Indonesia (BNI)", type: "bank", icon: Building2 },
  { id: "bri", name: "Bank Rakyat Indonesia (BRI)", type: "bank", icon: Building2 },
  { id: "seabank", name: "SeaBank Indonesia", type: "bank", icon: Building2 },
  { id: "jago", name: "Bank Jago", type: "bank", icon: Building2 },
  { id: "gopay", name: "GoPay (Nomor Ponsel)", type: "ewallet", icon: Smartphone },
  { id: "ovo", name: "OVO (Nomor Ponsel)", type: "ewallet", icon: Smartphone },
  { id: "dana", name: "DANA (Nomor Ponsel)", type: "ewallet", icon: Smartphone },
];

interface SessionEarningItem {
  id: string;
  date: string;
  clientName: string;
  topic: string;
  serviceType: "Chat Eksklusif" | "Voice Call";
  grossCoins: number;
  platformCutCoins: number;
  netCoins: number;
  status: "Terkreditasi";
}

const mockSessionEarnings: SessionEarningItem[] = [
  {
    id: "earn-1",
    date: "10 Okt 2026, 14:00 WIB",
    clientName: "Wahyu Tricahyo (Klien Terdaftar)",
    topic: "Konseling Penanganan Burnout & Regulasi Diri",
    serviceType: "Chat Eksklusif",
    grossCoins: 15,
    platformCutCoins: 1.5,
    netCoins: 13.5,
    status: "Terkreditasi",
  },
  {
    id: "earn-2",
    date: "8 Okt 2026, 10:30 WIB",
    clientName: "Budi Santoso (Anonim)",
    topic: "Somatic Anxiety & Relaksasi Diafragma",
    serviceType: "Voice Call",
    grossCoins: 20,
    platformCutCoins: 2.0,
    netCoins: 18.0,
    status: "Terkreditasi",
  },
  {
    id: "earn-3",
    date: "5 Okt 2026, 15:00 WIB",
    clientName: "Nadia Putri",
    topic: "Komunikasi Interpersonal & Emotional Boundaries",
    serviceType: "Chat Eksklusif",
    grossCoins: 15,
    platformCutCoins: 1.5,
    netCoins: 13.5,
    status: "Terkreditasi",
  },
  {
    id: "earn-4",
    date: "1 Okt 2026, 13:00 WIB",
    clientName: "Ahmad Rizky (Anonim)",
    topic: "Evaluasi Behavioral Activation (Remisi)",
    serviceType: "Voice Call",
    grossCoins: 20,
    platformCutCoins: 2.0,
    netCoins: 18.0,
    status: "Terkreditasi",
  },
];

export default function CounselorEarningsPage() {
  const user = useUserStore((state) => state.user);
  const updateCoins = useUserStore((state) => state.updateCoins);
  const payouts = usePayoutStore((state) => state.payouts);
  const requestPayout = usePayoutStore((state) => state.requestPayout);

  const [mounted, setMounted] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState(payoutChannels[0].name);
  const [accountNumber, setAccountNumber] = useState("8820491823");
  const [accountHolder, setAccountHolder] = useState(
    user.fullName ? user.fullName.toUpperCase() : "DR. SARAH ALATAS, M.PSI"
  );
  const [withdrawAmountCoins, setWithdrawAmountCoins] = useState(50);
  const [isProcessing, setIsProcessing] = useState(false);
  const [payoutSuccessMsg, setPayoutSuccessMsg] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const balanceCoins = mounted ? (user.coins || 620) : 620;

  const totalWithdrawnRupiah = useMemo(() => {
    return payouts
      .filter((p) => p.status === "Berhasil")
      .reduce((acc, curr) => acc + curr.amountRupiah, 0);
  }, [payouts]);

  const handlePresetClick = (amount: number) => {
    if (amount > balanceCoins) {
      setWithdrawAmountCoins(balanceCoins);
    } else {
      setWithdrawAmountCoins(amount);
    }
  };

  const handleRequestPayout = (e: React.FormEvent) => {
    e.preventDefault();
    if (withdrawAmountCoins <= 0 || withdrawAmountCoins > balanceCoins) {
      notify.warning("Saldo Koin Tidak Cukup", "Jumlah koin penarikan melebihi saldo koin honor Anda.");
      return;
    }

    if (!accountNumber.trim()) {
      notify.warning("Data Rekening Kurang", "Nomor rekening atau nomor ponsel e-wallet wajib diisi.");
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
        bankName: selectedChannel,
        accountNo: accountNumber.trim(),
        accountHolder: accountHolder.trim().toUpperCase(),
      });

      setIsProcessing(false);
      setPayoutSuccessMsg(true);
      notify.payout(
        "Pengajuan Penarikan Terkirim!",
        `Pencairan Rp ${(withdrawAmountCoins * 10000).toLocaleString("id-ID")} ke ${selectedChannel} sedang diverifikasi Admin Keuangan.`
      );
      setTimeout(() => setPayoutSuccessMsg(false), 4000);
    }, 450);
  };

  return (
    <div className="space-y-6 sm:space-y-8 font-nunito pb-12 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 dark:text-white tracking-tight">
            Honor Praktik & Manajemen Payout
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Transparansi bagi hasil konsultasi (90% Psikolog • 10% Platform) dan pencairan dana langsung ke rekening Anda
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-xs py-1.5 px-3 gap-1.5">
            <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400" />
            <span>Terverifikasi SIPPK HIMPSI</span>
          </Badge>
        </div>
      </div>

      {payoutSuccessMsg && (
        <div className="flex items-center gap-2.5 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>
            Pengajuan penarikan dana berhasil terkirim! Tim keuangan TemanBicara akan memproses transfer via RTGS/BI-Fast dalam 1x24 jam kerja.
          </span>
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
            Rp {(totalWithdrawnRupiah || 17000000).toLocaleString("id-ID")}
          </p>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 block font-nunito">
            Total dana sukses transfer ke rekening
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Rekening Terdaftar Utama</span>
            <span className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <Building2 size={18} />
            </span>
          </div>
          <p className="text-sm sm:text-base font-bold font-heading text-slate-900 dark:text-white truncate">
            {selectedChannel.split(" (")[0]}
          </p>
          <span className="text-[11px] text-teal-700 dark:text-teal-400 font-semibold block truncate">
            {accountNumber} • a.n. {accountHolder}
          </span>
        </div>
      </div>

      {/* 3. Form Penarikan Dana & Riwayat Payout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
        {/* Left: Withdraw form (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="font-heading text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ArrowUpRight size={18} className="text-teal-600 dark:text-teal-400" />
                <span>Formulir Pengajuan Payout Honor</span>
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
                1 Koin = Rp 10.000 • Transfer instan via BI-Fast tanpa potongan admin
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 sm:p-6 space-y-4">
              <form onSubmit={handleRequestPayout} className="space-y-4">
                {/* Channel Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Pilih Bank / Saluran E-Wallet
                  </label>
                  <select
                    value={selectedChannel}
                    onChange={(e) => setSelectedChannel(e.target.value)}
                    className="w-full h-10 px-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-teal-500 font-nunito text-slate-900 dark:text-slate-100"
                  >
                    {payoutChannels.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Account Number & Holder */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      No. Rekening / No. HP
                    </label>
                    <Input
                      type="text"
                      required
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="Contoh: 8820491823"
                      className="h-9 text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      Nama Pemilik Rekening
                    </label>
                    <Input
                      type="text"
                      required
                      value={accountHolder}
                      onChange={(e) => setAccountHolder(e.target.value)}
                      placeholder="Nama di buku tabungan"
                      className="h-9 text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl uppercase font-nunito"
                    />
                  </div>
                </div>

                {/* Amount with quick presets */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">
                      Jumlah Koin Ditarik
                    </label>
                    <span className="text-slate-500 text-[11px]">Tersedia: {balanceCoins} Koin</span>
                  </div>

                  <Input
                    type="number"
                    min={10}
                    max={balanceCoins}
                    value={withdrawAmountCoins}
                    onChange={(e) => setWithdrawAmountCoins(Number(e.target.value))}
                    className="h-10 text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />

                  {/* Preset chips */}
                  <div className="flex items-center gap-1.5 pt-1">
                    {[50, 100, 200].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handlePresetClick(preset)}
                        className={`text-[11px] px-2.5 py-1 rounded-lg border font-semibold cursor-pointer transition-all ${
                          withdrawAmountCoins === preset
                            ? "bg-teal-600 text-white border-teal-600 shadow-2xs"
                            : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                        }`}
                      >
                        {preset} Koin
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handlePresetClick(balanceCoins)}
                      className="text-[11px] px-2.5 py-1 rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 font-semibold cursor-pointer hover:bg-teal-100 ml-auto"
                    >
                      Tarik Semua ({balanceCoins})
                    </button>
                  </div>
                </div>

                {/* Calculation breakdown */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                    <span>Nilai Konversi Bruto:</span>
                    <span className="font-mono font-semibold">Rp {(withdrawAmountCoins * 10000).toLocaleString("id-ID")}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                    <span>Biaya Transfer Antarbank:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">Rp 0 (Gratis)</span>
                  </div>
                  <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between font-bold text-slate-900 dark:text-white">
                    <span>Total Dana Masuk Rekening:</span>
                    <span className="text-teal-700 dark:text-teal-300 font-mono text-sm">
                      Rp {(withdrawAmountCoins * 10000).toLocaleString("id-ID")}
                    </span>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isProcessing || withdrawAmountCoins <= 0 || withdrawAmountCoins > balanceCoins}
                  className="w-full text-xs sm:text-sm bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl py-2.5 h-10 shadow-xs cursor-pointer gap-1.5"
                >
                  {isProcessing ? "Memproses Transfer..." : "Ajukan Pencairan Sekarang"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right: History Table (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
            <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-heading text-base font-bold text-slate-900 dark:text-white">
                  Riwayat Pencairan Honor
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
                  Daftar mutasi pengajuan transfer ke rekening psikolog
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs border-slate-200 dark:border-slate-700">
                {payouts.length} Pengajuan
              </Badge>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 text-slate-600 dark:text-slate-400">
                      <th className="p-3 pl-4">Tanggal & Saluran</th>
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
                          <span className="text-[11px] text-slate-500 block truncate max-w-[180px]">
                            {p.bankName} • {p.accountNo}
                          </span>
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
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 max-w-[160px] ml-auto truncate" title={p.notes}>
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

      {/* 4. Session Honorarium Breakdown Ledger */}
      <Card className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
        <CardHeader className="p-5 sm:p-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="font-heading text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Receipt size={18} className="text-teal-600 dark:text-teal-400" />
              <span>Rincian Honor Sesi Konsultasi (Revenue Split 90/10)</span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
              Log riwayat honor konsultasi dari pasien yang langsung terakumulasi ke saldo koin Anda
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 text-xs text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 px-3 py-1.5 rounded-xl font-semibold">
            <Sparkles size={14} />
            <span>Skema Transparan: 90% Psikolog, 10% Platfom</span>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 text-slate-600 dark:text-slate-400 font-bold">
                  <th className="p-3 pl-5">Tanggal & Sesi</th>
                  <th className="p-3">Nama Klien & Topik</th>
                  <th className="p-3">Moda Layanan</th>
                  <th className="p-3 text-right">Tarif Pasien</th>
                  <th className="p-3 text-right">Bagi Platfom (10%)</th>
                  <th className="p-3 pr-5 text-right">Honor Bersih (90%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {mockSessionEarnings.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="p-3 pl-5">
                      <p className="font-bold text-slate-900 dark:text-white">{item.date}</p>
                      <span className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold flex items-center gap-1 mt-0.5">
                        <CheckCircle2 size={11} /> {item.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <p className="font-bold text-slate-800 dark:text-slate-200">{item.clientName}</p>
                      <p className="text-[11px] text-slate-500 line-clamp-1">{item.topic}</p>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {item.serviceType}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono text-slate-700 dark:text-slate-300">
                      {item.grossCoins} Koin
                    </td>
                    <td className="p-3 text-right font-mono text-slate-400">
                      -{item.platformCutCoins} Koin
                    </td>
                    <td className="p-3 pr-5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      +{item.netCoins} Koin (Rp {(item.netCoins * 10000).toLocaleString("id-ID")})
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
