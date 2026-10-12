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
import { Copy, Check, ShieldAlert, Trash2, Save, Loader2 } from "lucide-react";
import { userService } from "@/services/user.service";
import { notify } from "@/lib/toast";
import { useUserStore } from "@/store/user-store";
import type { AdminUserRow, ApiAccountStatus, ApiRole } from "@/types/user-profile";

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

  useEffect(() => {
    if (user) {
      setNewStatus(user.status);
      setRejectionReason("");
    }
  }, [user]);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-nunito p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1">
          <DialogTitle className="font-heading text-lg font-bold text-slate-900 dark:text-white">
            Detail & Pengawasan Pengguna
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
            Kelola identitas, akses peran, dan modifikasi status kepatuhan akun
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2 text-xs">
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

          {/* 3. Waktu Registrasi */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] text-slate-400 block font-medium">Waktu Registrasi</span>
            <p className="text-slate-700 dark:text-slate-300 font-medium">
              {formatDate(user.created_at)}
            </p>
          </div>

          {/* 4. Form Ubah Status Akun */}
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
                  Alasan Penolakan (Opsional)
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

          {/* 5. Footer Actions */}
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
