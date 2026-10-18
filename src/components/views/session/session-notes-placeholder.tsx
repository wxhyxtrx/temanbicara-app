"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FileText,
  Save,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Shield,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { bookingClient, BookingApiError } from "@/services/booking.client";
import { formatWibDateFull, formatWibTime, BOOKING_STATUS_CONFIG } from "@/lib/booking-utils";
import type { BookingStatus, ClientNoteDetail } from "@/types/booking";

interface SessionNotesPanelProps {
  isOpen: boolean;
  bookingId: string;
  bookingStatus: BookingStatus;
  patientDisplayName?: string | null;
  patientId?: string | null;
}

export function SessionNotesPanel({
  isOpen,
  bookingId,
  bookingStatus,
  patientDisplayName,
  patientId,
}: SessionNotesPanelProps) {
  const [activeTab, setActiveTab] = useState<"current" | "history">("current");

  // Current session note state
  const [noteBody, setNoteBody] = useState<string>("");
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "dirty" | "error">("idle");
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [lastSavedBody, setLastSavedBody] = useState<string>("");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [resolvedPatientId, setResolvedPatientId] = useState<string | null>(patientId || null);

  // Previous notes state
  const [pastNotes, setPastNotes] = useState<ClientNoteDetail[]>([]);
  const [loadingPastNotes, setLoadingPastNotes] = useState<boolean>(false);
  const [pastNotesError, setPastNotesError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const noteBodyRef = useRef(noteBody);
  noteBodyRef.current = noteBody;
  const lastSavedBodyRef = useRef(lastSavedBody);
  lastSavedBodyRef.current = lastSavedBody;
  const isSavingRef = useRef(false);

  const isStatusValid = bookingStatus === "in_progress" || bookingStatus === "completed";

  // 1. Fetch current note on mount or bookingId change
  const fetchCurrentNote = useCallback(async () => {
    if (!bookingId) return;
    try {
      setInitialLoading(true);
      setInitialError(null);
      const res = await bookingClient.getClientNote(bookingId);
      if (!isMountedRef.current) return;

      if (res.patient_id) {
        setResolvedPatientId(res.patient_id);
      }

      if (res.data) {
        const body = res.data.body || "";
        setNoteBody(body);
        setLastSavedBody(body);
        if (res.data.patient_id) {
          setResolvedPatientId(res.data.patient_id);
        }
        if (res.data.updated_at) {
          setLastSavedAt(formatWibTime(res.data.updated_at));
        }
        setSaveStatus("saved");
      } else {
        setNoteBody("");
        setLastSavedBody("");
        setSaveStatus("idle");
      }
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      console.error("Gagal memuat catatan sesi:", err);
      setInitialError(err instanceof Error ? err.message : "Gagal memuat catatan sesi");
    } finally {
      if (isMountedRef.current) {
        setInitialLoading(false);
      }
    }
  }, [bookingId]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchCurrentNote();
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchCurrentNote]);

  // Update resolved patient ID when prop changes
  useEffect(() => {
    if (patientId) {
      setResolvedPatientId(patientId);
    }
  }, [patientId]);

  // 2. Fetch past notes when resolvedPatientId is ready
  const fetchPastNotes = useCallback(async () => {
    if (!resolvedPatientId) return;
    try {
      setLoadingPastNotes(true);
      setPastNotesError(null);
      const res = await bookingClient.getPatientNotes(resolvedPatientId);
      if (!isMountedRef.current) return;

      if (res.success && res.data && Array.isArray(res.data.notes)) {
        // Hanya tampilkan sesi terdahulu (selain sesi aktif saat ini)
        const filtered = res.data.notes.filter((n) => n.booking_id !== bookingId);
        setPastNotes(filtered);
      }
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      console.error("Gagal memuat riwayat catatan pasien:", err);
      setPastNotesError(err instanceof Error ? err.message : "Gagal memuat riwayat catatan");
    } finally {
      if (isMountedRef.current) {
        setLoadingPastNotes(false);
      }
    }
  }, [resolvedPatientId, bookingId]);

  useEffect(() => {
    if (resolvedPatientId) {
      fetchPastNotes();
    }
  }, [resolvedPatientId, fetchPastNotes]);

  // 3. Save function (manual or auto-save)
  const saveNote = useCallback(async (bodyToSave: string) => {
    if (isSavingRef.current) return;

    if (!isStatusValid) {
      setSaveStatus("error");
      setSaveErrorMessage("Catatan hanya dapat dibuat atau diubah pada sesi yang sedang berlangsung atau sudah selesai (Error 409).");
      return;
    }

    if (bodyToSave.length > 5000) {
      setSaveStatus("error");
      setSaveErrorMessage("Panjang catatan tidak boleh melebihi 5000 karakter.");
      return;
    }

    try {
      isSavingRef.current = true;
      setSaveStatus("saving");
      setSaveErrorMessage(null);

      const res = await bookingClient.updateClientNote(bookingId, { body: bodyToSave });

      if (!isMountedRef.current) return;
      if (res.success && res.data) {
        setLastSavedBody(bodyToSave);
        setSaveStatus("saved");
        setLastSavedAt(formatWibTime(res.data.updated_at || new Date().toISOString()));
      }
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      console.error("Gagal menyimpan catatan:", err);
      setSaveStatus("error");
      const isConflict =
        (err instanceof BookingApiError && err.status === 409) ||
        (err instanceof Error && err.message.includes("409")) ||
        (err instanceof Error && err.message.includes("INVALID_BOOKING_STATUS"));

      if (isConflict) {
        setSaveErrorMessage("Catatan hanya dapat dibuat atau diubah pada sesi yang sedang berlangsung atau sudah selesai (Error 409).");
      } else {
        setSaveErrorMessage(err instanceof Error ? err.message : "Gagal menyimpan catatan klinis.");
      }
    } finally {
      isSavingRef.current = false;
    }
  }, [bookingId, isStatusValid]);

  // 4. Debounced auto-save (1500ms setelah selesai mengetik)
  useEffect(() => {
    if (initialLoading) return;
    if (!isStatusValid) return;
    if (noteBody === lastSavedBodyRef.current) return;
    if (noteBody.length > 5000) return;

    const timer = setTimeout(() => {
      saveNote(noteBodyRef.current);
    }, 1500);

    return () => clearTimeout(timer);
  }, [noteBody, isStatusValid, initialLoading, saveNote]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setNoteBody(newVal);
    if (newVal !== lastSavedBody) {
      setSaveStatus("dirty");
      setSaveErrorMessage(null);
    } else {
      setSaveStatus("saved");
    }
  };

  if (!isOpen) return null;

  const charCount = noteBody.length;
  const isTooLong = charCount > 5000;
  const cleanedName = patientDisplayName?.replace(/[?]/g, "").trim();
  const displayName = cleanedName || "Pasien";

  return (
    <aside className="w-80 lg:w-96 shrink-0 border-l border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col font-nunito z-10">
      {/* Header Panel */}
      <div className="p-3.5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-950/40">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-teal-100/80 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
            <FileText size={16} />
          </div>
          <div className="min-w-0">
            <h2 className="text-xs font-bold text-slate-900 dark:text-white truncate">
              Catatan Klien (SOAP)
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {displayName}
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 h-4 font-medium bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800 shrink-0"
        >
          Psikolog Saja
        </Badge>
      </div>

      {/* Tabs Switcher: Sesi Ini vs Riwayat Sebelumnya */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as "current" | "history")}
        className="flex-1 flex flex-col min-h-0"
      >
        <div className="px-3.5 pt-3 pb-1 border-b border-slate-100 dark:border-slate-800/80">
          <TabsList className="w-full grid grid-cols-2 h-8">
            <TabsTrigger value="current" className="text-xs">
              Catatan Sesi Ini
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs gap-1.5">
              <span>Riwayat Sesi</span>
              {pastNotes.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200 text-[10px] font-bold">
                  {pastNotes.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Catatan Sesi Ini */}
        <TabsContent
          value="current"
          className="flex-1 flex flex-col min-h-0 p-3.5 space-y-3 mt-0 focus-visible:outline-none"
        >
          {initialLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-2">
              <Loader2 size={20} className="animate-spin text-teal-600" />
              <p className="text-xs text-slate-500 dark:text-slate-400">Memuat catatan klinis sesi...</p>
            </div>
          ) : initialError ? (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 space-y-2">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertCircle size={14} />
                <span>Gagal Mengambil Catatan</span>
              </div>
              <p className="text-[11px] leading-relaxed">{initialError}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={fetchCurrentNote}
                className="text-[11px] h-7 px-2.5 rounded-lg border-rose-300 dark:border-rose-800"
              >
                <RefreshCw size={11} className="mr-1" />
                Coba Lagi
              </Button>
            </div>
          ) : (
            <>
              {/* Alert Status Booking jika tidak valid */}
              {!isStatusValid && (
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
                  <AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <div className="leading-relaxed">
                    Catatan klinis hanya dapat diisi saat sesi berstatus <strong>in_progress</strong> atau <strong>completed</strong> (Status saat ini: {BOOKING_STATUS_CONFIG[bookingStatus]?.label || bookingStatus}).
                  </div>
                </div>
              )}

              {/* Alert Error Penyimpanan (e.g. 409 Conflict) */}
              {saveStatus === "error" && saveErrorMessage && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-[11px] text-rose-700 dark:text-rose-300 flex items-start gap-2">
                  <AlertCircle size={14} className="shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                  <div className="leading-relaxed font-medium">{saveErrorMessage}</div>
                </div>
              )}

              {/* Area Teks Catatan */}
              <div className="flex-1 flex flex-col min-h-0">
                <textarea
                  value={noteBody}
                  onChange={handleTextChange}
                  disabled={!isStatusValid}
                  placeholder={
                    isStatusValid
                      ? "Tulis catatan observasi, diagnosis awal, rencana intervensi klinis, atau catatan SOAP pasien..."
                      : "Catatan tidak dapat diedit karena status sesi tidak aktif."
                  }
                  className={`w-full flex-1 p-3 text-xs leading-relaxed rounded-xl border bg-slate-50/70 dark:bg-slate-950/50 resize-none font-sans focus:outline-none focus:ring-1 transition-all ${
                    isTooLong
                      ? "border-rose-400 focus:ring-rose-500"
                      : "border-slate-200 dark:border-slate-800 focus:border-teal-500 focus:ring-teal-500"
                  } disabled:opacity-60 disabled:cursor-not-allowed`}
                />
              </div>

              {/* Bar Indikator Status & Tombol Simpan */}
              <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center justify-between text-[11px]">
                  {/* Status Simpan */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    {saveStatus === "saving" && (
                      <span className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400 font-medium">
                        <Loader2 size={12} className="animate-spin" />
                        <span>Menyimpan...</span>
                      </span>
                    )}
                    {saveStatus === "saved" && (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium truncate">
                        <CheckCircle2 size={12} />
                        <span>Tersimpan {lastSavedAt ? `(${lastSavedAt})` : ""}</span>
                      </span>
                    )}
                    {saveStatus === "dirty" && (
                      <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                        <Clock size={12} />
                        <span>Perubahan belum tersimpan</span>
                      </span>
                    )}
                    {saveStatus === "error" && (
                      <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
                        <AlertCircle size={12} />
                        <span>Gagal simpan</span>
                      </span>
                    )}
                    {saveStatus === "idle" && (
                      <span className="text-slate-400 text-[10px]">Autosave aktif</span>
                    )}
                  </div>

                  {/* Penghitung Karakter */}
                  <span
                    className={`text-[10px] shrink-0 ${
                      isTooLong
                        ? "text-rose-600 dark:text-rose-400 font-bold"
                        : "text-slate-400"
                    }`}
                  >
                    {charCount}/5000
                  </span>
                </div>

                <Button
                  type="button"
                  size="sm"
                  disabled={
                    !isStatusValid ||
                    isTooLong ||
                    saveStatus === "saving" ||
                    noteBody === lastSavedBody
                  }
                  onClick={() => saveNote(noteBody)}
                  className="w-full text-xs h-8 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold shadow-xs gap-1.5 disabled:opacity-50"
                >
                  {saveStatus === "saving" ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Save size={13} />
                  )}
                  <span>Simpan Catatan</span>
                </Button>

                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 pt-1">
                  <Shield size={11} className="text-teal-600 dark:text-teal-400 shrink-0" />
                  <span className="truncate">Hanya dapat dibaca oleh Anda</span>
                </div>
              </div>
            </>
          )}
        </TabsContent>

        {/* Tab 2: Riwayat Sesi Sebelumnya (Baca Saja) */}
        <TabsContent
          value="history"
          className="flex-1 overflow-y-auto p-3.5 space-y-3 mt-0 focus-visible:outline-none"
        >
          {loadingPastNotes ? (
            <div className="py-12 text-center space-y-2">
              <Loader2 size={20} className="animate-spin text-teal-600 mx-auto" />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Memuat riwayat catatan sesi sebelumnya...
              </p>
            </div>
          ) : pastNotesError ? (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 space-y-2">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertCircle size={14} />
                <span>Gagal Memuat Riwayat</span>
              </div>
              <p className="text-[11px] leading-relaxed">{pastNotesError}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={fetchPastNotes}
                className="text-[11px] h-7 px-2.5 rounded-lg border-rose-300 dark:border-rose-800"
              >
                <RefreshCw size={11} className="mr-1" />
                Coba Lagi
              </Button>
            </div>
          ) : pastNotes.length === 0 ? (
            <div className="py-12 text-center space-y-2 max-w-xs mx-auto">
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <FileText size={18} />
              </div>
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Belum Ada Catatan Sebelumnya
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Ini adalah sesi pertama atau belum ada catatan terdahulu yang ditulis untuk pasien ini.
              </p>
            </div>
          ) : (
            pastNotes.map((item) => (
              <div
                key={item.booking_id}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 space-y-2"
              >
                <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-1.5">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">
                      {formatWibDateFull(item.start_at || item.created_at)}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Mulai: {formatWibTime(item.start_at || item.created_at)}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1.5 py-0 h-4 bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-700 shrink-0"
                  >
                    Hanya Baca
                  </Badge>
                </div>

                <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap font-sans bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800/80">
                  {item.body}
                </div>

                <div className="text-[10px] text-slate-400 text-right">
                  Terakhir disimpan: {formatWibTime(item.updated_at)}
                </div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </aside>
  );
}

// Alias export untuk kompatibilitas impor lama
export const SessionNotesPlaceholder = SessionNotesPanel;
