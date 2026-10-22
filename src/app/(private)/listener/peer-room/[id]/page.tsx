"use client";

import React, { use } from "react";
import { PeerRoomView } from "@/components/views/peer-room/peer-room-view";

interface ListenerPeerRoomPageProps {
  params: Promise<{ id: string }>;
}

export default function ListenerPeerRoomPage({ params }: ListenerPeerRoomPageProps) {
  const { id } = use(params);

  return <PeerRoomView ticketId={id} role="relawan" />;
}
