"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { SessionRoomView } from "@/components/views/session/session-room-view";
import { Button } from "@/components/ui/button";
import { CalendarX, Loader2 } from "lucide-react";

function PatientSessionQueryContent() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("booking") || searchParams.get("booking_id");

  if (!bookingId) {
    return (
      <div className="h-[calc(100vh-120px)] flex flex-col items-center justify-center p-8 text-center space-y-4 font-nunito max-w-md mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800 text-amber-600 flex items-center justify-center">
          <CalendarX size={28} />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">ID Sesi Belum Dipilih</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Silakan pilih sesi konseling aktif dari halaman jadwal janji temu Anda.
          </p>
        </div>
        <Link href="/patient/schedule">
          <Button variant="outline" size="sm" className="text-xs rounded-xl">
            Buka Jadwal Saya
          </Button>
        </Link>
      </div>
    );
  }

  return <SessionRoomView bookingId={bookingId} role="pasien" />;
}

export default function PatientSessionPage() {
  return (
    <Suspense
      fallback={
        <div className="h-[calc(100vh-120px)] flex flex-col items-center justify-center p-8 text-center space-y-3 font-nunito">
          <Loader2 size={32} className="animate-spin text-teal-600" />
          <p className="text-sm text-slate-600 dark:text-slate-300">Menyiapkan ruang sesi konseling...</p>
        </div>
      }
    >
      <PatientSessionQueryContent />
    </Suspense>
  );
}
