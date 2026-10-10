"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  CalendarDays,
  Sparkles,
  Phone,
  MessageSquare,
  Coffee,
  Check,
  Zap,
} from "lucide-react";
import { AddSlotModal, CustomSlotPayload } from "@/components/views/counselor/add-slot-modal";

interface SlotItem {
  id: string;
  day: string;
  timeRange: string;
  isBooked: boolean;
  clientName?: string;
  topic?: string;
  method: "Semua Metode" | "Chat Saja" | "Voice Saja";
  notes?: string;
}

const initialSlots: SlotItem[] = [
  {
    id: "slot-1",
    day: "Senin",
    timeRange: "09:00 - 10:00 WIB",
    isBooked: true,
    clientName: "Ahmad Rizky",
    topic: "Kecemasan Karier & Regulasi Diri",
    method: "Semua Metode",
  },
  {
    id: "slot-2",
    day: "Senin",
    timeRange: "14:00 - 15:00 WIB",
    isBooked: false,
    method: "Semua Metode",
    notes: "Slot Reguler Siang",
  },
  {
    id: "slot-3",
    day: "Senin",
    timeRange: "19:00 - 20:00 WIB",
    isBooked: false,
    method: "Chat Saja",
    notes: "Sesi Malam",
  },
  {
    id: "slot-4",
    day: "Selasa",
    timeRange: "10:00 - 11:00 WIB",
    isBooked: true,
    clientName: "Wahyu Tricahyo",
    topic: "Konseling Penanganan Burnout & Work-Life Balance",
    method: "Voice Saja",
  },
  {
    id: "slot-5",
    day: "Selasa",
    timeRange: "15:00 - 16:00 WIB",
    isBooked: false,
    method: "Semua Metode",
  },
  {
    id: "slot-6",
    day: "Rabu",
    timeRange: "13:00 - 14:00 WIB",
    isBooked: false,
    method: "Semua Metode",
  },
  {
    id: "slot-7",
    day: "Kamis",
    timeRange: "09:00 - 10:00 WIB",
    isBooked: false,
    method: "Semua Metode",
  },
  {
    id: "slot-8",
    day: "Jumat",
    timeRange: "14:00 - 15:00 WIB",
    isBooked: true,
    clientName: "Nadia Putri",
    topic: "Attachment Anxiety & Komunikasi",
    method: "Semua Metode",
  },
];

export default function CounselorSchedulePage() {
  const [slots, setSlots] = useState<SlotItem[]>(initialSlots);
  const [isAcceptingNewClients, setIsAcceptingNewClients] = useState(true);
  const [selectedDay, setSelectedDay] = useState("Semua");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const days = ["Semua", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

  const filteredSlots = selectedDay === "Semua" ? slots : slots.filter((s) => s.day === selectedDay);

  const totalSlots = slots.length;
  const bookedSlots = slots.filter((s) => s.isBooked).length;
  const availableSlots = totalSlots - bookedSlots;
  const estimatedHonor = bookedSlots * 15; // 15 Koin per sesi

  const triggerFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleToggleBooking = (id: string) => {
    setSlots((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const nextState = !s.isBooked;
          return {
            ...s,
            isBooked: nextState,
            clientName: nextState ? "Klien Reservasi Manual" : undefined,
            topic: nextState ? "Sesi Konseling Terjadwal" : undefined,
          };
        }
        return s;
      })
    );
    triggerFeedback("Status slot berhasil diperbarui.");
  };

  const handleDeleteSlot = (id: string) => {
    setSlots((prev) => prev.filter((s) => s.id !== id));
    triggerFeedback("Slot praktik telah dihapus dari kalender.");
  };

  const handleAddCustomSlot = (payload: CustomSlotPayload) => {
    const newSlot: SlotItem = {
      id: `slot-${Date.now()}`,
      day: payload.day,
      timeRange: payload.timeRange,
      isBooked: false,
      method: payload.method,
      notes: payload.notes || "Slot kustom",
    };
    setSlots((prev) => [...prev, newSlot]);
    triggerFeedback(`Slot baru pada hari ${payload.day} (${payload.timeRange}) berhasil ditambahkan.`);
  };

  // Quick action: Terapkan Template Hari Kerja (Senin - Jumat)
  const handleApplyWeekdayTemplate = () => {
    const weekdays = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];
    const templateTimes = ["10:00 - 11:00 WIB", "14:00 - 15:00 WIB", "19:00 - 20:00 WIB"];

    const newGeneratedSlots: SlotItem[] = [];
    weekdays.forEach((day) => {
      templateTimes.forEach((timeRange, idx) => {
        // Cek jika slot belum ada
        const exists = slots.some((s) => s.day === day && s.timeRange === timeRange);
        if (!exists) {
          newGeneratedSlots.push({
            id: `tpl-${day}-${idx}-${Date.now()}`,
            day,
            timeRange,
            isBooked: false,
            method: idx === 2 ? "Chat Saja" : "Semua Metode",
            notes: idx === 2 ? "Slot Malam" : "Slot Reguler",
          });
        }
      });
    });

    if (newGeneratedSlots.length === 0) {
      triggerFeedback("Template hari kerja sudah terisi penuh.");
      return;
    }

    setSlots((prev) => [...prev, ...newGeneratedSlots]);
    triggerFeedback(`${newGeneratedSlots.length} slot baru hari kerja berhasil digenerate otomatis.`);
  };

  // Quick action: Liburkan Hari Ini (Hapus atau kosongkan slot hari yang dipilih)
  const handleClearDaySlots = () => {
    if (selectedDay === "Semua") {
      triggerFeedback("Pilih hari spesifik terlebih dahulu untuk meliburkan jadwal.");
      return;
    }
    setSlots((prev) => prev.filter((s) => s.day !== selectedDay));
    triggerFeedback(`Semua slot pada hari ${selectedDay} telah diliburkan/dikosongkan.`);
  };

  return (
    <div className="space-y-6 sm:space-y-8 font-nunito pb-12 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-800 dark:text-teal-300 text-[11px] font-bold">
            <CalendarDays size={13} className="text-teal-600 dark:text-teal-400" />
            <span>Katalog Praktik Mandiri Psikolog</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 dark:text-white tracking-tight">
            Pengaturan Jadwal & Slot Praktik
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Atur ketersediaan jam konsultasi publik Anda secara mandiri agar pasien dapat mereservasi sesi
          </p>
        </div>

        <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl shadow-2xs self-start sm:self-auto">
          <div className="space-y-0.5 pr-2">
            <p className="text-xs font-bold text-slate-900 dark:text-white">Status Praktik Publik</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {isAcceptingNewClients ? "Menerima Pasien Baru" : "Tutup Sementara"}
            </p>
          </div>
          <Switch
            checked={isAcceptingNewClients}
            onCheckedChange={setIsAcceptingNewClients}
            className="cursor-pointer data-[state=checked]:bg-teal-600"
          />
        </div>
      </div>

      {/* 2. Stat Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Total Slot</span>
            <Clock size={16} className="text-teal-600 dark:text-teal-400" />
          </div>
          <p className="text-xl sm:text-2xl font-extrabold font-heading text-slate-900 dark:text-white mt-1">
            {totalSlots} Sesi
          </p>
          <span className="text-[11px] text-slate-400">Kapasitas mingguan</span>
        </Card>

        <Card className="rounded-2xl border border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50/30 dark:bg-emerald-950/20 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Terisi (Booked)</span>
            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-xl sm:text-2xl font-extrabold font-heading text-emerald-700 dark:text-emerald-300 mt-1">
            {bookedSlots} Klien
          </p>
          <span className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 font-medium">Sesi terkonfirmasi</span>
        </Card>

        <Card className="rounded-2xl border border-teal-200/80 dark:border-teal-800/60 bg-teal-50/30 dark:bg-teal-950/20 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-teal-800 dark:text-teal-300">Slot Tersedia</span>
            <Sparkles size={16} className="text-teal-600 dark:text-teal-400" />
          </div>
          <p className="text-xl sm:text-2xl font-extrabold font-heading text-teal-700 dark:text-teal-300 mt-1">
            {availableSlots} Slot
          </p>
          <span className="text-[11px] text-teal-600/80 dark:text-teal-400/80 font-medium">Siap dipesan pasien</span>
        </Card>

        <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Estimasi Honor</span>
            <span className="text-xs font-bold text-amber-500">🪙 Koin</span>
          </div>
          <p className="text-xl sm:text-2xl font-extrabold font-heading text-slate-900 dark:text-white mt-1">
            {estimatedHonor} Koin
          </p>
          <span className="text-[11px] text-slate-400">Dari sesi yang terisi</span>
        </Card>
      </div>

      {feedback && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* 3. Toolbar & Filter Days Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs">
        {/* Days Pill Selector */}
        <div className="flex flex-wrap items-center gap-1.5">
          {days.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedDay === day
                  ? "bg-teal-600 text-white shadow-2xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {day}
              {day !== "Semua" && (
                <span className="ml-1 opacity-70 text-[10px]">
                  ({slots.filter((s) => s.day === day).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleApplyWeekdayTemplate}
            className="text-xs border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-slate-800 rounded-xl h-9 font-semibold gap-1.5 cursor-pointer"
            title="Generate otomatis 3 slot harian (Pagi, Siang, Malam) untuk Senin s.d Jumat"
          >
            <Zap size={14} className="text-amber-500" />
            <span>Template Hari Kerja</span>
          </Button>

          {selectedDay !== "Semua" && (
            <Button
              type="button"
              variant="outline"
              onClick={handleClearDaySlots}
              className="text-xs border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl h-9 font-semibold gap-1.5 cursor-pointer"
              title={`Kosongkan semua slot pada hari ${selectedDay}`}
            >
              <Coffee size={14} />
              <span>Liburkan {selectedDay}</span>
            </Button>
          )}

          <Button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-xl px-4 h-9 font-bold shadow-xs gap-1.5 cursor-pointer"
          >
            <Plus size={15} />
            <span>Tambah Slot Praktik</span>
          </Button>
        </div>
      </div>

      {/* 4. Slot Grid */}
      {filteredSlots.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSlots.map((slot) => (
            <Card
              key={slot.id}
              className={`rounded-2xl border transition-all ${
                slot.isBooked
                  ? "border-emerald-200/90 dark:border-emerald-800/80 bg-emerald-50/30 dark:bg-emerald-950/20 shadow-2xs"
                  : "border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900"
              }`}
            >
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <Badge
                    variant="outline"
                    className={`text-xs font-semibold ${
                      slot.isBooked
                        ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    {slot.day}
                  </Badge>

                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[11px] font-bold ${
                        slot.isBooked ? "text-emerald-600 dark:text-emerald-400" : "text-teal-600 dark:text-teal-400"
                      }`}
                    >
                      {slot.isBooked ? "Terisi Klien" : "Tersedia"}
                    </span>
                  </div>
                </div>

                <CardTitle className="text-base font-bold font-heading text-slate-900 dark:text-white pt-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-teal-600 dark:text-teal-400" />
                    <span>{slot.timeRange}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 font-normal">
                    {slot.method === "Voice Saja" ? "Voice Call" : slot.method === "Chat Saja" ? "Chat" : "Chat / Voice"}
                  </span>
                </CardTitle>
              </CardHeader>

              <CardContent className="p-4 pt-2 space-y-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 text-xs space-y-1">
                  {slot.isBooked ? (
                    <>
                      <p className="font-bold text-slate-900 dark:text-white">
                        Klien: {slot.clientName || "Pasien Terkonfirmasi"}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-nunito line-clamp-1">
                        Topik: {slot.topic || "Konseling Terjadwal"}
                      </p>
                    </>
                  ) : (
                    <p className="text-slate-500 dark:text-slate-400 font-nunito">
                      {slot.notes || "Siap dipesan oleh pasien melalui katalog jadwal publik."}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/80">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleToggleBooking(slot.id)}
                    className="text-xs text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-slate-800 h-8 px-2.5 font-semibold cursor-pointer"
                  >
                    {slot.isBooked ? "Batalkan Sesi" : "Tandai Terisi Manual"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteSlot(slot.id)}
                    className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 h-8 px-2 cursor-pointer"
                    title="Hapus Slot"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-10 text-center rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/80 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto">
            <CalendarDays size={24} />
          </div>
          <h3 className="font-bold text-base font-heading text-slate-900 dark:text-white">
            Belum Ada Slot Praktik di Hari {selectedDay}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto font-nunito">
            Jadwal Anda sedang kosong pada hari ini. Tambahkan slot jam konsultasi baru atau gunakan template hari kerja.
          </p>
          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-xl px-5 h-9 font-bold shadow-xs cursor-pointer gap-1.5"
          >
            <Plus size={14} />
            <span>Tambah Slot untuk Hari {selectedDay === "Semua" ? "Ini" : selectedDay}</span>
          </Button>
        </Card>
      )}

      {/* Add Slot Modal */}
      <AddSlotModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        defaultDay={selectedDay}
        onAddSlot={handleAddCustomSlot}
      />
    </div>
  );
}
