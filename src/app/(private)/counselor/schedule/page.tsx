"use client";

import React from "react";
import { Calendar } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function CounselorSchedulePage() {
  return (
    <ComingSoon
      icon={Calendar}
      title="Jadwal Konseling Segera Hadir"
      description="Fitur pengaturan ketersediaan jadwal praktik dan konfirmasi janji temu pasien hadir bersama sistem booking. Anda akan dapat mengatur slot reguler dan menyetujui sesi secara terintegrasi."
      badge="Segera Hadir"
    />
  );
}
