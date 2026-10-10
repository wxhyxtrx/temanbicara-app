"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Send,
  Headphones,
  Heart,
  ShieldCheck,
  AlertTriangle,
  ArrowLeft,
  Clock,
  Sparkles,
  PhoneCall,
  CheckCircle2,
  Check,
  Smile,
} from "lucide-react";
import { useUserStore } from "@/store/user-store";

interface Message {
  id: string;
  sender: "peer_listener" | "peer_client";
  text: string;
  time: string;
}

const initialMessages: Message[] = [
  {
    id: "m-1",
    sender: "peer_client",
    text: "Halo kak... terima kasih sudah mau menyempatkan waktu untuk mendengar.",
    time: "20:01",
  },
  {
    id: "m-2",
    sender: "peer_listener",
    text: "Halo! Selamat datang di ruang aman ini. Nama samaranku Dewi. Aku di sini untuk mendengarkan ceritamu dengan penuh penerimaan. Bagaimana kabarmu malam ini?",
    time: "20:02",
  },
  {
    id: "m-3",
    sender: "peer_client",
    text: "Aku merasa lelah dan kesepian banget akhir-akhir ini. Lingkungan kerjaku sangat menekan, dan rasanya gak ada teman yang benar-benar peduli tanpa menghakimi...",
    time: "20:03",
  },
];

const empathyQuickPhrases = [
  "Aku mengerti perasaanmu, perasaan lelah itu sangat valid.",
  "Menghadapi situasi seperti itu sendirian pasti terasa berat sekali ya...",
  "Tarik napas perlahan ya, kamu aman bercerita di sini.",
  "Terima kasih sudah begitu berani meluapkan ini kepadaku.",
];

export default function ListenerQueueRoomPage() {
  const router = useRouter();
  const user = useUserStore((state) => state.user);
  const updateProfile = useUserStore((state) => state.updateProfile);

  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputMessage, setInputMessage] = useState("");
  const [sessionMinutes, setSessionMinutes] = useState(14);
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [sessionEndSuccess, setSessionEndSuccess] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const newMsg: Message = {
      id: `m-${Date.now()}`,
      sender: "peer_listener",
      text: inputMessage.trim(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputMessage("");

    // Respon simulasi klien sebaya
    setTimeout(() => {
      const clientReplies = [
        "Mendengar kakak bicara begitu rasanya sedikit lebih lega...",
        "Iya kak, kadang aku ngerasa cuma butuh didengar tanpa dinasihati begini.",
        "Terima kasih ya kak, aku bakal coba tarik napas perlahan.",
      ];
      const randomReply = clientReplies[Math.floor(Math.random() * clientReplies.length)];
      setMessages((prev) => [
        ...prev,
        {
          id: `m-${Date.now() + 1}`,
          sender: "peer_client",
          text: randomReply,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }, 1800);
  };

  const handleUsePhrase = (phrase: string) => {
    setInputMessage(phrase);
  };

  const handleConfirmEscalate = () => {
    const referralMsg: Message = {
      id: `m-sys-${Date.now()}`,
      sender: "peer_listener",
      text: "[Sistem TemanBicara] Pendengar menyarankan rujukan konsultasi dengan Psikolog Klinis berlisensi HIMPSI untuk pendampingan lebih mendalam. Hotline darurat: 119 ext. 8.",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, referralMsg]);
    setShowEscalateModal(false);
  };

  const handleConfirmEndSession = () => {
    // Update listener stats
    const currentSessions = user.listenerData?.sessionsCompleted || 64;
    updateProfile({
      listenerData: {
        ...(user.listenerData || {
          listenerBadge: "Pendengar Empatik Terlatih",
          topicsHandled: ["Curhat Stres Kuliah", "Quarter Life Crisis"],
          rating: 4.9,
          status: "online",
        }),
        sessionsCompleted: currentSessions + 1,
      },
    });

    setShowEndModal(false);
    setSessionEndSuccess(true);
    setTimeout(() => {
      router.push("/listener/beranda");
    }, 1800);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] font-nunito pb-6 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* 1. Header Ruang Dengar */}
      <div className="flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs mb-4">
        <div className="flex items-center gap-3">
          <Link href="/listener/beranda">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer"
            >
              <ArrowLeft size={16} />
            </Button>
          </Link>

          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-950 dark:to-teal-900 text-teal-800 dark:text-teal-200 font-bold text-xs flex items-center justify-center border border-teal-200 dark:border-teal-700">
            BB
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white font-heading">
                Bunga Biru (Anonim)
              </h2>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <Badge variant="outline" className="text-[10px] bg-teal-50 dark:bg-teal-950 text-teal-700 border-teal-200">
                Sesi Sebaya Aktif
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-nunito">
              Topik: Kesepian & Beban Lingkungan Kerja • {sessionMinutes} Menit Berjalan
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowEscalateModal(true)}
            className="text-xs border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl px-3 h-8 font-semibold cursor-pointer gap-1.5"
          >
            <AlertTriangle size={14} />
            <span className="hidden sm:inline">Rujuk ke Psikolog</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowEndModal(true)}
            className="text-xs border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl px-3 h-8 font-semibold cursor-pointer"
          >
            Akhiri Sesi
          </Button>
        </div>
      </div>

      {sessionEndSuccess && (
        <div className="mb-3 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={16} className="text-emerald-600" />
          <span>Sesi curhat berhasil diselesaikan! Jam relawan telah ditambahkan ke profil Anda. Mengalihkan ke beranda...</span>
        </div>
      )}

      {/* 2. Chat Log Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 rounded-2xl bg-slate-50/70 dark:bg-slate-900/60 border border-slate-200/90 dark:border-slate-800 space-y-4">
        {messages.map((msg) => {
          const isMe = msg.sender === "peer_listener";
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? "items-end" : "items-start"} max-w-xl ${isMe ? "ml-auto" : "mr-auto"}`}
            >
              <div
                className={`p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-2xs ${
                  isMe
                    ? "bg-teal-600 text-white rounded-br-xs"
                    : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700 rounded-bl-xs"
                }`}
              >
                {msg.text}
              </div>
              <span className="text-[10px] text-slate-400 mt-1 px-1 font-mono">{msg.time}</span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* 3. Quick Empathetic Validation Bar */}
      <div className="pt-3 pb-2 space-y-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 px-1">
          <Sparkles size={12} className="text-teal-600 dark:text-teal-400" />
          <span>Bantuan Respon Empatik (PFA Active Listening):</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {empathyQuickPhrases.map((phrase, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleUsePhrase(phrase)}
              className="shrink-0 text-[11px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-teal-400 dark:hover:border-teal-600 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-2xs"
            >
              "{phrase}"
            </button>
          ))}
        </div>
      </div>

      {/* 4. Chat Input Form */}
      <form onSubmit={handleSend} className="flex items-center gap-2 pt-1">
        <Input
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Tuliskan respon empatik dan penuh penerimaan..."
          className="h-11 text-xs sm:text-sm bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 rounded-xl focus-visible:ring-teal-600"
        />
        <Button
          type="submit"
          className="h-11 px-5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-xs cursor-pointer gap-1.5"
        >
          <Send size={15} />
          <span className="hidden sm:inline text-xs font-semibold">Kirim</span>
        </Button>
      </form>

      {/* 5. MODAL: ESKALASI KRISIS KE PSIKOLOG */}
      <Dialog open={showEscalateModal} onOpenChange={setShowEscalateModal}>
        <DialogContent className="max-w-md font-nunito p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
          <DialogHeader className="space-y-1 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} />
              </div>
              <div>
                <DialogTitle className="text-base font-bold font-heading text-slate-900 dark:text-white">
                  Rujuk ke Psikolog Klinis?
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Eskalasi bila klien membutuhkan penanganan klinis atau menunjukkan tanda bahaya
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 pt-2 text-xs">
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-nunito">
              Sebagai pendengar sebaya, peran Anda adalah mendampingi secara suportif. Jika masalah klien melebihi kapasitas dukungan sebaya (trauma berat, depresi klinis), sistem akan otomatis menampilkan tautan konsultasi psikolog berlisensi dan kontak SEJIWA 119 ext. 8 di ruang chat.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEscalateModal(false)}
                className="text-xs h-9 rounded-xl px-4 cursor-pointer"
              >
                Batal
              </Button>
              <Button
                type="button"
                onClick={handleConfirmEscalate}
                className="text-xs h-9 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl px-4 cursor-pointer"
              >
                Kirim Pesan Rujukan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 6. MODAL: AKHIRI SESI SEBAYA */}
      <Dialog open={showEndModal} onOpenChange={setShowEndModal}>
        <DialogContent className="max-w-md font-nunito p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
          <DialogHeader className="space-y-1 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-400 flex items-center justify-center shrink-0">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <DialogTitle className="text-base font-bold font-heading text-slate-900 dark:text-white">
                  Akhiri Sesi Mendengar?
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Konfirmasi penyelesaian sesi curhat bersama Bunga Biru
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 pt-2 text-xs">
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-nunito">
              Terima kasih telah meluangkan waktu dan empati Anda. Sesi ini akan ditandai selesai dan jam relawan Anda akan bertambah +1 di profil pendengar.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEndModal(false)}
                className="text-xs h-9 rounded-xl px-4 cursor-pointer"
              >
                Lanjutkan Mendengar
              </Button>
              <Button
                type="button"
                onClick={handleConfirmEndSession}
                className="text-xs h-9 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl px-4 cursor-pointer"
              >
                Selesaikan Sesi
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
