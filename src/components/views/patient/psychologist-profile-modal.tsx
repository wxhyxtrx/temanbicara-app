"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Consultant } from "@/constant/beranda";
import {
  ShieldCheck,
  Star,
  Clock,
  Calendar,
  GraduationCap,
  Sparkles,
  HeartHandshake,
  MessageSquare,
  Phone,
  CheckCircle2,
  ArrowRight,
  BookOpen,
} from "lucide-react";
import { MdVerified } from "react-icons/md";

interface PsychologistProfileModalProps {
  consultant: Consultant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBookSession: (consultant: Consultant) => void;
}

export function PsychologistProfileModal({
  consultant,
  open,
  onOpenChange,
  onBookSession,
}: PsychologistProfileModalProps) {
  if (!consultant) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 rounded-3xl border border-slate-200 dark:border-slate-800 font-nunito bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl">
        {/* Clean Ambient Header */}
        <div className="p-6 pb-5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/60 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-600 to-teal-800 text-white font-bold text-xl flex items-center justify-center font-heading shadow-md">
                  {consultant.initials}
                </div>
                {consultant.available && (
                  <span
                    className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 shadow-xs"
                    title="Tersedia untuk reservasi"
                  />
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-lg sm:text-xl font-bold font-heading text-slate-900 dark:text-white leading-tight">
                    {consultant.name}
                  </DialogTitle>
                  <MdVerified className="text-sky-500 text-base shrink-0" title="Terverifikasi SIPPK HIMPSI" />
                </div>
                <p className="text-xs sm:text-sm text-teal-700 dark:text-teal-400 font-medium">
                  {consultant.title}
                </p>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-800 dark:text-teal-300 text-[11px] font-bold">
                  <ShieldCheck size={13} className="text-teal-600 dark:text-teal-400" />
                  <span>{consultant.licenseNumber} (HIMPSI)</span>
                </div>
              </div>
            </div>

            <div className="flex items-center sm:flex-col sm:items-end justify-between sm:justify-center gap-1.5 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 dark:border-slate-800">
              <div className="flex items-center gap-1 text-amber-500 font-bold text-sm">
                <Star size={16} className="fill-amber-400 text-amber-400" />
                <span>{consultant.rating}</span>
                <span className="text-xs text-slate-400 font-normal">({consultant.reviews} ulasan)</span>
              </div>
              <Badge
                className={`text-[10px] px-2 py-0.5 border font-semibold ${
                  consultant.available
                    ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300"
                }`}
              >
                {consultant.available ? `Slot: ${consultant.nextSlot}` : "Jadwal Penuh Pekan Ini"}
              </Badge>
            </div>
          </div>
          <DialogDescription className="sr-only">
            Detail profil kredensial psikolog klinis {consultant.name}
          </DialogDescription>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-center">
            <div className="space-y-0.5">
              <span className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block">
                Pengalaman
              </span>
              <span className="text-sm sm:text-base font-extrabold font-heading text-slate-900 dark:text-white">
                {consultant.experienceYears}+ Tahun
              </span>
            </div>
            <div className="space-y-0.5 border-x border-slate-200/80 dark:border-slate-700">
              <span className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block">
                Sesi Sukses
              </span>
              <span className="text-sm sm:text-base font-extrabold font-heading text-teal-700 dark:text-teal-400">
                {consultant.reviews}+ Pasien
              </span>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block">
                Biaya Sesi
              </span>
              <span className="text-sm sm:text-base font-extrabold font-heading text-slate-900 dark:text-white">
                {consultant.hourlyRateCoins || 15} Koin / Jam
              </span>
            </div>
          </div>

          {/* 1. Biografi Singkat */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen size={14} className="text-teal-600 dark:text-teal-400" />
              <span>Tentang Psikolog</span>
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-nunito leading-relaxed">
              {consultant.bio ||
                "Psikolog klinis berlisensi HIMPSI yang mengkhususkan diri dalam pendampingan kesehatan mental dewasa dengan pendekatan berbasis bukti ilmiah."}
            </p>
          </div>

          {/* 2. Latar Belakang Pendidikan & Almamater */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <GraduationCap size={15} className="text-teal-600 dark:text-teal-400" />
              <span>Latar Belakang Akademik & Kredensial</span>
            </h4>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
              <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                <span>{consultant.almamater || "Magister Profesi Psikologi Klinis"}</span>
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-5">
                Surat Izin Praktik Psikolog Klinis (SIPPK) aktif terdaftar pada Sistem Registrasi Nasional Tenaga Kesehatan RI.
              </p>
            </div>
          </div>

          {/* 3. Pendekatan Terapi Klinis */}
          {consultant.approaches && consultant.approaches.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={14} className="text-teal-600 dark:text-teal-400" />
                <span>Metode & Pendekatan Terapi</span>
              </h4>
              <div className="flex flex-wrap gap-2">
                {consultant.approaches.map((approach, i) => (
                  <span
                    key={i}
                    className="text-xs px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/70 border border-teal-200/80 dark:border-teal-800 text-teal-800 dark:text-teal-300 font-semibold"
                  >
                    ✓ {approach}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 4. Topik / Masalah yang Ditangani */}
          {consultant.handledTopics && consultant.handledTopics.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <HeartHandshake size={14} className="text-pink-600 dark:text-pink-400" />
                <span>Fokus Isu & Keluhan yang Didampingi</span>
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {consultant.handledTopics.map((topic, i) => (
                  <span
                    key={i}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 5. Metode Konseling yang Didukung */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Metode Konseling Tersedia
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-400 flex items-center justify-center shrink-0">
                  <MessageSquare size={16} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Chat Eksklusif</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">15 Koin / 60 Menit</p>
                </div>
              </div>
              <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-400 flex items-center justify-center shrink-0">
                  <Phone size={16} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Voice Call Privat</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">5 Koin / 60 Menit</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer CTA */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/60 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-xs text-slate-600 dark:text-slate-400 h-10 px-4 rounded-xl font-semibold cursor-pointer"
          >
            Tutup
          </Button>

          <Button
            type="button"
            onClick={() => {
              onOpenChange(false);
              onBookSession(consultant);
            }}
            className="text-xs bg-teal-600 hover:bg-teal-700 text-white h-10 px-6 rounded-xl font-bold cursor-pointer shadow-sm gap-2"
          >
            <Calendar size={14} />
            <span>Pilih Jadwal Konsultasi</span>
            <ArrowRight size={13} />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
