"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserStore } from "@/store/user-store";
import { PaymentGatewayModal } from "@/components/views/top-up/payment-gateway-modal";
import { notify } from "@/lib/toast";
import {
  Coins,
  CreditCard,
  Wallet,
  ShieldCheck,
  Check,
  CheckCircle2,
  Gift,
  X,
  Sparkles,
  QrCode,
  Copy,
  Lock,
  ArrowRight,
  FileText,
} from "lucide-react";

interface TherapyPackage {
  id: string;
  name: string;
  subtitle: string;
  coins: number;
  price: number;
  originalPrice: number;
  discountPercent: number;
  popular?: boolean;
  benefits: string[];
}

export default function PatientTopUpPage() {
  const [selectedPackageId, setSelectedPackageId] = useState<string>("focus");
  const [customCoinAmount, setCustomCoinAmount] = useState<number>(0);
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [promoCode, setPromoCode] = useState<string>("");
  const [promoApplied, setPromoApplied] = useState<boolean>(false);
  const [promoDiscountPercent, setPromoDiscountPercent] = useState<number>(0);
  const [selectedMethod, setSelectedMethod] = useState<string>("bca");
  const [copiedAccount, setCopiedAccount] = useState<boolean>(false);
  const [isGatewayOpen, setIsGatewayOpen] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);
  const [transactionId, setTransactionId] = useState<string>("TB-882190");
  const user = useUserStore((state) => state.user);

  useEffect(() => {
    setMounted(true);
    setTransactionId(`TB-${Math.floor(100000 + Math.random() * 900000)}`);
  }, []);

  // 4 Paket Terapi Berorientasi Pemulihan
  const therapyPackages: TherapyPackage[] = [
    {
      id: "single",
      name: "Sesi Eksplorasi",
      subtitle: "1x Sesi Konseling Mendalam 60 Menit",
      coins: 50,
      price: 50000,
      originalPrice: 50000,
      discountPercent: 0,
      benefits: ["1x Konseling Psikolog Klinis", "Akses Chat Pendamping 7 Hari"],
    },
    {
      id: "focus",
      name: "Pemulihan Fokus",
      subtitle: "2x Sesi Terstruktur + Evaluasi Emosi",
      coins: 100,
      price: 95000,
      originalPrice: 100000,
      discountPercent: 5,
      popular: true,
      benefits: [
        "2x Konseling Psikolog Klinis",
        "Lembar Refleksi Mandiri & Rangkuman Sesi",
        "Prioritas Reservasi Jadwal",
      ],
    },
    {
      id: "intensive",
      name: "Terapi Intensif",
      subtitle: "4x Sesi Pemulihan Berkesinambungan",
      coins: 200,
      price: 180000,
      originalPrice: 200000,
      discountPercent: 10,
      benefits: [
        "4x Konseling Psikolog Klinis",
        "Rencana Terapi CBT / Mindfulness Personal",
        "Akses AI Sanctuary Tanpa Batas",
      ],
    },
    {
      id: "holistic",
      name: "Program Holistik",
      subtitle: "7x Sesi Pendampingan Menyeluruh",
      coins: 350,
      price: 295000,
      originalPrice: 350000,
      discountPercent: 15,
      benefits: [
        "7x Konseling Psikolog Bebas Pilih",
        "Evaluasi Klinis Berkala dari Psikolog",
        "Jaminan Reschedule Fleksibel Bebas Biaya",
      ],
    },
  ];

  // Metode Pembayaran
  const paymentMethods = [
    {
      id: "bca",
      name: "BCA Virtual Account",
      type: "va",
      account: "8271 9021 3482 1001",
      provider: "Bank Central Asia",
    },
    {
      id: "mandiri",
      name: "Mandiri Virtual Account",
      type: "va",
      account: "8932 1029 4412 8820",
      provider: "Bank Mandiri",
    },
    {
      id: "bni",
      name: "BNI Virtual Account",
      type: "va",
      account: "9820 4410 2931 5502",
      provider: "Bank Negara Indonesia",
    },
    {
      id: "qris",
      name: "QRIS Bebas Admin",
      type: "qris",
      account: "NMID: ID102008492019",
      provider: "GPN / Bank Indonesia",
    },
    {
      id: "gopay",
      name: "GoPay / GoPay Coins",
      type: "ewallet",
      account: "0812-3456-7890",
      provider: "GoTo Financial",
    },
    {
      id: "ovo",
      name: "OVO Cash",
      type: "ewallet",
      account: "0812-3456-7890",
      provider: "OVO Payment",
    },
  ];

  // Kalkulasi Harga & Diskon
  const currentPkg = therapyPackages.find((p) => p.id === selectedPackageId) || therapyPackages[1];
  const effectiveCoins = isCustomMode ? customCoinAmount : currentPkg.coins;
  const basePrice = isCustomMode ? customCoinAmount * 1000 : currentPkg.price;
  const packageDiscount = isCustomMode ? 0 : currentPkg.originalPrice - currentPkg.price;
  const promoDiscountAmount = Math.round(basePrice * (promoDiscountPercent / 100));
  const finalPrice = Math.max(0, basePrice - promoDiscountAmount);

  const selectedPaymentInfo =
    paymentMethods.find((m) => m.id === selectedMethod) || paymentMethods[0];

  const handleApplyPromo = () => {
    if (promoCode.trim().toUpperCase() === "SEHATMENTAL") {
      setPromoApplied(true);
      setPromoDiscountPercent(10);
      notify.success("Promo Berhasil!", "Kupon diskon 10% (SEHATMENTAL) berhasil diterapkan.");
    } else if (promoCode.trim().toUpperCase() === "TEMANBICARA") {
      setPromoApplied(true);
      setPromoDiscountPercent(15);
      notify.success("Promo Berhasil!", "Kupon diskon 15% (TEMANBICARA) berhasil diterapkan.");
    } else {
      notify.error("Promo Tidak Ditemukan", "Kode promo tidak valid atau masa berlaku telah kedaluwarsa.");
    }
  };

  const handleCopyAccount = () => {
    navigator.clipboard.writeText(selectedPaymentInfo.account.replace(/\s/g, ""));
    setCopiedAccount(true);
    notify.info("Tersalin", "Nomor rekening telah disalin ke papan klip.");
    setTimeout(() => setCopiedAccount(false), 2000);
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
              className="text-xs border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl px-3.5 py-2 h-9 font-semibold gap-1.5 cursor-pointer"
            >
              <FileText size={14} className="text-teal-600 dark:text-teal-400" />
              <span>Mutasi & Riwayat</span>
            </Button>
          </Link>

          <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-teal-50 dark:bg-teal-950/70 border border-teal-200/90 dark:border-teal-800 text-teal-900 dark:text-teal-200 shadow-2xs">
            <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0">
              <Coins size={16} />
            </div>
            <div>
              <span className="text-[10px] text-teal-700 dark:text-teal-400 font-semibold block leading-tight uppercase tracking-wider">
                Saldo Pasien
              </span>
              <span className="text-sm font-bold font-heading">
                {mounted ? user.coins : 50} Koin
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main 2-Column Split Checkout Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
        {/* Left Column (7 Cols): Selection of Packages & Payment Method */}
        <div className="lg:col-span-7 space-y-6 sm:space-y-8">
          {/* Card: Therapy Packages */}
          <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
            <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="font-heading text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles size={18} className="text-teal-600 dark:text-teal-400" />
                    Pilih Paket Sesi Konseling
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
                    Paket hemat sudah termasuk asesmen psikologis dan prioritas jadwal
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-6 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {therapyPackages.map((pkg) => {
                  const isSelected = !isCustomMode && selectedPackageId === pkg.id;
                  return (
                    <div
                      key={pkg.id}
                      onClick={() => {
                        setSelectedPackageId(pkg.id);
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
                          {pkg.discountPercent > 0 && (
                            <span className="text-[10px] font-bold text-teal-800 dark:text-teal-300 bg-teal-100 dark:bg-teal-950 px-1.5 py-0.2 rounded-md">
                              Hemat {pkg.discountPercent}%
                            </span>
                          )}
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
                          {pkg.discountPercent > 0 && (
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 line-through">
                              Rp {pkg.originalPrice.toLocaleString("id-ID")}
                            </p>
                          )}
                          <p className="text-sm font-bold text-slate-900 dark:text-white font-heading">
                            Rp {pkg.price.toLocaleString("id-ID")}
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
                        Rp 1.000 / Koin sesuai jumlah kebutuhan konsultasimu
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-teal-700 dark:text-teal-400">
                    {isCustomMode ? "Tutup" : "Pilih Kustom"}
                  </span>
                </div>

                {isCustomMode && (
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 mt-2 space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Coins size={15} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                        <Input
                          type="number"
                          placeholder="Contoh: 75"
                          value={customCoinAmount || ""}
                          onChange={(e) => setCustomCoinAmount(Math.max(0, parseInt(e.target.value) || 0))}
                          className="pl-9 h-9 text-xs sm:text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 dark:text-slate-100 rounded-xl"
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Koin</span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">Pilihan Cepat:</span>
                      {[25, 50, 75, 150].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setCustomCoinAmount(amt)}
                          className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-teal-300 hover:bg-teal-50 dark:hover:bg-slate-800 text-[11px] font-semibold transition-colors"
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

          {/* Card: Payment Methods */}
          <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
            <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="font-heading text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CreditCard size={18} className="text-teal-600 dark:text-teal-400" />
                Metode Pembayaran
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
                Pembayaran otomatis terverifikasi tanpa perlu unggah bukti transfer manual
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 sm:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {paymentMethods.map((method) => {
                  const isSelected = selectedMethod === method.id;
                  return (
                    <div
                      key={method.id}
                      onClick={() => setSelectedMethod(method.id)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? "border-teal-600 bg-teal-50/50 dark:bg-teal-950/60 ring-2 ring-teal-600/20 shadow-2xs"
                          : "border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-teal-200 dark:hover:border-teal-700 hover:bg-slate-50/50 dark:hover:bg-slate-800"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                          {method.type === "qris" ? (
                            <QrCode size={18} className="text-teal-700 dark:text-teal-400" />
                          ) : method.type === "ewallet" ? (
                            <Wallet size={18} className="text-teal-700 dark:text-teal-400" />
                          ) : (
                            <CreditCard size={18} className="text-teal-700 dark:text-teal-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white font-heading truncate">
                            {method.name}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-nunito truncate">
                            Verifikasi Instan 24 Jam
                          </p>
                        </div>
                      </div>

                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected
                            ? "border-teal-600 bg-teal-600 text-white"
                            : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        }`}
                      >
                        {isSelected && <Check size={10} strokeWidth={3} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column (5 Cols): Sticky Order Summary & Direct VA Checkout */}
        <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-20">
          <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
            <CardHeader className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/90">
              <CardTitle className="font-heading text-base font-bold text-slate-900 dark:text-white flex items-center justify-between">
                <span>Rincian Pembayaran</span>
                <span className="text-xs font-semibold text-teal-800 dark:text-teal-300 bg-teal-100/70 dark:bg-teal-950 border border-teal-200 dark:border-teal-800 px-2.5 py-0.5 rounded-full font-mono">
                  ID Transaksi: {transactionId}
                </span>
              </CardTitle>
            </CardHeader>

            <CardContent className="p-4 sm:p-5 space-y-4">
              {/* Item Info */}
              <div className="space-y-2 text-xs font-nunito">
                <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                  <span className="text-slate-500 dark:text-slate-400">Item Pembelian:</span>
                  <span className="font-bold text-slate-900 dark:text-white font-heading">
                    {isCustomMode ? `Koin Kustom (${customCoinAmount} Koin)` : currentPkg.name}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                  <span className="text-slate-500 dark:text-slate-400">Jumlah Koin Diterima:</span>
                  <span className="font-bold text-teal-700 dark:text-teal-400 flex items-center gap-1">
                    <Coins size={13} /> {effectiveCoins} Koin
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                  <span className="text-slate-500 dark:text-slate-400">Metode Pembayaran:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedPaymentInfo.name}</span>
                </div>

                {packageDiscount > 0 && (
                  <div className="flex justify-between items-center text-teal-700 dark:text-teal-400 font-medium">
                    <span>Diskon Paket:</span>
                    <span>- Rp {packageDiscount.toLocaleString("id-ID")}</span>
                  </div>
                )}

                {promoApplied && (
                  <div className="flex justify-between items-center text-emerald-700 dark:text-emerald-400 font-medium">
                    <span>Diskon Kode Promo ({promoDiscountPercent}%):</span>
                    <span>- Rp {promoDiscountAmount.toLocaleString("id-ID")}</span>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-baseline">
                  <span className="font-bold text-slate-900 dark:text-white text-sm font-heading">Total Pembayaran:</span>
                  <span className="text-lg sm:text-xl font-bold text-teal-800 dark:text-teal-300 font-heading">
                    Rp {finalPrice.toLocaleString("id-ID")}
                  </span>
                </div>
              </div>

              {/* Promo Code Input Box */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    <Gift size={13} className="text-teal-600 dark:text-teal-400" /> Kode Promo Terapi
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">Gunakan: SEHATMENTAL</span>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      placeholder="Masukkan kode promo"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      disabled={promoApplied}
                      className="h-8 text-xs bg-white dark:bg-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-700 uppercase"
                    />
                  </div>
                  {promoApplied ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setPromoApplied(false);
                        setPromoDiscountPercent(0);
                        setPromoCode("");
                      }}
                      className="h-8 text-xs text-rose-600 dark:text-rose-400"
                    >
                      <X size={14} />
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={handleApplyPromo}
                      className="h-8 text-xs bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white rounded-lg px-3"
                    >
                      Terapkan
                    </Button>
                  )}
                </div>
              </div>

              {/* Direct VA Account Box */}
              <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Nomor Rekening / VA:</span>
                  <span className="font-bold text-teal-800 dark:text-teal-400 text-[11px]">{selectedPaymentInfo.provider}</span>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
                  <span className="font-mono font-bold text-xs sm:text-sm text-slate-900 dark:text-white tracking-wider truncate">
                    {selectedPaymentInfo.account}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCopyAccount}
                    className="h-7 text-xs text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-slate-800 px-2 gap-1 cursor-pointer"
                  >
                    {copiedAccount ? (
                      <>
                        <Check size={12} className="text-emerald-600" />
                        <span className="text-emerald-700 font-semibold">Tersalin</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Salin</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Action Buttons: Open Payment Gateway Simulator Modal */}
              <div className="space-y-2 pt-1">
                <Button
                  onClick={() => setIsGatewayOpen(true)}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl py-2.5 h-11 text-xs sm:text-sm shadow-md shadow-teal-700/20 cursor-pointer gap-2"
                >
                  <Lock size={15} />
                  <span>Bayar Sekarang (Rp {finalPrice.toLocaleString("id-ID")})</span>
                  <ArrowRight size={15} />
                </Button>

                <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 font-nunito">
                  <ShieldCheck size={13} className="text-teal-600 dark:text-teal-400" />
                  <span>Jaminan Keamanan SSL 256-Bit • Terverifikasi Bank Indonesia</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Interactive Midtrans/Xendit Payment Simulator Modal */}
      <PaymentGatewayModal
        isOpen={isGatewayOpen}
        onClose={() => setIsGatewayOpen(false)}
        packageName={isCustomMode ? `Koin Kustom (${customCoinAmount} Koin)` : currentPkg.name}
        coinAmount={effectiveCoins}
        finalPrice={finalPrice}
        paymentMethod={selectedPaymentInfo.name}
        accountNumber={selectedPaymentInfo.account}
      />
    </div>
  );
}
