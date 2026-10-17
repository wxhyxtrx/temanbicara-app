"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  Clock,
  Video,
  ShieldCheck,
  Star,
  Users,
  Wallet,
  FileText,
  UserCheck,
  CalendarDays,
  MessageSquare,
  User,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { MdVerified } from "react-icons/md";
import { useUserStore } from "@/store/user-store";
import { userService } from "@/services/user.service";
import { walletClient } from "@/services/wallet.client";
import { bookingClient } from "@/services/booking.client";
import { notify } from "@/lib/toast";
import {
  formatWibDateFull,
  formatWibTime,
  BOOKING_STATUS_CONFIG,
} from "@/lib/booking-utils";
import { CounselorCancelBookingModal } from "@/components/views/counselor/counselor-cancel-booking-modal";
import type { WalletInfoResponse } from "@/types/wallet";
import type { PsikologProfile } from "@/types/user-profile";
import type { PsikologBookingView } from "@/types/booking";

export default function CounselorBerandaPage() {
  const user = useUserStore((state) => state.user);

  const [wallet, setWallet] = useState<WalletInfoResponse | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(true);
  const [profile, setProfile] = useState<PsikologProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [userMe, setUserMe] = useState<{ fullName?: string; email?: string } | null>(null);

  // Live upcoming bookings for counselor (GET /api/bookings?scope=upcoming)
  const [upcomingBookings, setUpcomingBookings] = useState<PsikologBookingView[]>([]);
  const [loadingBookings, setLoadingBookings] = useState<boolean>(true);
  const [cancelTarget, setCancelTarget] = useState<PsikologBookingView | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);

  const loadUpcomingBookings = useCallback(async () => {
    setLoadingBookings(true);
    try {
      const res = await bookingClient.getBookings({ scope: "upcoming", limit: 50 });
      if (res?.success && Array.isArray(res.data)) {
        setUpcomingBookings(res.data as PsikologBookingView[]);
      }
    } catch (err) {
      console.error("Gagal memuat booking upcoming psikolog:", err);
    } finally {
      setLoadingBookings(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [walletRes, meRes] = await Promise.allSettled([
          walletClient.getWalletMe(),
          userService.getMe(),
        ]);

        if (!isMounted) return;

        if (walletRes.status === "fulfilled") {
          setWallet(walletRes.value);
        }
        if (meRes.status === "fulfilled" && meRes.value.success && meRes.value.data) {
          setUserMe(meRes.value.data.user);
          if (meRes.value.data.profile) {
            setProfile(meRes.value.data.profile as PsikologProfile);
          }
        }
      } catch (err) {
        console.error("Gagal memuat data beranda psikolog:", err);
      } finally {
        if (isMounted) {
          setLoadingWallet(false);
          setLoadingProfile(false);
        }
      }
    }

    loadData();
    loadUpcomingBookings();

    return () => {
      isMounted = false;
    };
  }, [loadUpcomingBookings]);

  const counselorName =
    profile?.nama_lengkap_gelar || userMe?.fullName || user.fullName || "Psikolog Mitra";
  const licenseNumber =
    profile?.nomor_sipp_str || user.counselorData?.licenseNumber || "Belum diatur";
  const specialty =
    Array.isArray(profile?.spesialisasi) && profile.spesialisasi.length > 0
      ? profile.spesialisasi.join(", ")
      : user.counselorData?.specialty || "Psikologi Klinis";

  const rawTarif =
    profile?.tarif_sesi ??
    (user.rawProfile as PsikologProfile | undefined)?.tarif_sesi ??
    user.counselorData?.hourlyRateCoins ??
    0;
  const tarifRupiah = Number(rawTarif) || 0;
  const tarifKoin = Math.floor(tarifRupiah / 10000);
  const tarifDisplay =
    tarifRupiah > 0
      ? `Rp ${tarifRupiah.toLocaleString("id-ID")} / sesi (${tarifKoin.toLocaleString("id-ID")} koin)`
      : "Belum diatur";

  const availableRupiah = wallet?.available_rupiah ?? 0;
  const pendingRupiah = wallet?.pending_rupiah ?? 0;

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
              Selamat Bertugas, {counselorName}
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
              <span>SIPPK: {licenseNumber}</span>
            </div>
            <p className="text-xs text-teal-100/70 leading-relaxed font-nunito">
              Psikolog Klinis Terverifikasi • Spesialisasi {specialty}.
            </p>
            <div className="pt-2 border-t border-teal-800/80 flex items-center justify-between text-[11px] text-teal-300">
              <span className="flex items-center gap-1 font-semibold text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> Praktik Buka
              </span>
              <span className="font-mono text-emerald-200">
                {loadingProfile ? "Memuat tarif..." : tarifDisplay}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. KPI Stat Cards (4 Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Pasien Aktif */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Pasien Aktif</span>
            <span className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-400">
              <Users size={15} />
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-heading text-slate-900 dark:text-white">
            {upcomingBookings.length} <span className="text-xs font-semibold text-slate-500">Sesi Aktif</span>
          </p>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-nunito">
            {upcomingBookings.length > 0 ? "Memiliki janji temu terjadwal" : "Belum ada sesi terjadwal"}
          </span>
        </div>

        {/* Card 2: Sesi Selesai */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Sesi Selesai</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400">
              <UserCheck size={15} />
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-heading text-slate-900 dark:text-white">
            0 <span className="text-xs font-semibold text-slate-500">Sesi</span>
          </p>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-nunito">
            Tersedia setelah fitur booking aktif
          </span>
        </div>

        {/* Card 3: Rating Praktik */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Rating Praktik</span>
            <span className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400">
              <Star size={15} className="fill-amber-400 text-amber-400" />
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-heading text-slate-900 dark:text-white">
            Belum ada
          </p>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-nunito">
            Tersedia setelah fitur booking aktif
          </span>
        </div>

        {/* Card 4: Saldo Siap Cair (Dompet Asli) */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Saldo Siap Cair</span>
            <span className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-400">
              <Wallet size={15} />
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-heading text-teal-900 dark:text-teal-300 font-mono">
            {loadingWallet ? (
              <span className="text-base text-slate-400 font-normal">Memuat...</span>
            ) : (
              `Rp ${availableRupiah.toLocaleString("id-ID")}`
            )}
          </p>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-nunito truncate">
            {loadingWallet
              ? "Menghubungkan ke dompet mitra"
              : pendingRupiah > 0
                ? `Rp ${pendingRupiah.toLocaleString("id-ID")} tertahan (holding)`
                : "Sesuai data dompet mitra"}
          </span>
        </div>
      </div>

      {/* 3. Main 2-Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
        {/* Left Column: Permintaan Janji Temu Masuk (8 Cols) */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="font-heading text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Clock size={18} className="text-teal-600 dark:text-teal-400" />
                    Permintaan Janji Temu Masuk
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
                    Daftar reservasi sesi konseling terjadwal dari klien (bebas data pribadi sensitif)
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 text-xs self-start sm:self-center font-mono">
                    {upcomingBookings.length} Sesi Terjadwal
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadUpcomingBookings}
                    disabled={loadingBookings}
                    className="h-8 px-2 text-xs text-teal-700 dark:text-teal-300"
                    title="Segarkan daftar janji temu"
                  >
                    <RefreshCw size={12} className={loadingBookings ? "animate-spin" : ""} />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-6">
              {loadingBookings ? (
                <div className="space-y-3">
                  {[1, 2].map((n) => (
                    <div
                      key={n}
                      className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 animate-pulse space-y-2"
                    >
                      <Skeleton className="w-48 h-4 bg-slate-200 dark:bg-slate-800" />
                      <Skeleton className="w-full h-10 bg-slate-200 dark:bg-slate-800" />
                    </div>
                  ))}
                </div>
              ) : upcomingBookings.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center gap-2.5">
                  <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-100 dark:border-teal-900 flex items-center justify-center text-teal-600 dark:text-teal-400">
                    <CalendarDays size={24} />
                  </div>
                  <div className="space-y-1">
                    <p className="font-heading font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                      Belum Ada Janji Temu Masuk
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md font-nunito">
                      Reservasi jadwal dari pasien akan otomatis tercantum di sini secara langsung.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {upcomingBookings.map((b) => {
                    const statusConfig = BOOKING_STATUS_CONFIG[b.status] || {
                      label: b.status,
                      badgeClass: "bg-slate-100 text-slate-700",
                    };
                    const dateFull = formatWibDateFull(b.start_at);
                    const timeWib = formatWibTime(b.start_at);

                    return (
                      <div
                        key={b.id}
                        className="p-4 sm:p-5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-teal-300 dark:hover:border-teal-700 transition-all shadow-2xs space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-400 flex items-center justify-center shrink-0">
                              <User size={16} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-sm text-slate-900 dark:text-white font-heading">
                                  {b.patient_display_name}
                                </p>
                                <Badge className={`${statusConfig.badgeClass} text-[10px] font-semibold py-0 px-2`}>
                                  {statusConfig.label}
                                </Badge>
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                Sesi Konseling Privat 45 Menit • Biaya Sesi {b.price_coins} Koin
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                            <Clock size={13} className="text-teal-600 dark:text-teal-400 shrink-0" />
                            <span>{dateFull}, {timeWib}</span>
                          </div>
                        </div>

                        {/* Keluhan Pasien (Sesuai Review Focus #5: Bebas data pribadi pasien) */}
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 text-xs text-slate-700 dark:text-slate-300">
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-0.5">
                            Keluhan yang Dikirim Klien:
                          </span>
                          <p className="italic leading-relaxed">"{b.keluhan}"</p>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {b.status === "booked" ? (
                              <span className="text-teal-700 dark:text-teal-400 font-medium">Terkonfirmasi</span>
                            ) : b.status === "awaiting_patient_choice" ? (
                              <span className="text-amber-600 font-medium">Dibatalkan psikolog (menunggu keputusan klien)</span>
                            ) : (
                              <span>{b.status}</span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {b.status === "booked" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setCancelTarget(b);
                                  setIsCancelModalOpen(true);
                                }}
                                className="text-xs border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl h-8 px-3 gap-1"
                              >
                                <XCircle size={12} />
                                <span>Batalkan</span>
                              </Button>
                            )}

                            <Link href="/counselor/room">
                              <Button
                                size="sm"
                                className="text-xs bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl h-8 px-3.5 gap-1.5 shadow-xs"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                                <span>Masuk Sesi</span>
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
              {upcomingBookings.length > 0 ? (
                <div className="p-4 rounded-xl border border-teal-200/80 dark:border-teal-800 bg-teal-50/40 dark:bg-teal-950/30 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <Badge className="bg-teal-600 text-white text-[10px]">Terdekat</Badge>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {formatWibTime(upcomingBookings[0].start_at)}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      {upcomingBookings[0].patient_display_name}
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      {formatWibDateFull(upcomingBookings[0].start_at)}
                    </p>
                  </div>
                  <Link href="/counselor/room" className="block pt-1">
                    <Button size="sm" className="w-full text-xs bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl h-8 gap-1.5 shadow-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                      <span>Masuk Ruang Sesi</span>
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-center py-6 space-y-2">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Belum ada sesi terjadwal
                  </p>
                  <p className="text-[11px] text-slate-400 font-nunito">
                    Sesi konseling yang disetujui akan muncul di sini saat jadwal tiba.
                  </p>
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
            <Badge variant="outline" className="border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs py-1 px-2.5">
              Belum Ada Rating
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <div className="py-12 flex flex-col items-center justify-center text-center gap-2.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-100 dark:border-amber-900 flex items-center justify-center text-amber-500">
              <Star size={24} />
            </div>
            <div className="space-y-1">
              <p className="font-heading font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                Belum Ada Evaluasi Pasien
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md font-nunito">
                Ulasan dan evaluasi klinis dari pasien akan ditampilkan di sini setelah sesi konseling selesai dilaksanakan.
              </p>
            </div>
            <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/80 px-2.5 py-1 rounded-full border border-teal-200 dark:border-teal-800">
              Tersedia setelah fitur booking aktif
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Modal Batalkan Booking (Psikolog) */}
      <CounselorCancelBookingModal
        booking={cancelTarget}
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        onSuccess={() => {
          notify.success(
            "Janji Temu Dibatalkan",
            "Sesi telah dibatalkan. Klien akan diarahkan untuk memilih jadwal pengganti atau refund."
          );
          loadUpcomingBookings();
        }}
      />
    </div>
  );
}
