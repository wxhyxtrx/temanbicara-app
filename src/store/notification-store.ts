import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  createdAt: number;
  read: boolean;
  type: "jadwal" | "transaksi" | "chat" | "sistem";
  actionUrl?: string;
}

const initialNotifications: NotificationItem[] = [
  {
    id: "notif-01",
    title: "Sesi Konseling Mendatang",
    message: "Janji temu bersama Dr. Anita Wijaya, M.Psi. terjadwal hari ini pukul 14:00 WIB.",
    time: "10 menit lalu",
    createdAt: Date.now() - 10 * 60 * 1000,
    read: false,
    type: "jadwal",
    actionUrl: "/schedule",
  },
  {
    id: "notif-02",
    title: "Top Up Koin Berhasil",
    message: "Pembelian 50 Koin telah diverifikasi dan masuk ke dompet konseling Anda.",
    time: "1 jam lalu",
    createdAt: Date.now() - 60 * 60 * 1000,
    read: false,
    type: "transaksi",
    actionUrl: "/top-up/history",
  },
  {
    id: "notif-03",
    title: "Catatan Refleksi Diterima",
    message: "Dr. Anita Wijaya telah memperbarui catatan latihan pernapasan harianmu.",
    time: "3 jam lalu",
    createdAt: Date.now() - 3 * 60 * 60 * 1000,
    read: true,
    type: "chat",
    actionUrl: "/room",
  },
  {
    id: "notif-04",
    title: "Akun Terverifikasi",
    message: "Data identitas pasien TB-88219 terlindungi kode etik kerahasiaan HIMPSI.",
    time: "Kemarin",
    createdAt: Date.now() - 24 * 60 * 60 * 1000,
    read: true,
    type: "sistem",
    actionUrl: "/settings",
  },
];

export interface NotificationState {
  notifications: NotificationItem[];
  addNotification: (params: {
    title: string;
    message: string;
    type: "jadwal" | "transaksi" | "chat" | "sistem";
    actionUrl?: string;
  }) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: initialNotifications,

      addNotification: ({ title, message, type, actionUrl }) => {
        const newItem: NotificationItem = {
          id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          title,
          message,
          time: "Baru saja",
          createdAt: Date.now(),
          read: false,
          type,
          actionUrl,
        };

        set({
          notifications: [newItem, ...get().notifications],
        });
      },

      markAsRead: (id: string) => {
        set({
          notifications: get().notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        });
      },

      markAllAsRead: () => {
        set({
          notifications: get().notifications.map((n) => ({ ...n, read: true })),
        });
      },

      deleteNotification: (id: string) => {
        set({
          notifications: get().notifications.filter((n) => n.id !== id),
        });
      },

      clearAll: () => {
        set({ notifications: [] });
      },
    }),
    {
      name: "tb_notification_store",
    }
  )
);
