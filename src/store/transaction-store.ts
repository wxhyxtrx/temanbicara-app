import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface TransactionRecord {
  id: string;
  invoiceNumber: string;
  date: string;
  timestamp: number;
  type: "topup" | "usage" | "refund";
  category: "Top Up Koin" | "Konseling Chat" | "Voice Call" | "Refund Pembatalan" | "Bonus Selamat Datang" | "Tip Apresiasi";
  title: string;
  targetParty: string; // e.g. "Dr. Anita Wijaya, M.Psi." / "TemanBicara Gateway"
  amountRupiah?: number; // Nilai IDR jika transaksi uang tunai
  coinChange: number; // +XX atau -XX
  coinBalanceAfter: number;
  paymentMethod: string; // e.g. "BCA Virtual Account", "QRIS", "Saldo Koin Konseling"
  status: "berhasil" | "menunggu" | "dibatalkan";
  notes?: string;
}

const initialTransactions: TransactionRecord[] = [
  {
    id: "tx-01",
    invoiceNumber: "INV/TB/20261005/001",
    date: "05 Okt 2026, 10:15 WIB",
    timestamp: 1791195300000,
    type: "topup",
    category: "Top Up Koin",
    title: "Pembelian Paket Sesi Eksplorasi (50 Koin)",
    targetParty: "TemanBicara Healthcare Gateway (BCA VA)",
    amountRupiah: 50000,
    coinChange: 50,
    coinBalanceAfter: 50,
    paymentMethod: "BCA Virtual Account",
    status: "berhasil",
    notes: "Pembayaran terverifikasi otomatis via Payment Gateway.",
  },
  {
    id: "tx-02",
    invoiceNumber: "INV/TB/20261005/002",
    date: "05 Okt 2026, 11:30 WIB",
    timestamp: 1791199800000,
    type: "usage",
    category: "Voice Call",
    title: "Sesi Panggilan Suara Privat (1 Jam)",
    targetParty: "Dr. Anita Wijaya, M.Psi.",
    coinChange: -5,
    coinBalanceAfter: 45,
    paymentMethod: "Saldo Koin Pasien",
    status: "berhasil",
    notes: "Konsultasi regulasi kecemasan & stres kerja.",
  },
  {
    id: "tx-03",
    invoiceNumber: "INV/TB/20261004/003",
    date: "04 Okt 2026, 15:45 WIB",
    timestamp: 1791128700000,
    type: "usage",
    category: "Konseling Chat",
    title: "Sesi Chat Eksklusif (60 Menit)",
    targetParty: "Budi Santoso, M.Psi., Psikolog",
    coinChange: -15,
    coinBalanceAfter: 50,
    paymentMethod: "Saldo Koin Pasien",
    status: "berhasil",
    notes: "Konsultasi pemetaan batasan jam kerja & burnout.",
  },
  {
    id: "tx-04",
    invoiceNumber: "INV/TB/20261003/004",
    date: "03 Okt 2026, 09:00 WIB",
    timestamp: 1791018000000,
    type: "topup",
    category: "Bonus Selamat Datang",
    title: "Koin Selamat Datang Pasien Terverifikasi",
    targetParty: "TemanBicara Welcome Program",
    coinChange: 20,
    coinBalanceAfter: 65,
    paymentMethod: "Sistem Reward TemanBicara",
    status: "berhasil",
    notes: "Bonus pendaftaran akun pasien baru.",
  },
];

export interface TransactionState {
  transactions: TransactionRecord[];
  addTransaction: (tx: Omit<TransactionRecord, "id" | "invoiceNumber" | "timestamp">) => TransactionRecord;
}

export const useTransactionStore = create<TransactionState>()(
  persist(
    (set, get) => ({
      transactions: initialTransactions,

      addTransaction: (data) => {
        const timestamp = Date.now();
        const randId = Math.floor(1000 + Math.random() * 9000);
        const invoiceNumber = `INV/TB/${new Date().toISOString().slice(0, 10).replace(/-/g, "")}/${randId}`;
        
        const newRecord: TransactionRecord = {
          ...data,
          id: `tx-${timestamp}`,
          invoiceNumber,
          timestamp,
        };

        set({
          transactions: [newRecord, ...get().transactions],
        });

        return newRecord;
      },
    }),
    {
      name: "tb_transaction_store",
    }
  )
);
