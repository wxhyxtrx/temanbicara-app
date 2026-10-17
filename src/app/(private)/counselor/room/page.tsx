"use client";

import React from "react";
import { MessageCircle } from "lucide-react";
import { ComingSoon } from "@/components/shared/coming-soon";

export default function CounselorRoomPage() {
  return (
    <ComingSoon
      icon={MessageCircle}
      title="Ruang Konseling Segera Hadir"
      description="Ruang telekonseling privat dan pencatatan SOAP klinis hadir bersama sistem booking. Sesi interaktif chat dan panggilan aman akan langsung terhubung saat jadwal janji temu tiba."
      badge="Segera Hadir"
    />
  );
}
