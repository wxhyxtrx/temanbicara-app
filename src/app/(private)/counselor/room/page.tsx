"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
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
  MessageSquare,
  Phone,
  ShieldCheck,
  FileText,
  User,
  HeartPulse,
  Save,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  Send,
  Lock,
  Stethoscope,
  Activity,
  Smile,
  Brain,
  Check,
} from "lucide-react";
import { useChatStore, Message } from "@/store/chat-store";
import { useScheduleStore } from "@/store/schedule-store";
import { CallRoomModal } from "@/components/views/chat-page/call-room-modal";

const clinicalQuickPrompts = [
  "Mari kita ambil jeda napas diafragma 2 menit bersama-sama.",
  "Apa yang kamu rasakan di tubuhmu saat pikiran cemas itu muncul?",
  "Mari kita periksa bukti nyata yang mendukung vs menolak ketakutan tersebut (Teknik CBT).",
  "Pikiranmu bukanlah fakta absolut. Mari beri nama pada emosi tersebut.",
];

export default function CounselorRoomPage() {
  const [mounted, setMounted] = useState(false);
  const {
    conversations,
    messagesByConversation,
    sendCounselorReply,
    clinicalNotes,
    updateClinicalNote,
  } = useChatStore();
  const updateSessionStatus = useScheduleStore((state) => state.updateSessionStatus);

  // Active client session (default to conversation 2: Wahyu Tricahyo)
  const activeConvId = 2;
  const currentConversation = conversations.find((c) => c.id === activeConvId) || conversations[1];
  const currentMessages = messagesByConversation[activeConvId] || [];

  // Chat message input
  const [replyText, setReplyText] = useState("");
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // SOAP notes form state
  const existingNote = clinicalNotes[activeConvId] || {
    s: "Klien melaporkan rasa cemas antisipatif berulang saat pagi sebelum jam kerja.",
    o: "Afek cemas ringan, kontak mata baik, speech rate teratur.",
    a: "F41.1 Ansietas Menyeluruh terkait beban kerja kuartal akhir.",
    p: "Psikoedukasi CBT restrukturisasi pikiran otomatis & latihan napas diafragma.",
    updatedAt: "Hari ini",
  };

  const [soapS, setSoapS] = useState(existingNote.s);
  const [soapO, setSoapO] = useState(existingNote.o);
  const [soapA, setSoapA] = useState(existingNote.a);
  const [soapP, setSoapP] = useState(existingNote.p);
  const [soapSavedMsg, setSoapSavedMsg] = useState(false);

  // Modals
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [showCrisisModal, setShowCrisisModal] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [sessionCompletedMsg, setSessionCompletedMsg] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages]);

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    sendCounselorReply(activeConvId, replyText.trim());
    setReplyText("");
  };

  const handleSaveSoap = () => {
    updateClinicalNote(activeConvId, {
      s: soapS,
      o: soapO,
      a: soapA,
      p: soapP,
    });
    setSoapSavedMsg(true);
    setTimeout(() => setSoapSavedMsg(false), 3000);
  };

  const handleFinishSession = () => {
    // Selesaikan sesi pertama di schedule store
    updateSessionStatus("sch-01", "selesai");
    setShowFinishConfirm(false);
    setSessionCompletedMsg(true);
  };

  return (
    <div className="space-y-4 sm:space-y-6 font-nunito pb-12 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* 1. Clinical Session Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 font-bold text-sm flex items-center justify-center border border-teal-200 dark:border-teal-800 shrink-0 font-heading">
            WT
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold font-heading text-slate-900 dark:text-white truncate">
                Wahyu Tricahyo (Klien Terdaftar)
              </h1>
              <Badge className="bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-200 text-[10px] shrink-0">
                Sesi Berlangsung
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-nunito flex items-center gap-1.5 mt-0.5">
              <Lock size={12} className="text-teal-600 dark:text-teal-400" />
              <span>Ruang Konseling Privat • Terenkripsi Medis Standar HIPAA</span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => setIsCallModalOpen(true)}
            className="text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-xl h-9 px-3.5 font-semibold shadow-2xs gap-1.5 cursor-pointer"
          >
            <Phone size={14} />
            <span>Mulai Voice Call Klinis</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowCrisisModal(true)}
            className="text-xs border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl h-9 px-3 font-semibold cursor-pointer gap-1"
          >
            <HeartPulse size={14} />
            <span>Protokol Krisis</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setShowFinishConfirm(true)}
            className="text-xs bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white rounded-xl h-9 px-3.5 font-semibold cursor-pointer gap-1"
          >
            <CheckCircle2 size={14} className="text-emerald-400" />
            <span>Selesaikan Sesi</span>
          </Button>
        </div>
      </div>

      {sessionCompletedMsg && (
        <div className="flex items-center justify-between gap-2 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>Sesi konseling telah ditandai Selesai. Catatan SOAP telah diarsipkan ke dokumen rekam klien.</span>
          </div>
          <Link href="/counselor/clients">
            <Button size="sm" className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg">
              Buka Berkas Klien
            </Button>
          </Link>
        </div>
      )}

      {/* 2. Dual-Pane: Chat Sesi di Kiri & Catatan SOAP di Kanan */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 min-h-[640px]">
        {/* PANEL KIRI: LIVE CHAT DENGAN PASIEN (7 COLS) */}
        <div className="lg:col-span-7 flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/90">
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-teal-600 dark:text-teal-400" />
              <span className="text-xs font-bold font-heading text-slate-800 dark:text-slate-200">
                Percakapan Langsung dengan Pasien
              </span>
            </div>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Terhubung
            </span>
          </div>

          {/* Quick Prompts Bar */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-teal-50/40 dark:bg-teal-950/20 overflow-x-auto flex gap-1.5 scrollbar-none">
            {clinicalQuickPrompts.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setReplyText(prompt)}
                className="shrink-0 text-[10px] bg-white dark:bg-slate-800 hover:bg-teal-50 border border-teal-200/60 dark:border-teal-800 text-teal-800 dark:text-teal-300 rounded-lg px-2.5 py-1 font-medium transition-colors cursor-pointer text-left"
              >
                + {prompt}
              </button>
            ))}
          </div>

          {/* Message List Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/40 dark:bg-slate-950/40 max-h-[460px]">
            {currentMessages.map((msg: Message) => {
              const isPsychologist = msg.senderRole === "counselor" || msg.sender.includes("Anita");
              return (
                <div
                  key={msg.id}
                  className={`flex ${isPsychologist ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] p-3 rounded-2xl text-xs space-y-1 ${
                      isPsychologist
                        ? "bg-teal-600 text-white rounded-tr-xs shadow-xs"
                        : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700 rounded-tl-xs shadow-2xs"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4 text-[10px] opacity-75 font-mono">
                      <span>{msg.sender}</span>
                      <span>{msg.time}</span>
                    </div>
                    <p className="leading-relaxed font-nunito text-xs sm:text-[13px]">{msg.content}</p>
                  </div>
                </div>
              );
            })}
            <div ref={chatBottomRef} />
          </div>

          {/* Input Box Balasan Psikolog */}
          <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
            <form onSubmit={handleSendReply} className="flex items-center gap-2">
              <Input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Ketik respon atau intervensi terapeutik untuk pasien..."
                className="h-10 text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl"
              />
              <Button
                type="submit"
                disabled={!replyText.trim()}
                className="h-10 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer gap-1.5"
              >
                <Send size={13} />
                <span>Kirim</span>
              </Button>
            </form>
          </div>
        </div>

        {/* PANEL KANAN: REKAM MEDIS & FORMULIR CATATAN SOAP (5 COLS) */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          {/* Card Ringkasan Asesmen Pasien */}
          <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardHeader className="p-3.5 pb-2 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="font-heading text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Activity size={15} className="text-teal-600 dark:text-teal-400" />
                Intake & Asesmen Mandiri Klien (DASS-21)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 space-y-2 text-xs">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                  <span className="text-[10px] text-slate-400 block">Depresi</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">6 (Normal)</span>
                </div>
                <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/60">
                  <span className="text-[10px] text-rose-500 block">Ansietas</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400 text-xs">16 (Tinggi)</span>
                </div>
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/60">
                  <span className="text-[10px] text-amber-500 block">Stres</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400 text-xs">18 (Sedang)</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-nunito leading-snug">
                <strong>Keluhan: </strong> Sering terbangun jam 03.00 pagi dengan palpitasi dan kekhawatiran berlebih terhadap target pekerjaan.
              </p>
            </CardContent>
          </Card>

          {/* Form Catatan SOAP */}
          <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex-1 flex flex-col">
            <CardHeader className="p-3.5 pb-2 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-heading text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <FileText size={15} className="text-teal-600 dark:text-teal-400" />
                  Catatan Kemajuan Sesi (SOAP Note)
                </CardTitle>
                <CardDescription className="text-[10px] text-slate-400">
                  Terakhir diperbarui: {existingNote.updatedAt || "Hari ini"}
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={handleSaveSoap}
                className="h-7 text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-2.5 font-semibold gap-1 cursor-pointer"
              >
                <Save size={12} />
                <span>Simpan</span>
              </Button>
            </CardHeader>

            <CardContent className="p-3.5 space-y-3 flex-1 flex flex-col justify-between text-xs">
              {soapSavedMsg && (
                <div className="flex items-center gap-1.5 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[11px] font-semibold animate-in fade-in">
                  <Check size={13} className="text-emerald-600" />
                  <span>Catatan SOAP tersimpan & terenkripsi.</span>
                </div>
              )}

              <div className="space-y-2.5 flex-1">
                {/* S - Subjective */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-teal-800 dark:text-teal-300 flex items-center gap-1">
                    <span>S (Subjective) - Keluhan Pasien:</span>
                  </label>
                  <textarea
                    rows={2}
                    value={soapS}
                    onChange={(e) => setSoapS(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-teal-500 font-nunito"
                  />
                </div>

                {/* O - Objective */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-teal-800 dark:text-teal-300 flex items-center gap-1">
                    <span>O (Objective) - Observasi Klinis Psikolog:</span>
                  </label>
                  <textarea
                    rows={2}
                    value={soapO}
                    onChange={(e) => setSoapO(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-teal-500 font-nunito"
                  />
                </div>

                {/* A - Assessment */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-teal-800 dark:text-teal-300 flex items-center gap-1">
                    <span>A (Assessment) - Evaluasi & Formulasi CBT:</span>
                  </label>
                  <textarea
                    rows={2}
                    value={soapA}
                    onChange={(e) => setSoapA(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-teal-500 font-nunito"
                  />
                </div>

                {/* P - Plan */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-teal-800 dark:text-teal-300 flex items-center gap-1">
                    <span>P (Plan) - PR Terapi & Tindak Lanjut:</span>
                  </label>
                  <textarea
                    rows={2}
                    value={soapP}
                    onChange={(e) => setSoapP(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-teal-500 font-nunito"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 3. MODAL: CALL ROOM PRIVAT (60 MENIT) */}
      <CallRoomModal
        isOpen={isCallModalOpen}
        onClose={() => setIsCallModalOpen(false)}
        conversation={currentConversation}
      />

      {/* 4. MODAL: PROTOKOL KRISIS & ESKALASI DARURAT */}
      <Dialog open={showCrisisModal} onOpenChange={setShowCrisisModal}>
        <DialogContent className="max-w-md font-nunito p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
          <DialogHeader className="space-y-1 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} />
              </div>
              <div>
                <DialogTitle className="text-base font-bold font-heading text-slate-900 dark:text-white">
                  Protokol Krisis & Rujukan Darurat
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Panduan eskalasi bila klien menunjukkan risiko melukai diri atau kegawatdaruratan
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 pt-2 text-xs">
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-300 space-y-1.5">
              <p className="font-bold">Langkah Tindakan Cepat:</p>
              <ul className="list-disc pl-4 space-y-1 text-[11px]">
                <li>Tetap dampingi klien di saluran komunikasi hingga terkoneksi pihak darurat.</li>
                <li>Arahkan klien ke hotline kementerian kesehatan <strong>SEJIWA: 119 ext. 8</strong>.</li>
                <li>Hubungi kontak darurat yang terdaftar di sistem profil pasien.</li>
              </ul>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
              <p className="font-semibold text-slate-700 dark:text-slate-300">Kontak Darurat Terdaftar Pasien:</p>
              <p className="font-mono text-slate-900 dark:text-white">0811-9876-5432 (Keluarga Terdekat)</p>
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
                className="text-xs h-9 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl px-4 cursor-pointer"
              >
                Eskalasi ke Supervisor Klinis
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
              <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-400 flex items-center justify-center shrink-0">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <DialogTitle className="text-base font-bold font-heading text-slate-900 dark:text-white">
                  Selesaikan Sesi Konseling Ini?
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Konfirmasi pengakhiran konsultasi dan pengarsipan catatan SOAP
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 pt-2 text-xs">
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-nunito">
              Dengan mengklik konfirmasi, sesi bersama <strong>Wahyu Tricahyo</strong> akan ditandai selesai di jadwal dan riwayat pasien. Honor sesi Anda telah masuk dan siap ditarik di menu Payout.
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
                className="text-xs h-9 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl px-4 cursor-pointer"
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
