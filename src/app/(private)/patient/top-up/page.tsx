"use client";

import React, { useState, useEffect, useCallback } from "react";
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
import { notify } from "@/lib/toast";
import { openSnapModal } from "@/lib/snap";
import { walletClient, WalletApiError } from "@/services/wallet.client";
import { systemSettingsClient } from "@/services/system-settings.client";
import { COIN_TO_RUPIAH } from "@/constant/system-settings";
import type { TopupOrderEntity, WalletInfoResponse } from "@/types/wallet";
import {
  Coins,
  CreditCard,
  ShieldCheck,
  Check,
  CheckCircle2,
  Sparkles,
  Lock,
  ArrowRight,
  FileText,
  AlertTriangle,
  Clock,
  Loader2,
  XCircle,
  Info,
} from "lucide-react";

interface TherapyPackage {
  id: string;
  name: string;
  subtitle: string;
  coins: number;
  popular?: boolean;
  benefits: string[];
}

export default function PatientTopUpPage() {
  const [mounted, setMounted] = useState<boolean>(false);
  const [wallet, setWallet] = useState<WalletInfoResponse | null>(null);
  const [loadingWallet, setLoadingWallet] = useState<boolean>(true);

  // Settings limits
  const [minCoins, setMinCoins] = useState<number>(10);
  const [maxCoins, setMaxCoins] = useState<number>(500);

  // Selection
  const [selectedCoins, setSelectedCoins] = useState<number>(50);
  const [customCoinAmount, setCustomCoinAmount] = useState<number>(50);
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);

  // Transaction processing state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [orderDetail, setOrderDetail] = useState<TopupOrderEntity | null>(null);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState<boolean>(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState<boolean>(false);
  const [topupError, setTopupError] = useState<string | null>(null);

  // 4 Paket Terapi Berorientasi Pemulihan (Harga murni: koin * COIN_TO_RUPIAH)
  const therapyPackages: TherapyPackage[] = [
    {
      id: "single",
      name: "Sesi Eksplorasi",
      subtitle: "1x Sesi Konseling Psikolog Klinis",
      coins: 20,
      benefits: ["1x Konseling Psikolog Klinis", "Catatan Refleksi Emosi Mandiri"],
    },
    {
      id: "focus",
      name: "Pemulihan Terstruktur",
      subtitle: "2x Sesi Terstruktur + Evaluasi Emosi",
      coins: 50,
      popular: true,
      benefits: [
        "2x Konseling Psikolog Klinis",
        "Rangkuman Sesi & Catatan Terapi",
        "Prioritas Jadwal Reservasi",
      ],
    },
    {
      id: "intensive",
      name: "Terapi Intensif",
      subtitle: "4x Sesi Pemulihan Berkesinambungan",
      coins: 100,
      benefits: [
        "4x Konseling Psikolog Klinis",
        "Rencana Terapi CBT / Mindfulness",
        "Monitoring Evaluasi Klinis",
      ],
    },
    {
      id: "holistic",
      name: "Program Holistik",
      subtitle: "10x Sesi Pendampingan Menyeluruh",
      coins: 250,
      benefits: [
        "10x Konseling Psikolog Bebas Pilih",
        "Evaluasi Klinis Menyeluruh",
        "Dukungan Penuh Jalur Prioritas",
      ],
    },
  ];

  // Fetch Wallet Data dari API /api/wallet/me
  const fetchWallet = useCallback(async () => {
    try {
      setLoadingWallet(true);
      const data = await walletClient.getWalletMe();
      setWallet(data);
    } catch (err) {
      if (err instanceof WalletApiError && err.handled) return;
      console.error("Gagal memuat saldo dompet:", err);
    } finally {
      setLoadingWallet(false);
    }
  }, []);

  // Fetch Public Settings untuk batas min/max koin
  const fetchSettings = useCallback(async () => {
    try {
      const res = await systemSettingsClient.getPublicSettings();
      if (res.settings?.topup) {
        setMinCoins(res.settings.topup.min_coins || 10);
        setMaxCoins(res.settings.topup.max_coins || 500);
      }
    } catch (err) {
      console.error("Gagal memuat batas topup:", err);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    fetchWallet();
    fetchSettings();

    const handleRefresh = () => {
      fetchWallet();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("wallet:refresh", handleRefresh);
      return () => {
        window.removeEventListener("wallet:refresh", handleRefresh);
      };
    }
  }, [fetchWallet, fetchSettings]);

  // Cek Status Order Top-up dari GET /api/wallet/topup/[order_id]
  const lastRefreshAtRef = React.useRef<number>(0);

  const handleRefreshStatus = async (orderId: string) => {
    const now = Date.now();
    if (now - lastRefreshAtRef.current < 10000) {
      notify.info(
        "Mohon Tunggu",
        "Pengecekan status dibatasi maksimal 1 kali per 10 detik. Silakan coba sesaat lagi."
      );
      return;
    }
    lastRefreshAtRef.current = now;

    try {
      setIsCheckingStatus(true);
      const detail = await walletClient.checkTopupStatus(orderId);
      setOrderDetail(detail);

      if (detail.status === "settlement") {
        notify.success(
          "Top-Up Koin Berhasil!",
          `Pembayaran ${detail.coins} koin telah diverifikasi. Saldo Anda telah diperbarui.`
        );
        fetchWallet();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("wallet:refresh"));
        }
      } else if (detail.status === "pending") {
        notify.info(
          "Menunggu Pembayaran",
          `Pesanan ${detail.order_id} masih menunggu pembayaran. Selesaikan transaksi Anda melalui Midtrans.`
        );
      } else if (detail.status === "expire" || detail.status === "deny" || detail.status === "cancel") {
        notify.error("Pembayaran Tidak Berhasil", `Status transaksi: ${detail.status}.`);
      }
    } catch (err) {
      if (err instanceof WalletApiError && err.handled) return;
      console.error("Error refresh status order via Midtrans:", err);
      notify.error("Gagal Memperbarui Status", "Tidak dapat memeriksa status pesanan ke gateway pembayaran saat ini.");
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const checkOrderStatus = async (orderId: string) => {
    try {
      setIsCheckingStatus(true);
      const detail = await walletClient.getTopupOrder(orderId);
      setOrderDetail(detail);
      setIsStatusDialogOpen(true);

      if (detail.status === "settlement") {
        notify.success(
          "Top-Up Koin Berhasil!",
          `Pembayaran ${detail.coins} koin telah diverifikasi. Saldo Anda telah diperbarui.`
        );
        fetchWallet();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("wallet:refresh"));
        }
      } else if (detail.status === "pending") {
        notify.info(
          "Menunggu Pembayaran",
          `Pesanan ${detail.order_id} menunggu pembayaran. Selesaikan transaksi Anda melalui Midtrans.`
        );
      } else if (detail.status === "expire" || detail.status === "deny" || detail.status === "cancel") {
        notify.error("Pembayaran Tidak Berhasil", `Status transaksi: ${detail.status}.`);
      }
    } catch (err) {
      if (err instanceof WalletApiError && err.handled) return;
      console.error("Error cek status order:", err);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Kalkulasi Koin & Harga
  const effectiveCoins = isCustomMode ? customCoinAmount : selectedCoins;
  const finalPrice = effectiveCoins * COIN_TO_RUPIAH;
  const isCoinsInRange = effectiveCoins >= minCoins && effectiveCoins <= maxCoins;

  // Eksekusi Pembayaran Snap Midtrans
  const handlePayNow = async () => {
    setTopupError(null);
    if (!isCoinsInRange) {
      const msg = `Jumlah koin top-up harus antara ${minCoins} dan ${maxCoins} koin.`;
      setTopupError(msg);
      notify.warning("Jumlah Koin Tidak Sesuai", msg);
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await walletClient.createTopup(effectiveCoins);
      setActiveOrderId(result.order_id);

      // Buka Midtrans Snap Popup Sandbox
      await openSnapModal(result.snap_token, {
        onSuccess: () => {
          checkOrderStatus(result.order_id);
        },
        onPending: () => {
          checkOrderStatus(result.order_id);
        },
        onError: () => {
          checkOrderStatus(result.order_id);
        },
        onClose: () => {
          // Ketika popup ditutup oleh pasien, selalu cek status pesanan terkini
          checkOrderStatus(result.order_id);
        },
      });
    } catch (err) {
      if (err instanceof WalletApiError) {
        setTopupError(err.message);
        notify.error("Gagal Memulai Pembayaran", err.message);
      } else {
        const msg = "Tidak dapat menghubungi gateway pembayaran. Silakan coba beberapa saat lagi.";
        setTopupError(msg);
        notify.error("Kesalahan Sistem", msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 font-nunito pb-12 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* 1. Header Halaman */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 dark:text-white tracking-tight">
            Top Up Koin Konseling
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Pilih paket pemulihan terstruktur untuk reservasi sesi psikolog klinis & telekonseling privat
          </p>
        </div>

        {/* Current Balance Pill & Link to Mutation History */}
        <div className="flex items-center gap-2.5">
          <Link href="/patient/top-up/history">
            <Button
              variant="outline"
              className="text-xs sm:text-sm border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl px-4 h-12 font-semibold gap-2 cursor-pointer"
            >
              <FileText size={14} className="text-teal-600 dark:text-teal-400" />
              <span>Mutasi & Riwayat</span>
            </Button>
          </Link>

          <div className="flex items-center gap-2.5 px-4 h-12 rounded-xl bg-teal-50 dark:bg-teal-950/70 border border-teal-200/90 dark:border-teal-800 text-teal-900 dark:text-teal-200 shadow-2xs">
            <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0">
              <Coins size={16} />
            </div>
            <div>
              <span className="text-[10px] text-teal-700 dark:text-teal-400 font-semibold block leading-tight uppercase tracking-wider">
                Saldo Pasien
              </span>
              <span className="text-sm font-bold font-heading flex items-center gap-1.5">
                {loadingWallet ? (
                  <Loader2 size={13} className="animate-spin text-teal-600" />
                ) : (
                  `${wallet?.coin_balance ?? 0} Koin`
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Peringatan Wajib Regulasi Koin */}
      <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900/60 flex items-center gap-3 text-amber-900 dark:text-amber-200">
        <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
        <p className="text-xs font-semibold">
          Perhatian: Koin tidak dapat ditukarkan kembali menjadi uang. Pastikan jumlah koin sesuai dengan kebutuhan sesi konseling Anda.
        </p>
      </div>

      {/* 2. Main 2-Column Split Checkout Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
        {/* Left Column (7 Cols): Selection of Packages */}
        <div className="lg:col-span-7 space-y-6 sm:space-y-8">
          {/* Card: Therapy Packages */}
          <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
            <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="font-heading text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles size={18} className="text-teal-600 dark:text-teal-400" />
                    Pilih Paket Koin Konseling
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
                    Tarif tetap standar: 1 Koin = Rp 10.000. Tersedia untuk semua psikolog klinis berlisensi.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-6 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {therapyPackages.map((pkg) => {
                  const isSelected = !isCustomMode && selectedCoins === pkg.coins;
                  const price = pkg.coins * COIN_TO_RUPIAH;
                  return (
                    <div
                      key={pkg.id}
                      onClick={() => {
                        setSelectedCoins(pkg.coins);
                        setIsCustomMode(false);
                      }}
                      className={`relative p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                        isSelected
                          ? "border-teal-600 bg-teal-50/50 dark:bg-teal-950/60 ring-2 ring-teal-600/20 shadow-xs"
                          : "border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-teal-200 dark:hover:border-teal-700 hover:bg-slate-50/50 dark:hover:bg-slate-800"
                      }`}
                    >
                      {pkg.popular && (
                        <div className="absolute top-3 right-3">
                          <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                            Paling Populer
                          </span>
                        </div>
                      )}

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-heading font-bold text-sm text-slate-900 dark:text-white">
                            {pkg.name}
                          </h4>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-nunito leading-tight">
                          {pkg.subtitle}
                        </p>
                      </div>

                      {/* Coin & Price */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-baseline justify-between">
                        <div className="flex items-center gap-1.5 text-teal-800 dark:text-teal-300 font-bold text-sm">
                          <Coins size={16} className="text-teal-600 dark:text-teal-400" />
                          <span>{pkg.coins} Koin</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-slate-900 dark:text-white font-heading">
                            Rp {price.toLocaleString("id-ID")}
                          </p>
                        </div>
                      </div>

                      {/* Benefits bullets */}
                      <div className="space-y-1 pt-1 text-[11px] text-slate-600 dark:text-slate-400 font-nunito">
                        {pkg.benefits.map((b, idx) => (
                          <div key={idx} className="flex items-center gap-1.5">
                            <Check size={12} className="text-teal-600 dark:text-teal-400 shrink-0" />
                            <span className="truncate">{b}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Custom Coin Input Toggle */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <div
                  onClick={() => setIsCustomMode(!isCustomMode)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isCustomMode
                      ? "border-teal-600 bg-teal-50/50 dark:bg-teal-950/60 ring-2 ring-teal-600/20"
                      : "border-slate-200/90 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 flex items-center justify-center shrink-0">
                      <Coins size={16} />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white font-heading">
                        Atau Masukkan Koin Kustom
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-nunito">
                        Batas top-up: {minCoins} – {maxCoins} Koin (Rp {(minCoins * COIN_TO_RUPIAH).toLocaleString("id-ID")} – Rp {(maxCoins * COIN_TO_RUPIAH).toLocaleString("id-ID")})
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-teal-700 dark:text-teal-400">
                    {isCustomMode ? "Tutup Kustom" : "Pilih Kustom"}
                  </span>
                </div>

                {isCustomMode && (
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 mt-2 space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Coins size={15} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                        <Input
                          type="number"
                          min={minCoins}
                          max={maxCoins}
                          placeholder={`Antara ${minCoins} - ${maxCoins}`}
                          value={customCoinAmount || ""}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setCustomCoinAmount(val);
                          }}
                          className="pl-9 h-9 text-xs sm:text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 dark:text-slate-100 rounded-xl"
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Koin</span>
                    </div>

                    {!isCoinsInRange && customCoinAmount > 0 && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                        Jumlah koin harus antara {minCoins} dan {maxCoins} koin.
                      </p>
                    )}

                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">Pilihan Cepat:</span>
                      {[15, 30, 75, 150].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setCustomCoinAmount(amt)}
                          className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-teal-300 hover:bg-teal-50 dark:hover:bg-slate-800 text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          +{amt} Koin
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column (5 Cols): Sticky Order Summary & Midtrans Snap Action */}
        <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-20">
          <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
            <CardHeader className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/90">
              <CardTitle className="font-heading text-base font-bold text-slate-900 dark:text-white flex items-center justify-between">
                <span>Rincian Pembelian</span>
                <span className="text-xs font-semibold text-teal-800 dark:text-teal-300 bg-teal-100/70 dark:bg-teal-950 border border-teal-200 dark:border-teal-800 px-2.5 py-0.5 rounded-full font-mono">
                  Midtrans Snap
                </span>
              </CardTitle>
            </CardHeader>

            <CardContent className="p-4 sm:p-5 space-y-4">
              {/* Item Info */}
              <div className="space-y-2 text-xs font-nunito">
                <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                  <span className="text-slate-500 dark:text-slate-400">Paket Dipilih:</span>
                  <span className="font-bold text-slate-900 dark:text-white font-heading">
                    {isCustomMode ? `Kustom (${customCoinAmount} Koin)` : `${effectiveCoins} Koin Konseling`}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                  <span className="text-slate-500 dark:text-slate-400">Jumlah Koin Diterima:</span>
                  <span className="font-bold text-teal-700 dark:text-teal-400 flex items-center gap-1">
                    <Coins size={13} /> {effectiveCoins} Koin
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                  <span className="text-slate-500 dark:text-slate-400">Konversi Nilai:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">1 Koin = Rp 10.000</span>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-baseline">
                  <span className="font-bold text-slate-900 dark:text-white text-sm font-heading">Total Pembayaran:</span>
                  <span className="text-lg sm:text-xl font-bold text-teal-800 dark:text-teal-300 font-heading">
                    Rp {finalPrice.toLocaleString("id-ID")}
                  </span>
                </div>
              </div>

              {/* Payment Method Info Box */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <CreditCard size={15} className="text-teal-600 dark:text-teal-400" />
                  <span>Kanal Pembayaran Otomatis</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-nunito">
                  Pilih metode pembayaran (QRIS, BCA, Mandiri, BNI, BRI, GoPay, ShopeePay) langsung di jendela pop-up Midtrans Snap yang aman.
                </p>
              </div>

              {/* Action Buttons: Open Payment Gateway Simulator Modal */}
              <div className="space-y-2 pt-1">
                {topupError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
                    <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                    <span className="leading-snug">{topupError}</span>
                  </div>
                )}

                <Button
                  onClick={handlePayNow}
                  disabled={isSubmitting || !isCoinsInRange}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl py-2.5 h-11 text-xs sm:text-sm shadow-md shadow-teal-700/20 cursor-pointer gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Memproses Pesanan...</span>
                    </>
                  ) : (
                    <>
                      <Lock size={15} />
                      <span>Bayar Sekarang (Rp {finalPrice.toLocaleString("id-ID")})</span>
                      <ArrowRight size={15} />
                    </>
                  )}
                </Button>

                <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 font-nunito">
                  <ShieldCheck size={13} className="text-teal-600 dark:text-teal-400" />
                  <span>Midtrans Sandbox • Terverifikasi Bank Indonesia</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog Status Pesanan Pasca Popup Snap */}
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-bold flex items-center gap-2">
              {orderDetail?.status === "settlement" ? (
                <>
                  <CheckCircle2 size={20} className="text-emerald-600" />
                  <span>Top-Up Koin Berhasil!</span>
                </>
              ) : orderDetail?.status === "pending" ? (
                <>
                  <Clock size={20} className="text-amber-600" />
                  <span>Menunggu Pembayaran</span>
                </>
              ) : (
                <>
                  <XCircle size={20} className="text-rose-600" />
                  <span>Status Pembayaran: {orderDetail?.status || "Belum Selesai"}</span>
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              ID Pesanan: {orderDetail?.order_id || activeOrderId}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Jumlah Koin:</span>
                <span className="font-bold text-teal-700 dark:text-teal-400 font-mono text-sm">
                  {(orderDetail?.coins ?? 0) > 0 ? `+${orderDetail?.coins}` : `${orderDetail?.coins ?? 0}`} Koin
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Total Tagihan:</span>
                <span className="font-bold text-slate-900 dark:text-white font-mono">
                  Rp {orderDetail?.amount_rupiah?.toLocaleString("id-ID")}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Status Transaksi:</span>
                <Badge
                  className={`text-[10px] uppercase font-bold ${
                    orderDetail?.status === "settlement"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : orderDetail?.status === "pending"
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                  }`}
                >
                  {orderDetail?.status || "pending"}
                </Badge>
              </div>
            </div>

            {orderDetail?.status === "pending" && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Pesanan Anda telah dicatat di sistem. Koin akan otomatis ditambahkan ke akun Anda begitu pembayaran diverifikasi oleh sistem.
              </p>
            )}

            {orderDetail?.status === "settlement" && (
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 leading-relaxed font-semibold">
                Koin telah berhasil masuk ke dompet akun Anda dan siap digunakan untuk konsultasi.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            {activeOrderId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRefreshStatus(activeOrderId)}
                disabled={isCheckingStatus}
                className="text-xs rounded-xl"
              >
                {isCheckingStatus ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  "Segarkan Status"
                )}
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => setIsStatusDialogOpen(false)}
              className="bg-teal-600 hover:bg-teal-700 text-white text-xs rounded-xl"
            >
              Tutup
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
