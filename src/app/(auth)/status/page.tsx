"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/shared/atoms/Logo";
import { ThemeToggle } from "@/components/shared/atoms/theme-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUserStore } from "@/store/user-store";
import { notify } from "@/lib/toast";
import { authService } from "@/services/auth.service";
import {
  Clock,
  Mail,
  FileCheck2,
  AlertTriangle,
  ShieldAlert,
  XCircle,
  ArrowRight,
  LogOut,
  RefreshCw,
  ExternalLink,
  MessageCircle,
} from "lucide-react";

interface StatusDetail {
  badge: string;
  badgeColor: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconBg: string;
  iconColor: string;
  actionPrimary?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  contactSupport?: boolean;
}

function StatusContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, logout } = useUserStore();
  const [currentStatus, setCurrentStatus] =
    useState<string>("pending_approval");
  const [resendingEmail, setResendingEmail] = useState(false);

  useEffect(() => {
    // 1. Baca query param ?state=... jika ada
    const queryState = searchParams.get("state");
    if (queryState) {
      setCurrentStatus(queryState);
      return;
    }

    // 2. Baca dari cookie tb_user_status
    if (typeof document !== "undefined") {
      const match = document.cookie.match(/tb_user_status=([^;]+)/);
      if (match && match[1]) {
        setCurrentStatus(match[1]);
        return;
      }
    }

    // 3. Fallback ke role mitra
    if (user?.role === "counselor") {
      setCurrentStatus("pending_verification");
    } else if (user?.role === "peer_listener") {
      setCurrentStatus("pending_approval");
    }
  }, [searchParams, user]);

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch {
      // Ignore
    }
    logout();
    notify.info("Keluar Akun", "Anda telah keluar dari akun.");
    window.location.href = "/login";
  };

  const handleResendEmail = () => {
    setResendingEmail(true);
    setTimeout(() => {
      setResendingEmail(false);
      notify.success(
        "Email Terkirim",
        "Tautan verifikasi baru telah dikirim ke alamat email Anda.",
      );
    }, 1200);
  };

  const statusMap: Record<string, StatusDetail> = {
    unverified_email: {
      badge: "Email Belum Diverifikasi",
      badgeColor:
        "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300",
      title: "Verifikasi Alamat Email Anda",
      description: `Kami telah mengirimkan tautan aktivasi ke ${user?.email || "email Anda"}. Silakan periksa kotak masuk atau folder spam Anda untuk mengaktifkan akun.`,
      icon: Mail,
      iconBg:
        "bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800",
      iconColor: "text-amber-600 dark:text-amber-400",
      actionPrimary: {
        label: resendingEmail
          ? "Mengirim Ulang..."
          : "Kirim Ulang Tautan Verifikasi",
        onClick: handleResendEmail,
      },
      contactSupport: true,
    },
    incomplete_profile: {
      badge: "Profil Belum Lengkap",
      badgeColor:
        "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300",
      title: "Lengkapi Berkas Kredensial",
      description:
        "Pendaftaran kemitraan Anda memerlukan kelengkapan dokumen pendukung (CV atau SIPPK/STR) sebelum dapat diproses oleh tim kurasi.",
      icon: FileCheck2,
      iconBg:
        "bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800",
      iconColor: "text-blue-600 dark:text-blue-400",
      actionPrimary: {
        label: "Lengkapi Berkas Pendaftaran",
        href:
          user?.role === "counselor"
            ? "/register/counselor"
            : "/register/listener",
      },
    },
    pending_approval: {
      badge: "Menunggu Persetujuan Admin",
      badgeColor:
        "bg-pink-100 text-pink-800 border-pink-300 dark:bg-pink-950 dark:text-pink-300",
      title: "Aplikasi Relawan Sedang Ditinjau",
      description: `Terima kasih atas dedikasi Anda, ${user?.fullName || "Sahabat"}. Dokumen CV dan sertifikasi Psychological First Aid (PFA) Anda sedang ditinjau oleh tim kurasi TemanBicara.`,
      icon: Clock,
      iconBg:
        "bg-pink-50 dark:bg-pink-950/60 border-pink-200 dark:border-pink-800",
      iconColor: "text-pink-600 dark:text-pink-400",
      contactSupport: true,
    },
    pending_verification: {
      badge: "Verifikasi Dokumen Medis",
      badgeColor:
        "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950 dark:text-teal-300",
      title: "Validasi Legalitas SIPPK / STR",
      description: `Kredensial klinis atas nama ${user?.fullName || "Psikolog"} sedang dalam proses validasi silang dengan basis data HIMPSI dan Kementerian Kesehatan RI.`,
      icon: Clock,
      iconBg:
        "bg-teal-50 dark:bg-teal-950/60 border-teal-200 dark:border-teal-800",
      iconColor: "text-teal-600 dark:text-teal-400",
      contactSupport: true,
    },
    rejected: {
      badge: "Pendaftaran Belum Diterima",
      badgeColor:
        "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300",
      title: "Pengajuan Belum Memenuhi Syarat",
      description:
        "Mohon maaf, berkas yang Anda unggah belum memenuhi standar kurasi klinis TemanBicara (misal: dokumen kurang terbaca atau masa berlaku habis). Anda dapat mengunggah ulang dokumen perbaikan.",
      icon: XCircle,
      iconBg:
        "bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800",
      iconColor: "text-rose-600 dark:text-rose-400",
      actionPrimary: {
        label: "Unggah Ulang Dokumen Perbaikan",
        href:
          user?.role === "counselor"
            ? "/register/counselor"
            : "/register/listener",
      },
      contactSupport: true,
    },
    suspended: {
      badge: "Akun Ditangguhkan",
      badgeColor:
        "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300",
      title: "Akses Akun Dinonaktifkan Sementara",
      description:
        "Akun ini sementara waktu dinonaktifkan oleh administrator terkait peninjauan kepatuhan kode etik telekonseling atau keamanan platform.",
      icon: ShieldAlert,
      iconBg:
        "bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800",
      iconColor: "text-rose-600 dark:text-rose-400",
      contactSupport: true,
    },
  };

  const activeConfig: StatusDetail =
    statusMap[currentStatus] || statusMap.pending_approval;
  const StatusIcon = activeConfig.icon;

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden bg-gradient-to-br from-teal-50/70 via-slate-50 to-emerald-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-teal-950/40 text-slate-900 dark:text-slate-100 font-nunito transition-colors duration-200">
      {/* Ambient background glows */}
      <div className="absolute top-10 -left-20 w-80 h-80 rounded-full bg-teal-200/30 dark:bg-teal-900/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-96 h-96 rounded-full bg-emerald-200/25 dark:bg-emerald-900/10 blur-3xl pointer-events-none" />

      {/* Top Bar Navigation */}
      <div className="w-full max-w-lg mb-4 flex items-center justify-between relative z-10">
        <Link href="/">
          <Logo size="md" showTagline />
        </Link>
        <ThemeToggle />
      </div>

      {/* Main Status Card */}
      <div className="w-full max-w-lg bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-xl shadow-teal-900/5 dark:shadow-black/40 p-6 sm:p-8 space-y-4 relative z-10 text-center backdrop-blur-xs">
        {/* Status Icon */}
        <div
          className={`w-16 h-16 rounded-2xl border ${activeConfig.iconBg} ${activeConfig.iconColor} mx-auto flex items-center justify-center shadow-xs animate-in zoom-in-90 duration-200`}
        >
          <StatusIcon size={32} />
        </div>

        {/* Status Badge & Heading */}
        <div className="space-y-4">
          <Badge
            className={`border font-semibold text-xs px-3 py-1 ${activeConfig.badgeColor}`}
          >
            {activeConfig.badge}
          </Badge>
          <h1 className="text-xl sm:text-2xl font-bold font-heading text-slate-900 dark:text-white leading-tight">
            {activeConfig.title}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-nunito">
            {activeConfig.description}
          </p>
        </div>

        {/* Estimated Info Timeline Box */}
        {(currentStatus === "pending_approval" ||
          currentStatus === "pending_verification") && (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-left space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold text-xs shrink-0">
                1
              </div>
              <div className="text-xs">
                <p className="font-bold text-slate-800 dark:text-slate-200">
                  Verifikasi Dokumen
                </p>
                <p className="text-[11px] text-slate-500">
                  Estimasi proses review 1 - 3 hari kerja
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold text-xs shrink-0">
                2
              </div>
              <div className="text-xs">
                <p className="font-bold text-slate-700 dark:text-slate-300">
                  Aktivasi Portal Modul
                </p>
                <p className="text-[11px] text-slate-500">
                  Notifikasi status dikirim langsung ke email Anda
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Group */}
        <div className="space-y-2.5 pt-2">
          {activeConfig.actionPrimary && (
            <>
              {activeConfig.actionPrimary.href ? (
                <Link
                  href={activeConfig.actionPrimary.href}
                  className="block w-full"
                >
                  <Button className="w-full h-11 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md shadow-teal-700/20 gap-2 cursor-pointer">
                    <span>{activeConfig.actionPrimary.label}</span>
                    <ArrowRight size={15} />
                  </Button>
                </Link>
              ) : (
                <Button
                  onClick={activeConfig.actionPrimary.onClick}
                  disabled={resendingEmail}
                  className="w-full h-11 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md shadow-teal-700/20 gap-2 cursor-pointer"
                >
                  <RefreshCw
                    size={15}
                    className={resendingEmail ? "animate-spin" : ""}
                  />
                  <span>{activeConfig.actionPrimary.label}</span>
                </Button>
              )}
            </>
          )}

          {activeConfig.contactSupport && (
            <a
              href="https://wa.me/6281234567890?text=Halo%20Admin%20TemanBicara%2C%20saya%20ingin%20menanyakan%20status%20verifikasi%20akun%20saya."
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full"
            >
              <Button
                variant="outline"
                className="w-full h-10 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold gap-2 cursor-pointer"
              >
                <MessageCircle
                  size={15}
                  className="text-emerald-600 dark:text-emerald-400"
                />
                <span>Hubungi Layanan Bantuan (WhatsApp)</span>
              </Button>
            </a>
          )}

          {/* Exit / Logout Action */}
          <button
            type="button"
            onClick={handleLogout}
            className="w-full pt-2 flex items-center justify-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors font-medium cursor-pointer"
          >
            <LogOut size={13} />
            <span>Keluar dari Akun / Masuk dengan Akun Lain</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AuthStatusPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
          <div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full" />
        </div>
      }
    >
      <StatusContent />
    </Suspense>
  );
}
