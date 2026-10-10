"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MessageSquare,
  Phone,
  HeartPulse,
  Save,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Send,
  Lock,
  Activity,
  FileText,
  Check,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  ChevronRight,
  User,
  ShieldCheck,
  ArrowUpRight,
  Tag,
  HelpCircle,
  TrendingDown,
} from "lucide-react";
import { useChatStore, Message, Conversation } from "@/store/chat-store";
import { useScheduleStore } from "@/store/schedule-store";
import { useClinicalRecordsStore } from "@/store/clinical-records-store";
import { CallRoomModal } from "@/components/views/chat-page/call-room-modal";

interface QuickIntervention {
  id: string;
  category: string;
  label: string;
  text: string;
  simulatedReply: string;
}

const quickInterventions: QuickIntervention[] = [
  {
    id: "diaphragm",
    category: "Relaksasi Somatik",
    label: "🌬️ Napas Diafragma 2 Mnt",
    text: "Mari kita ambil jeda napas diafragma 2 menit bersama-sama. Tarik napas 4 detik, tahan 4 detik, dan hembuskan perlahan 6 detik.",
    simulatedReply: "Baik Dok, saya coba ikuti... Tarik napas 4 detik, hembuskan perlahan. Dada mulai terasa agak lebih lega dan tidak seberat tadi.",
  },
  {
    id: "somatic",
    category: "Kesadaran Tubuh",
    label: "🧠 Eksplorasi Sensasi Somatik",
    text: "Apa yang kamu rasakan secara spesifik di tubuhmu saat sensasi cemas itu mulai memuncak di pagi hari?",
    simulatedReply: "Dada terasa seperti diikat tali kencang Dok, telapak tangan saya berkeringat dingin, dan kepala bagian belakang agak tegang.",
  },
  {
    id: "cbt-evidence",
    category: "Restrukturisasi Kognitif",
    label: "⚖️ Uji Bukti Nyata (CBT)",
    text: "Mari kita uji bukti nyata: Apa bukti konkret yang mendukung bahwa kekhawatiranmu pasti terjadi, dan apa fakta yang membuktikan sebaliknya?",
    simulatedReply: "Kalau dipikirkan dengan jernih, selama ini presentasi saya selalu diapresiasi atasan. Kekhawatiran dipecat itu lebih karena pikiran saya yang melebih-lebihkan kemungkinan buruk.",
  },
  {
    id: "grounding",
    category: "Stabilisasi Akut",
    label: "👁️ Grounding 5-4-3-2-1",
    text: "Mari kita grounding indra kita sejenak. Coba sebutkan 5 benda yang kamu lihat di sekitarmu sekarang, dan 4 tekstur yang bisa kamu sentuh.",
    simulatedReply: "Saya melihat laptop, cangkir kopi, buku catatan, jendela, dan jam dinding. Saya menyentuh meja kayu halus dan sandaran kursi.",
  },
  {
    id: "validation",
    category: "Afirmasi Terapeutik",
    label: "🛡️ Validasi & Normalisasi Emosi",
    text: "Reaksi cemas yang kamu alami sangat wajar mengingat tingginya tuntutan kuartal ini. Kamu tidak lemah, sistem sarafmu hanya sedang protektif.",
    simulatedReply: "Mendengar itu membuat saya merasa jauh lebih tenang Dok. Saya sering menyalahkan diri sendiri karena merasa terlalu cemas.",
  },
];

export default function CounselorRoomPage() {
  const [mounted, setMounted] = useState(false);
  const {
    conversations,
    messagesByConversation,
    sendCounselorReply,
    sendPatientSimulationReply,
    clinicalNotes,
    updateClinicalNote,
  } = useChatStore();
  const updateSessionStatus = useScheduleStore((state) => state.updateSessionStatus);
  const saveSoapToRecord = useClinicalRecordsStore((state) => state.saveSoapNote);

  // Active client session (conversation 2: Wahyu Tricahyo)
  const activeConvId = 2;
  const currentMessages = messagesByConversation[activeConvId] || [];

  // Chat message input
  const [replyText, setReplyText] = useState("");
  const [isPatientTyping, setIsPatientTyping] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Session timer (60 minutes cap, 45 mins initial countdown)
  const [secondsRemaining, setSecondsRemaining] = useState<number>(45 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(true);

  // Clinical Tab: "soap" vs "dossier"
  const [activeTab, setActiveTab] = useState<"soap" | "dossier">("soap");

  // SOAP notes form state
  const existingNote = clinicalNotes[activeConvId] || {
    s: "Klien melaporkan rasa cemas antisipatif berulang saat pagi sebelum jam kantor. Mengalami somatic tension (dada sesak ringan, palpitasi). Latihan napas diafragma malam hari cukup membantu onset tidur.",
    o: "Afek cemas ringan, kontak mata baik, speech rate normal. Insight klinis baik (grade 5, sadar akan pola pemicu kecemasan).",
    a: "F41.1 - Gangguan Cemas Menyeluruh dengan kecenderungan catastrophizing terhadap beban kerja kuartal akhir.",
    p: "1. Psikoedukasi CBT restrukturisasi pikiran otomatis (3-column technique).\n2. Latihan grounding 5-4-3-2-1 saat morning routine.\n3. Pertahankan jadwal tidur konsisten jam 23.00.",
    updatedAt: "10 Okt 2026, 14:15 WIB",
  };

  const [soapS, setSoapS] = useState(existingNote.s);
  const [soapO, setSoapO] = useState(existingNote.o);
  const [soapA, setSoapA] = useState(existingNote.a);
  const [soapP, setSoapP] = useState(existingNote.p);
  const [soapSavedMsg, setSoapSavedMsg] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string>(existingNote.updatedAt || "14:15 WIB");

  // Modals
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [showCrisisModal, setShowCrisisModal] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [sessionCompletedMsg, setSessionCompletedMsg] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Timer countdown
  useEffect(() => {
    if (!isTimerRunning || secondsRemaining <= 0) return;
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning, secondsRemaining]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages, isPatientTyping]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const handleSendReply = (customText?: string) => {
    const content = (customText || replyText).trim();
    if (!content) return;

    sendCounselorReply(activeConvId, content);
    if (!customText) setReplyText("");

    // Realistic patient response simulation
    const matchedPrompt = quickInterventions.find((item) =>
      content.toLowerCase().includes(item.label.slice(3).toLowerCase().slice(0, 8)) ||
      item.text.slice(0, 20) === content.slice(0, 20)
    );

    setIsPatientTyping(true);
    setTimeout(() => {
      setIsPatientTyping(false);
      const simulatedText = matchedPrompt
        ? matchedPrompt.simulatedReply
        : "Baik Dok, saya pahami penjelasannya. Saya akan coba perhatikan pikiran itu perlahan dan mempraktikkan arahannya.";
      sendPatientSimulationReply(activeConvId, simulatedText);
    }, 2200);
  };

  const handleApplyQuickPrompt = (intervention: QuickIntervention) => {
    handleSendReply(intervention.text);
  };

  const handleSaveSoap = () => {
    const timeString = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " WIB";
    updateClinicalNote(activeConvId, {
      s: soapS,
      o: soapO,
      a: soapA,
      p: soapP,
    });
    saveSoapToRecord("cl-wahyu", {
      sessionNumber: 3,
      s: soapS,
      o: soapO,
      a: soapA,
      p: soapP,
    });
    setLastSavedTime(timeString);
    setSoapSavedMsg(true);
    setTimeout(() => setSoapSavedMsg(false), 3500);
  };

  const handleFinishSession = () => {
    handleSaveSoap();
    updateSessionStatus("sch-01", "selesai");
    setShowFinishConfirm(false);
    setSessionCompletedMsg(true);
  };

  // Patient profile for Call Room Modal
  const patientConversationForCall: Conversation = {
    id: activeConvId,
    name: "Wahyu Tricahyo",
    role: "Klien Terdaftar (Sesi #3)",
    specialty: "Keluhan: Anticipatory Anxiety & Burnout",
    initials: "WT",
    lastMessage: "",
    time: "Aktif",
    unread: 0,
    isAI: false,
    statusText: "Terkoneksi Ruang Konseling",
    online: true,
  };

  if (!mounted) {
    return <div className="p-6 text-sm text-slate-500 font-nunito">Memuat ruang telekonseling...</div>;
  }

  return (
    <div className="space-y-4 font-nunito pb-12 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* 1. CLINICAL COMMAND BAR (Single Unified Header, No Redundant Stacks) */}
      <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs">
        {/* Left: Patient Identifier */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <div className="w-11 h-11 rounded-xl bg-teal-800 dark:bg-teal-700 text-teal-50 font-bold text-sm flex items-center justify-center font-heading border border-teal-600/40 shadow-xs">
              WT
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-bold font-heading text-slate-900 dark:text-white tracking-tight truncate">
                Wahyu Tricahyo
              </h1>
              <span className="text-xs text-slate-400 font-medium">(27 th)</span>
              <Badge className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 text-[10px] py-0 px-2 font-medium">
                Sesi #3 · CBT Ansietas
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
              <span>Rekam Medis: #TB-2026-094</span>
              <span>•</span>
              <span className="flex items-center gap-1 text-teal-700 dark:text-teal-400 font-sans font-medium">
                <Lock size={11} /> Enkripsi HIPAA / HIMPSI
              </span>
            </p>
          </div>
        </div>

        {/* Center & Right: Integrated Live Timer & Session Actions */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 pt-2 xl:pt-0 border-t xl:border-t-0 border-slate-100 dark:border-slate-800">
          {/* Live Synchronized Timer Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <div className="flex items-center gap-1.5 font-mono font-bold text-slate-800 dark:text-slate-200">
              <Clock size={13} className="text-teal-600 dark:text-teal-400" />
              <span>{formatTimer(secondsRemaining)}</span>
            </div>
            <span className="text-[11px] text-slate-400 font-nunito hidden sm:inline">
              (Batas 60 Menit)
            </span>
            <button
              type="button"
              onClick={() => setIsTimerRunning(!isTimerRunning)}
              title={isTimerRunning ? "Jeda timer" : "Lanjutkan timer"}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5 rounded transition-colors ml-1 cursor-pointer"
            >
              {isTimerRunning ? <Pause size={12} /> : <Play size={12} />}
            </button>
          </div>

          {/* Action: Voice Call */}
          <Button
            size="sm"
            onClick={() => setIsCallModalOpen(true)}
            className="text-xs bg-teal-700 hover:bg-teal-800 text-white rounded-xl h-9 px-3.5 font-semibold shadow-2xs gap-1.5 cursor-pointer"
          >
            <Phone size={13} />
            <span>Voice Call Klinis</span>
          </Button>

          {/* Action: Protokol Krisis */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowCrisisModal(true)}
            className="text-xs border-rose-200 dark:border-rose-900/80 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl h-9 px-3 font-semibold cursor-pointer gap-1.5"
          >
            <HeartPulse size={14} className="text-rose-600" />
            <span>Protokol Krisis</span>
          </Button>

          {/* Action: Akhiri Sesi */}
          <Button
            size="sm"
            onClick={() => setShowFinishConfirm(true)}
            className="text-xs bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white rounded-xl h-9 px-3.5 font-semibold cursor-pointer gap-1.5"
          >
            <CheckCircle2 size={14} className="text-emerald-400" />
            <span>Akhiri Sesi</span>
          </Button>
        </div>
      </header>

      {/* Session Completed Alert Banner */}
      {sessionCompletedMsg && (
        <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-semibold animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>Sesi konseling telah selesai. Catatan SOAP telah diarsipkan otomatis ke berkas rekam medis klien.</span>
          </div>
          <Link href="/counselor/clients">
            <Button size="sm" className="h-7 text-[11px] bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl">
              Buka Berkas Klien
            </Button>
          </Link>
        </div>
      )}

      {/* 2. DUAL-PANE CLINICAL WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 min-h-[660px]">
        {/* PANEL KIRI: DIALOG KLINIS TERAPEUTIK (7 COLS) */}
        <div className="lg:col-span-7 flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs overflow-hidden">
          {/* Header Dialog */}
          <div className="p-3 sm:px-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-900/90">
            <div className="flex items-center gap-2">
              <MessageSquare size={15} className="text-teal-700 dark:text-teal-400" />
              <span className="text-xs font-bold font-heading text-slate-800 dark:text-slate-200">
                Percakapan Langsung dengan Pasien
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Terhubung
              </span>
            </div>
          </div>

          {/* Intervensi Klinis Cepat (Quick Clinical Interventions) */}
          <div className="p-2 sm:px-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/50">
            <div className="flex items-center justify-between gap-2 mb-1.5 px-1">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Sparkles size={11} className="text-teal-600" /> Panduan Intervensi Terapeutik Cepat
              </span>
              <span className="text-[10px] text-slate-400">Klik untuk mengirim ke pasien</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {quickInterventions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleApplyQuickPrompt(item)}
                  className="text-[11px] bg-white dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950/50 border border-slate-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-700 text-slate-700 dark:text-slate-200 rounded-lg px-2.5 py-1 font-medium transition-all cursor-pointer shadow-2xs flex items-center gap-1 text-left"
                >
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Stream Pesan Dialog */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/30 dark:bg-slate-950/30 max-h-[480px]">
            {/* Sesi Dimulai Divider */}
            <div className="flex items-center justify-center my-1">
              <span className="text-[10px] font-mono text-slate-400 bg-white dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200/80 dark:border-slate-700 shadow-2xs">
                Hari ini, 10 Okt 2026 · Sesi Konseling Aktif
              </span>
            </div>

            {currentMessages.map((msg: Message, idx: number) => {
              const isPsychologist = msg.senderRole === "counselor" || msg.sender.includes("Anita");
              const prevMsg = currentMessages[idx - 1];
              const prevSender = prevMsg ? (prevMsg.senderRole === "counselor" || prevMsg.sender.includes("Anita")) : null;
              const isConsecutive = prevSender === isPsychologist;

              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2 ${isPsychologist ? "justify-end" : "justify-start"}`}
                >
                  {/* Avatar Pasien untuk cluster pesan klien */}
                  {!isPsychologist && (
                    <div className="w-7 h-7 rounded-lg bg-teal-800 text-teal-100 font-bold text-[10px] flex items-center justify-center shrink-0 mb-0.5">
                      WT
                    </div>
                  )}

                  <div
                    className={`max-w-[82%] sm:max-w-[75%] p-3 rounded-2xl text-xs space-y-1 transition-all ${
                      isPsychologist
                        ? "bg-slate-900 dark:bg-slate-800 text-slate-50 rounded-br-xs border border-slate-800 dark:border-slate-700 shadow-xs"
                        : "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200/90 dark:border-slate-800 rounded-bl-xs shadow-2xs"
                    }`}
                  >
                    {/* Header Pengirim hanya jika bukan pesan beruntun */}
                    {!isConsecutive && (
                      <div className="flex items-center justify-between gap-3 text-[10px] font-medium pb-0.5 border-b border-black/5 dark:border-white/5">
                        <span className={isPsychologist ? "text-teal-300 font-semibold" : "text-slate-600 dark:text-slate-300 font-bold"}>
                          {isPsychologist ? "Dr. Anita Wijaya, M.Psi. (Anda)" : "Wahyu Tricahyo (Klien)"}
                        </span>
                        <span className="font-mono opacity-70 text-[9px]">{msg.time}</span>
                      </div>
                    )}

                    <p className="leading-relaxed font-nunito text-[12.5px] sm:text-[13px] whitespace-pre-wrap">
                      {msg.content}
                    </p>

                    {isConsecutive && (
                      <div className="text-right text-[9px] font-mono opacity-60 pt-0.5">
                        {msg.time}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Simulasi Indikator Mengetik Pasien */}
            {isPatientTyping && (
              <div className="flex items-end gap-2 justify-start animate-in fade-in">
                <div className="w-7 h-7 rounded-lg bg-teal-800 text-teal-100 font-bold text-[10px] flex items-center justify-center shrink-0">
                  WT
                </div>
                <div className="p-2.5 px-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 rounded-bl-xs shadow-2xs flex items-center gap-1.5">
                  <span className="text-[11px] font-medium">Wahyu sedang mengetik respons</span>
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </span>
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* Input Box Balasan Psikolog */}
          <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendReply();
              }}
              className="flex items-center gap-2"
            >
              <Input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Tulis intervensi klinis, panduan relaksasi, atau arahan untuk pasien..."
                className="h-10 text-xs bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 rounded-xl focus-visible:ring-teal-600"
              />
              <Button
                type="submit"
                disabled={!replyText.trim() || isPatientTyping}
                className="h-10 px-4 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer gap-1.5 shrink-0"
              >
                <Send size={13} />
                <span>Kirim</span>
              </Button>
            </form>
          </div>
        </div>

        {/* PANEL KANAN: DOKUMENTASI KLINIS & BERKAS KLIEN (5 COLS) */}
        <div className="lg:col-span-5 flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs overflow-hidden">
          {/* Segmented Control Header (Tab Switcher) */}
          <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90 flex items-center justify-between">
            <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-slate-800 p-0.5 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab("soap")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "soap"
                    ? "bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <FileText size={13} />
                <span>Catatan SOAP Sesi</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("dossier")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "dossier"
                    ? "bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Activity size={13} />
                <span>Berkas & Riwayat Klien</span>
              </button>
            </div>

            {activeTab === "soap" && (
              <Button
                size="sm"
                onClick={handleSaveSoap}
                className="h-8 text-xs bg-teal-700 hover:bg-teal-800 text-white rounded-xl px-3 font-semibold gap-1.5 cursor-pointer shadow-2xs"
              >
                <Save size={12} />
                <span>Simpan</span>
              </Button>
            )}
          </div>

          {/* TAB 1: LEMBAR CATATAN SOAP */}
          {activeTab === "soap" && (
            <div className="flex-1 p-4 space-y-3.5 overflow-y-auto max-h-[580px]">
              {/* Header Status SOAP */}
              <div className="flex items-center justify-between text-[11px] pb-1 border-b border-slate-100 dark:border-slate-800">
                <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <ShieldCheck size={13} className="text-teal-600" />
                  Format Standar SOAP (HIMPSI)
                </span>
                <span className="text-slate-400 font-mono text-[10px]">
                  Terakhir disimpan: {lastSavedTime}
                </span>
              </div>

              {soapSavedMsg && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold animate-in fade-in">
                  <Check size={14} className="text-emerald-600 shrink-0" />
                  <span>Catatan SOAP berhasil disimpan dan diarsipkan ke Rekam Medis Klien.</span>
                </div>
              )}

              {/* S: Subjective */}
              <div className="space-y-1.5 p-3 rounded-xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-teal-900 dark:text-teal-300 flex items-center gap-1.5 font-heading">
                    <span className="w-5 h-5 rounded-md bg-teal-100 dark:bg-teal-900/80 text-teal-800 dark:text-teal-300 text-[11px] flex items-center justify-center font-mono">
                      S
                    </span>
                    <span>Subjective (Keluhan Utama & Afek Pasien)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setSoapS((prev) => prev + " Pasien juga melaporkan sensasi tegang di leher.")}
                    className="text-[10px] text-teal-700 dark:text-teal-400 hover:underline font-medium cursor-pointer"
                  >
                    + Tag Somatisasi
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={soapS}
                  onChange={(e) => setSoapS(e.target.value)}
                  placeholder="Keluhan subjektif, sensasi fisik yang dirasakan klien, narasi stres..."
                  className="w-full text-xs p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-teal-600 font-nunito leading-relaxed resize-none"
                />
              </div>

              {/* O: Objective */}
              <div className="space-y-1.5 p-3 rounded-xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-teal-900 dark:text-teal-300 flex items-center gap-1.5 font-heading">
                    <span className="w-5 h-5 rounded-md bg-teal-100 dark:bg-teal-900/80 text-teal-800 dark:text-teal-300 text-[11px] flex items-center justify-center font-mono">
                      O
                    </span>
                    <span>Objective (Observasi Klinis Psikolog)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setSoapO((prev) => prev + " Pasien kooperatif dan responsif terhadap arahan.")}
                    className="text-[10px] text-teal-700 dark:text-teal-400 hover:underline font-medium cursor-pointer"
                  >
                    + Tag Observasi
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={soapO}
                  onChange={(e) => setSoapO(e.target.value)}
                  placeholder="Kontak mata, pola intonasi, konsistensi emosi, insight klinis..."
                  className="w-full text-xs p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-teal-600 font-nunito leading-relaxed resize-none"
                />
              </div>

              {/* A: Assessment */}
              <div className="space-y-1.5 p-3 rounded-xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-teal-900 dark:text-teal-300 flex items-center gap-1.5 font-heading">
                    <span className="w-5 h-5 rounded-md bg-teal-100 dark:bg-teal-900/80 text-teal-800 dark:text-teal-300 text-[11px] flex items-center justify-center font-mono">
                      A
                    </span>
                    <span>Assessment (Formulasi Diagnosis & Dinamika CBT)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setSoapA((prev) => prev + " Pola distorsi pikiran: Catastrophizing.")}
                    className="text-[10px] text-teal-700 dark:text-teal-400 hover:underline font-medium cursor-pointer"
                  >
                    + Tag Diagnostik
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={soapA}
                  onChange={(e) => setSoapA(e.target.value)}
                  placeholder="Kode diagnosis ICD-10, formulasi pikiran otomatis, dinamika kecemasan..."
                  className="w-full text-xs p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-teal-600 font-nunito leading-relaxed resize-none"
                />
              </div>

              {/* P: Plan */}
              <div className="space-y-1.5 p-3 rounded-xl bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-teal-900 dark:text-teal-300 flex items-center gap-1.5 font-heading">
                    <span className="w-5 h-5 rounded-md bg-teal-100 dark:bg-teal-900/80 text-teal-800 dark:text-teal-300 text-[11px] flex items-center justify-center font-mono">
                      P
                    </span>
                    <span>Plan (Tugas Mandiri / PR Terapi & Sesi Lanjutan)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setSoapP((prev) => prev + "\n4. Jaga jadwal istirahat rutin.")}
                    className="text-[10px] text-teal-700 dark:text-teal-400 hover:underline font-medium cursor-pointer"
                  >
                    + Tambah PR
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={soapP}
                  onChange={(e) => setSoapP(e.target.value)}
                  placeholder="Latihan yang harus dijalankan klien, tugas jurnal 3-kolom, rencana sesi berikutnya..."
                  className="w-full text-xs p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-teal-600 font-nunito leading-relaxed resize-none"
                />
              </div>
            </div>
          )}

          {/* TAB 2: BERKAS & RIWAYAT KLIEN */}
          {activeTab === "dossier" && (
            <div className="flex-1 p-4 space-y-4 overflow-y-auto max-h-[580px]">
              {/* Profil Singkat */}
              <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold font-heading text-slate-800 dark:text-slate-200">
                    Biodata Intake Pasien
                  </span>
                  <Badge className="bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border-teal-200 text-[10px]">
                    Klien Aktif
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Pekerjaan:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">Software Engineer (Tech Startup)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Sesi Terlaksana:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">2 dari 6 sesi terencana</span>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-slate-200/60 dark:border-slate-700">
                    <span className="text-slate-400 block text-[10px]">Kontak Darurat Terverifikasi:</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">0811-9876-5432 (Istri - Ny. Rina Tricahyo)</span>
                  </div>
                </div>
              </div>

              {/* Target & Fokus Klinis Pasien */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold font-heading text-slate-900 dark:text-white flex items-center gap-1.5">
                    <HeartPulse size={14} className="text-teal-600" />
                    Fokus Klinis & Target Konseling
                  </span>
                  <Badge className="bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border-teal-200 text-[10px]">
                    CBT Aktif
                  </Badge>
                </div>

                <div className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                  <p>
                    <strong className="text-slate-800 dark:text-slate-200">Diagnosis Kerja: </strong>
                    F41.1 Ansietas Menyeluruh & Work-related Burnout
                  </p>
                  <p>
                    <strong className="text-slate-800 dark:text-slate-200">Keluhan Utama: </strong>
                    Sering terbangun jam 03.00 pagi dengan palpitasi dan kekhawatiran berlebih terhadap target pekerjaan.
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                    Sasaran Intervensi Sesi Ini:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                      ✓ Restrukturisasi Pikiran Otomatis (CBT)
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                      ✓ Regulasi Napas Diafragma
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                      ✓ Boundary Setting Jam Kerja
                    </span>
                  </div>
                </div>
              </div>

              {/* Riwayat Sesi Terdahulu */}
              <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 space-y-2.5">
                <span className="text-xs font-bold font-heading text-slate-800 dark:text-slate-200 block">
                  Ringkasan Sesi Terdahulu
                </span>

                <div className="space-y-2 text-[11px]">
                  <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                      <span className="font-bold text-slate-700 dark:text-slate-300">Sesi #2 (3 Okt 2026)</span>
                      <span>14:00 WIB</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">
                      Formulasi akumulasi stres kerja fase 3. Dilatihkan boundary setting aktif dan latihan pernapasan kotak 4-4-4-4.
                    </p>
                  </div>

                  <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                      <span className="font-bold text-slate-700 dark:text-slate-300">Sesi #1 (26 Sep 2026)</span>
                      <span>14:00 WIB</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">
                      Initial assessment. Skrining insomnia dan ketegangan somatis. Edukasi Sleep Hygiene terstruktur.
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                  <Link href="/counselor/clients">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs h-8 rounded-xl font-semibold border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/40 gap-1.5 cursor-pointer"
                    >
                      <span>Buka Rekam Medis Klien Lengkap</span>
                      <ArrowUpRight size={13} />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. MODAL: CALL ROOM PRIVAT (60 MENIT) */}
      <CallRoomModal
        isOpen={isCallModalOpen}
        onClose={() => setIsCallModalOpen(false)}
        conversation={patientConversationForCall}
      />

      {/* 4. MODAL: PROTOKOL KRISIS & ESKALASI DARURAT */}
      <Dialog open={showCrisisModal} onOpenChange={setShowCrisisModal}>
        <DialogContent className="max-w-md font-nunito p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
          <DialogHeader className="space-y-1 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} />
              </div>
              <div>
                <DialogTitle className="text-base font-bold font-heading text-slate-900 dark:text-white">
                  Protokol Krisis & Rujukan Darurat
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Panduan eskalasi kegawatdaruratan psikiatris & risiko melukai diri
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 pt-2 text-xs">
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-300 space-y-1.5">
              <p className="font-bold">Langkah Tindakan Cepat:</p>
              <ul className="list-disc pl-4 space-y-1 text-[11px]">
                <li>Tetap dampingi klien di sesi tanpa memutus komunikasi secara sepihak.</li>
                <li>Arahkan klien ke Hotline Kemenkes <strong>SEJIWA: 119 ext. 8</strong>.</li>
                <li>Hubungi kontak darurat keluarga terdaftar di bawah.</li>
              </ul>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
              <p className="font-semibold text-slate-700 dark:text-slate-300">Kontak Darurat Terdaftar Pasien:</p>
              <p className="font-mono text-slate-900 dark:text-white">0811-9876-5432 (Istri - Ny. Rina Tricahyo)</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCrisisModal(false)}
                className="text-xs h-9 rounded-xl px-4 cursor-pointer"
              >
                Tutup
              </Button>
              <Button
                type="button"
                onClick={() => {
                  alert("Protokol eskalasi darurat telah dicatat ke tim audit medis TemanBicara.");
                  setShowCrisisModal(false);
                }}
                className="text-xs h-9 bg-rose-700 hover:bg-rose-800 text-white font-semibold rounded-xl px-4 cursor-pointer"
              >
                Eskalasi ke Supervisor Medis
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 5. MODAL: KONFIRMASI PENYELESAIAN SESI */}
      <Dialog open={showFinishConfirm} onOpenChange={setShowFinishConfirm}>
        <DialogContent className="max-w-md font-nunito p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
          <DialogHeader className="space-y-1 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-400 flex items-center justify-center shrink-0">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <DialogTitle className="text-base font-bold font-heading text-slate-900 dark:text-white">
                  Akhiri & Arsipkan Sesi Konseling Ini?
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Konfirmasi pengakhiran konsultasi dan sinkronisasi catatan SOAP
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 pt-2 text-xs">
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-nunito">
              Dengan mengakhiri sesi, konsultasi bersama <strong>Wahyu Tricahyo</strong> akan ditandai selesai. Catatan SOAP akan otomatis diperbarui ke berkas rekam medis, dan honor sesi akan dicatat di dompet penarikan Anda.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowFinishConfirm(false)}
                className="text-xs h-9 rounded-xl px-4 cursor-pointer"
              >
                Lanjutkan Sesi
              </Button>
              <Button
                type="button"
                onClick={handleFinishSession}
                className="text-xs h-9 bg-teal-700 hover:bg-teal-800 text-white font-semibold rounded-xl px-4 cursor-pointer"
              >
                Konfirmasi Selesai
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
