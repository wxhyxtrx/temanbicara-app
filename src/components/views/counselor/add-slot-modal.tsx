"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Calendar,
  Clock,
  Sparkles,
  Phone,
  MessageSquare,
  ShieldCheck,
  Plus,
} from "lucide-react";

export interface CustomSlotPayload {
  day: string;
  timeRange: string;
  method: "Semua Metode" | "Chat Saja" | "Voice Saja";
  maxClients: number;
  notes?: string;
}

interface AddSlotModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDay?: string;
  onAddSlot: (slot: CustomSlotPayload) => void;
}

const availableDays = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const startTimes = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:30",
  "19:00",
  "20:00",
];

export function AddSlotModal({
  open,
  onOpenChange,
  defaultDay = "Senin",
  onAddSlot,
}: AddSlotModalProps) {
  const [selectedDay, setSelectedDay] = useState(
    defaultDay === "Semua" ? "Senin" : defaultDay
  );
  const [selectedStart, setSelectedStart] = useState("14:00");
  const [selectedMethod, setSelectedMethod] = useState<"Semua Metode" | "Chat Saja" | "Voice Saja">("Semua Metode");
  const [notes, setNotes] = useState("");

  const calculateEnd = (start: string) => {
    const [h, m] = start.split(":").map(Number);
    const endH = (h + 1).toString().padStart(2, "0");
    return `${endH}:${m.toString().padStart(2, "0")}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const end = calculateEnd(selectedStart);
    onAddSlot({
      day: selectedDay,
      timeRange: `${selectedStart} - ${end} WIB`,
      method: selectedMethod,
      maxClients: 1,
      notes: notes.trim(),
    });
    onOpenChange(false);
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 font-nunito bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/60 space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 flex items-center justify-center">
              <Plus size={16} />
            </div>
            <DialogTitle className="text-base sm:text-lg font-bold font-heading text-slate-900 dark:text-white">
              Tambah Slot Praktik Mandiri
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito pl-0.5">
            Tentukan hari dan jam konsultasi baru agar pasien dapat mereservasi sesi di jadwal publik Anda.
          </DialogDescription>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 1. Pilih Hari */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
              1. Hari Praktik:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {availableDays.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelectedDay(d)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer border ${
                    selectedDay === d
                      ? "bg-teal-600 text-white border-teal-600 shadow-2xs"
                      : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-teal-300"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Pilih Jam Mulai */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                2. Jam Mulai Konseling (Durasi 60 Menit):
              </label>
              <span className="text-[11px] font-mono text-teal-700 dark:text-teal-400 font-bold">
                {selectedStart} - {calculateEnd(selectedStart)} WIB
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {startTimes.map((time) => (
                <button
                  key={time}
                  type="button"
                  onClick={() => setSelectedStart(time)}
                  className={`text-xs py-1.5 px-2 rounded-lg font-mono font-medium transition-all cursor-pointer border text-center ${
                    selectedStart === time
                      ? "bg-teal-600 text-white border-teal-600 shadow-2xs font-bold"
                      : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-teal-300"
                  }`}
                >
                  {time}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Metode Konseling yang Disediakan */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
              3. Metode Layanan di Slot Ini:
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "Semua Metode" as const, label: "Chat & Voice", icon: Sparkles },
                { id: "Chat Saja" as const, label: "Chat Eksklusif", icon: MessageSquare },
                { id: "Voice Saja" as const, label: "Voice Call", icon: Phone },
              ].map((m) => {
                const Icon = m.icon;
                const isSelected = selectedMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMethod(m.id)}
                    className={`p-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                      isSelected
                        ? "bg-teal-50 dark:bg-teal-950 border-teal-600 text-teal-800 dark:text-teal-200 shadow-2xs font-bold"
                        : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <Icon size={14} className={isSelected ? "text-teal-600" : ""} />
                    <span className="text-[11px] leading-tight">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Catatan Slot (Opsional) */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
              4. Label / Catatan Internal (Opsional):
            </label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Slot Pasien Reguler, Sesi Malam, dll."
              className="text-xs h-9 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl"
            />
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-xs text-slate-600 dark:text-slate-400 h-9 px-4 rounded-xl font-semibold cursor-pointer"
            >
              Batal
            </Button>
            <Button
              type="submit"
              className="text-xs bg-teal-600 hover:bg-teal-700 text-white h-9 px-5 rounded-xl font-bold cursor-pointer shadow-xs gap-1.5"
            >
              <Plus size={14} />
              <span>Simpan Slot Praktik</span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
