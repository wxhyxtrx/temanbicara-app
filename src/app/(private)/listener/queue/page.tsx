"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  CheckCircle2,
  Users,
  MessageCircle,
  Lock,
  MessageSquareHeart,
  AlertCircle,
} from "lucide-react";
import { useUserStore } from "@/store/user-store";
import { usePeerVentStore, VentingPost } from "@/store/peer-vent-store";
import { useChatStore } from "@/store/chat-store";

interface ChatMessage {
  id: string;
  sender: "peer_listener" | "peer_client";
  text: string;
  time: string;
}

const empathyQuickPhrases = [
  "Aku mengerti perasaanmu, beban yang kamu rasakan sangat valid.",
  "Menghadapi situasi seperti itu sendirian pasti terasa berat sekali ya...",
  "Tarik napas perlahan ya, kamu aman bercerita di sini.",
  "Terima kasih sudah begitu berani meluapkan ini kepadaku.",
];

export default function ListenerQueueRoomPage() {
  const router = useRouter();
  const user = useUserStore((state) => state.user);
  const updateProfile = useUserStore((state) => state.updateProfile);

  const {
    posts,
    claimPost,
    closeSession,
    dailySessionsCompleted,
    maxDailySessions,
    isOnBreak,
    toggleBreakMode,
    reportCrisisIncident,
    resetDailyQuota,
  } = usePeerVentStore();
  const listenerId = user.id || "listener-dewi";
  const listenerName = user.fullName || "Dewi Lestari";

  // Filter posts
  const waitingPosts = posts.filter((p) => p.status === "menunggu");
  const myActiveSessions = posts.filter(
    (p) => p.handledByListenerId === listenerId && p.status === "ditangani"
  );
  const activeCount = myActiveSessions.length;
  const isCapacityFull = activeCount >= 2;
  const isDailyLimitReached = dailySessionsCompleted >= maxDailySessions;

  // Tabs: "queue" | "chat"
  const [activeTab, setActiveTab] = useState<"queue" | "chat">(
    myActiveSessions.length > 0 ? "chat" : "queue"
  );
  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    myActiveSessions[0]?.id || ""
  );

  // Modal claim dialog state
  const [postToClaim, setPostToClaim] = useState<VentingPost | null>(null);
  const [firstResponseText, setFirstResponseText] = useState("");
  const [claimError, setClaimError] = useState("");

  // Chat conversation state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [escalateReason, setEscalateReason] = useState("Indikasi bahaya keselamatan jiwa / ide bunuh diri");
  const [customEscalateNotes, setCustomEscalateNotes] = useState("");
  const [showEndModal, setShowEndModal] = useState(false);
  const [sessionEndSuccess, setSessionEndSuccess] = useState(false);
  const [crisisAlertSuccess, setCrisisAlertSuccess] = useState(false);

  // Box Breathing Exercise Modal State
  const [showBreathingModal, setShowBreathingModal] = useState(false);
  const [breathingPhase, setBreathingPhase] = useState<"Tarik Napas" | "Tahan Napas" | "Hembuskan" | "Jeda Rileks">("Tarik Napas");
  const [breathingTimer, setBreathingTimer] = useState(4);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Box Breathing Timer Effect
  useEffect(() => {
    if (!showBreathingModal) return;

    const interval = setInterval(() => {
      setBreathingTimer((prev) => {
        if (prev <= 1) {
          setBreathingPhase((currentPhase) => {
            switch (currentPhase) {
              case "Tarik Napas":
                return "Tahan Napas";
              case "Tahan Napas":
                return "Hembuskan";
              case "Hembuskan":
                return "Jeda Rileks";
              case "Jeda Rileks":
              default:
                return "Tarik Napas";
            }
          });
          return 4;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showBreathingModal]);

  // Sync selected session with chat messages
  useEffect(() => {
    const currentActive = myActiveSessions.find((s) => s.id === selectedSessionId) || myActiveSessions[0];
    if (currentActive) {
      setSelectedSessionId(currentActive.id);
      const nowTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setChatMessages([
        {
          id: "m-initial-client",
          sender: "peer_client",
          text: `[Topik: ${currentActive.topic} | Emosi: ${currentActive.emotion}]\n\n"${currentActive.content}"`,
          time: currentActive.createdAt,
        },
        {
          id: "m-initial-reply",
          sender: "peer_listener",
          text: currentActive.firstResponse || "Halo! Aku di sini untuk mendengarkan ceritamu.",
          time: nowTime,
        },
      ]);
    }
  }, [selectedSessionId, myActiveSessions.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleOpenClaimModal = (post: VentingPost) => {
    if (isOnBreak) {
      alert("Mode Istirahat sedang aktif. Matikan mode rehat untuk mulai menerima curhatan kembali.");
      return;
    }
    if (isDailyLimitReached) {
      alert("Batas aman 4 sesi harian telah tercapai (Burnout Guard). Luangkan waktu untuk relaksasi demi menjaga kesehatan emosi Anda.");
      return;
    }
    if (isCapacityFull) {
      alert("Kapasitas penuh. Anda sedang mendampingi batas maksimal 2 sesi curhat aktif. Selesaikan salah satu sesi terlebih dahulu.");
      return;
    }
    setPostToClaim(post);
    setFirstResponseText(
      `Halo ${post.patientAlias}! Terima kasih sudah berani menceritakan hal ini. Aku Dewi, relawan pendengar sebaya. Aku di sini untuk mendengarkanmu dengan penuh penerimaan tanpa menghakimi. Ceritakan lebih banyak hal yang membebanimu ya...`
    );
    setClaimError("");
  };

  const handleConfirmClaim = () => {
    if (!postToClaim) return;
    if (!firstResponseText.trim()) {
      setClaimError("Harap tuliskan tanggapan pembuka empatik.");
      return;
    }

    const result = claimPost(postToClaim.id, listenerId, listenerName, firstResponseText);
    if (!result.success) {
      setClaimError(result.message);
      return;
    }

    const claimedId = postToClaim.id;
    setPostToClaim(null);
    setSelectedSessionId(claimedId);
    setActiveTab("chat");
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const newMsg: ChatMessage = {
      id: `m-${Date.now()}`,
      sender: "peer_listener",
      text: inputMessage.trim(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setChatMessages((prev) => [...prev, newMsg]);
    setInputMessage("");

    // Respon simulasi klien sebaya
    setTimeout(() => {
      const clientReplies = [
        "Mendengar tanggapan kakak rasanya sedikit lebih lega...",
        "Iya kak, rasanya senang sekali ada yang mau mendengarkan tanpa menghakimi.",
        "Terima kasih sudah hadir untukku malam ini ya kak.",
      ];
      const randomReply = clientReplies[Math.floor(Math.random() * clientReplies.length)];
      setChatMessages((prev) => [
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

  const handleConfirmEndSession = () => {
    if (!selectedSessionId) return;

    closeSession(selectedSessionId);

    // Update listener statistics
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
      setSessionEndSuccess(false);
      if (myActiveSessions.length <= 1) {
        setActiveTab("queue");
      }
    }, 1500);
  };

  const activePostData = myActiveSessions.find((s) => s.id === selectedSessionId) || myActiveSessions[0];

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] font-nunito pb-6 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* 1. Header Bar: Kapasitas Handler & Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs mb-4">
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

          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white font-heading">
                Ruang Dengar Pendengar Sebaya
              </h1>
              <Badge
                className={`text-[11px] font-bold border px-2 py-0.5 ${
                  isCapacityFull
                    ? "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border-rose-300"
                    : "bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-300"
                }`}
              >
                Kapasitas Aktif: {activeCount}/2 Sesi
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-nunito">
              {isCapacityFull
                ? "Maksimal 2 sesi aktif tercapai untuk mencegah kelelahan empati (listener burnout)."
                : "Anda dapat mendampingi maksimal 2 curhatan aktif secara bersamaan."}
            </p>
          </div>
        </div>

        {/* Tab Navigator */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab("queue")}
            className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === "queue"
                ? "bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            Antrean Masuk ({waitingPosts.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("chat")}
            disabled={myActiveSessions.length === 0}
            className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === "chat"
                ? "bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
            }`}
          >
            Sesi Obrolan Aktif ({myActiveSessions.length})
          </button>
        </div>
      </div>

      {sessionEndSuccess && (
        <div className="mb-3 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={16} className="text-emerald-600" />
          <span>Sesi curhat berhasil diselesaikan! Slot relawan Anda kembali terbuka untuk teman cerita baru.</span>
        </div>
      )}

      {crisisAlertSuccess && (
        <div className="mb-3 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <AlertTriangle size={16} className="text-rose-600 shrink-0" />
          <span>Laporan krisis darurat berhasil diteruskan ke Dashboard Administrator &amp; Hotline SEJIWA 119!</span>
        </div>
      )}

      {/* 2. Burnout Guard & Emotional Health Panel */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-sky-50 via-teal-50 to-slate-50 dark:from-sky-950/40 dark:via-teal-950/40 dark:to-slate-900 border border-sky-200/80 dark:border-sky-900/60 shadow-2xs mb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sky-100 dark:bg-sky-900/80 text-sky-700 dark:text-sky-300 flex items-center justify-center shrink-0">
            <Heart size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold font-heading text-slate-900 dark:text-white">
                Burnout Guard Relawan
              </span>
              <Badge
                className={`text-[10px] font-bold border px-2 ${
                  isOnBreak
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300"
                    : isDailyLimitReached
                    ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300"
                    : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300"
                }`}
              >
                {isOnBreak ? "Sedang Rehat Emosi" : isDailyLimitReached ? "Batas Harian Terpenuhi" : "Energi Siap Mendengar"}
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-nunito mt-0.5">
              Beban Sesi Hari Ini: <strong>{dailySessionsCompleted} dari {maxDailySessions} Sesi Maksimal</strong>. Istirahat sejenak sangat dianjurkan untuk menjaga empati.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowBreathingModal(true)}
            className="text-xs rounded-xl h-8 px-3 font-semibold gap-1.5 border-teal-300 dark:border-teal-800 text-teal-800 dark:text-teal-300 hover:bg-teal-50 cursor-pointer"
          >
            <Sparkles size={13} />
            <span>Box Breathing (Relaksasi)</span>
          </Button>

          <Button
            size="sm"
            variant={isOnBreak ? "default" : "outline"}
            onClick={() => toggleBreakMode()}
            className={`text-xs rounded-xl h-8 px-3 font-semibold gap-1.5 cursor-pointer ${
              isOnBreak
                ? "bg-teal-600 hover:bg-teal-700 text-white"
                : "border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
            }`}
          >
            <Clock size={13} />
            <span>{isOnBreak ? "Akhiri Rehat & Aktif" : "Ambil Jeda / Istirahat"}</span>
          </Button>
        </div>
      </div>

      {/* TAB 1: DAFTAR ANTREAN CURHATAN MASUK */}
      {activeTab === "queue" && (
        <div className="flex-1 overflow-y-auto space-y-4">
          {isOnBreak && (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-between gap-2.5 text-xs text-amber-800 dark:text-amber-300">
              <div className="flex items-center gap-2">
                <AlertCircle size={17} className="shrink-0 text-amber-600" />
                <span>
                  <strong>Mode Istirahat Aktif:</strong> Anda sedang meluangkan waktu pemulihan energi emosi. Tombol pengambilan curhatan baru dijeda sementara.
                </span>
              </div>
              <Button size="sm" onClick={() => toggleBreakMode(false)} className="text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-lg h-7 px-2.5 font-bold">
                Kembali Aktif
              </Button>
            </div>
          )}

          {isDailyLimitReached && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center justify-between gap-2.5 text-xs text-rose-800 dark:text-rose-300">
              <div className="flex items-center gap-2">
                <ShieldCheck size={17} className="shrink-0 text-rose-600" />
                <span>
                  <strong>Batas Kuota Harian Terpenuhi ({dailySessionsCompleted}/{maxDailySessions}):</strong> Burnout Guard aktif untuk melindungi kesehatan mental Anda hari ini.
                </span>
              </div>
              <Button size="sm" variant="outline" onClick={resetDailyQuota} className="text-xs border-rose-300 text-rose-700 rounded-lg h-7 px-2.5 font-bold">
                Reset Demo
              </Button>
            </div>
          )}
          {isCapacityFull && (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-300">
              <AlertCircle size={17} className="shrink-0 text-amber-600" />
              <span>
                <strong>Kapasitas Maksimal Tercapai (2/2):</strong> Untuk menjaga kualitas pendampingan PFA, Anda belum bisa mengambil curhatan baru. Buka tab <strong>Sesi Obrolan Aktif</strong> untuk melanjutkan atau menyelesaikan sesi.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {waitingPosts.map((post) => (
              <Card
                key={post.id}
                className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between"
              >
                <CardHeader className="p-4 pb-2 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300 font-bold text-xs flex items-center justify-center font-heading">
                        {post.patientAlias.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white font-heading">
                          {post.patientAlias}
                        </h3>
                        <span className="text-[10px] text-slate-400 font-mono">{post.createdAt}</span>
                      </div>
                    </div>

                    <Badge className={`text-[10px] font-semibold border ${post.emotionColor}`}>
                      {post.emotion}
                    </Badge>
                  </div>

                  <span className="inline-block text-[11px] font-bold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/70 border border-teal-200 dark:border-teal-800 px-2.5 py-0.5 rounded-lg">
                    Topik: {post.topic}
                  </span>
                </CardHeader>

                <CardContent className="p-4 pt-1 space-y-4">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 font-nunito leading-relaxed italic line-clamp-4">
                    "{post.content}"
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Lock size={12} />
                      <span>{post.isAnonymous ? "100% Anonim" : "Pengguna Terverifikasi"}</span>
                    </span>

                    <Button
                      size="sm"
                      disabled={isCapacityFull || isOnBreak || isDailyLimitReached}
                      onClick={() => handleOpenClaimModal(post)}
                      className="text-xs bg-pink-600 hover:bg-pink-700 text-white rounded-xl px-4 py-1.5 h-8 font-semibold cursor-pointer shadow-xs gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Heart size={13} />
                      <span>
                        {isOnBreak
                          ? "Sedang Rehat"
                          : isDailyLimitReached
                          ? "Kuota Penuh (4/4)"
                          : isCapacityFull
                          ? "Kapasitas Penuh (2/2)"
                          : "Dengarkan & Respon"}
                      </span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {waitingPosts.length === 0 && (
              <div className="col-span-2 p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                <MessageSquareHeart size={36} className="mx-auto text-slate-300 dark:text-slate-600" />
                <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 font-heading">
                  Belum Ada Curhatan Baru di Antrean
                </h4>
                <p className="text-xs text-slate-500 font-nunito">
                  Semua keluh kesah telah didampingi oleh relawan pendengar. Tetap siaga!
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: RUANG OBROLAN AKTIF */}
      {activeTab === "chat" && activePostData && (
        <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs">
          {/* Header Sesi Aktif */}
          <div className="p-3.5 sm:p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/80 dark:bg-slate-900/90">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-100 to-teal-100 dark:from-pink-950 dark:to-teal-900 text-teal-800 dark:text-teal-200 font-bold text-xs flex items-center justify-center border border-teal-200 dark:border-teal-700 font-heading">
                {activePostData.patientAlias.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white font-heading">
                    {activePostData.patientAlias} (Anonim)
                  </h3>
                  <Badge className="bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-200 text-[10px]">
                    Sesi Berjalan
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-nunito">
                  Topik: {activePostData.topic} • Emosi: {activePostData.emotion}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowEscalateModal(true)}
                className="text-xs border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 hover:bg-rose-50 rounded-xl px-3 h-8 font-semibold cursor-pointer gap-1.5"
              >
                <AlertTriangle size={13} />
                <span className="hidden sm:inline">Rujuk Psikolog</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowEndModal(true)}
                className="text-xs border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 rounded-xl px-3 h-8 font-semibold cursor-pointer"
              >
                Selesaikan Sesi
              </Button>
            </div>
          </div>

          {/* Log Pesan Chat */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/50 dark:bg-slate-900/60">
            {chatMessages.map((msg) => {
              const isMe = msg.sender === "peer_listener";
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? "items-end" : "items-start"} max-w-xl ${
                    isMe ? "ml-auto" : "mr-auto"
                  }`}
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

          {/* Empathy Quick Chips */}
          <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              <Sparkles size={12} className="text-teal-600 dark:text-teal-400" />
              <span>Respon Empatik PFA:</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {empathyQuickPhrases.map((phrase, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setInputMessage(phrase)}
                  className="shrink-0 text-[11px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-teal-400 text-slate-700 dark:text-slate-300 px-3 py-1 rounded-xl transition-all cursor-pointer"
                >
                  "{phrase}"
                </button>
              ))}
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendReply} className="flex items-center gap-2 pt-1">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Tuliskan respon mendengarkan tanpa menghakimi..."
                className="h-10 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl"
              />
              <Button
                type="submit"
                className="h-10 px-5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-xs cursor-pointer gap-1.5"
              >
                <Send size={14} />
                <span className="hidden sm:inline text-xs font-semibold">Kirim</span>
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 1: TANGGAPI CURHATAN & MULAI SESI */}
      <Dialog open={!!postToClaim} onOpenChange={(open) => !open && setPostToClaim(null)}>
        <DialogContent className="max-w-lg p-0 overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 font-nunito bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl">
          <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/60 space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 flex items-center justify-center shrink-0">
                <Heart size={20} />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-700 dark:text-teal-300 text-[10px] font-bold uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                  Konfirmasi Pendampingan Sebaya
                </div>
                <DialogTitle className="text-lg sm:text-xl font-bold font-heading text-slate-900 dark:text-white mt-1">
                  Dengarkan & Balas Curhatan Pasien
                </DialogTitle>
              </div>
            </div>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito leading-relaxed pl-0.5">
              Tanggapan pertamamu akan langsung membuka ruang percakapan dua arah di portal pasien.
            </DialogDescription>
          </div>

          {postToClaim && (
            <div className="p-6 space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                  <span>Dari: {postToClaim.patientAlias} (Anonim)</span>
                  <Badge className={`text-[10px] ${postToClaim.emotionColor}`}>
                    {postToClaim.emotion}
                  </Badge>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 font-nunito italic leading-relaxed">
                  "{postToClaim.content}"
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  Tuliskan Pesan Sambutan Empatik Pertamamu:
                </label>
                <textarea
                  rows={4}
                  value={firstResponseText}
                  onChange={(e) => setFirstResponseText(e.target.value)}
                  placeholder="Ketikkan tanggapan pembuka..."
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 resize-none leading-relaxed"
                />
              </div>

              {claimError && (
                <p className="text-xs text-rose-600 font-semibold">{claimError}</p>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setPostToClaim(null)}
                  className="text-xs text-slate-500 rounded-xl"
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmClaim}
                  className="text-xs bg-pink-600 hover:bg-pink-700 text-white rounded-xl px-5 h-9 font-bold cursor-pointer shadow-xs gap-1.5"
                >
                  <Send size={13} />
                  <span>Kirim Tanggapan & Mulai Sesi</span>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL 2: KONFIRMASI SELESAIKAN SESI */}
      <Dialog open={showEndModal} onOpenChange={setShowEndModal}>
        <DialogContent className="max-w-md font-nunito p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
          <DialogHeader className="space-y-1 pb-3 border-b border-slate-100 dark:border-slate-800">
            <DialogTitle className="text-base font-bold font-heading text-slate-900 dark:text-white">
              Selesaikan Sesi Curhat Sebaya?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Sesi ini akan ditandai selesai dan kuota aktif relawan Anda (1/2) akan dibebaskan kembali.
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-slate-600 dark:text-slate-300 font-nunito leading-relaxed pt-2">
            Pastikan klien sudah merasa lebih tenang atau telah mendapatkan tempat menuangkan keluh kesahnya.
          </p>
          <div className="flex justify-end gap-2 pt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowEndModal(false)}
              className="text-xs rounded-xl"
            >
              Lanjutkan Obrolan
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmEndSession}
              className="text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-xl px-4 font-bold"
            >
              Ya, Selesaikan Sesi
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: ESKALASI KRISIS & RUJUK KE ADMIN / SEJIWA 119 */}
      <Dialog open={showEscalateModal} onOpenChange={setShowEscalateModal}>
        <DialogContent className="max-w-md font-nunito p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
          <DialogHeader className="space-y-1 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <AlertTriangle size={20} className="text-rose-600 animate-pulse" />
              <DialogTitle className="text-base font-bold font-heading text-slate-900 dark:text-white">
                Eskalasi Krisis &amp; Alarm Bahaya
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500">
              Laporan ini langsung diteruskan ke Tim Administrator &amp; Psikolog Klinis Siaga untuk intervensi darurat.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2 text-xs">
            <label className="font-bold text-slate-700 dark:text-slate-300 block">
              Pilih Alasan Indikator Bahaya (Red Flag):
            </label>
            <div className="space-y-1.5">
              {[
                "Indikasi bahaya keselamatan jiwa / ide bunuh diri",
                "Perilaku melukai diri sendiri (self-harm akut)",
                "Ancaman kekerasan fisik dalam rumah tangga",
                "Serangan panik hebat / disosiasi parah",
              ].map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setEscalateReason(reason)}
                  className={`w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer font-medium ${
                    escalateReason === reason
                      ? "border-rose-600 bg-rose-50 dark:bg-rose-950/70 text-rose-900 dark:text-rose-200 font-bold"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50/40 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>

            <div className="space-y-1 pt-1">
              <label className="font-bold text-slate-700 dark:text-slate-300 block">
                Catatan Tambahan Relawan (Opsional):
              </label>
              <textarea
                rows={2}
                placeholder="Tuliskan kata kunci yang disampaikan klien..."
                value={customEscalateNotes}
                onChange={(e) => setCustomEscalateNotes(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowEscalateModal(false)}
              className="text-xs rounded-xl"
            >
              Batal
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (!selectedSessionId) return;
                const fullReason = customEscalateNotes
                  ? `${escalateReason} — ${customEscalateNotes}`
                  : escalateReason;

                reportCrisisIncident(selectedSessionId, fullReason);

                setChatMessages((prev) => [
                  ...prev,
                  {
                    id: `m-esc-${Date.now()}`,
                    sender: "peer_listener",
                    text: "[🚨 PROTOKOL KRISIS DIAKTIFKAN]\nLaporan peringatan telah diteruskan ke Dashboard Administrator TemanBicara & Tim Hotline Nasional SEJIWA 119 ext. 8. Mohon tetap tenang, bantuan medis sedang disiapkan untukmu.",
                    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                  },
                ]);

                setShowEscalateModal(false);
                setCrisisAlertSuccess(true);
                setTimeout(() => setCrisisAlertSuccess(false), 5000);
              }}
              className="text-xs bg-rose-600 hover:bg-rose-700 text-white rounded-xl px-4 font-bold gap-1.5"
            >
              <AlertTriangle size={13} />
              <span>Kirim Peringatan Krisis</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL 4: LATIHAN PERNAPASAN BOX BREATHING UNTUK BURNOUT GUARD */}
      <Dialog open={showBreathingModal} onOpenChange={setShowBreathingModal}>
        <DialogContent className="max-w-md font-nunito p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-center">
          <DialogHeader className="space-y-1 pb-2">
            <DialogTitle className="text-base font-bold font-heading text-slate-900 dark:text-white flex items-center justify-center gap-2">
              <Sparkles size={18} className="text-teal-600 dark:text-teal-400" />
              Latihan Pemulihan Napas (Box Breathing)
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Teknik relaksasi klinis 4-4-4-4 untuk menenangkan sistem saraf parasimpatis relawan.
            </DialogDescription>
          </DialogHeader>

          {/* Visual Breathing Orb */}
          <div className="py-6 flex flex-col items-center justify-center">
            <div
              className={`w-36 h-36 rounded-full flex flex-col items-center justify-center transition-all duration-1000 shadow-xl ${
                breathingPhase === "Tarik Napas"
                  ? "scale-110 bg-teal-500/20 border-4 border-teal-500 text-teal-800 dark:text-teal-200 shadow-teal-500/20"
                  : breathingPhase === "Tahan Napas"
                  ? "scale-110 bg-sky-500/20 border-4 border-sky-500 text-sky-800 dark:text-sky-200 shadow-sky-500/20"
                  : breathingPhase === "Hembuskan"
                  ? "scale-90 bg-indigo-500/20 border-4 border-indigo-500 text-indigo-800 dark:text-indigo-200 shadow-indigo-500/20"
                  : "scale-90 bg-slate-500/10 border-4 border-slate-400 text-slate-700 dark:text-slate-300"
              }`}
            >
              <span className="text-2xl font-bold font-mono">{breathingTimer}s</span>
              <span className="text-xs font-bold uppercase tracking-wider mt-1">{breathingPhase}</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-nunito mt-4 max-w-xs">
              {breathingPhase === "Tarik Napas" && "Tarik napas perlahan lewat hidung hingga paru-paru terisi penuh..."}
              {breathingPhase === "Tahan Napas" && "Tahan napasmu dengan tenang, rasakan keheningan batin..."}
              {breathingPhase === "Hembuskan" && "Hembuskan perlahan lewat mulut, lepaskan semua ketegangan beban emosi..."}
              {breathingPhase === "Jeda Rileks" && "Istirahat sejenak dengan santai sebelum siklus napas berikutnya dimulai..."}
            </p>
          </div>

          <div className="flex justify-center pt-2">
            <Button
              size="sm"
              onClick={() => setShowBreathingModal(false)}
              className="text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-xl px-6 font-bold"
            >
              Selesai &amp; Kembali Tenang
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
