"use client";

import React, { use } from "react";
import { PeerRoomView } from "@/components/views/peer-room/peer-room-view";

interface PatientPeerRoomPageProps {
  params: Promise<{ id: string }>;
}

export default function PatientPeerRoomPage({ params }: PatientPeerRoomPageProps) {
  const { id } = use(params);

  return <PeerRoomView ticketId={id} role="pasien" />;
}
