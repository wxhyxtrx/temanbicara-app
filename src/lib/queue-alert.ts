"use client";

/**
 * Modul utilitas pemberitahuan antrean relawan (PRD-044).
 * Menyediakan manajemen preferensi localStorage, Web Audio API chime lembut,
 * fallback visual toast, dan Web Notification API generik ber-tag.
 */

import { useState, useEffect } from "react";
import { notify } from "@/lib/toast";

export const QUEUE_NOTIFICATION_STORAGE_KEY = "tb_listener_notify_queue";

export const QUEUE_NOTIFICATION_CONTENT = {
  title: "Ada teman bicara baru di antrean",
  body: "Buka Ruang Dengar untuk mendampingi teman bicara.",
  tag: "tb-peer-queue",
} as const;

export const QUEUE_TAB_OPEN_NOTE =
  "Pemberitahuan suara dan notifikasi peramban hanya aktif saat tab atau halaman Ruang Dengar terbuka di peramban Anda. Aplikasi tidak mengirimkan push notification saat peramban ditutup.";

export type BrowserNotificationStatus = "granted" | "denied" | "default" | "unsupported";

/**
 * Membaca preferensi notifikasi antrean relawan dari localStorage.
 * Default: true. Dibungkus try/catch agar aman saat storage diblokir.
 */
export function getQueueNotificationPreference(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(QUEUE_NOTIFICATION_STORAGE_KEY);
    if (raw === null) return true;
    return raw === "true";
  } catch {
    return true;
  }
}

/**
 * Menyimpan preferensi notifikasi antrean relawan ke localStorage.
 * Mengembalikan true jika berhasil, false jika gagal/diblokir.
 */
export function setQueueNotificationPreference(enabled: boolean): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(QUEUE_NOTIFICATION_STORAGE_KEY, String(enabled));
    return true;
  } catch {
    return false;
  }
}

/**
 * Memeriksa status izin notifikasi peramban.
 */
export function getBrowserNotificationStatus(): BrowserNotificationStatus {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

/**
 * Meminta izin notifikasi peramban.
 * Hanya boleh dipanggil setelah aksi klik sadar dari pengguna.
 */
export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationStatus> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  try {
    const perm = await Notification.requestPermission();
    return perm;
  } catch {
    return getBrowserNotificationStatus();
  }
}

/**
 * Menampilkan notifikasi browser dengan pesan generik dan tag tb-peer-queue.
 * DILARANG menyertakan data sensitif/tiket curhat.
 */
export function showQueueBrowserNotification(): boolean {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }
  if (Notification.permission !== "granted") {
    return false;
  }
  try {
    new Notification(QUEUE_NOTIFICATION_CONTENT.title, {
      body: QUEUE_NOTIFICATION_CONTENT.body,
      tag: QUEUE_NOTIFICATION_CONTENT.tag,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Menampilkan fallback toast visual ke halaman saat audio terhalang
 * atau untuk konfirmasi antrean.
 */
export function showQueueAlertToast(): void {
  notify.info(QUEUE_NOTIFICATION_CONTENT.title, QUEUE_NOTIFICATION_CONTENT.body);
}

/**
 * Memainkan nada lembut Web Audio API singkat (dua nada ramah telinga).
 * Tangani AudioContext suspended / ditolak kebijakan autoplay tanpa unhandled rejection.
 * Mengembalikan true bila audio berhasil dimainkan, false jika terhalang.
 */
export async function playQueueChime(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioCtx) return false;

  let ctx: AudioContext | null = null;
  try {
    ctx = new AudioCtx();

    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        // Resume ditolak peramban
      }
    }

    if (ctx.state === "suspended") {
      try {
        await ctx.close();
      } catch {
        // no-op
      }
      return false;
    }

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    // Nada harmonis lembut (D5: 587.33Hz -> A5: 880Hz)
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now);

    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.12);

    // Envelope gain bertingkat yang tidak mengagetkan
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(0.12, now + 0.03);
    gainNode.gain.exponentialRampToValueAtTime(0.04, now + 0.12);
    gainNode.gain.exponentialRampToValueAtTime(0.12, now + 0.15);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.12);

    osc2.start(now + 0.12);
    osc2.stop(now + 0.5);

    setTimeout(() => {
      try {
        ctx?.close().catch(() => {});
      } catch {
        // no-op
      }
    }, 600);

    return true;
  } catch {
    if (ctx) {
      try {
        ctx.close().catch(() => {});
      } catch {
        // no-op
      }
    }
    return false;
  }
}

export interface QueueAlertTriggerResult {
  audioPlayed: boolean;
  notificationShown: boolean;
  toastShown: boolean;
}

/**
 * Pemicu lengkap notifikasi antrean: audio + notifikasi browser + fallback visual toast.
 * Dapat dipanggil oleh halaman antrean (T-187).
 */
export async function triggerQueueAlert(options?: {
  alwaysShowToast?: boolean;
}): Promise<QueueAlertTriggerResult> {
  const pref = getQueueNotificationPreference();
  if (!pref) {
    return { audioPlayed: false, notificationShown: false, toastShown: false };
  }

  let audioPlayed = false;
  try {
    audioPlayed = await playQueueChime();
  } catch {
    audioPlayed = false;
  }

  const notificationShown = showQueueBrowserNotification();

  let toastShown = false;
  if (!audioPlayed || options?.alwaysShowToast) {
    showQueueAlertToast();
    toastShown = true;
  }

  return { audioPlayed, notificationShown, toastShown };
}

/**
 * Hook pengelola status & interaksi preferensi notifikasi antrean untuk halaman pengaturan.
 */
export function useQueueNotificationSettings() {
  const [notifyQueue, setNotifyQueue] = useState(true);
  const [notifStatus, setNotifStatus] = useState<BrowserNotificationStatus>("default");
  const [isRequestingPerm, setIsRequestingPerm] = useState(false);
  const [isPlayingChime, setIsPlayingChime] = useState(false);

  useEffect(() => {
    setNotifyQueue(getQueueNotificationPreference());
    setNotifStatus(getBrowserNotificationStatus());
  }, []);

  const handleToggle = (checked: boolean) => {
    setNotifyQueue(checked);
    const ok = setQueueNotificationPreference(checked);
    if (!ok) {
      notify.warning("Penyimpanan Gagal", "Gagal menyimpan preferensi notifikasi ke peramban.");
    }
  };

  const handleRequestPerm = async () => {
    setIsRequestingPerm(true);
    try {
      const res = await requestBrowserNotificationPermission();
      setNotifStatus(res);
      if (res === "granted") {
        notify.success("Notifikasi Diizinkan", "Pemberitahuan tiket baru berhasil diaktifkan.");
      } else if (res === "denied") {
        notify.warning("Notifikasi Ditolak", "Peramban memblokir notifikasi.");
      }
    } finally {
      setIsRequestingPerm(false);
    }
  };

  const handleTestChime = async () => {
    setIsPlayingChime(true);
    try {
      const ok = await playQueueChime();
      if (!ok) {
        showQueueAlertToast();
        notify.warning("Audio Terhalang", "Peramban membatasi pemutaran otomatis. Fallback toast visual ditampilkan.");
      }
    } catch {
      showQueueAlertToast();
    } finally {
      setIsPlayingChime(false);
    }
  };

  return {
    notifyQueue,
    notifStatus,
    isRequestingPerm,
    isPlayingChime,
    handleToggle,
    handleRequestPerm,
    handleTestChime,
  };
}
