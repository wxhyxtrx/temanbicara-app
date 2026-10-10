"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  QrCode,
  CreditCard,
  Building2,
  Wallet,
  Copy,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
  Lock,
  Coins,
} from "lucide-react";
import { useUserStore } from "@/store/user-store";
import { useTransactionStore, TransactionRecord } from "@/store/transaction-store";
import { useNotificationStore } from "@/store/notification-store";
import { notify } from "@/lib/toast";

interface PaymentGatewayModalProps {
  isOpen: boolean;
  onClose: () => void;
  packageName: string;
  coinAmount: number;
  finalPrice: number;
  paymentMethod: string;
  accountNumber: string;
  onPaymentSuccess?: (record: TransactionRecord) => void;
}

export function PaymentGatewayModal({
  isOpen,
  onClose,
  packageName,
  coinAmount,
  finalPrice,
  paymentMethod,
  accountNumber,
  onPaymentSuccess,
}: PaymentGatewayModalProps) {
  const user = useUserStore((state) => state.user);
  const updateCoins = useUserStore((state) => state.updateCoins);
  const addTransaction = useTransactionStore((state) => state.addTransaction);

  const [activeTab, setActiveTab] = useState<"va" | "qris" | "ewallet">("va");
  const [copied, setCopied] = useState<boolean>(false);
  const [processing, setProcessing] = useState<boolean>(false);
  const [successRecord, setSuccessRecord] = useState<TransactionRecord | null>(null);
  const [orderId, setOrderId] = useState<string>("TB-SNAP-882190");

  useEffect(() => {
    setOrderId(`TB-SNAP-${Math.floor(100000 + Math.random() * 900000)}`);
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    notify.info("Tersalin", "Nomor pembayaran disalin ke papan klip.");
    setTimeout(() => setCopied(false), 2000);
  };

  // Simulasi Eksekusi Pembayaran Berhasil (Client-side Mockup Snap SDK)
  const handleSimulateSuccess = () => {
    setProcessing(true);

    setTimeout(() => {
      // 1. Tambah koin ke dompet user
      updateCoins(coinAmount, true);

      // 2. Catat mutasi & invoice baru ke transaction store
      const newBalance = user.coins + coinAmount;
      const record = addTransaction({
        date: new Date().toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }) + " WIB",
        type: "topup",
        category: "Top Up Koin",
        title: `Top Up ${packageName} (+${coinAmount} Koin)`,
        targetParty: `TemanBicara Gateway (${paymentMethod})`,
        amountRupiah: finalPrice,
        coinChange: coinAmount,
        coinBalanceAfter: newBalance,
        paymentMethod: paymentMethod,
        status: "berhasil",
        notes: `Simulasi pembayaran berhasil via Gateway ${orderId}`,
      });

      // Catat notifikasi aktivitas top-up
      useNotificationStore.getState().addNotification({
        title: "Top Up Koin Berhasil",
        message: `Pembayaran Rp ${finalPrice.toLocaleString("id-ID")} berhasil. +${coinAmount} Koin telah ditambahkan ke dompet akunmu.`,
        type: "transaksi",
        actionUrl: "/top-up/history",
      });

      notify.success(
        "Top Up Koin Berhasil!",
        `+${coinAmount} Koin telah ditambahkan ke dompet akun Anda (Rp ${finalPrice.toLocaleString("id-ID")}).`
      );

      setProcessing(false);
      setSuccessRecord(record);

      if (onPaymentSuccess) {
        onPaymentSuccess(record);
      }
    }, 1000);
  };

  const handleClose = () => {
    setSuccessRecord(null);
    setProcessing(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-lg font-nunito p-0 overflow-hidden rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>
            {successRecord ? "Pembayaran Terverifikasi" : "Payment Gateway TemanBicara"}
          </DialogTitle>
          <DialogDescription>
            {successRecord ? "Struk transaksi dan penambahan koin berhasil" : "Simulasi pembayaran Midtrans Snap"}
          </DialogDescription>
        </DialogHeader>

        {successRecord ? (
          /* RECEIPT PEMBAYARAN BERHASIL */
          <div className="p-6 text-center space-y-5 bg-white dark:bg-slate-900">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-sm animate-in zoom-in-95">
              <CheckCircle2 size={36} />
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-3 py-1 rounded-full uppercase tracking-wider">
                Pembayaran Terverifikasi
              </span>
              <h3 className="text-xl font-bold font-heading text-slate-900 dark:text-white pt-2">
                Top Up Berhasil!
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Koin konseling telah otomatis ditambahkan ke saldo akunmu.
              </p>
            </div>

            {/* Rincian Struk */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/90 dark:border-slate-700 text-xs space-y-2.5 text-left">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Nomor Invoice:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{successRecord.invoiceNumber}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Jumlah Koin Diterima:</span>
                <span className="font-bold text-teal-800 dark:text-teal-300 font-mono flex items-center gap-1">
                  <Coins size={13} />
                  <span>+{coinAmount} Koin</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Total Dibayar:</span>
                <span className="font-bold text-slate-900 dark:text-white font-mono">
                  Rp {finalPrice.toLocaleString("id-ID")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Metode Pembayaran:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{paymentMethod}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between font-semibold">
                <span className="text-slate-700 dark:text-slate-300">Saldo Koin Sekarang:</span>
                <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">{user.coins + coinAmount} Koin</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
              <Button
                variant="outline"
                onClick={handleClose}
                className="w-full text-xs border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl h-10 font-semibold cursor-pointer"
              >
                Tutup
              </Button>
              <Button
                onClick={() => {
                  handleClose();
                  window.location.href = "/top-up/history";
                }}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white rounded-xl h-10 text-xs font-semibold shadow-xs gap-1.5 cursor-pointer"
              >
                <span>Lihat Mutasi & Invoice</span>
                <ArrowRight size={14} />
              </Button>
            </div>
          </div>
        ) : (
          /* SNAP / XENDIT PAYMENT GATEWAY UI SIMULATOR */
          <div className="flex flex-col h-full bg-white dark:bg-slate-900">
            {/* Header Gateway */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-teal-900 via-teal-950 to-slate-900 text-white flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-heading font-bold text-sm tracking-tight">TemanBicara</span>
                  <span className="text-[10px] bg-teal-800/80 border border-teal-700/80 px-2 py-0.5 rounded-full text-teal-200 font-semibold">
                    Snap Gateway SDK
                  </span>
                </div>
                <p className="text-[11px] text-teal-200/80 font-mono">ID Tagihan: {orderId}</p>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-teal-300 uppercase tracking-wider block">Total Tagihan</span>
                <span className="text-base sm:text-lg font-bold font-mono text-white">
                  Rp {finalPrice.toLocaleString("id-ID")}
                </span>
              </div>
            </div>

            {/* Content Tabs */}
            <div className="p-4 sm:p-5 space-y-4 bg-white dark:bg-slate-900">
              {/* Payment Method Selector Tabs */}
              <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300">
                <button
                  type="button"
                  onClick={() => setActiveTab("va")}
                  className={`py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeTab === "va" ? "bg-white dark:bg-slate-700 text-teal-900 dark:text-teal-200 shadow-2xs font-bold" : "hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Building2 size={13} />
                  <span>Virtual Account</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("qris")}
                  className={`py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeTab === "qris" ? "bg-white dark:bg-slate-700 text-teal-900 dark:text-teal-200 shadow-2xs font-bold" : "hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <QrCode size={13} />
                  <span>QRIS</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("ewallet")}
                  className={`py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeTab === "ewallet" ? "bg-white dark:bg-slate-700 text-teal-900 dark:text-teal-200 shadow-2xs font-bold" : "hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Wallet size={13} />
                  <span>E-Wallet</span>
                </button>
              </div>

              {/* Tab 1: Virtual Account */}
              {activeTab === "va" && (
                <div className="space-y-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/90 dark:border-slate-700 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Bank Tujuan:</span>
                    <span className="font-bold text-teal-800 dark:text-teal-300">{paymentMethod}</span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Nomor Virtual Account:</span>
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono font-bold text-sm text-slate-900 dark:text-white">
                      <span>{accountNumber}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(accountNumber)}
                        className="text-xs text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 flex items-center gap-1 cursor-pointer font-sans font-semibold"
                      >
                        <Copy size={13} />
                        <span>{copied ? "Tersalin" : "Salin"}</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-nunito">
                    Buka m-Banking atau ATM, pilih menu Transfer ke Virtual Account, lalu masukkan nominal tepat{" "}
                    <strong className="text-slate-900 dark:text-white">Rp {finalPrice.toLocaleString("id-ID")}</strong>.
                  </p>
                </div>
              )}

              {/* Tab 2: QRIS */}
              {activeTab === "qris" && (
                <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/90 dark:border-slate-700 text-center">
                  <div className="w-36 h-36 bg-white p-2 border-2 border-slate-200 dark:border-slate-600 rounded-2xl mx-auto shadow-2xs flex flex-col items-center justify-center space-y-1">
                    <QrCode size={100} className="text-slate-800" />
                    <span className="text-[9px] font-bold tracking-widest text-slate-500 dark:text-slate-400 uppercase">QRIS STANDAR</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-nunito">
                    Scan menggunakan aplikasi GoPay, OVO, Dana, ShopeePay, atau BCA Mobile.
                  </p>
                </div>
              )}

              {/* Tab 3: E-Wallet */}
              {activeTab === "ewallet" && (
                <div className="space-y-2.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/90 dark:border-slate-700 text-xs">
                  <p className="font-semibold text-slate-800 dark:text-slate-200">Pilih Dompet Digital:</p>
                  {["GoPay Instan", "OVO Direct", "ShopeePay"].map((ew, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200 hover:border-teal-300 dark:hover:border-teal-700 transition-colors cursor-pointer"
                    >
                      <span>{ew}</span>
                      <span className="text-[11px] text-teal-700 dark:text-teal-400">Terhubung</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Tombol Simulasi Pembayaran Berhasil */}
              <div className="space-y-2 pt-2">
                <Button
                  onClick={handleSimulateSuccess}
                  disabled={processing}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl py-5 text-xs sm:text-sm shadow-md shadow-emerald-600/20 cursor-pointer gap-2"
                >
                  <CheckCircle2 size={16} />
                  <span>{processing ? "Memverifikasi Pembayaran..." : "Simulasikan Pembayaran Berhasil"}</span>
                </Button>

                <p className="text-[10px] text-center text-slate-400 font-nunito">
                  Mode Simulasi Frontend Sandbox • Koin konseling langsung cair ke saldo Anda
                </p>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
