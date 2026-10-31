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
      notifications: [],

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
