"use client";

import React from "react";
import { Headphones } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function ListenerQueueRoomPage() {
  return (
    <ComingSoon
      icon={Headphones}
      title="Ruang Dengar Segera Hadir"
      description="Fitur antrean tiket curhat dan ruang dengar percakapan anonim hadir bersama sistem tiket curhat sebaya (Fase 5). Relawan pendengar akan dapat menerima teman bicara dan memulai pendampingan empati saat sistem ini aktif."
      badge="Fase 5 • Tiket Curhat Sebaya"
      backHref="/listener/beranda"
      backLabel="Kembali ke Beranda Relawan"
    />
  );
}
