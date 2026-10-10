"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Users,
  Search,
  FileText,
  Calendar,
  Sparkles,
  ShieldCheck,
  Plus,
  Save,
  CheckCircle2,
  Clock,
  HeartPulse,
} from "lucide-react";

interface ClientRecord {
  id: string;
  name: string;
  age: number;
  status: "Aktif" | "Pemulihan" | "Selesai";
  totalSessions: number;
  lastSession: string;
  primaryDiagnosis: string;
  dassTrend: "Membaik" | "Stabil" | "Butuh Perhatian";
  clinicalNotes: string[];
}

const mockClients: ClientRecord[] = [
  {
    id: "cl-1",
    name: "Budi Santoso",
    age: 26,
    status: "Aktif",
    totalSessions: 4,
    lastSession: "8 Okt 2026",
    primaryDiagnosis: "Generalised Anxiety & Work Burnout",
    dassTrend: "Membaik",
    clinicalNotes: [
      "Sesi 1: Initial assessment, keluhan utama somatic anxiety saat deadline.",
      "Sesi 2: Psikoedukasi restrukturisasi kognitif (CBT) dan relaksasi diafragma.",
      "Sesi 3: Pasien melaporkan durasi tidur meningkat menjadi 6 jam tanpa mimpi buruk.",
    ],
  },
  {
    id: "cl-2",
    name: "Nadia Putri",
    age: 23,
    status: "Aktif",
    totalSessions: 2,
    lastSession: "5 Okt 2026",
    primaryDiagnosis: "Penyesuaian Diri & Komunikasi Interpersonal",
    dassTrend: "Stabil",
    clinicalNotes: [
      "Sesi 1: Diskusi identifikasi batasan emosional (assertive boundary) keluarga.",
      "Sesi 2: Latihan roleplay komunikasi non-defensif.",
    ],
  },
  {
    id: "cl-3",
    name: "Ahmad Rizky (Anonim)",
    age: 29,
    status: "Pemulihan",
    totalSessions: 6,
    lastSession: "1 Okt 2026",
    primaryDiagnosis: "Episode Depresif Ringan (Dalam Remisi)",
    dassTrend: "Membaik",
    clinicalNotes: [
      "Sesi 1-4: Behavioral Activation & penjadwalan aktivitas restoratif.",
      "Sesi 5-6: Maintenance plan dan pencegahan relaps.",
    ],
  },
];

export default function CounselorClientsPage() {
  const [clients, setClients] = useState<ClientRecord[]>(mockClients);
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<ClientRecord>(mockClients[0]);
  const [newNote, setNewNote] = useState("");
  const [showSavedMsg, setShowSavedMsg] = useState(false);

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.primaryDiagnosis.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    const updated = {
      ...selectedClient,
      clinicalNotes: [
        ...selectedClient.clinicalNotes,
        `Sesi ${selectedClient.totalSessions + 1}: ${newNote.trim()}`,
      ],
      totalSessions: selectedClient.totalSessions + 1,
      lastSession: "Hari Ini, 10 Okt 2026",
    };

    setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setSelectedClient(updated);
    setNewNote("");
    setShowSavedMsg(true);
    setTimeout(() => setShowSavedMsg(false), 3000);
  };

  return (
    <div className="space-y-6 sm:space-y-8 font-nunito pb-12 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* 1. Header */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 dark:text-white tracking-tight">
          Catatan Klinis & Rekam Evaluasi Klien
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Dokumentasi perkembangan terapi terenkripsi sesuai standar rekam psikologis HIMPSI
        </p>
      </div>

      {showSavedMsg && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>Catatan rekam sesi baru berhasil disimpan dan dienkripsi ke profil klien.</span>
        </div>
      )}

      {/* 2. Main 2-Column Clinical Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
        {/* Left Column: Client List (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={15} />
            <Input
              placeholder="Cari nama klien / diagnosis..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs bg-white dark:bg-slate-900 rounded-xl border-slate-200 dark:border-slate-800"
            />
          </div>

          <div className="space-y-3">
            {filtered.map((client) => {
              const isSelected = selectedClient.id === client.id;
              return (
                <div
                  key={client.id}
                  onClick={() => setSelectedClient(client)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                    isSelected
                      ? "border-teal-500 bg-teal-50/50 dark:bg-teal-950/40 shadow-xs"
                      : "border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-teal-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold font-heading text-sm text-slate-900 dark:text-white">
                        {client.name}
                      </p>
                      <p className="text-[11px] text-teal-700 dark:text-teal-400 font-medium">
                        {client.primaryDiagnosis}
                      </p>
                    </div>
                    <Badge
                      className={`text-[10px] font-semibold ${
                        client.status === "Aktif"
                          ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200"
                          : "bg-blue-50 text-blue-700 border-blue-200"
                      }`}
                    >
                      {client.status}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-nunito pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span>{client.totalSessions} Sesi Konsultasi</span>
                    <span>Terakhir: {client.lastSession}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Detailed Clinical Dossier (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="font-heading text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText size={18} className="text-teal-600 dark:text-teal-400" />
                    Rekam Terapi: {selectedClient.name}
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
                    Diagnosis: {selectedClient.primaryDiagnosis}
                  </CardDescription>
                </div>

                <Badge
                  variant="outline"
                  className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 text-xs self-start sm:self-center"
                >
                  Tren DASS-21: {selectedClient.dassTrend}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-6 space-y-6">
              {/* Chronological Notes */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Riwayat Catatan Sesi
                </p>
                <div className="space-y-2.5">
                  {selectedClient.clinicalNotes.map((note, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-nunito"
                    >
                      {note}
                    </div>
                  ))}
                </div>
              </div>

              {/* Add New Session Note Form */}
              <form onSubmit={handleAddNote} className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  Tambahkan Catatan Refleksi / Homework Sesi Baru
                </label>
                <textarea
                  rows={3}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Tuliskan dinamika respon emosi, intervensi kognitif yang diberikan, dan tugas refleksi mingguan klien..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    className="text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-xl px-4 py-2 font-semibold shadow-xs gap-1.5 cursor-pointer"
                  >
                    <Save size={14} />
                    Simpan Catatan Medis
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
