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
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  HeartHandshake,
  Send,
  ShieldCheck,
  Sparkles,
  Lock,
  Smile,
  AlertCircle,
} from "lucide-react";
import { peerTicketClient, PeerTicketApiError } from "@/services/peer-tickets.client";
import { useUserStore } from "@/store/user-store";
import { notify } from "@/lib/toast";

const topicsList = [
  "Pekerjaan & Burnout",
  "Akademik & Skripsi",
  "Keluarga & Ekspektasi",
  "Hubungan & Asmara",
  "Kesepian & Hampa",
  "Overthinking Masa Depan",
];

const emotionList = [
  { label: "Kewalahan", color: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border-rose-200" },
  { label: "Cemas", color: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-200" },
  { label: "Sedih", color: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200" },
  { label: "Lelah", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300" },
  { label: "Bingung", color: "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300 border-teal-200" },
];

const pseudonyms = [
  "Bunga Biru",
  "Langit Senja",
  "Rintik Hujan",
  "Daun Gugur",
  "Pelangi Sore",
  "Awan Putih",
  "Embun Pagi",
  "Bintang Kejora",
  "Angin Semilir",
  "Lembayung Tenang",
];

interface VentingModalFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function VentingModalForm({ open, onOpenChange, onSuccess }: VentingModalFormProps) {
  const user = useUserStore((state) => state.user);

  const [selectedTopic, setSelectedTopic] = useState(topicsList[0]);
  const [selectedEmotion, setSelectedEmotion] = useState(emotionList[0].label);
  const [content, setContent] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [pseudonym, setPseudonym] = useState(() => pseudonyms[Math.floor(Math.random() * pseudonyms.length)]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRandomizePseudonym = () => {
    const others = pseudonyms.filter((p) => p !== pseudonym);
    const next = others[Math.floor(Math.random() * others.length)] || pseudonyms[0];
    setPseudonym(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedContent = content.trim();
    if (!trimmedContent || trimmedContent.length < 10) {
      notify.warning(
        "Cerita Terlalu Singkat",
        "Harap tuliskan cerita keluh kesah minimal 10 karakter agar pendengar memahami perasaanmu."
      );
      return;
    }

    if (trimmedContent.length > 2000) {
      notify.warning(
        "Cerita Terlalu Panjang",
        "Cerita curhat maksimal 2000 karakter."
      );
      return;
    }

    const finalAlias = isAnonymous
      ? pseudonym.trim()
      : (user.fullName?.trim() || user.alias?.trim() || pseudonym.trim() || "Sahabat");

    if (isAnonymous && (finalAlias.length < 2 || finalAlias.length > 50)) {
      notify.warning(
        "Nama Samaran Tidak Valid",
        "Nama samaran harus memiliki panjang antara 2 hingga 50 karakter."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await peerTicketClient.createTicket({
        patient_alias: finalAlias,
        topic: selectedTopic,
        emotion: selectedEmotion,
        content: trimmedContent,
        is_anonymous: isAnonymous,
      });

      notify.info(
        "Curhat Terkirim ke Antrean",
        "Relawan pendengar sebaya terlatih PFA akan segera menyambut ceritamu."
      );
      setContent("");
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      if (
        err instanceof PeerTicketApiError ||
        (typeof err === "object" && err !== null && "status" in err)
      ) {
        const apiErr = err as PeerTicketApiError;
        if (apiErr.status === 409 || apiErr.code === "ACTIVE_TICKET_EXISTS") {
          notify.warning(
            "Tiket Curhat Masih Aktif",
            "Kamu masih memiliki tiket curhat yang sedang aktif."
          );
          onOpenChange(false);
          if (onSuccess) onSuccess();
          return;
        }
        notify.error(
          "Gagal Mengirim Curhat",
          apiErr.message || "Terjadi kesalahan saat membuat tiket curhat."
        );
      } else if (err instanceof Error) {
        notify.error("Gagal Mengirim Curhat", err.message || "Terjadi kesalahan.");
      } else {
        notify.error("Gagal Mengirim Curhat", "Terjadi kesalahan tidak terduga.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 font-nunito bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl">
        {/* Clean, Elegant Header */}
        <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/60 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20 flex items-center justify-center shrink-0">
              <HeartHandshake size={20} />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-700 dark:text-pink-300 text-[10px] font-bold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse" />
                Ruang Aman Bebas Penghakiman
              </div>
              <DialogTitle className="text-lg sm:text-xl font-bold font-heading text-slate-900 dark:text-white mt-1">
                Tuangkan Keluh Kesahmu Hari Ini
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-nunito pl-0.5">
            Ceritakan apa pun yang membebanimu. Relawan pendengar sebaya terlatih Psychological First Aid (PFA) siap mendengarkan dengan penuh penerimaan.
          </DialogDescription>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* 1. Pilih Topik Masalah */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
              Pilih Topik Keluhan:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {topicsList.map((topic) => {
                const isActive = selectedTopic === topic;
                return (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => setSelectedTopic(topic)}
                    className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all duration-150 border cursor-pointer ${
                      isActive
                        ? "bg-pink-600 text-white border-pink-600 shadow-xs"
                        : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-pink-300"
                    }`}
                  >
                    {topic}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Emosi yang Dirasakan */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
              Emosi Utama Saat Ini:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {emotionList.map((emo) => {
                const isActive = selectedEmotion === emo.label;
                return (
                  <button
                    key={emo.label}
                    type="button"
                    onClick={() => setSelectedEmotion(emo.label)}
                    className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-all duration-150 border cursor-pointer ${
                      isActive
                        ? "bg-teal-700 text-white border-teal-700 shadow-xs dark:bg-teal-600"
                        : `${emo.color} hover:brightness-95`
                    }`}
                  >
                    {emo.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Isi Curhatan / Keluh Kesah */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Ceritakan Apa yang Terjadi:
              </label>
              <span className="text-[10px] text-slate-400">
                {content.length} karakter (min. 10)
              </span>
            </div>
            <textarea
              required
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Ketikkan apa yang mengganjal di hatimu... Misalnya: 'Akhir-akhir ini aku merasa sangat lelah dengan tekanan pekerjaan di kantor, atasan selalu menuntut lebih dan aku merasa gak ada tempat untuk bernapas...'"
              className="w-full text-xs p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 focus:outline-hidden focus:ring-2 focus:ring-pink-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 resize-none leading-relaxed"
            />
          </div>

          {/* 4. Opsi Anonim & Privasi */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <Lock size={13} className="text-teal-600 dark:text-teal-400" />
                  <span>Kirim Sebagai Anonim</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-nunito">
                  {isAnonymous
                    ? "Identitas aslimu disembunyikan dari pendengar sebaya."
                    : `Akan ditampilkan dengan nama: "${user.fullName || "Kamu"}"`}
                </p>
              </div>
              <Switch
                checked={isAnonymous}
                onCheckedChange={setIsAnonymous}
                className="data-[state=checked]:bg-teal-600 shrink-0"
              />
            </div>

            {isAnonymous && (
              <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700/70 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Nama Samaran (2–50 Karakter):
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRandomizePseudonym}
                    className="h-6 px-2 text-[10px] text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950 font-semibold gap-1 cursor-pointer"
                  >
                    <Sparkles size={11} />
                    <span>Acak Nama</span>
                  </Button>
                </div>
                <Input
                  value={pseudonym}
                  onChange={(e) => setPseudonym(e.target.value)}
                  placeholder="Contoh: Bunga Biru, Pelangi Sore..."
                  maxLength={50}
                  className="h-8 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
            )}
          </div>

          {/* Footer Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-xs text-slate-600 dark:text-slate-400 h-9 px-4 rounded-xl font-semibold cursor-pointer"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || content.trim().length < 10}
              className="text-xs bg-pink-600 hover:bg-pink-700 text-white h-9 px-5 rounded-xl font-semibold cursor-pointer shadow-xs gap-1.5"
            >
              <Send size={13} />
              <span>{isSubmitting ? "Mengirim..." : "Kirim ke Antrean Curhat"}</span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
