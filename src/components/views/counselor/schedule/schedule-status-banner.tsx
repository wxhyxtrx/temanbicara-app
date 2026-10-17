"use client";

import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  PauseCircle,
  PlayCircle,
  AlertOctagon,
  Loader2,
  ShieldAlert,
  Info,
} from "lucide-react";
import { notify } from "@/lib/toast";
import { userService } from "@/services/user.service";
import { useUserStore } from "@/store/user-store";

interface ScheduleStatusBannerProps {
  bookingPaused: boolean;
  suspendedUntil: string | null;
  onBookingPausedChange: (paused: boolean) => void;
}

function formatWibDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }) + " WIB";
}

export function ScheduleStatusBanner({
  bookingPaused,
  suspendedUntil,
  onBookingPausedChange,
}: ScheduleStatusBannerProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const isSuspended = Boolean(
    suspendedUntil && new Date(suspendedUntil).getTime() > Date.now()
  );

  const handleTogglePaused = async (checked: boolean) => {
    setIsUpdating(true);
    try {
      const res = await userService.updateMe({
        booking_paused: checked,
      });

      if (res.success && res.data) {
        useUserStore.getState().setAuthSession(res.data.user, undefined, res.data.profile);
        onBookingPausedChange(checked);

        if (checked) {
          notify.warning(
            "Booking Dijeda",
            "Slot jadwal Anda disembunyikan dari pasien. Janji temu yang sudah aktif tetap berjalan."
          );
        } else {
          notify.success(
            "Booking Diaktifkan",
            "Slot jadwal Anda kini dapat dipesan kembali oleh pasien."
          );
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memperbarui status booking.";
      notify.error("Kesalahan", msg);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Banner Suspensi Akun (Bila Ada) */}
      {isSuspended && suspendedUntil && (
        <div className="p-4 sm:p-5 rounded-2xl border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/70 text-rose-950 dark:text-rose-100 shadow-xs animate-in fade-in">
          <div className="flex items-start gap-3.5">
            <div className="p-2 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 shrink-0">
              <AlertOctagon size={22} />
            </div>
            <div className="space-y-1.5 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-heading font-bold text-sm sm:text-base text-rose-900 dark:text-rose-100">
                  Akun Praktik Sedang Dalam Masa Suspensi
                </h3>
                <Badge className="bg-rose-600 hover:bg-rose-700 text-white font-mono text-[11px] px-2 py-0.5">
                  Tersuspensi
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-rose-800 dark:text-rose-300 font-nunito leading-relaxed">
                Akun praktik Anda sedang disuspensi sementara hingga{" "}
                <strong className="font-semibold underline decoration-rose-400">
                  {formatWibDateTime(suspendedUntil)}
                </strong>{" "}
                akibat penumpukan poin strike sistem (misalnya pembatalan mendadak atau sesi terlewat).
              </p>
              <div className="pt-1 flex items-center gap-1.5 text-xs text-rose-700 dark:text-rose-400">
                <ShieldAlert size={14} className="shrink-0" />
                <span>
                  Selama periode ini, seluruh slot jadwal Anda ditutup otomatis dari pasien. Hubungi tim admin TemanBicara jika Anda membutuhkan klarifikasi.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Card Toggle Jeda Terima Booking */}
      <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {bookingPaused ? (
                  <PauseCircle size={18} className="text-amber-500 shrink-0" />
                ) : (
                  <PlayCircle size={18} className="text-emerald-500 shrink-0" />
                )}
                <h3 className="font-heading font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                  Status Penerimaan Janji Temu (Booking)
                </h3>
                {bookingPaused ? (
                  <Badge
                    variant="outline"
                    className="text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                  >
                    Sedang Dijeda
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                  >
                    Menerima Booking
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-nunito max-w-2xl leading-relaxed">
                {bookingPaused
                  ? "Penerimaan booking sedang dijeda. Slot jadwal praktik Anda disembunyikan dari katalog publik. Pasien tidak dapat membuat janji temu baru, namun sesi yang sudah terkonfirmasi tetap berjalan seperti biasa."
                  : "Slot jadwal praktik Anda terbuka untuk publik. Pasien dapat memilih tanggal dan memesan sesi konseling sesuai pola mingguan dan ketersediaan waktu Anda."}
              </p>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Jeda Terima Booking:
              </span>
              <div className="flex items-center gap-2">
                {isUpdating && <Loader2 size={15} className="animate-spin text-teal-600" />}
                <Switch
                  id="bookingPausedSwitch"
                  checked={bookingPaused}
                  disabled={isUpdating}
                  onCheckedChange={handleTogglePaused}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
