"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TransactionRecord } from "@/store/transaction-store";
import { useUserStore } from "@/store/user-store";
import {
  Printer,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Building2,
  FileText,
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import { Logo } from "@/components/shared/atoms/Logo";

interface InvoiceModalProps {
  transaction: TransactionRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export function InvoiceModal({ transaction, isOpen, onClose }: InvoiceModalProps) {
  const user = useUserStore((state) => state.user);

  if (!transaction) return null;

  const handlePrint = () => {
    window.print();
  };

  const isIncoming = transaction.coinChange > 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl font-nunito p-4 sm:p-7 rounded-3xl overflow-y-auto max-h-[92vh] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 shadow-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Kuitansi Transaksi TemanBicara - {transaction.invoiceNumber}</DialogTitle>
          <DialogDescription>Bukti pembayaran dan mutasi koin layanan konseling</DialogDescription>
        </DialogHeader>

        {/* INVOICE PAPER CONTENT (PRINTABLE) */}
        <div className="space-y-6 pt-1 text-slate-800 dark:text-slate-100">
          {/* 1. Header Invoice */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b border-slate-200 dark:border-slate-700">
            <div className="space-y-1">
              <Logo size="md" showTagline />
              <p className="text-[11px] text-slate-500 pt-1 leading-snug">
                Layanan Telekonseling & Kesehatan Mental Klinis<br />
                Jl. Kesehatan No. 42, Jakarta Selatan 12190
              </p>
            </div>

            <div className="text-left sm:text-right space-y-1">
              <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 rounded-full uppercase tracking-wider inline-flex items-center gap-1">
                <CheckCircle2 size={11} />
                <span>STATUS: LUNAS</span>
              </span>
              <p className="font-mono font-bold text-xs text-slate-900 dark:text-white">{transaction.invoiceNumber}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{transaction.date}</p>
            </div>
          </div>

          {/* 2. Info Pasien & Metode Pembayaran */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-xs">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Penerima Layanan (Pasien)
              </span>
              <p className="font-bold text-slate-900 dark:text-white text-sm font-heading">{user.fullName}</p>
              <p className="text-slate-600 dark:text-slate-300">ID Pasien: <span className="font-mono">{user.patientId}</span></p>
              <p className="text-slate-600 truncate">{user.email}</p>
            </div>

            <div className="space-y-1 sm:text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Kanal Transaksi
              </span>
              <p className="font-semibold text-teal-800 dark:text-teal-300 text-sm">{transaction.paymentMethod}</p>
              <p className="text-slate-600 dark:text-slate-300">Pihak: {transaction.targetParty}</p>
              <p className="text-emerald-700 dark:text-emerald-400 font-semibold">{transaction.category}</p>
            </div>
          </div>

          {/* 3. Tabel Detail Layanan / Transaksi */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden text-xs">
            <div className="bg-slate-100/80 dark:bg-slate-800 p-3 font-bold text-slate-700 dark:text-slate-200 grid grid-cols-12 gap-2 select-none">
              <span className="col-span-7">Deskripsi Transaksi</span>
              <span className="col-span-2 text-center">Mutasi</span>
              <span className="col-span-3 text-right">Nominal / Nilai</span>
            </div>

            <div className="p-3.5 grid grid-cols-12 gap-2 items-center bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
              <div className="col-span-7 space-y-0.5">
                <p className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">{transaction.title}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-nunito">
                  {transaction.notes || "Layanan konseling privat terenkripsi"}
                </p>
              </div>

              <div className="col-span-2 text-center">
                <span
                  className={`font-mono font-bold text-xs inline-flex items-center gap-0.5 ${
                    isIncoming ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {isIncoming ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                  <span>{transaction.coinChange > 0 ? `+${transaction.coinChange}` : transaction.coinChange} Koin</span>
                </span>
              </div>

              <div className="col-span-3 text-right font-mono font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                {transaction.amountRupiah
                  ? `Rp ${transaction.amountRupiah.toLocaleString("id-ID")}`
                  : `${Math.abs(transaction.coinChange)} Koin`}
              </div>
            </div>

            {/* Total Row */}
            <div className="p-3 bg-slate-50/80 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-600 dark:text-slate-300">Sisa Saldo Koin Setelah Transaksi:</span>
              <span className="font-mono font-bold text-teal-800 dark:text-teal-300 text-sm">
                {transaction.coinBalanceAfter} Koin
              </span>
            </div>
          </div>

          {/* 4. HIMPSI Regulatory Compliance Note */}
          <div className="p-3 rounded-xl bg-teal-50/70 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 text-[11px] text-teal-900 dark:text-teal-200 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-teal-800 dark:text-teal-300">
              <ShieldCheck size={14} className="text-teal-600" />
              <span>Jaminan Kepatuhan Etika & Pajak Medis</span>
            </div>
            <p className="text-teal-800/80 dark:text-teal-300/90 leading-relaxed font-nunito">
              Bukti pembayaran ini sah diterbitkan secara elektronik oleh TemanBicara. Jasa psikologi dan konseling kesehatan jiwa tergolong jasa medis yang dibebaskan dari PPN berdasarkan UU No. 7 Tahun 2021 tentang Harmonisasi Peraturan Perpajakan (HPP).
            </p>
          </div>

          {/* 5. Aksi Modal */}
          <div className="flex items-center justify-end gap-2.5 pt-2 print:hidden">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="text-xs border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl h-9 px-4 gap-1.5 cursor-pointer"
            >
              <Printer size={14} />
              <span>Cetak / Simpan PDF</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={onClose}
              className="text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-xl h-9 px-5 font-semibold cursor-pointer"
            >
              Tutup
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
