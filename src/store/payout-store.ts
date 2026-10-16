import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useNotificationStore } from "@/store/notification-store";
import { useUserStore } from "@/store/user-store";

export interface PayoutRecord {
  id: string;
  invoiceNo: string;
  counselorName: string;
  date: string;
  timestamp: number;
  amountRupiah: number;
  coinsDeducted: number;
  bankName: string;
  accountNo: string;
  accountHolder: string;
  status: "Diproses" | "Berhasil" | "Ditolak";
  notes?: string;
}

// Mock payouts dibersihkan - Digantikan API riil /api/wallet/payouts dan /api/admin/payouts (Fase 2)
const initialPayouts: PayoutRecord[] = [];

export interface PayoutState {
  payouts: PayoutRecord[];
  requestPayout: (payload: {
    counselorName: string;
    coinsDeducted: number;
    amountRupiah: number;
    bankName: string;
    accountNo: string;
    accountHolder: string;
  }) => PayoutRecord;
  approvePayout: (id: string) => boolean;
  rejectPayout: (id: string, reason?: string) => boolean;
}

export const usePayoutStore = create<PayoutState>()(
  persist(
    (set, get) => ({
      payouts: initialPayouts,

      requestPayout: (payload) => {
        const timestamp = Date.now();
        const rand = Math.floor(100 + Math.random() * 900);
        const invoiceNo = `PAY-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${rand}`;

        const newRecord: PayoutRecord = {
          id: `po-${timestamp}`,
          invoiceNo,
          counselorName: payload.counselorName,
          date: "Hari Ini, " + new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }),
          timestamp,
          amountRupiah: payload.amountRupiah,
          coinsDeducted: payload.coinsDeducted,
          bankName: payload.bankName,
          accountNo: payload.accountNo,
          accountHolder: payload.accountHolder,
          status: "Diproses",
          notes: "Pengajuan penarikan dana honor konsultasi.",
        };

        set({
          payouts: [newRecord, ...get().payouts],
        });

        useNotificationStore.getState().addNotification({
          title: "Pengajuan Payout Terkirim",
          message: `Penarikan honor sebesar Rp ${payload.amountRupiah.toLocaleString("id-ID")} (${payload.coinsDeducted} Koin) sedang diverifikasi admin.`,
          type: "sistem",
          actionUrl: "/counselor/earnings",
        });

        return newRecord;
      },

      approvePayout: (id) => {
        const current = get().payouts;
        const target = current.find((p) => p.id === id);
        if (!target) return false;

        set({
          payouts: current.map((p) =>
            p.id === id ? { ...p, status: "Berhasil", notes: "Disetujui dan ditransfer oleh Administrator Platform." } : p
          ),
        });

        useNotificationStore.getState().addNotification({
          title: "Payout Berhasil Dicairkan!",
          message: `Transfer honor ${target.invoiceNo} sebesar Rp ${target.amountRupiah.toLocaleString("id-ID")} telah dikirim ke rekening ${target.bankName}.`,
          type: "sistem",
          actionUrl: "/counselor/earnings",
        });

        return true;
      },

      rejectPayout: (id, reason) => {
        const current = get().payouts;
        const target = current.find((p) => p.id === id);
        if (!target) return false;

        // Refund coins to counselor wallet
        useUserStore.getState().creditCounselorCoins(target.coinsDeducted);

        set({
          payouts: current.map((p) =>
            p.id === id ? { ...p, status: "Ditolak", notes: reason || "Data nomor rekening tidak sesuai dengan SIPPK." } : p
          ),
        });

        useNotificationStore.getState().addNotification({
          title: "Pengajuan Payout Ditolak",
          message: `Penarikan ${target.invoiceNo} ditolak: ${reason || "Periksa kembali kesesuaian data rekening."} ${target.coinsDeducted} Koin telah dikembalikan.`,
          type: "sistem",
          actionUrl: "/counselor/earnings",
        });

        return true;
      },
    }),
    {
      name: "tb_payout_store_v1",
    }
  )
);
