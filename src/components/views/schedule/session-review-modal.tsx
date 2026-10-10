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
  Star,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  Send,
  Heart,
  UserCheck,
  EyeOff,
} from "lucide-react";
import { useReviewStore } from "@/store/review-store";
import { useUserStore } from "@/store/user-store";
import { ScheduleItem } from "@/store/schedule-store";

const reviewTagOptions = [
  "Sangat Mendengarkan",
  "Hangat & Empatis",
  "Memberi Ketenangan",
  "Bebas Penghakiman",
  "Solutif & Terarah",
  "Membantu Regulasi Emosi",
  "Tepat Waktu & Profesional",
  "Ruang Bicara Nyaman",
];

const ratingDescriptions: Record<number, string> = {
  1: "Kurang Membantu — Belum sesuai harapan",
  2: "Cukup Baik — Ada beberapa poin refleksi",
  3: "Baik & Informatif — Sesi berjalan kondusif",
  4: "Sangat Membantu & Nyaman — Membuka perspektif baru",
  5: "Luar Biasa & Sangat Terarah — Dampak emosional langsung terasa",
};

interface SessionReviewModalProps {
  session: ScheduleItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function SessionReviewModal({
  session,
  isOpen,
  onClose,
  onSuccess,
}: SessionReviewModalProps) {
  const user = useUserStore((state) => state.user);
  const addReview = useReviewStore((state) => state.addReview);

  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([
    "Hangat & Empatis",
    "Solutif & Terarah",
  ]);
  const [comment, setComment] = useState<string>("");
  const [isAnonymous, setIsAnonymous] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  if (!session) return null;

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) {
      alert("Mohon berikan sedikit catatan ulasan atau pengalaman konsultasi Anda.");
      return;
    }

    setIsSubmitting(true);

    setTimeout(() => {
      addReview({
        scheduleId: session.id,
        consultantId: session.consultantId || 1,
        consultantName: session.consultant,
        patientId: user.email || "patient-user",
        patientName: user.fullName || "Wahyu Tricahyo",
        isAnonymous,
        rating,
        aspectTags: selectedTags,
        comment: comment.trim(),
      });

      setIsSubmitting(false);
      setIsSuccess(true);

      setTimeout(() => {
        setIsSuccess(false);
        onClose();
        if (onSuccess) onSuccess();
      }, 1800);
    }, 450);
  };

  const activeStarCount = hoverRating ?? rating;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg font-nunito p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-xl">
        <DialogHeader className="space-y-1.5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Star size={20} className="fill-amber-500 text-amber-500" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold font-heading text-slate-900 dark:text-white">
                Evaluasi & Ulasan Sesi Konseling
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                Bersama <strong>{session.consultant}</strong> ({session.type})
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isSuccess ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto animate-bounce">
              <CheckCircle2 size={30} />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold font-heading text-slate-900 dark:text-white">
                Terima Kasih atas Ulasan Anda!
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Evaluasi Anda sangat berarti bagi profesionalisme psikolog dan membantu pengguna lain menemukan pendampingan yang tepat.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            {/* 1. Star Rating Picker */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-center space-y-2">
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                Bagaimana Pengalaman Sesi Anda?
              </span>
              <div className="flex items-center justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(null)}
                    onClick={() => setRating(star)}
                    className="p-1 cursor-pointer transition-transform hover:scale-120 focus:outline-none"
                  >
                    <Star
                      size={28}
                      className={
                        star <= activeStarCount
                          ? "fill-amber-400 text-amber-500 drop-shadow-xs"
                          : "text-slate-300 dark:text-slate-600"
                      }
                    />
                  </button>
                ))}
              </div>
              <p className="text-xs font-semibold text-amber-900 dark:text-amber-300 transition-colors">
                {ratingDescriptions[activeStarCount] || ""}
              </p>
            </div>

            {/* 2. Aspect Tags */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Aspek Keunggulan Psikolog (Bisa pilih lebih dari satu)</span>
                <span className="text-[11px] font-normal text-slate-400">{selectedTags.length} Dipilih</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {reviewTagOptions.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`text-xs px-2.5 py-1 rounded-lg border font-medium cursor-pointer transition-all ${
                        isSelected
                          ? "bg-teal-50 dark:bg-teal-950/80 border-teal-300 dark:border-teal-700 text-teal-800 dark:text-teal-200 font-semibold shadow-2xs"
                          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/60"
                      }`}
                    >
                      {isSelected ? "✓ " : "+ "}
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Testimonial / Feedback Text */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Ulasan & Pesan untuk Psikolog
              </label>
              <textarea
                rows={3}
                required
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Ceritakan bagaimana sesi ini membantu Anda, suasana obrolan, atau dampak positif yang Anda rasakan..."
                className="w-full text-xs p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-teal-500 font-nunito leading-relaxed"
              />
            </div>

            {/* 4. Anonymous Toggle & Privacy Notice */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <EyeOff size={13} className="text-teal-600 dark:text-teal-400" />
                  <span>Ulasan Anonim (Samarkan Nama Saya)</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isAnonymous
                    ? "Nama Anda akan ditampilkan sebagai 'Klien Anonim' di profil psikolog."
                    : `Nama profil (${user.fullName || "Wahyu Tricahyo"}) akan terlihat publik.`}
                </p>
              </div>
              <Switch checked={isAnonymous} onCheckedChange={setIsAnonymous} />
            </div>

            {/* 5. Action Buttons */}
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
                className="text-xs h-9 rounded-xl px-4 cursor-pointer"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="text-xs h-9 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl px-4 shadow-xs cursor-pointer gap-1.5"
              >
                {isSubmitting ? (
                  <span>Mengirim...</span>
                ) : (
                  <>
                    <Send size={13} />
                    <span>Kirim Evaluasi Sesi</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
