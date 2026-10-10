"use client";

import React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  ShieldCheck,
  FileCheck2,
  Coins,
  History,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Server,
  Lock,
  Sparkles,
} from "lucide-react";

import { usePayoutStore } from "@/store/payout-store";
import { useVerificationStore } from "@/store/verification-store";

export default function AdminBerandaPage() {
  const payouts = usePayoutStore((state) => state.payouts);
  const pendingPayouts = React.useMemo(
    () => payouts.filter((p) => p.status === "Diproses"),
    [payouts]
  );

  const verifications = useVerificationStore((state) => state.verifications);
  const pendingVerifications = React.useMemo(
    () => verifications.filter((v) => v.status === "pending"),
    [verifications]
  );

  return (
    <div className="space-y-6 sm:space-y-8 font-nunito pb-12 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* 1. Header Hero Admin */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-900 via-teal-950 to-slate-950 text-white p-6 sm:p-8 md:p-10 shadow-lg border border-teal-800/60 dark:border-teal-900/40">
        <div className="absolute top-0 right-10 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 left-10 w-60 h-60 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 md:gap-8">
          <div className="space-y-3.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-800/60 border border-teal-700/60 text-teal-200 text-xs font-semibold backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Sistem Pengawasan & Administrasi TemanBicara</span>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold font-heading text-white tracking-tight leading-snug">
              Pusat Kendali Platform
            </h1>

            <p className="text-sm sm:text-base text-teal-100/80 leading-relaxed max-w-xl">
              Memantau integritas operasional, keabsahan lisensi SIPPK psikolog klinis, perputaran koin transaksi, dan kepatuhan standar medis.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link href="/admin/verifications">
                <Button className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl px-5 py-5 text-sm cursor-pointer shadow-md shadow-emerald-500/20 gap-2">
                  <FileCheck2 size={17} />
                  Verifikasi Lisensi ({pendingVerifications.length} Baru)
                </Button>
              </Link>
              <Link href="/admin/transactions">
                <Button variant="outline" className="border-teal-700/80 bg-teal-900/50 hover:bg-teal-800/60 text-teal-100 font-semibold rounded-xl px-5 py-5 text-sm cursor-pointer gap-2">
                  <Coins size={17} />
                  <span>Audit Transaksi Koin</span>
                  {pendingPayouts.length > 0 && (
                    <span className="ml-1 px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-xs font-bold animate-pulse">
                      {pendingPayouts.length} Payout Menunggu
                    </span>
                  )}
                </Button>
              </Link>
            </div>
          </div>

          {/* System Health Assurance */}
          <div className="rounded-2xl bg-teal-900/40 border border-teal-700/50 p-4 sm:p-5 backdrop-blur-md max-w-xs space-y-3 shrink-0">
            <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
              <Server size={16} />
              <span>Infrastruktur Layanan: 99.98% Uptime</span>
            </div>
            <p className="text-xs text-teal-100/70 leading-relaxed font-nunito">
              Semua saluran percakapan dienkripsi end-to-end dengan standar privasi HIPAA & perlindungan data klinis.
            </p>
            <div className="pt-2 border-t border-teal-800/80 flex items-center justify-between text-[11px] text-teal-300">
              <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                <Lock size={12} /> AES-256 Aktif
              </span>
              <span>Versi 2.4.0</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Platform KPIs (4 Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Total Pengguna</span>
            <span className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-400">
              <Users size={15} />
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-heading text-teal-900 dark:text-teal-300">
            1,420 <span className="text-xs font-semibold text-teal-600">Akun</span>
          </p>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-nunito font-semibold">
            +18% pendaftaran baru bln ini
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Psikolog SIPPK Aktif</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400">
              <ShieldCheck size={15} />
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-heading text-emerald-700 dark:text-emerald-400">
            28 <span className="text-xs font-semibold">Praktisi</span>
          </p>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-nunito">
            Terverifikasi resmi HIMPSI
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Relawan Pendengar</span>
            <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-400">
              <Users size={15} />
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-heading text-indigo-700 dark:text-indigo-400">
            45 <span className="text-xs font-semibold">Relawan</span>
          </p>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-nunito">
            Lulus pelatihan PFA WHO
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Perputaran Koin Platform</span>
            <span className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400">
              <Coins size={15} />
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-heading text-amber-700 dark:text-amber-400">
            48,500 <span className="text-xs font-semibold">Koin</span>
          </p>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-nunito font-semibold">
            ≈ Rp 485.000.000 Volume
          </span>
        </div>
      </div>

      {/* 3. Section: Pending Verifications & Activity Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
        {/* Left: Pending Verifications (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="font-heading text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileCheck2 size={18} className="text-teal-600 dark:text-teal-400" />
                    Menunggu Verifikasi Lisensi Psikolog
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 font-nunito">
                    Permintaan pendaftaran psikolog baru yang memerlukan pemeriksaan nomor SIPPK
                  </CardDescription>
                </div>
                <Link href="/admin/verifications">
                  <Button variant="ghost" size="sm" className="text-xs text-teal-700 dark:text-teal-400 font-semibold gap-1">
                    Semua <ArrowRight size={13} />
                  </Button>
                </Link>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-6 space-y-3">
              {pendingVerifications.length === 0 ? (
                <div className="text-center py-6 text-slate-500 dark:text-slate-400 space-y-1">
                  <CheckCircle2 size={24} className="mx-auto text-emerald-500 mb-1" />
                  <p className="text-xs font-semibold">Semua Permohonan Telah Ditinjau</p>
                  <p className="text-[11px]">Tidak ada berkas kredensial yang menunggu tindakan.</p>
                </div>
              ) : (
                pendingVerifications.slice(0, 4).map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-bold text-slate-900 dark:text-white font-heading truncate">
                        {item.applicantName}
                      </p>
                      <p className="text-[11px] text-teal-700 dark:text-teal-400 font-mono truncate">
                        {item.credentialNumber} • {item.institution}
                      </p>
                    </div>
                    <Link href="/admin/verifications" className="shrink-0">
                      <Button size="sm" className="text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-lg h-7 px-3 font-semibold">
                        Tinjau
                      </Button>
                    </Link>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Security & Moderation Log (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardHeader className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="font-heading text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <History size={16} className="text-teal-600 dark:text-teal-400" />
                Audit Log Sistem Terbaru
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 space-y-3 text-xs font-nunito">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 space-y-0.5">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Payout Honor Diproses</span>
                  <span>10 mnt lalu</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400">Transfer Rp 5.000.000 ke Dr. Sarah Alatas (BCA).</p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 space-y-0.5">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Top Up Koin Pasien</span>
                  <span>24 mnt lalu</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400">Pasien #TB-88912 membeli Paket 100 Koin via QRIS.</p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 space-y-0.5">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Cadangan Database Harian</span>
                  <span>03:00 WIB</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400">Enkripsi cadangan otomatis berhasil (AES-256).</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
