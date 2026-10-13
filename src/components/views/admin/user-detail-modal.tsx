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
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Briefcase,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import { userService } from "@/services/user.service";
import { notify } from "@/lib/toast";
import { useUserStore } from "@/store/user-store";
import type {
  AdminUserRow,
  ApiAccountStatus,
  ApiRole,
  PsikologProfile,
  RelawanProfile,
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

  // Profile data fetch from API
  const [detailedProfile, setDetailedProfile] = useState<Record<string, unknown> | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    if (user) {
      setNewStatus(user.status);
      setRejectionReason("");
    }
  }, [user]);

  useEffect(() => {
    if (open && user?.id) {
      setLoadingProfile(true);
      userService
        .getUserById(user.id)
        .then((res) => {
          if (res.success && res.data) {
            setDetailedProfile(res.data.profile as Record<string, unknown> | null);
          }
        })
        .catch(() => {
          // Fallback gracefully to list row profile
          setDetailedProfile(null);
        })
        .finally(() => {
          setLoadingProfile(false);
        });
    } else {
      setDetailedProfile(null);
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

  const isMitra = user.role === "psikolog" || user.role === "relawan";
  const isPendingVerification =
    user.status === "pending_verification" || user.status === "pending_approval";

  // Typed profile helpers
  const psikologProf = user.role === "psikolog" ? (detailedProfile as unknown as PsikologProfile | null) : null;
  const relawanProf = user.role === "relawan" ? (detailedProfile as unknown as RelawanProfile | null) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-nunito p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1">
          <DialogTitle className="font-heading text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Detail & Pengawasan Pengguna</span>
            {isMitra && (
              <Badge className="text-[10px] bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800">
                Mitra Layanan
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
            Kelola identitas, berkas lisensi SIPPK/STR, dan status kepatuhan akun
          </DialogDescription>
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
                <span>{user.id.slice(0, 8)}...{user.id.slice(-6)}</span>
                {copiedId ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Nama Lengkap</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {user.fullName || "-"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Email</span>
              <span className="font-mono text-slate-800 dark:text-slate-200">
                {user.email}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400 font-medium">WhatsApp</span>
              <span className="font-mono text-slate-800 dark:text-slate-200">
                {user.no_wa || "-"}
              </span>
            </div>
          </div>

          {/* 2. Badge Status & Role */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1">
              <span className="text-[11px] text-slate-400 block font-medium">Peran Akun</span>
              <span
                className={`inline-block font-semibold px-2 py-0.5 rounded text-[11px] border ${
                  roleBadgeConfig[user.role]?.className || ""
                }`}
              >
                {roleBadgeConfig[user.role]?.label || user.role}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1">
              <span className="text-[11px] text-slate-400 block font-medium">Status Terkini</span>
              <Badge
                className={`text-[10px] border shadow-none ${
                  statusBadgeConfig[user.status]?.className || ""
                }`}
              >
                {statusBadgeConfig[user.status]?.label || user.status}
              </Badge>
            </div>
          </div>

          {/* 3. Kredensial & Berkas Verifikasi (Khusus Psikolog & Relawan) */}
          {isMitra && (
            <div className="p-3.5 rounded-xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200/80 dark:border-teal-900/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-teal-900 dark:text-teal-200 text-xs">
                  <FileCheck2 size={15} className="text-teal-600 dark:text-teal-400" />
                  <span>Audit Kredensial & Berkas {user.role === "psikolog" ? "SIPPK" : "CV"}</span>
                </div>
                {loadingProfile && (
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Loader2 size={10} className="animate-spin" /> Memuat berkas...
                  </span>
                )}
              </div>

              {/* Psikolog Fields */}
              {user.role === "psikolog" && (
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
                    <div className="space-y-1">
                      <span className="text-slate-500 dark:text-slate-400 block">Bidang Spesialisasi:</span>
                      <div className="flex flex-wrap gap-1">
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

                  <div className="pt-1.5 border-t border-teal-100 dark:border-teal-900/40 flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Dokumen Lisensi</span>
                    {psikologProf?.dokumen_sipp_str_url ? (
                      <a
                        href={psikologProf.dokumen_sipp_str_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-[11px] shadow-2xs transition-colors"
                      >
                        <FileCheck2 size={12} />
                        <span>Buka Dokumen SIPP (PDF)</span>
                        <ExternalLink size={11} />
                      </a>
                    ) : (
                      <span className="text-slate-400 italic">Belum ada lampiran file</span>
                    )}
                  </div>
                </div>
              )}

              {/* Relawan Fields */}
              {user.role === "relawan" && (
                <div className="space-y-2 text-[11px]">
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

                  <div className="pt-1.5 border-t border-teal-100 dark:border-teal-900/40 flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Dokumen CV / Sertifikat</span>
                    {relawanProf?.dokumen_cv_url ? (
                      <a
                        href={relawanProf.dokumen_cv_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-[11px] shadow-2xs transition-colors"
                      >
                        <FileCheck2 size={12} />
                        <span>Buka Dokumen CV (PDF)</span>
                        <ExternalLink size={11} />
                      </a>
                    ) : (
                      <span className="text-slate-400 italic">Belum ada lampiran file</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4. Waktu Registrasi */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] text-slate-400 block font-medium">Waktu Registrasi</span>
            <p className="text-slate-700 dark:text-slate-300 font-medium">
              {formatDate(user.created_at)}
            </p>
          </div>

          {/* 5. Form Ubah Status Akun */}
          <form onSubmit={handleUpdateStatus} className="p-3.5 rounded-xl border border-teal-200/80 dark:border-teal-900/60 bg-teal-50/40 dark:bg-teal-950/20 space-y-3">
            <div className="flex items-center gap-1.5 font-bold text-teal-900 dark:text-teal-200 text-xs">
              <ShieldAlert size={14} className="text-teal-600 dark:text-teal-400" />
              <span>Modifikasi Status Akun</span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold">
                Pilih Status Baru
              </Label>
              <Select
                value={newStatus}
                onValueChange={(val) => setNewStatus(val as ApiAccountStatus)}
              >
                <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-900 border-teal-200 dark:border-teal-800/80 rounded-lg">
                  <SelectValue placeholder="Pilih status..." />
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
