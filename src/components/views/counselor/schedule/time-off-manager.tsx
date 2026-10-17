"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CalendarOff,
  Plus,
  Trash2,
  AlertTriangle,
  Clock,
  Loader2,
  Calendar,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { notify } from "@/lib/toast";
import {
  scheduleClient,
  ScheduleApiError,
  type TimeOffItem,
  type ConflictingBooking,
} from "@/services/schedule.client";

interface TimeOffManagerProps {
  initialTimeOff: TimeOffItem[];
  onTimeOffChange?: (updated: TimeOffItem[]) => void;
}

function formatWibDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }) + " WIB";
}

function formatWibDateOnly(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatWibTimeOnly(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
  }) + " WIB";
}

export function TimeOffManager({
  initialTimeOff,
  onTimeOffChange,
}: TimeOffManagerProps) {
  const [timeOffList, setTimeOffList] = useState<TimeOffItem[]>(initialTimeOff);
  const [modalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form State
  const [date, setDate] = useState(() => {
    // Default tomorrow in WIB
    const now = new Date();
    now.setDate(now.getDate() + 1);
    return now.toISOString().split("T")[0];
  });
  const [isAllDay, setIsAllDay] = useState(true);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Peringatan Conflicting Bookings
  const [conflictWarning, setConflictWarning] = useState<ConflictingBooking[] | null>(null);

  // Sync if prop changes
  React.useEffect(() => {
    setTimeOffList(initialTimeOff);
  }, [initialTimeOff]);

  const handleOpenModal = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setDate(tomorrow.toISOString().split("T")[0]);
    setIsAllDay(true);
    setStartTime("09:00");
    setEndTime("17:00");
    setReason("");
    setFormError(null);
    setModalOpen(true);
  };

  const handleCreateTimeOff = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!date) {
      setFormError("Silakan pilih tanggal libur.");
      return;
    }

    let startIso: string;
    let endIso: string;

    if (isAllDay) {
      // 00:00:00 s/d 23:59:59 WIB pada tanggal tersebut
      startIso = new Date(`${date}T00:00:00+07:00`).toISOString();
      endIso = new Date(`${date}T23:59:59+07:00`).toISOString();
    } else {
      if (!startTime || !endTime) {
        setFormError("Jam mulai dan jam selesai wajib diisi.");
        return;
      }
      const startMs = new Date(`${date}T${startTime}:00+07:00`).getTime();
      const endMs = new Date(`${date}T${endTime}:00+07:00`).getTime();
      if (endMs <= startMs) {
        setFormError("Jam selesai harus lebih besar dari jam mulai.");
        return;
      }
      startIso = new Date(startMs).toISOString();
      endIso = new Date(endMs).toISOString();
    }

    setIsSubmitting(true);

    try {
      const res = await scheduleClient.createTimeOff({
        start_at: startIso,
        end_at: endIso,
        reason: reason.trim() || null,
      });

      if (res.success && res.data) {
        const newItem: TimeOffItem = {
          id: res.data.id,
          start_at: res.data.start_at,
          end_at: res.data.end_at,
          reason: res.data.reason,
          created_at: res.data.created_at,
        };

        const updated = [newItem, ...timeOffList].sort(
          (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
        );
        setTimeOffList(updated);
        onTimeOffChange?.(updated);

        notify.success("Libur Ditambahkan", "Waktu libur berhasil dicatat di jadwal Anda.");
        setModalOpen(false);

        // Jika terdapat booking yang tertimpa, tampilkan peringatan keras
        if (res.data.conflicting_bookings && res.data.conflicting_bookings.length > 0) {
          setConflictWarning(res.data.conflicting_bookings);
          notify.warning(
            "Booking Tertimpa!",
            `Terdapat ${res.data.conflicting_bookings.length} booking pasien yang tertimpa libur ini.`
          );
        } else {
          setConflictWarning(null);
        }
      }
    } catch (err: unknown) {
      if (err instanceof ScheduleApiError) {
        setFormError(err.message);
        notify.error("Gagal Menambah Libur", err.message);
      } else {
        const msg = err instanceof Error ? err.message : "Terjadi kesalahan sistem.";
        setFormError(msg);
        notify.error("Kesalahan Sistem", msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTimeOff = async (id: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus jadwal libur ini? Slot akan kembali aktif.")) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await scheduleClient.deleteTimeOff(id);
      if (res.success) {
        const updated = timeOffList.filter((item) => item.id !== id);
        setTimeOffList(updated);
        onTimeOffChange?.(updated);
        notify.success("Libur Dihapus", "Jadwal libur berhasil dihapus.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menghapus waktu libur.";
      notify.error("Gagal Menghapus", msg);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
      <CardHeader className="p-4 sm:p-6 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="font-heading text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CalendarOff size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
              Pengecualian Jadwal & Waktu Libur
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito mt-1">
              Tandai tanggal atau rentang jam tertentu saat Anda tidak dapat melayani sesi (cuti, keperluan pribadi, atau hari libur nasional).
            </CardDescription>
          </div>
          <Button
            type="button"
            onClick={handleOpenModal}
            className="self-start sm:self-auto text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl px-4 py-2 h-9 shadow-xs gap-1.5 cursor-pointer"
          >
            <Plus size={14} />
            <span>Tambah Waktu Libur</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-4">
        {/* Peringatan Conflicting Bookings */}
        {conflictWarning && conflictWarning.length > 0 && (
          <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" size={20} />
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-heading font-bold text-xs sm:text-sm text-amber-900 dark:text-amber-100">
                    Perhatian: {conflictWarning.length} Janji Temu Tertimpa Waktu Libur!
                  </h4>
                  <button
                    type="button"
                    onClick={() => setConflictWarning(null)}
                    className="text-[11px] text-amber-700 hover:text-amber-900 dark:text-amber-300 font-semibold cursor-pointer underline"
                  >
                    Tutup Peringatan
                  </button>
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-300 font-nunito">
                  Sistem <strong>tidak otomatis membatalkan</strong> janji temu yang sudah terlanjur dipesan pasien. Anda wajib membatalkannya secara manual melalui menu Janji Temu agar pasien menerima hak pengembalian koin atau pemilihan jadwal pengganti.
                </p>
                <div className="pt-2">
                  <span className="text-[11px] font-bold block mb-1">
                    Daftar booking yang terdampak ({conflictWarning.length}):
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                    {conflictWarning.map((c) => (
                      <div
                        key={c.id}
                        className="text-[11px] font-mono bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-800 shadow-2xs flex items-center gap-2"
                      >
                        <Clock size={12} className="text-amber-600" />
                        <span>{formatWibDateTime(c.start_at)}</span>
                        <span className="text-[10px] text-slate-400 font-sans">(ID: {c.id.substring(0, 8)})</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Daftar Waktu Libur */}
        {timeOffList.length === 0 ? (
          <div className="p-8 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-center">
            <CalendarOff size={28} className="mx-auto text-slate-400 dark:text-slate-500 mb-2 opacity-60" />
            <p className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
              Belum ada jadwal libur yang diatur
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
              Slot praktik Anda akan dibuka penuh sesuai pola mingguan reguler di atas.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {timeOffList.map((item) => {
              const startDate = new Date(item.start_at);
              const endDate = new Date(item.end_at);
              const isPast = endDate.getTime() < Date.now();
              const isDeleting = deletingId === item.id;

              return (
                <div
                  key={item.id}
                  className={`py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-opacity ${
                    isPast ? "opacity-50" : ""
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-heading font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                        {formatWibDateOnly(item.start_at)}
                      </span>
                      {isPast ? (
                        <Badge variant="outline" className="text-[10px] py-0 px-2 text-slate-400 border-slate-300">
                          Sudah Lewat
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[10px] py-0 px-2 bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 font-mono"
                        >
                          {formatWibTimeOnly(item.start_at)} - {formatWibTimeOnly(item.end_at)}
                        </Badge>
                      )}
                    </div>
                    {item.reason && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 font-nunito">
                        Alasan: <span className="italic font-medium">"{item.reason}"</span>
                      </p>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isDeleting}
                    onClick={() => handleDeleteTimeOff(item.id)}
                    className="self-end sm:self-auto h-8 px-2.5 text-xs text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <Loader2 size={13} className="animate-spin text-rose-600" />
                    ) : (
                      <Trash2 size={13} />
                    )}
                    <span>Hapus</span>
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Modal Dialog Tambah Libur */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 font-nunito bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl">
          <div className="p-5 pb-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center">
                <CalendarOff size={16} />
              </div>
              <DialogTitle className="text-base font-bold font-heading text-slate-900 dark:text-white">
                Tambah Waktu Libur Praktik
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 pl-0.5">
              Slot pada jam yang dipilih akan disembunyikan dari jadwal pasien.
            </DialogDescription>
          </div>

          <form onSubmit={handleCreateTimeOff} className="p-5 space-y-4">
            {formError && (
              <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Tanggal */}
            <div className="space-y-1.5">
              <Label htmlFor="timeOffDate" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Tanggal Libur (WIB)
              </Label>
              <Input
                id="timeOffDate"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-9 text-xs bg-slate-50/50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 rounded-xl"
                required
              />
            </div>

            {/* Toggle Seharian */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
              <div className="space-y-0.5">
                <Label htmlFor="allDaySwitch" className="text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                  Libur Seharian Penuh
                </Label>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Nonaktifkan seluruh slot 24 jam pada tanggal ini
                </p>
              </div>
              <Switch
                id="allDaySwitch"
                checked={isAllDay}
                onCheckedChange={setIsAllDay}
              />
            </div>

            {/* Rentang Jam jika bukan seharian */}
            {!isAllDay && (
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 animate-in fade-in">
                <div className="space-y-1">
                  <Label htmlFor="startTime" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Jam Mulai (WIB)
                  </Label>
                  <Input
                    id="startTime"
                    type="time"
                    step={3600}
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="h-8 text-xs font-mono bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-lg"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="endTime" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Jam Selesai (WIB)
                  </Label>
                  <Input
                    id="endTime"
                    type="time"
                    step={3600}
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="h-8 text-xs font-mono bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-lg"
                    required
                  />
                </div>
              </div>
            )}

            {/* Alasan Libur */}
            <div className="space-y-1.5">
              <Label htmlFor="timeOffReason" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Alasan / Catatan Internal (Opsional)
              </Label>
              <Input
                id="timeOffReason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                placeholder="Contoh: Keperluan keluarga, cuti, webinar ilmiah"
                className="h-9 text-xs bg-slate-50/50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setModalOpen(false)}
                className="text-xs text-slate-600 dark:text-slate-400 h-9 px-4 rounded-xl cursor-pointer"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="text-xs bg-amber-600 hover:bg-amber-700 text-white h-9 px-5 rounded-xl font-bold cursor-pointer shadow-xs gap-1.5 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Plus size={14} />
                    <span>Simpan Libur</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
