"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useChatStore } from "@/store/chat-store";
import { useUserStore } from "@/store/user-store";
import { useTransactionStore } from "@/store/transaction-store";
import { useNotificationStore } from "@/store/notification-store";
import { ChatHeader } from "./chat-header";
import { MessageInput } from "./message-input";
import { MessageList } from "./message-list";
import { CallRoomModal } from "./call-room-modal";
import { Phone, Coins, AlertCircle, ShieldCheck } from "lucide-react";
import Link from "next/link";

export function ChatArea() {
  const { selectedConversation } = useChatStore();
  const user = useUserStore((state) => state.user);
  const updateCoins = useUserStore((state) => state.updateCoins);

  const [showCallPayConfirm, setShowCallPayConfirm] = useState<boolean>(false);
  const [isCallModalOpen, setIsCallModalOpen] = useState<boolean>(false);

  if (!selectedConversation) return null;

  const CALL_FEE_COINS = 5; // 5 koin per jam
  const currentCoins = user.coins;
  const isBalanceSufficient = currentCoins >= CALL_FEE_COINS;
  const remainingCoins = currentCoins - CALL_FEE_COINS;

  const handleStartCallClick = () => {
    // Tampilkan modal konfirmasi potong koin 5 koin
    setShowCallPayConfirm(true);
  };

  const handleConfirmPayAndCall = () => {
    if (!isBalanceSufficient) return;

    // Potong 5 koin saldo pasien
    updateCoins(-CALL_FEE_COINS, true);

    // Catat mutasi koin keluar ke transaction store
    useTransactionStore.getState().addTransaction({
      date: new Date().toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }) + " WIB",
      type: "usage",
      category: "Voice Call",
      title: `Voice Call 60 Menit bersama ${selectedConversation.name}`,
      targetParty: selectedConversation.name,
      coinChange: -CALL_FEE_COINS,
      coinBalanceAfter: currentCoins - CALL_FEE_COINS,
      paymentMethod: "Saldo Koin Pasien",
      status: "berhasil",
      notes: "Konsultasi panggilan suara privat 1 jam.",
    });

    useNotificationStore.getState().addNotification({
      title: "Panggilan Suara Terhubung",
      message: `Sesi Voice Call privat 60 menit bersama ${selectedConversation.name} telah dimulai (Biaya: 5 Koin).`,
      type: "chat",
      actionUrl: "/room",
    });

    setShowCallPayConfirm(false);
    setIsCallModalOpen(true);
  };

  return (
    <Card className="h-full flex flex-col bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs rounded-2xl overflow-hidden gap-0 transition-colors duration-200">
      <ChatHeader onStartCall={handleStartCallClick} />
      <MessageList />
      <MessageInput />

      {/* 1. Modal Konfirmasi Pembayaran Voice Call (5 Koin / Jam) */}
      <Dialog open={showCallPayConfirm} onOpenChange={setShowCallPayConfirm}>
        <DialogContent className="max-w-md font-nunito p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
          <DialogHeader className="space-y-1.5 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-400 flex items-center justify-center shrink-0">
                <Phone size={18} />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold font-heading text-slate-900 dark:text-white">
                  Mulai Panggilan Suara Konseling
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                  Sesi privat 60 menit bersama {selectedConversation.name}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* Rincian Tarif & Saldo Pasien */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700/80 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">Psikolog Bertugas:</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedConversation.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">Durasi Panggilan:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">60 Menit (1 Jam)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400">Biaya Sesi Panggilan:</span>
                <span className="font-bold text-teal-800 dark:text-teal-300 font-mono flex items-center gap-1">
                  <Coins size={13} />
                  <span>5 Koin</span>
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between font-semibold">
                <span className="text-slate-700 dark:text-slate-300">Saldo Koin Anda:</span>
                <span className="font-mono text-slate-900 dark:text-white">{currentCoins} Koin</span>
              </div>
              <div className="flex items-center justify-between font-semibold text-xs">
                <span className="text-slate-700 dark:text-slate-300">Sisa Saldo Setelah Panggilan:</span>
                <span className={`font-mono ${isBalanceSufficient ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400 font-bold"}`}>
                  {isBalanceSufficient ? `${remainingCoins} Koin` : "Saldo Kurang"}
                </span>
              </div>
            </div>

            {/* Peringatan Saldo Kurang */}
            {!isBalanceSufficient && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <AlertCircle size={15} className="text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>Saldo tidak cukup (Perlu 5 Koin).</span>
                </div>
                <Link href="/top-up" onClick={() => setShowCallPayConfirm(false)}>
                  <Button size="sm" type="button" className="h-7 text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg px-2.5 cursor-pointer">
                    Top Up Koin
                  </Button>
                </Link>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-[11px] text-teal-700 dark:text-teal-400 font-medium">
              <ShieldCheck size={14} />
              <span>Sesi dilindungi kode etik kerahasiaan medis psikolog</span>
            </div>

            {/* Tombol Aksi */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCallPayConfirm(false)}
                className="text-xs border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl h-9 px-4 cursor-pointer"
              >
                Batal
              </Button>

              <Button
                type="button"
                onClick={handleConfirmPayAndCall}
                disabled={!isBalanceSufficient}
                className="text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-xl h-9 px-4 font-semibold shadow-xs cursor-pointer gap-1.5"
              >
                <Coins size={14} />
                <span>Bayar 5 Koin & Panggil</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 2. Modal Telehealth Voice Call Aktif (Timer 60 Menit) */}
      <CallRoomModal
        isOpen={isCallModalOpen}
        onClose={() => setIsCallModalOpen(false)}
        conversation={selectedConversation}
      />
    </Card>
  );
}
