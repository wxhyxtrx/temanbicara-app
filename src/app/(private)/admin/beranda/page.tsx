"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  FileCheck2,
  Coins,
  ArrowRight,
  TrendingUp,
  Server,
  Lock,
  Wallet,
  RefreshCw,
  AlertCircle,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { userService } from "@/services/user.service";
import type { AdminDashboardStatsData } from "@/types/user-profile";

const REASON_LABELS: Record<string, string> = {
  session_platform_fee: "Bagi Hasil Sesi Konsultasi",
  session_fee: "Biaya Layanan Sesi",
  payout_admin_fee: "Biaya Admin Penarikan (Payout)",
  payout_fee: "Biaya Penarikan (Payout)",
  tip_platform_share: "Porsi Tip Platform",
  cancellation_fee: "Biaya Pembatalan Sesi",
};

function formatReason(key: string): string {
  if (REASON_LABELS[key]) return REASON_LABELS[key];
  return key
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function AdminBerandaPage() {
  const [stats, setStats] = useState<AdminDashboardStatsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await userService.getAdminStats();
      if (res.success && res.data) {
        setStats(res.data);
      } else {
        setError("Gagal memuat statistik platform");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memuat data statistik";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const pendingMitra = stats?.mitra_verification.pending_count ?? 0;
  const pendingPayout = stats?.payout.requested_count ?? 0;

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
              Memantau metrik real-time platform: pertumbuhan pengguna terdaftar, verifikasi lisensi mitra, perputaran koin top-up, antrean payout, dan pendapatan platform.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link href="/admin/users?tab=verifications">
                <Button className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl px-5 py-5 text-sm cursor-pointer shadow-md shadow-emerald-500/20 gap-2">
                  <FileCheck2 size={17} />
                  <span>Verifikasi Mitra</span>
                  {loading ? (
                    <span className="ml-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-xs font-semibold">...</span>
                  ) : pendingMitra > 0 ? (
                    <span className="ml-1 px-2 py-0.5 rounded-full bg-slate-950 text-emerald-300 text-xs font-bold animate-pulse">
                      {pendingMitra} Baru
                    </span>
                  ) : null}
                </Button>
              </Link>

              <Link href="/admin/transactions">
                <Button variant="outline" className="border-teal-700/80 bg-teal-900/50 hover:bg-teal-800/60 text-teal-100 font-semibold rounded-xl px-4 py-5 text-sm cursor-pointer gap-2">
                  <Wallet size={17} />
                  <span>Antrean Payout</span>
                  {loading ? (
                    <span className="ml-1 px-2 py-0.5 rounded-full bg-teal-800 text-teal-200 text-xs">...</span>
                  ) : pendingPayout > 0 ? (
                    <span className="ml-1 px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-xs font-bold animate-pulse">
                      {pendingPayout} Menunggu
                    </span>
                  ) : null}
                </Button>
              </Link>

              <Button
                variant="outline"
                onClick={fetchStats}
                disabled={loading}
                className="border-teal-700/80 bg-teal-900/30 hover:bg-teal-800/50 text-teal-200 font-semibold rounded-xl px-4 py-5 text-sm cursor-pointer gap-2"
              >
                <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                <span>Segarkan Data</span>
              </Button>
            </div>
          </div>

          {/* System Health Assurance */}
          <div className="rounded-2xl bg-teal-900/40 border border-teal-700/50 p-4 sm:p-5 backdrop-blur-md max-w-xs space-y-3 shrink-0">
            <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
              <Server size={16} />
              <span>Infrastruktur Layanan Aktif</span>
            </div>
            <p className="text-xs text-teal-100/70 leading-relaxed font-nunito">
              Semua saluran percakapan dan basis data terenkripsi dengan standar perlindungan data klinis & ledger akuntansi terpusat.
            </p>
            <div className="pt-2 border-t border-teal-800/80 flex items-center justify-between text-[11px] text-teal-300">
              <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                <Lock size={12} /> RPC PostgreSQL Aktif
              </span>
              <span>Versi 2.5.0</span>
            </div>
          </div>
        </div>
      </div>

      {/* Error Banner jika gagal fetch */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold">
            <AlertCircle size={18} className="text-rose-600 shrink-0" />
            <span>Gagal memuat statistik platform: {error}</span>
          </div>
          <Button
            size="sm"
            onClick={fetchStats}
            className="h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white rounded-lg gap-1.5 self-start sm:self-auto cursor-pointer font-bold shadow-xs"
          >
            <RefreshCw size={13} />
            <span>Muat Ulang</span>
          </Button>
        </div>
      )}

      {/* 2. Top Metric Cards (3 Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Total Pengguna */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold">Total Pengguna Terdaftar</span>
            <span className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-400">
              <Users size={16} />
            </span>
          </div>

          {loading ? (
            <div className="space-y-2 py-1">
              <Skeleton className="h-8 w-28 rounded-lg bg-slate-200 dark:bg-slate-700" />
              <Skeleton className="h-4 w-48 rounded bg-slate-200 dark:bg-slate-700" />
            </div>
          ) : (
            <>
              <div>
                <p className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 dark:text-white">
                  {(stats?.users.total ?? 0).toLocaleString("id-ID")}{" "}
                  <span className="text-xs font-semibold text-teal-600 dark:text-teal-400">Akun</span>
                </p>
              </div>

              {/* Rincian per role */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                <span className="px-2 py-0.5 rounded-lg bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 font-semibold">
                  Pasien: {stats?.users.by_role.pasien ?? 0}
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold">
                  Psikolog: {stats?.users.by_role.psikolog ?? 0}
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-semibold">
                  Relawan: {stats?.users.by_role.relawan ?? 0}
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-semibold">
                  Admin: {stats?.users.by_role.admin ?? 0}
                </span>
              </div>
            </>
          )}

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <Link
              href="/admin/users"
              className="inline-flex items-center gap-1 text-xs text-teal-700 dark:text-teal-400 font-semibold hover:underline"
            >
              <span>Buka Manajemen Pengguna</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {/* Card 2: Mitra Menunggu Verifikasi */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold">Verifikasi Lisensi Mitra</span>
            <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400">
              <FileCheck2 size={16} />
            </span>
          </div>

          {loading ? (
            <div className="space-y-2 py-1">
              <Skeleton className="h-8 w-24 rounded-lg bg-slate-200 dark:bg-slate-700" />
              <Skeleton className="h-4 w-40 rounded bg-slate-200 dark:bg-slate-700" />
            </div>
          ) : (
            <>
              <div>
                <p className="text-2xl sm:text-3xl font-bold font-heading text-emerald-600 dark:text-emerald-400">
                  {pendingMitra}{" "}
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Permohonan</span>
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                  {pendingMitra > 0
                    ? "Berkas lisensi SIPPK / CV relawan menunggu validasi"
                    : "Semua permohonan lisensi mitra telah ditinjau"}
                </p>
              </div>

              <div className="pt-1">
                <Badge
                  variant="outline"
                  className={
                    pendingMitra > 0
                      ? "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800 text-[11px]"
                      : "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-[11px]"
                  }
                >
                  {pendingMitra > 0 ? "Perlu Tindakan Admin" : "Antrean Bersih"}
                </Badge>
              </div>
            </>
          )}

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <Link
              href="/admin/users?tab=verifications"
              className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400 font-semibold hover:underline"
            >
              <span>Tinjau Verifikasi Mitra</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {/* Card 3: Payout Menunggu */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold">Pengajuan Payout Mitra</span>
            <span className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400">
              <Wallet size={16} />
            </span>
          </div>

          {loading ? (
            <div className="space-y-2 py-1">
              <Skeleton className="h-8 w-24 rounded-lg bg-slate-200 dark:bg-slate-700" />
              <Skeleton className="h-4 w-44 rounded bg-slate-200 dark:bg-slate-700" />
            </div>
          ) : (
            <>
              <div>
                <p className="text-2xl sm:text-3xl font-bold font-heading text-amber-600 dark:text-amber-400">
                  {pendingPayout}{" "}
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Pengajuan</span>
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 font-semibold font-mono">
                  Total: Rp {(stats?.payout.total_requested_rupiah ?? 0).toLocaleString("id-ID")}
                </p>
              </div>

              <div className="pt-1">
                <Badge
                  variant="outline"
                  className={
                    pendingPayout > 0
                      ? "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800 text-[11px]"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 text-[11px]"
                  }
                >
                  {pendingPayout > 0 ? "Menunggu Eksekusi Transfer" : "Tidak Ada Antrean Payout"}
                </Badge>
              </div>
            </>
          )}

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <Link
              href="/admin/transactions"
              className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 font-semibold hover:underline"
            >
              <span>Buka Antrean Transaksi</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </div>

      {/* 3. Financial Metrics (Top-Up & Platform Revenue) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top-up Hari Ini & Total */}
        <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <CardHeader className="p-5 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-400">
                  <Coins size={18} />
                </span>
                <div>
                  <CardTitle className="font-heading text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    Sirkulasi Top-Up Koin Pasien
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 font-nunito">
                    Akumulasi transaksi pembelian koin berstatus settlement dari gateway
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-5 sm:p-6 space-y-4">
            {loading ? (
              <div className="space-y-4 py-1">
                <Skeleton className="h-20 w-full rounded-xl bg-slate-200 dark:bg-slate-700" />
                <Skeleton className="h-20 w-full rounded-xl bg-slate-200 dark:bg-slate-700" />
              </div>
            ) : (
              <>
                {/* Hari Ini */}
                <div className="p-4 rounded-xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200/80 dark:border-teal-900/60 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-teal-900 dark:text-teal-200 flex items-center gap-1.5">
                      <Clock size={14} className="text-teal-600" />
                      <span>Top-Up Hari Ini</span>
                    </span>
                    <span className="font-semibold text-teal-700 dark:text-teal-300 font-mono">
                      {stats?.topup.today.total_orders ?? 0} transaksi berhasil
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 pt-0.5">
                    <p className="text-xl sm:text-2xl font-bold font-heading text-slate-900 dark:text-white">
                      {(stats?.topup.today.total_coins ?? 0).toLocaleString("id-ID")}{" "}
                      <span className="text-xs font-semibold text-teal-600">Koin</span>
                    </p>
                    <p className="text-sm font-semibold font-mono text-slate-700 dark:text-slate-300">
                      ≈ Rp {(stats?.topup.today.total_rupiah ?? 0).toLocaleString("id-ID")}
                    </p>
                  </div>
                </div>

                {/* All-time (Total) */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <TrendingUp size={14} className="text-teal-600" />
                      <span>Total Keseluruhan (All-Time)</span>
                    </span>
                    <span className="font-semibold text-slate-600 dark:text-slate-400 font-mono">
                      {stats?.topup.all_time.total_orders ?? 0} transaksi berhasil
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 pt-0.5">
                    <p className="text-xl sm:text-2xl font-bold font-heading text-slate-900 dark:text-white">
                      {(stats?.topup.all_time.total_coins ?? 0).toLocaleString("id-ID")}{" "}
                      <span className="text-xs font-semibold text-teal-600">Koin</span>
                    </p>
                    <p className="text-sm font-semibold font-mono text-slate-700 dark:text-slate-300">
                      ≈ Rp {(stats?.topup.all_time.total_rupiah ?? 0).toLocaleString("id-ID")}
                    </p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Pendapatan Platform */}
        <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <CardHeader className="p-5 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400">
                <DollarSign size={18} />
              </span>
              <div>
                <CardTitle className="font-heading text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Pendapatan Platform
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 font-nunito">
                  Total pemasukan platform yang dicatat otomatis oleh ledger akuntansi
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-5 sm:p-6 space-y-4">
            {loading ? (
              <div className="space-y-3 py-1">
                <Skeleton className="h-10 w-44 rounded-lg bg-slate-200 dark:bg-slate-700" />
                <Skeleton className="h-24 w-full rounded-xl bg-slate-200 dark:bg-slate-700" />
              </div>
            ) : (
              <>
                <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/60">
                  <span className="text-[11px] font-semibold text-emerald-900 dark:text-emerald-200 block mb-0.5">
                    Total Pendapatan Terakumulasi
                  </span>
                  <p className="text-2xl sm:text-3xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
                    Rp {(stats?.revenue.total_platform_revenue_rupiah ?? 0).toLocaleString("id-ID")}
                  </p>
                </div>

                {/* Rincian per reason */}
                <div className="space-y-2 pt-1">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    Rincian Sumber Pendapatan
                  </span>

                  {stats?.revenue.breakdown_by_reason &&
                  Object.keys(stats.revenue.breakdown_by_reason).length > 0 ? (
                    <div className="rounded-xl border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                      {Object.entries(stats.revenue.breakdown_by_reason).map(([reason, amount]) => (
                        <div
                          key={reason}
                          className="p-3 flex items-center justify-between text-xs bg-slate-50/40 dark:bg-slate-800/30"
                        >
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {formatReason(reason)}
                          </span>
                          <span className="font-mono font-semibold text-slate-900 dark:text-white">
                            Rp {Number(amount).toLocaleString("id-ID")}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
                      Belum ada rincian transaksi pendapatan yang terakumulasi.
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 4. Section Bawah: Antrean Aksi & Status Modul Mendatang */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Antrean Verifikasi Cepat (7 Cols) */}
        <div className="lg:col-span-7">
          <Card className="h-full rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardHeader className="p-5 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-400">
                    <FileCheck2 size={16} />
                  </span>
                  <CardTitle className="font-heading text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    Status Kepatuhan & Lisensi Mitra
                  </CardTitle>
                </div>
                <Link href="/admin/users?tab=verifications">
                  <Button variant="ghost" size="sm" className="text-xs text-teal-700 dark:text-teal-400 font-semibold gap-1">
                    Semua <ArrowRight size={13} />
                  </Button>
                </Link>
              </div>
            </CardHeader>

            <CardContent className="p-5 sm:p-6 text-xs">
              {loading ? (
                <div className="space-y-2.5 py-2">
                  <Skeleton className="h-14 w-full rounded-xl bg-slate-200 dark:bg-slate-700" />
                </div>
              ) : pendingMitra === 0 ? (
                <div className="text-center py-6 text-slate-500 dark:text-slate-400 space-y-1.5">
                  <CheckCircle2 size={26} className="mx-auto text-emerald-500 mb-1" />
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Semua Permohonan Telah Ditinjau
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                    Tidak ada antrean verifikasi SIPPK psikolog atau relawan yang tertunda saat ini.
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-bold text-amber-900 dark:text-amber-200 text-xs">
                      {pendingMitra} Berkas Mitra Menunggu Tinjauan
                    </p>
                    <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                      Tinjau kelengkapan nomor SIPP/STR dan dokumen bukti praktik resmi sebelum menyetujui akses layanan.
                    </p>
                  </div>
                  <Link href="/admin/users?tab=verifications" className="shrink-0">
                    <Button size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold">
                      Tinjau Sekarang
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Modul Segera Hadir (5 Cols) */}
        <div className="lg:col-span-5">
          <Card className="h-full rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardHeader className="p-5 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-400">
                    <AlertTriangle size={16} />
                  </span>
                  <CardTitle className="font-heading text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    Monitoring Sesi & Feed Krisis
                  </CardTitle>
                </div>
                <Badge variant="outline" className="text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-semibold">
                  Segera Hadir
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-5 sm:p-6 space-y-3 text-xs">
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-[11px]">
                Modul telekonsultasi real-time dan sensor deteksi otomatis frasa krisis (self-harm/emergency) sedang dalam sinkronisasi backend. Angka dummy tidak ditampilkan.
              </p>

              <div className="space-y-2 pt-1">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Sesi Berlangsung Real-time</span>
                  <Badge variant="outline" className="text-[10px] font-mono text-slate-500">
                    Segera Hadir
                  </Badge>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Laporan Eskalasi Krisis Aktif</span>
                  <Badge variant="outline" className="text-[10px] font-mono text-slate-500">
                    Segera Hadir
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
