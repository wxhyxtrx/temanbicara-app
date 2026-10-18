"use client";

import React, { use } from "react";
import { SessionRoomView } from "@/components/views/session/session-room-view";

interface PatientSessionDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function PatientSessionDetailPage({ params }: PatientSessionDetailPageProps) {
  const { id } = use(params);

  return <SessionRoomView bookingId={id} role="pasien" />;
}
