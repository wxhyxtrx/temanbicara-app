import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useUserStore } from "@/store/user-store";
import { useTransactionStore } from "@/store/transaction-store";
import { useNotificationStore } from "@/store/notification-store";

export interface ScheduleItem {
  id: string;
  date: string;
  time: string;
  consultant: string;
  title: string;
  topic: string;
  initials: string;
  type: "Chat Eksklusif" | "Voice Call";
  status: "terjadwal" | "menunggu" | "selesai" | "dibatalkan";
  roomReady?: boolean;
  notes?: string;
  coinFee: number;
  consultantId?: number;
  cancellationReason?: string;
  createdAt?: string;
}

export interface BookingPayload {
  consultantId: number;
  consultantName: string;
  consultantTitle: string;
  consultantInitials: string;
  date: string;
  time: string;
  type: "Chat Eksklusif" | "Voice Call";
  topic: string;
  coinFee: number;
  notes?: string;
}

const initialSchedules: ScheduleItem[] = [
  {
    id: "sch-01",
    date: "Kamis, 15 Oktober 2026",
    time: "14:00 - 15:00 WIB",
    consultant: "Dr. Anita Wijaya, M.Psi.",
    title: "Psikolog Klinis Dewasa",
    topic: "Sesi Terapi Regulasi Emosi & CBT",
    initials: "AW",
    type: "Chat Eksklusif",
    status: "terjadwal",
    roomReady: true,
    coinFee: 15,
    consultantId: 1,
    notes: "Klien membawa catatan jurnal emosi harian selama sepekan.",
  },
  {
    id: "sch-02",
    date: "Sabtu, 17 Oktober 2026",
    time: "10:00 - 11:00 WIB",
    consultant: "TemanBicara AI Empatik",
    title: "Pendamping Emosi 24/7",
    topic: "Evaluasi Pemetaan Pemicu Stres Mandiri",
    initials: "TB",
    type: "Chat Eksklusif",
    status: "menunggu",
    roomReady: false,
    coinFee: 0,
    consultantId: 0,
    notes: "Sesi pendampingan AI instan gratis.",
  },
  {
    id: "sch-03",
    date: "Senin, 28 September 2026",
    time: "16:00 - 17:00 WIB",
    consultant: "Budi Santoso, M.Psi., Psikolog",
    title: "Psikolog Karier & Emosi",
    topic: "Konseling Penanganan Burnout & Work-Life Balance",
    initials: "BS",
    type: "Voice Call",
    status: "selesai",
    roomReady: false,
    coinFee: 5,
    consultantId: 2,
    notes: "Rencana aksi pembagian batasan jam kerja disepakati.",
  },
  {
    id: "sch-04",
    date: "Rabu, 23 September 2026",
    time: "13:00 - 14:00 WIB",
    consultant: "Siti Rahayu, S.Psi., M.A.",
    title: "Konselor Hubungan & Keluarga",
    topic: "Sesi Refleksi Pola Komunikasi Pasangan",
    initials: "SR",
    type: "Chat Eksklusif",
    status: "selesai",
    roomReady: false,
    coinFee: 15,
    consultantId: 3,
    notes: "Latihan active listening 10 menit bersama pasangan.",
  },
];

export interface ScheduleState {
  schedules: ScheduleItem[];
  bookSession: (payload: BookingPayload) => { success: boolean; error?: string; item?: ScheduleItem };
  rescheduleSession: (id: string, newDate: string, newTime: string) => boolean;
  cancelSession: (id: string, reason?: string) => { success: boolean; refundedCoins: number };
  updateSessionStatus: (id: string, status: "terjadwal" | "menunggu" | "selesai" | "dibatalkan") => void;
}

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (set, get) => ({
      schedules: initialSchedules,

      updateSessionStatus: (id, status) => {
        const current = get().schedules;
        const target = current.find((s) => s.id === id);
        if (!target) return;

        set({
          schedules: current.map((s) => (s.id === id ? { ...s, status, roomReady: status === "terjadwal" } : s)),
        });

        if (status === "terjadwal") {
          useNotificationStore.getState().addNotification({
            title: "Sesi Dikonfirmasi Psikolog",
            message: `Jadwal konseling bersama ${target.consultant} pada ${target.date} telah disetujui.`,
            type: "jadwal",
            actionUrl: "/patient/schedule",
          });
        } else if (status === "dibatalkan") {
          if (target.coinFee > 0) {
            useUserStore.getState().updateCoins(target.coinFee, true);
          }
          useNotificationStore.getState().addNotification({
            title: "Sesi Konseling Dibatalkan",
            message: `Jadwal bersama ${target.consultant} dibatalkan. ${target.coinFee} Koin telah dikembalikan ke dompet Anda.`,
            type: "jadwal",
            actionUrl: "/patient/schedule",
          });
        }
      },

      bookSession: (payload) => {
        const userStore = useUserStore.getState();
        const currentCoins = userStore.user.coins;

        if (currentCoins < payload.coinFee) {
          return {
            success: false,
            error: `Saldo koin tidak mencukupi (Perlu ${payload.coinFee} Koin, Saldo Anda ${currentCoins} Koin).`,
          };
        }

        // Deduct coins
        userStore.updateCoins(-payload.coinFee, true);

        const newSession: ScheduleItem = {
          id: `sch-${Date.now()}`,
          date: payload.date,
          time: payload.time,
          consultant: payload.consultantName,
          title: payload.consultantTitle,
          topic: payload.topic.trim() || "Konsultasi Pendampingan Mental & Regulasi Diri",
          initials: payload.consultantInitials,
          type: payload.type,
          status: "terjadwal",
          roomReady: true,
          coinFee: payload.coinFee,
          consultantId: payload.consultantId,
          notes: payload.notes || "Sesi baru dijadwalkan oleh pasien.",
          createdAt: new Date().toISOString(),
        };

        set({
          schedules: [newSession, ...get().schedules],
        });

        // Catat mutasi koin keluar ke transaction store
        useTransactionStore.getState().addTransaction({
          date: new Date().toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }) + " WIB",
          type: "usage",
          category: payload.type === "Voice Call" ? "Voice Call" : "Konseling Chat",
          title: `Reservasi ${payload.type} bersama ${payload.consultantName}`,
          targetParty: payload.consultantName,
          coinChange: -payload.coinFee,
          coinBalanceAfter: currentCoins - payload.coinFee,
          paymentMethod: "Saldo Koin Pasien",
          status: "berhasil",
          notes: payload.topic,
        });

        // Catat notifikasi aktivitas pasien
        useNotificationStore.getState().addNotification({
          title: "Reservasi Sesi Berhasil",
          message: `Sesi ${payload.type} bersama ${payload.consultantName} pada ${payload.date} berhasil dijadwalkan.`,
          type: "jadwal",
          actionUrl: "/patient/schedule",
        });

        return { success: true, item: newSession };
      },

      rescheduleSession: (id, newDate, newTime) => {
        const current = get().schedules;
        const exists = current.find((s) => s.id === id);
        if (!exists) return false;

        set({
          schedules: current.map((s) =>
            s.id === id
              ? {
                  ...s,
                  date: newDate,
                  time: newTime,
                  status: "terjadwal",
                  roomReady: true,
                }
              : s
          ),
        });

        useNotificationStore.getState().addNotification({
          title: "Jadwal Berhasil Dipindahkan",
          message: `Sesi konseling bersama ${exists.consultant} dijadwalkan ulang ke ${newDate} pukul ${newTime}.`,
          type: "jadwal",
          actionUrl: "/patient/schedule",
        });

        return true;
      },

      cancelSession: (id, reason) => {
        const current = get().schedules;
        const target = current.find((s) => s.id === id);
        if (!target) return { success: false, refundedCoins: 0 };

        // Refund coins if session was active
        const shouldRefund = target.status === "terjadwal" || target.status === "menunggu";
        const refundAmount = shouldRefund ? target.coinFee : 0;

        if (refundAmount > 0) {
          useUserStore.getState().updateCoins(refundAmount, true);

          // Catat pengembalian koin ke transaction store
          const currentBal = useUserStore.getState().user.coins;
          useTransactionStore.getState().addTransaction({
            date: new Date().toLocaleDateString("id-ID", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }) + " WIB",
            type: "refund",
            category: "Refund Pembatalan",
            title: `Pengembalian Koin: Sesi ${target.consultant}`,
            targetParty: "TemanBicara Refund System",
            coinChange: refundAmount,
            coinBalanceAfter: currentBal,
            paymentMethod: "Saldo Koin Pasien",
            status: "berhasil",
            notes: reason || "Pembatalan sesi oleh pasien.",
          });
        }

        useNotificationStore.getState().addNotification({
          title: "Sesi Konseling Dibatalkan",
          message: `Sesi bersama ${target.consultant} telah dibatalkan.${
            refundAmount > 0 ? ` ${refundAmount} Koin dikembalikan ke saldo dompetmu.` : ""
          }`,
          type: "jadwal",
          actionUrl: "/patient/schedule",
        });

        set({
          schedules: current.map((s) =>
            s.id === id
              ? {
                  ...s,
                  status: "dibatalkan",
                  roomReady: false,
                  cancellationReason: reason || "Dibatalkan atas permintaan pasien.",
                }
              : s
          ),
        });

        return { success: true, refundedCoins: refundAmount };
      },
    }),
    {
      name: "tb_schedule_store",
    }
  )
);
