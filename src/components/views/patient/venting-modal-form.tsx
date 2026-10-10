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
import {
  HeartHandshake,
  Send,
  ShieldCheck,
  Sparkles,
  Lock,
  Smile,
  AlertCircle,
} from "lucide-react";
import { usePeerVentStore } from "@/store/peer-vent-store";
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

const pseudonyms = ["Bunga Biru", "Langit Senja", "Rintik Hujan", "Daun Gugur", "Pelangi Sore"];

interface VentingModalFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function VentingModalForm({ open, onOpenChange, onSuccess }: VentingModalFormProps) {
  const user = useUserStore((state) => state.user);
  const createPost = usePeerVentStore((state) => state.createPost);

  const [selectedTopic, setSelectedTopic] = useState(topicsList[0]);
  const [selectedEmotion, setSelectedEmotion] = useState(emotionList[0].label);
  const [content, setContent] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [pseudonym] = useState(() => pseudonyms[Math.floor(Math.random() * pseudonyms.length)]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || content.trim().length < 10) {
      notify.warning("Cerita Terlalu Singkat", "Harap tuliskan cerita keluh kesah minimal 10 karakter agar pendengar memahami perasaanmu.");
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      createPost({
        topic: selectedTopic,
        emotion: selectedEmotion,
        content: content.trim(),
        isAnonymous,
        alias: isAnonymous ? pseudonym : user.fullName || "Wahyu",
      });

      notify.info("Curhat Terkirim ke Antrean", "Relawan pendengar sebaya terlatih PFA akan segera menyambut ceritamu.");
      setIsSubmitting(false);
      setContent("");
      onOpenChange(false);
      if (onSuccess) onSuccess();
    }, 400);
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
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                <Lock size={13} className="text-teal-600 dark:text-teal-400" />
                <span>Kirim Sebagai Anonim</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-nunito">
                {isAnonymous
                  ? `Nama samaranmu di hadapan listener: "${pseudonym}"`
                  : `Akan ditampilkan dengan nama: "${user.fullName || "Wahyu"}"`}
              </p>
            </div>
            <Switch
              checked={isAnonymous}
              onCheckedChange={setIsAnonymous}
              className="data-[state=checked]:bg-teal-600"
            />
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
