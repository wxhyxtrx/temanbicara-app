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

// Mock transaksi dibersihkan - Digantikan API buku besar riil /api/wallet/transactions (Fase 2)
const initialTransactions: TransactionRecord[] = [];

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
