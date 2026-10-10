"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  HeartPulse,
  Phone,
  PhoneCall,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Clock,
  UserCheck,
  UserX,
  Search,
  MessageSquare,
  ArrowRight,
  ExternalLink,
  Users,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { useCrisisStore, CrisisReport, CrisisSeverity, CrisisStatus } from "@/store/crisis-store";

export default function AdminCrisisFeedPage() {
  const reports = useCrisisStore((state) => state.reports);
  const assignToPsychologist = useCrisisStore((state) => state.assignToPsychologist);
  const escalateToHotline119 = useCrisisStore((state) => state.escalateToHotline119);
  const resolveReport = useCrisisStore((state) => state.resolveReport);

  const [filterSeverity, setFilterSeverity] = useState<"all" | "open" | "in_progress" | "resolved">("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Modal Resolve Dialog
  const [reportToResolve, setReportToResolve] = useState<CrisisReport | null>(null);
  const [resolutionNoteText, setResolutionNoteText] = useState("");

  // Modal Assign Psychologist Dialog
  const [reportToAssign, setReportToAssign] = useState<CrisisReport | null>(null);
  const [selectedPsychologist, setSelectedPsychologist] = useState("Dr. Sarah Alatas, M.Psi");

  // Success Notification banner
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  const availablePsychologists = [
    "Dr. Sarah Alatas, M.Psi (CBT & Krisis Akut)",
    "Dr. Anita Wijaya, M.Psi (Trauma & Depresi Mayor)",
    "Rendra Kurniawan, M.Psi (Intervensi Remaja)",
  ];

  const filteredReports = reports.filter((r) => {
    const matchFilter =
      filterSeverity === "all" ||
      (filterSeverity === "open" && r.status === "open") ||
      (filterSeverity === "in_progress" && r.status === "in_progress") ||
      (filterSeverity === "resolved" && r.status === "resolved");

    const matchSearch =
      r.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.patientAlias.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.triggerExcerpt.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.patientId.toLowerCase().includes(searchTerm.toLowerCase());

    return matchFilter && matchSearch;
  });

  const countOpen = reports.filter((r) => r.status === "open").length;
  const countInProgress = reports.filter((r) => r.status === "in_progress").length;
  const countResolved = reports.filter((r) => r.status === "resolved").length;

  const handleConfirmAssign = () => {
    if (!reportToAssign) return;
    const psychName = selectedPsychologist.split(" (")[0];
    assignToPsychologist(reportToAssign.id, psychName);
    setBannerNotice(`Kasus #${reportToAssign.id} berhasil ditugaskan ke ${psychName}.`);
    setReportToAssign(null);
    setTimeout(() => setBannerNotice(null), 4000);
  };

  const handleConfirmResolve = () => {
    if (!reportToResolve) return;
    const notes = resolutionNoteText.trim() || "Kasus krisis tertangani. Pasien telah terhubung dengan tim dukungan medis.";
    resolveReport(reportToResolve.id, notes);
    setBannerNotice(`Kasus #${reportToResolve.id} ditandai sebagai stabil dan selesai ditangani.`);
    setReportToResolve(null);
    setResolutionNoteText("");
    setTimeout(() => setBannerNotice(null), 4000);
  };

  const handleDirectEscalate119 = (reportId: string) => {
    escalateToHotline119(reportId);
    setBannerNotice(`Rujukan darurat kasus #${reportId} telah dikirimkan ke Hotline Kemenkes SEJIWA 119.`);
    setTimeout(() => setBannerNotice(null), 4000);
  };

  return (
    <div className="space-y-6 sm:space-y-8 font-nunito pb-12 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* 1. Header Hero Crisis Command Center */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-950 via-slate-950 to-teal-950 text-white p-6 sm:p-8 md:p-10 shadow-lg border border-rose-900/60 dark:border-rose-900/40">
        <div className="absolute top-0 right-10 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 left-10 w-60 h-60 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 md:gap-8">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-900/60 border border-rose-700/60 text-rose-200 text-xs font-semibold backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
              <span>Pusat Intervensi Keselamatan Jiwa (SLA &lt; 15 Mnt)</span>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold font-heading text-white tracking-tight leading-snug flex items-center gap-3">
              <HeartPulse size={34} className="text-rose-500 shrink-0" />
              <span>Feed Eskalasi Krisis Platform</span>
            </h1>

            <p className="text-sm sm:text-base text-rose-100/80 leading-relaxed max-w-xl">
              Memantau peringatan darurat red-flags dari ruang curhat dan telekonseling. Segera hubungi kontak darurat keluarga atau rujuk ke Hotline SEJIWA 119 ext. 8.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a
                href="tel:119"
                className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl px-4 py-2.5 text-xs shadow-md shadow-rose-600/30 transition-colors"
              >
                <PhoneCall size={15} />
                <span>Hotline Nasional SEJIWA 119 (Bebas Pulsa)</span>
              </a>
              <div className="text-xs text-rose-300 font-medium">
                Peringatan Aktif: <strong className="text-white">{countOpen} Kasus Terbuka</strong>
              </div>
            </div>
          </div>

          {/* Quick SLA Assurance Badge */}
          <div className="rounded-2xl bg-rose-950/50 border border-rose-800/60 p-4 sm:p-5 backdrop-blur-md max-w-xs space-y-2.5 shrink-0">
            <div className="flex items-center gap-2 text-rose-300 font-bold text-xs">
              <ShieldAlert size={16} />
              <span>Protokol Eskalasi HIMPSI & Kemenkes</span>
            </div>
            <p className="text-xs text-rose-100/70 leading-relaxed font-nunito">
              Setiap pasien yang mendaftar telah menyetujui otorisasi kontak darurat saat krisis untuk penyelamatan jiwa.
            </p>
            <div className="pt-2 border-t border-rose-900/80 flex items-center justify-between text-[11px] text-rose-300 font-mono">
              <span>SLA Target: 100% Tanggap</span>
              <span className="text-emerald-400 font-bold">Siaga 24 Jam</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notice Banner */}
      {bannerNotice && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 size={17} className="text-emerald-600 shrink-0" />
          <span>{bannerNotice}</span>
        </div>
      )}

      {/* 2. Metric KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Total Alarm Krisis</span>
            <span className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              <ShieldAlert size={14} />
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-heading text-slate-900 dark:text-white">
            {reports.length} <span className="text-xs font-semibold text-slate-500">Insiden</span>
          </p>
          <span className="text-[10px] text-slate-400 block font-nunito">Riwayat bulan ini</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-rose-600 dark:text-rose-400">
            <span>Butuh Tindakan Segera</span>
            <span className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400">
              <AlertTriangle size={14} />
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-heading text-rose-600 dark:text-rose-400">
            {countOpen} <span className="text-xs font-semibold">Kasus Terbuka</span>
          </p>
          <span className="text-[10px] text-rose-500 block font-nunito font-semibold animate-pulse">
            Perlu intervensi &lt; 15 menit
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-amber-600 dark:text-amber-400">
            <span>Sedang Ditangani</span>
            <span className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
              <Clock size={14} />
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-heading text-amber-600 dark:text-amber-400">
            {countInProgress} <span className="text-xs font-semibold">Proses Intervensi</span>
          </p>
          <span className="text-[10px] text-slate-400 block font-nunito">Didampingi psikolog klinis</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400">
            <span>Selesai &amp; Stabil</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={14} />
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-heading text-emerald-600 dark:text-emerald-400">
            {countResolved} <span className="text-xs font-semibold">Terselesaikan</span>
          </p>
          <span className="text-[10px] text-emerald-500 block font-nunito font-semibold">Kondisi terkendali</span>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            type="text"
            placeholder="Cari nama pasien, alias, kata kunci..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {[
            { key: "all", label: `Semua (${reports.length})` },
            { key: "open", label: `Terbuka (${countOpen})` },
            { key: "in_progress", label: `Ditangani (${countInProgress})` },
            { key: "resolved", label: `Selesai (${countResolved})` },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilterSeverity(tab.key as any)}
              className={`text-xs px-3 py-2 rounded-xl font-bold transition-all whitespace-nowrap cursor-pointer ${
                filterSeverity === tab.key
                  ? "bg-rose-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Crisis Feed List */}
      <div className="space-y-4">
        {filteredReports.map((item) => (
          <Card
            key={item.id}
            className={`rounded-3xl border transition-all shadow-xs overflow-hidden ${
              item.status === "open"
                ? "border-rose-300 dark:border-rose-900/80 bg-rose-50/20 dark:bg-rose-950/20"
                : item.status === "in_progress"
                ? "border-amber-300 dark:border-amber-900/80 bg-amber-50/15 dark:bg-amber-950/15"
                : "border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 opacity-90"
            }`}
          >
            <CardHeader className="p-5 pb-3 border-b border-slate-100 dark:border-slate-800/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Badge
                    className={`text-[11px] font-bold px-2.5 py-0.5 border ${
                      item.severity === "critical"
                        ? "bg-rose-600 text-white border-rose-600"
                        : item.severity === "high"
                        ? "bg-amber-500 text-white border-amber-500"
                        : "bg-teal-600 text-white border-teal-600"
                    }`}
                  >
                    {item.severity === "critical"
                      ? "🔴 KRITIS - Ancaman Bahaya Nyata"
                      : item.severity === "high"
                      ? "🟠 TINGGI - Krisis Emosional Berat"
                      : "🟡 SEDANG - Peringatan Dini"}
                  </Badge>

                  <Badge variant="outline" className="text-[10px] font-mono text-slate-500">
                    Sumber: {item.source === "curhat_sebaya" ? "Curhat Sebaya" : item.source === "chat_psikolog" ? "Ruang Chat" : "Deteksi Otomatis AI"}
                  </Badge>

                  <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                    <Clock size={12} /> {item.reportedAt}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                      item.status === "open"
                        ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                        : item.status === "in_progress"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    }`}
                  >
                    {item.status === "open"
                      ? "Menunggu Tindakan"
                      : item.status === "in_progress"
                      ? `Ditangani (${item.assignedTo || "Psikolog Siaga"})`
                      : "Selesai & Stabil"}
                  </span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-5 space-y-4">
              {/* Trigger Excerpt Box */}
              <div className="p-3.5 rounded-2xl bg-rose-100/60 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 space-y-1">
                <p className="text-[11px] font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle size={13} />
                  Cuplikan Pemicu Alarm Krisis:
                </p>
                <p className="text-xs sm:text-sm font-semibold text-rose-950 dark:text-rose-100 leading-relaxed italic">
                  &ldquo;{item.triggerExcerpt}&rdquo;
                </p>
              </div>

              {/* Patient and Emergency Contact Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                {/* Data Pasien */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-250 dark:border-slate-800 space-y-1.5 text-xs">
                  <p className="font-bold text-slate-900 dark:text-white font-heading flex items-center gap-1.5">
                    <Users size={14} className="text-teal-600 dark:text-teal-400" />
                    Identitas Pasien Terdaftar
                  </p>
                  <p className="text-slate-700 dark:text-slate-300 font-semibold">
                    {item.patientName}{" "}
                    <span className="text-[11px] text-teal-700 dark:text-teal-400 font-normal">
                      (Alias: &ldquo;{item.patientAlias}&rdquo;)
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono">
                    ID: {item.patientId} • Email: {item.patientEmail}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono">
                    WhatsApp Pasien: {item.patientPhone}
                  </p>
                </div>

                {/* Data Kontak Darurat Medis */}
                <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-amber-900 dark:text-amber-300 font-heading flex items-center gap-1.5">
                      <HeartPulse size={14} className="text-rose-600" />
                      Kontak Darurat (Wali / Keluarga)
                    </p>
                    <Badge className="bg-amber-200/70 text-amber-900 text-[10px] font-mono">
                      Otorisasi Aktif
                    </Badge>
                  </div>

                  <p className="text-amber-950 dark:text-amber-200 font-bold">
                    {item.emergencyContactName}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <a
                      href={`https://wa.me/${item.emergencyContactPhone.replace(/[^0-9]/g, "")}?text=Halo%20kami%20dari%20Layanan%20TemanBicara%20mengenai%20kondisi%20krisis%20kerabat%20Anda`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                    >
                      <Phone size={12} />
                      <span>Hubungi Darurat ({item.emergencyContactPhone})</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* Status and Action Buttons */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-500 font-nunito">
                  {item.resolutionNotes ? (
                    <span className="text-slate-700 dark:text-slate-300">
                      <strong>Catatan Penanganan:</strong> {item.resolutionNotes}
                    </span>
                  ) : (
                    <span className="text-amber-700 dark:text-amber-400 font-medium">
                      ⚠️ Membutuhkan konfirmasi tindakan penanganan segera.
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {item.status !== "resolved" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDirectEscalate119(item.id)}
                        className={`text-xs rounded-xl h-8 px-3 font-semibold gap-1.5 cursor-pointer ${
                          item.escalatedTo119
                            ? "border-emerald-300 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950"
                            : "border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 hover:bg-rose-50"
                        }`}
                      >
                        <PhoneCall size={13} />
                        <span>{item.escalatedTo119 ? "Sudah Dirujuk ke 119" : "Rujuk ke SEJIWA 119"}</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setReportToAssign(item)}
                        className="text-xs rounded-xl h-8 px-3 font-semibold gap-1.5 border-teal-300 dark:border-teal-800 text-teal-800 dark:text-teal-300 hover:bg-teal-50 cursor-pointer"
                      >
                        <Stethoscope size={13} />
                        <span>{item.assignedTo ? "Ganti Psikolog" : "Tugaskan Psikolog Siaga"}</span>
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => setReportToResolve(item)}
                        className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-8 px-4 font-bold cursor-pointer gap-1.5 shadow-xs"
                      >
                        <CheckCircle2 size={14} />
                        <span>Tandai Selesai &amp; Stabil</span>
                      </Button>
                    </>
                  )}

                  {item.status === "resolved" && (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs py-1 px-3">
                      ✓ Kasus Berhasil Tertangani
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredReports.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-2">
            <ShieldCheck size={36} className="mx-auto text-emerald-500" />
            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 font-heading">
              Tidak Ada Laporan Krisis yang Sesuai
            </h4>
            <p className="text-xs text-slate-500 font-nunito">
              Semua saluran dalam kondisi aman dan terkendali.
            </p>
          </div>
        )}
      </div>

      {/* MODAL 1: TUGASKAN PSIKOLOG SIAGA */}
      <Dialog open={!!reportToAssign} onOpenChange={() => setReportToAssign(null)}>
        <DialogContent className="max-w-md font-nunito p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
          <DialogHeader className="space-y-1 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Stethoscope size={18} className="text-teal-600 dark:text-teal-400" />
              <DialogTitle className="text-base font-bold font-heading text-slate-900 dark:text-white">
                Tugaskan Psikolog Siaga Kasus Krisis
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500">
              Pilih psikolog berlisensi yang bertugas di shift ini untuk menangani pasien #{reportToAssign?.id}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              Pilih Praktisi Klinis Tersedia:
            </label>
            <div className="space-y-2">
              {availablePsychologists.map((psych) => (
                <button
                  key={psych}
                  type="button"
                  onClick={() => setSelectedPsychologist(psych)}
                  className={`w-full p-3 rounded-xl border text-xs text-left transition-all cursor-pointer font-medium ${
                    selectedPsychologist === psych
                      ? "border-teal-600 bg-teal-50 dark:bg-teal-950/70 text-teal-900 dark:text-teal-200 font-bold"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50/40 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {psych}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setReportToAssign(null)}
              className="text-xs rounded-xl"
            >
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmAssign}
              className="text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-xl px-4 font-bold"
            >
              Tugaskan Sekarang
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: RESOLVE REPORT WITH NOTES */}
      <Dialog open={!!reportToResolve} onOpenChange={() => setReportToResolve(null)}>
        <DialogContent className="max-w-md font-nunito p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
          <DialogHeader className="space-y-1 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-600" />
              <DialogTitle className="text-base font-bold font-heading text-slate-900 dark:text-white">
                Selesaikan Laporan Krisis #{reportToResolve?.id}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500">
              Catat riwayat intervensi yang telah dilakukan untuk kepatuhan audit medis platform.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 pt-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              Catatan Tindak Lanjut &amp; Status Akhir Pasien:
            </label>
            <textarea
              rows={3}
              placeholder="Contoh: Pasien telah dihubungi via telepon, didampingi keluarga terdekat, dan dijadwalkan sesi terapi tatap muka..."
              value={resolutionNoteText}
              onChange={(e) => setResolutionNoteText(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-900 dark:text-slate-100 focus:outline-teal-600"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setReportToResolve(null)}
              className="text-xs rounded-xl"
            >
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmResolve}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-4 font-bold"
            >
              Simpan &amp; Tandai Selesai
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
