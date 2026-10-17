"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Consultant } from "@/constant/beranda";
import type { PublicPsychologist } from "@/types/user-profile";
import {
  getInitials,
  tarifToCoins,
  formatRupiah,
  generate14DaysWib,
  getWibDateString,
  formatWibTime,
  formatWibDateFull,
} from "@/lib/booking-utils";
import { scheduleClient } from "@/services/schedule.client";
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
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { MdVerified } from "react-icons/md";

interface PsychologistProfileModalProps {
  consultant?: Consultant | null;
  psychologist?: PublicPsychologist | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBookSession?: (consultant: Consultant) => void;
  onSelectSlot?: (psychologist: PublicPsychologist, slotIso: string) => void;
}

export function PsychologistProfileModal({
  consultant,
  psychologist,
  open,
  onOpenChange,
  onBookSession,
  onSelectSlot,
}: PsychologistProfileModalProps) {
  const profile = psychologist
    ? {
        id: psychologist.id,
        name: psychologist.nama_lengkap_gelar,
        title: `Psikolog Klinis (${psychologist.tahun_pengalaman} Thn Pengalaman)`,
        specialty: psychologist.spesialisasi.join(", ") || "Konseling Klinis",
        licenseNumber: "SIPPK Terverifikasi (HIMPSI)",
        experienceYears: psychologist.tahun_pengalaman,
        rating: null,
        reviews: 0,
        initials: getInitials(psychologist.nama_lengkap_gelar),
        available: true,
        nextSlot: "Jadwal Tersedia",
        almamater: "Magister Profesi Psikologi Klinis",
        bio: `Psikolog klinis berlisensi resmi dengan keahlian di bidang ${
          psychologist.spesialisasi.join(", ") || "kesehatan mental dan terapi perilaku"
        }.`,
        approaches: ["Cognitive Behavioral Therapy (CBT)", "Mindfulness", "Solution-Focused Brief Therapy"],
        handledTopics: psychologist.spesialisasi,
        hourlyRateCoins: tarifToCoins(psychologist.tarif_sesi),
        tarifSesi: Number(psychologist.tarif_sesi),
        avatarUrl: psychologist.avatar_url,
      }
    : consultant
    ? {
        id: String(consultant.id),
        name: consultant.name,
        title: consultant.title,
        specialty: consultant.specialty,
        licenseNumber: consultant.licenseNumber,
        experienceYears: consultant.experienceYears,
        rating: consultant.rating,
        reviews: consultant.reviews,
        initials: consultant.initials,
        available: consultant.available,
        nextSlot: consultant.nextSlot,
        almamater: consultant.almamater,
        bio: consultant.bio,
        approaches: consultant.approaches,
        handledTopics: consultant.handledTopics,
        hourlyRateCoins: consultant.hourlyRateCoins || 15,
        tarifSesi: (consultant.hourlyRateCoins || 15) * 10000,
        avatarUrl: null,
      }
    : null;

  // 14 Days WIB list
  const days14 = useMemo(() => generate14DaysWib(), []);

  // Slots state from GET /api/psychologists/[id]/slots
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlotIso, setSelectedSlotIso] = useState<string | null>(null);

  const loadSlots = useCallback(async () => {
    if (!profile?.id) return;
    setLoadingSlots(true);
    setSlotsError(null);
    try {
      const todayWib = getWibDateString();
      const res = await scheduleClient.getAvailableSlots(profile.id, { from: todayWib, days: 14 });
      const rawSlots = res.data?.slots || res.slots || [];
      setSlots(rawSlots);
    } catch (err: unknown) {
      console.error("Gagal mengambil slot psikolog:", err);
      setSlotsError("Gagal memuat slot jadwal. Silakan coba lagi.");
    } finally {
      setLoadingSlots(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    if (open && profile?.id) {
      loadSlots();
      setSelectedSlotIso(null);
    }
  }, [open, profile?.id, loadSlots]);

  // Group slots by WIB date YYYY-MM-DD
  const slotsByDate = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const slotIso of slots) {
      const dKey = getWibDateString(new Date(slotIso));
      if (!map[dKey]) map[dKey] = [];
      map[dKey].push(slotIso);
    }
    for (const k in map) {
      map[k].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    }
    return map;
  }, [slots]);

  // Default selected date to first day that has available slots
  useEffect(() => {
    if (days14.length > 0 && !selectedDate) {
      const firstWithSlot = days14.find((d) => (slotsByDate[d.dateStr] || []).length > 0);
      setSelectedDate(firstWithSlot ? firstWithSlot.dateStr : days14[0].dateStr);
    }
  }, [days14, slotsByDate, selectedDate]);

  if (!profile) return null;

  const activeDayObj = days14.find((d) => d.dateStr === selectedDate) || days14[0];
  const activeSlots = slotsByDate[selectedDate] || [];

  const handleProceedBooking = () => {
    if (!selectedSlotIso) return;
    onOpenChange(false);
    const psychPayload: PublicPsychologist = psychologist || {
      id: profile.id,
      nama_lengkap_gelar: profile.name,
      spesialisasi: profile.handledTopics || [],
      tahun_pengalaman: profile.experienceYears,
      tarif_sesi: profile.tarifSesi,
      avatar_url: profile.avatarUrl,
    };
    if (onSelectSlot) {
      onSelectSlot(psychPayload, selectedSlotIso);
    } else if (onBookSession && consultant) {
      onBookSession(consultant);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-0 rounded-3xl border border-slate-200 dark:border-slate-800 font-nunito bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl">
        {/* Clean Ambient Header */}
        <div className="p-6 pb-5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/60 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.name}
                    className="w-16 h-16 rounded-2xl object-cover border border-teal-200 dark:border-teal-700 shadow-md"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-600 to-teal-800 text-white font-bold text-xl flex items-center justify-center font-heading shadow-md">
                    {profile.initials}
                  </div>
                )}
                {profile.available && (
                  <span
                    className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 shadow-xs"
                    title="Tersedia untuk reservasi"
                  />
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-lg sm:text-xl font-bold font-heading text-slate-900 dark:text-white leading-tight">
                    {profile.name}
                  </DialogTitle>
                  <MdVerified className="text-sky-500 text-base shrink-0" title="Terverifikasi SIPPK HIMPSI" />
                </div>
                <p className="text-xs sm:text-sm text-teal-700 dark:text-teal-400 font-medium">
                  {profile.title}
                </p>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-800 dark:text-teal-300 text-[11px] font-bold">
                  <ShieldCheck size={13} className="text-teal-600 dark:text-teal-400" />
                  <span>{profile.licenseNumber} (HIMPSI)</span>
                </div>
              </div>
            </div>

            <div className="flex items-center sm:flex-col sm:items-end justify-between sm:justify-center gap-1.5 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 dark:border-slate-800">
              <div className="flex items-center gap-1 text-amber-500 font-bold text-sm">
                {profile.rating ? (
                  <>
                    <Star size={16} className="fill-amber-400 text-amber-400" />
                    <span>{profile.rating}</span>
                    <span className="text-xs text-slate-400 font-normal">({profile.reviews} ulasan)</span>
                  </>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-xs px-2.5 py-0.5 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200/80 font-semibold gap-1"
                  >
                    <Sparkles size={12} className="text-amber-500" />
                    <span>Psikolog baru</span>
                  </Badge>
                )}
              </div>
              <Badge
                className={`text-[10px] px-2 py-0.5 border font-semibold ${
                  profile.available
                    ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300"
                }`}
              >
                {slots.length > 0 ? `${slots.length} Slot Tersedia` : "Memuat Jadwal..."}
              </Badge>
            </div>
          </div>
          <DialogDescription className="sr-only">
            Detail profil kredensial psikolog klinis {profile.name}
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
                {profile.experienceYears}+ Tahun
              </span>
            </div>
            <div className="space-y-0.5 border-x border-slate-200/80 dark:border-slate-700">
              <span className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block">
                Biaya Sesi
              </span>
              <span className="text-sm sm:text-base font-extrabold font-heading text-teal-700 dark:text-teal-400">
                {profile.hourlyRateCoins} Koin / Sesi
              </span>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block">
                Setara Rupiah
              </span>
              <span className="text-sm sm:text-base font-extrabold font-heading text-slate-900 dark:text-white">
                {formatRupiah(profile.tarifSesi)}
              </span>
            </div>
          </div>

          {/* 1. SECTION: PEMILIH TANGGAL (14 HARI WIB) & JAM DARI /slots */}
          <div className="p-4 sm:p-5 rounded-2xl border-2 border-teal-500/30 bg-teal-50/20 dark:bg-teal-950/20 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h4 className="text-sm font-bold font-heading text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar size={16} className="text-teal-600 dark:text-teal-400" />
                  <span>Pilih Tanggal & Jam Konseling (14 Hari ke Depan - WIB)</span>
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Hanya menampilkan jam praktik yang berstatus tersedia
                </p>
              </div>

              <Button
                size="sm"
                variant="ghost"
                onClick={loadSlots}
                disabled={loadingSlots}
                className="h-7 px-2 text-xs text-teal-700 dark:text-teal-300 hover:bg-teal-100/50"
                title="Muat ulang slot jadwal"
              >
                <RefreshCw size={12} className={loadingSlots ? "animate-spin" : ""} />
                <span className="ml-1 hidden sm:inline">Segarkan</span>
              </Button>
            </div>

            {/* Deret 14 Hari Horizontal */}
            <div className="flex gap-2 overflow-x-auto pb-2 pt-1 no-scrollbar scroll-smooth">
              {days14.map((d) => {
                const isSelected = selectedDate === d.dateStr;
                const slotCount = (slotsByDate[d.dateStr] || []).length;
                return (
                  <button
                    key={d.dateStr}
                    type="button"
                    onClick={() => {
                      setSelectedDate(d.dateStr);
                      setSelectedSlotIso(null);
                    }}
                    className={`shrink-0 flex flex-col items-center justify-center px-3 py-2 rounded-xl text-center border transition-all cursor-pointer min-w-[72px] ${
                      isSelected
                        ? "bg-teal-600 text-white border-teal-600 shadow-sm ring-2 ring-teal-500/40"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-700"
                    }`}
                  >
                    <span className="text-[11px] font-semibold">{d.dayLabel}</span>
                    <span className="text-xs font-bold font-heading">{d.formattedDate}</span>
                    <span
                      className={`text-[9px] mt-1 px-1.5 py-0.2 rounded-full font-semibold ${
                        isSelected
                          ? "bg-white/20 text-white"
                          : slotCount > 0
                          ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                          : "bg-slate-100 dark:bg-slate-700 text-slate-400"
                      }`}
                    >
                      {slotCount > 0 ? `${slotCount} slot` : "Penuh"}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Jam dari /slots untuk Hari Terpilih */}
            <div className="pt-2 border-t border-teal-200/40 dark:border-teal-800/40 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Jam Praktik Tersedia ({activeDayObj.fullLabel}):
                </span>
                <span className="text-[11px] text-teal-700 dark:text-teal-400 font-medium">
                  {activeSlots.length} slot jam
                </span>
              </div>

              {loadingSlots ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((n) => (
                    <Skeleton key={n} className="h-10 rounded-xl bg-slate-200 dark:bg-slate-800" />
                  ))}
                </div>
              ) : slotsError ? (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
                  <span>{slotsError}</span>
                  <Button size="sm" variant="outline" onClick={loadSlots} className="h-7 text-xs">
                    Coba Lagi
                  </Button>
                </div>
              ) : activeSlots.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-center space-y-1">
                  <Clock className="w-5 h-5 mx-auto text-slate-400" />
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Tidak ada slot jadwal yang tersedia di tanggal ini
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Silakan pilih tanggal lain yang memiliki penanda slot hijau di atas.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {activeSlots.map((slotIso) => {
                    const isSelected = selectedSlotIso === slotIso;
                    const timeLabel = formatWibTime(slotIso);
                    return (
                      <button
                        key={slotIso}
                        type="button"
                        onClick={() => setSelectedSlotIso(slotIso)}
                        className={`p-2.5 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? "bg-teal-600 text-white border-teal-600 shadow-sm ring-2 ring-teal-500/40"
                            : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-teal-400 dark:hover:border-teal-600"
                        }`}
                      >
                        <Clock size={13} className={isSelected ? "text-white" : "text-teal-600 dark:text-teal-400"} />
                        <span>{timeLabel}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Selected Slot Highlight Bar */}
              {selectedSlotIso && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div>
                      <p className="font-bold">
                        Jadwal Terpilih: {formatWibDateFull(selectedSlotIso)}, {formatWibTime(selectedSlotIso)}
                      </p>
                      <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                        Durasi sesi: 60 Menit • Biaya: {profile.hourlyRateCoins} Koin
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-emerald-600 text-white text-[10px]">Siap Dipesan</Badge>
                </div>
              )}
            </div>
          </div>

          {/* 2. Biografi Singkat */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen size={14} className="text-teal-600 dark:text-teal-400" />
              <span>Tentang Psikolog</span>
            </h4>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-nunito leading-relaxed">
              {profile.bio ||
                "Psikolog klinis berlisensi HIMPSI yang mengkhususkan diri dalam pendampingan kesehatan mental dewasa dengan pendekatan berbasis bukti ilmiah."}
            </p>
          </div>

          {/* 3. Latar Belakang Pendidikan & Almamater */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <GraduationCap size={15} className="text-teal-600 dark:text-teal-400" />
              <span>Latar Belakang Akademik & Kredensial</span>
            </h4>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
              <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                <span>{profile.almamater || "Magister Profesi Psikologi Klinis"}</span>
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-5">
                Surat Izin Praktik Psikolog Klinis (SIPPK) aktif terdaftar pada Sistem Registrasi Nasional Tenaga Kesehatan RI.
              </p>
            </div>
          </div>

          {/* 4. Pendekatan Terapi Klinis */}
          {profile.approaches && profile.approaches.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={14} className="text-teal-600 dark:text-teal-400" />
                <span>Metode & Pendekatan Terapi</span>
              </h4>
              <div className="flex flex-wrap gap-2">
                {profile.approaches.map((approach, i) => (
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

          {/* 5. Topik / Masalah yang Ditangani */}
          {profile.handledTopics && profile.handledTopics.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <HeartHandshake size={14} className="text-pink-600 dark:text-pink-400" />
                <span>Fokus Isu & Keluhan yang Didampingi</span>
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {profile.handledTopics.map((topic, i) => (
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
        </div>

        {/* Modal Footer CTA */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/60 flex items-center justify-between gap-3 sticky bottom-0 backdrop-blur-md">
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
            disabled={!selectedSlotIso}
            onClick={handleProceedBooking}
            className={`text-xs h-10 px-6 rounded-xl font-bold cursor-pointer shadow-sm gap-2 ${
              selectedSlotIso
                ? "bg-teal-600 hover:bg-teal-700 text-white"
                : "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
            }`}
          >
            <Calendar size={14} />
            <span>
              {selectedSlotIso
                ? `Lanjut Booking (${profile.hourlyRateCoins} Koin)`
                : "Pilih Tanggal & Jam di Atas"}
            </span>
            <ArrowRight size={13} />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
