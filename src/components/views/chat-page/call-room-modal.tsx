"use client";

import React, { useState, useEffect, useRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Conversation, useChatStore } from "@/store/chat-store";
import {
  Mic,
  MicOff,
  PhoneOff,
  ShieldCheck,
  Clock,
  Volume2,
  CheckCircle2,
  Coins,
} from "lucide-react";
import { MdVerified } from "react-icons/md";

interface CallRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation | null;
}

export function CallRoomModal({
  isOpen,
  onClose,
  conversation,
}: CallRoomModalProps) {
  const { sendMessage } = useChatStore();

  // Call states
  const [secondsRemaining, setSecondsRemaining] = useState<number>(3600); // 60 menit (1 jam)
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showEndConfirm, setShowEndConfirm] = useState<boolean>(false);
  const streamRef = useRef<MediaStream | null>(null);

  // Timer sesi countdown 60 menit
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleEndCall();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  // Request audio microphone stream
  useEffect(() => {
    if (isOpen && !isMuted) {
      if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia({ audio: true })
          .then((stream) => {
            streamRef.current = stream;
          })
          .catch(() => {
            // Permission rejected; fallback to simulated voice visualizer
          });
      }
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen, isMuted]);

  if (!conversation) return null;

  // Format detik ke MM:SS
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remSecs.toString().padStart(2, "0")}`;
  };

  const handleEndCall = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    const elapsedMinutes = Math.max(1, Math.round((3600 - secondsRemaining) / 60));
    sendMessage(
      `[Sesi Voice Call Selesai] Durasi panggilan suara privat bersama ${conversation.name}: ${elapsedMinutes} menit (Tarif: 5 Koin/jam). Kerahasiaan data terlindungi.`
    );
    setShowEndConfirm(false);
    setSecondsRemaining(3600);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && setShowEndConfirm(true)}>
      <DialogPortal>
        <DialogOverlay className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs" />

        <DialogPrimitive.Content
          aria-describedby="call-room-accessible-desc"
          className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-xl h-[520px] rounded-3xl bg-slate-950 text-white font-nunito shadow-2xl border border-slate-800 outline-none overflow-hidden flex flex-col justify-between"
        >
          {/* Accessible Title & Description */}
          <DialogTitle className="sr-only">
            Ruang Voice Call Telehealth - {conversation.name}
          </DialogTitle>
          <DialogDescription id="call-room-accessible-desc" className="sr-only">
            Sesi panggilan suara privat terenkripsi bersama psikolog berlisensi
          </DialogDescription>

          {/* 1. Header Bar: Info Psikolog & Timer Sesi */}
          <div className="flex items-center justify-between p-4 sm:p-5 bg-gradient-to-b from-slate-900 to-transparent">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-teal-800/80 border border-teal-600 text-teal-200 font-bold text-xs flex items-center justify-center font-heading">
                {conversation.initials}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-heading font-bold text-sm sm:text-base text-white truncate">
                    {conversation.name}
                  </h3>
                  <MdVerified className="text-sky-400 text-sm shrink-0" />
                </div>
                <p className="text-[11px] text-teal-300">{conversation.role}</p>
              </div>
            </div>

            {/* Timer 60 Menit & Badge Tarif */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-700/80 text-xs font-mono font-bold">
                <Clock
                  size={14}
                  className={secondsRemaining < 300 ? "text-rose-400 animate-pulse" : "text-teal-400"}
                />
                <span className={secondsRemaining < 300 ? "text-rose-400" : "text-white"}>
                  {formatTime(secondsRemaining)}
                </span>
              </div>

              <div className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal-900/40 border border-teal-700/50 text-[11px] font-semibold text-teal-300">
                <Coins size={12} />
                <span>5 Koin/Jam</span>
              </div>
            </div>
          </div>

          {/* 2. Main Voice Stage: Doctor Avatar & Waveform */}
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-5">
            <div className="relative inline-block">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-teal-700 to-teal-950 text-white font-bold text-3xl sm:text-4xl flex items-center justify-center border-4 border-teal-500/40 shadow-2xl font-heading animate-pulse">
                {conversation.initials}
              </div>
              <span className="absolute bottom-1 right-2 w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-950" />
            </div>

            <div className="space-y-1">
              <h4 className="font-heading font-bold text-base sm:text-lg text-white">
                {conversation.name}
              </h4>
              <p className="text-xs text-teal-300/80">
                {isMuted ? "Mikrofon Anda sedang dibisukan" : "Panggilan Suara Terhubung • Audio Jernih"}
              </p>
            </div>

            {/* Animated Audio Waveform */}
            <div className="flex items-center justify-center gap-1.5 h-8">
              {[30, 65, 40, 85, 55, 95, 45, 75, 35, 60, 40].map((h, i) => (
                <span
                  key={i}
                  style={{ height: `${h}%` }}
                  className={`w-1.5 rounded-full transition-all duration-300 ${
                    isMuted ? "bg-slate-600 h-2" : "bg-teal-400 animate-pulse"
                  }`}
                />
              ))}
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-700/60 text-[11px] font-medium text-emerald-300">
              <ShieldCheck size={13} />
              <span>Enkripsi Suara End-to-End DTLS/SRTP</span>
            </div>
          </div>

          {/* 3. Bottom Controls Toolbar */}
          <div className="p-4 sm:p-5 bg-gradient-to-t from-slate-900 to-transparent flex items-center justify-center gap-3">
            {/* Mic Toggle */}
            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              className={`p-3 rounded-2xl transition-all cursor-pointer shadow-md ${
                isMuted
                  ? "bg-rose-600/90 hover:bg-rose-600 text-white"
                  : "bg-slate-800/90 hover:bg-slate-700 text-white"
              }`}
              title={isMuted ? "Aktifkan Mikrofon" : "Bisukan Mikrofon"}
            >
              {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>

            {/* Akhiri Sesi Button */}
            <Button
              type="button"
              onClick={() => setShowEndConfirm(true)}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-2xl px-6 py-3 h-auto font-semibold gap-2 shadow-lg cursor-pointer"
            >
              <PhoneOff size={18} />
              <span>Akhiri Sesi</span>
            </Button>
          </div>

          {/* Dialog Konfirmasi Akhiri Sesi */}
          {showEndConfirm && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
              <div className="bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-2xl max-w-sm w-full text-center space-y-4 shadow-2xl">
                <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                  <PhoneOff size={24} />
                </div>
                <div className="space-y-1">
                  <h4 className="font-heading font-bold text-base text-white">
                    Akhiri Sesi Panggilan Suara?
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Sesi panggilan bersama {conversation.name} akan diselesaikan dan dicatat di riwayat konselingmu.
                  </p>
                </div>

                <div className="flex items-center justify-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowEndConfirm(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                  >
                    Lanjutkan Panggilan
                  </button>
                  <button
                    type="button"
                    onClick={handleEndCall}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer shadow-sm"
                  >
                    Ya, Akhiri Sekarang
                  </button>
                </div>
              </div>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
