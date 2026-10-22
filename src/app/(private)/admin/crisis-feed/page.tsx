"use client";

import React from "react";
import { ShieldAlert } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function AdminCrisisFeedPage() {
  return (
    <ComingSoon
      icon={ShieldAlert}
      title="Crisis Feed & Deteksi Krisis"
      description="Fitur pemantauan eskalasi krisis otomatis sedang dalam tahap integrasi klinis."
      backHref="/admin/beranda"
      backLabel="Kembali ke Dashboard Admin"
    />
  );
}
