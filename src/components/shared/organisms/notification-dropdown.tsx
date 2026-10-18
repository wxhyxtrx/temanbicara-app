"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  CheckCheck,
  Calendar,
  Coins,
  MessageCircle,
  ShieldCheck,
  ShieldAlert,
  Inbox,
  Loader2,
} from "lucide-react";
import type { NotificationEntity } from "@/types/notification";

function formatRelativeTime(dateStr: string): string {
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    if (isNaN(diffMs) || diffMs < 0) return "Baru saja";
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return "Baru saja";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} menit lalu`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours} jam lalu`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Kemarin";
    if (diffDays < 7) return `${diffDays} hari lalu`;
    return new Date(dateStr).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return dateStr;
  }
}

function getCategoryIcon(type: string) {
  switch (type) {
    case "booking_new":
    case "session_reminder_60":
    case "session_reminder_10":
    case "session_started":
    case "completed":
    case "reschedule":
    case "jadwal":
      return <Calendar size={15} className="text-teal-700 dark:text-teal-300" />;
    case "tip_received":
    case "transaksi":
      return <Coins size={15} className="text-emerald-700 dark:text-emerald-300" />;
    case "extension_requested":
    case "extension_approved":
    case "extension_declined":
    case "chat":
      return <MessageCircle size={15} className="text-sky-700 dark:text-sky-300" />;
    case "booking_cancelled":
    case "psikolog_cancelled_choice":
    case "auto_cancelled_late":
    case "no_show":
    case "strike_added":
    case "suspended":
      return <ShieldAlert size={15} className="text-rose-700 dark:text-rose-300" />;
    default:
      return <ShieldCheck size={15} className="text-amber-700 dark:text-amber-300" />;
  }
}

function getCategoryBg(type: string) {
  switch (type) {
    case "booking_new":
    case "session_reminder_60":
    case "session_reminder_10":
    case "session_started":
    case "completed":
    case "reschedule":
    case "jadwal":
      return "bg-teal-50 dark:bg-teal-950/70 border-teal-200 dark:border-teal-800";
    case "tip_received":
    case "transaksi":
      return "bg-emerald-50 dark:bg-emerald-950/70 border-emerald-200 dark:border-emerald-800";
    case "extension_requested":
    case "extension_approved":
    case "extension_declined":
    case "chat":
      return "bg-sky-50 dark:bg-sky-950/70 border-sky-200 dark:border-sky-800";
    case "booking_cancelled":
    case "psikolog_cancelled_choice":
    case "auto_cancelled_late":
    case "no_show":
    case "strike_added":
    case "suspended":
      return "bg-rose-50 dark:bg-rose-950/70 border-rose-200 dark:border-rose-900";
    default:
      return "bg-amber-50 dark:bg-amber-950/70 border-amber-200 dark:border-amber-800";
  }
}

export function NotificationDropdown() {
  const router = useRouter();

  const [notifications, setNotifications] = useState<NotificationEntity[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [mounted, setMounted] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [filterMode, setFilterMode] = useState<"all" | "unread">("all");

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=30");
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setNotifications(json.data);
        setUnreadCount(typeof json.unread_count === "number" ? json.unread_count : 0);
      }
    } catch (err) {
      console.error("Gagal memuat notifikasi:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    fetchNotifications();
  }, [fetchNotifications]);

  const displayList =
    filterMode === "unread"
      ? notifications.filter((n) => !n.read_at)
      : notifications;

  const handleItemClick = async (item: NotificationEntity) => {
    if (!item.read_at) {
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n
        )
      );
      setUnreadCount((c) => Math.max(0, c - 1));

      try {
        await fetch("/api/notifications/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: [item.id] }),
        });
      } catch (err) {
        console.error("Gagal menandai notifikasi dibaca:", err);
      }
    }

    setIsOpen(false);
    if (item.link) {
      router.push(item.link);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) return;

    const now = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((n) => (n.read_at ? n : { ...n, read_at: now }))
    );
    setUnreadCount(0);

    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
    } catch (err) {
      console.error("Gagal menandai semua notifikasi dibaca:", err);
      fetchNotifications();
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
              {unreadCount > 99 ? "99+" : unreadCount}
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
              Notifikasi
            </h3>
            {mounted && unreadCount > 0 && (
              <Badge className="bg-teal-50 dark:bg-teal-950/70 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800 text-[10px] py-0 px-1.5 h-4 font-semibold">
                {unreadCount} Baru
              </Badge>
            )}
          </div>

          {mounted && unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllAsRead}
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
          {loading && notifications.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-500">
              <Loader2 size={20} className="animate-spin text-teal-600" />
              <p className="text-xs">Memuat notifikasi...</p>
            </div>
          ) : displayList.length > 0 ? (
            displayList.map((item) => {
              const isUnread = !item.read_at;
              return (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`p-3.5 flex items-start gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition-colors cursor-pointer group relative ${
                    isUnread
                      ? "bg-teal-50/20 dark:bg-teal-950/20"
                      : "bg-white dark:bg-slate-900"
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
                      <p
                        className={`text-xs font-heading truncate ${
                          isUnread
                            ? "font-bold text-slate-900 dark:text-white"
                            : "font-semibold text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {item.title}
                      </p>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 font-nunito">
                        {formatRelativeTime(item.created_at)}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">
                      {item.body}
                    </p>
                  </div>

                  {/* Unread Dot */}
                  {isUnread && (
                    <div className="flex flex-col items-center justify-center self-center shrink-0">
                      <span className="w-2 h-2 rounded-full bg-teal-600 shrink-0" />
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center space-y-2 px-4">
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto">
                <Inbox size={20} />
              </div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Tidak ada notifikasi {filterMode === "unread" ? "baru" : ""}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Aktivitas sesi konseling dan jadwalmu akan muncul di sini.
              </p>
            </div>
          )}
        </div>

        {/* 4. Footer */}
        {mounted && unreadCount > 0 && (
          <div className="p-2.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end text-xs">
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              className="text-[11px] font-semibold text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 flex items-center gap-1 cursor-pointer px-2 py-1"
            >
              <CheckCheck size={12} />
              <span>Tandai semua dibaca</span>
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
