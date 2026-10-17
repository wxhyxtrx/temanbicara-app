"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
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
import {
  Calendar as CalendarIcon,
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { MdVerified } from "react-icons/md";
import type { PatientBookingView } from "@/types/booking";
import {
  generate14DaysWib,
  getWibDateString,
  formatWibTime,
  formatWibDateFull,
  checkRescheduleEligibility,
} from "@/lib/booking-utils";
import { scheduleClient } from "@/services/schedule.client";
import { bookingClient, BookingApiError } from "@/services/booking.client";

interface RescheduleBookingModalProps {
  booking: PatientBookingView | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newStartAt: string) => void;
}

export function RescheduleBookingModal({
  booking,
  isOpen,
  onClose,
  onSuccess,
}: RescheduleBookingModalProps) {
  const isModeB = booking?.status === "awaiting_patient_choice";

  // Check eligibility for Mode A (status booked)
  const eligibility = useMemo(() => {
    if (!booking) return { eligible: false, reason: "Data booking tidak valid", hoursBefore: 0 };
    if (isModeB) return { eligible: true, hoursBefore: 999 };
    return checkRescheduleEligibility(booking.start_at, booking.reschedule_count);
  }, [booking, isModeB]);

  // 14 Days WIB list
  const days14 = useMemo(() => generate14DaysWib(), []);

  // Slots state from scheduleClient.getAvailableSlots
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlotIso, setSelectedSlotIso] = useState<string | null>(null);

  // Submit states
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successNewSlot, setSuccessNewSlot] = useState<string | null>(null);

  const psychId = booking?.psikolog_id;

  const loadSlots = useCallback(async () => {
    if (!psychId) return;
    setLoadingSlots(true);
    setSlotsError(null);
    try {
      const todayWib = getWibDateString();
      const res = await scheduleClient.getAvailableSlots(psychId, { from: todayWib, days: 14 });
      const rawSlots = res.data?.slots || res.slots || [];
      // Filter out current slot
      const filtered = rawSlots.filter((s: string) => s !== booking?.start_at);
      setSlots(filtered);
    } catch (err: unknown) {
      console.error("Gagal memuat slot jadwal reschedule:", err);
      setSlotsError("Gagal memuat slot jadwal baru. Silakan coba lagi.");
    } finally {
      setLoadingSlots(false);
    }
  }, [psychId, booking?.start_at]);

  useEffect(() => {
    if (isOpen && psychId) {
      loadSlots();
      setSelectedSlotIso(null);
      setSubmitError(null);
      setSuccessNewSlot(null);
    }
  }, [isOpen, psychId, loadSlots]);

  // Group slots by WIB date YYYY-MM-DD
  const slotsByDate = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const slotIso of slots) {
      const dKey = getWibDateString(new Date(slotIso));
      if (!map[dKey]) map[dKey] = [];
      map[dKey].push(slotIso);
    }
    for (const k in map) {
      map[k].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    }
    return map;
  }, [slots]);

  // Default selected date to first day that has available slots
  useEffect(() => {
    if (days14.length > 0 && !selectedDate) {
      const firstWithSlot = days14.find((d) => (slotsByDate[d.dateStr] || []).length > 0);
      setSelectedDate(firstWithSlot ? firstWithSlot.dateStr : days14[0].dateStr);
    }
  }, [days14, slotsByDate, selectedDate]);

  if (!booking) return null;

  const psychName = booking.psikolog?.nama_lengkap_gelar || "Psikolog Terverifikasi";
  const activeDayObj = days14.find((d) => d.dateStr === selectedDate) || days14[0];
  const activeSlots = slotsByDate[selectedDate] || [];

  const handleConfirmReschedule = async () => {
    if (!selectedSlotIso) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await bookingClient.rescheduleBooking(booking.id, {
        new_start_at: selectedSlotIso,
      });

      if (res?.success) {
        setSuccessNewSlot(selectedSlotIso);
      }
    } catch (err: unknown) {
      console.error("Gagal memindahkan jadwal booking:", err);
      if (err instanceof BookingApiError) {
        if (err.code === "RESCHEDULE_LIMIT_EXCEEDED") {
          setSubmitError("Jadwal sesi hanya dapat dipindahkan mandiri sebanyak 1 kali.");
        } else if (err.code === "RESCHEDULE_TOO_LATE") {
          setSubmitError("Pindah jadwal hanya dapat dilakukan paling lambat 24 jam sebelum sesi dimulai.");
        } else if (err.code === "SLOT_UNAVAILABLE") {
          setSubmitError("Slot jadwal baru sudah tidak tersedia atau telah dipesan pasien lain. Silakan pilih slot lain.");
          loadSlots();
        } else if (err.code === "LIMIT_DAILY") {
          setSubmitError("Anda telah memiliki jadwal lain dengan psikolog ini di hari kalender yang sama.");
        } else if (err.code === "SAME_SLOT_SELECTED") {
          setSubmitError("Slot waktu baru tidak boleh sama dengan slot jadwal saat ini.");
        } else {
          setSubmitError(err.message || "Gagal memindahkan jadwal sesi.");
        }
      } else if (err instanceof Error) {
        setSubmitError(err.message);
      } else {
        setSubmitError("Terjadi kesalahan sistem saat memindahkan jadwal.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinish = () => {
    const slot = successNewSlot;
    setSuccessNewSlot(null);
    setSubmitError(null);
    onClose();
    if (slot) {
      onSuccess(slot);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !submitting) {
          setSuccessNewSlot(null);
          setSubmitError(null);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto font-nunito p-4 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-2xl">
        <DialogHeader className="space-y-1 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-400 flex items-center justify-center shrink-0">
              <RotateCcw size={18} />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold font-heading text-slate-900 dark:text-white">
                {isModeB ? "Pilih Jadwal Sesi Pengganti" : "Pindahkan Jadwal Konseling"}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                {isModeB
                  ? "Pilih slot baru bersama psikolog tanpa biaya tambahan"
                  : "Pilih tanggal dan jam slot baru bersama psikolog yang sama"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {successNewSlot ? (
          /* SUCCESS VIEW */
          <div className="py-6 space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 size={32} />
            </div>

            <div className="space-y-1">
              <h3 className="font-heading font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                Jadwal Berhasil Dipindahkan!
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Sesi konseling Anda bersama <span className="font-semibold text-slate-800 dark:text-slate-200">{psychName}</span> telah diperbarui.
              </p>
            </div>

            {/* Kotak Jadwal Baru */}
            <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-1 text-center max-w-md mx-auto">
              <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block">
                Jadwal Sesi Baru (WIB):
              </span>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {formatWibDateFull(successNewSlot)}
              </p>
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                Pukul {formatWibTime(successNewSlot)} (45 Menit)
              </p>
            </div>

            <Button
              type="button"
              onClick={handleFinish}
              className="w-full sm:w-auto min-w-[200px] bg-teal-600 hover:bg-teal-700 text-white rounded-xl h-9 text-xs font-semibold shadow-xs"
            >
              Lihat Jadwal Saya
            </Button>
          </div>
        ) : !eligibility.eligible ? (
          /* INELIGIBLE VIEW (Untuk Mode A jika syarat tidak terpenuhi) */
          <div className="py-6 space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-xs">
              <AlertCircle size={32} />
            </div>

            <div className="space-y-1">
              <h3 className="font-heading font-bold text-base text-slate-900 dark:text-white">
                Tidak Dapat Memindahkan Jadwal
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
                {eligibility.reason}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-left text-xs text-slate-600 dark:text-slate-400 space-y-1.5 max-w-md mx-auto">
              <span className="font-bold text-slate-800 dark:text-slate-200">
                Aturan Pemindahan Jadwal Mandiri:
              </span>
              <ul className="list-disc pl-4 space-y-1 text-[11px]">
                <li>Maksimal 1 kali pemindahan per booking.</li>
                <li>Hanya dapat diajukan paling lambat 24 jam sebelum waktu sesi dimulai.</li>
                <li>Jika berhalangan hadir kurang dari 24 jam, Anda dapat membatalkan sesi sesuai ketentuan refund.</li>
              </ul>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="text-xs rounded-xl h-9 px-6"
            >
              Kembali
            </Button>
          </div>
        ) : (
          /* SLOT PICKER VIEW (REUSE F2) */
          <div className="space-y-5 pt-2">
            {/* Header Ringkas Psikolog & Jadwal Saat Ini */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                    {psychName}
                  </span>
                  <MdVerified className="text-sky-500 text-xs" />
                </div>
                <p className="text-[11px] text-teal-700 dark:text-teal-400">
                  {booking.psikolog?.spesialisasi.join(", ") || "Konseling Klinis"}
                </p>
              </div>

              <div className="text-left sm:text-right space-y-0.5 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200 dark:border-slate-700">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                  Jadwal Sesi Saat Ini:
                </span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {formatWibDateFull(booking.start_at)}, {formatWibTime(booking.start_at)}
                </span>
              </div>
            </div>

            {/* Notice Mode B vs Mode A */}
            {isModeB ? (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                <span>
                  Pemindahan jadwal ini bebas biaya karena sesi sebelumnya dibatalkan oleh psikolog.
                </span>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 text-xs flex items-center gap-2">
                <RotateCcw size={15} className="text-teal-600 shrink-0" />
                <span>
                  Pemindahan mandiri (1x) ke slot waktu lain bersama psikolog ini. Koin tidak terpotong ulang.
                </span>
              </div>
            )}

            {/* 1. PEMILIH TANGGAL (14 HARI WIB) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <CalendarIcon size={14} className="text-teal-600 dark:text-teal-400" />
                  Pilih Tanggal Baru (14 Hari ke Depan):
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={loadSlots}
                  disabled={loadingSlots}
                  className="h-6 px-2 text-[11px] text-teal-700 dark:text-teal-300"
                >
                  <RefreshCw size={11} className={loadingSlots ? "animate-spin mr-1" : "mr-1"} />
                  Segarkan Slot
                </Button>
              </div>

              {/* Deret 14 Hari Horizontal */}
              <div className="flex gap-2 overflow-x-auto pb-2 pt-1 no-scrollbar scroll-smooth">
                {days14.map((d) => {
                  const isSelected = selectedDate === d.dateStr;
                  const slotCount = (slotsByDate[d.dateStr] || []).length;
                  return (
                    <button
                      key={d.dateStr}
                      type="button"
                      onClick={() => {
                        setSelectedDate(d.dateStr);
                        setSelectedSlotIso(null);
                      }}
                      className={`shrink-0 flex flex-col items-center justify-center px-3 py-2 rounded-xl text-center border transition-all cursor-pointer min-w-[76px] ${
                        isSelected
                          ? "bg-teal-600 text-white border-teal-600 shadow-xs ring-2 ring-teal-500/40"
                          : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-teal-300"
                      }`}
                    >
                      <span className="text-[11px] font-semibold">{d.dayLabel}</span>
                      <span className="text-xs font-bold font-heading">{d.formattedDate}</span>
                      <span
                        className={`text-[9px] mt-1 px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap ${
                          isSelected
                            ? "bg-white/20 text-white"
                            : slotCount > 0
                            ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                            : "bg-slate-100 dark:bg-slate-700 text-slate-400"
                        }`}
                      >
                        {slotCount > 0 ? `${slotCount} slot` : "Penuh"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. JAM DARI /slots UNTUK HARI TERPILIH */}
            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Jam Praktik Tersedia ({activeDayObj.fullLabel}):
                </span>
                <span className="text-[11px] text-teal-700 dark:text-teal-400 font-medium">
                  {activeSlots.length} slot jam
                </span>
              </div>

              {loadingSlots ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((n) => (
                    <Skeleton key={n} className="h-10 rounded-xl bg-slate-200 dark:bg-slate-800" />
                  ))}
                </div>
              ) : slotsError ? (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
                  <span>{slotsError}</span>
                  <Button size="sm" variant="outline" onClick={loadSlots} className="h-7 text-xs">
                    Coba Lagi
                  </Button>
                </div>
              ) : activeSlots.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-center space-y-1">
                  <Clock className="w-5 h-5 mx-auto text-slate-400" />
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Tidak ada slot jadwal yang tersedia pada tanggal ini
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Pilih tanggal lain yang memiliki penanda slot hijau di atas.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {activeSlots.map((slotIso) => {
                    const isSelected = selectedSlotIso === slotIso;
                    const timeLabel = formatWibTime(slotIso);
                    return (
                      <button
                        key={slotIso}
                        type="button"
                        onClick={() => setSelectedSlotIso(slotIso)}
                        className={`p-2.5 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? "bg-teal-600 text-white border-teal-600 shadow-xs ring-2 ring-teal-500/40"
                            : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-teal-400"
                        }`}
                      >
                        <Clock size={13} className={isSelected ? "text-white" : "text-teal-600 dark:text-teal-400"} />
                        <span>{timeLabel}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Selected Slot Confirmation Bar */}
              {selectedSlotIso && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div>
                      <p className="font-bold">
                        Slot Terpilih: {formatWibDateFull(selectedSlotIso)}, {formatWibTime(selectedSlotIso)}
                      </p>
                      <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                        Durasi sesi: 45 menit • Tetap dengan {psychName}
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-emerald-600 text-white text-[10px]">Siap Dipindahkan</Badge>
                </div>
              )}
            </div>

            {/* Error Message */}
            {submitError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0 text-rose-600" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={submitting}
                className="text-xs rounded-xl h-8 px-4"
              >
                Batal
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={handleConfirmReschedule}
                disabled={!selectedSlotIso || submitting}
                className={`text-xs rounded-xl h-8 px-4 font-semibold shadow-xs gap-1.5 ${
                  selectedSlotIso && !submitting
                    ? "bg-teal-600 hover:bg-teal-700 text-white cursor-pointer"
                    : "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                }`}
              >
                {submitting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw size={13} />
                    <span>Konfirmasi Jadwal Baru</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
