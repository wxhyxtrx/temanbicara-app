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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, Loader2 } from "lucide-react";
import { userService } from "@/services/user.service";
import { notify } from "@/lib/toast";
import type { ApiRole, ApiAccountStatus } from "@/types/user-profile";

interface CreateUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateUserModal({
  open,
  onOpenChange,
  onCreated,
}: CreateUserModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<ApiRole>("pasien");
  const [noWa, setNoWa] = useState("");
  const [status, setStatus] = useState<ApiAccountStatus>("active");
  const [level, setLevel] = useState("operator");
  const [nomorSipp, setNomorSipp] = useState("");
  const [tarifSesi, setTarifSesi] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setFullName("");
    setRole("pasien");
    setNoWa("");
    setStatus("active");
    setLevel("operator");
    setNomorSipp("");
    setTarifSesi("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !fullName) {
      notify.warning("Form Belum Lengkap", "Email, password, dan nama lengkap wajib diisi.");
      return;
    }

    setSubmitting(true);
    try {
      await userService.createUser({
        email: email.trim(),
        password,
        role,
        fullName: fullName.trim(),
        no_wa: noWa.trim() || undefined,
        status,
        level: role === "admin" ? level : undefined,
        nomor_sipp_str: role === "psikolog" ? nomorSipp.trim() || undefined : undefined,
        tarif_sesi: role === "psikolog" && tarifSesi ? Number(tarifSesi) : undefined,
      });

      notify.success("Pengguna Dibuat", `Pengguna baru ${fullName} (${role}) berhasil didaftarkan`);
      resetForm();
      onCreated();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal membuat pengguna baru";
      notify.error("Gagal", msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-nunito p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1">
          <DialogTitle className="font-heading text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <UserPlus size={18} className="text-teal-600 dark:text-teal-400" />
            <span>Tambah Pengguna Baru</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
            Daftarkan akun sistem baru (Pasien, Psikolog, Relawan, atau Admin)
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 pt-2 text-xs">
          <div className="space-y-1">
            <Label className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold">
              Nama Lengkap <span className="text-rose-500">*</span>
            </Label>
            <Input
              placeholder="Contoh: Budi Santoso / Dr. Maya, M.Psi"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="h-8.5 text-xs bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold">
                Email Pengguna <span className="text-rose-500">*</span>
              </Label>
              <Input
                type="email"
                placeholder="nama@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-8.5 text-xs bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold">
                Password <span className="text-rose-500">*</span>
              </Label>
              <Input
                type="password"
                placeholder="Min. 6 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-8.5 text-xs bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold">
                Peran Akun <span className="text-rose-500">*</span>
              </Label>
              <Select value={role} onValueChange={(val) => setRole(val as ApiRole)}>
                <SelectTrigger className="h-8.5 text-xs bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 rounded-xl">
                  <SelectValue placeholder="Pilih Peran" />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectItem value="pasien">Pasien</SelectItem>
                  <SelectItem value="psikolog">Psikolog Klinis</SelectItem>
                  <SelectItem value="relawan">Pendengar Sebaya</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold">
                Status Awal
              </Label>
              <Select value={status} onValueChange={(val) => setStatus(val as ApiAccountStatus)}>
                <SelectTrigger className="h-8.5 text-xs bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 rounded-xl">
                  <SelectValue placeholder="Pilih Status" />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectItem value="active">Aktif</SelectItem>
                  <SelectItem value="pending_approval">Menunggu Persetujuan</SelectItem>
                  <SelectItem value="pending_verification">Verifikasi Berkas</SelectItem>
                  <SelectItem value="suspended">Ditangguhkan</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold">
              Nomor WhatsApp (Opsional)
            </Label>
            <Input
              placeholder="081234567890"
              value={noWa}
              onChange={(e) => setNoWa(e.target.value)}
              className="h-8.5 text-xs bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 rounded-xl"
            />
          </div>

          {/* Conditional Fields based on Role */}
          {role === "admin" && (
            <div className="space-y-1 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <Label className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold">
                Tingkat Akses Admin
              </Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg">
                  <SelectValue placeholder="Pilih Level" />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectItem value="operator">Operator</SelectItem>
                  <SelectItem value="superadmin">Superadministrator</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {role === "psikolog" && (
            <div className="space-y-2 p-2.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/50">
              <div className="space-y-1">
                <Label className="text-[11px] text-purple-900 dark:text-purple-300 font-semibold">
                  Nomor SIPP / STR (Opsional)
                </Label>
                <Input
                  placeholder="Misal: SIPP-2024-9988"
                  value={nomorSipp}
                  onChange={(e) => setNomorSipp(e.target.value)}
                  className="h-8 text-xs bg-white dark:bg-slate-850 border-purple-200 dark:border-purple-800 rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-purple-900 dark:text-purple-300 font-semibold">
                  Tarif Sesi Rp (Opsional)
                </Label>
                <Input
                  type="number"
                  placeholder="150000"
                  value={tarifSesi}
                  onChange={(e) => setTarifSesi(e.target.value)}
                  className="h-8 text-xs bg-white dark:bg-slate-850 border-purple-200 dark:border-purple-800 rounded-lg"
                />
              </div>
            </div>
          )}

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="rounded-xl border-slate-200 dark:border-slate-700 text-xs cursor-pointer"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              size="sm"
              className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs gap-1.5 cursor-pointer shadow-xs"
            >
              {submitting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Mendaftarkan...</span>
                </>
              ) : (
                <>
                  <UserPlus size={13} />
                  <span>Daftarkan Pengguna</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
