"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Video,
  MessageSquare,
  ShieldCheck,
  Star,
  Users,
  Wallet,
  ArrowRight,
  AlertCircle,
  FileText,
  UserCheck,
  Sparkles,
  Heart,
  Quote,
} from "lucide-react";
import { MdVerified } from "react-icons/md";
import { useUserStore } from "@/store/user-store";
import { useScheduleStore } from "@/store/schedule-store";
import { useReviewStore } from "@/store/review-store";

interface SessionRequest {
  id: string;
  patientName: string;
  patientAge: number;
  topic: string;
  category: string;
  type: "Voice Call" | "Chat Konseling";
  date: string;
  time: string;
  notes: string;
  status: "pending" | "accepted" | "declined";
}

const defaultDemoRequests: SessionRequest[] = [
  {
    id: "req-1",
    patientName: "Budi Santoso (Anonim)",
    patientAge: 26,
    topic: "Kecemasan Karier & Burnout",
    category: "Ansietas Klinis",
    type: "Voice Call",
    date: "Hari Ini, 10 Okt",
    time: "14:00 - 15:00 WIB",
    notes: "Sering insomnia dan sesak napas sebelum presentasi kerja sejak 1 bulan terakhir.",
    status: "pending",
  },
  {
    id: "req-2",
    patientName: "Nadia Putri",
    patientAge: 23,
    topic: "Dinamika Hubungan & Family Conflict",
    category: "Konseling Relasi",
    type: "Chat Konseling",
    date: "Besok, 11 Okt",
    time: "10:00 - 11:00 WIB",
    notes: "Membutuhkan ruang aman untuk memproses batasan (boundary) dengan orang tua.",
    status: "pending",
  },
];

export default function CounselorBerandaPage() {
  const user = useUserStore((state) => state.user);
  const rawSchedules = useScheduleStore((state) => state.schedules);
  const updateSessionStatus = useScheduleStore((state) => state.updateSessionStatus);
  const allReviews = useReviewStore((state) => state.reviews);

  const counselorReviews = useMemo(() => {
    return allReviews.filter(
      (r) =>
        r.consultantId === 1 ||
        r.consultantName.toLowerCase().includes("anita") ||
        r.consultantName.toLowerCase().includes("sarah") ||
        r.consultantId === 2
    );
  }, [allReviews]);

  const [mounted, setMounted] = useState(false);
  const [requests, setRequests] = useState<SessionRequest[]>(defaultDemoRequests);

  React.useEffect(() => {
    setMounted(true);
    // Sync any pending sessions from schedule store
    const storePending = rawSchedules
      .filter((s) => s.status === "menunggu")
      .map((s) => ({
        id: s.id,
        patientName: "Wahyu Tricahyo (Klien Baru)",
        patientAge: 27,
        topic: s.topic,
        category: "Konseling Terjadwal",
        type: s.type === "Voice Call" ? ("Voice Call" as const) : ("Chat Konseling" as const),
        date: s.date,
        time: s.time,
        notes: s.notes || "Sesi baru dipesan oleh klien melalui katalog jadwal.",
        status: "pending" as const,
      }));

    if (storePending.length > 0) {
      setRequests([...storePending, ...defaultDemoRequests]);
    }
  }, [rawSchedules]);

  const handleAction = (id: string, action: "accepted" | "declined") => {
    setRequests((prev) =>
      prev.map((req) => (req.id === id ? { ...req, status: action } : req))
    );
    updateSessionStatus(id, action === "accepted" ? "terjadwal" : "dibatalkan");
  };

  const nextActiveSession = mounted
    ? rawSchedules.find((s) => s.status === "terjadwal")
    : null;

  const counselorProfile = {
    licenseNumber: user.counselorData?.licenseNumber || "198402-2019-01",
    specialty: user.counselorData?.specialty || "Kecemasan, Burnout & Regulasi Emosi",
    experienceYears: user.counselorData?.experienceYears || 7,
    rating: user.counselorData?.rating || 4.95,
    totalConsultations: user.counselorData?.totalConsultations || 142,
    hourlyRateCoins: user.counselorData?.hourlyRateCoins || 60,
  };

  return (
    <div className="space-y-6 sm:space-y-8 font-nunito pb-12 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* 1. Header Welcome Counselor Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-900 via-teal-950 to-slate-950 text-white p-6 sm:p-8 md:p-10 shadow-lg border border-teal-800/60 dark:border-teal-900/40">
        <div className="absolute top-0 right-10 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 left-10 w-60 h-60 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 md:gap-8">
          <div className="space-y-3.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-800/60 border border-teal-700/60 text-teal-200 text-xs font-semibold backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Portal Psikolog Berlisensi SIPPK</span>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold font-heading text-white tracking-tight leading-snug">
              Selamat Bertugas, {user.fullName || "Dr. Sarah Alatas, M.Psi"}
            </h1>

            <p className="text-sm sm:text-base text-teal-100/80 leading-relaxed max-w-xl">
              Terima kasih telah menghadirkan ruang aman dan pemulihan bagi para klien. Seluruh sesi terlindungi oleh standar etika kerahasiaan medis HIMPSI.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link href="/counselor/schedule">
                <Button className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl px-5 py-5 text-sm cursor-pointer shadow-md shadow-emerald-500/20 gap-2">
                  <Calendar size={17} />
                  Kelola Kalender Praktik
                </Button>
              </Link>
              <Link href="/counselor/clients">
                <Button variant="outline" className="border-teal-700/80 bg-teal-900/50 hover:bg-teal-800/60 text-teal-100 font-semibold rounded-xl px-5 py-5 text-sm cursor-pointer gap-2">
                  <FileText size={17} />
                  Catatan Rekam Klien
                </Button>
              </Link>
            </div>
          </div>

          {/* License & Verification Badge Card */}
          <div className="rounded-2xl bg-teal-900/40 border border-teal-700/50 p-4 sm:p-5 backdrop-blur-md max-w-xs space-y-3 shrink-0">
            <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
              <MdVerified className="text-sky-400 text-base" />
              <span>SIPPK: {counselorProfile.licenseNumber}</span>
            </div>
            <p className="text-xs text-teal-100/70 leading-relaxed font-nunito">
              Psikolog Klinis Dewasa Terverifikasi • Spesialisasi {counselorProfile.specialty}.
            </p>
            <div className="pt-2 border-t border-teal-800/80 flex items-center justify-between text-[11px] text-teal-300">
              <span className="flex items-center gap-1 font-semibold text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> Praktik Buka
              </span>
              <span className="font-mono">{counselorProfile.hourlyRateCoins} Koin / Sesi</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. KPI Stat Cards (4 Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Pasien Aktif</span>
            <span className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-400">
              <Users size={15} />
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-heading text-teal-900 dark:text-teal-300">
            8 <span className="text-xs font-semibold text-teal-600 dark:text-teal-400">Klien</span>
          </p>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-nunito">Dalam pendampingan berkala</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Sesi Terselesaikan</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400">
              <UserCheck size={15} />
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-heading text-emerald-700 dark:text-emerald-400">
            {counselorProfile.totalConsultations} <span className="text-xs font-semibold">Sesi</span>
          </p>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-nunito">{counselorProfile.experienceYears} tahun pengalaman</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Rating Praktik</span>
            <span className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400">
              <Star size={15} className="fill-amber-400 text-amber-400" />
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-heading text-amber-700 dark:text-amber-400">
            {counselorProfile.rating} <span className="text-xs font-semibold text-slate-500">/ 5.0</span>
          </p>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-nunito">Berdasarkan 128 evaluasi</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Saldo Honor Koin</span>
            <span className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-400">
              <Wallet size={15} />
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-heading text-teal-900 dark:text-teal-300">
            620 <span className="text-xs font-semibold text-teal-600 dark:text-teal-400">Koin</span>
          </p>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-nunito font-semibold">
            ≈ Rp 6.200.000 Siap Tarik
          </span>
        </div>
      </div>

      {/* 3. Main 2-Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
        {/* Left Column: Permintaan Konseling Masuk (8 Cols) */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="font-heading text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Clock size={18} className="text-teal-600 dark:text-teal-400" />
                    Permintaan Janji Temu Masuk
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
                    Konfirmasi atau jadwalkan ulang permintaan konsultasi dari klien
                  </CardDescription>
                </div>
                <Badge variant="outline" className="border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 text-xs self-start sm:self-center">
                  {requests.filter((r) => r.status === "pending").length} Menunggu Konfirmasi
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-6 space-y-4">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold font-heading text-sm sm:text-base text-slate-900 dark:text-white">
                          {req.patientName}
                        </p>
                        <span className="text-xs text-slate-500 dark:text-slate-400">({req.patientAge} th)</span>
                      </div>
                      <p className="text-xs font-semibold text-teal-700 dark:text-teal-400">
                        Topik: {req.topic}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-500 dark:text-slate-400 font-nunito">
                        <span className="px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-900 font-semibold">
                          {req.category}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar size={12} className="text-teal-600 dark:text-teal-400" /> {req.date}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} className="text-teal-600 dark:text-teal-400" /> {req.time}
                        </span>
                        <span>•</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{req.type}</span>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {req.status === "pending" ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleAction(req.id, "accepted")}
                            className="text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-3 py-1.5 h-8 font-semibold shadow-xs cursor-pointer gap-1"
                          >
                            <CheckCircle2 size={13} />
                            Terima
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAction(req.id, "declined")}
                            className="text-xs border-slate-200 dark:border-slate-700 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg px-3 py-1.5 h-8 font-semibold cursor-pointer gap-1"
                          >
                            <XCircle size={13} />
                            Tolak
                          </Button>
                        </>
                      ) : (
                        <Badge
                          className={`text-xs ${
                            req.status === "accepted"
                              ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                              : "bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-900"
                          }`}
                        >
                          {req.status === "accepted" ? "Sesi Diterima" : "Ditolak / Diarahkan"}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 font-nunito bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                    <strong className="text-slate-800 dark:text-slate-200">Catatan Pasien: </strong>
                    "{req.notes}"
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Sesi Berlangsung & Panduan Klinis (4 Cols) */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardHeader className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="font-heading text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Video size={16} className="text-teal-600 dark:text-teal-400" />
                Sesi Praktik Terjadwal Terdekat
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 space-y-4">
              {nextActiveSession ? (
                <div className="p-3.5 rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-950/40 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-teal-900 dark:text-teal-200">Sesi {nextActiveSession.time}</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" /> Siap Masuk
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white font-heading">
                    Klien: Pasien Terdaftar ({nextActiveSession.topic})
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 font-nunito">
                    Moda: {nextActiveSession.type} • {nextActiveSession.date}
                  </p>
                  <Link href="/counselor/room">
                    <Button className="w-full text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-lg py-2 h-8 font-semibold shadow-xs cursor-pointer">
                      Buka Ruang Konseling & Catatan SOAP
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-center py-5 space-y-1">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Belum ada sesi terjadwal</p>
                  <p className="text-[11px] text-slate-400 font-nunito">Sesi akan muncul otomatis setelah Anda menyetujui permintaan klien.</p>
                </div>
              )}

              <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2 text-xs">
                <p className="font-bold text-slate-800 dark:text-slate-200">Protokol Krisis Darurat Klien</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-nunito leading-relaxed">
                  Jika klien menunjukkan indikasi risiko bahaya diri aktif (suicidal ideation), segera rujuk ke hotline nasional SEJIWA 119 ext. 8 dan koordinasikan dengan administrator.
                </p>
                <Link href="/help-center" className="text-[11px] text-teal-700 dark:text-teal-400 font-semibold hover:underline block">
                  Lihat Dokumen SOP HIMPSI →
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 4. Client Satisfaction & Testimonials Section */}
      <Card className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
        <CardHeader className="p-5 sm:p-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="font-heading text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Star size={18} className="fill-amber-400 text-amber-500" />
              <span>Evaluasi & Kepuasan Pasien Terbaru</span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
              Ulasan terverifikasi pasca sesi telekonseling yang diselesaikan pasien
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-bold font-mono">
              <Star size={13} className="fill-amber-500 text-amber-500" />
              <span>4.9 / 5.0</span>
            </div>
            <Badge className="bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800 text-xs py-1 px-2.5">
              98% Kepuasan Klien
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-5 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {counselorReviews.map((rev) => (
              <div
                key={rev.id}
                className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 flex flex-col justify-between space-y-3 hover:border-teal-300 dark:hover:border-teal-700 transition-all shadow-2xs"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={14}
                          className={
                            s <= rev.rating
                              ? "fill-amber-400 text-amber-500"
                              : "text-slate-300 dark:text-slate-600"
                          }
                        />
                      ))}
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">{rev.createdAt}</span>
                  </div>

                  <p className="text-xs text-slate-700 dark:text-slate-300 italic font-nunito leading-relaxed">
                    "{rev.comment}"
                  </p>

                  <div className="flex flex-wrap gap-1 pt-1">
                    {rev.aspectTags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-teal-800 dark:text-teal-300"
                      >
                        ✓ {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200 font-heading">
                    {rev.isAnonymous ? "Klien Anonim" : rev.patientName}
                  </span>
                  <span className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 size={11} /> Sesi Selesai
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
