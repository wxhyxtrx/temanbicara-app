"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { SessionRoomView } from "@/components/views/session/session-room-view";
import { bookingClient } from "@/services/booking.client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, MessageSquare, ArrowRight, AlertCircle, Clock } from "lucide-react";
import type { PsikologBookingView } from "@/types/booking";
import { formatWibDateFull, formatWibTime } from "@/lib/booking-utils";

function CounselorRoomContent() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("booking") || searchParams.get("booking_id");

  const [activeBookings, setActiveBookings] = useState<PsikologBookingView[]>([]);
  const [loading, setLoading] = useState<boolean>(!bookingId);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (bookingId) return;

    let isMounted = true;
    async function loadBookings() {
      try {
        setLoading(true);
        setLoadError(null);
        const res = await bookingClient.getBookings({ scope: "upcoming", limit: 50 });
        if (isMounted && res.success && Array.isArray(res.data)) {
          const list = res.data as PsikologBookingView[];
          // Filter sesi aktif (booked atau in_progress)
          const relevant = list.filter(
            (b: PsikologBookingView) => b.status === "in_progress" || b.status === "booked"
          );
          setActiveBookings(relevant);
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

  // Jika tidak ada booking ID, tampilkan selektor sesi aktif
  if (loading) {
    return (
      <div className="h-[calc(100vh-120px)] flex flex-col items-center justify-center p-8 text-center space-y-3 font-nunito">
        <Loader2 size={32} className="animate-spin text-teal-600" />
        <p className="text-sm text-slate-600 dark:text-slate-300">Memeriksa jadwal sesi aktif Anda...</p>
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
          Pilih salah satu sesi aktif atau terjadwal di bawah ini untuk memasuki ruang telekonseling privat.
        </p>
      </div>

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
          {activeBookings.map((b) => (
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
                    className={`text-[10px] px-2 py-0.5 ${
                      b.status === "in_progress"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300"
                    }`}
                  >
                    {b.status === "in_progress" ? "Sedang Berlangsung" : "Terjadwal"}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1">
                    <Calendar size={13} className="text-teal-600" />
                    <span>{formatWibDateFull(b.start_at)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock size={13} className="text-teal-600" />
                    <span>{formatWibTime(b.start_at)} WIB</span>
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
          ))}
        </div>
      )}
    </div>
  );
}

export default function CounselorRoomPage() {
  return (
    <Suspense
      fallback={
        <div className="h-[calc(100vh-120px)] flex flex-col items-center justify-center p-8 text-center space-y-3 font-nunito">
          <Loader2 size={32} className="animate-spin text-teal-600" />
          <p className="text-sm text-slate-600 dark:text-slate-300">Menyiapkan ruang sesi konselor...</p>
        </div>
      }
    >
      <CounselorRoomContent />
    </Suspense>
  );
}
