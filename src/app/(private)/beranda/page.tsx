"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  moodOptions,
  recentConversations,
  verifiedConsultants,
  MoodOption,
  Consultant,
  RecentConversationItem,
} from "@/constant/beranda";
import {
  Calendar,
  ChevronRight,
  MessageCircle,
  ShieldCheck,
  Phone,
  MessageSquare,
  Clock,
  Sparkles,
  Wind,
  AlertCircle,
  ArrowRight,
  Brain,
  Star,
} from "lucide-react";
import { MdVerified } from "react-icons/md";
import { useUserStore } from "@/store/user-store";
import { useScheduleStore } from "@/store/schedule-store";

export default function BerandaPage() {
  const [selectedMood, setSelectedMood] = useState<string>("calm");
  const [breathingActive, setBreathingActive] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);
  const user = useUserStore((state) => state.user);
  const rawSchedules = useScheduleStore((state) => state.schedules);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeMood = moodOptions.find((m) => m.value === selectedMood) || moodOptions[0];
  const activeSessions = mounted
    ? rawSchedules.filter((s) => s.status === "terjadwal" || s.status === "menunggu")
    : [];

  const getGreetingName = () => {
    if (!mounted) return "Wahyu";
    if (user.alias && !["Matthew", "Matt", "Pasien"].includes(user.alias)) {
      return user.alias;
    }
    if (user.fullName && !["Matthew Johnson", "Matthew"].includes(user.fullName)) {
      return user.fullName.trim().split(" ")[0];
    }
    return "Wahyu";
  };
  const displayName = getGreetingName();

  return (
    <div className="space-y-6 sm:space-y-8 font-nunito pb-10 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* 1. Header Welcome Sanctuary Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-900 via-teal-950 to-slate-950 text-white p-6 sm:p-8 md:p-10 shadow-lg border border-teal-800/60 dark:border-teal-900/40">
        {/* Calming ambient background glow */}
        <div className="absolute top-0 right-10 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 left-10 w-60 h-60 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 md:gap-8">
          <div className="space-y-3.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-800/60 border border-teal-700/60 text-teal-200 text-xs font-semibold backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Ruang Suaka & Pendampingan Mental</span>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold font-heading text-white tracking-tight leading-snug">
              Selamat Datang, {displayName}
            </h1>

            <p className="text-sm sm:text-base text-teal-100/80 leading-relaxed max-w-xl">
              Setiap emosi yang kamu rasakan adalah valid. Ambil jeda, tarik napas perlahan, dan ketahuilah bahwa kamu tidak sendirian. Psikolog klinis dan AI empatik kami siap mendampingimu.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link href="/room">
                <Button className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl px-5 py-5 text-sm cursor-pointer shadow-md shadow-emerald-500/20 gap-2">
                  <MessageCircle size={17} />
                  Mulai Curhat AI Instan (24/7)
                </Button>
              </Link>
              <Link href="/schedule?booking=true">
                <Button variant="outline" className="border-teal-700/80 bg-teal-900/50 hover:bg-teal-800/60 text-teal-100 font-semibold rounded-xl px-5 py-5 text-sm cursor-pointer gap-2">
                  <Calendar size={17} />
                  Reservasi Sesi Psikolog
                </Button>
              </Link>
            </div>
          </div>

          {/* Clinical Assurance Mini-Card */}
          <div className="rounded-2xl bg-teal-900/40 border border-teal-700/50 p-4 sm:p-5 backdrop-blur-md max-w-xs space-y-3">
            <div className="flex items-center gap-2.5 text-emerald-300 font-semibold text-xs">
              <ShieldCheck size={18} />
              <span>Standar Etika Medis HIMPSI</span>
            </div>
            <p className="text-xs text-teal-100/70 leading-relaxed font-nunito">
              Semua sesi konseling dan catatan refleksi berada di bawah perlindungan kode etik kerahasiaan psikolog.
            </p>
            <div className="pt-1 flex items-center justify-between border-t border-teal-800/80 text-[11px] text-teal-300 font-medium">
              <span>Sesi Terjadwal: {activeSessions.length} Sesi</span>
              <Link href="/schedule" className="text-emerald-400 hover:underline">
                Lihat Jadwal →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main 2-Column Clinical Dashboard Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
        {/* Left Column (8 Cols on Desktop) */}
        <div className="lg:col-span-8 space-y-6 sm:space-y-8">
          {/* 2. Therapeutic Emotion Check-In & Grounding Widget */}
          <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="font-heading text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Brain size={20} className="text-teal-600 dark:text-teal-400" />
                    Bagaimana Kondisi Batinmu Hari Ini?
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
                    Pilih suasana hati yang paling mewakili kondisimu saat ini untuk rekomendasi pemulihan.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBreathingActive(!breathingActive)}
                  className="text-xs border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-slate-800 rounded-lg gap-1.5 self-start sm:self-center cursor-pointer"
                >
                  <Wind size={14} className={breathingActive ? "animate-spin" : ""} />
                  {breathingActive ? "Tutup Relaksasi" : "Latihan Pernapasan"}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-5 sm:p-6 space-y-5">
              {/* Emotion Selector Badges */}
              <div className="flex flex-wrap gap-2 sm:gap-2.5">
                {moodOptions.map((option: MoodOption) => {
                  const isActive = selectedMood === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setSelectedMood(option.value)}
                      className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 border cursor-pointer ${
                        isActive ? option.activeColorClass : option.colorClass
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              {/* Dynamic Emotional Validation Box */}
              {activeMood && (
                <div className="rounded-xl p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-teal-800 dark:text-teal-300 uppercase tracking-wider">
                    <Sparkles size={14} className="text-teal-600 dark:text-teal-400" />
                    <span>Catatan Refleksi Klinis</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-medium italic">
                    "{activeMood.quote}"
                  </p>
                  <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
                    <p className="font-nunito">
                      <strong className="text-slate-900 dark:text-white font-semibold">Rekomendasi: </strong>
                      {activeMood.recommendation}
                    </p>
                    <Link href="/room" className="flex-shrink-0">
                      <Button size="sm" variant="ghost" className="text-xs text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-slate-800 px-2 py-1 h-auto font-semibold gap-1">
                        Eksplorasi di Chat <ArrowRight size={13} />
                      </Button>
                    </Link>
                  </div>
                </div>
              )}

              {/* Box Breathing Interactive Exercise (Expandable) */}
              {breathingActive && (
                <div className="rounded-2xl p-5 bg-gradient-to-br from-teal-50 via-emerald-50/50 to-white dark:from-teal-950/40 dark:via-slate-900 dark:to-slate-900 border border-teal-200 dark:border-teal-800 text-center space-y-3 animate-in fade-in duration-300">
                  <div className="flex items-center justify-center gap-2 text-xs font-bold text-teal-800 dark:text-teal-300">
                    <Wind size={16} className="text-teal-600 dark:text-teal-400 animate-pulse" />
                    <span>Teknik Pernapasan Relaksasi (Box Breathing 4-4-4-4)</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 max-w-md mx-auto">
                    Tarik napas perlahan melalui hidung (4 detik), tahan di dada (4 detik), hembuskan melalui mulut (4 detik), dan tahan jeda (4 detik). Ulangi 3 kali.
                  </p>
                  <div className="flex justify-center items-center gap-4 py-2">
                    <div className="w-20 h-20 rounded-full border-4 border-teal-500/40 dark:border-teal-400/30 bg-white dark:bg-slate-800 flex items-center justify-center shadow-xs">
                      <span className="text-xs font-bold text-teal-700 dark:text-teal-300 font-heading">Napas</span>
                    </div>
                  </div>
                  <span className="text-[11px] text-teal-700 dark:text-teal-400 font-medium">
                    Membantu menurunkan lonjakan detak jantung dan meredakan kepanikan saraf vagus.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 3. Upcoming Counseling Sessions Card */}
          <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
            <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/80 border border-teal-200/80 dark:border-teal-800 text-teal-700 dark:text-teal-400 flex items-center justify-center shrink-0">
                    <Calendar size={17} />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="font-heading text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight truncate">
                      Jadwal Sesi Mendatang
                    </CardTitle>
                    <CardDescription className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-nunito mt-0.5 truncate">
                      Sesi konseling privat terjadwal bersama psikolog
                    </CardDescription>
                  </div>
                </div>

                <Link href="/schedule" className="shrink-0">
                  <span className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 flex items-center gap-0.5">
                    Lihat Semua <ChevronRight size={14} />
                  </span>
                </Link>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-6">
              {activeSessions.length > 0 ? (
                <div className="space-y-3.5">
                  {activeSessions.slice(0, 2).map((session) => (
                    <div
                      key={session.id}
                      className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/40 hover:bg-slate-50/80 dark:hover:bg-slate-800/70 transition-colors space-y-3"
                    >
                      {/* Baris Atas: Info Psikolog & Badge Status */}
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-teal-50 dark:bg-teal-950/80 border border-teal-200/60 dark:border-teal-800 text-teal-700 dark:text-teal-400 flex items-center justify-center shrink-0 mt-0.5">
                            {session.type === "Voice Call" ? (
                              <Phone size={17} />
                            ) : (
                              <MessageSquare size={17} />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 dark:text-white text-sm font-heading leading-tight truncate">
                              {session.consultant}
                            </p>
                            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-0.5 line-clamp-1">
                              {session.topic || session.title}
                            </p>
                          </div>
                        </div>

                        <Badge
                          className={`text-[10px] font-semibold shrink-0 border py-0.5 px-2 ${
                            session.status === "terjadwal"
                              ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                              : "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                          }`}
                        >
                          {session.status === "terjadwal" ? "Terkonfirmasi" : "Menunggu"}
                        </Badge>
                      </div>

                      {/* Baris Tengah: Strip Jadwal Waktu & Metode */}
                      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white dark:bg-slate-900/90 border border-slate-200/70 dark:border-slate-800 text-xs">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 text-slate-600 dark:text-slate-400">
                          <span className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                            <Calendar size={13} className="text-teal-600 dark:text-teal-400 shrink-0" />
                            {session.date}
                          </span>
                          <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">•</span>
                          <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
                            <Clock size={13} className="text-teal-600 dark:text-teal-400 shrink-0" />
                            {session.time}
                          </span>
                        </div>

                        <span className="text-[11px] font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/70 border border-teal-200/70 dark:border-teal-800 px-2 py-0.5 rounded-md">
                          {session.type}
                        </span>
                      </div>

                      {/* Baris Bawah: Tombol Aksi Responsif */}
                      <div className="flex items-center justify-end pt-0.5">
                        {session.status === "terjadwal" ? (
                          <Link href="/room" className="w-full sm:w-auto">
                            <Button
                              size="sm"
                              className="w-full sm:w-auto text-xs bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg px-4 py-2 cursor-pointer shadow-xs gap-1.5"
                            >
                              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                              Masuk Ruang Sesi
                            </Button>
                          </Link>
                        ) : (
                          <Link href="/schedule" className="w-full sm:w-auto">
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full sm:w-auto text-xs border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg px-4 py-2 font-semibold"
                            >
                              Lihat Detail Jadwal
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 space-y-2">
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-nunito">
                    Belum ada jadwal sesi terapi yang akan datang.
                  </p>
                  <Link href="/schedule?booking=true">
                    <Button variant="outline" className="border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-slate-800 text-xs">
                      Pilih Psikolog & Jadwal
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 4. Clinical Care Package Card (With Generous Breathing Room) */}
          <div className="rounded-2xl p-5 sm:p-7 bg-gradient-to-br from-teal-50/90 via-white to-emerald-50/50 dark:from-teal-950/40 dark:via-slate-900 dark:to-slate-900 border border-teal-200/90 dark:border-teal-800/70 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5 sm:gap-6">
            <div className="space-y-3 max-w-xl">
              {/* Badge dengan jarak lega */}
              <div className="flex items-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-teal-800 dark:text-teal-300 bg-white dark:bg-slate-800 border border-teal-300/80 dark:border-teal-700 shadow-2xs tracking-wide">
                  <Sparkles size={13} className="text-teal-600 dark:text-teal-400" />
                  PROGRAM TERAPI INTENSIF
                </span>
              </div>

              {/* Title dengan margin & leading yang pas */}
              <h3 className="text-lg sm:text-xl font-bold font-heading text-slate-900 dark:text-white leading-snug">
                Paket Pendampingan Psikologis Berkala
              </h3>

              {/* Deskripsi */}
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-nunito leading-relaxed">
                Dapatkan 3 sesi konseling mendalam 60 menit bersama psikolog berlisensi, lembar evaluasi berkala (DASS-21), dan akses pendampingan chat terpadu.
              </p>
            </div>

            <Link href="/top-up" className="shrink-0 w-full sm:w-auto">
              <Button size="default" className="w-full sm:w-auto text-xs sm:text-sm bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl px-5 py-2.5 cursor-pointer shadow-xs">
                Lihat Paket Konseling
              </Button>
            </Link>
          </div>
        </div>

        {/* Right Column (4 Cols on Desktop) */}
        <div className="lg:col-span-4 space-y-6 sm:space-y-8">
          {/* 5. Verified Psychologists Card (Compact & Clean Row Layout) */}
          <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
            <CardHeader className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/80 border border-teal-200/70 dark:border-teal-800 text-teal-700 dark:text-teal-400 flex items-center justify-center shrink-0">
                    <ShieldCheck size={16} />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="font-heading text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight truncate">
                      Psikolog Terverifikasi
                    </CardTitle>
                    <CardDescription className="text-[11px] text-slate-500 dark:text-slate-400 font-nunito truncate">
                      Berlisensi resmi (SIPPK & HIMPSI)
                    </CardDescription>
                  </div>
                </div>

                <Link href="/schedule" className="shrink-0">
                  <span className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 flex items-center gap-0.5">
                    Semua <ChevronRight size={13} />
                  </span>
                </Link>
              </div>
            </CardHeader>

            <CardContent className="p-3 sm:p-4 space-y-2.5">
              {verifiedConsultants.map((consultant: Consultant) => (
                <div
                  key={consultant.id}
                  className="p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-800/50 hover:border-teal-200 dark:hover:border-teal-700 hover:bg-slate-50/60 dark:hover:bg-slate-800/90 transition-all flex items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-950 dark:to-teal-900 text-teal-800 dark:text-teal-300 font-bold text-xs flex items-center justify-center border border-teal-200 dark:border-teal-700 font-heading">
                        {consultant.initials}
                      </div>
                      {consultant.available && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-800" title="Tersedia" />
                      )}
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1">
                        <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white font-heading truncate">
                          {consultant.name}
                        </p>
                        <MdVerified className="text-sky-500 text-xs shrink-0" />
                      </div>
                      <p className="text-[11px] text-teal-700 dark:text-teal-400 font-medium truncate">
                        {consultant.specialty}
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400 font-semibold">
                          <Star size={10} className="fill-amber-400 text-amber-400" />
                          {consultant.rating}
                        </span>
                        <span>•</span>
                        <span className="truncate">{consultant.nextSlot}</span>
                      </div>
                    </div>
                  </div>

                  <Link href="/schedule?booking=true" className="shrink-0">
                    <Button
                      size="sm"
                      className="text-xs bg-teal-50 dark:bg-teal-950/70 hover:bg-teal-600 dark:hover:bg-teal-600 hover:text-white text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 font-semibold rounded-lg px-3 py-1 h-8 transition-colors cursor-pointer"
                    >
                      {consultant.available ? "Jadwal" : "Profil"}
                    </Button>
                  </Link>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* 6. Recent Conversation History Card */}
          <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <CardTitle className="font-heading text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <MessageCircle size={17} className="text-teal-600 dark:text-teal-400" />
                  Sesi & Percakapan Terakhir
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
                  Catatan ruang chat amanmu
                </CardDescription>
              </div>
              <Link href="/room">
                <Button variant="ghost" size="sm" className="text-xs text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-slate-800 px-2 py-1 h-auto font-semibold cursor-pointer">
                  Semua <ChevronRight size={14} />
                </Button>
              </Link>
            </CardHeader>

            <CardContent className="p-4 sm:p-5 space-y-3">
              {recentConversations.map((conv: RecentConversationItem) => (
                <div
                  key={conv.id}
                  className="p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[11px] flex items-center justify-center flex-shrink-0">
                        {conv.initials}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-slate-900 dark:text-white font-heading truncate">
                          {conv.with}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">{conv.role}</p>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0">{conv.time}</span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 font-nunito line-clamp-2 leading-relaxed">
                    "{conv.lastMessage}"
                  </p>

                  <div className="pt-1 flex justify-end">
                    <Link href="/room">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-slate-800 px-2 py-0.5 h-7 font-semibold gap-1 cursor-pointer"
                      >
                        Buka Percakapan <ArrowRight size={12} />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* 7. Quick Crisis Support Card */}
          <div className="rounded-2xl p-4 bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 space-y-2 text-xs text-rose-900 dark:text-rose-200">
            <div className="flex items-center gap-2 font-bold text-rose-800 dark:text-rose-300">
              <AlertCircle size={16} className="text-rose-600 dark:text-rose-400 flex-shrink-0" />
              <span>Butuh Bantuan Krisis Mendesak?</span>
            </div>
            <p className="text-rose-700 dark:text-rose-300 text-[11px] leading-relaxed">
              Jika kamu atau seseorang sedang dalam situasi darurat keselamatan jiwa, hubungi saluran Kemenkes RI SEJIWA di <strong className="font-bold text-rose-900 dark:text-rose-100">119 ext. 8</strong> (Bebas Pulsa).
            </p>
            <Link href="/help-center" className="inline-block text-[11px] font-bold text-rose-800 dark:text-rose-300 underline pt-0.5">
              Info Kontak Krisis Nasional →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
