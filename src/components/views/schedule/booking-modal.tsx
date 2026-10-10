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
import { Input } from "@/components/ui/input";
import { verifiedConsultants, Consultant } from "@/constant/beranda";
import { useUserStore } from "@/store/user-store";
import { useScheduleStore, BookingPayload } from "@/store/schedule-store";
import {
  Calendar as CalendarIcon,
  MessageSquare,
  Phone,
  Clock,
  ShieldCheck,
  Sparkles,
  Coins,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import { MdVerified } from "react-icons/md";
import Link from "next/link";
import { notify } from "@/lib/toast";

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialConsultantId?: number;
  onSuccess?: () => void;
}

export function BookingModal({
  isOpen,
  onClose,
  initialConsultantId,
  onSuccess,
}: BookingModalProps) {
  const user = useUserStore((state) => state.user);
  const bookSession = useScheduleStore((state) => state.bookSession);

  // Form states
  const [selectedConsultantId, setSelectedConsultantId] = useState<number>(
    initialConsultantId || verifiedConsultants[0].id
  );
  const [selectedType, setSelectedType] = useState<"Chat Eksklusif" | "Voice Call">("Chat Eksklusif");
  
  // Available dates for booking
  const dates = [
    { label: "Besok", full: "Selasa, 06 Oktober 2026", dateStr: "06 Okt" },
    { label: "Lusa", full: "Rabu, 07 Oktober 2026", dateStr: "07 Okt" },
    { label: "Kamis", full: "Kamis, 08 Oktober 2026", dateStr: "08 Okt" },
    { label: "Jumat", full: "Jumat, 09 Oktober 2026", dateStr: "09 Okt" },
    { label: "Sabtu", full: "Sabtu, 10 Oktober 2026", dateStr: "10 Okt" },
  ];
  const [selectedDate, setSelectedDate] = useState<string>(dates[0].full);

  // Available time slots
  const timeSlots = [
    "09:00 - 10:00 WIB",
    "10:30 - 11:30 WIB",
    "13:30 - 14:30 WIB",
    "15:00 - 16:00 WIB",
    "16:30 - 17:30 WIB",
    "19:00 - 20:00 WIB",
  ];
  const [selectedTime, setSelectedTime] = useState<string>(timeSlots[1]);
  const [topic, setTopic] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Feedback states
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  // Service options with pricing: Call 5 koin / jam, Chat 15 koin
  const serviceOptions = [
    {
      type: "Chat Eksklusif" as const,
      fee: 15,
      duration: "60 Menit",
      icon: <MessageSquare size={16} className="text-teal-600 dark:text-teal-400" />,
      desc: "Konseling chat privat terenkripsi real-time",
    },
    {
      type: "Voice Call" as const,
      fee: 5,
      duration: "60 Menit (1 Jam)",
      icon: <Phone size={16} className="text-teal-600 dark:text-teal-400" />,
      desc: "Panggilan suara privat bersama psikolog (5 koin / jam)",
    },
  ];

  const currentService = serviceOptions.find((s) => s.type === selectedType) || serviceOptions[0];
  const selectedConsultant =
    verifiedConsultants.find((c) => c.id === selectedConsultantId) || verifiedConsultants[0];

  const currentCoins = user.coins;
  const coinFee = currentService.fee;
  const isBalanceSufficient = currentCoins >= coinFee;
  const remainingCoins = currentCoins - coinFee;

  const handleBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!isBalanceSufficient) {
      setErrorMessage(`Saldo koinmu (${currentCoins} Koin) tidak mencukupi untuk sesi ini (${coinFee} Koin). Silakan lakukan top-up.`);
      return;
    }

    setSubmitting(true);

    const payload: BookingPayload = {
      consultantId: selectedConsultant.id,
      consultantName: selectedConsultant.name,
      consultantTitle: selectedConsultant.title,
      consultantInitials: selectedConsultant.initials,
      date: selectedDate,
      time: selectedTime,
      type: selectedType,
      topic: topic.trim() || "Sesi Konseling Privat Terbimbing",
      coinFee: coinFee,
      notes: notes.trim(),
    };

    setTimeout(() => {
      const result = bookSession(payload);
      setSubmitting(false);

      if (result.success) {
        notify.success(
          "Jadwal Konseling Terkonfirmasi!",
          `Sesi bersama ${selectedConsultant.name} pada ${selectedDate} (${selectedTime}) berhasil dijadwalkan.`
        );
        setSuccessInfo(`Sesi bersama ${selectedConsultant.name} berhasil dijadwalkan.`);
        if (onSuccess) onSuccess();
        setTimeout(() => {
          setSuccessInfo(null);
          onClose();
        }, 1500);
      } else {
        notify.error("Gagal Menjadwalkan Sesi", result.error || "Saldo koin tidak mencukupi.");
        setErrorMessage(result.error || "Gagal menjadwalkan sesi. Silakan coba kembali.");
      }
    }, 600);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl font-nunito p-4 sm:p-6 rounded-2xl max-h-[92vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
        <DialogHeader className="space-y-1 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-400 flex items-center justify-center shrink-0">
              <CalendarIcon size={17} />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold font-heading text-slate-900 dark:text-white">
                Reservasi Jadwal Konseling Psikolog
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                Pilih psikolog berlisensi SIPPK, waktu konsultasi, dan metode komunikasi
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {successInfo ? (
          <div className="py-10 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto animate-in zoom-in-75">
              <CheckCircle2 size={32} />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Reservasi Berhasil!</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">{successInfo}</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleBookingSubmit} className="space-y-5 pt-1">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <AlertCircle size={15} className="text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
                <Link href="/patient/top-up" onClick={onClose}>
                  <Button size="sm" type="button" className="h-7 text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg px-2.5">
                    Top Up
                  </Button>
                </Link>
              </div>
            )}

            {/* 1. Pilih Psikolog */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <span>1. Pilih Psikolog Klinis</span>
                <span className="text-[10px] text-teal-600 dark:text-teal-400 font-normal lowercase">(berlisensi resmi)</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {verifiedConsultants.map((c: Consultant) => {
                  const isSelected = selectedConsultantId === c.id;
                  return (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => setSelectedConsultantId(c.id)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                        isSelected
                          ? "border-teal-600 bg-teal-50/60 dark:bg-teal-950/60 shadow-2xs ring-1 ring-teal-500"
                          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 font-bold text-xs flex items-center justify-center shrink-0 font-heading">
                          {c.initials}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-xs text-slate-900 dark:text-white font-heading truncate">
                            {c.name}
                          </p>
                          <p className="text-[10px] text-teal-700 dark:text-teal-400 font-medium truncate">
                            {c.specialty}
                          </p>
                        </div>
                      </div>

                      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">{c.licenseNumber}</span>
                        <span>⭐ {c.rating}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Metode Konseling */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                2. Metode Konseling & Biaya
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {serviceOptions.map((srv) => {
                  const isSelected = selectedType === srv.type;
                  return (
                    <button
                      type="button"
                      key={srv.type}
                      onClick={() => setSelectedType(srv.type)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? "border-teal-600 bg-teal-50/60 dark:bg-teal-950/60 shadow-2xs ring-1 ring-teal-500"
                          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white">
                            {srv.icon}
                            <span>{srv.type}</span>
                          </div>
                          <Badge className="bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 hover:bg-teal-100 text-[10px] font-mono font-bold">
                            {srv.fee} Koin
                          </Badge>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                          {srv.desc}
                        </p>
                      </div>
                      <span className="text-[10px] text-teal-700 dark:text-teal-400 font-semibold mt-2">
                        Durasi: {srv.duration}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Tanggal & Jam Slot */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                3. Pilih Tanggal & Waktu Praktik
              </label>

              {/* Tanggal Chips */}
              <div className="flex flex-wrap gap-2">
                {dates.map((d) => {
                  const isSelected = selectedDate === d.full;
                  return (
                    <button
                      type="button"
                      key={d.full}
                      onClick={() => setSelectedDate(d.full)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                        isSelected
                          ? "bg-teal-700 text-white border-teal-700 shadow-2xs"
                          : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                      }`}
                    >
                      <span>{d.label}</span>
                      <span className="opacity-75 text-[10px] ml-1">({d.dateStr})</span>
                    </button>
                  );
                })}
              </div>

              {/* Jam Slot Chips */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                {timeSlots.map((slot) => {
                  const isSelected = selectedTime === slot;
                  return (
                    <button
                      type="button"
                      key={slot}
                      onClick={() => setSelectedTime(slot)}
                      className={`p-2 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        isSelected
                          ? "bg-teal-600 text-white border-teal-600 font-semibold shadow-2xs"
                          : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                      }`}
                    >
                      <Clock size={12} className={isSelected ? "text-white" : "text-teal-600 dark:text-teal-400"} />
                      <span>{slot}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Topik & Catatan */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                4. Fokus Masalah / Topik Konseling
              </label>
              <Input
                placeholder="Contoh: Mengatasi burnout kerja, kecemasan berlebih, pola tidur"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="h-9 text-xs sm:text-sm bg-slate-50/50 dark:bg-slate-800/60 dark:text-slate-100 border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>

            {/* 5. Konfirmasi Saldo Koin */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700/80 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400">Saldo Koin Anda:</span>
                <span className="font-bold text-slate-900 dark:text-white font-mono">{currentCoins} Koin</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400">Biaya Sesi ({selectedType}):</span>
                <span className="font-bold text-teal-800 dark:text-teal-300 font-mono">- {coinFee} Koin</span>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-800 dark:text-slate-200">Sisa Saldo Setelah Reservasi:</span>
                <span className={`font-mono ${isBalanceSufficient ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400 font-bold"}`}>
                  {isBalanceSufficient ? `${remainingCoins} Koin` : "Saldo Kurang"}
                </span>
              </div>
            </div>

            {/* Tombol Aksi */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="text-xs border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl h-9 px-4 cursor-pointer"
              >
                Batal
              </Button>

              <Button
                type="submit"
                disabled={submitting || !isBalanceSufficient}
                className="text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-xl h-9 px-5 font-semibold shadow-xs cursor-pointer gap-1.5"
              >
                {submitting ? (
                  <span>Memproses...</span>
                ) : (
                  <>
                    <Coins size={14} />
                    <span>Konfirmasi & Booking ({coinFee} Koin)</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
