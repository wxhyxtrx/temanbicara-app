"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Headphones,
  ArrowLeft,
  BookOpen,
  AlertCircle,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { peerTicketClient, PeerTicketApiError } from "@/services/peer-tickets.client";
import { userService } from "@/services/user.service";
import { notify } from "@/lib/toast";
import type {
  RelawanPeerTicketDTO,
  RelawanQuotaInfo,
} from "@/types/peer-tickets";
import type { RelawanProfile } from "@/types/user-profile";
import { ListenerQuotaCard } from "@/components/views/listener/listener-quota-card";
import { ListenerActiveTicketCard } from "@/components/views/listener/listener-active-ticket-card";
import { ListenerPoolList } from "@/components/views/listener/listener-pool-list";
import { ListenerClaimDialog } from "@/components/views/listener/listener-claim-dialog";

export default function ListenerQueueRoomPage() {
  const [quota, setQuota] = useState<RelawanQuotaInfo | null>(null);
  const [claimedTicket, setClaimedTicket] = useState<RelawanPeerTicketDTO | null>(null);
  const [poolTickets, setPoolTickets] = useState<RelawanPeerTicketDTO[]>([]);
  const [profile, setProfile] = useState<RelawanProfile | null>(null);

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorInitial, setErrorInitial] = useState<string | null>(null);

  const [selectedTicketToClaim, setSelectedTicketToClaim] = useState<RelawanPeerTicketDTO | null>(null);
  const [isClaimDialogOpen, setIsClaimDialogOpen] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  const isMountedRef = useRef(true);

  // Fetch all queue data concurrently
  const loadQueueData = useCallback(async (isSilent = false) => {
    if (!isSilent) {
      setIsRefreshing(true);
    }

    try {
      const [quotaRes, claimedRes, poolRes, userRes] = await Promise.all([
        peerTicketClient.getQuotaInfo().catch((err) => {
          console.error("Gagal mengambil kuota relawan:", err);
          return null;
        }),
        peerTicketClient.getMyClaimedTicket().catch((err) => {
          console.error("Gagal mengambil tiket diklaim:", err);
          return null;
        }),
        peerTicketClient.getPoolTickets().catch((err) => {
          console.error("Gagal mengambil antrean pool:", err);
          return null;
        }),
        userService.getMe().catch((err) => {
          console.error("Gagal mengambil profil relawan:", err);
          return null;
        }),
      ]);

      if (!isMountedRef.current) return;

      if (quotaRes?.success && quotaRes.data) {
        setQuota(quotaRes.data);
      }

      if (claimedRes?.success) {
        setClaimedTicket(claimedRes.data ?? null);
      }

      if (poolRes?.success && poolRes.data) {
        setPoolTickets(poolRes.data);
      }

      if (userRes?.success && userRes.data?.profile) {
        setProfile(userRes.data.profile as RelawanProfile);
      }

      setErrorInitial(null);
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      console.error("Gagal memuat antrean relawan:", err);
      if (!isSilent) {
        setErrorInitial(
          err instanceof Error ? err.message : "Terjadi kesalahan saat memuat antrean."
        );
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingInitial(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  // Initial load
  useEffect(() => {
    isMountedRef.current = true;
    loadQueueData(false);

    return () => {
      isMountedRef.current = false;
    };
  }, [loadQueueData]);

  // Polling berkala setiap 15 detik di latar belakang
  useEffect(() => {
    const interval = setInterval(() => {
      if (isMountedRef.current && !isClaiming) {
        loadQueueData(true);
      }
    }, 15000);

    return () => {
      clearInterval(interval);
    };
  }, [loadQueueData, isClaiming]);

  // Handler for open claim dialog
  const handleOpenClaimDialog = (ticket: RelawanPeerTicketDTO) => {
    setSelectedTicketToClaim(ticket);
    setIsClaimDialogOpen(true);
  };

  // Handler for confirming claim
  const handleConfirmClaim = async (ticket: RelawanPeerTicketDTO) => {
    try {
      setIsClaiming(true);
      const res = await peerTicketClient.claimTicket(ticket.id);

      if (res.success && res.data) {
        notify.success(
          "Tiket Berhasil Diambil",
          "Silakan mulai pendampingan empati untuk teman bicara."
        );
        setIsClaimDialogOpen(false);
        setSelectedTicketToClaim(null);
        // Refresh all queue and quota data
        await loadQueueData(false);
      }
    } catch (err: unknown) {
      if (err instanceof PeerTicketApiError) {
        const code = err.code || "";
        const msg = err.message || "";

        if (err.status === 409) {
          if (code === "DAILY_QUOTA_EXHAUSTED" || msg.includes("DAILY_QUOTA_EXHAUSTED")) {
            notify.error("Kuota Klaim Habis", "Kuota klaim tiket harian relawan sudah habis.");
          } else if (code === "TICKET_NOT_OPEN" || msg.includes("TICKET_NOT_OPEN")) {
            notify.warning(
              "Tiket Tidak Tersedia",
              "Tiket sudah diambil oleh pendengar lain atau tidak lagi terbuka."
            );
          } else if (
            code === "RELAWAN_ABANDONED_TICKET" ||
            msg.includes("RELAWAN_ABANDONED_TICKET")
          ) {
            notify.warning(
              "Tidak Dapat Mengambil Tiket",
              "Tiket tidak dapat diambil kembali karena pernah ditinggalkan sebelumnya."
            );
          } else {
            notify.error("Gagal Mengklaim Tiket", msg || "Tiket tidak dapat diklaim saat ini.");
          }
        } else {
          notify.error("Gagal Mengklaim Tiket", msg);
        }
      } else {
        notify.error(
          "Gagal Mengklaim Tiket",
          err instanceof Error ? err.message : "Terjadi kesalahan saat memproses klaim tiket."
        );
      }

      // Refresh pool in case ticket was taken or status changed
      await loadQueueData(true);
    } finally {
      if (isMountedRef.current) {
        setIsClaiming(false);
      }
    }
  };

  const isAvailable = Boolean(profile?.is_available);
  const remainingQuota = quota?.remaining ?? 0;

  return (
    <div className="space-y-6 sm:space-y-8 font-nunito pb-12 text-slate-900 dark:text-slate-100 transition-colors duration-200 min-w-0">
      {/* 1. Header Hero / Navigation Bar */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-900 via-teal-950 to-slate-950 text-white p-6 sm:p-8 shadow-lg border border-teal-800/60 dark:border-teal-900/40 min-w-0">
        <div className="absolute top-0 right-10 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 left-10 w-60 h-60 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 min-w-0">
          <div className="space-y-2.5 max-w-2xl min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/listener/beranda">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-teal-700/80 bg-teal-950/60 hover:bg-teal-800/60 text-teal-200 text-xs h-7 px-2.5 gap-1.5 cursor-pointer"
                >
                  <ArrowLeft size={13} />
                  <span>Beranda Relawan</span>
                </Button>
              </Link>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-800/60 border border-teal-700/60 text-teal-200 text-xs font-semibold backdrop-blur-md">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isAvailable ? "bg-emerald-400 animate-pulse" : "bg-slate-400"
                  }`}
                />
                <span>
                  {isAvailable ? "Siaga Menerima Curhat" : "Mode Istirahat Emosi"}
                </span>
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold font-heading text-white tracking-tight leading-snug flex items-center gap-2.5 min-w-0">
              <Headphones className="size-7 text-emerald-400 shrink-0" />
              <span className="truncate">Ruang Antrean Tiket Curhat</span>
            </h1>

            <p className="text-xs sm:text-sm text-teal-100/80 leading-relaxed font-nunito max-w-xl">
              Pilih dan dampingi teman bicara yang membutuhkan pendengar empatik. Seluruh percakapan terjaga dalam batas aman Psychological First Aid (PFA).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Link href="/listener/guidelines">
              <Button
                variant="outline"
                className="border-teal-700/80 bg-teal-900/50 hover:bg-teal-800/60 text-teal-100 font-semibold rounded-xl text-xs h-9 px-3.5 cursor-pointer gap-1.5"
              >
                <BookOpen size={14} />
                <span>Panduan Etika PFA</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Error Initial State Banner */}
      {errorInitial && (
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/40 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
          <div className="flex items-start gap-3 min-w-0">
            <AlertCircle className="size-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            <div className="space-y-0.5 min-w-0">
              <p className="font-heading font-bold text-sm text-rose-950 dark:text-rose-100">
                Gagal Memuat Antrean
              </p>
              <p className="text-xs text-rose-800 dark:text-rose-300 font-nunito leading-relaxed">
                {errorInitial}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => loadQueueData(false)}
            className="border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 hover:bg-rose-100 rounded-xl text-xs h-8 px-3 shrink-0 self-start sm:self-auto cursor-pointer gap-1.5"
          >
            <RefreshCw size={13} />
            <span>Coba Lagi</span>
          </Button>
        </div>
      )}

      {/* 2. Kartu Kuota Harian Relawan */}
      <ListenerQuotaCard
        quota={quota}
        loading={loadingInitial}
        isAvailable={isAvailable}
      />

      {/* 3. Seksi Tiket Aktif yang Sedang Ditangani (Jika Ada) */}
      <ListenerActiveTicketCard
        ticket={claimedTicket}
        loading={loadingInitial}
      />

      {/* 4. Antrean Pool Tiket Menunggu (FIFO) */}
      <ListenerPoolList
        tickets={poolTickets}
        loading={loadingInitial}
        isRefreshing={isRefreshing}
        isAvailable={isAvailable}
        remainingQuota={remainingQuota}
        onClaimClick={handleOpenClaimDialog}
        onManualRefresh={() => loadQueueData(false)}
      />

      {/* 5. Dialog Konfirmasi Klaim Tiket */}
      <ListenerClaimDialog
        ticket={selectedTicketToClaim}
        open={isClaimDialogOpen}
        onOpenChange={setIsClaimDialogOpen}
        onConfirmClaim={handleConfirmClaim}
        isClaiming={isClaiming}
      />
    </div>
  );
}
