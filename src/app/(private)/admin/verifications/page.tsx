"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileCheck2,
  CheckCircle2,
  XCircle,
  Eye,
  ShieldCheck,
  Search,
  Building2,
  Calendar,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { MdVerified } from "react-icons/md";

interface VerificationItem {
  id: string;
  applicantName: string;
  roleType: "Psikolog Klinis" | "Pendengar Sebaya";
  credentialNumber: string;
  institution: string;
  submissionDate: string;
  documentName: string;
  status: "pending" | "approved" | "rejected";
}

const initialVerifications: VerificationItem[] = [
  {
    id: "ver-1",
    applicantName: "Dr. Dimas Prasetyo, M.Psi",
    roleType: "Psikolog Klinis",
    credentialNumber: "SIPPK: 202104-1082-03",
    institution: "Magister Profesi Psikologi - Universitas Indonesia",
    submissionDate: "9 Okt 2026",
    documentName: "SIPPK_DimasPrasetyo_2026.pdf",
    status: "pending",
  },
  {
    id: "ver-2",
    applicantName: "Fitri Handayani, S.Psi, M.Psi",
    roleType: "Psikolog Klinis",
    credentialNumber: "SIPPK: 201908-0914-02",
    institution: "Universitas Gadjah Mada • Anggota HIMPSI",
    submissionDate: "8 Okt 2026",
    documentName: "STR_Kemenkes_FitriH.pdf",
    status: "pending",
  },
  {
    id: "ver-3",
    applicantName: "Rendra Kurniawan, M.Psi",
    roleType: "Psikolog Klinis",
    credentialNumber: "SIPPK: 202301-1402-05",
    institution: "Universitas Padjadjaran",
    submissionDate: "7 Okt 2026",
    documentName: "SIPPK_RendraK_UNPAD.pdf",
    status: "pending",
  },
  {
    id: "ver-4",
    applicantName: "Dr. Sarah Alatas, M.Psi",
    roleType: "Psikolog Klinis",
    credentialNumber: "SIPPK: 198402-2019-01",
    institution: "Universitas Indonesia • HIMPSI Pusat",
    submissionDate: "1 Okt 2026",
    documentName: "SIPPK_SarahAlatas_Resmi.pdf",
    status: "approved",
  },
  {
    id: "ver-5",
    applicantName: "Dewi Lestari",
    roleType: "Pendengar Sebaya",
    credentialNumber: "Sertifikat PFA: WHO-ID-2024-819",
    institution: "Pelatihan Psychological First Aid WHO & Kemkes",
    submissionDate: "30 Sep 2026",
    documentName: "Sertifikat_PFA_Dewi.pdf",
    status: "approved",
  },
];

export default function AdminVerificationsPage() {
  const [items, setItems] = useState<VerificationItem[]>(initialVerifications);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [search, setSearch] = useState("");
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const handleAction = (id: string, action: "approved" | "rejected", name: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: action } : item))
    );
    setActionNotice(
      action === "approved"
        ? `Lisensi SIPPK untuk ${name} berhasil disetujui. Praktisi kini dapat membuka sesi konseling.`
        : `Permohonan verifikasi untuk ${name} ditolak. Email klarifikasi dikirim.`
    );
    setTimeout(() => setActionNotice(null), 3500);
  };

  const filtered = items.filter((item) => {
    const matchFilter = filter === "all" || item.status === filter;
    const matchSearch =
      item.applicantName.toLowerCase().includes(search.toLowerCase()) ||
      item.credentialNumber.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  return (
    <div className="space-y-6 sm:space-y-8 font-nunito pb-12 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* 1. Header */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 dark:text-white tracking-tight">
          Verifikasi Kredensial & Lisensi SIPPK
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Validasi keabsahan dokumen izin praktik klinis dan sertifikat pelatihan pendengar sebaya
        </p>
      </div>

      {actionNotice && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* 2. Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { key: "all", label: "Semua Permohonan" },
            { key: "pending", label: "Menunggu Tinjauan" },
            { key: "approved", label: "Disetujui" },
            { key: "rejected", label: "Ditolak" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                filter === tab.key
                  ? "bg-teal-600 text-white shadow-2xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            placeholder="Cari nama / nomor SIPPK..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"
          />
        </div>
      </div>

      {/* 3. Verification Items Table / Cards */}
      <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
        <CardContent className="p-0 sm:p-2">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 text-slate-600 dark:text-slate-400 font-semibold">
                  <th className="p-3.5 pl-4">Praktisi / Pemohon</th>
                  <th className="p-3.5">Peran</th>
                  <th className="p-3.5">No. Lisensi / Institusi</th>
                  <th className="p-3.5">Dokumen Pendukung</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 pr-4 text-center">Aksi Tinjauan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="p-3.5 pl-4">
                      <p className="font-bold font-heading text-slate-900 dark:text-white text-xs sm:text-sm">
                        {item.applicantName}
                      </p>
                      <span className="text-[10px] text-slate-400 font-nunito">Diajukan: {item.submissionDate}</span>
                    </td>

                    <td className="p-3.5">
                      <span className="font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950 px-2 py-0.5 rounded border border-teal-200 text-[11px]">
                        {item.roleType}
                      </span>
                    </td>

                    <td className="p-3.5">
                      <p className="font-mono font-semibold text-slate-800 dark:text-slate-200 text-xs">
                        {item.credentialNumber}
                      </p>
                      <p className="text-[11px] text-slate-500 font-nunito">{item.institution}</p>
                    </td>

                    <td className="p-3.5">
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-700 dark:text-slate-300 font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                        <FileCheck2 size={13} className="text-teal-600" />
                        {item.documentName}
                      </span>
                    </td>

                    <td className="p-3.5">
                      <Badge
                        className={`text-[10px] ${
                          item.status === "approved"
                            ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-200"
                            : item.status === "rejected"
                            ? "bg-rose-50 text-rose-800 border-rose-200"
                            : "bg-amber-50 text-amber-800 border-amber-200"
                        }`}
                      >
                        {item.status === "approved"
                          ? "Disetujui"
                          : item.status === "rejected"
                          ? "Ditolak"
                          : "Menunggu"}
                      </Badge>
                    </td>

                    <td className="p-3.5 pr-4 text-center">
                      {item.status === "pending" ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            size="sm"
                            onClick={() => handleAction(item.id, "approved", item.applicantName)}
                            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-2.5 font-semibold gap-1 cursor-pointer"
                          >
                            <CheckCircle2 size={13} />
                            Setujui
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAction(item.id, "rejected", item.applicantName)}
                            className="h-7 text-xs border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg px-2.5 font-semibold gap-1 cursor-pointer"
                          >
                            <XCircle size={13} />
                            Tolak
                          </Button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-nunito">Tindakan Selesai</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
