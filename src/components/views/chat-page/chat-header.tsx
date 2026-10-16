"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, HeartPulse, Bot, Phone, CheckCircle2 } from "lucide-react";
import { useChatStore } from "@/store/chat-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { MdVerified } from "react-icons/md";
import Link from "next/link";

interface ChatHeaderProps {
  onStartCall?: (type: "voice") => void;
  onEndSession?: () => void;
}

export function ChatHeader({ onStartCall, onEndSession }: ChatHeaderProps) {
  const { selectedConversation, setSelectedConversation } = useChatStore();
  const isMobile = useIsMobile();

  if (!selectedConversation) return null;

  return (
    <div className="px-3.5 py-3 sm:px-6 sm:py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0 transition-colors duration-200">
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        {/* Tombol Back di Mobile */}
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl h-8 w-8 -ml-1 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 cursor-pointer"
            onClick={() => setSelectedConversation(null)}
            aria-label="Kembali ke daftar percakapan"
          >
            <ArrowLeft size={16} />
          </Button>
        )}

        {/* Avatar */}
        <div className="relative shrink-0">
          <div
            className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full font-bold text-xs sm:text-sm flex items-center justify-center border font-heading ${
              selectedConversation.isAI
                ? "bg-teal-600 text-white border-teal-700"
                : "bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800"
            }`}
          >
            {selectedConversation.isAI ? <Bot size={20} /> : selectedConversation.initials}
          </div>
          {selectedConversation.online && (
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
          )}
        </div>

        {/* Nama & Status */}
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-1.5">
            <h2 className="font-heading font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate leading-tight">
              {selectedConversation.name}
            </h2>
            {selectedConversation.isPeerListener ? (
              <Badge className="bg-pink-50 dark:bg-pink-950/70 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800 text-[10px] py-0 px-1.5 h-4 font-semibold shrink-0">
                Sebaya PFA
              </Badge>
            ) : !selectedConversation.isAI ? (
              <MdVerified className="text-sky-500 text-sm shrink-0" />
            ) : (
              <Badge className="bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-[10px] py-0 px-1.5 h-4 font-semibold shrink-0">
                AI Gratis
              </Badge>
            )}
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-nunito flex items-center gap-1.5 truncate">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="truncate">{selectedConversation.statusText}</span>
          </div>
        </div>
      </div>

      {/* Aksi Samping: Voice Call (Psikolog saja) & Hotline */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Jika Psikolog Klinis: Tombol Voice Call Berbayar 5 Koin */}
        {!selectedConversation.isAI && !selectedConversation.isPeerListener && onStartCall && (
          <Button
            size="sm"
            onClick={() => onStartCall("voice")}
            className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl h-8 px-3 gap-1.5 shadow-xs cursor-pointer"
            title="Mulai Panggilan Suara Konseling (5 Koin / Jam)"
          >
            <Phone size={13} />
            <span className="text-xs font-semibold">Voice Call (5 Koin)</span>
          </Button>
        )}

        {/* Tombol Akhiri Sesi & Beri Apresiasi (Untuk Psikolog & Pendengar Sebaya) */}
        {!selectedConversation.isAI && onEndSession && (
          <Button
            size="sm"
            variant="outline"
            onClick={onEndSession}
            className="border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl h-8 px-2.5 text-xs font-semibold cursor-pointer gap-1"
            title="Akhiri sesi dan berikan evaluasi"
          >
            <CheckCircle2 size={13} />
            <span className="hidden sm:inline">Akhiri Sesi</span>
          </Button>
        )}

        <Link
          href="/help-center"
          className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors"
        >
          <HeartPulse size={13} className="text-rose-600 dark:text-rose-400" />
          <span>Hotline 119</span>
        </Link>
      </div>
    </div>
  );
}
