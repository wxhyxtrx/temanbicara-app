"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2, Shield, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabasePublic } from "@/lib/supabase/client";
import { notify } from "@/lib/toast";
import { bookingClient } from "@/services/booking.client";
import { useUserStore } from "@/store/user-store";
import { formatWibTime } from "@/lib/booking-utils";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { SessionRoomHeader } from "./session-room-header";
import { SessionComplaintBanner } from "./session-complaint-banner";
import { SessionChatInput } from "./session-chat-input";
import { SessionNotesPlaceholder } from "./session-notes-placeholder";
import { SessionReviewCard } from "./session-review-card";
import { SessionModals } from "./session-modals";
import { SessionAudioPlayer } from "./session-audio-player";
import { SessionImagePreview } from "./session-image-preview";
import type {
  PatientBookingView,
  PsikologBookingView,
  SessionMessageEntity,
  SessionMessageView,
} from "@/types/booking";

function getAccessTokenFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)tb_access_token=([^;]+)/);
  if (!match) return null;
  const raw = decodeURIComponent(match[1]).trim().replace(/^"|"$/g, "");
  return raw && raw !== "undefined" && raw !== "null" ? raw : null;
}

interface SessionRoomViewProps {
  bookingId: string;
  role: "pasien" | "psikolog";
}

export function SessionRoomView({ bookingId, role }: SessionRoomViewProps) {
  const { user: currentUser } = useUserStore();

  const [booking, setBooking] = useState<PatientBookingView | PsikologBookingView | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [messages, setMessages] = useState<SessionMessageView[]>([]);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(true);
  const [isChannelSubscribed, setIsChannelSubscribed] = useState<boolean>(false);

  // Input & sending state
  const [inputMessage, setInputMessage] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);

  // Action states & modals
  const [endSessionModalOpen, setEndSessionModalOpen] = useState<boolean>(false);
  const [isEndingSession, setIsEndingSession] = useState<boolean>(false);
  const [extensionModalOpen, setExtensionModalOpen] = useState<boolean>(false);
  const [isRequestingExtension, setIsRequestingExtension] = useState<boolean>(false);
  const [isRespondingExtension, setIsRespondingExtension] = useState<boolean>(false);
  const [insufficientCoinsError, setInsufficientCoinsError] = useState<string | null>(null);

  // UI layout & refs
  const [isNotesPanelOpen, setIsNotesPanelOpen] = useState<boolean>(true);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const bookingRef = useRef(booking);
  bookingRef.current = booking;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const initialMessagesLoadedRef = useRef(false);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  }, []);

  const fetchBooking = useCallback(async () => {
    try {
      const res = await bookingClient.getBookingDetail(bookingId);
      if (res.success && res.data) {
        setBooking(res.data);
      }
    } catch (err: unknown) {
      if (!bookingRef.current) {
        setLoadError(err instanceof Error ? err.message : "Gagal memuat detail sesi");
      } else {
        console.error("Gagal memperbarui status booking:", err);
      }
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await bookingClient.getSessionMessages(bookingId);
      if (res.success && Array.isArray(res.data)) {
        const prevMessages = messagesRef.current;
        const existingIds = new Set(prevMessages.map((m) => m.id));
        const hasNew = res.data.some((m) => !existingIds.has(m.id));

        setMessages((prev) => {
          const map = new Map<string, SessionMessageView>();
          for (const m of prev) map.set(m.id, m);
          let changed = false;
          for (const m of res.data) {
            if (!map.has(m.id)) {
              changed = true;
            }
            map.set(m.id, m);
          }
          if (!changed && map.size === prev.length) return prev;
          return Array.from(map.values()).sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        });

        if (hasNew && initialMessagesLoadedRef.current) {
          setTimeout(() => scrollToBottom(true), 80);
          fetchBooking();
        }
      }
    } catch (err: unknown) {
      console.error("Gagal memuat pesan sesi:", err);
    } finally {
      setLoadingMessages(false);
      initialMessagesLoadedRef.current = true;
    }
  }, [bookingId, fetchBooking, scrollToBottom]);

  useEffect(() => {
    fetchBooking();
    fetchMessages();
  }, [fetchBooking, fetchMessages]);

  useEffect(() => {
    if (!loadingMessages) {
      scrollToBottom(false);
    }
  }, [loadingMessages, scrollToBottom]);

  const isTerminalStatus =
    booking?.status === "completed" ||
    booking?.status === "auto_cancelled_late" ||
    booking?.status === "no_show" ||
    booking?.status === "cancelled_by_patient" ||
    booking?.status === "cancelled_by_psikolog";

  const isReadOnly = isTerminalStatus;

  // Polling status booking tiap 15 detik selama sesi aktif
  useEffect(() => {
    if (isTerminalStatus || !bookingId) return;

    const bookingPollInterval = setInterval(() => {
      fetchBooking();
    }, 15000);

    return () => clearInterval(bookingPollInterval);
  }, [isTerminalStatus, bookingId, fetchBooking]);

  // Realtime subscriber dengan autentikasi token tb_access_token
  useEffect(() => {
    if (!bookingId || !supabasePublic) return;

    let isMounted = true;
    let channel: ReturnType<typeof supabasePublic.channel> | null = null;

    const setupRealtime = async () => {
      const token = getAccessTokenFromCookie();
      if (!token) {
        if (isMounted) setIsChannelSubscribed(false);
        return;
      }

      try {
        await supabasePublic.realtime.setAuth(token);
      } catch (err) {
        console.error("Gagal setAuth realtime:", err);
        if (isMounted) setIsChannelSubscribed(false);
        return;
      }

      if (!isMounted) return;

      const channelName = `session_room_${bookingId}`;
      const ch = supabasePublic
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "session_messages",
            filter: `booking_id=eq.${bookingId}`,
          },
          (payload) => {
            const newRow = payload.new as SessionMessageEntity;
            setMessages((prev) => {
              if (prev.some((m) => m.id === newRow.id)) return prev;

              const currentBooking = bookingRef.current;
              const isMine = newRow.sender_id === currentUser.id;
              const psikologId =
                role === "psikolog"
                  ? currentUser.id
                  : (currentBooking as PatientBookingView)?.psikolog_id;

              const isMsgFromPsikolog = newRow.sender_id === psikologId;
              const senderRole = isMsgFromPsikolog ? "psikolog" : "pasien";
              const senderName = isMsgFromPsikolog
                ? (currentBooking as PatientBookingView)?.psikolog?.nama_lengkap_gelar || "Psikolog"
                : currentBooking?.patient_display_name || "Pasien";

              const newMsgView: SessionMessageView = {
                id: newRow.id,
                booking_id: newRow.booking_id,
                sender_id: newRow.sender_id,
                sender_role: senderRole,
                sender_name: senderName,
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
            fetchBooking();
          }
        )
        .subscribe((status) => {
          if (!isMounted) return;
          if (status === "SUBSCRIBED") {
            setIsChannelSubscribed(true);
          } else if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            setIsChannelSubscribed(false);
          }
        });

      channel = ch;
    };

    setupRealtime();

    return () => {
      isMounted = false;
      if (channel) {
        supabasePublic.removeChannel(channel);
      }
    };
  }, [bookingId, currentUser.id, role, fetchBooking, scrollToBottom]);

  // Fallback polling pesan tiap 5 detik bila channel bukan SUBSCRIBED
  useEffect(() => {
    if (isChannelSubscribed || isTerminalStatus || !bookingId) return;

    const messagesPollInterval = setInterval(() => {
      fetchMessages();
    }, 5000);

    return () => clearInterval(messagesPollInterval);
  }, [isChannelSubscribed, isTerminalStatus, bookingId, fetchMessages]);

  // Send text message
  const handleSendText = async () => {
    const text = inputMessage.trim();
    if (!text || isSending || isReadOnly) return;

    try {
      setIsSending(true);
      setInputMessage("");
      const res = await bookingClient.sendSessionMessage(bookingId, {
        kind: "text",
        body: text,
      });

      if (res.success && res.data) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === res.data.id)) return prev;
          return [...prev, res.data];
        });
        setTimeout(() => scrollToBottom(true), 80);
        fetchBooking();
      }
    } catch (err: unknown) {
      notify.error("Gagal Mengirim Pesan", err instanceof Error ? err.message : "Terjadi kesalahan.");
      setInputMessage(text);
    } finally {
      setIsSending(false);
    }
  };

  // Select and send image
  const handleSelectImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isReadOnly) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      notify.error("Format Berkas Tidak Didukung", "Hanya format JPG, PNG, atau WebP yang diizinkan.");
      e.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      notify.error("Ukuran Berkas Terlalu Besar", "Ukuran maksimal gambar adalah 5 MB.");
      e.target.value = "";
      return;
    }

    try {
      setUploadingImage(true);
      const presigned = await bookingClient.createSessionMediaUploadUrl(bookingId, {
        file_name: file.name,
        file_type: file.type,
        kind: "image",
      });

      await bookingClient.uploadMediaBinary(presigned.data.upload_url, file);

      const res = await bookingClient.sendSessionMessage(bookingId, {
        kind: "image",
        media_path: presigned.data.file_path,
        body: null,
      });

      if (res.success && res.data) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === res.data.id)) return prev;
          return [...prev, res.data];
        });
        setTimeout(() => scrollToBottom(true), 80);
        fetchBooking();
      }
      notify.success("Gambar Terkirim");
    } catch (err: unknown) {
      notify.error("Gagal Mengunggah Gambar", err instanceof Error ? err.message : "Terjadi kesalahan sistem.");
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  // Hook for Voice Note
  const {
    isRecording,
    recordSeconds,
    startRecording,
    cancelRecording,
    stopRecording,
  } = useVoiceRecorder({
    onRecorded: async (audioBlob, duration, mimeType) => {
      const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : "webm";
      const fileName = `voice-${Date.now()}.${ext}`;

      const presigned = await bookingClient.createSessionMediaUploadUrl(bookingId, {
        file_name: fileName,
        file_type: mimeType,
        kind: "voice",
      });

      await bookingClient.uploadMediaBinary(presigned.data.upload_url, audioBlob);

      const res = await bookingClient.sendSessionMessage(bookingId, {
        kind: "voice",
        media_path: presigned.data.file_path,
        duration_seconds: duration,
      });

      if (res.success && res.data) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === res.data.id)) return prev;
          return [...prev, res.data];
        });
        setTimeout(() => scrollToBottom(true), 80);
        fetchBooking();
      }
      notify.success("Pesan Suara Terkirim");
    },
  });

  // Patient: Request Extension
  const handleRequestExtension = async () => {
    try {
      setIsRequestingExtension(true);
      await bookingClient.requestExtension(bookingId);
      setExtensionModalOpen(false);
      notify.success("Ekstensi Diajukan", "Permintaan perpanjangan 10 menit dikirim ke psikolog.");
      fetchBooking();
    } catch (err: unknown) {
      notify.error("Pengajuan Gagal", err instanceof Error ? err.message : "Tidak dapat mengajukan ekstensi.");
    } finally {
      setIsRequestingExtension(false);
    }
  };

  // Psychologist: Respond Extension
  const handleRespondExtension = async (approve: boolean) => {
    try {
      setIsRespondingExtension(true);
      setInsufficientCoinsError(null);
      const res = await bookingClient.respondExtension(bookingId, { approve });

      if (res.success) {
        if (res.data.result === "insufficient_coins") {
          setInsufficientCoinsError(
            "Saldo koin pasien tidak mencukupi untuk biaya perpanjangan sesi. Permintaan ekstensi otomatis dibatalkan sistem."
          );
          notify.error(
            "Saldo Koin Pasien Kurang",
            "Permintaan ekstensi otomatis ditolak karena saldo pasien tidak mencukupi."
          );
        } else if (res.data.result === "approved") {
          notify.success("Ekstensi Disetujui", "Sesi berhasil diperpanjang +10 menit.");
        } else {
          notify.info("Ekstensi Ditolak", "Permintaan ekstensi telah ditolak.");
        }
        fetchBooking();
      }
    } catch (err: unknown) {
      notify.error("Gagal Merespons Ekstensi", err instanceof Error ? err.message : "Kesalahan sistem.");
    } finally {
      setIsRespondingExtension(false);
    }
  };

  // Psychologist: End Session
  const handleEndSession = async () => {
    try {
      setIsEndingSession(true);
      await bookingClient.endSession(bookingId);
      setEndSessionModalOpen(false);
      notify.success("Sesi Selesai", "Sesi konseling berhasil diakhiri.");
      fetchBooking();
    } catch (err: unknown) {
      notify.error("Gagal Mengakhiri Sesi", err instanceof Error ? err.message : "Kesalahan sistem.");
    } finally {
      setIsEndingSession(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-120px)] flex flex-col items-center justify-center p-8 text-center space-y-3 font-nunito">
        <Loader2 size={32} className="animate-spin text-teal-600" />
        <p className="text-sm text-slate-600 dark:text-slate-300">Menyiapkan ruang sesi konseling...</p>
      </div>
    );
  }

  if (loadError || !booking) {
    return (
      <div className="h-[calc(100vh-120px)] flex flex-col items-center justify-center p-8 text-center space-y-4 font-nunito max-w-md mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 text-rose-600 flex items-center justify-center">
          <AlertCircle size={28} />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Ruang Sesi Tidak Ditemukan</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {loadError || "Data jadwal booking tidak dapat diakses atau Anda bukan peserta sesi ini."}
          </p>
        </div>
        <Link href={role === "psikolog" ? "/counselor/beranda" : "/patient/schedule"}>
          <Button variant="outline" size="sm" className="text-xs rounded-xl">
            Kembali ke Beranda
          </Button>
        </Link>
      </div>
    );
  }

  const patientBooking = role === "pasien" ? (booking as PatientBookingView) : null;
  const partnerName =
    role === "psikolog"
      ? booking.patient_display_name || "Pasien Anonim"
      : patientBooking?.psikolog?.nama_lengkap_gelar || "Psikolog Klinis";

  return (
    <div className="h-[calc(100vh-115px)] min-h-[540px] flex flex-col font-nunito bg-slate-50/50 dark:bg-slate-950/40 rounded-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs">
      <SessionRoomHeader
        role={role}
        booking={booking}
        isReadOnly={isReadOnly}
        partnerName={partnerName}
        isNotesPanelOpen={isNotesPanelOpen}
        onToggleNotesPanel={() => setIsNotesPanelOpen((prev) => !prev)}
        onRequestExtensionOpen={() => setExtensionModalOpen(true)}
        onEndSessionOpen={() => setEndSessionModalOpen(true)}
      />

      <SessionComplaintBanner
        role={role}
        keluhan={booking.keluhan}
        extensionStatus={booking.extension_status}
        isReadOnly={isReadOnly}
        isRespondingExtension={isRespondingExtension}
        onRespondExtension={handleRespondExtension}
        insufficientCoinsError={insufficientCoinsError}
        onDismissCoinsError={() => setInsufficientCoinsError(null)}
      />

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Kolom Chat */}
        <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900">
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
            <div className="flex items-center justify-center my-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700/80">
                <Shield size={12} className="text-teal-600 dark:text-teal-400" />
                <span>Sesi Konseling Privat Terenkripsi Medis</span>
              </div>
            </div>

            {booking.status === "completed" && role === "pasien" && (
              <div className="max-w-xl mx-auto w-full my-2">
                <SessionReviewCard
                  bookingId={bookingId}
                  endedAt={booking.ended_at}
                />
              </div>
            )}

            {loadingMessages ? (
              <div className="flex items-center justify-center py-10 text-xs text-slate-400 gap-2">
                <Loader2 size={16} className="animate-spin text-teal-600" />
                <span>Memuat riwayat percakapan...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="py-12 text-center space-y-2 max-w-sm mx-auto">
                <div className="w-12 h-12 rounded-full bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto">
                  <User size={22} />
                </div>
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">Ruang Percakapan Siap</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-nunito">
                  {role === "psikolog"
                    ? "Sambut pasien dengan hangat untuk memulai sesi konsultasi klinis Anda."
                    : "Sampaikan keluhan dan perasaan Anda dengan leluasa. Ruang ini aman dan rahasia."}
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMine = msg.is_mine;
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
                  >
                    <div className="flex items-baseline gap-1.5 mb-1 px-1">
                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                        {isMine ? "Anda" : msg.sender_name}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {formatWibTime(msg.created_at)}
                      </span>
                    </div>

                    <div
                      className={`rounded-2xl px-3.5 py-2 text-xs leading-relaxed max-w-[85%] sm:max-w-[70%] break-words shadow-2xs ${
                        isMine
                          ? "bg-teal-600 text-white rounded-br-xs"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-xs border border-slate-200/80 dark:border-slate-700/80"
                      }`}
                    >
                      {msg.kind === "text" && (
                        <p className="whitespace-pre-wrap">{msg.body}</p>
                      )}

                      {msg.kind === "image" && msg.media_path && (
                        <SessionImagePreview
                          bookingId={bookingId}
                          mediaPath={msg.media_path}
                          caption={msg.body}
                          isMine={isMine}
                        />
                      )}

                      {msg.kind === "voice" && msg.media_path && (
                        <SessionAudioPlayer
                          bookingId={bookingId}
                          mediaPath={msg.media_path}
                          durationSeconds={msg.duration_seconds}
                          isMine={isMine}
                        />
                      )}
                    </div>
                  </div>
                );
              })
            )}

            <div ref={messagesEndRef} />
          </div>

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
          />
        </div>

        {/* Kolom Kanan: Catatan Klien (Khusus Psikolog) */}
        {role === "psikolog" && (
          <SessionNotesPlaceholder
            isOpen={isNotesPanelOpen}
            bookingId={bookingId}
            bookingStatus={booking.status}
            patientDisplayName={booking.patient_display_name}
            patientId={booking.patient_id}
          />
        )}
      </div>

      <SessionModals
        extensionModalOpen={extensionModalOpen}
        setExtensionModalOpen={setExtensionModalOpen}
        isRequestingExtension={isRequestingExtension}
        onRequestExtension={handleRequestExtension}
        extensionPriceCoins={booking?.extension_price_coins ?? null}
        endSessionModalOpen={endSessionModalOpen}
        setEndSessionModalOpen={setEndSessionModalOpen}
        isEndingSession={isEndingSession}
        onEndSession={handleEndSession}
        patientDisplayName={booking?.patient_display_name || "pasien"}
      />
    </div>
  );
}
