"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Calendar, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WeeklyPatternEditor } from "@/components/views/counselor/schedule/weekly-pattern-editor";
import { TimeOffManager } from "@/components/views/counselor/schedule/time-off-manager";
import { ScheduleStatusBanner } from "@/components/views/counselor/schedule/schedule-status-banner";
import {
  scheduleClient,
  type CounselorScheduleData,
  type ScheduleWeeklyItem,
  type TimeOffItem,
} from "@/services/schedule.client";
import { PageHeader } from "@/components/shared/molecules/page-header";
import { PageShell } from "@/components/shared/templates/page-shell";
import { LoadingState } from "@/components/shared/atoms/loading-state";

export default function CounselorSchedulePage() {
  const [data, setData] = useState<CounselorScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadSchedule = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const res = await scheduleClient.getSchedule();
      if (res.success && res.data) {
        setData(res.data);
      }
    } catch (err: unknown) {
      console.error("Gagal memuat jadwal psikolog:", err);
      setFetchError(err instanceof Error ? err.message : "Gagal memuat jadwal praktik");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  const handleWeeklySaved = (updatedWeekly: ScheduleWeeklyItem[]) => {
    if (data) {
      setData({ ...data, weekly: updatedWeekly });
    }
  };

  const handleTimeOffChanged = (updatedTimeOff: TimeOffItem[]) => {
    if (data) {
      setData({ ...data, time_off: updatedTimeOff });
    }
  };

  const handleBookingPausedChange = (paused: boolean) => {
    if (data) {
      setData({ ...data, booking_paused: paused });
    }
  };

  return (
    <PageShell>
      {/* 1. Header Halaman */}
      <PageHeader
        icon={<Calendar className="text-teal-600 dark:text-teal-400" size={28} />}
        title="Jadwal Praktik & Ketersediaan Sesi"
        description="Kelola pola jadwal mingguan, waktu libur pengecualian, dan status penerimaan booking sesi konseling"
      />

      {/* 2. Loading State */}
      {loading && (
        <LoadingState label="Memuat data jadwal praktik..." className="p-12 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900" />
      )}

      {/* 3. Error State */}
      {!loading && fetchError && (
        <div className="p-6 rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/30 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-rose-600 shrink-0" size={24} />
            <div>
              <p className="font-heading font-bold text-sm text-rose-900 dark:text-rose-200">
                Gagal Memuat Jadwal Praktik
              </p>
              <p className="text-xs text-rose-700 dark:text-rose-400">{fetchError}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadSchedule}
            className="rounded-xl border-rose-200 hover:bg-rose-100 dark:border-rose-800 gap-1.5 shrink-0"
          >
            <RefreshCw size={13} />
            <span>Coba Lagi</span>
          </Button>
        </div>
      )}

      {/* 4. Konten Utama Jadwal */}
      {!loading && data && (
        <div className="space-y-6">
          {/* Poin 3: Banner Suspensi & Toggle Jeda Terima Booking */}
          <ScheduleStatusBanner
            bookingPaused={data.booking_paused}
            suspendedUntil={data.suspended_until}
            onBookingPausedChange={handleBookingPausedChange}
          />

          {/* Poin 1: Editor Pola Mingguan */}
          <WeeklyPatternEditor
            initialWeekly={data.weekly}
            onSaveSuccess={handleWeeklySaved}
          />

          {/* Poin 2: Waktu Libur / Time Off */}
          <TimeOffManager
            initialTimeOff={data.time_off}
            onTimeOffChange={handleTimeOffChanged}
          />
        </div>
      )}
    </PageShell>
  );
}
