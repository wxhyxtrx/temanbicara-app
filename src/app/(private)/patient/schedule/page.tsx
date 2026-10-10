"use client";

import React, { useState, useMemo, useEffect, Suspense } from "react";
import TableInfo from "@/components/shared/atoms/Table/TableInfo";
import TablePagination from "@/components/shared/atoms/Table/TablePagination";
import Tables from "@/components/shared/atoms/Table/Tables";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Calendar as CalendarIcon,
  PlusCircle,
  Search,
  MessageSquare,
  Phone,
  Clock,
  CalendarCheck,
  Eye,
  Star,
} from "lucide-react";
import { MdVerified } from "react-icons/md";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ScheduleItem, useScheduleStore } from "@/store/schedule-store";
import { useReviewStore } from "@/store/review-store";
import { BookingModal } from "@/components/views/schedule/booking-modal";
import { SessionDetailModal } from "@/components/views/schedule/session-detail-modal";
import { notify } from "@/lib/toast";

function PatientScheduleContent() {
  const searchParams = useSearchParams();
  const rawSchedules = useScheduleStore((state) => state.schedules);
  const hasReviewed = useReviewStore((state) => state.hasReviewed);

  const [mounted, setMounted] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(5);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal states
  const [isBookingOpen, setIsBookingOpen] = useState<boolean>(false);
  const [selectedSession, setSelectedSession] = useState<ScheduleItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    if (searchParams.get("booking") === "true") {
      setIsBookingOpen(true);
    }
  }, [searchParams]);

  const scheduleList = mounted ? rawSchedules : [];

  // Filter Data
  const filteredData = useMemo(() => {
    return scheduleList.filter((item) => {
      const matchStatus = statusFilter === "all" || item.status === statusFilter;
      const q = searchQuery.toLowerCase();
      const matchQuery =
        !q ||
        item.consultant.toLowerCase().includes(q) ||
        item.topic.toLowerCase().includes(q) ||
        item.date.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q);
      return matchStatus && matchQuery;
    });
  }, [scheduleList, statusFilter, searchQuery]);

  // Status Counts
  const counts = {
    all: scheduleList.length,
    terjadwal: scheduleList.filter((i) => i.status === "terjadwal").length,
    menunggu: scheduleList.filter((i) => i.status === "menunggu").length,
    selesai: scheduleList.filter((i) => i.status === "selesai").length,
    dibatalkan: scheduleList.filter((i) => i.status === "dibatalkan").length,
  };

  const openSessionDetail = (item: ScheduleItem) => {
    setSelectedSession(item);
    setIsDetailOpen(true);
  };

  // Helper render status badge
  const renderStatusBadge = (status: ScheduleItem["status"]) => {
    if (status === "terjadwal") {
      return (
        <Badge className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-xs font-semibold py-0.5 px-2.5">
          Terkonfirmasi
        </Badge>
      );
    } else if (status === "menunggu") {
      return (
        <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800 text-xs font-semibold py-0.5 px-2.5">
          Menunggu Konfirmasi
        </Badge>
      );
    } else if (status === "dibatalkan") {
      return (
        <Badge variant="outline" className="bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-900 text-xs font-semibold py-0.5 px-2.5">
          Dibatalkan
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 text-xs font-semibold py-0.5 px-2.5">
          Selesai
        </Badge>
      );
    }
  };

  // Definisi kolom tabel desktop
  const columns = [
    {
      label: "Psikolog & Sesi",
      className: "w-[36%]",
      renderCell: (row: ScheduleItem) => (
        <div
          className="flex items-start gap-3 cursor-pointer group"
          onClick={() => openSessionDetail(row)}
        >
          <div className="w-10 h-10 rounded-full bg-teal-50 dark:bg-teal-950 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 font-bold text-xs flex items-center justify-center shrink-0 font-heading mt-0.5 group-hover:scale-105 transition-transform">
            {row.initials}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-bold text-slate-900 dark:text-white text-sm font-heading group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors">
                {row.consultant}
              </p>
              {row.initials !== "TB" && <MdVerified className="text-sky-500 text-xs shrink-0" />}
            </div>
            <p className="text-xs text-teal-700 dark:text-teal-400 font-medium">{row.title}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{row.topic}</p>
          </div>
        </div>
      ),
    },
    {
      label: "Jadwal & Metode",
      className: "w-[28%]",
      renderCell: (row: ScheduleItem) => (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 font-medium text-xs text-slate-800 dark:text-slate-200">
            <CalendarIcon size={13} className="text-teal-600 dark:text-teal-400 shrink-0" />
            <span>{row.date}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-nunito">
            <span className="flex items-center gap-1">
              <Clock size={12} className="text-teal-600 dark:text-teal-400 shrink-0" />
              {row.time}
            </span>
            <span className="text-[10px] font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950 border border-teal-200/80 dark:border-teal-800 px-2 py-0.5 rounded-md">
              {row.type}
            </span>
          </div>
        </div>
      ),
    },
    {
      label: "Status",
      className: "w-[16%]",
      renderCell: (row: ScheduleItem) => renderStatusBadge(row.status),
    },
    {
      label: "Aksi",
      className: "w-[20%]",
      renderCell: (row: ScheduleItem) => (
        <div className="flex items-center gap-2 justify-end">
          {row.status === "terjadwal" ? (
            <>
              <Link href="/patient/room">
                <Button
                  size="sm"
                  className="text-xs bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg px-2.5 py-1.5 h-8 cursor-pointer shadow-xs gap-1"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                  Masuk Sesi
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openSessionDetail(row)}
                className="text-xs border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg px-2 py-1.5 h-8 font-semibold cursor-pointer"
                title="Lihat Detail Janji"
              >
                <Eye size={13} />
              </Button>
            </>
          ) : row.status === "selesai" ? (
            <div className="flex items-center gap-1.5 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => openSessionDetail(row)}
                className="text-xs border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg px-2.5 py-1.5 h-8 font-semibold cursor-pointer"
              >
                Catatan Sesi
              </Button>
              {hasReviewed(row.id) ? (
                <span
                  className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800 flex items-center justify-center shrink-0"
                  title="Ulasan Anda Telah Dikirimkan"
                >
                  <Star size={13} className="fill-amber-500 text-amber-500" />
                </span>
              ) : (
                <Button
                  size="sm"
                  onClick={() => openSessionDetail(row)}
                  className="text-xs bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg px-2.5 py-1.5 h-8 cursor-pointer shadow-2xs gap-1"
                >
                  <Star size={12} className="fill-white" />
                  <span>Ulas</span>
                </Button>
              )}
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => openSessionDetail(row)}
              className="text-xs border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg px-3 py-1.5 h-8 font-semibold cursor-pointer"
            >
              Detail Janji
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6 font-nunito pb-10 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* 1. Page Header */}
      <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 dark:text-white tracking-tight">
            Jadwal Konseling Saya
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Kelola sesi konsultasi privat aktif, janji temu mendatang, dan catatan pemulihanmu
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            className="text-xs border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl px-3.5 py-2 h-9 font-semibold gap-1.5 cursor-pointer"
            onClick={() => notify.success("Sinkronisasi Kalender Berhasil", "Jadwal Anda berhasil disinkronkan dengan Google Calendar & Apple Calendar.")}
          >
            <CalendarCheck size={15} className="text-teal-600 dark:text-teal-400" />
            Sinkronkan Kalender
          </Button>

          <Button
            onClick={() => setIsBookingOpen(true)}
            className="text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-xl px-4 py-2 h-9 font-semibold shadow-xs gap-1.5 cursor-pointer"
          >
            <PlusCircle size={15} />
            Jadwalkan Konsultasi Baru
          </Button>
        </div>
      </div>

      {/* 2. Main Card Container */}
      <Card className="h-full w-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs rounded-2xl overflow-hidden">
        <CardHeader className="p-4 sm:p-6 pb-4 border-b border-slate-100 dark:border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base sm:text-lg font-bold font-heading text-slate-900 dark:text-white">
                Daftar Janji Temu Konseling
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
                Menampilkan total {filteredData.length} jadwal sesi konsultasi
              </CardDescription>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={15} />
              <Input
                placeholder="Cari psikolog / topik..."
                className="pl-9 h-9 text-xs bg-slate-50/60 dark:bg-slate-800/60 dark:text-slate-100 border-slate-200/90 dark:border-slate-700 rounded-xl focus-visible:ring-teal-600"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {[
              { key: "all", label: "Semua", count: counts.all },
              { key: "terjadwal", label: "Terkonfirmasi", count: counts.terjadwal },
              { key: "menunggu", label: "Menunggu", count: counts.menunggu },
              { key: "selesai", label: "Selesai", count: counts.selesai },
              { key: "dibatalkan", label: "Dibatalkan", count: counts.dibatalkan },
            ].map((tab) => {
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

        <CardContent className="p-4 sm:p-6 space-y-4">
          {/* A. MOBILE VIEW: Responsive Appointment Cards */}
          <div className="block md:hidden space-y-3.5">
            {filteredData.length > 0 ? (
              filteredData.map((item: ScheduleItem) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-teal-200 dark:hover:border-teal-800 transition-all shadow-2xs space-y-3"
                >
                  {/* Top: Doctor & Status */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div
                      className="flex items-start gap-3 min-w-0 cursor-pointer"
                      onClick={() => openSessionDetail(item)}
                    >
                      <div className="w-10 h-10 rounded-full bg-teal-50 dark:bg-teal-950 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 font-bold text-xs flex items-center justify-center shrink-0 font-heading mt-0.5">
                        {item.initials}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <p className="font-bold text-slate-900 dark:text-white text-sm font-heading truncate">
                            {item.consultant}
                          </p>
                          {item.initials !== "TB" && <MdVerified className="text-sky-500 text-xs shrink-0" />}
                        </div>
                        <p className="text-[11px] text-teal-700 dark:text-teal-400 font-medium truncate">{item.title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">{item.topic}</p>
                      </div>
                    </div>

                    <div className="shrink-0">{renderStatusBadge(item.status)}</div>
                  </div>

                  {/* Middle: Schedule & Medium Strip */}
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex flex-wrap items-center gap-2 font-medium">
                      <span className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                        <CalendarIcon size={13} className="text-teal-600 dark:text-teal-400 shrink-0" />
                        {item.date}
                      </span>
                      <span className="text-slate-300 dark:text-slate-600">•</span>
                      <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                        <Clock size={12} className="text-teal-600 dark:text-teal-400 shrink-0" />
                        {item.time}
                      </span>
                    </div>

                    <span className="text-[11px] font-semibold text-teal-800 dark:text-teal-300 bg-white dark:bg-slate-900 border border-teal-200/80 dark:border-teal-800 px-2 py-0.5 rounded-md">
                      {item.type}
                    </span>
                  </div>

                  {/* Bottom: Action Buttons */}
                  <div className="flex items-center justify-end gap-2 pt-0.5">
                    {item.status === "terjadwal" ? (
                      <div className="grid grid-cols-2 gap-2 w-full">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openSessionDetail(item)}
                          className="w-full text-xs border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg py-2 font-semibold"
                        >
                          Detail Sesi
                        </Button>
                        <Link href="/patient/room" className="w-full">
                          <Button
                            size="sm"
                            className="w-full text-xs bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg py-2 cursor-pointer shadow-xs gap-1.5"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                            Masuk Sesi
                          </Button>
                        </Link>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openSessionDetail(item)}
                        className="w-full text-xs border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg py-2 font-semibold"
                      >
                        {item.status === "selesai" ? "Lihat Catatan Konseling" : "Detail Janji Temu"}
                      </Button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 text-xs text-slate-400 dark:text-slate-500">
                Tidak ada jadwal yang cocok dengan filter.
              </div>
            )}
          </div>

          {/* B. DESKTOP VIEW: High-Resolution Clinical Table */}
          <div className="hidden md:block">
            <Tables
              columns={columns}
              data={filteredData}
              currentPage={currentPage}
              itemsPerPage={itemsPerPage}
            />
          </div>

          {/* Pagination & Footer Info */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-2">
            <TableInfo
              total={filteredData.length}
              displayed={itemsPerPage}
              onChangeDisplayed={setItemsPerPage}
            />
            <TablePagination
              totalItems={filteredData.length}
              page={currentPage}
              limit={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </div>
        </CardContent>
      </Card>

      {/* 3. Interactive Modals */}
      <BookingModal
        isOpen={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
      />

      <SessionDetailModal
        session={selectedSession}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
      />
    </div>
  );
}

export default function PatientSchedulePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Memuat jadwal...</div>}>
      <PatientScheduleContent />
    </Suspense>
  );
}
