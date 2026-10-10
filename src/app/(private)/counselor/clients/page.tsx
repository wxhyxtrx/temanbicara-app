"use client";

import React, { useState, useMemo } from "react";
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
  Activity,
  Stethoscope,
  Lock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  useClinicalRecordsStore,
  ClientClinicalRecord,
  SoapEntry,
} from "@/store/clinical-records-store";
import { notify } from "@/lib/toast";

export default function CounselorClientsPage() {
  const rawClients = useClinicalRecordsStore((state) => state.clients);
  const saveSoapNote = useClinicalRecordsStore((state) => state.saveSoapNote);
  const updateClientStatus = useClinicalRecordsStore((state) => state.updateClientStatus);

  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string>("cl-wahyu");
  const [activeTab, setActiveTab] = useState<"soap" | "add">("soap");

  // Form state for adding new SOAP note
  const [soapS, setSoapS] = useState("");
  const [soapO, setSoapO] = useState("");
  const [soapA, setSoapA] = useState("");
  const [soapP, setSoapP] = useState("");
  const [showSavedMsg, setShowSavedMsg] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const clients = mounted ? rawClients : [];
  const selectedClient = useMemo(() => {
    return clients.find((c) => c.id === selectedClientId) || clients[0];
  }, [clients, selectedClientId]);

  const filtered = useMemo(() => {
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.primaryDiagnosis.toLowerCase().includes(search.toLowerCase())
    );
  }, [clients, search]);

  const handleCreateSoap = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;

    if (!soapS.trim() || !soapA.trim()) {
      notify.warning("Data SOAP Kurang", "Mohon lengkapi minimal Subjective (S) dan Assessment (A).");
      return;
    }

    saveSoapNote(selectedClient.id, {
      s: soapS.trim(),
      o: soapO.trim() || "Afek stabil, kontak mata baik, speech rate normal.",
      a: soapA.trim(),
      p: soapP.trim() || "Pemantauan berkala dan kelanjutan latihan regulasi diri.",
    });

    notify.success("Catatan SOAP Tersimpan", `Rekam medis klinis untuk ${selectedClient.name} berhasil diperbarui.`);
    setSoapS("");
    setSoapO("");
    setSoapA("");
    setSoapP("");
    setActiveTab("soap");
    setShowSavedMsg(true);
    setTimeout(() => setShowSavedMsg(false), 3500);
  };

  return (
    <div className="space-y-6 sm:space-y-8 font-nunito pb-12 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 dark:text-white tracking-tight">
            Catatan Klinis & Rekam Medis Klien
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Dossier riwayat sesi, rekam perkembangan klinis, dan formulasi SOAP (Subjective, Objective, Assessment, Plan) terenkripsi
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge className="bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800 text-xs py-1.5 px-3 gap-1.5">
            <Lock size={13} className="text-teal-600 dark:text-teal-400" />
            <span>Kerahasiaan Medis Pasal 24 HIMPSI</span>
          </Badge>
        </div>
      </div>

      {showSavedMsg && (
        <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>Catatan SOAP sesi baru berhasil disimpan dan disinkronkan ke rekam medis klien.</span>
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
              className="pl-9 h-10 text-xs bg-white dark:bg-slate-900 rounded-xl border-slate-200 dark:border-slate-800"
            />
          </div>

          <div className="space-y-2.5">
            {filtered.map((client) => {
              const isSelected = selectedClient?.id === client.id;
              return (
                <div
                  key={client.id}
                  onClick={() => setSelectedClientId(client.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2.5 ${
                    isSelected
                      ? "border-teal-500 bg-teal-50/60 dark:bg-teal-950/50 shadow-xs"
                      : "border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-teal-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold font-heading text-sm text-slate-900 dark:text-white">
                          {client.name}
                        </p>
                        <span className="text-[11px] text-slate-400">({client.age} th)</span>
                      </div>
                      <p className="text-[11px] text-teal-700 dark:text-teal-400 font-medium line-clamp-1 mt-0.5">
                        {client.primaryDiagnosis}
                      </p>
                    </div>
                    <Badge
                      className={`text-[10px] font-semibold ${
                        client.status === "Aktif"
                          ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200"
                          : client.status === "Pemulihan"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                    >
                      {client.status}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-nunito pt-1.5 border-t border-slate-100 dark:border-slate-800">
                    <span className="font-semibold text-teal-800 dark:text-teal-300">
                      {client.soapHistory.length} Riwayat Sesi
                    </span>
                    <span>Terakhir: {client.lastSession}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Detailed Clinical Dossier (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {selectedClient ? (
            <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
              <CardHeader className="p-4 sm:p-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="font-heading text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <FileText size={18} className="text-teal-600 dark:text-teal-400" />
                      <span>Rekam Terapi: {selectedClient.name}</span>
                    </CardTitle>
                    <span className="text-xs text-slate-400">({selectedClient.gender || "Klien"})</span>
                  </div>
                  <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
                    Diagnosis: <strong>{selectedClient.primaryDiagnosis}</strong>
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center">
                  <select
                    value={selectedClient.status}
                    onChange={(e) =>
                      updateClientStatus(selectedClient.id, e.target.value as ClientClinicalRecord["status"])
                    }
                    className="text-xs font-semibold py-1 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  >
                    <option value="Aktif">Status: Aktif</option>
                    <option value="Pemulihan">Status: Pemulihan</option>
                    <option value="Selesai">Status: Selesai</option>
                  </select>
                </div>
              </CardHeader>

              <CardContent className="p-4 sm:p-6 space-y-6">
                {/* Target Terapi & Fokus Klinis Strip */}
                {selectedClient.treatmentGoals && selectedClient.treatmentGoals.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 font-heading">
                        <HeartPulse size={14} className="text-teal-600 dark:text-teal-400" />
                        <span>Fokus Intervensi & Sasaran Terapi:</span>
                      </span>
                      <Badge variant="outline" className="text-[10px] bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800">
                        Total {selectedClient.totalSessions} Sesi
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {selectedClient.treatmentGoals.map((goal, idx) => (
                        <span
                          key={idx}
                          className="text-[11px] px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium"
                        >
                          ✓ {goal}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tab Navigation: SOAP History vs Add Note */}
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab("soap")}
                      className={`text-xs font-bold pb-2 -mb-2 border-b-2 cursor-pointer transition-all ${
                        activeTab === "soap"
                          ? "border-teal-600 text-teal-700 dark:text-teal-400"
                          : "border-transparent text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Kronologi Catatan SOAP ({selectedClient.soapHistory.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("add")}
                      className={`text-xs font-bold pb-2 -mb-2 border-b-2 cursor-pointer transition-all ${
                        activeTab === "add"
                          ? "border-teal-600 text-teal-700 dark:text-teal-400"
                          : "border-transparent text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      + Tambah Rekam Sesi Baru
                    </button>
                  </div>
                </div>

                {activeTab === "soap" ? (
                  /* TAB 1: SOAP HISTORY TIMELINE */
                  <div className="space-y-4">
                    {selectedClient.soapHistory.map((entry) => (
                      <div
                        key={entry.id}
                        className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-3 shadow-2xs"
                      >
                        <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200/60 dark:border-slate-700/60">
                          <span className="font-bold font-heading text-teal-900 dark:text-teal-200">
                            Sesi {entry.sessionNumber} • {entry.date}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">Terenkripsi</span>
                        </div>

                        <div className="space-y-2 text-xs font-nunito">
                          <div>
                            <span className="text-[11px] font-bold text-teal-800 dark:text-teal-300 block uppercase tracking-wider">
                              S (Subjective) - Keluhan Klien:
                            </span>
                            <p className="text-slate-700 dark:text-slate-300 mt-0.5 leading-relaxed">
                              {entry.s}
                            </p>
                          </div>

                          <div>
                            <span className="text-[11px] font-bold text-teal-800 dark:text-teal-300 block uppercase tracking-wider">
                              O (Objective) - Observasi Klinis:
                            </span>
                            <p className="text-slate-700 dark:text-slate-300 mt-0.5 leading-relaxed">
                              {entry.o}
                            </p>
                          </div>

                          <div>
                            <span className="text-[11px] font-bold text-teal-800 dark:text-teal-300 block uppercase tracking-wider">
                              A (Assessment) - Evaluasi Klinis CBT:
                            </span>
                            <p className="text-slate-700 dark:text-slate-300 mt-0.5 leading-relaxed font-semibold">
                              {entry.a}
                            </p>
                          </div>

                          <div className="p-2.5 rounded-xl bg-teal-50/70 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800">
                            <span className="text-[11px] font-bold text-teal-900 dark:text-teal-200 block uppercase tracking-wider">
                              P (Plan) - Rencana Terapi & Tugas Mandiri Pasien:
                            </span>
                            <p className="text-slate-800 dark:text-slate-200 mt-0.5 whitespace-pre-line leading-relaxed">
                              {entry.p}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* TAB 2: ADD NEW SOAP ENTRY FORM */
                  <form onSubmit={handleCreateSoap} className="space-y-3.5">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-teal-800 dark:text-teal-300 block">
                        S (Subjective) - Apa yang dikeluhkan/diungkapkan klien hari ini?
                      </label>
                      <textarea
                        rows={2}
                        required
                        value={soapS}
                        onChange={(e) => setSoapS(e.target.value)}
                        placeholder="Contoh: Klien melaporkan rasa cemas berkurang, namun masih ada hambatan saat berbicara dengan atasan..."
                        className="w-full text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-teal-500 font-nunito"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-teal-800 dark:text-teal-300 block">
                        O (Objective) - Observasi perilaku, afek, dan kontak mata selama telekonseling
                      </label>
                      <textarea
                        rows={2}
                        value={soapO}
                        onChange={(e) => setSoapO(e.target.value)}
                        placeholder="Contoh: Kontak mata konsisten, artikulasi lancar, tampak lebih rileks dibanding sesi sebelumnya..."
                        className="w-full text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-teal-500 font-nunito"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-teal-800 dark:text-teal-300 block">
                        A (Assessment) - Formulasi dinamika emosi / evaluasi diagnosis kerja
                      </label>
                      <textarea
                        rows={2}
                        required
                        value={soapA}
                        onChange={(e) => setSoapA(e.target.value)}
                        placeholder="Contoh: Progres positif regulasi ansietas. Pasien mulai mampu mengidentifikasi cognitive distortions..."
                        className="w-full text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-teal-500 font-nunito"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-teal-800 dark:text-teal-300 block">
                        P (Plan) - Rencana intervensi & PR tugas mandiri (Tampil di jadwal pasien)
                      </label>
                      <textarea
                        rows={3}
                        required
                        value={soapP}
                        onChange={(e) => setSoapP(e.target.value)}
                        placeholder="Contoh: 1. Praktik teknik pernapasan diafragma harian 5 menit.\n2. Catat 1 peristiwa pemicu overthinking di jurnal emosi."
                        className="w-full text-xs p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-teal-500 font-nunito"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setActiveTab("soap")}
                        className="text-xs h-9 rounded-xl px-4 cursor-pointer"
                      >
                        Batal
                      </Button>
                      <Button
                        type="submit"
                        className="text-xs h-9 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl px-4 cursor-pointer gap-1.5 shadow-xs"
                      >
                        <Save size={13} />
                        <span>Simpan ke Rekam Medis</span>
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="p-8 text-center text-xs text-slate-400">Pilih klien untuk melihat berkas rekam medis.</div>
          )}
        </div>
      </div>
    </div>
  );
}
