"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { SessionRoomView } from "@/components/views/session/session-room-view";
import { bookingClient } from "@/services/booking.client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  Calendar,
  MessageSquare,
  ArrowRight,
  AlertCircle,
  Clock,
  History,
  FileText,
  Star,
} from "lucide-react";
import type { PsikologBookingView } from "@/types/booking";
import { formatWibDateFull, formatWibTime } from "@/lib/booking-utils";

function getStatusBadge(status: string) {
  switch (status) {
    case "in_progress":
      return {
        label: "Sedang Berlangsung",
        className:
          "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300",
      };
    case "booked":
      return {
        label: "Terjadwal",
        className:
          "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300",
      };
    case "completed":
      return {
        label: "Selesai",
        className:
          "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300",
      };
    case "no_show":
      return {
        label: "Tidak Hadir (No Show)",
        className:
          "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950 dark:text-rose-300",
      };
    case "auto_cancelled_late":
      return {
        label: "Batal Otomatis",
        className:
          "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300",
      };
    case "cancelled_by_patient":
      return {
        label: "Dibatalkan Pasien",
        className:
          "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300",
      };
    case "cancelled_by_psikolog":
      return {
        label: "Dibatalkan Konselor",
        className:
          "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300",
      };
    default:
      return {
        label: status,
        className:
          "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300",
      };
  }
}

function CounselorRoomContent() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("booking") || searchParams.get("booking_id");

  const [activeBookings, setActiveBookings] = useState<PsikologBookingView[]>([]);
  const [historyBookings, setHistoryBookings] = useState<PsikologBookingView[]>([]);
  const [loading, setLoading] = useState<boolean>(!bookingId);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (bookingId) return;

    let isMounted = true;
    async function loadBookings() {
      try {
        setLoading(true);
        setLoadError(null);

        const [upcomingRes, historyRes] = await Promise.all([
          bookingClient
            .getBookings({ scope: "upcoming", limit: 50 })
            .catch((err) => ({
              success: false as const,
              data: [] as PsikologBookingView[],
              error: err instanceof Error ? err.message : "Gagal memuat sesi aktif",
            })),
          bookingClient
            .getBookings({ scope: "history", limit: 50 })
            .catch((err) => ({
              success: false as const,
              data: [] as PsikologBookingView[],
              error: err instanceof Error ? err.message : "Gagal memuat riwayat sesi",
            })),
        ]);

        if (!isMounted) return;

        if (!upcomingRes.success && !historyRes.success) {
          setLoadError("Gagal memuat data sesi konseling dari server.");
          return;
        }

        if (upcomingRes.success && Array.isArray(upcomingRes.data)) {
          const list = upcomingRes.data as PsikologBookingView[];
          const relevantActive = list.filter(
            (b: PsikologBookingView) => b.status === "in_progress" || b.status === "booked"
          );
          setActiveBookings(relevantActive);
        }

        if (historyRes.success && Array.isArray(historyRes.data)) {
          const list = historyRes.data as PsikologBookingView[];
          const relevantHistory = list.filter(
            (b: PsikologBookingView) =>
              b.status === "completed" ||
              b.status === "no_show" ||
              b.status === "auto_cancelled_late" ||
              b.status === "cancelled_by_patient" ||
              b.status === "cancelled_by_psikolog"
          );
          setHistoryBookings(relevantHistory);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setLoadError(err instanceof Error ? err.message : "Gagal memuat jadwal sesi.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadBookings();

    return () => {
      isMounted = false;
    };
  }, [bookingId]);

  // Jika parameter booking ID terlampir, render ruang sesi langsung
  if (bookingId) {
    return <SessionRoomView bookingId={bookingId} role="psikolog" />;
  }

  // Jika tidak ada booking ID, tampilkan selektor sesi aktif & riwayat
  if (loading) {
    return (
      <div className="h-[calc(100vh-120px)] flex flex-col items-center justify-center p-8 text-center space-y-3 font-nunito">
        <Loader2 size={32} className="animate-spin text-teal-600" />
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Memeriksa jadwal sesi konseling Anda...
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="h-[calc(100vh-120px)] flex flex-col items-center justify-center p-8 text-center space-y-4 font-nunito max-w-md mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 text-rose-600 flex items-center justify-center">
          <AlertCircle size={28} />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Gagal Memuat Sesi</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">{loadError}</p>
        </div>
        <Link href="/counselor/beranda">
          <Button variant="outline" size="sm" className="text-xs rounded-xl">
            Kembali ke Beranda
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 font-nunito space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold font-heading text-slate-900 dark:text-white">
          Ruang Konseling Klinis
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Pilih salah satu sesi aktif untuk memulai telekonseling privat atau tinjau catatan rekam sesi sebelumnya.
        </p>
      </div>

      <Tabs defaultValue="active" className="w-full space-y-4">
        <TabsList className="bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl flex w-full sm:w-auto overflow-x-auto justify-start border border-slate-200/80 dark:border-slate-800">
          <TabsTrigger
            value="active"
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-teal-800 dark:data-[state=active]:text-teal-300 text-slate-600 dark:text-slate-400 data-[state=active]:shadow-xs rounded-lg px-3.5 py-1.5 text-xs font-semibold flex items-center gap-2 cursor-pointer"
          >
            <Calendar size={14} />
            <span>Sesi Aktif</span>
            <Badge
              variant="secondary"
              className="ml-1 text-[10px] px-1.5 py-0 rounded-full font-bold bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border-none"
            >
              {activeBookings.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-teal-800 dark:data-[state=active]:text-teal-300 text-slate-600 dark:text-slate-400 data-[state=active]:shadow-xs rounded-lg px-3.5 py-1.5 text-xs font-semibold flex items-center gap-2 cursor-pointer"
          >
            <History size={14} />
            <span>Riwayat Sesi</span>
            <Badge
              variant="secondary"
              className="ml-1 text-[10px] px-1.5 py-0 rounded-full font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-none"
            >
              {historyBookings.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: SESI AKTIF */}
        <TabsContent value="active" className="space-y-3">
          {activeBookings.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl space-y-3 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/70 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-400 flex items-center justify-center mx-auto">
                <Calendar size={24} />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Tidak Ada Sesi Aktif Saat Ini
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Anda tidak memiliki sesi konseling yang sedang berjalan atau terjadwal dalam waktu dekat.
                </p>
              </div>
              <Link href="/counselor/beranda" className="inline-block pt-2">
                <Button size="sm" variant="outline" className="text-xs rounded-xl">
                  Buka Beranda Konselor
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {activeBookings.map((b) => {
                const badgeInfo = getStatusBadge(b.status);
                return (
                  <div
                    key={b.id}
                    className="p-4 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:border-teal-300 dark:hover:border-teal-700"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {b.patient_display_name || "Pasien Anonim"}
                        </h3>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-2 py-0.5 ${badgeInfo.className}`}
                        >
                          {badgeInfo.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-1">
                          <Calendar size={13} className="text-teal-600" />
                          <span>{formatWibDateFull(b.start_at)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock size={13} className="text-teal-600" />
                          <span>{formatWibTime(b.start_at)}</span>
                        </div>
                      </div>
                      {b.keluhan && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1 italic">
                          &ldquo;{b.keluhan}&rdquo;
                        </p>
                      )}
                    </div>

                    <Link href={`/counselor/room?booking=${b.id}`} className="shrink-0">
                      <Button
                        size="sm"
                        className="w-full sm:w-auto text-xs bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl h-8 px-4 gap-1.5 shadow-xs cursor-pointer"
                      >
                        <MessageSquare size={13} />
                        <span>Masuk Sesi</span>
                        <ArrowRight size={13} />
                      </Button>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: RIWAYAT SESI */}
        <TabsContent value="history" className="space-y-3">
          {historyBookings.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl space-y-3 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center mx-auto border border-slate-200 dark:border-slate-700">
                <History size={24} />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Belum Ada Riwayat Sesi
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Belum ada catatan sesi konseling yang telah selesai, dibatalkan, atau lewat jadwal sebelumnya.
                </p>
              </div>
              <Link href="/counselor/schedule" className="inline-block pt-2">
                <Button size="sm" variant="outline" className="text-xs rounded-xl">
                  Kelola Jadwal Praktik
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {historyBookings.map((b) => {
                const badgeInfo = getStatusBadge(b.status);
                return (
                  <div
                    key={b.id}
                    className="p-4 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:border-slate-300 dark:hover:border-slate-700"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {b.patient_display_name || "Pasien Anonim"}
                        </h3>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-2 py-0.5 ${badgeInfo.className}`}
                        >
                          {badgeInfo.label}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1.5 py-0 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800"
                        >
                          Read-only
                        </Badge>
                        {b.review && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                            <Star size={11} className="fill-amber-500 text-amber-500" />
                            <span>{b.review.rating}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-1">
                          <Calendar size={13} className="text-slate-400" />
                          <span>{formatWibDateFull(b.start_at)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock size={13} className="text-slate-400" />
                          <span>{formatWibTime(b.start_at)}</span>
                        </div>
                      </div>
                      {b.keluhan && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 italic">
                          &ldquo;{b.keluhan}&rdquo;
                        </p>
                      )}
                    </div>

                    <Link href={`/counselor/room?booking=${b.id}`} className="shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full sm:w-auto text-xs font-semibold rounded-xl h-8 px-3.5 gap-1.5 border-slate-300 dark:border-slate-700 hover:border-teal-500 hover:text-teal-600 dark:hover:text-teal-400 transition-colors cursor-pointer"
                      >
                        <FileText size={13} />
                        <span>Buka Rekam Sesi</span>
                        <ArrowRight size={13} />
                      </Button>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function CounselorRoomPage() {
  return (
    <Suspense
      fallback={
        <div className="h-[calc(100vh-120px)] flex flex-col items-center justify-center p-8 text-center space-y-3 font-nunito">
          <Loader2 size={32} className="animate-spin text-teal-600" />
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Menyiapkan ruang sesi konselor...
          </p>
        </div>
      }
    >
      <CounselorRoomContent />
    </Suspense>
  );
}
