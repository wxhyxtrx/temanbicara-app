"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserStore } from "@/store/user-store";
import type { PublicPsychologist } from "@/types/user-profile";
import type { WalletInfoResponse } from "@/types/wallet";
import { walletClient } from "@/services/wallet.client";
import { bookingClient, BookingApiError } from "@/services/booking.client";
import { scheduleClient } from "@/services/schedule.client";
import { userService } from "@/services/user.service";
import {
  tarifToCoins,
  formatRupiah,
  getInitials,
  formatWibTime,
  formatWibDateFull,
  getWibDateString,
} from "@/lib/booking-utils";
import {
  Calendar as CalendarIcon,
  Clock,
  ShieldCheck,
  Coins,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  User,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { MdVerified } from "react-icons/md";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { notify } from "@/lib/toast";

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  psychologist?: PublicPsychologist | null;
  slotIso?: string | null;
  initialConsultantId?: number;
  onSuccess?: () => void;
  onReloadSlots?: () => void;
}

export type BookingErrorCode =
  | "SLOT_UNAVAILABLE"
  | "INSUFFICIENT_COINS"
  | "LIMIT_ACTIVE"
  | "LIMIT_DAILY"
  | "VALIDATION_ERROR"
  | "GENERAL";

export interface BookingErrorState {
  code: BookingErrorCode;
  message: string;
}

export function BookingModal({
  isOpen,
  onClose,
  psychologist,
  slotIso,
  initialConsultantId,
  onSuccess,
  onReloadSlots,
}: BookingModalProps) {
  const router = useRouter();
  const user = useUserStore((state) => state.user);

  // Form input state
  const [keluhan, setKeluhan] = useState<string>("");

  // Psych & Slot selection if not provided via props
  const [activePsychologist, setActivePsychologist] = useState<PublicPsychologist | null>(
    psychologist || null
  );
  const [activeSlotIso, setActiveSlotIso] = useState<string | null>(slotIso || null);
  const [psychologistsList, setPsychologistsList] = useState<PublicPsychologist[]>([]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);

  // Wallet balance state
  const [wallet, setWallet] = useState<WalletInfoResponse | null>(null);
  const [loadingWallet, setLoadingWallet] = useState<boolean>(true);

  // Submission & structured error feedback state
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [bookingError, setBookingError] = useState<BookingErrorState | null>(null);

  // Sync props when modal opens or props change
  useEffect(() => {
    if (psychologist) {
      setActivePsychologist(psychologist);
    }
    if (slotIso) {
      setActiveSlotIso(slotIso);
    }
  }, [psychologist, slotIso]);

  // Load wallet balance on open
  useEffect(() => {
    if (!isOpen) return;

    setKeluhan("");
    setBookingError(null);
    setLoadingWallet(true);

    walletClient
      .getWalletMe()
      .then((data) => {
        setWallet(data);
      })
      .catch((err) => {
        console.error("Gagal memuat data dompet:", err);
      })
      .finally(() => {
        setLoadingWallet(false);
      });
  }, [isOpen]);

  // Fallback: If no psychologist passed, load public psychologists
  useEffect(() => {
    if (!isOpen) return;
    if (!psychologist) {
      userService
        .getPsychologists({ limit: 20 })
        .then((res) => {
          if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
            setPsychologistsList(res.data);
            if (!activePsychologist) {
              setActivePsychologist(res.data[0]);
            }
          }
        })
        .catch((err) => console.error("Gagal memuat daftar psikolog:", err));
    }
  }, [isOpen, psychologist, activePsychologist]);

  // Load available slots
  const loadAvailableSlots = useCallback(
    async (psychId: string) => {
      setLoadingSlots(true);
      try {
        const todayWib = getWibDateString();
        const res = await scheduleClient.getAvailableSlots(psychId, {
          from: todayWib,
          days: 14,
        });
        const slots = res.data?.slots || res.slots || [];
        setAvailableSlots(slots);
        return slots;
      } catch (err) {
        console.error("Gagal memuat slot psikolog:", err);
        return [];
      } finally {
        setLoadingSlots(false);
      }
    },
    []
  );

  useEffect(() => {
    if (isOpen && activePsychologist?.id && !slotIso) {
      loadAvailableSlots(activePsychologist.id);
    }
  }, [isOpen, activePsychologist?.id, slotIso, loadAvailableSlots]);

  // Manual reload slots handler for 409 SLOT_UNAVAILABLE
  const handleReloadSlotsAction = async () => {
    setActiveSlotIso(null);
    setBookingError(null);
    if (activePsychologist?.id) {
      const refreshedSlots = await loadAvailableSlots(activePsychologist.id);
      if (refreshedSlots.length > 0) {
        setActiveSlotIso(refreshedSlots[0]);
      }
    }
    if (onReloadSlots) {
      onReloadSlots();
    }
  };

  // Keluhan counter & validation (20 - 1000 chars)
  const keluhanTrimmed = keluhan.trim();
  const keluhanLength = keluhan.length;
  const isKeluhanValid = keluhanTrimmed.length >= 20 && keluhanLength <= 1000;

  // Pricing & Coins summary
  const sessionFeeCoins = activePsychologist
    ? tarifToCoins(activePsychologist.tarif_sesi)
    : 15;
  const currentCoinBalance = wallet ? wallet.coin_balance : user.coins || 0;
  const isBalanceSufficient = currentCoinBalance >= sessionFeeCoins;
  const remainingCoins = currentCoinBalance - sessionFeeCoins;

  // Handle Booking Submission
  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePsychologist?.id) {
      setBookingError({
        code: "VALIDATION_ERROR",
        message: "Silakan pilih psikolog terlebih dahulu.",
      });
      return;
    }
    if (!activeSlotIso) {
      setBookingError({
        code: "VALIDATION_ERROR",
        message: "Silakan pilih tanggal dan jam slot konseling yang tersedia.",
      });
      return;
    }
    if (!isKeluhanValid) {
      setBookingError({
        code: "VALIDATION_ERROR",
        message: "Keluhan wajib diisi minimal 20 karakter dan maksimal 1000 karakter.",
      });
      return;
    }

    setSubmitting(true);
    setBookingError(null);

    try {
      const res = await bookingClient.createBooking({
        psikolog_id: activePsychologist.id,
        start_at: activeSlotIso,
        keluhan: keluhanTrimmed,
      });

      if (res.success) {
        notify.success(
          "Booking Berhasil Dikonfirmasi!",
          `Sesi bersama ${activePsychologist.nama_lengkap_gelar} pada ${formatWibDateFull(
            activeSlotIso
          )} (${formatWibTime(activeSlotIso)}) berhasil dijadwalkan.`
        );
        onClose();
        if (onSuccess) onSuccess();
        router.push("/patient/schedule");
      }
    } catch (err: unknown) {
      if (err instanceof BookingApiError) {
        const msg = err.message || "";
        const code = err.code || "";

        // 409 SLOT_UNAVAILABLE -> pesan "Slot baru saja dipesan orang lain" + muat ulang slot
        if (
          err.status === 409 &&
          (code === "SLOT_UNAVAILABLE" ||
            msg.includes("SLOT_UNAVAILABLE") ||
            msg.includes("sudah tidak tersedia") ||
            msg.includes("dipesan orang lain"))
        ) {
          setBookingError({
            code: "SLOT_UNAVAILABLE",
            message: "Slot baru saja dipesan orang lain",
          });
          // Muat ulang slot otomatis
          if (activePsychologist?.id) {
            loadAvailableSlots(activePsychologist.id);
          }
          if (onReloadSlots) {
            onReloadSlots();
          }
        }
        // 402 INSUFFICIENT_COINS -> tombol ke /patient/top-up
        else if (
          err.status === 402 ||
          code === "INSUFFICIENT_COINS" ||
          msg.includes("INSUFFICIENT_COINS") ||
          msg.includes("Saldo koin tidak mencukupi")
        ) {
          setBookingError({
            code: "INSUFFICIENT_COINS",
            message:
              msg ||
              "Saldo koin tidak mencukupi untuk memesan sesi konseling ini. Silakan lakukan isi ulang koin terlebih dahulu.",
          });
        }
        // 409 LIMIT_ACTIVE -> pesan jelas
        else if (
          err.status === 409 &&
          (code === "LIMIT_ACTIVE" ||
            msg.includes("LIMIT_ACTIVE") ||
            msg.includes("maksimum 3 sesi"))
        ) {
          setBookingError({
            code: "LIMIT_ACTIVE",
            message:
              "Anda telah mencapai batas maksimum 3 sesi booking aktif. Selesaikan atau batalkan sesi sebelumnya terlebih dahulu sebelum memesan jadwal baru.",
          });
        }
        // 409 LIMIT_DAILY -> pesan jelas
        else if (
          err.status === 409 &&
          (code === "LIMIT_DAILY" ||
            msg.includes("LIMIT_DAILY") ||
            msg.includes("hari kalender yang sama"))
        ) {
          setBookingError({
            code: "LIMIT_DAILY",
            message:
              "Anda sudah memiliki jadwal sesi dengan psikolog ini di hari kalender yang sama. Silakan pilih tanggal atau hari yang berbeda.",
          });
        }
        // 422 -> tampilkan pesan server
        else if (
          err.status === 422 ||
          code === "VALIDATION_ERROR" ||
          code === "INVALID_KELUHAN"
        ) {
          setBookingError({
            code: "VALIDATION_ERROR",
            message:
              msg || "Data input tidak valid. Pastikan keluhan terdiri dari 20 hingga 1000 karakter.",
          });
        }
        // Generic Booking Error
        else {
          setBookingError({
            code: "GENERAL",
            message: msg || "Terjadi kesalahan saat memproses booking.",
          });
        }
      } else {
        setBookingError({
          code: "GENERAL",
          message:
            err instanceof Error
              ? err.message
              : "Terjadi kesalahan sistem saat memproses booking.",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl font-nunito p-4 sm:p-6 rounded-2xl max-h-[92vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-2xl">
        <DialogHeader className="space-y-1 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-400 flex items-center justify-center shrink-0">
              <CalendarIcon size={18} />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold font-heading text-slate-900 dark:text-white">
                Konfirmasi Reservasi & Pembayaran Sesi
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                Lengkapi keluhan konseling dan pastikan saldo koin mencukupi
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleBookingSubmit} className="space-y-5 pt-2">
          {/* Structured Error State Banner */}
          {bookingError && (
            <div
              className={`p-4 rounded-2xl border text-xs space-y-2.5 animate-in fade-in duration-200 ${
                bookingError.code === "INSUFFICIENT_COINS"
                  ? "bg-amber-50/90 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200"
                  : "bg-rose-50/90 dark:bg-rose-950/60 border-rose-300 dark:border-rose-900 text-rose-900 dark:text-rose-200"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <AlertCircle
                    size={18}
                    className={`shrink-0 mt-0.5 ${
                      bookingError.code === "INSUFFICIENT_COINS"
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  />
                  <div className="space-y-0.5">
                    <p className="font-bold text-xs sm:text-sm">
                      {bookingError.code === "SLOT_UNAVAILABLE"
                        ? "Slot baru saja dipesan orang lain"
                        : bookingError.code === "INSUFFICIENT_COINS"
                        ? "Saldo Koin Tidak Mencukupi"
                        : bookingError.code === "LIMIT_ACTIVE"
                        ? "Batas Maksimum 3 Sesi Booking Aktif"
                        : bookingError.code === "LIMIT_DAILY"
                        ? "Jadwal Ganda di Hari yang Sama"
                        : bookingError.code === "VALIDATION_ERROR"
                        ? "Pesan Validasi Server"
                        : "Gagal Memproses Booking"}
                    </p>
                    <p className="text-[11px] leading-relaxed opacity-90">
                      {bookingError.message}
                    </p>
                  </div>
                </div>

                {/* Tombol Khusus per Error */}
                {bookingError.code === "SLOT_UNAVAILABLE" && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleReloadSlotsAction}
                    disabled={loadingSlots}
                    className="shrink-0 text-xs bg-rose-600 hover:bg-rose-700 text-white rounded-xl h-8 px-3.5 font-semibold gap-1.5 cursor-pointer shadow-xs"
                  >
                    <RefreshCw size={12} className={loadingSlots ? "animate-spin" : ""} />
                    <span>Muat Ulang Slot</span>
                  </Button>
                )}

                {bookingError.code === "INSUFFICIENT_COINS" && (
                  <Link href="/patient/top-up" onClick={onClose} className="shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      className="text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-xl h-8 px-4 font-bold gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Coins size={13} />
                      <span>Top Up Koin</span>
                      <ExternalLink size={12} />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* 1. Ringkasan Psikolog Terpilih */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-teal-50/40 dark:bg-teal-950/30 border border-teal-200/80 dark:border-teal-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                {activePsychologist?.avatar_url ? (
                  <img
                    src={activePsychologist.avatar_url}
                    alt={activePsychologist.nama_lengkap_gelar}
                    className="w-12 h-12 rounded-xl object-cover border border-teal-300 dark:border-teal-700"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-600 to-teal-800 text-white font-bold text-sm flex items-center justify-center font-heading shadow-xs">
                    {getInitials(activePsychologist?.nama_lengkap_gelar || "Psikolog")}
                  </div>
                )}
              </div>

              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white font-heading truncate">
                    {activePsychologist?.nama_lengkap_gelar || "Pilih Psikolog"}
                  </h4>
                  <MdVerified className="text-sky-500 text-xs shrink-0" />
                </div>
                <p className="text-xs text-teal-700 dark:text-teal-400 font-medium truncate">
                  {activePsychologist?.spesialisasi.join(", ") || "Psikologi Klinis Dewasa"}
                </p>
                <div className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <ShieldCheck size={12} className="text-emerald-500 shrink-0" />
                  <span>Pengalaman {activePsychologist?.tahun_pengalaman || 3} Tahun</span>
                </div>
              </div>
            </div>

            {/* Jadwal Terpilih Info */}
            {activeSlotIso ? (
              <div className="sm:text-right pt-2 sm:pt-0 border-t sm:border-t-0 border-teal-200/50 dark:border-teal-800/50">
                <span className="text-[10px] uppercase font-bold text-teal-800 dark:text-teal-300 tracking-wider block">
                  Jadwal Sesi Konseling (WIB)
                </span>
                <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center sm:justify-end gap-1.5 mt-0.5">
                  <Clock size={13} className="text-teal-600 dark:text-teal-400" />
                  <span>
                    {formatWibDateFull(activeSlotIso)}, {formatWibTime(activeSlotIso)}
                  </span>
                </p>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Durasi konsultasi: 60 Menit
                </span>
              </div>
            ) : (
              <div className="sm:text-right">
                <Badge variant="outline" className="border-amber-300 text-amber-700 dark:text-amber-400 text-xs">
                  Pilih slot waktu di bawah
                </Badge>
              </div>
            )}
          </div>

          {/* Slot Picker Display (ketika slot belum dipilih atau setelah reload slot) */}
          {(!activeSlotIso || bookingError?.code === "SLOT_UNAVAILABLE") && (
            <div className="p-3.5 rounded-2xl border border-teal-200/80 dark:border-teal-800/60 bg-teal-50/20 dark:bg-teal-950/20 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock size={13} className="text-teal-600" />
                  <span>Pilih Jam Praktik Tersedia (WIB)</span>
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleReloadSlotsAction}
                  disabled={loadingSlots}
                  className="h-7 px-2 text-[11px] text-teal-700 dark:text-teal-300 hover:bg-teal-100/50"
                >
                  <RefreshCw size={11} className={loadingSlots ? "animate-spin" : ""} />
                  <span className="ml-1">Segarkan Slot</span>
                </Button>
              </div>

              {loadingSlots ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((n) => (
                    <Skeleton key={n} className="h-9 rounded-xl bg-slate-200 dark:bg-slate-800" />
                  ))}
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-center text-xs text-slate-500">
                  Tidak ada slot jadwal yang tersedia dalam 14 hari ke depan untuk psikolog ini.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-0.5">
                  {availableSlots.map((slot) => {
                    const isSel = activeSlotIso === slot;
                    return (
                      <button
                        type="button"
                        key={slot}
                        onClick={() => {
                          setActiveSlotIso(slot);
                          setBookingError(null);
                        }}
                        className={`p-2 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          isSel
                            ? "bg-teal-600 text-white border-teal-600 font-semibold shadow-2xs"
                            : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                        }`}
                      >
                        <Clock size={12} className={isSel ? "text-white" : "text-teal-600 dark:text-teal-400"} />
                        <span>{formatWibTime(slot)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 2. Form Keluhan Konseling (Wajib 20 - 1000 Karakter) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1">
                <span>Keluhan & Hal yang Ingin Dikonsultasikan</span>
                <span className="text-rose-500 font-bold">*</span>
              </label>
              <span
                className={`text-[11px] font-mono font-semibold ${
                  keluhanLength === 0
                    ? "text-slate-400"
                    : keluhanLength < 20
                    ? "text-amber-600 dark:text-amber-400"
                    : keluhanLength <= 1000
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {keluhanLength} / 1000 karakter
              </span>
            </div>

            <textarea
              required
              rows={4}
              maxLength={1000}
              value={keluhan}
              onChange={(e) => {
                setKeluhan(e.target.value);
                if (bookingError?.code === "VALIDATION_ERROR") {
                  setBookingError(null);
                }
              }}
              placeholder="Ceritakan keluhan, beban emosi, atau hal spesifik yang ingin kamu bahas bersama psikolog (minimal 20 karakter)..."
              className={`w-full text-xs sm:text-sm p-3.5 rounded-xl border bg-slate-50/50 dark:bg-slate-800/60 focus:outline-hidden focus:ring-2 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 resize-none leading-relaxed transition-all ${
                keluhanLength > 0 && keluhanTrimmed.length < 20
                  ? "border-amber-400 focus:ring-amber-500"
                  : keluhanLength >= 20
                  ? "border-emerald-500/60 focus:ring-teal-500"
                  : "border-slate-200 dark:border-slate-700 focus:ring-teal-500"
              }`}
            />

            <div className="flex items-center justify-between text-[11px]">
              {keluhanLength === 0 ? (
                <span className="text-slate-400">
                  Minimal 20 karakter agar psikolog memahami konteks kondisimu.
                </span>
              ) : keluhanTrimmed.length < 20 ? (
                <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                  <AlertCircle size={12} />
                  <span>Kurang {20 - keluhanTrimmed.length} karakter lagi (minimal 20 karakter).</span>
                </span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 size={12} />
                  <span>Keluhan memenuhi syarat panjang karakter.</span>
                </span>
              )}
            </div>
          </div>

          {/* 3. Ringkasan Harga Koin & Saldo Koin Saat Ini */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700/80 space-y-3">
            <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Coins size={14} className="text-amber-500" />
              <span>Ringkasan Harga & Saldo Koin</span>
            </h5>

            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400">
                  Biaya Sesi Konseling (60 Menit):
                </span>
                <div className="text-right">
                  <span className="font-extrabold text-teal-700 dark:text-teal-400 font-mono text-sm">
                    {sessionFeeCoins} Koin
                  </span>
                  <span className="text-[11px] text-slate-400 block font-nunito">
                    (Setara {formatRupiah(activePsychologist?.tarif_sesi)})
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400">
                  Saldo Koin Anda Saat Ini:
                </span>
                {loadingWallet ? (
                  <Skeleton className="w-16 h-4 rounded-md" />
                ) : (
                  <span className="font-bold text-slate-900 dark:text-white font-mono text-sm">
                    {currentCoinBalance} Koin
                  </span>
                )}
              </div>

              <div className="pt-2.5 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-800 dark:text-slate-200">
                  Sisa Saldo Setelah Reservasi:
                </span>
                {loadingWallet ? (
                  <Skeleton className="w-20 h-4 rounded-md" />
                ) : isBalanceSufficient ? (
                  <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                    {remainingCoins} Koin
                  </span>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-rose-600 dark:text-rose-400 font-bold">
                      Kurang {sessionFeeCoins - currentCoinBalance} Koin
                    </span>
                    <Link href="/patient/top-up" onClick={onClose}>
                      <span className="text-[11px] underline text-teal-600 hover:text-teal-700 font-semibold cursor-pointer">
                        Isi Ulang
                      </span>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 4. Tombol Aksi */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              className="text-xs border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl h-10 px-4 cursor-pointer"
            >
              Batal
            </Button>

            <Button
              type="submit"
              disabled={
                submitting ||
                loadingWallet ||
                !isKeluhanValid ||
                !activeSlotIso ||
                !activePsychologist
              }
              className="text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-xl h-10 px-6 font-bold shadow-sm cursor-pointer gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Memproses Booking...</span>
                </>
              ) : (
                <>
                  <Coins size={14} />
                  <span>Bayar & Booking ({sessionFeeCoins} Koin)</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
