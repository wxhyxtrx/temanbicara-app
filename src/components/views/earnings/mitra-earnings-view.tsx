"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tables, Column } from "@/components/shared/atoms/Table";
import { notify } from "@/lib/toast";
import { walletClient, WalletApiError } from "@/services/wallet.client";
import { systemSettingsClient } from "@/services/system-settings.client";
import { userService } from "@/services/user.service";
import type { PayoutRequestEntity, PaginationMeta, WalletInfoResponse } from "@/types/wallet";
import {
  Wallet,
  Building2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ArrowDownLeft,
  ArrowUpRight,
  Info,
  DollarSign,
  AlertTriangle,
  Receipt,
} from "lucide-react";

const POPULAR_BANKS = [
  "Bank Central Asia (BCA)",
  "Bank Mandiri",
  "Bank Negara Indonesia (BNI)",
  "Bank Rakyat Indonesia (BRI)",
  "Bank Syariah Indonesia (BSI)",
  "Bank CIMB Niaga",
  "Bank Permata",
  "SeaBank Indonesia",
  "Bank Jago",
];

interface MitraEarningsViewProps {
  role: "psikolog" | "relawan";
  roleTitle?: string;
}

export function MitraEarningsView({ role, roleTitle }: MitraEarningsViewProps) {
  const [mounted, setMounted] = useState<boolean>(false);
  const [wallet, setWallet] = useState<WalletInfoResponse | null>(null);
  const [loadingWallet, setLoadingWallet] = useState<boolean>(true);

  // System Settings Payout Limits
  const [minPayout, setMinPayout] = useState<number>(1_000_000);
  const [maxPayout, setMaxPayout] = useState<number>(10_000_000);
  const [feePayout, setFeePayout] = useState<number>(6_500);

  // Form State
  const [amountRupiah, setAmountRupiah] = useState<number>(1_000_000);
  const [bankName, setBankName] = useState<string>(POPULAR_BANKS[0]);
  const [customBank, setCustomBank] = useState<string>("");
  const [accountNumber, setAccountNumber] = useState<string>("");
  const [bankAccountName, setBankAccountName] = useState<string>("");
  const [verifiedProfileName, setVerifiedProfileName] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Payout History State
  const [payouts, setPayouts] = useState<PayoutRequestEntity[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [page, setPage] = useState<number>(1);
  const [loadingPayouts, setLoadingPayouts] = useState<boolean>(true);

  // Dialog Confirmation
  const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false);

  // Load Wallet Info
  const fetchWallet = useCallback(async () => {
    try {
      setLoadingWallet(true);
      const data = await walletClient.getWalletMe();
      setWallet(data);
    } catch (err) {
      if (err instanceof WalletApiError && err.handled) return;
      console.error("Gagal memuat saldo dompet mitra:", err);
    } finally {
      setLoadingWallet(false);
    }
  }, []);

  // Load Payout History
  const fetchPayouts = useCallback(async (targetPage: number) => {
    try {
      setLoadingPayouts(true);
      const res = await walletClient.getMitraPayouts({ page: targetPage, limit: 10 });
      setPayouts(res.items);
      setMeta(res.meta);
    } catch (err) {
      if (err instanceof WalletApiError && err.handled) return;
      console.error("Gagal memuat riwayat penarikan dana:", err);
    } finally {
      setLoadingPayouts(false);
    }
  }, []);

  // Load Public Settings
  const fetchSettings = useCallback(async () => {
    try {
      const res = await systemSettingsClient.getPublicSettings();
      if (res.settings?.payout) {
        setMinPayout(res.settings.payout.min_rupiah ?? 1_000_000);
        setMaxPayout(res.settings.payout.max_rupiah ?? 10_000_000);
        setFeePayout(res.settings.payout.fee_rupiah ?? 6_500);
      }
    } catch (err) {
      console.error("Gagal memuat batas payout:", err);
    }
  }, []);

  // Load User Profile Name for guidance
  const fetchUserProfile = useCallback(async () => {
    try {
      const res = await userService.getMe();
      if (res.success && res.data) {
        const p = res.data.profile as Record<string, unknown> | null;
        const nameWithDegree = String(
          (p?.nama_lengkap_gelar as string | undefined) ??
          (p?.nama_lengkap as string | undefined) ??
          res.data.fullName ??
          ""
        );
        setVerifiedProfileName(nameWithDegree);

        // Strip academic title suggestions
        const cleanName = nameWithDegree
          .split(",")[0]
          .replace(/^(?:(?:prof|dr|drs|dra)\.?\s+)+/gi, "")
          .trim();
        if (cleanName && !bankAccountName) {
          setBankAccountName(cleanName.toUpperCase());
        }
      }
    } catch (err) {
      console.error("Gagal memuat profil mitra:", err);
    }
  }, [bankAccountName]);

  useEffect(() => {
    setMounted(true);
    fetchWallet();
    fetchSettings();
    fetchUserProfile();
  }, [fetchWallet, fetchSettings, fetchUserProfile]);

  useEffect(() => {
    fetchPayouts(page);
  }, [fetchPayouts, page]);

  const availableRupiah = wallet?.available_rupiah ?? 0;
  const pendingRupiah = wallet?.pending_rupiah ?? 0;
  const totalRupiah = availableRupiah + pendingRupiah;

  const totalDeducted = amountRupiah + feePayout;
  const remainingAvailable = availableRupiah - totalDeducted;
  const isBalanceEnough = availableRupiah >= totalDeducted;
  const isAmountValid = amountRupiah >= minPayout && amountRupiah <= maxPayout;

  const handlePresetNominal = (val: number) => {
    setAmountRupiah(val);
  };

  const handleMaxWithdraw = () => {
    if (availableRupiah > feePayout) {
      const maxPossible = Math.min(maxPayout, availableRupiah - feePayout);
      setAmountRupiah(Math.max(0, maxPossible));
    }
  };

  const selectedBankResult = bankName === "Lainnya" ? customBank.trim() : bankName;

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!isAmountValid) {
      setFormError(
        `Nominal penarikan harus antara Rp ${minPayout.toLocaleString("id-ID")} dan Rp ${maxPayout.toLocaleString("id-ID")}.`
      );
      return;
    }

    if (!isBalanceEnough) {
      setFormError(
        `Saldo siap dicairkan (Rp ${availableRupiah.toLocaleString("id-ID")}) tidak mencukupi untuk penarikan Rp ${amountRupiah.toLocaleString("id-ID")} ditambah biaya transfer Rp ${feePayout.toLocaleString("id-ID")}.`
      );
      return;
    }

    if (!selectedBankResult) {
      setFormError("Nama bank tujuan pencairan wajib dipilih atau diisi.");
      return;
    }

    if (!accountNumber.trim()) {
      setFormError("Nomor rekening bank tujuan wajib diisi.");
      return;
    }

    if (!bankAccountName.trim()) {
      setFormError("Nama pemilik rekening bank wajib diisi.");
      return;
    }

    setIsConfirmOpen(true);
  };

  const handleExecutePayout = async () => {
    try {
      setIsSubmitting(true);
      setFormError(null);

      await walletClient.requestPayout({
        amount_rupiah: amountRupiah,
        bank_name: selectedBankResult,
        account_number: accountNumber.trim(),
        bank_account_name: bankAccountName.trim(),
      });

      notify.success(
        "Pengajuan Payout Terkirim!",
        `Permintaan pencairan Rp ${amountRupiah.toLocaleString("id-ID")} telah dicatat dan menunggu verifikasi Admin Keuangan.`
      );

      setIsConfirmOpen(false);
      fetchWallet();
      fetchPayouts(1);
      setPage(1);
    } catch (err) {
      if (err instanceof WalletApiError) {
        setFormError(err.message);
        notify.error("Pengajuan Gagal", err.message);
      } else {
        const msg = "Terjadi kesalahan sistem saat mengajukan penarikan.";
        setFormError(msg);
        notify.error("Kesalahan Sistem", msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<PayoutRequestEntity>[] = [
    {
      label: "Waktu Pengajuan",
      className: "w-[22%]",
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
            <span className="text-[10px] font-mono text-slate-400 block truncate max-w-[130px]">
              ID: {p.id.slice(0, 8)}...
            </span>
          </div>
        );
      },
    },
    {
      label: "Rekening Tujuan",
      className: "w-[26%]",
      renderCell: (p) => (
        <div>
          <p className="font-bold text-slate-900 dark:text-white text-xs">{p.bank_name}</p>
          <p className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
            {p.account_number} a.n. {p.bank_account_name}
          </p>
        </div>
      ),
    },
    {
      label: "Nominal & Fee",
      className: "w-[22%]",
      renderCell: (p) => (
        <div>
          <p className="font-bold font-mono text-xs text-slate-900 dark:text-white">
            Rp {p.amount_rupiah.toLocaleString("id-ID")}
          </p>
          <span className="text-[10px] text-slate-500 font-mono">
            Fee: Rp {p.fee_rupiah.toLocaleString("id-ID")}
          </span>
        </div>
      ),
    },
    {
      label: "Total Terpotong",
      align: "right",
      className: "w-[16%]",
      renderCell: (p) => {
        const total = p.amount_rupiah + p.fee_rupiah;
        return (
          <span
            className={`font-mono font-bold text-xs ${
              total > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-600 dark:text-slate-300"
            }`}
          >
            {total > 0 ? `-Rp ${total.toLocaleString("id-ID")}` : "Rp 0"}
          </span>
        );
      },
    },
    {
      label: "Status",
      align: "center",
      className: "w-[14%]",
      renderCell: (p) => {
        if (p.status === "paid") {
          return (
            <Badge className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-200 text-[10px] font-bold">
              Lunas Ditransfer
            </Badge>
          );
        }
        if (p.status === "rejected") {
          return (
            <Badge className="bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border-rose-200 text-[10px] font-bold">
              Ditolak & Saldo Pulih
            </Badge>
          );
        }
        return (
          <Badge className="bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-200 text-[10px] font-bold">
            Menunggu Verifikasi
          </Badge>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8 font-nunito pb-12 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* 1. Header Halaman */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 dark:text-white tracking-tight">
            Honor & Penarikan Dana
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Kelola pendapatan sesi dan ajukan pencairan dana ({roleTitle || "Mitra TemanBicara"}) langsung ke rekening bank
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3.5 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/70 border border-teal-200/90 dark:border-teal-800 text-teal-900 dark:text-teal-200 text-xs font-semibold flex items-center gap-2 shadow-2xs">
            <ShieldCheck size={16} className="text-teal-600 dark:text-teal-400" />
            <span>Rekening Terverifikasi Sesuai Identitas</span>
          </div>
        </div>
      </div>

      {/* 2. Kartu Ringkasan Saldo (Dalam RUPIAH) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Saldo Siap Dicairkan (Available) */}
        <Card className="rounded-2xl border border-teal-200 dark:border-teal-800/80 bg-gradient-to-br from-teal-50/70 via-white to-teal-50/30 dark:from-teal-950/40 dark:via-slate-900 dark:to-slate-900 shadow-xs overflow-hidden">
          <CardContent className="p-4 sm:p-5 flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-teal-800 dark:text-teal-300 uppercase tracking-wider block">
                Siap Dicairkan
              </span>
              <p className="text-xl sm:text-2xl font-bold font-heading text-slate-900 dark:text-white font-mono">
                {loadingWallet ? (
                  <Loader2 size={18} className="animate-spin text-teal-600" />
                ) : (
                  `Rp ${availableRupiah.toLocaleString("id-ID")}`
                )}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Saldo aktif yang dapat diajukan pencairan hari ini
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-teal-700/20">
              <Wallet size={20} />
            </div>
          </CardContent>
        </Card>

        {/* Saldo Tertahan (Pending - Masa Holding 48 Jam) */}
        <Card className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-gradient-to-br from-amber-50/70 via-white to-amber-50/30 dark:from-amber-950/30 dark:via-slate-900 dark:to-slate-900 shadow-xs overflow-hidden">
          <CardContent className="p-4 sm:p-5 flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider block">
                Pendapatan Tertahan
              </span>
              <p className="text-xl sm:text-2xl font-bold font-heading text-slate-900 dark:text-white font-mono">
                {loadingWallet ? (
                  <Loader2 size={18} className="animate-spin text-amber-600" />
                ) : (
                  `Rp ${pendingRupiah.toLocaleString("id-ID")}`
                )}
              </p>
              <div className="flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400">
                <Clock size={12} />
                <span>Masa holding 48 jam sebelum siap cair</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-amber-600/20">
              <Clock size={20} />
            </div>
          </CardContent>
        </Card>

        {/* Total Akumulasi Mitra */}
        <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <CardContent className="p-4 sm:p-5 flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Total Akumulasi Saldo
              </span>
              <p className="text-xl sm:text-2xl font-bold font-heading text-slate-900 dark:text-white font-mono">
                {loadingWallet ? (
                  <Loader2 size={18} className="animate-spin text-slate-400" />
                ) : (
                  `Rp ${totalRupiah.toLocaleString("id-ID")}`
                )}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Akumulasi saldo tersedia + masa holding
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
              <Receipt size={20} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Form Pengajuan Payout & Riwayat */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
        {/* Form Pengajuan (5 Kolom) */}
        <div className="lg:col-span-5">
          <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
            <CardHeader className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/90">
              <CardTitle className="font-heading text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 size={18} className="text-teal-600 dark:text-teal-400" />
                <span>Form Pengajuan Payout</span>
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                Pencairan dikirim ke rekening bank mitra setelah verifikasi admin
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 sm:p-5">
              <form onSubmit={handleOpenConfirm} className="space-y-4">
                {formError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
                    <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Input Nominal Penarikan */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <Label className="font-bold text-slate-800 dark:text-slate-200">
                      Nominal Penarikan (Rp)
                    </Label>
                    <span className="text-[11px] text-slate-500">
                      Min Rp {minPayout.toLocaleString("id-ID")}
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">
                      Rp
                    </span>
                    <Input
                      type="number"
                      step={50000}
                      min={minPayout}
                      max={maxPayout}
                      value={amountRupiah || ""}
                      onChange={(e) => setAmountRupiah(parseInt(e.target.value) || 0)}
                      placeholder="Masukkan nominal"
                      className="pl-9 h-10 text-xs sm:text-sm font-mono font-bold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl"
                    />
                  </div>

                  {/* Preset Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    {[1_000_000, 2_500_000, 5_000_000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handlePresetNominal(preset)}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-slate-700 text-[10px] font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                      >
                        Rp {(preset / 1_000_000).toFixed(preset % 1_000_000 === 0 ? 0 : 1)} Jt
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={handleMaxWithdraw}
                      className="px-2.5 py-1 rounded-lg border border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 hover:bg-teal-100 text-[10px] font-bold transition-colors cursor-pointer"
                    >
                      Tarik Semua
                    </button>
                  </div>
                </div>

                {/* Pilihan Bank */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Bank Tujuan
                  </Label>
                  <select
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full h-10 text-xs sm:text-sm px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                  >
                    {POPULAR_BANKS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                    <option value="Lainnya">Bank Lainnya...</option>
                  </select>

                  {bankName === "Lainnya" && (
                    <Input
                      placeholder="Masukkan nama bank (misal: Bank Mega)"
                      value={customBank}
                      onChange={(e) => setCustomBank(e.target.value)}
                      className="h-9 text-xs mt-1 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl"
                    />
                  )}
                </div>

                {/* Nomor Rekening */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Nomor Rekening
                  </Label>
                  <Input
                    placeholder="Contoh: 1234567890"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="h-10 text-xs sm:text-sm font-mono bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>

                {/* Nama Pemilik Rekening (Dengan Petunjuk Verifikasi Nama) */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <Label className="font-bold text-slate-800 dark:text-slate-200">
                      Nama Pemilik Rekening
                    </Label>
                  </div>
                  <Input
                    placeholder="Nama lengkap sesuai buku tabungan"
                    value={bankAccountName}
                    onChange={(e) => setBankAccountName(e.target.value.toUpperCase())}
                    className="h-10 text-xs sm:text-sm uppercase bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                    <div className="flex items-start gap-1.5 text-teal-800 dark:text-teal-300 font-semibold">
                      <Info size={13} className="shrink-0 mt-0.5" />
                      <span>Petunjuk Verifikasi Nama Rekening:</span>
                    </div>
                    <p className="leading-snug">
                      Harus sama persis dengan nama profil terverifikasi Anda tanpa gelar akademik/profesi (misal: tanpa &quot;dr.&quot;, &quot;Dr.&quot;, &quot;M.Psi&quot;).
                    </p>
                    {verifiedProfileName && (
                      <p className="font-medium text-slate-700 dark:text-slate-300">
                        Nama di Profil: <span className="font-semibold">{verifiedProfileName}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Rincian Biaya & Total Terpotong */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                    <span>Nominal Penarikan:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      Rp {amountRupiah.toLocaleString("id-ID")}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                    <span>Biaya Transfer Bank:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      Rp {feePayout.toLocaleString("id-ID")}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <span className="font-bold text-slate-900 dark:text-white">Total Saldo Terpotong:</span>
                    <span className="font-mono font-bold text-sm text-rose-600 dark:text-rose-400">
                      Rp {totalDeducted.toLocaleString("id-ID")}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-slate-500">
                    <span>Sisa Saldo Siap Cair:</span>
                    <span
                      className={`font-mono font-semibold ${
                        remainingAvailable < 0 ? "text-rose-600 font-bold" : "text-emerald-700 dark:text-emerald-400"
                      }`}
                    >
                      Rp {Math.max(0, remainingAvailable).toLocaleString("id-ID")}
                    </span>
                  </div>
                </div>

                {/* Submit CTA */}
                <Button
                  type="submit"
                  disabled={!isBalanceEnough || !isAmountValid || isSubmitting}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl h-11 text-xs sm:text-sm shadow-md shadow-teal-700/20 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Mengirim Pengajuan...</span>
                    </>
                  ) : (
                    <span>Ajukan Penarikan Dana</span>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Tabel Riwayat Payout Mitra (7 Kolom) */}
        <div className="lg:col-span-7">
          <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
            <CardHeader className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="font-heading text-base font-bold text-slate-900 dark:text-white">
                    Riwayat Pengajuan Payout
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
                    Daftar penarikan dana dan status transfer ke rekening bank
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fetchPayouts(page)}
                  disabled={loadingPayouts}
                  className="h-8 text-xs rounded-xl"
                >
                  {loadingPayouts ? <Loader2 size={12} className="animate-spin" /> : "Segarkan"}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {loadingPayouts ? (
                <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Loader2 size={24} className="animate-spin text-teal-600" />
                  <span className="text-xs">Memuat riwayat pengajuan penarikan dana...</span>
                </div>
              ) : payouts.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400 text-center px-4">
                  <AlertCircle size={28} className="text-slate-300 dark:text-slate-600" />
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Belum ada riwayat penarikan dana
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-sm">
                    Pengajuan payout honor konsultasi Anda akan dicatat di tabel ini beserta status transfernya.
                  </p>
                </div>
              ) : (
                <Tables<PayoutRequestEntity>
                  columns={columns}
                  data={payouts}
                  rowKey={(p) => p.id}
                />
              )}

              {/* Pagination */}
              {meta.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
                  <span>
                    Halaman {meta.page} dari {meta.totalPages} (Total {meta.total} pengajuan)
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page <= 1 || loadingPayouts}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="h-8 text-xs rounded-lg gap-1"
                    >
                      <ChevronLeft size={14} />
                      <span>Sebelumnya</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page >= meta.totalPages || loadingPayouts}
                      onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                      className="h-8 text-xs rounded-lg gap-1"
                    >
                      <span>Berikutnya</span>
                      <ChevronRight size={14} />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog Konfirmasi Pengajuan Payout */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="font-heading text-base font-bold flex items-center gap-2">
              <ShieldCheck size={20} className="text-teal-600" />
              <span>Konfirmasi Pengajuan Penarikan</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Pastikan seluruh data rekening penerima sudah tepat sebelum dikirim ke admin.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Bank Tujuan:</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedBankResult}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Nomor Rekening:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{accountNumber}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Atas Nama:</span>
                <span className="font-bold text-slate-900 dark:text-white">{bankAccountName}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <span className="text-slate-500">Nominal Penarikan:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  Rp {amountRupiah.toLocaleString("id-ID")}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Biaya Transfer Bank:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  Rp {feePayout.toLocaleString("id-ID")}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <span className="font-bold text-slate-900 dark:text-white">Total Saldo Terpotong:</span>
                <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-sm">
                  Rp {totalDeducted.toLocaleString("id-ID")}
                </span>
              </div>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                <span className="leading-snug">{formError}</span>
              </div>
            )}

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
              Dana Anda akan diproses oleh tim keuangan TemanBicara dalam 1-3 hari kerja. Saldo Anda akan dikembalikan secara otomatis jika pengajuan ditolak.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsConfirmOpen(false)}
              disabled={isSubmitting}
              className="text-xs rounded-xl"
            >
              Periksa Kembali
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleExecutePayout}
              disabled={isSubmitting}
              className="bg-teal-600 hover:bg-teal-700 text-white text-xs rounded-xl gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : (
                <span>Kirim Pengajuan</span>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
