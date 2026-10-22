"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Clock,
  Headphones,
  Heart,
  Loader2,
  Radio,
  Shield,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabasePublic } from "@/lib/supabase/client";
import { notify } from "@/lib/toast";
import { formatWibTime } from "@/lib/booking-utils";
import { peerTicketClient, PeerTicketApiError } from "@/services/peer-tickets.client";
import { peerMessagesClient, PeerMessageApiError } from "@/services/peer-messages.client";
import { usePublicSettings } from "@/hooks/use-public-settings";
import { useUserStore } from "@/store/user-store";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { SessionChatInput } from "@/components/views/session/session-chat-input";
import { SessionAudioPlayer } from "@/components/views/session/session-audio-player";
import { SessionImagePreview } from "@/components/views/session/session-image-preview";
import type { PeerTicketDetailView } from "@/types/peer-tickets";
import type { PeerMessageView, PeerMessageEntity } from "@/types/peer-messages";

function getAccessTokenFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)tb_access_token=([^;]+)/);
  if (!match) return null;
  const raw = decodeURIComponent(match[1]).trim().replace(/^"|"$/g, "");
  return raw && raw !== "undefined" && raw !== "null" ? raw : null;
}

function getGreetingTimer(claimedAt: string | null, now: number) {
  if (!claimedAt) return { text: "10:00", isExpired: false };
  const diffSec = Math.max(0, Math.floor((new Date(claimedAt).getTime() + 600000 - now) / 1000));
  return { text: `${Math.floor(diffSec / 60)}:${String(diffSec % 60).padStart(2, "0")}`, isExpired: diffSec <= 0 };
}

function getActiveSessionTimer(startTime: string | null, now: number) {
  if (!startTime) return { text: "24:00:00", isExpired: false };
  const diffSec = Math.max(0, Math.floor((new Date(startTime).getTime() + 86400000 - now) / 1000));
  const h = Math.floor(diffSec / 3600);
  const m = Math.floor((diffSec % 3600) / 60);
  const s = diffSec % 60;
  return { text: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`, isExpired: diffSec <= 0 };
}

function PeerRoomStateScreen({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  desc,
  action,
}: {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  title: string;
  desc: string;
  action: React.ReactNode;
}) {
  return (
    <div className="min-h-[480px] h-[calc(100dvh-5.5rem)] flex flex-col items-center justify-center p-6 text-center space-y-4 font-nunito max-w-md mx-auto">
      <div className={`w-16 h-16 rounded-2xl ${iconBg} border flex items-center justify-center shadow-xs ${iconColor}`}>
        <Icon size={32} />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{desc}</p>
      </div>
      {action}
    </div>
  );
}

interface PeerRoomViewProps {
  ticketId: string;
  role: "pasien" | "relawan";
}

export function PeerRoomView({ ticketId, role }: PeerRoomViewProps) {
  const { user: currentUser } = useUserStore();
  const userRef = useRef(currentUser);
  userRef.current = currentUser;

  const { settings } = usePublicSettings();
  const chatMediaMaxMb = settings.upload.chat_media_max_mb || 10;
  const voiceMaxSeconds = settings.upload.voice_note_max_seconds || 180;

  const [ticket, setTicket] = useState<PeerTicketDetailView | null>(null);
  const [loadingTicket, setLoadingTicket] = useState(true);
  const [errorCode, setErrorCode] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [messages, setMessages] = useState<PeerMessageView[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [isChannelSubscribed, setIsChannelSubscribed] = useState(false);

  const [inputMessage, setInputMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isTopicExpanded, setIsTopicExpanded] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const ticketRef = useRef(ticket);
  ticketRef.current = ticket;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const initialMessagesLoadedRef = useRef(false);

  // Bersihkan object URL untuk cegah memory leak
  const pendingUrlsRef = useRef<Set<string>>(new Set());
  const createTrackedObjectURL = useCallback((blob: Blob) => {
    const url = URL.createObjectURL(blob);
    pendingUrlsRef.current.add(url);
    return url;
  }, []);
  const revokeTrackedObjectURL = useCallback((url: string) => {
    try {
      URL.revokeObjectURL(url);
    } catch {}
    pendingUrlsRef.current.delete(url);
  }, []);

  useEffect(() => {
    return () => {
      pendingUrlsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      });
      pendingUrlsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  }, []);

  const fetchTicket = useCallback(async () => {
    try {
      const res = await peerTicketClient.getTicket(ticketId);
      if (res.success && res.data) setTicket(res.data);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 403 || (err instanceof PeerTicketApiError && err.status === 403)) {
        setErrorCode(403);
      } else if (status === 503 || (err instanceof PeerTicketApiError && err.status === 503)) {
        setErrorCode(503);
      } else if (!ticketRef.current) {
        setLoadError(err instanceof Error ? err.message : "Gagal memuat detail tiket curhat");
      }
    } finally {
      setLoadingTicket(false);
    }
  }, [ticketId]);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await peerMessagesClient.getMessages(ticketId);
      if (res.success && Array.isArray(res.data)) {
        const prevMessages = messagesRef.current;
        const existingIds = new Set(prevMessages.map((m) => m.id));
        const hasNew = res.data.some((m) => !existingIds.has(m.id));

        setMessages((prev) => {
          const map = new Map(prev.map((m) => [m.id, m]));
          for (const m of res.data) map.set(m.id, m);
          if (map.size === prev.length && !hasNew) return prev;
          return Array.from(map.values()).sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        });

        if (hasNew && initialMessagesLoadedRef.current) {
          setTimeout(() => scrollToBottom(true), 80);
        }
      }
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 403 || (err instanceof PeerMessageApiError && err.status === 403)) {
        setErrorCode(403);
      } else if (status === 503 || (err instanceof PeerMessageApiError && err.status === 503)) {
        setErrorCode(503);
      }
    } finally {
      setLoadingMessages(false);
      initialMessagesLoadedRef.current = true;
    }
  }, [ticketId, scrollToBottom]);

  useEffect(() => {
    fetchTicket();
    fetchMessages();
  }, [fetchTicket, fetchMessages]);

  useEffect(() => {
    if (!loadingMessages) scrollToBottom(false);
  }, [loadingMessages, scrollToBottom]);

  const isTerminalStatus = ticket?.status === "closed" || ticket?.status === "archived";
  const greetingTimer = getGreetingTimer(ticket?.claimed_at ?? null, now);
  const activeTimer = getActiveSessionTimer(ticket?.first_response_at ?? ticket?.claimed_at ?? null, now);
  const isGreetingExpired = ticket?.status === "claimed" && greetingTimer.isExpired;
  const isActiveExpired = ticket?.status === "active" && activeTimer.isExpired;
  const isWaitingFirstGreeting = ticket?.status === "claimed" && role === "pasien";
  const isRelawanGreetingExpired = ticket?.status === "claimed" && role === "relawan" && isGreetingExpired;
  const isReadOnly =
    isTerminalStatus ||
    ticket?.status === "open" ||
    isActiveExpired ||
    isRelawanGreetingExpired ||
    isWaitingFirstGreeting;

  // Realtime subscriber dengan setAuth token
  useEffect(() => {
    if (!ticketId || !supabasePublic) return;
    let isMounted = true;
    let channel: ReturnType<typeof supabasePublic.channel> | null = null;

    const setupRealtime = async () => {
      const token = getAccessTokenFromCookie();
      if (token) {
        try {
          await supabasePublic.realtime.setAuth(token);
        } catch (err) {
          console.error("Gagal setAuth realtime:", err);
        }
      }
      if (!isMounted) return;

      const ch = supabasePublic
        .channel(`peer_room_${ticketId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "peer_messages", filter: `ticket_id=eq.${ticketId}` },
          (payload) => {
            const newRow = payload.new as PeerMessageEntity;
            setMessages((prev) => {
              if (prev.some((m) => m.id === newRow.id)) return prev;
              const currentTicket = ticketRef.current;
              const isMine = newRow.sender_id === userRef.current?.id;
              const isRelawan = newRow.sender_id === currentTicket?.claimed_by;
              const newMsgView: PeerMessageView = {
                id: newRow.id,
                ticket_id: newRow.ticket_id,
                sender_id: newRow.sender_id,
                sender_role: isRelawan ? "relawan" : "pasien",
                sender_name: isRelawan
                  ? currentTicket?.relawan_alias || "Pendengar Sebaya"
                  : currentTicket?.patient_alias || "Teman Curhat",
                is_mine: isMine,
                kind: newRow.kind,
                body: newRow.body,
                media_path: newRow.media_path,
                duration_seconds: newRow.duration_seconds,
                created_at: newRow.created_at,
              };
              return [...prev, newMsgView];
            });
            setTimeout(() => scrollToBottom(true), 100);
            fetchTicket();
          }
        )
        .subscribe((status) => {
          if (!isMounted) return;
          setIsChannelSubscribed(status === "SUBSCRIBED");
        });

      channel = ch;
    };

    setupRealtime();
    return () => {
      isMounted = false;
      if (channel) supabasePublic.removeChannel(channel);
    };
  }, [ticketId, fetchTicket, scrollToBottom]);

  // Polling cadangan pesan tiap 5 detik jika Realtime tidak SUBSCRIBED
  useEffect(() => {
    if (isChannelSubscribed || isTerminalStatus || !ticketId || errorCode) return;
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [isChannelSubscribed, isTerminalStatus, ticketId, errorCode, fetchMessages]);

  // Polling tiket tiap 15 detik selama aktif/claimed
  useEffect(() => {
    if (isTerminalStatus || !ticketId || errorCode) return;
    const interval = setInterval(fetchTicket, 15000);
    return () => clearInterval(interval);
  }, [isTerminalStatus, ticketId, errorCode, fetchTicket]);

  const handleSendText = async () => {
    const text = inputMessage.trim();
    if (!text || isSending || isReadOnly) return;
    try {
      setIsSending(true);
      setInputMessage("");
      const res = await peerMessagesClient.sendMessage(ticketId, { kind: "text", body: text });
      if (res.success && res.data) {
        setMessages((prev) => (prev.some((m) => m.id === res.data.id) ? prev : [...prev, res.data]));
        setTimeout(() => scrollToBottom(true), 80);
        fetchTicket();
      }
    } catch (err: unknown) {
      notify.error("Gagal Mengirim Pesan", err instanceof Error ? err.message : "Terjadi kesalahan.");
      setInputMessage(text);
    } finally {
      setIsSending(false);
    }
  };

  const sendMedia = async (kind: "image" | "voice", file: Blob | File, duration?: number) => {
    const objectUrl = createTrackedObjectURL(file);
    try {
      if (kind === "image") setUploadingImage(true);
      else setIsSending(true);

      const ext = file.type.includes("mp4") ? "mp4" : file.type.includes("ogg") ? "ogg" : file.type.includes("png") ? "png" : file.type.includes("webp") ? "webp" : kind === "image" ? "jpg" : "webm";
      const fileName = `peer-${kind}-${Date.now()}.${ext}`;

      const presigned = await peerMessagesClient.getUploadUrl(ticketId, {
        file_name: fileName,
        file_type: file.type || (kind === "image" ? "image/jpeg" : "audio/webm"),
        kind,
        duration_seconds: duration,
        file_size: file.size,
      });

      await peerMessagesClient.uploadMediaBinary(presigned.data.upload_url, file);

      const res = await peerMessagesClient.sendMessage(ticketId, {
        kind,
        media_path: presigned.data.file_path,
        duration_seconds: duration,
        body: null,
      });

      if (res.success && res.data) {
        setMessages((prev) => (prev.some((m) => m.id === res.data.id) ? prev : [...prev, res.data]));
        setTimeout(() => scrollToBottom(true), 80);
        fetchTicket();
      }
      notify.success(kind === "image" ? "Gambar Terkirim" : "Pesan Suara Terkirim");
    } catch (err: unknown) {
      notify.error(
        kind === "image" ? "Gagal Mengunggah Gambar" : "Gagal Mengirim Pesan Suara",
        err instanceof Error ? err.message : "Terjadi kesalahan sistem."
      );
    } finally {
      revokeTrackedObjectURL(objectUrl);
      if (kind === "image") setUploadingImage(false);
      else setIsSending(false);
    }
  };

  const handleSelectImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isReadOnly) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      notify.error("Format Berkas Tidak Didukung", "Hanya format JPG, PNG, atau WebP yang diizinkan.");
      e.target.value = "";
      return;
    }
    if (file.size > chatMediaMaxMb * 1024 * 1024) {
      notify.error("Ukuran Berkas Terlalu Besar", `Ukuran maksimal gambar adalah ${chatMediaMaxMb} MB.`);
      e.target.value = "";
      return;
    }
    try {
      await sendMedia("image", file);
    } finally {
      e.target.value = "";
    }
  };

  const { isRecording, recordSeconds, startRecording, cancelRecording, stopRecording } = useVoiceRecorder({
    maxSeconds: voiceMaxSeconds,
    onRecorded: async (audioBlob, duration) => {
      await sendMedia("voice", audioBlob, duration);
    },
  });

  const handleGetMediaViewUrl = useCallback(
    (mediaPath: string) => peerMessagesClient.getViewUrl(ticketId, mediaPath),
    [ticketId]
  );

  const homeHref = role === "relawan" ? "/listener/beranda" : "/patient/beranda";

  if (errorCode === 403) {
    return (
      <PeerRoomStateScreen
        icon={ShieldAlert}
        iconColor="text-amber-600"
        iconBg="bg-amber-50 dark:bg-amber-950/80 border-amber-200 dark:border-amber-800"
        title="Akses Ruang Dengar Ditolak"
        desc="Kamu bukan peserta dari tiket curhat ini atau tidak memiliki izin untuk mengakses ruang percakapan ini."
        action={
          <Link href={homeHref}>
            <Button variant="default" size="sm" className="text-xs rounded-xl bg-teal-600 hover:bg-teal-700 text-white cursor-pointer px-4">
              Kembali ke Beranda
            </Button>
          </Link>
        }
      />
    );
  }

  if (errorCode === 503) {
    return (
      <PeerRoomStateScreen
        icon={AlertCircle}
        iconColor="text-sky-600"
        iconBg="bg-sky-50 dark:bg-sky-950/80 border-sky-200 dark:border-sky-800"
        title="Pemeliharaan Sistem"
        desc="Layanan Ruang Dengar sedang dalam pemeliharaan berkala untuk meningkatkan kenyamanan Anda. Silakan coba kembali beberapa saat lagi."
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setErrorCode(null); fetchTicket(); fetchMessages(); }} className="text-xs rounded-xl cursor-pointer">
              Coba Lagi
            </Button>
            <Link href={homeHref}>
              <Button variant="default" size="sm" className="text-xs rounded-xl bg-teal-600 hover:bg-teal-700 text-white cursor-pointer">
                Kembali ke Beranda
              </Button>
            </Link>
          </div>
        }
      />
    );
  }

  if (loadingTicket) {
    return (
      <div className="min-h-[480px] h-[calc(100dvh-5.5rem)] flex flex-col items-center justify-center p-8 text-center space-y-3 font-nunito">
        <Loader2 size={32} className="animate-spin text-teal-600" />
        <p className="text-sm text-slate-600 dark:text-slate-300">Menyiapkan Ruang Dengar...</p>
      </div>
    );
  }

  if (loadError || !ticket) {
    return (
      <PeerRoomStateScreen
        icon={AlertCircle}
        iconColor="text-rose-600"
        iconBg="bg-rose-50 dark:bg-rose-950/80 border-rose-200 dark:border-rose-800"
        title="Ruang Dengar Tidak Ditemukan"
        desc={loadError || "Data tiket curhat tidak dapat dimuat atau sudah tidak aktif."}
        action={
          <Link href={homeHref}>
            <Button variant="outline" size="sm" className="text-xs rounded-xl cursor-pointer">
              Kembali ke Beranda
            </Button>
          </Link>
        }
      />
    );
  }

  const partnerName = role === "relawan" ? ticket.patient_alias || "Teman Curhat" : ticket.relawan_alias || "Pendengar Sebaya";
  const partnerRole = role === "relawan" ? "Teman Curhat" : "Pendengar Sebaya";

  return (
    <div className="h-[calc(100dvh-5.5rem)] sm:h-[calc(100dvh-6.5rem)] min-h-[480px] max-w-4xl mx-auto flex flex-col font-nunito bg-slate-50/50 dark:bg-slate-950/40 rounded-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs min-w-0">
      {/* Header Ruang Dengar */}
      <div className="shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200/90 dark:border-slate-800 px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <Link href={homeHref} className="w-8 h-8 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 cursor-pointer" aria-label="Kembali ke Beranda">
            <ArrowLeft size={16} />
          </Link>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${role === "relawan" ? "bg-teal-50 dark:bg-teal-950/60 border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400" : "bg-sky-50 dark:bg-sky-950/60 border-sky-200 dark:border-sky-800 text-sky-600 dark:text-sky-400"}`}>
            {role === "relawan" ? <Heart size={18} /> : <Headphones size={18} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">{partnerName}</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{partnerRole}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 truncate">
              <span className="font-semibold text-teal-700 dark:text-teal-300 truncate">{ticket.topic}</span>
              <span>•</span>
              <span className="truncate">{ticket.emotion}</span>
            </div>
          </div>
        </div>

        {/* Timer & Status Badges */}
        <div className="shrink-0 flex items-center gap-1.5 sm:gap-2">
          {ticket.status === "claimed" && (
            <div className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-[11px] font-bold border ${isGreetingExpired ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800" : "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800"}`}>
              <Clock size={12} className={isGreetingExpired ? "text-rose-600" : "animate-pulse"} />
              <span>Sapaan: {greetingTimer.text}</span>
            </div>
          )}
          {ticket.status === "active" && (
            <div className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-[11px] font-bold border ${isActiveExpired ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800" : "bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950 dark:text-teal-200 dark:border-teal-800"}`}>
              <Clock size={12} />
              <span>Sesi: {activeTimer.text}</span>
            </div>
          )}
          {isTerminalStatus && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
              <span>Selesai</span>
            </div>
          )}
          <div className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${isChannelSubscribed ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800" : "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"}`} title={isChannelSubscribed ? "Realtime aktif" : "Polling cadangan aktif tiap 5 detik"}>
            <Radio size={10} className={isChannelSubscribed ? "animate-pulse" : ""} />
            <span>{isChannelSubscribed ? "Langsung" : "Polling"}</span>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => setIsTopicExpanded((prev) => !prev)} className="h-8 px-2 text-xs rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" title="Lihat konteks curhat">
            <span className="hidden md:inline mr-1 text-[11px]">Konteks</span>
            {isTopicExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </Button>
        </div>
      </div>

      {/* Banner Konteks Cerita Awal Pasien */}
      {isTopicExpanded && (
        <div className="shrink-0 bg-teal-50/70 dark:bg-teal-950/40 border-b border-teal-200/80 dark:border-teal-900/60 px-4 py-3 text-xs space-y-1.5 animate-in fade-in duration-200 min-w-0">
          <div className="flex items-center justify-between font-bold text-teal-900 dark:text-teal-200">
            <span>Cerita Awal Curhat</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200">{ticket.is_anonymous ? "Anonim" : "Terbuka"}</span>
          </div>
          <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed whitespace-pre-wrap break-words">{ticket.content}</p>
        </div>
      )}

      {/* Banner Status Dinamis */}
      {ticket.status === "claimed" && role === "relawan" && !isGreetingExpired && (
        <div className="shrink-0 bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-800 px-3 sm:px-4 py-2 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-2 min-w-0">
          <span className="truncate">Kirim sapaan pertama untuk mengaktifkan sesi 24 jam (Sisa waktu: {greetingTimer.text})</span>
        </div>
      )}
      {isRelawanGreetingExpired && (
        <div className="shrink-0 bg-rose-50 dark:bg-rose-950/60 border-b border-rose-200 dark:border-rose-800 px-3 sm:px-4 py-2 text-xs text-rose-800 dark:text-rose-200 min-w-0">
          Batas waktu respon pertama (10 menit) telah terlewati. Ruang obrolan telah dikunci.
        </div>
      )}
      {isActiveExpired && (
        <div className="shrink-0 bg-rose-50 dark:bg-rose-950/60 border-b border-rose-200 dark:border-rose-800 px-3 sm:px-4 py-2 text-xs text-rose-800 dark:text-rose-200 min-w-0">
          Waktu sesi pendampingan 24 jam telah berakhir. Ruang obrolan kini berada dalam mode hanya-baca.
        </div>
      )}

      {/* Area Daftar Pesan */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 min-w-0 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-center my-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/80 text-[10px] text-slate-500 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700/80">
            <Shield size={11} className="text-teal-600 dark:text-teal-400" />
            <span>Privat & Aman — hanya bisa diakses oleh peserta tiket</span>
          </div>
        </div>

        {loadingMessages ? (
          <div className="flex items-center justify-center py-10 text-xs text-slate-400 gap-2">
            <Loader2 size={16} className="animate-spin text-teal-600" />
            <span>Memuat pesan obrolan...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="py-12 text-center space-y-2 max-w-sm mx-auto px-4">
            <div className="w-12 h-12 rounded-full bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto">
              {role === "relawan" ? <Heart size={22} /> : <Headphones size={22} />}
            </div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">Ruang Dengar Siap</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-nunito">
              {role === "relawan"
                ? `Sambut ${ticket.patient_alias} dengan ramah untuk memulai sesi pendampingan.`
                : "Menunggu sapaan pertama dari pendengar sebaya. Kamu bisa mencurahkan isi hatimu dengan nyaman di sini."}
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.is_mine;
            return (
              <div key={msg.id} className={`flex flex-col min-w-0 ${isMine ? "items-end" : "items-start"}`}>
                <div className="flex items-baseline gap-1.5 mb-1 px-1">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{isMine ? "Anda" : msg.sender_name}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{formatWibTime(msg.created_at)}</span>
                </div>
                <div className={`rounded-2xl px-3.5 py-2 text-xs leading-relaxed max-w-[88%] sm:max-w-[75%] break-words shadow-2xs min-w-0 ${isMine ? "bg-teal-600 text-white rounded-br-xs" : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-xs border border-slate-200/80 dark:border-slate-700/80"}`}>
                  {msg.kind === "text" && <p className="whitespace-pre-wrap break-words">{msg.body}</p>}
                  {msg.kind === "image" && msg.media_path && (
                    <SessionImagePreview mediaPath={msg.media_path} caption={msg.body} isMine={isMine} getViewUrl={handleGetMediaViewUrl} />
                  )}
                  {msg.kind === "voice" && msg.media_path && (
                    <SessionAudioPlayer mediaPath={msg.media_path} durationSeconds={msg.duration_seconds} isMine={isMine} getViewUrl={handleGetMediaViewUrl} />
                  )}
                </div>
              </div>
            );
          })
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Chat Obrolan / Informasi Tunggu Sapaan */}
      {isWaitingFirstGreeting ? (
        <div className="shrink-0 border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 font-nunito min-w-0">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-xl text-center space-y-1">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">Menunggu Sapaan Pertama Relawan</p>
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-nunito">
              Pendengar sebaya sedang bersiap menyapamu (Sisa waktu: {greetingTimer.text}). Kotak pesan akan terbuka setelah sapaan pertama diterima.
            </p>
          </div>
        </div>
      ) : (
        <SessionChatInput
          isReadOnly={isReadOnly}
          inputMessage={inputMessage}
          setInputMessage={setInputMessage}
          isSending={isSending}
          uploadingImage={uploadingImage}
          isRecording={isRecording}
          recordSeconds={recordSeconds}
          onSendText={handleSendText}
          onSelectImage={handleSelectImage}
          onStartRecording={startRecording}
          onCancelRecording={cancelRecording}
          onStopAndSendVoiceNote={stopRecording}
          maxVoiceSeconds={voiceMaxSeconds}
          maxMediaMb={chatMediaMaxMb}
          placeholder={
            ticket.status === "claimed" && role === "relawan"
              ? "Kirim sapaan pertama untuk memulai sesi... (Enter untuk kirim)"
              : "Ketik pesan curhat Anda di sini... (Enter untuk kirim)"
          }
        />
      )}
    </div>
  );
}
