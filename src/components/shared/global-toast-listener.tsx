"use client";

import React, { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/user-store";
import { useCrisisStore } from "@/store/crisis-store";
import { useScheduleStore } from "@/store/schedule-store";
import { useReviewStore } from "@/store/review-store";
import { usePeerVentStore } from "@/store/peer-vent-store";
import { notify } from "@/lib/toast";

export function GlobalToastListener() {
  const router = useRouter();
  const user = useUserStore((state) => state.user);
  const currentRole = user?.role || "patient";

  // Watchers references to prevent firing on initial mount
  const isMountedRef = useRef(false);
  const lastCrisisCountRef = useRef<number | null>(null);
  const lastScheduleCountRef = useRef<number | null>(null);
  const lastReviewCountRef = useRef<number | null>(null);
  const lastWaitingPostCountRef = useRef<number | null>(null);

  // Stores
  const crisisReports = useCrisisStore((state) => state.reports);
  const schedules = useScheduleStore((state) => state.schedules);
  const reviews = useReviewStore((state) => state.reviews);
  const ventPosts = usePeerVentStore((state) => state.posts);

  // Initialize refs on first load
  useEffect(() => {
    lastCrisisCountRef.current = crisisReports.length;
    lastScheduleCountRef.current = schedules.length;
    lastReviewCountRef.current = reviews.length;
    lastWaitingPostCountRef.current = ventPosts.filter((p) => p.status === "menunggu").length;

    const timer = setTimeout(() => {
      isMountedRef.current = true;
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  // 1. ADMIN LISTENER: Alert Tiket Krisis Baru
  useEffect(() => {
    if (!isMountedRef.current || currentRole !== "admin") {
      lastCrisisCountRef.current = crisisReports.length;
      return;
    }

    if (lastCrisisCountRef.current !== null && crisisReports.length > lastCrisisCountRef.current) {
      const latest = crisisReports[0];
      notify.crisis(
        "Alert Eskalasi Krisis Baru!",
        `${latest?.patientName || latest?.patientAlias || "Pasien"} terdeteksi membutuhkan intervensi darurat (SEJIWA 119 ext. 8).`,
        {
          label: "Buka Crisis Feed",
          onClick: () => router.push("/admin/crisis-feed"),
        }
      );
    }
    lastCrisisCountRef.current = crisisReports.length;
  }, [crisisReports, currentRole, router]);

  // 2. COUNSELOR LISTENER: Permintaan Konseling Baru & Ulasan Pasien Masuk
  useEffect(() => {
    if (!isMountedRef.current || currentRole !== "counselor") {
      lastScheduleCountRef.current = schedules.length;
      return;
    }

    if (lastScheduleCountRef.current !== null && schedules.length > lastScheduleCountRef.current) {
      const latest = schedules[schedules.length - 1];
      notify.schedule(
        "Permintaan Konseling Baru!",
        `Klien memesan sesi: ${latest?.topic || "Konsultasi Klinis"} (${latest?.date || "Jadwal Baru"}).`,
        {
          label: "Buka Jadwal",
          onClick: () => router.push("/counselor/schedule"),
        }
      );
    }
    lastScheduleCountRef.current = schedules.length;
  }, [schedules, currentRole, router]);

  // Counselor Review Listener
  useEffect(() => {
    if (!isMountedRef.current || currentRole !== "counselor") {
      lastReviewCountRef.current = reviews.length;
      return;
    }

    if (lastReviewCountRef.current !== null && reviews.length > lastReviewCountRef.current) {
      const latest = reviews[0];
      notify.success(
        "Ulasan Pasien Baru Diterima!",
        `${latest?.patientName || "Klien"} memberikan penilaian ${latest?.rating || 5} bintang atas sesi Anda.`,
        {
          label: "Buka Beranda",
          onClick: () => router.push("/counselor/beranda"),
        }
      );
    }
    lastReviewCountRef.current = reviews.length;
  }, [reviews, currentRole, router]);

  // 3. PEER LISTENER: Curhat Baru Masuk di Antrean
  useEffect(() => {
    if (!isMountedRef.current || currentRole !== "peer_listener") {
      lastWaitingPostCountRef.current = ventPosts.filter((p) => p.status === "menunggu").length;
      return;
    }

    const waitingCount = ventPosts.filter((p) => p.status === "menunggu").length;
    if (lastWaitingPostCountRef.current !== null && waitingCount > lastWaitingPostCountRef.current) {
      notify.info(
        "Teman Curhat Baru Menunggu",
        "Seseorang membutuhkan teman bicara empatik di antrean curhat anonim.",
        {
          label: "Klaim Sesi",
          onClick: () => router.push("/listener/queue"),
        }
      );
    }
    lastWaitingPostCountRef.current = waitingCount;
  }, [ventPosts, currentRole, router]);

  return null;
}
