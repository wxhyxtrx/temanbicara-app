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

  // Submission & feedback state
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    setErrorMessage(null);
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

  // Fallback: If psychologist chosen but no slotIso, load slots
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
        if (slots.length > 0 && !activeSlotIso) {
          setActiveSlotIso(slots[0]);
        }
      } catch (err) {
        console.error("Gagal memuat slot psikolog:", err);
      } finally {
        setLoadingSlots(false);
      }
    },
    [activeSlotIso]
  );

  useEffect(() => {
    if (isOpen && activePsychologist?.id && !slotIso) {
      loadAvailableSlots(activePsychologist.id);
    }
  }, [isOpen, activePsychologist?.id, slotIso, loadAvailableSlots]);

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
      setErrorMessage("Silakan pilih psikolog terlebih dahulu.");
      return;
    }
    if (!activeSlotIso) {
      setErrorMessage("Silakan pilih tanggal dan jam slot konseling.");
      return;
    }
    if (!isKeluhanValid) {
      setErrorMessage("Keluhan wajib diisi minimal 20 karakter dan maksimal 1000 karakter.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

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
        setErrorMessage(err.message || "Gagal memproses booking.");
      } else {
        setErrorMessage(
          err instanceof Error ? err.message : "Terjadi kesalahan saat memproses booking."
        );
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
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs flex items-center justify-between gap-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{errorMessage}</span>
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
            {activeSlotIso && (
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
            )}
          </div>

          {/* Fallback Slot Selector if not preselected */}
          {!slotIso && availableSlots.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center justify-between">
                <span>Pilih Slot Waktu Tersedia</span>
                <span className="text-[11px] text-teal-600 dark:text-teal-400 font-normal">
                  {availableSlots.length} slot
                </span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-1">
                {availableSlots.map((slot) => {
                  const isSel = activeSlotIso === slot;
                  return (
                    <button
                      type="button"
                      key={slot}
                      onClick={() => setActiveSlotIso(slot)}
                      className={`p-2 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        isSel
                          ? "bg-teal-600 text-white border-teal-600 font-semibold shadow-2xs"
                          : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <Clock size={12} className={isSel ? "text-white" : "text-teal-600"} />
                      <span>{formatWibTime(slot)}</span>
                    </button>
                  );
                })}
              </div>
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
              onChange={(e) => setKeluhan(e.target.value)}
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
                  <span className="font-mono text-rose-600 dark:text-rose-400 font-bold">
                    Kurang {sessionFeeCoins - currentCoinBalance} Koin
                  </span>
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
