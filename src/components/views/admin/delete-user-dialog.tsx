"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { userService } from "@/services/user.service";
import { notify } from "@/lib/toast";
import type { AdminUserRow } from "@/types/user-profile";

interface DeleteUserDialogProps {
  user: AdminUserRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}

export function DeleteUserDialog({
  user,
  open,
  onOpenChange,
  onDeleted,
}: DeleteUserDialogProps) {
  const [deleting, setDeleting] = useState(false);

  if (!user) return null;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await userService.deleteUser(user.id);
      notify.success("Pengguna Dihapus", `Akun ${user.email} telah berhasil dihapus secara permanen`);
      onDeleted();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menghapus pengguna";
      notify.error("Gagal", msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-nunito p-6">
        <DialogHeader className="space-y-1">
          <DialogTitle className="font-heading text-lg font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
            <AlertTriangle size={18} />
            <span>Konfirmasi Hapus Pengguna</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
            Tindakan ini tidak dapat dibatalkan dan akan menghapus seluruh data relasi pengguna.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2 text-xs">
          <div className="p-3.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 text-slate-800 dark:text-slate-200 space-y-1.5">
            <p>
              Apakah Anda yakin ingin menghapus akun pengguna berikut secara permanen?
            </p>
            <div className="font-semibold text-slate-900 dark:text-white pt-1">
              <span className="block text-sm">{user.fullName || "-"}</span>
              <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">{user.email}</span>
            </div>
            <p className="text-[11px] text-rose-600 dark:text-rose-400 italic pt-1">
              * Seluruh sesi autentikasi dan data profil role akan dihapus dari basis data.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={deleting}
              onClick={() => onOpenChange(false)}
              className="rounded-xl border-slate-200 dark:border-slate-700 text-xs cursor-pointer"
            >
              Batal
            </Button>
            <Button
              type="button"
              disabled={deleting}
              onClick={handleDelete}
              size="sm"
              className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs gap-1.5 cursor-pointer shadow-xs"
            >
              {deleting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Menghapus...</span>
                </>
              ) : (
                <>
                  <Trash2 size={13} />
                  <span>Hapus Permanen</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
