"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  Headphones,
  Heart,
  Star,
  BookOpen,
  AlertCircle,
} from "lucide-react";
import { useUserStore } from "@/store/user-store";
import { userService } from "@/services/user.service";
import { peerTicketClient } from "@/services/peer-tickets.client";
import { usePublicSettings } from "@/hooks/use-public-settings";
import { notify } from "@/lib/toast";
import type { RelawanProfile } from "@/types/user-profile";
import type { RelawanPeerTicketDTO, RelawanQuotaInfo } from "@/types/peer-tickets";
import { ListenerQueueSummaryCard } from "@/components/views/listener/listener-queue-summary-card";

export default function ListenerBerandaPage() {
  const user = useUserStore((state) => state.user);
  const { settings } = usePublicSettings();

  const [profile, setProfile] = useState<RelawanProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [userMe, setUserMe] = useState<{ fullName?: string; email?: string } | null>(null);
  const [isTogglingSiaga, setIsTogglingSiaga] = useState(false);

  // Real Queue & Quota Summary State (PRD-011)
  const [quota, setQuota] = useState<RelawanQuotaInfo | null>(null);
  const [poolTickets, setPoolTickets] = useState<RelawanPeerTicketDTO[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);

  const loadQueueSummary = useCallback(async () => {
    try {
      setLoadingQueue(true);
      setQueueError(null);
      const [poolRes, quotaRes] = await Promise.all([
        peerTicketClient.getPoolTickets(),
        peerTicketClient.getQuotaInfo(),
      ]);
      if (poolRes && poolRes.success && Array.isArray(poolRes.data)) {
        setPoolTickets(poolRes.data);
      }
      if (quotaRes && quotaRes.success && quotaRes.data) {
        setQuota(quotaRes.data);
      }
    } catch (err: unknown) {
      console.error("Gagal memuat ringkasan antrean relawan:", err);
      setQueueError(
        err instanceof Error ? err.message : "Gagal memuat ringkasan antrean relawan"
      );
    } finally {
      setLoadingQueue(false);
    }
  }, []);

  const handleToggleSiaga = async (checked: boolean) => {
    try {
      setIsTogglingSiaga(true);
      const res = await userService.updateMe({ is_available: checked });
      if (res.success && res.data) {
        if (res.data.profile) {
          setProfile(res.data.profile as RelawanProfile);
        }
        useUserStore.getState().setAuthSession(res.data.user, undefined, res.data.profile);
        notify.success(
          "Status Siaga Diperbarui",
          checked
            ? "Status Anda kini Siaga Menerima Curhat."
            : "Status Anda kini Sedang Istirahat Emosi."
        );
      }
    } catch (err: unknown) {
      notify.error("Gagal Memperbarui Status", err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setIsTogglingSiaga(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const res = await userService.getMe();
        if (!isMounted) return;
        if (res.success && res.data) {
          setUserMe(res.data.user);
          if (res.data.profile) {
            setProfile(res.data.profile as RelawanProfile);
          }
        }
      } catch (err) {
        console.error("Gagal memuat profil relawan:", err);
      } finally {
        if (isMounted) setLoadingProfile(false);
      }
    }

    loadData();
    loadQueueSummary();

    return () => {
      isMounted = false;
    };
  }, [loadQueueSummary]);

  const dailyQuota = quota?.daily_limit ?? settings?.relawan?.daily_ticket_quota ?? 3;
  const ticketsClaimed = quota?.tickets_claimed ?? 0;
  const isAvailable = Boolean(profile?.is_available);
  const ratingValue = profile?.rating_rata_rata != null ? Number(profile.rating_rata_rata) : null;
  const ratingDisplay = ratingValue != null && !isNaN(ratingValue) ? ratingValue.toFixed(1) : "-";
  const totalSesi = profile?.total_sesi ?? user.listenerData?.sessionsCompleted ?? 0;

  const displayName =
    profile?.alias_name ||
    profile?.nama_lengkap ||
    userMe?.fullName ||
    user.alias ||
    user.fullName ||
    "Sahabat Pendengar";

  return (
    <div className="space-y-6 sm:space-y-8 font-nunito pb-12 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* 1. Header Hero Sanctuary */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-900 via-teal-950 to-slate-950 text-white p-6 sm:p-8 md:p-10 shadow-lg border border-teal-800/60 dark:border-teal-900/40">
        <div className="absolute top-0 right-10 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 left-10 w-60 h-60 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 md:gap-8">
          <div className="space-y-3.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-800/60 border border-teal-700/60 text-teal-200 text-xs font-semibold backdrop-blur-md">
              <span
                className={`w-2 h-2 rounded-full ${
                  isAvailable ? "bg-emerald-400 animate-pulse" : "bg-slate-400"
                }`}
              />
              <span>
                {isAvailable
                  ? "Status: Siaga Menerima Curhat"
                  : "Status: Istirahat / Belum Aktif"}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold font-heading text-white tracking-tight leading-snug">
              Halo, {displayName}
            </h1>

            <p className="text-sm sm:text-base text-teal-100/80 leading-relaxed max-w-xl">
              Hadir dan mendengarkan dengan penuh penerimaan tanpa menghakimi adalah obat terbaik bagi jiwa yang lelah. Terima kasih telah menjadi suaka bagi sesama.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link href="/listener/queue">
                <Button className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl px-5 py-5 text-sm cursor-pointer shadow-md shadow-emerald-500/20 gap-2">
                  <Headphones size={17} />
                  Buka Ruang Dengar
                </Button>
              </Link>
              <Link href="/listener/guidelines">
                <Button variant="outline" className="border-teal-700/80 bg-teal-900/50 hover:bg-teal-800/60 text-teal-100 font-semibold rounded-xl px-5 py-5 text-sm cursor-pointer gap-2">
                  <BookOpen size={17} />
                  Panduan Etika PFA
                </Button>
              </Link>
            </div>
          </div>

          {/* Burnout Guard Status Card */}
          <div className="rounded-2xl bg-teal-900/40 border border-teal-700/50 p-4 sm:p-5 backdrop-blur-md max-w-xs space-y-3 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-emerald-300">Burnout Guard Relawan</p>
                <p className="text-[11px] text-teal-100/70 font-nunito">
                  {`Beban: ${ticketsClaimed}/${dailyQuota} sesi hari ini`}
                </p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Switch
                      checked={isAvailable}
                      disabled={isTogglingSiaga}
                      onCheckedChange={handleToggleSiaga}
                      className="cursor-pointer"
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isAvailable ? "Klik untuk mode istirahat" : "Klik untuk siaga menerima curhat"}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="pt-2 border-t border-teal-800/80 flex items-center justify-between text-[11px] text-teal-300">
              <span>Batas Aman: {dailyQuota} Sesi/Hari</span>
              <span className="flex items-center gap-1 text-amber-300 font-bold">
                <Star size={12} className="fill-amber-300" /> {ratingDisplay}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. KPI Stat Cards (2 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {/* Card 1: Jiwa Didampingi */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Jiwa Didampingi</span>
            <span className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-400">
              <Heart size={15} />
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-heading text-teal-900 dark:text-teal-300">
            {loadingProfile ? (
              <span className="text-base text-slate-400 font-normal">Memuat...</span>
            ) : (
              <>
                {totalSesi} <span className="text-xs font-semibold text-teal-600">Teman</span>
              </>
            )}
          </p>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-nunito">
            Percakapan empatik selesai
          </span>
        </div>

        {/* Card 2: Skor Kehangatan (Rating) */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Skor Kehangatan</span>
            <span className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400">
              <Star size={15} className="fill-amber-400 text-amber-400" />
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-heading text-amber-700 dark:text-amber-400">
            {loadingProfile ? (
              <span className="text-base text-slate-400 font-normal">Memuat...</span>
            ) : ratingDisplay === "-" ? (
              <span className="text-slate-900 dark:text-white">-</span>
            ) : (
              <>
                {ratingDisplay}{" "}
                <span className="text-xs font-semibold text-slate-500">/ 5.0</span>
              </>
            )}
          </p>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-nunito">
            Evaluasi apresiasi anonim
          </span>
        </div>
      </div>

      {/* 3. Antrean Curhat Masuk & Panduan Pendengar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
        {/* Left: Antrean Masuk (8 Cols) - Real Queue Summary Card */}
        <div className="lg:col-span-8 space-y-6 min-w-0">
          <ListenerQueueSummaryCard
            poolTickets={poolTickets}
            quota={quota}
            loading={loadingQueue}
            error={queueError}
            onRetry={loadQueueSummary}
            isAvailable={isAvailable}
          />
        </div>

        {/* Right: Golden Rules & Emergency Escalation (4 Cols) */}
        <div className="lg:col-span-4 space-y-6 min-w-0">
          <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs min-w-0">
            <CardHeader className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="font-heading text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BookOpen size={16} className="text-teal-600 dark:text-teal-400" />
                3 Prinsip Emas Pendengar Sebaya
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 space-y-3 text-xs font-nunito leading-relaxed">
              <div className="p-2.5 rounded-xl bg-teal-50/60 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 space-y-1">
                <p className="font-bold text-teal-900 dark:text-teal-200">1. Validasi, Bukan Solusi Instan</p>
                <p className="text-slate-600 dark:text-slate-300 text-[11px]">
                  Fokus pada perasaan mereka terlebih dahulu. Hindari langsung memberi nasihat sebelum mereka merasa didengarkan.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 space-y-1">
                <p className="font-bold text-slate-800 dark:text-slate-200">2. Jaga Batasan Diri (Boundaries)</p>
                <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                  Kamu adalah pendengar sebaya, bukan terapis. Jangan ragu menyarankan bantuan profesional bila keluhan berada di luar ranah sebaya.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 space-y-1 text-rose-900 dark:text-rose-200">
                <p className="font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1">
                  <AlertCircle size={13} /> 3. Eskalasi Krisis SEJIWA 119
                </p>
                <p className="text-rose-700 dark:text-rose-300 text-[11px]">
                  Bila teman bicara mengindikasikan bahaya melukai diri, segera rujuk ke Hotline SEJIWA 119 ext. 8 bebas pulsa.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
