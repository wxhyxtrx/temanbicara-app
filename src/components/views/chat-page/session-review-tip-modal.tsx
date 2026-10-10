"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Star,
  Coins,
  HeartHandshake,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Send,
} from "lucide-react";
import { useUserStore } from "@/store/user-store";
import { useTransactionStore } from "@/store/transaction-store";
import { useNotificationStore } from "@/store/notification-store";
import { useChatStore, Conversation } from "@/store/chat-store";
import { usePeerVentStore } from "@/store/peer-vent-store";

const reviewTagOptions = [
  "Sangat Mendengarkan",
  "Hangat & Empatis",
  "Memberi Ketenangan",
  "Bebas Penghakiman",
  "Solutif & Terarah",
  "Membantu Regulasi Emosi",
];

const tipPresetAmounts = [0, 10, 25, 50];

interface SessionReviewTipModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: Conversation;
  onSuccess?: () => void;
}

export function SessionReviewTipModal({
  open,
  onOpenChange,
  conversation,
  onSuccess,
}: SessionReviewTipModalProps) {
  const user = useUserStore((state) => state.user);
  const sendTip = useUserStore((state) => state.sendTip);
  const myActivePost = usePeerVentStore((state) => state.myActivePost);
  const closeSession = usePeerVentStore((state) => state.closeSession);
  const addTransaction = useTransactionStore((state) => state.addTransaction);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const { messagesByConversation, selectedConversation } = useChatStore();

  const [rating, setRating] = useState<number>(5);
  const [selectedTags, setSelectedTags] = useState<string[]>(["Hangat & Empatis"]);
  const [selectedTip, setSelectedTip] = useState<number>(10);
  const [thankYouNote, setThankYouNote] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const isPeer = conversation.isPeerListener;
  const targetRole = isPeer ? ("peer_listener" as const) : ("counselor" as const);
  const currentCoins = user.coins;

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleCompleteSession = () => {
    setIsSubmitting(true);

    setTimeout(() => {
      let tipGiven = 0;
      if (selectedTip > 0 && currentCoins >= selectedTip) {
        const successTip = sendTip(targetRole, selectedTip);
        if (successTip) {
          tipGiven = selectedTip;
          // Catat mutasi koin tip
          addTransaction({
            date:
              new Date().toLocaleDateString("id-ID", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }) + " WIB",
            type: "usage",
            category: "Tip Apresiasi",
            title: `Tip Apresiasi Sesi untuk ${conversation.name}`,
            targetParty: conversation.name,
            coinChange: -tipGiven,
            coinBalanceAfter: currentCoins - tipGiven,
            paymentMethod: "Saldo Koin Pasien",
            status: "berhasil",
            notes: thankYouNote.trim() || "Apresiasi ketulusan mendengarkan.",
          });
        }
      }

      // Jika peer listener post aktif, tandai selesai
      if (myActivePost) {
        closeSession(myActivePost.id, rating, selectedTags, tipGiven);
      }

      // Tambahkan pesan penutup sistem di chat
      const nowTime = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      const convMsgs = messagesByConversation[conversation.id] || [];
      const systemClosingMsg = {
        id: Date.now(),
        conversationId: conversation.id,
        sender: "TemanBicara Sistem",
        initials: "TB",
        content: `[Sesi Ditutup Resmi]\n⭐ Rating: ${rating}/5 Bintang\n🏷️ Evaluasi: ${selectedTags.join(", ")}${
          tipGiven > 0 ? `\n🪙 Tip Apresiasi: +${tipGiven} Koin telah disalurkan.` : ""
        }\n\nTerima kasih telah saling menguatkan. Ruang percakapan ini tersimpan aman di riwayatmu.`,
        time: nowTime,
        isUser: false,
      };

      const updatedMsgs = [...convMsgs, systemClosingMsg];
      useChatStore.setState({
        messagesByConversation: {
          ...messagesByConversation,
          [conversation.id]: updatedMsgs,
        },
        messages:
          selectedConversation?.id === conversation.id
            ? updatedMsgs
            : useChatStore.getState().messages,
      });

      addNotification({
        title: `Sesi bersama ${conversation.name} Telah Selesai`,
        message: `Terima kasih telah merawat kesehatan batinmu. Rating ${rating} bintang dan apresiasimu telah tersampaikan.`,
        type: "sistem",
      });

      setIsSubmitting(false);
      setIsSuccess(true);

      setTimeout(() => {
        setIsSuccess(false);
        onOpenChange(false);
        if (onSuccess) onSuccess();
      }, 1500);
    }, 500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 font-nunito bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xl">
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-teal-700 via-teal-800 to-slate-900 p-6 text-white space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-white/20 backdrop-blur-md">
              <HeartHandshake size={16} />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-teal-200">
              Evaluasi & Akhiri Sesi
            </span>
          </div>
          <DialogTitle className="text-xl font-bold font-heading text-white">
            Terima Kasih Telah Bercerita
          </DialogTitle>
          <DialogDescription className="text-xs text-teal-100/90 leading-relaxed font-nunito">
            Sesi pendampingan bersama <strong>{conversation.name}</strong> akan diselesaikan. Bagaimana pengalaman batinmu?
          </DialogDescription>
        </div>

        {isSuccess ? (
          <div className="p-8 text-center space-y-3 animate-in fade-in">
            <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-base font-bold font-heading text-slate-900 dark:text-white">
              Sesi Berhasil Diselesaikan!
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 font-nunito">
              Apresiasi dan rating bintangmu telah berhasil disampaikan kepada {conversation.name}.
            </p>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            {/* 1. Rating Bintang 1 - 5 */}
            <div className="space-y-1.5 text-center">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Beri Nilai Kehangatan & Pendampingan:
              </label>
              <div className="flex items-center justify-center gap-2 pt-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="p-1 rounded-lg hover:scale-110 transition-transform cursor-pointer"
                  >
                    <Star
                      size={26}
                      className={
                        star <= rating
                          ? "fill-amber-400 text-amber-400"
                          : "text-slate-300 dark:text-slate-700"
                      }
                    />
                  </button>
                ))}
              </div>
              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                {rating === 5
                  ? "Sangat Luar Biasa & Menenangkan"
                  : rating === 4
                  ? "Membantu & Empatis"
                  : rating === 3
                  ? "Cukup Baik"
                  : "Perlu Peningkatan"}
              </span>
            </div>

            {/* 2. Tag Pengalaman Positif */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Pilih Apa yang Paling Kamu Rasakan:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {reviewTagOptions.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all duration-150 border cursor-pointer ${
                        isSelected
                          ? "bg-teal-700 text-white border-teal-700 dark:bg-teal-600"
                          : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-teal-300"
                      }`}
                    >
                      {isSelected ? `✓ ${tag}` : `+ ${tag}`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Opsi Tip Koin Apresiasi Sukarela */}
            <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/90 dark:border-amber-900/60 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-300">
                  <Coins size={15} className="text-amber-600 dark:text-amber-400" />
                  <span>Kirim Tip Koin Apresiasi (Sukarela)</span>
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 font-bold"
                >
                  Saldomu: {currentCoins} Koin
                </Badge>
              </div>

              <p className="text-[11px] text-amber-800/80 dark:text-amber-200/80 font-nunito leading-relaxed">
                {isPeer
                  ? "Relawan sebaya mendengarkan dengan sukarela. Tip koin adalah bentuk terima kasih tulus untuk menyemangati mereka."
                  : "Konsultasi telah terbayar, namun kamu dapat memberikan tip ekstra bila merasa sangat tertolong."}
              </p>

              <div className="grid grid-cols-4 gap-2">
                {tipPresetAmounts.map((amt) => {
                  const isSelected = selectedTip === amt;
                  const isInsufficient = amt > currentCoins;
                  return (
                    <button
                      key={amt}
                      type="button"
                      disabled={isInsufficient}
                      onClick={() => setSelectedTip(amt)}
                      className={`py-2 px-1 rounded-xl text-xs font-bold text-center border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-amber-600 text-white border-amber-600 shadow-2xs"
                          : isInsufficient
                          ? "opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800 border-slate-200 text-slate-400"
                          : "bg-white dark:bg-slate-850 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-amber-400"
                      }`}
                    >
                      {amt === 0 ? "Tanpa Tip" : `+${amt} Koin`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Catatan Singkat (Opsional) */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Pesan Terima Kasih (Opsional):
              </label>
              <input
                type="text"
                value={thankYouNote}
                onChange={(e) => setThankYouNote(e.target.value)}
                placeholder="Misal: 'Terima kasih banyak kak, rasanya dadaku jauh lebih ringan sekarang.'"
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 h-9 font-semibold"
              >
                Kembali ke Chat
              </Button>
              <Button
                type="button"
                disabled={isSubmitting}
                onClick={handleCompleteSession}
                className="text-xs bg-teal-600 hover:bg-teal-700 text-white h-9 px-5 rounded-xl font-bold cursor-pointer shadow-xs gap-1.5"
              >
                <CheckCircle2 size={14} />
                <span>{isSubmitting ? "Memproses..." : "Selesaikan Sesi"}</span>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
