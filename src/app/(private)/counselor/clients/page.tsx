"use client";

import React from "react";
import { ClipboardList } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function CounselorClientsPage() {
  return (
    <ComingSoon
      icon={ClipboardList}
      title="Catatan Klien Segera Hadir"
      description="Fitur rekam klinis pasien, riwayat sesi, dan jurnal evaluasi berkala hadir bersama sistem booking. Catatan medis psikologis akan tercatat otomatis sesuai standar etika klinis HIMPSI."
      badge="Segera Hadir"
    />
  );
}
