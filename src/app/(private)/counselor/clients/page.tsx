"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Users,
  User,
  Clock,
  Calendar,
  FileText,
  AlertCircle,
  Loader2,
  RefreshCw,
  Search,
  ArrowRight,
  ArrowLeft,
  Shield,
  ChevronRight,
  MessageSquare,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { bookingClient } from "@/services/booking.client";
import { formatWibDateFull, formatWibDateShort, formatWibTime } from "@/lib/booking-utils";
import type { ClientNoteDetail, PsikologBookingView } from "@/types/booking";

interface PatientGroupItem {
  patientId: string;
  patientDisplayName: string;
  sessionCount: number;
  lastSessionAt: string;
}

// ponytail: client-side grouping and search over GET /api/bookings; upgrade to dedicated BE endpoint if client count exceeds hundreds
async function fetchAllCounselorBookings(): Promise<PsikologBookingView[]> {
  let page = 1;
  const limit = 50;
  let all: PsikologBookingView[] = [];
  let total = 0;

  do {
    const res = await bookingClient.getBookings({ page, limit });
    if (!res?.success || !Array.isArray(res.data)) break;
    all = all.concat(res.data as PsikologBookingView[]);
    total = res.pagination?.total ?? all.length;
    page++;
  } while (all.length < total && page <= 20);

  return all;
}

function groupBookingsByPatient(bookings: PsikologBookingView[]): PatientGroupItem[] {
  const sorted = [...bookings].sort(
    (a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime()
  );

  const groups = new Map<string, PatientGroupItem>();

  for (const b of sorted) {
    if (!b.patient_id) continue;
    const isCancelled =
      b.status === "cancelled_by_patient" ||
      b.status === "cancelled_by_psikolog" ||
      b.status === "auto_cancelled_late";
    if (isCancelled) continue;

    const existing = groups.get(b.patient_id);
    if (!existing) {
      groups.set(b.patient_id, {
        patientId: b.patient_id,
        patientDisplayName: b.patient_display_name || "Pasien",
        sessionCount: 1,
        lastSessionAt: b.start_at,
      });
    } else {
      existing.sessionCount += 1;
    }
  }

  return Array.from(groups.values());
}

export default function CounselorClientsPage() {
  const [bookingsLoading, setBookingsLoading] = useState<boolean>(true);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const [patients, setPatients] = useState<PatientGroupItem[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientGroupItem | null>(null);

  const [notes, setNotes] = useState<ClientNoteDetail[]>([]);
  const [notesLoading, setNotesLoading] = useState<boolean>(false);
  const [notesError, setNotesError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>("");

  const loadPatients = useCallback(async () => {
    setBookingsLoading(true);
    setBookingsError(null);
    try {
      const allBookings = await fetchAllCounselorBookings();
      const grouped = groupBookingsByPatient(allBookings);
      setPatients(grouped);
    } catch (err: unknown) {
      console.error("Gagal memuat daftar pasien:", err);
      setBookingsError(
        err instanceof Error ? err.message : "Gagal memuat daftar sesi pasien."
      );
    } finally {
      setBookingsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  const loadNotesForPatient = useCallback(async (patientId: string) => {
    setNotesLoading(true);
    setNotesError(null);
    try {
      const res = await bookingClient.getPatientNotes(patientId);
      if (res?.success && res.data) {
        const sortedNotes = [...(res.data.notes || [])].sort((a, b) => {
          const timeA = new Date(a.start_at || a.created_at).getTime();
          const timeB = new Date(b.start_at || b.created_at).getTime();
          return timeB - timeA;
        });
        setNotes(sortedNotes);
      } else {
        setNotes([]);
      }
    } catch (err: unknown) {
      console.error("Gagal memuat riwayat catatan pasien:", err);
      setNotesError(
        err instanceof Error ? err.message : "Gagal memuat catatan klinis pasien."
      );
    } finally {
      setNotesLoading(false);
    }
  }, []);

  const handleSelectPatient = (patient: PatientGroupItem) => {
    setSelectedPatient(patient);
    loadNotesForPatient(patient.patientId);
  };

  const filteredPatients = useMemo(() => {
    if (!searchQuery.trim()) return patients;
    const q = searchQuery.toLowerCase().trim();
    return patients.filter((p) => p.patientDisplayName.toLowerCase().includes(q));
  }, [patients, searchQuery]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 font-nunito space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl sm:text-2xl font-bold font-heading text-slate-900 dark:text-white">
            Catatan Klien
          </h1>
          <Badge
            variant="outline"
            className="text-xs bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800"
          >
            Rekam Klinis
          </Badge>
        </div>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Daftar pasien yang pernah menjalani sesi konseling dengan Anda dan riwayat rekam catatan SOAP per sesi.
        </p>
      </div>

      {/* Main Content Area */}
      {bookingsLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="col-span-12 lg:col-span-5 space-y-3">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
          <div className="hidden lg:block lg:col-span-7">
            <Skeleton className="h-80 w-full rounded-2xl" />
          </div>
        </div>
      ) : bookingsError ? (
        <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 space-y-3 max-w-md mx-auto text-center">
          <AlertCircle size={28} className="mx-auto text-rose-600" />
          <div className="space-y-1">
            <h3 className="font-bold text-sm">Gagal Memuat Klien</h3>
            <p className="text-xs">{bookingsError}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadPatients}
            className="text-xs rounded-xl border-rose-300 dark:border-rose-800 gap-1.5"
          >
            <RefreshCw size={12} />
            <span>Coba Lagi</span>
          </Button>
        </div>
      ) : patients.length === 0 ? (
        <div className="p-10 text-center bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl space-y-3 shadow-xs max-w-md mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/70 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-400 flex items-center justify-center mx-auto">
            <Users size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Belum Ada Klien
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Anda belum memiliki pasien yang pernah menjalani sesi konseling. Pasien yang telah booking dan menjalani sesi akan otomatis tercatat di sini.
            </p>
          </div>
          <Link href="/counselor/beranda" className="inline-block pt-2">
            <Button size="sm" variant="outline" className="text-xs rounded-xl">
              Kembali ke Beranda
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Kolom Kiri: Daftar Pasien */}
          <div
            className={`space-y-3 ${
              selectedPatient ? "hidden lg:block lg:col-span-5" : "col-span-12 lg:col-span-5"
            }`}
          >
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari pasien..."
                className="pl-8 text-xs h-9 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
              />
            </div>

            <div className="space-y-2">
              {filteredPatients.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800">
                  Tidak ada pasien yang cocok dengan pencarian &ldquo;{searchQuery}&rdquo;.
                </div>
              ) : (
                filteredPatients.map((p) => {
                  const isSelected = selectedPatient?.patientId === p.patientId;
                  return (
                    <button
                      type="button"
                      key={p.patientId}
                      onClick={() => handleSelectPatient(p)}
                      className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                        isSelected
                          ? "bg-teal-50/70 dark:bg-teal-950/40 border-teal-500/80 ring-1 ring-teal-500/50 shadow-xs"
                          : "bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 hover:border-teal-300 dark:hover:border-teal-700 shadow-xs"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-teal-100/80 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 font-bold flex items-center justify-center shrink-0 text-xs">
                          <User size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {p.patientDisplayName}
                          </p>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            <Clock size={11} className="text-teal-600 shrink-0" />
                            <span className="truncate">
                              Sesi terakhir: {formatWibDateShort(p.lastSessionAt)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Badge
                          variant="outline"
                          className="text-[10px] px-2 py-0.5 font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                        >
                          {p.sessionCount} Sesi
                        </Badge>
                        <ChevronRight
                          size={14}
                          className={isSelected ? "text-teal-600" : "text-slate-400"}
                        />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Kolom Kanan: Detail Catatan Sesi Pasien yang Dipilih */}
          <div
            className={`${
              !selectedPatient ? "hidden lg:block lg:col-span-7" : "col-span-12 lg:col-span-7"
            }`}
          >
            {!selectedPatient ? (
              <div className="flex flex-col items-center justify-center p-8 text-center space-y-3 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs min-h-[380px]">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/70 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-400 flex items-center justify-center mx-auto">
                  <ClipboardList size={24} />
                </div>
                <div className="space-y-1 max-w-sm">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Pilih Pasien untuk Melihat Catatan
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Pilih salah satu pasien dari daftar di sebelah kiri untuk melihat seluruh riwayat catatan klinis (SOAP) per sesi.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Mobile Back Button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedPatient(null)}
                  className="lg:hidden text-xs -ml-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white gap-1.5"
                >
                  <ArrowLeft size={14} />
                  <span>Kembali ke Daftar Pasien</span>
                </Button>

                {/* Header Klien Aktif */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-teal-100/80 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 font-bold flex items-center justify-center shrink-0 text-sm">
                      <User size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                          {selectedPatient.patientDisplayName}
                        </h2>
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 h-4 bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800"
                        >
                          Read-Only
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Total {selectedPatient.sessionCount} sesi • Terakhir:{" "}
                        {formatWibDateFull(selectedPatient.lastSessionAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 shrink-0">
                    <Shield size={12} className="text-teal-600 dark:text-teal-400" />
                    <span>Kerahasiaan Medis HIMPSI</span>
                  </div>
                </div>

                {/* Konten Catatan Sesi */}
                {notesLoading ? (
                  <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs space-y-2">
                    <Loader2 size={22} className="animate-spin text-teal-600 mx-auto" />
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Memuat riwayat catatan klinis...
                    </p>
                  </div>
                ) : notesError ? (
                  <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 space-y-2">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertCircle size={14} />
                      <span>Gagal Memuat Catatan</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">{notesError}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => loadNotesForPatient(selectedPatient.patientId)}
                      className="text-[11px] h-7 px-2.5 rounded-lg border-rose-300 dark:border-rose-800 gap-1"
                    >
                      <RefreshCw size={11} />
                      <span>Coba Lagi</span>
                    </Button>
                  </div>
                ) : notes.length === 0 ? (
                  <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs space-y-2 max-w-sm mx-auto">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                      <FileText size={18} />
                    </div>
                    <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Belum Ada Catatan Klinis
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Belum ada catatan SOAP yang tersimpan untuk pasien ini. Catatan klinis dibuat dan disimpan oleh psikolog melalui panel catatan di ruang sesi.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {notes.map((item) => {
                      const sessionTime = item.start_at || item.created_at;
                      return (
                        <div
                          key={item.booking_id}
                          className="p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3"
                        >
                          {/* Note Header: Waktu Sesi & Link ke Ruang Sesi */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                                <Calendar size={13} className="text-teal-600" />
                                <span>{formatWibDateFull(sessionTime)}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                                <Clock size={11} className="text-teal-600" />
                                <span>Mulai: {formatWibTime(sessionTime)}</span>
                              </div>
                            </div>

                            <Link href={`/counselor/room?booking=${item.booking_id}`}>
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full sm:w-auto text-xs h-7 px-2.5 rounded-lg border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/60 gap-1.5 font-medium cursor-pointer"
                              >
                                <MessageSquare size={12} />
                                <span>Buka Ruang Sesi</span>
                                <ArrowRight size={11} />
                              </Button>
                            </Link>
                          </div>

                          {/* Note Body */}
                          <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap font-sans bg-slate-50/70 dark:bg-slate-950/50 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-800/80">
                            {item.body}
                          </div>

                          {/* Note Footer */}
                          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                            <div className="flex items-center gap-1">
                              <Shield size={11} className="text-teal-600 dark:text-teal-400" />
                              <span>Hanya dapat dibaca oleh Anda</span>
                            </div>
                            <span>Terakhir disimpan: {formatWibTime(item.updated_at)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
