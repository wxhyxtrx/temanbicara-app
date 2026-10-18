"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScheduleItem, useScheduleStore } from "@/store/schedule-store";
import {
  Calendar as CalendarIcon,
  MessageSquare,
  Phone,
  Clock,
  ShieldCheck,
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Coins,
  Star,
  Sparkles,
  HeartHandshake,
} from "lucide-react";
import { MdVerified } from "react-icons/md";
import Link from "next/link";
import { useReviewStore } from "@/store/review-store";
import { SessionReviewModal } from "./session-review-modal";

interface SessionDetailModalProps {
  session: ScheduleItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function SessionDetailModal({
  session,
  isOpen,
  onClose,
}: SessionDetailModalProps) {
  const rescheduleSession = useScheduleStore((state) => state.rescheduleSession);
  const cancelSession = useScheduleStore((state) => state.cancelSession);
  const hasReviewed = useReviewStore((state) => state.hasReviewed);

  // Sub-dialog view mode: 'detail' | 'reschedule' | 'cancel'
  const [viewMode, setViewMode] = useState<"detail" | "reschedule" | "cancel">("detail");
  const [isReviewOpen, setIsReviewOpen] = useState<boolean>(false);
  
  // Reschedule form states
  const rescheduleDates = [
    "Senin, 19 Oktober 2026",
    "Selasa, 20 Oktober 2026",
    "Rabu, 21 Oktober 2026",
    "Kamis, 22 Oktober 2026",
  ];
  const rescheduleTimes = [
    "10:00 - 11:00 WIB",
    "13:30 - 14:30 WIB",
    "15:00 - 16:00 WIB",
    "19:00 - 20:00 WIB",
  ];
  const [newDate, setNewDate] = useState<string>(rescheduleDates[0]);
  const [newTime, setNewTime] = useState<string>(rescheduleTimes[0]);

  // Cancel form states
  const [cancelReason, setCancelReason] = useState<string>("Kendala jadwal mendadak");
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  if (!session) return null;

  const handleRescheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = rescheduleSession(session.id, newDate, newTime);
    if (ok) {
      setActionNotice(`Jadwal berhasil dipindahkan ke ${newDate} pukul ${newTime}.`);
      setTimeout(() => {
        setActionNotice(null);
        setViewMode("detail");
        onClose();
      }, 1400);
    }
  };

  const handleCancelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = cancelSession(session.id, cancelReason);
    if (res.success) {
      setActionNotice(
        `Sesi berhasil dibatalkan. ${
          res.refundedCoins > 0 ? `${res.refundedCoins} Koin telah dikembalikan ke saldo akun Anda.` : ""
        }`
      );
      setTimeout(() => {
        setActionNotice(null);
        setViewMode("detail");
        onClose();
      }, 1500);
    }
  };

  const renderBadge = () => {
    if (session.status === "terjadwal") {
      return (
        <Badge className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-xs font-semibold py-0.5 px-2.5">
          Terkonfirmasi
        </Badge>
      );
    } else if (session.status === "menunggu") {
      return (
        <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800 text-xs font-semibold py-0.5 px-2.5">
          Menunggu Konfirmasi
        </Badge>
      );
    } else if (session.status === "dibatalkan") {
      return (
        <Badge variant="outline" className="bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-900 text-xs font-semibold py-0.5 px-2.5">
          Dibatalkan
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 text-xs font-semibold py-0.5 px-2.5">
          Selesai
        </Badge>
      );
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-lg max-h-[92vh] overflow-y-auto overflow-x-hidden font-nunito p-4 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-2xl">
        <DialogHeader className="space-y-1 pb-3 border-b border-slate-100 dark:border-slate-800 w-full min-w-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-400 flex items-center justify-center shrink-0">
                <FileText size={16} />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold font-heading text-slate-900 dark:text-white">
                  {viewMode === "detail" ? "Detail Janji Konseling" : viewMode === "reschedule" ? "Reschedule Jadwal" : "Batalkan Sesi"}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                  ID Sesi: {session.id} • Kode Etik Kerahasiaan Medis HIMPSI
                </DialogDescription>
              </div>
            </div>
            {renderBadge()}
          </div>
        </DialogHeader>

        {actionNotice ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 size={30} />
            </div>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 max-w-sm mx-auto leading-relaxed">
              {actionNotice}
            </p>
          </div>
        ) : viewMode === "detail" ? (
          /* VIEW 1: DETAIL SESI */
          <div className="space-y-5 pt-2">
            {/* Profil Psikolog */}
            <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
              <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 font-bold text-sm flex items-center justify-center shrink-0 font-heading border border-teal-200 dark:border-teal-800">
                {session.initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h4 className="font-heading font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                    {session.consultant}
                  </h4>
                  {session.initials !== "TB" && <MdVerified className="text-sky-500 text-sm shrink-0" />}
                </div>
                <p className="text-xs text-teal-700 dark:text-teal-400 font-medium">{session.title}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">SIPPK Terverifikasi • Praktik Klinis Aktif</p>
              </div>
            </div>

            {/* Kotak Jadwal & Metode */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 space-y-1">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Waktu Konseling</span>
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <CalendarIcon size={14} className="text-teal-600 dark:text-teal-400 shrink-0" />
                  <span>{session.date}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                  <Clock size={13} className="text-teal-600 dark:text-teal-400 shrink-0" />
                  <span>{session.time}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 space-y-1">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Metode & Biaya</span>
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                  {session.type === "Voice Call" ? (
                    <Phone size={14} className="text-teal-600 dark:text-teal-400 shrink-0" />
                  ) : (
                    <MessageSquare size={14} className="text-teal-600 dark:text-teal-400 shrink-0" />
                  )}
                  <span>{session.type}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-teal-700 dark:text-teal-400 font-semibold font-mono">
                  <Coins size={13} />
                  <span>{session.coinFee} Koin Konseling</span>
                </div>
              </div>
            </div>

            {/* Topik & Catatan */}
            <div className="space-y-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
              <div>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Topik Konsultasi</span>
                <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{session.topic}</p>
              </div>

              {session.notes && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Catatan Refleksi / Instruksi</span>
                  <p className="text-xs text-slate-600 dark:text-slate-400 italic mt-0.5">"{session.notes}"</p>
                </div>
              )}

              {session.status === "selesai" && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-teal-800 dark:text-teal-300">
                    <Sparkles size={13} className="text-teal-600 dark:text-teal-400" />
                    <span>Panduan & Latihan Mandiri Pasca Sesi:</span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 bg-teal-50/60 dark:bg-teal-950/40 p-2.5 rounded-lg border border-teal-200/80 dark:border-teal-800/60 leading-relaxed font-nunito">
                    Latihan pernapasan diafragma harian 5 menit, restrukturisasi kognitif (CBT thought record), serta penjadwalan aktivitas istirahat berkualitas.
                  </p>
                </div>
              )}

              {session.cancellationReason && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-rose-700 dark:text-rose-400 text-xs">
                  <strong className="font-semibold">Alasan Pembatalan: </strong>
                  <span>{session.cancellationReason}</span>
                </div>
              )}
            </div>

            {/* Aksi Sesi */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                {session.status === "terjadwal" && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setViewMode("reschedule")}
                      className="text-xs border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl h-9 gap-1.5 cursor-pointer"
                    >
                      <RotateCcw size={14} />
                      <span>Reschedule</span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setViewMode("cancel")}
                      className="text-xs border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl h-9 gap-1.5 cursor-pointer"
                    >
                      <XCircle size={14} />
                      <span>Batalkan</span>
                    </Button>
                  </>
                )}

                {session.status === "selesai" && (
                  hasReviewed(session.id) ? (
                    <Badge className="bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800 text-xs py-1.5 px-3 gap-1.5">
                      <Star size={12} className="fill-amber-500 text-amber-500" />
                      <span>Sudah Memberikan Ulasan</span>
                    </Badge>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setIsReviewOpen(true)}
                      className="text-xs bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl h-9 px-3.5 gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <Star size={13} className="fill-white" />
                      <span>Beri Ulasan & Rating</span>
                    </Button>
                  )
                )}
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  className="text-xs border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl h-9 px-4 cursor-pointer"
                >
                  Tutup
                </Button>

                {session.status === "terjadwal" && (
                  <Link href="/patient/room" onClick={onClose}>
                    <Button
                      size="sm"
                      className="text-xs bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl h-9 px-4 gap-1.5 shadow-xs cursor-pointer"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                      <span>Masuk Ruang Sesi</span>
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        ) : viewMode === "reschedule" ? (
          /* VIEW 2: RESCHEDULE FORM */
          <form onSubmit={handleRescheduleSubmit} className="space-y-4 pt-2">
            <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 text-xs">
              <p className="font-semibold">Ketentuan Pemindahan Jadwal:</p>
              <p className="text-[11px] text-teal-700 dark:text-teal-400 mt-0.5 leading-relaxed">
                Reschedule bebas biaya tambahan jika diajukan sebelum waktu sesi dimulai. Silakan pilih slot baru yang tersedia bersama {session.consultant}.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Pilih Tanggal Baru
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {rescheduleDates.map((d) => (
                  <button
                    type="button"
                    key={d}
                    onClick={() => setNewDate(d)}
                    className={`p-2.5 rounded-xl text-xs font-semibold border text-left cursor-pointer transition-all ${
                      newDate === d
                        ? "border-teal-600 bg-teal-50/60 dark:bg-teal-950/60 text-teal-900 dark:text-teal-200 shadow-2xs"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Pilih Jam Slot Baru
              </label>
              <div className="grid grid-cols-2 gap-2">
                {rescheduleTimes.map((t) => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => setNewTime(t)}
                    className={`p-2 rounded-xl text-xs font-semibold border text-center cursor-pointer transition-all ${
                      newTime === t
                        ? "border-teal-600 bg-teal-600 text-white shadow-2xs"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setViewMode("detail")}
                className="text-xs border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl h-9"
              >
                Kembali
              </Button>
              <Button
                type="submit"
                className="text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-xl h-9 px-4 font-semibold shadow-xs"
              >
                Konfirmasi Jadwal Baru
              </Button>
            </div>
          </form>
        ) : (
          /* VIEW 3: CANCELLATION FORM */
          <form onSubmit={handleCancelSubmit} className="space-y-4 pt-2">
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertCircle size={15} className="text-rose-600 dark:text-rose-400" />
                <span>Pengembalian Penuh Koin Saldo</span>
              </p>
              <p className="text-[11px] text-rose-700 dark:text-rose-400 mt-1 leading-relaxed">
                Pembatalan sesi ini akan mengembalikan {session.coinFee} Koin secara instan ke dompet konseling akunmu.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Alasan Pembatalan
              </label>
              {[
                "Kendala jadwal & pekerjaan mendadak",
                "Kondisi kesehatan sedang tidak memungkinkan",
                "Ingin mengganti psikolog atau topik lain",
                "Kebutuhan konseling sudah teratasi",
              ].map((r) => (
                <button
                  type="button"
                  key={r}
                  onClick={() => setCancelReason(r)}
                  className={`w-full p-2.5 rounded-xl text-xs font-medium border text-left cursor-pointer transition-all flex items-center justify-between ${
                    cancelReason === r
                      ? "border-rose-400 bg-rose-50/50 dark:bg-rose-950/50 text-rose-900 dark:text-rose-200 font-semibold"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                  }`}
                >
                  <span>{r}</span>
                  {cancelReason === r && <CheckCircle2 size={14} className="text-rose-600 dark:text-rose-400" />}
                </button>
              ))}
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setViewMode("detail")}
                className="text-xs border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl h-9"
              >
                Kembali
              </Button>
              <Button
                type="submit"
                className="text-xs bg-rose-600 hover:bg-rose-700 text-white rounded-xl h-9 px-4 font-semibold shadow-xs"
              >
                Ya, Batalkan Sesi
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>

    <SessionReviewModal
      session={session}
      isOpen={isReviewOpen}
      onClose={() => setIsReviewOpen(false)}
    />
  </>
);
}
