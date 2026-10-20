"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Consultant,
} from "@/constant/beranda";
import { userService } from "@/services/user.service";
import type { PublicPsychologist } from "@/types/user-profile";
import {
  Calendar,
  Search,
  ChevronRight,
  MessageCircle,
  ShieldCheck,
  Clock,
  AlertCircle,
  Star,
  HeartHandshake,
  Users,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { MdVerified } from "react-icons/md";
import { useUserStore } from "@/store/user-store";
import { usePeerVentStore } from "@/store/peer-vent-store";
import { VentingModalForm } from "@/components/views/patient/venting-modal-form";
import { PsychologistProfileModal } from "@/components/views/patient/psychologist-profile-modal";
import { PsychologistCard } from "@/components/views/patient/psychologist-card";
import { Skeleton } from "@/components/ui/skeleton";
import { MaintenanceDrainingBanner } from "@/components/shared/maintenance-draining-banner";
import { BookingModal } from "@/components/views/schedule/booking-modal";
import { bookingClient } from "@/services/booking.client";
import type { PatientBookingView } from "@/types/booking";
import type { PasienProfile } from "@/types/user-profile";
import { formatWibDateFull, formatWibTime, BOOKING_STATUS_CONFIG } from "@/lib/booking-utils";

export default function PatientBerandaPage() {
  const [mounted, setMounted] = useState<boolean>(false);
  const user = useUserStore((state) => state.user);
  const isProfileLoaded = useUserStore((state) => state.isProfileLoaded);
  const [ventingModalOpen, setVentingModalOpen] = useState(false);
  const myActivePost = usePeerVentStore((state) => state.myActivePost);

  // Modal states for psychologist profile & booking
  const [selectedConsultant, setSelectedConsultant] = useState<Consultant | null>(null);
  const [selectedPsychologist, setSelectedPsychologist] = useState<PublicPsychologist | null>(null);
  const [psychologistSearch, setPsychologistSearch] = useState<string>("");
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingConsultantId, setBookingConsultantId] = useState<number | undefined>(undefined);
  const [selectedSlotIso, setSelectedSlotIso] = useState<string | undefined>(undefined);

  // Dynamic Psychologists from API
  const [psychologists, setPsychologists] = useState<PublicPsychologist[]>([]);
  const [loadingPsychologists, setLoadingPsychologists] = useState<boolean>(true);

  // Dynamic Upcoming Bookings from API
  const [upcomingBookings, setUpcomingBookings] = useState<PatientBookingView[]>([]);
  const [loadingUpcoming, setLoadingUpcoming] = useState<boolean>(true);

  useEffect(() => {
    setMounted(true);

    async function loadPsychologists() {
      try {
        const res = await userService.getPsychologists({ limit: 50 });
        if (res && res.success && Array.isArray(res.data)) {
          setPsychologists(res.data);
        }
      } catch (err) {
        console.error("Gagal memuat psikolog terverifikasi:", err);
      } finally {
        setLoadingPsychologists(false);
      }
    }

    async function loadUpcomingBookings() {
      try {
        const res = await bookingClient.getBookings({ scope: "upcoming", limit: 5 });
        if (res && res.success && Array.isArray(res.data)) {
          setUpcomingBookings(res.data as PatientBookingView[]);
        }
      } catch (err) {
        console.error("Gagal memuat booking mendatang:", err);
      } finally {
        setLoadingUpcoming(false);
      }
    }

    loadPsychologists();
    loadUpcomingBookings();
  }, []);

  const isEmergencyContactEmpty = React.useMemo(() => {
    if (!mounted || !isProfileLoaded) return false;
    const rawContact = (user.rawProfile as PasienProfile | null)?.kontak_darurat_nama;
    const storeContact = user.emergencyContact;
    return (!rawContact || !rawContact.trim()) && (!storeContact || !storeContact.trim());
  }, [mounted, isProfileLoaded, user.rawProfile, user.emergencyContact]);

  const filteredPsychologists = React.useMemo(() => {
    if (!psychologistSearch.trim()) return psychologists;
    const q = psychologistSearch.toLowerCase();
    return psychologists.filter(
      (p) =>
        p.nama_lengkap_gelar.toLowerCase().includes(q) ||
        p.spesialisasi.some((s) => s.toLowerCase().includes(q))
    );
  }, [psychologists, psychologistSearch]);

  const convertToConsultant = (p: PublicPsychologist): Consultant => {
    const initials =
      p.nama_lengkap_gelar
        .replace(/(Dr\.|M\.Psi|Psikolog|,|\.)/g, "")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() || "")
        .join("") || "PS";

    return {
      id: 1,
      name: p.nama_lengkap_gelar,
      title: `Psikolog Klinis (${p.tahun_pengalaman} Thn Pengalaman)`,
      specialty: p.spesialisasi.join(", ") || "Konseling & Terapi Klinis",
      licenseNumber: "SIPPK Terverifikasi",
      experienceYears: p.tahun_pengalaman,
      rating: 5.0,
      reviews: 0,
      initials,
      available: true,
      nextSlot: "Jadwal Tersedia",
      almamater: "Magister Profesi Psikologi",
      bio: `Psikolog klinis berlisensi dengan keahlian di bidang ${p.spesialisasi.join(", ") || "kesehatan mental"}.`,
      approaches: ["CBT", "Mindfulness", "Solution-Focused Brief Therapy"],
      handledTopics: p.spesialisasi,
      hourlyRateCoins: Math.round(Number(p.tarif_sesi) / 10000) || 15,
      consultationMethods: ["Chat Eksklusif", "Voice Call"],
    };
  };

  const getGreetingName = () => {
    if (!mounted) return "";
    if (user.alias) return user.alias;
    if (user.fullName) return user.fullName.trim().split(" ")[0];
    if (user.email) return user.email.split("@")[0];
    return "Sahabat";
  };
  const displayName = getGreetingName();

  return (
    <div className="space-y-6 sm:space-y-8 font-nunito pb-10 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <MaintenanceDrainingBanner />

      {/* 1. Header Welcome Sanctuary Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-900 via-teal-950 to-slate-950 text-white p-6 sm:p-7 xl:p-8 2xl:p-10 shadow-lg border border-teal-800/60 dark:border-teal-900/40">
        {/* Calming ambient background glow */}
        <div className="absolute top-0 right-10 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 left-10 w-60 h-60 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5 xl:gap-6">
          <div className="space-y-3.5 flex-1 min-w-0 max-w-4xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-800/60 border border-teal-700/60 text-teal-200 text-xs font-semibold backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Ruang Suaka & Pendampingan Pasien</span>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold font-heading text-white tracking-tight leading-snug">
              Selamat Datang,{" "}
              {!isProfileLoaded ? (
                <Skeleton className="inline-block w-40 sm:w-48 h-8 sm:h-9 md:h-10 align-middle bg-teal-800/70 rounded-xl" />
              ) : (
                displayName
              )}
            </h1>

            <p className="text-sm sm:text-base text-teal-100/80 leading-relaxed max-w-xl">
              Setiap emosi yang kamu rasakan adalah valid. Ambil jeda, tarik napas perlahan, dan ketahuilah bahwa kamu tidak sendirian. Psikolog klinis dan AI empatik kami siap mendampingimu.
            </p>

            <div className="flex flex-wrap xl:flex-nowrap items-center gap-2 xl:gap-2 2xl:gap-2.5 pt-2">
              <Link href="/patient/room" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl px-3.5 xl:px-3 2xl:px-4 h-10 xl:h-10 text-xs sm:text-xs 2xl:text-sm cursor-pointer shadow-md shadow-emerald-500/20 gap-1.5 sm:gap-2 whitespace-nowrap">
                  <MessageCircle size={15} />
                  <span>Curhat AI Instan (24/7)</span>
                </Button>
              </Link>
              <Button
                type="button"
                onClick={() => setVentingModalOpen(true)}
                className="w-full sm:w-auto border border-pink-500/50 bg-pink-950/40 hover:bg-pink-900/60 text-pink-100 font-semibold rounded-xl px-3.5 xl:px-3 2xl:px-4 h-10 xl:h-10 text-xs sm:text-xs 2xl:text-sm cursor-pointer gap-1.5 sm:gap-2 backdrop-blur-md shadow-xs whitespace-nowrap"
              >
                <HeartHandshake size={15} className="text-pink-400" />
                <span>Curhat Pendengar Sebaya</span>
              </Button>
              <Link href="/patient/schedule?booking=true" className="w-full sm:w-auto">
                <Button variant="outline" className="w-full sm:w-auto border-teal-700/80 bg-teal-900/50 hover:bg-teal-800/60 text-teal-100 font-semibold rounded-xl px-3.5 xl:px-3 2xl:px-4 h-10 xl:h-10 text-xs sm:text-xs 2xl:text-sm cursor-pointer gap-1.5 sm:gap-2 whitespace-nowrap">
                  <Calendar size={15} />
                  <span>Reservasi Sesi Psikolog</span>
                </Button>
              </Link>
            </div>
          </div>

          {/* Clinical Assurance Mini-Card */}
          <div className="rounded-2xl bg-teal-900/40 border border-teal-700/50 p-4 sm:p-5 backdrop-blur-md w-full lg:w-60 xl:w-64 2xl:w-72 shrink-0 space-y-3">
            <div className="flex items-center gap-2.5 text-emerald-300 font-semibold text-xs">
              <ShieldCheck size={18} />
              <span>Standar Etika Medis HIMPSI</span>
            </div>
            <p className="text-xs text-teal-100/70 leading-relaxed font-nunito">
              Semua sesi konseling dan catatan refleksi berada di bawah perlindungan kode etik kerahasiaan psikolog.
            </p>
            <div className="pt-1 flex items-center justify-between border-t border-teal-800/80 text-[11px] text-teal-300 font-medium">
              <span>Sesi Terjadwal: {loadingUpcoming ? "..." : `${upcomingBookings.length} Sesi`}</span>
              <Link href="/patient/schedule" className="text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold">
                Lihat Jadwal →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Banner: Lengkapi Kontak Darurat */}
      {isEmergencyContactEmpty && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertCircle className="size-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="space-y-0.5">
              <h4 className="font-bold font-heading text-sm text-amber-950 dark:text-amber-100">
                Lengkapi Kontak Darurat
              </h4>
              <p className="text-xs text-amber-800 dark:text-amber-300 font-nunito leading-relaxed">
                Informasi kontak darurat Anda belum lengkap. Kontak ini wajib sesuai SOP telekonseling klinis untuk penanganan cepat saat kondisi krisis.
              </p>
            </div>
          </div>
          <Link href="/patient/settings" className="shrink-0 self-start sm:self-center">
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl text-xs px-3.5 py-1.5 h-8 gap-1.5 shadow-xs cursor-pointer">
              <span>Lengkapi Sekarang</span>
              <ArrowRight size={13} />
            </Button>
          </Link>
        </div>
      )}

      {/* Main 2-Column Clinical Dashboard Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
        {/* Left Column (8 Cols on Desktop) */}
        <div className="lg:col-span-8 space-y-6 sm:space-y-8">


          {/* Banner: Curhat Pendengar Sebaya (Peer Listener) */}
          {myActivePost && myActivePost.status === "menunggu" ? (
            <div className="relative overflow-hidden rounded-2xl border border-amber-200/90 dark:border-amber-900/60 bg-gradient-to-br from-amber-50/80 via-white to-amber-50/40 dark:from-amber-950/40 dark:via-slate-900 dark:to-slate-900 p-5 sm:p-6 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                  <Badge className="bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-200 text-[10px] font-semibold">
                    Status: Menunggu Pendengar Sebaya
                  </Badge>
                  <span className="text-[11px] text-slate-400">{myActivePost.createdAt}</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setVentingModalOpen(true)}
                  className="text-xs border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 rounded-xl self-start sm:self-auto"
                >
                  Tulis Cerita Baru
                </Button>
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white font-heading">
                  Topik: {myActivePost.topic} ({myActivePost.isAnonymous ? myActivePost.patientAlias : "Kamu"})
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-nunito leading-relaxed italic line-clamp-2">
                  "{myActivePost.content}"
                </p>
              </div>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium pt-1">
                Relawan PFA sedang meninjau antrean. Kamu akan menerima pemberitahuan begitu ada pendengar yang merespons.
              </p>
            </div>
          ) : myActivePost && myActivePost.status === "ditangani" ? (
            <div className="relative overflow-hidden rounded-2xl border border-emerald-200/90 dark:border-emerald-900/60 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/40 dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1.5 max-w-xl">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <Badge className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-200 text-[10px] font-semibold">
                    Telah Direspons oleh {myActivePost.handledByListenerName || "Dewi"}
                  </Badge>
                </div>
                <h3 className="text-base font-bold font-heading text-slate-900 dark:text-white">
                  Ruang Curhat Sebaya Sedang Aktif
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-nunito line-clamp-2 leading-relaxed">
                  Tanggapan pertama: "{myActivePost.firstResponse}"
                </p>
              </div>
              <Link href="/patient/room?type=peer" className="shrink-0 self-start sm:self-center">
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl px-4 py-2 text-xs shadow-xs cursor-pointer gap-1.5">
                  <MessageCircle size={14} />
                  <span>Masuk Ruang Chat</span>
                </Button>
              </Link>
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-2xl border border-pink-200/90 dark:border-pink-900/60 bg-gradient-to-br from-pink-50/80 via-white to-rose-50/50 dark:from-pink-950/40 dark:via-slate-900 dark:to-slate-900 p-5 sm:p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-2 max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300">
                      <HeartHandshake size={16} />
                    </span>
                    <Badge className="bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300 border-pink-200 text-[10px] font-semibold">
                      100% Anonim & Bebas Biaya
                    </Badge>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold font-heading text-slate-900 dark:text-white">
                    Butuh Teman Cerita Tanpa Takut Dihakimi?
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-nunito leading-relaxed">
                    Ceritakan beban hari ini kepada Relawan Pendengar Sebaya terlatih PFA (Psychological First Aid). Ruang aman untuk meluapkan uneg-uneg, rasa kesepian, dan burnout kerja.
                  </p>
                </div>

                <Button
                  type="button"
                  onClick={() => setVentingModalOpen(true)}
                  className="bg-pink-600 hover:bg-pink-700 text-white font-semibold rounded-xl px-4 py-2.5 text-xs shadow-xs cursor-pointer gap-1.5 shrink-0 self-start sm:self-center"
                >
                  <Users size={14} />
                  <span>Curhat Sebaya Sekarang</span>
                </Button>
              </div>
            </div>
          )}

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

                <Badge variant="outline" className="border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs shrink-0">
                  {loadingUpcoming ? "Memuat..." : `${upcomingBookings.length} Terjadwal`}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-6">
              {loadingUpcoming ? (
                <div className="space-y-3">
                  {[1, 2].map((n) => (
                    <div
                      key={n}
                      className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 animate-pulse flex items-center justify-between"
                    >
                      <div className="space-y-2">
                        <Skeleton className="w-40 h-4" />
                        <Skeleton className="w-28 h-3" />
                      </div>
                      <Skeleton className="w-20 h-6 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : upcomingBookings.length > 0 ? (
                <div className="space-y-3">
                  {upcomingBookings.slice(0, 3).map((b) => (
                    <div
                      key={b.id}
                      className="p-3.5 sm:p-4 rounded-xl border border-teal-100 dark:border-teal-900/50 bg-teal-50/30 dark:bg-teal-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900 dark:text-white font-heading">
                            {b.psikolog?.nama_lengkap_gelar || "Psikolog TemanBicara"}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                            {BOOKING_STATUS_CONFIG[b.status]?.label || b.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
                          {formatWibDateFull(b.start_at)} • Pukul {formatWibTime(b.start_at)} WIB
                        </p>
                      </div>
                      <Link href="/patient/schedule" className="shrink-0 self-start sm:self-center">
                        <Button size="sm" variant="outline" className="text-xs rounded-xl h-8 border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300">
                          Detail Sesi
                        </Button>
                      </Link>
                    </div>
                  ))}
                  {upcomingBookings.length > 3 && (
                    <div className="text-center pt-1">
                      <Link href="/patient/schedule" className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline">
                        Lihat {upcomingBookings.length - 3} sesi lainnya →
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-10 flex flex-col items-center justify-center text-center gap-2.5">
                  <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-100 dark:border-teal-900 flex items-center justify-center text-teal-600 dark:text-teal-400">
                    <Calendar size={24} />
                  </div>
                  <div className="space-y-1">
                    <p className="font-heading font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                      Belum Ada Jadwal Sesi
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md font-nunito">
                      Sesi konseling klinis terjadwal bersama psikolog akan tampil di sini saat jadwal tiba.
                    </p>
                  </div>
                  <Link href="/patient/schedule?booking=true">
                    <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl text-xs mt-1 cursor-pointer">
                      Reservasi Sesi Sekarang
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column (4 Cols on Desktop) */}
        <div className="lg:col-span-4 space-y-6 sm:space-y-8">
          {/* 5. Verified Psychologists Card */}
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

                <Link href="/patient/schedule" className="shrink-0">
                  <span className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 flex items-center gap-0.5">
                    Semua <ChevronRight size={13} />
                  </span>
                </Link>
              </div>
            </CardHeader>

            <CardContent className="p-3 sm:p-4 space-y-3">
              {psychologists.length > 2 && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                  <Input
                    placeholder="Cari psikolog / spesialisasi..."
                    value={psychologistSearch}
                    onChange={(e) => setPsychologistSearch(e.target.value)}
                    className="pl-8 h-8 text-xs bg-slate-50/70 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              )}

              {loadingPsychologists ? (
                <div className="space-y-2.5">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 animate-pulse flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700" />
                        <div className="space-y-1.5">
                          <div className="w-32 h-3.5 bg-slate-200 dark:bg-slate-700 rounded" />
                          <div className="w-24 h-2.5 bg-slate-200 dark:bg-slate-700 rounded" />
                        </div>
                      </div>
                      <div className="w-14 h-7 bg-slate-200 dark:bg-slate-700 rounded" />
                    </div>
                  ))}
                </div>
              ) : filteredPsychologists.length === 0 ? (
                <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 space-y-1.5">
                  <Users className="w-7 h-7 mx-auto text-slate-400 opacity-60" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {psychologistSearch ? "Tidak ada psikolog yang cocok" : "Belum ada psikolog terverifikasi"}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {psychologistSearch ? "Coba gunakan kata kunci spesialisasi lain." : "Psikolog yang disetujui admin akan tampil otomatis di sini."}
                  </p>
                </div>
              ) : (
                filteredPsychologists.map((psychologist) => (
                  <PsychologistCard
                    key={psychologist.id}
                    psychologist={psychologist}
                    onViewProfile={(p) => {
                      setSelectedPsychologist(p);
                      setIsProfileModalOpen(true);
                    }}
                    onSelectSlot={(p) => {
                      setSelectedPsychologist(p);
                      setIsProfileModalOpen(true);
                    }}
                  />
                ))
              )}
            </CardContent>
          </Card>

          {/* 6. Recent Conversation History Card */}
          <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardHeader className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-heading text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <MessageCircle size={17} className="text-teal-600 dark:text-teal-400" />
                  Sesi & Percakapan Terakhir
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
                  Catatan ruang chat amanmu
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="p-6">
              <div className="py-8 flex flex-col items-center justify-center text-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
                  <MessageCircle size={20} />
                </div>
                <div className="space-y-0.5">
                  <p className="font-heading font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                    Belum Ada Percakapan Sesi
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-nunito max-w-xs">
                    Riwayat percakapan telekonseling Anda akan dicatat otomatis setelah sesi berlangsung.
                  </p>
                </div>
              </div>
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

      {/* Modal Form: Keluh Kesah Pasien */}
      <VentingModalForm open={ventingModalOpen} onOpenChange={setVentingModalOpen} />

      {/* Modal Detail Profil Psikolog */}
      <PsychologistProfileModal
        psychologist={selectedPsychologist}
        consultant={selectedConsultant}
        open={isProfileModalOpen}
        onOpenChange={setIsProfileModalOpen}
        onSelectSlot={(psych, slotIso) => {
          setSelectedPsychologist(psych);
          setSelectedSlotIso(slotIso);
          setIsBookingModalOpen(true);
        }}
        onBookSession={(consultant) => {
          setBookingConsultantId(consultant.id);
          setIsBookingModalOpen(true);
        }}
      />

      {/* Modal Reservasi Sesi Psikolog */}
      <BookingModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        psychologist={selectedPsychologist}
        slotIso={selectedSlotIso}
        initialConsultantId={bookingConsultantId}
      />
    </div>
  );
}
