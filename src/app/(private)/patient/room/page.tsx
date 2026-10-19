"use client";

import React, { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ConversationList } from "@/components/views/chat-page/conversation-list";
import { ChatArea } from "@/components/views/chat-page/chat-area";
import { useChatStore } from "@/store/chat-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { MessageSquareHeart, ShieldCheck } from "lucide-react";

function RoomChatContent() {
  const { selectedConversation, setSelectedConversation, conversations, setIsAnonymous } = useChatStore();
  const isMobile = useIsMobile();
  const searchParams = useSearchParams();
  const type = searchParams.get("type");

  // Jika pasien datang dari tautan Curhat Sebaya (?type=peer), otomatis pilih Dewi & aktifkan mode anonim
  useEffect(() => {
    if (type === "peer") {
      const peerConv = conversations.find((c) => c.isPeerListener || c.id === 4);
      if (peerConv) {
        setSelectedConversation(peerConv);
        setIsAnonymous(true);
        return;
      }
    }

    // Otomatis pilih percakapan pertama di desktop jika belum ada yang dipilih
    if (!isMobile && !selectedConversation && conversations.length > 0) {
      setSelectedConversation(conversations[0]);
    }
  }, [type, isMobile, selectedConversation, setSelectedConversation, setIsAnonymous, conversations]);

  return (
    <div className="h-[calc(100vh-115px)] min-h-[520px] font-nunito transition-colors duration-200">
      <div className="h-full flex gap-5">
        {/* Panel Kiri: Daftar Percakapan */}
        <div
          className={`h-full shrink-0 transition-all duration-200 ${
            selectedConversation
              ? "hidden lg:block w-[320px] xl:w-[360px]"
              : "w-full"
          }`}
        >
          <ConversationList />
        </div>

        {/* Panel Kanan: Ruang Chat */}
        <div
          className={`h-full flex-1 min-w-0 transition-all duration-200 ${
            !selectedConversation ? "hidden lg:flex" : "w-full flex flex-col"
          }`}
        >
          {selectedConversation ? (
            <ChatArea />
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl text-center space-y-3.5 shadow-xs transition-colors duration-200">
              <div className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-400 flex items-center justify-center">
                <MessageSquareHeart size={28} />
              </div>
              <div className="space-y-1 max-w-sm">
                <h3 className="text-base font-bold font-heading text-slate-900 dark:text-white">
                  Ruang Konseling TemanBicara
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-nunito leading-relaxed">
                  Pilih sesi percakapan di sebelah kiri untuk mulai curhat dengan AI empatik, konseling psikolog klinis, atau pendengar sebaya.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-teal-700 dark:text-teal-400 font-medium pt-2">
                <ShieldCheck size={14} />
                <span>Privat & Dilindungi Standar Kerahasiaan Medis</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PatientRoomChatPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Memuat ruang percakapan...</div>}>
      <RoomChatContent />
    </Suspense>
  );
}
