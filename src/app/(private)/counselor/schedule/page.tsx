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
} from "lucide-react";

interface SlotItem {
  id: string;
  day: string;
  timeRange: string;
  isBooked: boolean;
  clientName?: string;
}

const initialSlots: SlotItem[] = [
  { id: "slot-1", day: "Senin", timeRange: "09:00 - 10:00 WIB", isBooked: true, clientName: "Ahmad Rizky" },
  { id: "slot-2", day: "Senin", timeRange: "14:00 - 15:00 WIB", isBooked: false },
  { id: "slot-3", day: "Senin", timeRange: "19:00 - 20:00 WIB", isBooked: false },
  { id: "slot-4", day: "Selasa", timeRange: "10:00 - 11:00 WIB", isBooked: true, clientName: "Budi Santoso" },
  { id: "slot-5", day: "Selasa", timeRange: "15:00 - 16:00 WIB", isBooked: false },
  { id: "slot-6", day: "Rabu", timeRange: "13:00 - 14:00 WIB", isBooked: false },
  { id: "slot-7", day: "Kamis", timeRange: "09:00 - 10:00 WIB", isBooked: false },
  { id: "slot-8", day: "Jumat", timeRange: "14:00 - 15:00 WIB", isBooked: true, clientName: "Nadia Putri" },
];

export default function CounselorSchedulePage() {
  const [slots, setSlots] = useState<SlotItem[]>(initialSlots);
  const [isAcceptingNewClients, setIsAcceptingNewClients] = useState(true);
  const [selectedDay, setSelectedDay] = useState("Semua");
  const [successMsg, setSuccessMsg] = useState(false);

  const days = ["Semua", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

  const filteredSlots = selectedDay === "Semua" ? slots : slots.filter((s) => s.day === selectedDay);

  const handleToggleBooking = (id: string) => {
    setSlots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isBooked: !s.isBooked, clientName: s.isBooked ? undefined : "Klien Terdaftar" } : s))
    );
  };

  const handleDeleteSlot = (id: string) => {
    setSlots((prev) => prev.filter((s) => s.id !== id));
  };

  const handleAddSlot = () => {
    const newSlot: SlotItem = {
      id: `slot-${Date.now()}`,
      day: selectedDay === "Semua" ? "Senin" : selectedDay,
      timeRange: "16:00 - 17:00 WIB",
      isBooked: false,
    };
    setSlots((prev) => [...prev, newSlot]);
    setSuccessMsg(true);
    setTimeout(() => setSuccessMsg(false), 2500);
  };

  return (
    <div className="space-y-6 sm:space-y-8 font-nunito pb-12 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 dark:text-white tracking-tight">
            Manajemen Jadwal & Slot Praktik
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Atur ketersediaan jam konsultasi mingguan dan batasan kuota klien harian
          </p>
        </div>

        <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-2xl shadow-2xs">
          <div className="space-y-0.5 pr-2">
            <p className="text-xs font-bold text-slate-900 dark:text-white">Status Praktik</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {isAcceptingNewClients ? "Menerima Pasien Baru" : "Tutup Sementara"}
            </p>
          </div>
          <Switch
            checked={isAcceptingNewClients}
            onCheckedChange={setIsAcceptingNewClients}
            className="cursor-pointer"
          />
        </div>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>Slot praktik baru berhasil ditambahkan ke kalender publik Anda.</span>
        </div>
      )}

      {/* 2. Filter Days Bar & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {days.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedDay === day
                  ? "bg-teal-600 text-white shadow-2xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {day}
            </button>
          ))}
        </div>

        <Button
          onClick={handleAddSlot}
          className="text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-xl px-4 py-2 h-9 font-semibold shadow-xs gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <Plus size={15} />
          <span>Tambah Slot Praktik</span>
        </Button>
      </div>

      {/* 3. Slot Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSlots.map((slot) => (
          <Card
            key={slot.id}
            className={`rounded-2xl border transition-all ${
              slot.isBooked
                ? "border-teal-200/90 dark:border-teal-800/80 bg-teal-50/30 dark:bg-teal-950/20"
                : "border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900"
            }`}
          >
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <Badge
                  variant="outline"
                  className={`text-xs font-semibold ${
                    slot.isBooked
                      ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200"
                      : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200"
                  }`}
                >
                  {slot.day}
                </Badge>
                <span
                  className={`text-[11px] font-bold ${
                    slot.isBooked ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"
                  }`}
                >
                  {slot.isBooked ? "Terisi (Booked)" : "Tersedia"}
                </span>
              </div>
              <CardTitle className="text-base font-bold font-heading text-slate-900 dark:text-white pt-1 flex items-center gap-2">
                <Clock size={16} className="text-teal-600 dark:text-teal-400" />
                {slot.timeRange}
              </CardTitle>
            </CardHeader>

            <CardContent className="p-4 pt-2 space-y-3">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 text-xs">
                {slot.isBooked ? (
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    Klien: {slot.clientName || "Pasien Terkonfirmasi"}
                  </p>
                ) : (
                  <p className="text-slate-500 dark:text-slate-400 font-nunito">
                    Siap dipesan oleh pasien melalui katalog jadwal publik
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleToggleBooking(slot.id)}
                  className="text-xs text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-slate-800 h-8 px-2.5 font-semibold cursor-pointer"
                >
                  {slot.isBooked ? "Batalkan Sesi" : "Tandai Terisi"}
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
    </div>
  );
}
