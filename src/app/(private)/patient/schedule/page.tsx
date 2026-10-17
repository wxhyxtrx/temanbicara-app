"use client";

import React, { useState, useMemo, useEffect, useCallback, Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar as CalendarIcon,
  PlusCircle,
  Search,
  Clock,
  CalendarCheck,
  RefreshCw,
  History,
  Sparkles,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { BookingModal } from "@/components/views/schedule/booking-modal";
import { BookingCard } from "@/components/views/schedule/booking-card";
import { PatientBookingDetailModal } from "@/components/views/schedule/patient-booking-detail-modal";
import { notify } from "@/lib/toast";
import { bookingClient } from "@/services/booking.client";
import type { PatientBookingView, BookingStatus } from "@/types/booking";

type ScheduleTab = "upcoming" | "history";

function PatientScheduleContent() {
  const searchParams = useSearchParams();

  // Active Tab
  const [activeTab, setActiveTab] = useState<ScheduleTab>("upcoming");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Booking Data per Scope
  const [upcomingList, setUpcomingList] = useState<PatientBookingView[]>([]);
  const [historyList, setHistoryList] = useState<PatientBookingView[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modals
  const [isBookingOpen, setIsBookingOpen] = useState<boolean>(false);
  const [selectedBooking, setSelectedBooking] = useState<PatientBookingView | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);

  // Fetch bookings from API
  const loadBookings = useCallback(async (scope: ScheduleTab) => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await bookingClient.getBookings({ scope, limit: 50 });
      if (res?.success && Array.isArray(res.data)) {
        if (scope === "upcoming") {
          setUpcomingList(res.data as PatientBookingView[]);
        } else {
          setHistoryList(res.data as PatientBookingView[]);
        }
      }
    } catch (err: unknown) {
      console.error(`Gagal memuat booking scope ${scope}:`, err);
      setLoadError("Gagal memuat jadwal sesi dari server. Silakan coba beberapa saat lagi.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadBookings("upcoming");
    loadBookings("history");
    if (searchParams.get("booking") === "true") {
      setIsBookingOpen(true);
    }
  }, [searchParams, loadBookings]);

  // Current scope active list
  const currentList = activeTab === "upcoming" ? upcomingList : historyList;

  // Filtered List
  const filteredList = useMemo(() => {
    return currentList.filter((b) => {
      const matchStatus = statusFilter === "all" || b.status === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchStatus;

      const psychName = (b.psikolog?.nama_lengkap_gelar || "").toLowerCase();
      const spec = (b.psikolog?.spesialisasi || []).join(" ").toLowerCase();
      const keluhan = (b.keluhan || "").toLowerCase();

      return matchStatus && (psychName.includes(q) || spec.includes(q) || keluhan.includes(q));
    });
  }, [currentList, statusFilter, searchQuery]);

  // Sub-filter status options based on tab
  const filterTabs = useMemo(() => {
    if (activeTab === "upcoming") {
      return [
        { key: "all", label: "Semua Mendatang", count: upcomingList.length },
        {
          key: "booked",
          label: "Terkonfirmasi",
          count: upcomingList.filter((b) => b.status === "booked").length,
        },
        {
          key: "in_progress",
          label: "Sesi Aktif",
          count: upcomingList.filter((b) => b.status === "in_progress").length,
        },
        {
          key: "awaiting_patient_choice",
          label: "Pilihan Pasien",
          count: upcomingList.filter((b) => b.status === "awaiting_patient_choice").length,
        },
      ];
    } else {
      return [
        { key: "all", label: "Semua Riwayat", count: historyList.length },
        {
          key: "completed",
          label: "Selesai",
          count: historyList.filter((b) => b.status === "completed").length,
        },
        {
          key: "cancelled_by_patient",
          label: "Batal Pasien",
          count: historyList.filter((b) => b.status === "cancelled_by_patient").length,
        },
        {
          key: "cancelled_by_psikolog",
          label: "Batal Psikolog",
          count: historyList.filter((b) => b.status === "cancelled_by_psikolog").length,
        },
        {
          key: "auto_cancelled_late",
          label: "Batal Otomatis",
          count: historyList.filter((b) => b.status === "auto_cancelled_late").length,
        },
        {
          key: "no_show",
          label: "Tidak Hadir",
          count: historyList.filter((b) => b.status === "no_show").length,
        },
      ];
    }
  }, [activeTab, upcomingList, historyList]);

  // Switch tab handler
  const handleTabChange = (tab: ScheduleTab) => {
    setActiveTab(tab);
    setStatusFilter("all");
    loadBookings(tab);
  };

  const handleOpenDetail = (booking: PatientBookingView) => {
    setSelectedBooking(booking);
    setIsDetailOpen(true);
  };

  return (
    <div className="flex flex-col gap-6 font-nunito pb-12 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* 1. Page Header */}
      <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 dark:text-white tracking-tight">
            Jadwal Konseling Saya
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Kelola sesi konseling aktif, janji temu mendatang, dan riwayat konsultasi privat Anda
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            className="text-xs border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl px-3.5 py-2 h-9 font-semibold gap-1.5"
            onClick={() =>
              notify.success(
                "Sinkronisasi Kalender Berhasil",
                "Jadwal sesi Anda telah disinkronkan ke kalender perangkat Anda."
              )
            }
          >
            <CalendarCheck size={15} className="text-teal-600 dark:text-teal-400" />
            <span>Sinkronkan Kalender</span>
          </Button>

          <Button
            onClick={() => setIsBookingOpen(true)}
            className="text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-xl px-4 py-2 h-9 font-semibold shadow-xs gap-1.5"
          >
            <PlusCircle size={15} />
            <span>Jadwalkan Konsultasi Baru</span>
          </Button>
        </div>
      </div>

      {/* 2. Main Card Container with Tabs */}
      <Card className="w-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs rounded-2xl overflow-hidden">
        {/* Card Header & Controls */}
        <CardHeader className="p-4 sm:p-6 pb-4 border-b border-slate-100 dark:border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Primary Tab Switcher: Mendatang vs Riwayat */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 w-fit">
              <button
                type="button"
                onClick={() => handleTabChange("upcoming")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "upcoming"
                    ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <CalendarIcon size={14} />
                <span>Mendatang</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    activeTab === "upcoming"
                      ? "bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {upcomingList.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleTabChange("history")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "history"
                    ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <History size={14} />
                <span>Riwayat Sesi</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    activeTab === "history"
                      ? "bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {historyList.length}
                </span>
              </button>
            </div>

            {/* Refresh and Search Input */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"
                  size={14}
                />
                <Input
                  placeholder="Cari psikolog / keluhan..."
                  className="pl-9 h-9 text-xs bg-slate-50/60 dark:bg-slate-800/60 border-slate-200/90 dark:border-slate-700 rounded-xl focus-visible:ring-teal-600"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => loadBookings(activeTab)}
                disabled={loading}
                className="h-9 px-2.5 rounded-xl border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                title="Segarkan data jadwal"
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              </Button>
            </div>
          </div>

          {/* Sub-status Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {filterTabs.map((tab) => {
              const isActive = statusFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? "bg-teal-600 text-white shadow-2xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700"
                  }`}
                >
                  {tab.label} <span className="opacity-80 text-[11px]">({tab.count})</span>
                </button>
              );
            })}
          </div>
        </CardHeader>

        {/* Card Content: List of Bookings */}
        <CardContent className="p-4 sm:p-6">
          {loading ? (
            <div className="space-y-3.5">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="p-5 rounded-2xl border border-slate-100 dark:border-slate-800 animate-pulse space-y-3"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-800" />
                      <div className="space-y-2">
                        <Skeleton className="w-44 h-4 bg-slate-200 dark:bg-slate-800 rounded" />
                        <Skeleton className="w-28 h-3 bg-slate-200 dark:bg-slate-800 rounded" />
                      </div>
                    </div>
                    <Skeleton className="w-24 h-6 rounded-full bg-slate-200 dark:bg-slate-800" />
                  </div>
                  <Skeleton className="w-full h-12 rounded-xl bg-slate-200 dark:bg-slate-800" />
                </div>
              ))}
            </div>
          ) : loadError ? (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs flex items-center justify-between">
              <span>{loadError}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => loadBookings(activeTab)}
                className="h-7 text-xs"
              >
                Coba Lagi
              </Button>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center gap-2.5">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-100 dark:border-teal-900 flex items-center justify-center text-teal-600 dark:text-teal-400">
                {activeTab === "upcoming" ? <CalendarIcon size={24} /> : <History size={24} />}
              </div>
              <div className="space-y-1">
                <p className="font-heading font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                  {activeTab === "upcoming"
                    ? "Belum Ada Sesi Konseling Mendatang"
                    : "Belum Ada Riwayat Sesi Konseling"}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md font-nunito">
                  {activeTab === "upcoming"
                    ? "Pilih psikolog klinis berlisensi dan reservasi slot waktu untuk memulai pendampingan mental pribadimu."
                    : "Sesi konseling yang telah selesai atau dibatalkan akan tercatat rapi di halaman riwayat ini."}
                </p>
              </div>

              {activeTab === "upcoming" && (
                <Button
                  size="sm"
                  onClick={() => setIsBookingOpen(true)}
                  className="mt-2 bg-teal-600 hover:bg-teal-700 text-white text-xs rounded-xl h-8 px-4 font-semibold shadow-xs gap-1.5"
                >
                  <PlusCircle size={14} />
                  <span>Pesan Sesi Sekarang</span>
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredList.map((b) => (
                <BookingCard
                  key={b.id}
                  booking={b}
                  onViewDetail={handleOpenDetail}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. New Booking Modal */}
      <BookingModal
        isOpen={isBookingOpen}
        onClose={() => {
          setIsBookingOpen(false);
          loadBookings("upcoming");
        }}
        onSuccess={() => {
          loadBookings("upcoming");
        }}
      />

      {/* 4. Booking Detail Modal */}
      <PatientBookingDetailModal
        booking={selectedBooking}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
      />
    </div>
  );
}

export default function PatientSchedulePage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-muted-foreground">
          Memuat jadwal konseling...
        </div>
      }
    >
      <PatientScheduleContent />
    </Suspense>
  );
}
