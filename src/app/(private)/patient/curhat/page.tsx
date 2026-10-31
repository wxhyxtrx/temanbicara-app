"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  HeartHandshake,
  ShieldCheck,
  MessageCircle,
  Sparkles,
  AlertCircle,
  HelpCircle,
  Users,
  Lock,
  ArrowRight,
  Headphones,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { useUserStore } from "@/store/user-store";
import { peerTicketClient } from "@/services/peer-tickets.client";
import type { PeerTicketEntity } from "@/types/peer-tickets";
import { PatientPeerTicketCard } from "@/components/views/patient/patient-peer-ticket-card";
import { VentingModalForm } from "@/components/views/patient/venting-modal-form";
import { supabasePublic } from "@/lib/supabase/client";
import { notify } from "@/lib/toast";

function getAccessTokenFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)tb_access_token=([^;]+)/);
  if (!match) return null;
  const raw = decodeURIComponent(match[1]).trim().replace(/^"|"$/g, "");
  return raw && raw !== "undefined" && raw !== "null" ? raw : null;
}

export default function PatientCurhatPage() {
  const user = useUserStore((state) => state.user);

  const [activeTicket, setActiveTicket] = useState<PeerTicketEntity | null>(null);
  const [loadingActiveTicket, setLoadingActiveTicket] = useState<boolean>(true);
  const [activeTicketError, setActiveTicketError] = useState<string | null>(null);
  const [ventingModalOpen, setVentingModalOpen] = useState<boolean>(false);

  const loadActiveTicket = useCallback(async (silent = false) => {
    if (!silent) {
      setLoadingActiveTicket(true);
    }
    setActiveTicketError(null);
    try {
      const res = await peerTicketClient.getMyActiveTicket();
      if (res && res.success) {
        setActiveTicket(res.data);
      } else {
        setActiveTicket(null);
      }
    } catch (err: unknown) {
      console.error("Gagal memuat status tiket curhat pasien:", err);
      if (!silent) {
        setActiveTicketError(
          err instanceof Error ? err.message : "Gagal memuat status tiket curhat"
        );
      }
    } finally {
      if (!silent) {
        setLoadingActiveTicket(false);
      }
    }
  }, []);

  const handleOpenVentingModal = useCallback(() => {
    if (activeTicket && activeTicket.status !== "archived") {
      notify.warning(
        "Tiket Curhat Aktif",
        "Kamu masih memiliki tiket curhat yang sedang berjalan."
      );
      return;
    }
    if (activeTicket?.status === "archived") {
      setActiveTicket(null);
    }
    setVentingModalOpen(true);
  }, [activeTicket]);

  const handleDismissArchived = useCallback(() => {
    setActiveTicket(null);
  }, []);

  useEffect(() => {
    let isMounted = true;
    loadActiveTicket();

    if (!user?.id || !supabasePublic) return;

    let channel: ReturnType<typeof supabasePublic.channel> | null = null;

    const setupRealtime = async () => {
      const token = getAccessTokenFromCookie();
      if (token) {
        try {
          await supabasePublic.realtime.setAuth(token);
        } catch (err) {
          console.error("Gagal setAuth realtime curhat:", err);
        }
      }

      if (!isMounted) return;

      const channelName = `patient_curhat_${user.id}`;
      const ch = supabasePublic
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "peer_tickets",
            filter: `patient_id=eq.${user.id}`,
          },
          () => {
            if (isMounted) {
              loadActiveTicket(true);
            }
          }
        )
        .subscribe();

      channel = ch;
    };

    setupRealtime();

    const interval = setInterval(() => {
      if (isMounted) {
        loadActiveTicket(true);
      }
    }, 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (channel && supabasePublic) {
        supabasePublic.removeChannel(channel);
      }
    };
  }, [user?.id, loadActiveTicket]);

  const hasActiveRunningTicket =
    Boolean(activeTicket && activeTicket.status !== "archived" && activeTicket.status !== "closed");

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6 sm:space-y-8 min-w-0">
      {/* 1. Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800 min-w-0">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <Badge
              variant="outline"
              className="bg-teal-50 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800 text-[11px] gap-1 px-2.5 py-0.5"
            >
              <HeartHandshake size={12} className="text-teal-600 dark:text-teal-400" />
              <span>Dukungan Sebaya</span>
            </Badge>
            <span className="text-xs text-slate-400 dark:text-slate-500">•</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
              100% Anonim & Rahasia
            </span>
          </div>

          <h1 className="font-heading text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight break-words">
            Curhat Sebaya Teman Bicara
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-nunito max-w-2xl leading-relaxed">
            Ceritakan keluh kesah dan beban pikiranmu kepada pendengar sebaya empatik yang siap mendengarkan tanpa menghakimi.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => loadActiveTicket(false)}
            disabled={loadingActiveTicket}
            className="rounded-xl text-xs h-9 px-3 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 gap-1.5 cursor-pointer"
          >
            <RefreshCw size={13} className={loadingActiveTicket ? "animate-spin" : ""} />
            <span className="hidden xs:inline">Segarkan</span>
          </Button>

          {!hasActiveRunningTicket && (
            <Button
              type="button"
              size="sm"
              onClick={handleOpenVentingModal}
              className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs h-9 px-3.5 font-semibold gap-1.5 shadow-xs cursor-pointer"
            >
              <MessageCircle size={14} />
              <span>Mulai Curhat</span>
            </Button>
          )}
        </div>
      </div>

      {/* 2. Kartu Status Tiket Aktif / Pengajuan Curhat */}
      <div className="min-w-0">
        <PatientPeerTicketCard
          ticket={activeTicket}
          loading={loadingActiveTicket}
          error={activeTicketError}
          onOpenForm={handleOpenVentingModal}
          onRetry={() => loadActiveTicket(false)}
          onDismissArchived={handleDismissArchived}
        />
      </div>

      {/* 3. Tiga Pilar Kenyamanan Curhat Sebaya */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 min-w-0">
        <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs min-w-0">
          <CardHeader className="p-4 sm:p-5 pb-2">
            <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/80 border border-teal-200/80 dark:border-teal-800 text-teal-700 dark:text-teal-400 flex items-center justify-center mb-2 shrink-0">
              <ShieldCheck size={18} />
            </div>
            <CardTitle className="font-heading text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug">
              Nama Samaran Anonim
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-0">
            <CardDescription className="text-xs text-slate-600 dark:text-slate-400 font-nunito leading-relaxed">
              Kamu bebas memakai pseudonim bawaan sistem. Identitas asli seperti email dan kontak tidak dibagikan ke relawan.
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs min-w-0">
          <CardHeader className="p-4 sm:p-5 pb-2">
            <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/80 border border-sky-200/80 dark:border-sky-800 text-sky-700 dark:text-sky-400 flex items-center justify-center mb-2 shrink-0">
              <Headphones size={18} />
            </div>
            <CardTitle className="font-heading text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug">
              Pendengar Empatik Terlatih
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-0">
            <CardDescription className="text-xs text-slate-600 dark:text-slate-400 font-nunito leading-relaxed">
              Relawan kami dibekali prinsip Psychological First Aid (PFA) untuk mendengarkan dengan penuh penerimaan tanpa kritik.
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs min-w-0">
          <CardHeader className="p-4 sm:p-5 pb-2">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/80 border border-amber-200/80 dark:border-amber-800 text-amber-700 dark:text-amber-400 flex items-center justify-center mb-2 shrink-0">
              <Users size={18} />
            </div>
            <CardTitle className="font-heading text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug">
              Dukungan Teman Sebaya
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-0">
            <CardDescription className="text-xs text-slate-600 dark:text-slate-400 font-nunito leading-relaxed">
              Layanan ini adalah pendampingan emosional non-klinis. Untuk evaluasi medis atau resep, silakan jadwalkan konsultasi psikolog.
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* 4. Banner Bantuan Medis & Krisis Darurat */}
      <div className="p-4 sm:p-5 rounded-2xl border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 min-w-0">
        <div className="flex items-start gap-3 min-w-0">
          <AlertCircle className="size-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1 min-w-0">
            <h4 className="font-heading font-bold text-xs sm:text-sm text-amber-950 dark:text-amber-100">
              Butuh Dukungan Klinis atau Darurat?
            </h4>
            <p className="text-xs text-amber-800 dark:text-amber-300 font-nunito leading-relaxed max-w-2xl">
              Jika kamu berada dalam krisis keselamatan diri atau butuh intervensi klinis mendesak, segera hubungi layanan krisis nasional atau konsultasikan dengan psikolog berlisensi.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
          <Link href="/help-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl text-xs h-8 px-3 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 gap-1.5 cursor-pointer"
            >
              <HelpCircle size={13} />
              <span>Pusat Bantuan</span>
            </Button>
          </Link>
          <Link href="/patient/schedule">
            <Button
              type="button"
              size="sm"
              className="bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs h-8 px-3 font-semibold gap-1.5 shadow-xs cursor-pointer"
            >
              <span>Jadwal Psikolog</span>
              <ArrowRight size={13} />
            </Button>
          </Link>
        </div>
      </div>

      {/* Modal Form Pengajuan Curhat */}
      <VentingModalForm
        open={ventingModalOpen}
        onOpenChange={setVentingModalOpen}
        onSuccess={() => loadActiveTicket(false)}
      />
    </div>
  );
}
