"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Star, AlertCircle, CheckCircle2, Edit3, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/toast";
import { bookingClient } from "@/services/booking.client";
import type { SessionReviewEntity } from "@/types/booking";

interface SessionReviewCardProps {
  bookingId: string;
  endedAt?: string | null;
  compact?: boolean;
  onReviewSubmitted?: (review: SessionReviewEntity) => void;
}

export function SessionReviewCard({
  bookingId,
  endedAt,
  compact = false,
  onReviewSubmitted,
}: SessionReviewCardProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [existingReview, setExistingReview] = useState<SessionReviewEntity | null>(null);

  // Form states
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [reviewText, setReviewText] = useState<string>("");
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Calculate 7-day edit window
  const isWithin7Days = useCallback(() => {
    const referenceDateStr = existingReview?.created_at || endedAt;
    if (!referenceDateStr) return true;
    const refTime = new Date(referenceDateStr).getTime();
    if (isNaN(refTime)) return true;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    return Date.now() <= refTime + sevenDaysMs;
  }, [existingReview?.created_at, endedAt]);

  const fetchReview = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await bookingClient.getReview(bookingId);
      if (res.success && res.data) {
        setExistingReview(res.data);
        if (res.data.rating) setRating(res.data.rating);
        if (res.data.review) setReviewText(res.data.review);
      }
    } catch (err: unknown) {
      console.error("Gagal mengambil review booking:", err);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    if (bookingId) {
      fetchReview();
    }
  }, [bookingId, fetchReview]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1 || rating > 5) {
      setErrorMsg("Pilih rating bintang antara 1 sampai 5.");
      return;
    }
    if (reviewText.trim().length > 500) {
      setErrorMsg("Ulasan maksimal 500 karakter.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await bookingClient.submitReview(bookingId, {
        rating,
        review: reviewText.trim() || null,
      });

      if (res.success && res.data) {
        setExistingReview(res.data);
        setIsEditing(false);
        notify.success(
          "Penilaian Berhasil Disimpan",
          "Terima kasih telah memberikan ulasan untuk konseling ini."
        );
        if (onReviewSubmitted) onReviewSubmitted(res.data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan ulasan.";
      setErrorMsg(msg);
      notify.error("Gagal Menyimpan Ulasan", msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-center gap-2 text-xs text-slate-400">
        <Loader2 size={14} className="animate-spin text-teal-600" />
        <span>Memuat data penilaian sesi...</span>
      </div>
    );
  }

  const hasSubmitted = !!existingReview;
  const canEdit = isWithin7Days();

  // Mode View Only (Sudah ada review dan tidak sedang mengedit)
  if (hasSubmitted && !isEditing) {
    return (
      <div className="p-4 sm:p-5 rounded-2xl border border-teal-200/90 dark:border-teal-800/80 bg-teal-50/30 dark:bg-teal-950/20 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-teal-600 dark:text-teal-400 shrink-0" />
              <h4 className="text-xs sm:text-sm font-bold font-heading text-slate-900 dark:text-white">
                Penilaian Sesi Anda
              </h4>
            </div>
            <div className="flex items-center gap-1 text-amber-500">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={15}
                  className={
                    star <= (existingReview.rating || 0)
                      ? "fill-amber-400 text-amber-400"
                      : "text-slate-300 dark:text-slate-700"
                  }
                />
              ))}
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-1">
                {existingReview.rating} / 5
              </span>
            </div>
          </div>

          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="text-xs border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300 hover:bg-teal-100/50 h-8 px-3 rounded-xl gap-1.5"
            >
              <Edit3 size={12} />
              <span>Edit Ulasan</span>
            </Button>
          ) : (
            <span className="text-[11px] text-slate-400 italic">
              Batas edit 7 hari berakhir
            </span>
          )}
        </div>

        {existingReview.review ? (
          <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-teal-100 dark:border-teal-900/60 text-xs text-slate-700 dark:text-slate-300 leading-relaxed italic">
            "{existingReview.review}"
          </div>
        ) : (
          <p className="text-[11px] text-slate-400 italic">
            (Tidak ada ulasan tertulis)
          </p>
        )}

        {canEdit && (
          <p className="text-[10px] text-slate-500 dark:text-slate-400">
            * Ulasan dapat diperbarui dalam 7 hari sejak sesi berakhir.
          </p>
        )}
      </div>
    );
  }

  // Form Mode: Pengisian atau Pengeditan Review
  return (
    <form
      onSubmit={handleSubmit}
      className={`rounded-2xl border transition-all ${
        compact
          ? "p-3.5 sm:p-4 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40"
          : "p-4 sm:p-5 border-amber-200/90 dark:border-amber-800/80 bg-gradient-to-br from-amber-50/40 via-white to-amber-50/20 dark:from-amber-950/20 dark:via-slate-900 dark:to-slate-900"
      } space-y-3.5`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-0.5">
          <h4 className="text-xs sm:text-sm font-bold font-heading text-slate-900 dark:text-white flex items-center gap-1.5">
            <Star size={15} className="fill-amber-400 text-amber-500" />
            <span>{hasSubmitted ? "Perbarui Penilaian Sesi" : "Beri Penilaian & Ulasan"}</span>
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Penilaian Anda membantu peningkatan kualitas layanan konseling (bisa diedit dalam 7 hari)
          </p>
        </div>

        {isEditing && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsEditing(false);
              if (existingReview?.rating) setRating(existingReview.rating);
              if (existingReview?.review) setReviewText(existingReview.review);
            }}
            className="text-xs text-slate-500 h-7 px-2"
          >
            Batal
          </Button>
        )}
      </div>

      {/* Pilihan Rating Bintang (1 - 5) */}
      <div className="flex items-center gap-1 pt-0.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= (hoverRating || rating);
          return (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-1 rounded-lg hover:bg-amber-100/60 dark:hover:bg-amber-950/60 transition-colors cursor-pointer text-amber-500"
              title={`${star} Bintang`}
              aria-label={`Beri rating ${star} dari 5 bintang`}
            >
              <Star
                size={22}
                className={
                  isFilled
                    ? "fill-amber-400 text-amber-400 transition-transform scale-110"
                    : "text-slate-300 dark:text-slate-600"
                }
              />
            </button>
          );
        })}
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-2">
          {rating} / 5 Bintang
        </span>
      </div>

      {/* Textarea Ulasan dengan Max 500 Karakter */}
      <div className="space-y-1.5">
        <textarea
          value={reviewText}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
            if (e.target.value.length <= 500) {
              setReviewText(e.target.value);
            }
          }}
          maxLength={500}
          rows={3}
          placeholder="Ceritakan pengalaman konseling Anda (opsional)..."
          className="w-full p-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-teal-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
        />

        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <span>Maksimal 500 karakter</span>
          <span className={reviewText.length >= 480 ? "text-amber-600 font-bold" : ""}>
            {reviewText.length}/500
          </span>
        </div>
      </div>

      {/* Peringatan Privasi (Wajib sesuai kriteria) */}
      <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200/80 dark:border-amber-900/60 flex items-start gap-2 text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
        <ShieldAlert size={14} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <span>
          <strong>Peringatan Privasi:</strong> Demi keamanan data Anda, mohon <strong>jangan menulis nama lengkap, kontak/no WA, akun medsos, atau informasi pribadi</strong> lainnya pada kolom ulasan.
        </span>
      </div>

      {errorMsg && (
        <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300">
          <AlertCircle size={14} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tombol Simpan */}
      <div className="flex justify-end pt-1">
        <Button
          type="submit"
          disabled={submitting}
          className="text-xs bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl h-8 px-4 gap-1.5 shadow-2xs cursor-pointer"
        >
          {submitting ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              <span>Menyimpan...</span>
            </>
          ) : (
            <span>{hasSubmitted ? "Perbarui Ulasan" : "Kirim Ulasan"}</span>
          )}
        </Button>
      </div>
    </form>
  );
}
