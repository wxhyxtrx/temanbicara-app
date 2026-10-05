"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Calendar,
  Coins,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Inbox,
} from "lucide-react";
import {
  useNotificationStore,
  NotificationItem,
} from "@/store/notification-store";

export function NotificationDropdown() {
  const router = useRouter();
  const rawNotifications = useNotificationStore((state) => state.notifications);
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);
  const deleteNotification = useNotificationStore((state) => state.deleteNotification);
  const clearAll = useNotificationStore((state) => state.clearAll);

  const [mounted, setMounted] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [filterMode, setFilterMode] = useState<"all" | "unread">("all");

  useEffect(() => {
    setMounted(true);
  }, []);

  const notifications = mounted ? rawNotifications : [];
  const unreadCount = notifications.filter((n) => !n.read).length;

  const displayList = filterMode === "unread"
    ? notifications.filter((n) => !n.read)
    : notifications;

  const handleItemClick = (item: NotificationItem) => {
    if (!item.read) {
      markAsRead(item.id);
    }
    setIsOpen(false);
    if (item.actionUrl) {
      router.push(item.actionUrl);
    }
  };

  const getCategoryIcon = (type: NotificationItem["type"]) => {
    switch (type) {
      case "jadwal":
        return <Calendar size={15} className="text-teal-700 dark:text-teal-300" />;
      case "transaksi":
        return <Coins size={15} className="text-emerald-700 dark:text-emerald-300" />;
      case "chat":
        return <MessageCircle size={15} className="text-sky-700 dark:text-sky-300" />;
      default:
        return <ShieldCheck size={15} className="text-amber-700 dark:text-amber-300" />;
    }
  };

  const getCategoryBg = (type: NotificationItem["type"]) => {
    switch (type) {
      case "jadwal":
        return "bg-teal-50 dark:bg-teal-950/70 border-teal-200 dark:border-teal-800";
      case "transaksi":
        return "bg-emerald-50 dark:bg-emerald-950/70 border-emerald-200 dark:border-emerald-800";
      case "chat":
        return "bg-sky-50 dark:bg-sky-950/70 border-sky-200 dark:border-sky-800";
      default:
        return "bg-amber-50 dark:bg-amber-950/70 border-amber-200 dark:border-amber-800";
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative h-9 w-9 rounded-xl border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white cursor-pointer transition-colors shadow-2xs"
          aria-label="Pemberitahuan Notifikasi"
        >
          <Bell size={17} />
          {mounted && unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-teal-600 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-900 font-mono animate-in zoom-in-75">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[360px] sm:w-[400px] p-0 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden font-nunito text-slate-900 dark:text-slate-100"
      >
        {/* 1. Header Popover */}
        <div className="p-4 bg-slate-50/80 dark:bg-slate-900/90 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-heading font-bold text-sm text-slate-900 dark:text-white">
              Notifikasi Pasien
            </h3>
            {mounted && unreadCount > 0 && (
              <Badge className="bg-teal-50 dark:bg-teal-950/70 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800 text-[10px] py-0 px-1.5 h-4 font-semibold">
                {unreadCount} Baru
              </Badge>
            )}
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              className="text-[11px] font-semibold text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <CheckCheck size={13} />
              <span>Tandai Semua Dibaca</span>
            </button>
          )}
        </div>

        {/* 2. Filter Tabs */}
        <div className="flex items-center gap-1.5 px-4 pt-2.5 pb-1 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setFilterMode("all")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filterMode === "all"
                ? "bg-teal-600 text-white shadow-2xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            Semua ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("unread")}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filterMode === "unread"
                ? "bg-teal-600 text-white shadow-2xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            Belum Dibaca ({unreadCount})
          </button>
        </div>

        {/* 3. Notification Items List */}
        <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {displayList.length > 0 ? (
            displayList.map((item) => (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={`p-3.5 flex items-start gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors cursor-pointer group relative ${
                  !item.read ? "bg-teal-50/20 dark:bg-teal-950/20" : "bg-white dark:bg-slate-900"
                }`}
              >
                {/* Category Icon */}
                <div
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 shadow-2xs ${getCategoryBg(
                    item.type
                  )}`}
                >
                  {getCategoryIcon(item.type)}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-xs font-heading truncate ${!item.read ? "font-bold text-slate-900 dark:text-white" : "font-semibold text-slate-700 dark:text-slate-300"}`}>
                      {item.title}
                    </p>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 font-nunito">
                      {item.time}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">
                    {item.message}
                  </p>
                </div>

                {/* Unread Dot & Delete on hover */}
                <div className="flex flex-col items-center justify-between self-stretch shrink-0">
                  {!item.read && (
                    <span className="w-2 h-2 rounded-full bg-teal-600 shrink-0" />
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(item.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-opacity rounded cursor-pointer mt-auto"
                    title="Hapus notifikasi"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="py-12 text-center space-y-2 px-4">
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto">
                <Inbox size={20} />
              </div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Tidak ada notifikasi {filterMode === "unread" ? "baru" : ""}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Aktivitas sesi konsultasi dan mutasi koinmu akan muncul di sini.
              </p>
            </div>
          )}
        </div>

        {/* 4. Footer */}
        {notifications.length > 0 && (
          <div className="p-2.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={clearAll}
              className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer px-2 py-1"
            >
              Hapus Semua
            </button>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                router.push("/top-up/history");
              }}
              className="text-[11px] font-semibold text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 flex items-center gap-1 cursor-pointer px-2 py-1"
            >
              <span>Riwayat Lengkap</span>
              <ArrowRight size={12} />
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
