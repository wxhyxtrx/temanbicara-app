"use client";

import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Copy,
  Check,
  ShieldAlert,
  Trash2,
  Save,
  Loader2,
  FileCheck2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Wallet,
  Clock,
} from "lucide-react";
import { userService } from "@/services/user.service";
import { notify } from "@/lib/toast";
import { useUserStore } from "@/store/user-store";
import { Skeleton } from "@/components/ui/skeleton";
import { UserDocumentPreviewAccordion } from "./user-document-preview-accordion";
import type {
  AdminUserRow,
  ApiAccountStatus,
  ApiRole,
  PsikologProfile,
  RelawanProfile,
  UserWalletSummary,
  PatientTopupSummary,
  MitraPayoutSummary,
} from "@/types/user-profile";

interface UserDetailModalProps {
  user: AdminUserRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
  onOpenDelete: (user: AdminUserRow) => void;
  statusBadgeConfig: Record<ApiAccountStatus, { label: string; className: string }>;
  roleBadgeConfig: Record<ApiRole, { label: string; className: string }>;
  formatDate: (isoString?: string) => string;
}

export function UserDetailModal({
  user,
  open,
  onOpenChange,
  onUpdated,
  onOpenDelete,
  statusBadgeConfig,
  roleBadgeConfig,
  formatDate,
}: UserDetailModalProps) {
  const currentUser = useUserStore((state) => state.user);
  const isSelf = user ? user.id === currentUser?.id || user.email === currentUser?.email : false;
  const [copiedId, setCopiedId] = useState(false);
  const [newStatus, setNewStatus] = useState<ApiAccountStatus>("active");
  const [rejectionReason, setRejectionReason] = useState("");
  const [updating, setUpdating] = useState(false);

  // Profile & detailed user fetch from API
  const [detailedUser, setDetailedUser] = useState<(AdminUserRow & {
    last_sign_in_at?: string | null;
    verified_at?: string | null;
    updated_at?: string;
  }) | null>(null);
  const [detailedProfile, setDetailedProfile] = useState<Record<string, unknown> | null>(null);
  const [wallet, setWallet] = useState<UserWalletSummary | null>(null);
  const [topupSummary, setTopupSummary] = useState<PatientTopupSummary | null>(null);
  const [payoutSummary, setPayoutSummary] = useState<MitraPayoutSummary | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [dokumenSignedUrl, setDokumenSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setNewStatus(user.status);
      setRejectionReason("");
    }
  }, [user]);

  useEffect(() => {
    if (open && user?.id) {
      setLoadingProfile(true);
      setDetailedUser(null);
      setDetailedProfile(null);
      setDokumenSignedUrl(null);
      setWallet(null);
      setTopupSummary(null);
      setPayoutSummary(null);
      userService
        .getUserById(user.id)
        .then((res) => {
          if (res.success && res.data) {
            setDokumenSignedUrl(res.data.dokumen_signed_url ?? null);
            setDetailedProfile(res.data.profile as Record<string, unknown> | null);
            if (res.data.user) {
              setDetailedUser(res.data.user);
            }
            if (res.data.wallet) {
              setWallet(res.data.wallet);
            }
            if (res.data.topup_summary) {
              setTopupSummary(res.data.topup_summary);
            }
            if (res.data.payout_summary) {
              setPayoutSummary(res.data.payout_summary);
            }
          }
        })
        .catch(() => {
          // Fallback gracefully to list row profile
          setDokumenSignedUrl(null);
          setDetailedProfile(null);
          setDetailedUser(null);
          setWallet(null);
          setTopupSummary(null);
          setPayoutSummary(null);
        })
        .finally(() => {
          setLoadingProfile(false);
        });
    } else {
      setDokumenSignedUrl(null);
      setDetailedProfile(null);
      setDetailedUser(null);
      setWallet(null);
      setTopupSummary(null);
      setPayoutSummary(null);
    }
  }, [open, user?.id]);

  if (!user) return null;

  const handleCopyId = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(user.id);
      setCopiedId(true);
      notify.success("ID Disalin", "User ID berhasil disalin ke clipboard");
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setUpdating(true);
    try {
      await userService.updateUserStatus(
        user.id,
        newStatus,
        newStatus === "rejected" ? rejectionReason : undefined
      );
      notify.success("Status Diperbarui", `Status akun berhasil diubah menjadi ${newStatus}`);
      onUpdated();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memperbarui status akun";
      notify.error("Gagal", msg);
    } finally {
      setUpdating(false);
    }
  };

  const handleQuickVerification = async (action: "approve" | "reject") => {
    if (!user) return;
    setUpdating(true);
    try {
      if (action === "approve") {
        const docUrl = dokumenSignedUrl;
        if (isMitra && !docUrl && typeof window !== "undefined") {
          const confirmApprove = window.confirm(
            "Peringatan: Berkas dokumen lisensi belum terlampir. Yakin ingin tetap menyetujui dan mengaktifkan akun mitra ini?"
          );
          if (!confirmApprove) {
            setUpdating(false);
            return;
          }
        }
        await userService.updateUserStatus(user.id, "active");
        notify.success(
          "Kredensial Disetujui!",
          `Lisensi ${user.fullName || user.email} diverifikasi. Akun kini aktif.`
        );
        onUpdated();
        onOpenChange(false);
      } else {
        if (!rejectionReason.trim()) {
          setNewStatus("rejected");
          notify.info(
            "Alasan Penolakan",
            "Silakan isi alasan penolakan pada form di bawah lalu simpan."
          );
          setUpdating(false);
          return;
        }
        await userService.updateUserStatus(user.id, "rejected", rejectionReason.trim());
        notify.warning(
          "Permohonan Ditolak",
          `Verifikasi kredensial untuk ${user.fullName || user.email} ditolak.`
        );
        onUpdated();
        onOpenChange(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memproses verifikasi";
      notify.error("Gagal", msg);
    } finally {
      setUpdating(false);
    }
  };

  const activeUser = detailedUser || user;
  const isMitra = activeUser.role === "psikolog" || activeUser.role === "relawan";
  const isPendingVerification =
    activeUser.status === "pending_verification" || activeUser.status === "pending_approval";

  // Typed profile helpers
  const psikologProf = activeUser.role === "psikolog" ? (detailedProfile as unknown as PsikologProfile | null) : null;
  const relawanProf = activeUser.role === "relawan" ? (detailedProfile as unknown as RelawanProfile | null) : null;

  const formatWIB = (isoString?: string | null) => {
    if (!isoString) return "-";
    try {
      const d = new Date(isoString);
      if (Number.isNaN(d.getTime())) return isoString;
      return (
        d.toLocaleString("id-ID", {
          timeZone: "Asia/Jakarta",
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }) + " WIB"
      );
    } catch {
      return isoString;
    }
  };

  const verifiedAt =
    detailedUser?.verified_at ||
    (detailedProfile?.verified_at as string | null | undefined) ||
    (user.profile && typeof user.profile === "object" && "verified_at" in user.profile
      ? (user.profile as { verified_at?: string | null }).verified_at
      : null);

  const currentWallet: UserWalletSummary = wallet || {
    coin_balance: activeUser.coin_balance ?? 0,
    available_rupiah: activeUser.available_rupiah ?? 0,
    pending_rupiah: activeUser.pending_rupiah ?? 0,
  };

  const renderWalletBalance = () => {
    if (activeUser.role === "pasien") {
      return (
        <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono text-xs">
          {currentWallet.coin_balance.toLocaleString("id-ID")} Koin
        </span>
      );
    }
    if (activeUser.role === "psikolog" || activeUser.role === "relawan") {
      const avail = currentWallet.available_rupiah;
      const pending = currentWallet.pending_rupiah;
      return (
        <div className="text-right space-y-0.5">
          <p className="font-semibold text-slate-800 dark:text-slate-200 font-mono text-xs">
            Rp {avail.toLocaleString("id-ID")}
          </p>
          {pending > 0 && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-normal">
              tertahan Rp {pending.toLocaleString("id-ID")}
            </p>
          )}
        </div>
      );
    }
    return <span className="text-slate-400 dark:text-slate-500 font-mono text-xs">—</span>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-nunito p-6 min-h-[520px] max-h-[90vh] overflow-y-auto [scrollbar-gutter:stable]"
        style={{ scrollbarGutter: "stable" }}
      >
        <DialogHeader className="flex flex-col items-center justify-center text-center sm:text-center gap-1.5 pt-1 px-6">
          <DialogTitle className="font-heading text-lg font-bold text-slate-900 dark:text-white text-center leading-snug">
            Detail & Pengawasan Pengguna
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 text-center max-w-sm">
            Kelola identitas, berkas lisensi SIPPK/STR, dan status kepatuhan akun
          </DialogDescription>
          {isMitra && (
            <div className="flex justify-center pt-0.5">
              <Badge className="text-[10px] bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800 shrink-0 font-semibold">
                Mitra Layanan
              </Badge>
            </div>
          )}
        </DialogHeader>

        <div className="space-y-4 pt-2 text-xs">
          {/* Quick Verification Banner for Pending Mitra */}
          {isMitra && isPendingVerification && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 space-y-2.5 animate-in fade-in">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-200">
                <AlertCircle size={15} className="text-amber-600 shrink-0" />
                <span>Menunggu Tinjauan Kredensial & Berkas</span>
              </div>
              <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
                Pengguna ini telah mendaftar sebagai mitra {user.role === "psikolog" ? "Psikolog Klinis" : "Pendengar Sebaya"}. Periksa dokumen izin di bawah sebelum menyetujui akses layanan.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  disabled={updating}
                  onClick={() => handleQuickVerification("approve")}
                  className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg px-3 gap-1.5 cursor-pointer shadow-xs"
                >
                  <CheckCircle2 size={14} />
                  <span>Setujui & Aktifkan Mitra</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={updating}
                  onClick={() => {
                    setNewStatus("rejected");
                    notify.info("Alasan Penolakan", "Isi alasan penolakan pada form status di bawah.");
                  }}
                  className="h-8 text-xs border-rose-200 dark:border-rose-900 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg px-3 gap-1.5 cursor-pointer font-semibold"
                >
                  <XCircle size={14} />
                  <span>Tolak Berkas</span>
                </Button>
              </div>
            </div>
          )}

          {/* 1. Profil Info Card */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-medium">User ID</span>
              <button
                type="button"
                onClick={handleCopyId}
                className="inline-flex items-center gap-1 font-mono text-[11px] text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
                title="Klik untuk salin"
              >
                <span>{activeUser.id.slice(0, 8)}...{activeUser.id.slice(-6)}</span>
                {copiedId ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Nama Lengkap</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {activeUser.fullName || "-"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Email</span>
              <span className="font-mono text-slate-800 dark:text-slate-200">
                {activeUser.email}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-medium">WhatsApp</span>
              <span className="font-mono text-slate-800 dark:text-slate-200">
                {activeUser.no_wa || "-"}
              </span>
            </div>
          </div>

          {/* 2. Badge Status & Role */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1">
              <span className="text-[11px] text-slate-400 block font-medium">Peran Akun</span>
              <span
                className={`inline-block font-semibold px-2 py-0.5 rounded text-[11px] border ${
                  roleBadgeConfig[activeUser.role]?.className || ""
                }`}
              >
                {roleBadgeConfig[activeUser.role]?.label || activeUser.role}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1">
              <span className="text-[11px] text-slate-400 block font-medium">Status Terkini</span>
              <Badge
                className={`text-[10px] border shadow-none ${
                  statusBadgeConfig[activeUser.status]?.className || ""
                }`}
              >
                {statusBadgeConfig[activeUser.status]?.label || activeUser.status}
              </Badge>
            </div>
          </div>

          {/* 3. Saldo & Ringkasan Finansial */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-xs">
                <Wallet size={14} className="text-teal-600 dark:text-teal-400" />
                <span>Saldo & Ringkasan Finansial</span>
              </div>
              {loadingProfile && (
                <span className="text-[10px] text-teal-600 dark:text-teal-400 font-medium flex items-center gap-1">
                  <Loader2 size={10} className="animate-spin" /> Memuat...
                </span>
              )}
            </div>

            {/* Saldo Lengkap */}
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Saldo Dompet</span>
              {loadingProfile ? (
                <Skeleton className="h-4 w-28 rounded bg-slate-200 dark:bg-slate-700" />
              ) : (
                renderWalletBalance()
              )}
            </div>

            {/* Pasien: Top-up Summary */}
            {activeUser.role === "pasien" && (
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Total Top-up Berhasil</span>
                  {loadingProfile ? (
                    <Skeleton className="h-4 w-36 rounded bg-slate-200 dark:bg-slate-700" />
                  ) : (
                    <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono text-xs">
                      {topupSummary
                        ? `${topupSummary.total_coins.toLocaleString("id-ID")} Koin (Rp ${topupSummary.total_rupiah.toLocaleString("id-ID")})`
                        : "0 Koin (Rp 0)"}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Pesanan Berhasil</span>
                  {loadingProfile ? (
                    <Skeleton className="h-4 w-20 rounded bg-slate-200 dark:bg-slate-700" />
                  ) : (
                    <span className="font-medium text-slate-700 dark:text-slate-300 font-mono">
                      {topupSummary ? `${topupSummary.successful_orders_count} transaksi` : "0 transaksi"}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Mitra: Payout Summary */}
            {(activeUser.role === "psikolog" || activeUser.role === "relawan") && (
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Total Payout Dibayar</span>
                  {loadingProfile ? (
                    <Skeleton className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-700" />
                  ) : (
                    <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono text-xs">
                      {payoutSummary
                        ? `Rp ${payoutSummary.total_paid_rupiah.toLocaleString("id-ID")}`
                        : "Rp 0"}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Penarikan Berhasil</span>
                  {loadingProfile ? (
                    <Skeleton className="h-4 w-20 rounded bg-slate-200 dark:bg-slate-700" />
                  ) : (
                    <span className="font-medium text-slate-700 dark:text-slate-300 font-mono">
                      {payoutSummary ? `${payoutSummary.paid_requests_count} kali` : "0 kali"}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Admin Info */}
            {activeUser.role === "admin" && (
              <p className="text-[11px] text-slate-400 italic">
                Akun administrator tidak terhubung dengan wallet pembayaran.
              </p>
            )}
          </div>

          {/* 4. Aktivitas & Verifikasi Akun */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-xs">
              <Clock size={14} className="text-teal-600 dark:text-teal-400" />
              <span>Aktivitas & Verifikasi Akun</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Waktu Registrasi</span>
              <span className="text-slate-700 dark:text-slate-300 font-medium font-mono text-[11px]">
                {formatWIB(user.created_at)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Login Terakhir</span>
              {loadingProfile ? (
                <Skeleton className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-700" />
              ) : (
                <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono text-[11px]">
                  {detailedUser?.last_sign_in_at ? formatWIB(detailedUser.last_sign_in_at) : "Belum pernah login"}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Tanggal Verifikasi</span>
              {loadingProfile ? (
                <Skeleton className="h-4 w-28 rounded bg-slate-200 dark:bg-slate-700" />
              ) : (
                <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono text-[11px]">
                  {verifiedAt ? formatWIB(verifiedAt) : "-"}
                </span>
              )}
            </div>
          </div>

          {/* 3. Kredensial & Berkas Verifikasi (Khusus Psikolog & Relawan) */}
          {isMitra && (
            <div className="p-3.5 rounded-xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200/80 dark:border-teal-900/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-teal-900 dark:text-teal-200 text-xs">
                  <FileCheck2 size={15} className="text-teal-600 dark:text-teal-400" />
                  <span>Audit Kredensial & Berkas {activeUser.role === "psikolog" ? "SIPPK" : "CV"}</span>
                </div>
                {loadingProfile && (
                  <span className="text-[10px] text-teal-600 dark:text-teal-400 font-medium flex items-center gap-1">
                    <Loader2 size={10} className="animate-spin" /> Memuat...
                  </span>
                )}
              </div>

              {loadingProfile ? (
                /* Skeleton Loading State agar data tidak delay/glitch */
                <div className="space-y-3 py-1 animate-pulse">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3.5 w-28 rounded bg-teal-200/50 dark:bg-teal-900/40" />
                    <Skeleton className="h-3.5 w-44 rounded bg-teal-200/50 dark:bg-teal-900/40" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3.5 w-32 rounded bg-teal-200/50 dark:bg-teal-900/40" />
                    <Skeleton className="h-3.5 w-16 rounded bg-teal-200/50 dark:bg-teal-900/40" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3.5 w-36 rounded bg-teal-200/50 dark:bg-teal-900/40" />
                    <Skeleton className="h-5 w-28 rounded-md bg-teal-200/50 dark:bg-teal-900/40" />
                  </div>
                  <div className="pt-2">
                    <Skeleton className="h-11 w-full rounded-xl bg-teal-200/50 dark:bg-teal-900/40" />
                  </div>
                </div>
              ) : (
                <>
                  {/* Psikolog Fields */}
                  {activeUser.role === "psikolog" && (
                    <div className="space-y-2 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Nomor SIPP / STR</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {psikologProf?.nomor_sipp_str || "-"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400">Pengalaman Praktik</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {psikologProf?.tahun_pengalaman ? `${psikologProf.tahun_pengalaman} Tahun` : "-"}
                        </span>
                      </div>

                      {psikologProf?.spesialisasi && psikologProf.spesialisasi.length > 0 && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-500 dark:text-slate-400 shrink-0">Bidang Spesialisasi</span>
                          <div className="flex flex-wrap items-center justify-end gap-1 text-right">
                            {psikologProf.spesialisasi.map((s, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-teal-800 dark:text-teal-300 border border-teal-200/60 text-[10px] font-medium"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Relawan Fields */}
                  {activeUser.role === "relawan" && (
                    <div className="space-y-2 text-[11px]">
                      {relawanProf?.topik_keahlian && relawanProf.topik_keahlian.length > 0 && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-500 dark:text-slate-400 shrink-0">Topik Keahlian</span>
                          <div className="flex flex-wrap items-center justify-end gap-1 text-right">
                            {relawanProf.topik_keahlian.map((t, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-teal-800 dark:text-teal-300 border border-teal-200/60 text-[10px] font-medium"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {relawanProf?.latar_belakang && (
                        <div className="space-y-0.5">
                          <span className="text-slate-500 dark:text-slate-400 block">Latar Belakang:</span>
                          <p className="text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 p-2 rounded-lg border border-teal-100 dark:border-teal-900/40">
                            {relawanProf.latar_belakang}
                          </p>
                        </div>
                      )}

                      {relawanProf?.alasan_bergabung && (
                        <div className="space-y-0.5">
                          <span className="text-slate-500 dark:text-slate-400 block">Alasan Bergabung:</span>
                          <p className="text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 p-2 rounded-lg border border-teal-100 dark:border-teal-900/40">
                            {relawanProf.alasan_bergabung}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Accordion Preview & Download Dokumen Syarat Approval */}
                  <UserDocumentPreviewAccordion
                    role={activeUser.role}
                    userName={activeUser.fullName || activeUser.email}
                    documentUrl={dokumenSignedUrl}
                    licenseNumber={activeUser.role === "psikolog" ? psikologProf?.nomor_sipp_str : undefined}
                    isLoading={loadingProfile}
                  />
                </>
              )}
            </div>
          )}

          {/* 6. Form Ubah Status Akun */}
          <form onSubmit={handleUpdateStatus} className="p-3.5 rounded-xl border border-teal-200/80 dark:border-teal-900/60 bg-teal-50/40 dark:bg-teal-950/20 space-y-3">
            <div className="flex items-center gap-1.5 font-bold text-teal-900 dark:text-teal-200 text-xs">
              <ShieldAlert size={14} className="text-teal-600 dark:text-teal-400" />
              <span>Modifikasi Status Akun</span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <Label className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold shrink-0">
                Pilih Status Baru
              </Label>
              <div className="w-[180px] sm:w-[220px] shrink-0">
                <Select
                  value={newStatus}
                  onValueChange={(val) => setNewStatus(val as ApiAccountStatus)}
                >
                  <SelectTrigger className="w-full min-w-0 max-w-full h-8 text-xs bg-white dark:bg-slate-900 border-teal-200 dark:border-teal-800/80 rounded-lg overflow-hidden [&>span]:truncate [&>span]:block [&>span]:text-left">
                    <SelectValue placeholder="Pilih status..." className="truncate block text-left" />
                  </SelectTrigger>
                  <SelectContent className="text-xs">
                    <SelectItem value="active">Aktif (Dapat Mengakses Platform)</SelectItem>
                    <SelectItem value="suspended">Ditangguhkan (Blokir Akses Layanan)</SelectItem>
                    <SelectItem value="pending_approval">Menunggu Persetujuan</SelectItem>
                    <SelectItem value="pending_verification">Menunggu Verifikasi Berkas</SelectItem>
                    <SelectItem value="rejected">Ditolak</SelectItem>
                    <SelectItem value="unverified_email">Email Belum Verifikasi</SelectItem>
                    <SelectItem value="incomplete_profile">Profil Belum Lengkap</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {newStatus === "rejected" && (
              <div className="space-y-1">
                <Label className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold">
                  Alasan Penolakan (Wajib jika ditolak)
                </Label>
                <Input
                  placeholder="Misal: Dokumen STR tidak valid atau kedaluwarsa..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="h-8 text-xs bg-white dark:bg-slate-900 border-teal-200 dark:border-teal-800/80 rounded-lg"
                />
              </div>
            )}

            <Button
              type="submit"
              disabled={updating || newStatus === user.status}
              size="sm"
              className="w-full h-8 text-xs rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold gap-1.5 cursor-pointer shadow-xs"
            >
              {updating ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Save size={13} />
                  <span>Terapkan Perubahan Status</span>
                </>
              )}
            </Button>
          </form>

          {/* 6. Footer Actions */}
          <div className="pt-2 flex items-center justify-between">
            {!isSelf ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenDelete(user)}
                className="rounded-xl border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs gap-1 cursor-pointer font-semibold"
              >
                <Trash2 size={13} />
                <span>Hapus Akun</span>
              </Button>
            ) : (
              <span className="text-[11px] font-semibold text-teal-600 dark:text-teal-400">
                Akun Anda Sendiri
              </span>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="rounded-xl border-slate-200 dark:border-slate-700 text-xs cursor-pointer"
            >
              Tutup
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
