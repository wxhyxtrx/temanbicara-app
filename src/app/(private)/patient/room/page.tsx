"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { peerTicketClient } from "@/services/peer-tickets.client";
import { Loader2 } from "lucide-react";

export default function PatientRoomPage() {
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    async function checkActiveRoom() {
      try {
        const res = await peerTicketClient.getMyActiveTicket();
        if (!isMounted) return;

        if (
          res?.success &&
          res.data?.id &&
          res.data.status !== "archived" &&
          res.data.status !== "closed"
        ) {
          router.replace(`/patient/peer-room/${res.data.id}`);
        } else {
          router.replace("/patient/beranda");
        }
      } catch (err) {
        console.error("Gagal memeriksa tiket aktif di /patient/room:", err);
        if (isMounted) {
          router.replace("/patient/beranda");
        }
      }
    }

    checkActiveRoom();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <div className="h-[calc(100vh-140px)] min-h-[400px] flex flex-col items-center justify-center p-8 text-center space-y-3 font-nunito">
      <Loader2 className="w-8 h-8 animate-spin text-teal-600 dark:text-teal-400" />
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
        Memeriksa sesi ruang percakapan aktif...
      </p>
    </div>
  );
}
