"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  Clock,
  Plus,
  Trash2,
  Save,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { notify } from "@/lib/toast";
import {
  scheduleClient,
  ScheduleApiError,
  type ScheduleWeeklyItem,
} from "@/services/schedule.client";

export const WEEKDAYS = [
  { weekday: 1, name: "Senin" },
  { weekday: 2, name: "Selasa" },
  { weekday: 3, name: "Rabu" },
  { weekday: 4, name: "Kamis" },
  { weekday: 5, name: "Jumat" },
  { weekday: 6, name: "Sabtu" },
  { weekday: 0, name: "Minggu" },
] as const;

interface LocalSlot {
  id: string;
  start_hour: number;
  end_hour: number;
}

type WeeklyByDay = Record<number, LocalSlot[]>;

function generateLocalId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, "0")}:00`;
}

interface WeeklyPatternEditorProps {
  initialWeekly: ScheduleWeeklyItem[];
  onSaveSuccess?: (weekly: ScheduleWeeklyItem[]) => void;
}

export function WeeklyPatternEditor({
  initialWeekly,
  onSaveSuccess,
}: WeeklyPatternEditorProps) {
  const [weeklyByDay, setWeeklyByDay] = useState<WeeklyByDay>(() => {
    const map: WeeklyByDay = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    for (const item of initialWeekly) {
      if (map[item.weekday]) {
        map[item.weekday].push({
          id: item.id || generateLocalId(),
          start_hour: item.start_hour,
          end_hour: item.end_hour,
        });
      }
    }
    // Sort initial slots by start_hour
    for (const day of Object.keys(map)) {
      map[Number(day)].sort((a, b) => a.start_hour - b.start_hour);
    }
    return map;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync state if initialWeekly prop changes
  useEffect(() => {
    const map: WeeklyByDay = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    for (const item of initialWeekly) {
      if (map[item.weekday]) {
        map[item.weekday].push({
          id: item.id || generateLocalId(),
          start_hour: item.start_hour,
          end_hour: item.end_hour,
        });
      }
    }
    for (const day of Object.keys(map)) {
      map[Number(day)].sort((a, b) => a.start_hour - b.start_hour);
    }
    setWeeklyByDay(map);
  }, [initialWeekly]);

  // Validasi lokal per hari
  const dayValidationErrors = useMemo(() => {
    const errors: Record<number, string> = {};

    for (const { weekday, name } of WEEKDAYS) {
      const slots = weeklyByDay[weekday] || [];
      if (slots.length > 10) {
        errors[weekday] = `Maksimal 10 rentang jam per hari pada hari ${name}.`;
        continue;
      }

      // Cek start < end
      for (const slot of slots) {
        if (slot.start_hour >= slot.end_hour) {
          errors[weekday] = `Jam selesai harus lebih besar dari jam mulai (${formatHour(slot.start_hour)} - ${formatHour(slot.end_hour)}).`;
          break;
        }
      }
      if (errors[weekday]) continue;

      // Cek overlap
      const sorted = [...slots].sort((a, b) => a.start_hour - b.start_hour);
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].end_hour > sorted[i + 1].start_hour) {
          errors[weekday] = `Terdapat rentang yang tumpang tindih: ${formatHour(sorted[i].start_hour)}–${formatHour(sorted[i].end_hour)} beririsan dengan ${formatHour(sorted[i + 1].start_hour)}–${formatHour(sorted[i + 1].end_hour)}.`;
          break;
        }
      }
    }

    return errors;
  }, [weeklyByDay]);

  const hasLocalErrors = Object.keys(dayValidationErrors).length > 0;

  // Hitung total jam praktik mingguan
  const totalWeeklyHours = useMemo(() => {
    let total = 0;
    for (const slots of Object.values(weeklyByDay)) {
      for (const slot of slots) {
        if (slot.end_hour > slot.start_hour) {
          total += slot.end_hour - slot.start_hour;
        }
      }
    }
    return total;
  }, [weeklyByDay]);

  const handleAddRange = (weekday: number) => {
    setWeeklyByDay((prev) => {
      const current = prev[weekday] || [];
      if (current.length >= 10) {
        notify.error("Batas Maksimal", "Maksimal 10 rentang jam per hari.");
        return prev;
      }

      // Cari waktu awal default yang tidak bentrok
      let defaultStart = 9;
      let defaultEnd = 12;

      if (current.length > 0) {
        const lastSlot = [...current].sort((a, b) => b.end_hour - a.end_hour)[0];
        if (lastSlot.end_hour < 23) {
          defaultStart = Math.min(23, lastSlot.end_hour);
          defaultEnd = Math.min(24, defaultStart + 2);
        } else {
          defaultStart = 19;
          defaultEnd = 21;
        }
      }

      return {
        ...prev,
        [weekday]: [
          ...current,
          {
            id: generateLocalId(),
            start_hour: defaultStart,
            end_hour: defaultEnd,
          },
        ].sort((a, b) => a.start_hour - b.start_hour),
      };
    });
    setServerError(null);
  };

  const handleUpdateSlot = (
    weekday: number,
    id: string,
    field: "start_hour" | "end_hour",
    value: number
  ) => {
    setWeeklyByDay((prev) => {
      const current = prev[weekday] || [];
      return {
        ...prev,
        [weekday]: current.map((slot) => {
          if (slot.id !== id) return slot;
          return { ...slot, [field]: value };
        }),
      };
    });
    setServerError(null);
  };

  const handleDeleteSlot = (weekday: number, id: string) => {
    setWeeklyByDay((prev) => ({
      ...prev,
      [weekday]: (prev[weekday] || []).filter((s) => s.id !== id),
    }));
    setServerError(null);
  };

  const handleClearDay = (weekday: number) => {
    setWeeklyByDay((prev) => ({
      ...prev,
      [weekday]: [],
    }));
    setServerError(null);
  };

  const handleReset = () => {
    const map: WeeklyByDay = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    for (const item of initialWeekly) {
      if (map[item.weekday]) {
        map[item.weekday].push({
          id: item.id || generateLocalId(),
          start_hour: item.start_hour,
          end_hour: item.end_hour,
        });
      }
    }
    for (const day of Object.keys(map)) {
      map[Number(day)].sort((a, b) => a.start_hour - b.start_hour);
    }
    setWeeklyByDay(map);
    setServerError(null);
  };

  const handleSave = async () => {
    if (hasLocalErrors) {
      const firstError = Object.values(dayValidationErrors)[0];
      setServerError(firstError);
      notify.error("Validasi Gagal", firstError);
      return;
    }

    setIsSubmitting(true);
    setServerError(null);

    // Flatten payload
    const weeklyPayload: { weekday: number; start_hour: number; end_hour: number }[] = [];
    for (const { weekday } of WEEKDAYS) {
      const slots = weeklyByDay[weekday] || [];
      for (const slot of slots) {
        weeklyPayload.push({
          weekday,
          start_hour: slot.start_hour,
          end_hour: slot.end_hour,
        });
      }
    }

    try {
      const res = await scheduleClient.updateSchedule(weeklyPayload);
      if (res.success) {
        notify.success("Jadwal Tersimpan", res.message || "Pola jadwal mingguan berhasil diperbarui.");
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        if (onSaveSuccess && res.data?.weekly) {
          onSaveSuccess(res.data.weekly);
        }
      }
    } catch (err: unknown) {
      if (err instanceof ScheduleApiError) {
        // Tampilkan error 422 dari server secara detail
        let detailedMsg = err.message;
        if (err.status === 422 && err.details && typeof err.details === "object") {
          const detailObj = err.details as Record<string, string[]>;
          const messages: string[] = [];
          for (const msgs of Object.values(detailObj)) {
            if (Array.isArray(msgs)) messages.push(...msgs);
          }
          if (messages.length > 0) {
            detailedMsg = messages.join(". ");
          }
        }
        setServerError(detailedMsg);
        notify.error("Validasi Server Gagal", detailedMsg);
      } else {
        const fallbackMsg = err instanceof Error ? err.message : "Gagal memperbarui pola jadwal.";
        setServerError(fallbackMsg);
        notify.error("Kesalahan Sistem", fallbackMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
      <CardHeader className="p-4 sm:p-6 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="font-heading text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CalendarDays size={18} className="text-teal-600 dark:text-teal-400 shrink-0" />
              Pola Jadwal Praktik Mingguan
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito mt-1">
              Atur hari dan rentang jam praktik reguler Anda (WIB). Sistem otomatis memecah setiap rentang menjadi slot konsultasi 60 menit.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Badge
              variant="outline"
              className="text-xs font-semibold px-2.5 py-1 bg-teal-50 dark:bg-teal-950/70 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800"
            >
              <Clock size={12} className="mr-1 inline" />
              Total: {totalWeeklyHours} Jam ({totalWeeklyHours} Slot / Minggu)
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-5">
        {serverError && (
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs">
            <AlertTriangle size={16} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">Gagal Menyimpan Jadwal (Validasi Server):</p>
              <p className="mt-0.5">{serverError}</p>
            </div>
          </div>
        )}

        {saveSuccess && (
          <div className="flex items-center gap-2 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold animate-in fade-in">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>Pola jadwal mingguan berhasil diperbarui.</span>
          </div>
        )}

        {/* Daftar 7 Hari */}
        <div className="space-y-3">
          {WEEKDAYS.map(({ weekday, name }) => {
            const slots = weeklyByDay[weekday] || [];
            const dayError = dayValidationErrors[weekday];
            const dayHours = slots.reduce((acc, s) => acc + (s.end_hour > s.start_hour ? s.end_hour - s.start_hour : 0), 0);

            return (
              <div
                key={weekday}
                className={`p-3.5 sm:p-4 rounded-xl border transition-all ${
                  dayError
                    ? "border-rose-300 dark:border-rose-800 bg-rose-50/30 dark:bg-rose-950/20"
                    : slots.length > 0
                    ? "border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40"
                    : "border-slate-200/60 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/40 opacity-80"
                }`}
              >
                {/* Header Bar Hari */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="font-heading font-bold text-sm text-slate-900 dark:text-white w-16 sm:w-20">
                      {name}
                    </span>
                    {slots.length === 0 ? (
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 font-nunito italic">
                        Libur Rutin (Tidak Ada Sesi)
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-md border border-teal-200 dark:border-teal-800 font-mono">
                        {dayHours} Jam ({slots.length} Rentang)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {slots.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleClearDay(weekday)}
                        className="text-[11px] text-slate-400 hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400 px-2 py-1 rounded transition-colors cursor-pointer"
                        title="Kosongkan hari ini"
                      >
                        Liburkan
                      </button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddRange(weekday)}
                      disabled={slots.length >= 10}
                      className="h-7 text-xs px-2.5 rounded-lg border-slate-200 dark:border-slate-700 hover:bg-teal-50 hover:text-teal-700 dark:hover:bg-teal-950/60 dark:hover:text-teal-300 gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Plus size={13} />
                      <span>Tambah Jam</span>
                    </Button>
                  </div>
                </div>

                {/* Inline Error Hari */}
                {dayError && (
                  <div className="mb-3 text-[11px] text-rose-600 dark:text-rose-400 font-semibold bg-rose-50 dark:bg-rose-950/70 p-2 rounded-lg border border-rose-200 dark:border-rose-900 flex items-center gap-1.5">
                    <AlertTriangle size={13} className="shrink-0" />
                    <span>{dayError}</span>
                  </div>
                )}

                {/* List Rentang Jam */}
                {slots.length > 0 && (
                  <div className="space-y-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                    {slots.map((slot, index) => {
                      const isRangeInvalid = slot.start_hour >= slot.end_hour;
                      const duration = slot.end_hour - slot.start_hour;

                      return (
                        <div
                          key={slot.id}
                          className="flex flex-wrap items-center gap-2 sm:gap-3 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                        >
                          <span className="text-[11px] text-slate-400 font-mono w-5 text-center">
                            #{index + 1}
                          </span>

                          {/* Jam Mulai */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                              Mulai:
                            </span>
                            <select
                              value={slot.start_hour}
                              onChange={(e) =>
                                handleUpdateSlot(weekday, slot.id, "start_hour", parseInt(e.target.value, 10))
                              }
                              className="h-8 text-xs font-mono font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
                            >
                              {Array.from({ length: 24 }).map((_, h) => (
                                <option key={h} value={h}>
                                  {formatHour(h)} WIB
                                </option>
                              ))}
                            </select>
                          </div>

                          <span className="text-xs text-slate-400 font-semibold">s/d</span>

                          {/* Jam Selesai */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                              Selesai:
                            </span>
                            <select
                              value={slot.end_hour}
                              onChange={(e) =>
                                handleUpdateSlot(weekday, slot.id, "end_hour", parseInt(e.target.value, 10))
                              }
                              className={`h-8 text-xs font-mono font-semibold rounded-lg border px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer ${
                                isRangeInvalid
                                  ? "border-rose-400 bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                                  : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                              }`}
                            >
                              {Array.from({ length: 24 }).map((_, idx) => {
                                const h = idx + 1;
                                return (
                                  <option key={h} value={h}>
                                    {formatHour(h)} WIB
                                  </option>
                                );
                              })}
                            </select>
                          </div>

                          {/* Badge Durasi / Slot */}
                          <div className="ml-auto flex items-center gap-2">
                            {isRangeInvalid ? (
                              <span className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
                                Jam tidak valid
                              </span>
                            ) : (
                              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 hidden sm:inline">
                                ({duration} jam = {duration} slot)
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDeleteSlot(weekday, slot.id)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                              title="Hapus rentang jam ini"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={isSubmitting}
            className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 h-9 px-3 rounded-xl gap-1.5 cursor-pointer"
          >
            <RotateCcw size={14} />
            <span>Reset Perubahan</span>
          </Button>

          <Button
            type="button"
            onClick={handleSave}
            disabled={isSubmitting || hasLocalErrors}
            className="w-full sm:w-auto text-xs sm:text-sm bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl px-6 py-2.5 h-10 shadow-xs gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Menyimpan Jadwal...</span>
              </>
            ) : (
              <>
                <Save size={15} />
                <span>Simpan Pola Jadwal</span>
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
