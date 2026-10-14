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
import { PasswordInput } from "@/components/ui/password-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UserPlus,
  Loader2,
  UploadCloud,
  FileCheck2,
  X,
  Sparkles,
  GraduationCap,
  Briefcase,
} from "lucide-react";
import { userService } from "@/services/user.service";
import { authService } from "@/services/auth.service";
import { notify } from "@/lib/toast";
import type { ApiRole, ApiAccountStatus } from "@/types/user-profile";

const SPECIALTY_OPTIONS = [
  "Konseling Umum",
  "Kecemasan & Panic Attack",
  "Workplace Burnout & Tekanan Kerja",
  "Trauma & Regulasi Emosi",
  "Depresi & Mood Disorder",
  "Dinamika Pasangan & Hubungan",
  "Quarter-Life Crisis & Identitas Diri",
  "Pengasuhan Anak & Keluarga",
];

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

  // Spesifik Psikolog
  const [nomorSipp, setNomorSipp] = useState("");
  const [tarifSesi, setTarifSesi] = useState("");
  const [tahunPengalaman, setTahunPengalaman] = useState("");
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>(["Konseling Umum"]);

  // Spesifik Relawan
  const [latarBelakang, setLatarBelakang] = useState("");
  const [alasanBergabung, setAlasanBergabung] = useState("");

  // Upload Dokumen Pendukung (SIPP/STR untuk psikolog, CV untuk relawan)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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
    setTahunPengalaman("");
    setSelectedSpecialties(["Konseling Umum"]);
    setLatarBelakang("");
    setAlasanBergabung("");
    setSelectedFile(null);
  };

  const handleToggleSpecialty = (item: string) => {
    setSelectedSpecialties((prev) =>
      prev.includes(item) ? prev.filter((s) => s !== item) : [...prev, item]
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        notify.warning("Ukuran Terlalu Besar", "Maksimal ukuran dokumen adalah 5MB");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !fullName) {
      notify.warning("Form Belum Lengkap", "Email, password, dan nama lengkap wajib diisi.");
      return;
    }

    setSubmitting(true);
    try {
      let uploadedDocUrl: string | undefined = undefined;

      // 1. Unggah dokumen jika admin melampirkan berkas SIPP/STR atau CV
      if (selectedFile) {
        const docType = role === "psikolog" ? "sipp_str" : "cv";
        const cleanEmail = email.trim().toLowerCase();
        const presigned = await authService.getPresignedUrl({
          file_name: selectedFile.name,
          file_type: selectedFile.type || "application/pdf",
          document_type: docType,
          user_email_or_temp_id: cleanEmail || "admin_created_user",
        });

        await authService.uploadBinaryFile(presigned.data.upload_url, selectedFile);
        uploadedDocUrl = presigned.data.file_path;
      }

      // 2. Daftarkan akun baru ke backend
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
        tahun_pengalaman: role === "psikolog" && tahunPengalaman ? Number(tahunPengalaman) : undefined,
        spesialisasi: role === "psikolog" && selectedSpecialties.length > 0 ? selectedSpecialties : undefined,
        dokumen_sipp_str_url: role === "psikolog" ? uploadedDocUrl : undefined,
        dokumen_cv_url: role === "relawan" ? uploadedDocUrl : undefined,
        latar_belakang: role === "relawan" ? latarBelakang.trim() || undefined : undefined,
        alasan_bergabung: role === "relawan" ? alasanBergabung.trim() || undefined : undefined,
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

  const isControlClass =
    "w-full h-9 text-xs bg-slate-50/50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 rounded-xl";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-nunito p-6 max-h-[90vh] overflow-y-auto">
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
          {/* 1. Nama Lengkap */}
          <div className="space-y-1">
            <Label className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold">
              Nama Lengkap <span className="text-rose-500">*</span>
            </Label>
            <Input
              placeholder="Contoh: Budi Santoso / Dr. Maya, M.Psi"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className={isControlClass}
            />
          </div>

          {/* 2. Email & Password */}
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
                className={isControlClass}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold">
                Password <span className="text-rose-500">*</span>
              </Label>
              <PasswordInput
                placeholder="Min. 6 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={isControlClass}
              />
            </div>
          </div>

          {/* 3. Peran Akun & Status Awal (Ukuran Select seragam h-9) */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold">
                Peran Akun <span className="text-rose-500">*</span>
              </Label>
              <Select value={role} onValueChange={(val) => setRole(val as ApiRole)}>
                <SelectTrigger className={isControlClass}>
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
                <SelectTrigger className={isControlClass}>
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

          {/* 4. WhatsApp */}
          <div className="space-y-1">
            <Label className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold">
              Nomor WhatsApp (Opsional)
            </Label>
            <PhoneInput
              placeholder="812 3456 7890"
              value={noWa}
              onChange={(e) => setNoWa(e.target.value)}
              className={isControlClass}
            />
          </div>

          {/* 5. Conditional: Khusus Admin */}
          {role === "admin" && (
            <div className="space-y-1 animate-in fade-in">
              <Label className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold">
                Tingkat Akses Admin
              </Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger className={isControlClass}>
                  <SelectValue placeholder="Pilih Level" />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectItem value="operator">Operator (Kelola Pengguna & Konten)</SelectItem>
                  <SelectItem value="superadmin">Superadministrator (Akses Penuh Sistem)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 6. Conditional: Khusus Psikolog (Sesuai Form Registrasi Konselor) */}
          {role === "psikolog" && (
            <div className="space-y-3 p-3.5 rounded-xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200/80 dark:border-teal-900/60 animate-in fade-in">
              <div className="flex items-center gap-1.5 text-xs font-bold text-teal-900 dark:text-teal-200">
                <GraduationCap size={15} className="text-teal-600" />
                <span>Kredensial & Berkas Praktik Psikolog</span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold">
                    Nomor SIPP / STR
                  </Label>
                  <Input
                    placeholder="Contoh: SIPP-2024-9988"
                    value={nomorSipp}
                    onChange={(e) => setNomorSipp(e.target.value)}
                    className={isControlClass}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold">
                    Pengalaman Praktik (Tahun)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="Contoh: 3"
                    value={tahunPengalaman}
                    onChange={(e) => setTahunPengalaman(e.target.value)}
                    className={isControlClass}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold">
                  Tarif Sesi Telekonsultasi Rp (Opsional)
                </Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="Contoh: 150000"
                  value={tarifSesi}
                  onChange={(e) => setTarifSesi(e.target.value)}
                  className={isControlClass}
                />
              </div>

              {/* Bidang Spesialisasi Toggle */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold">
                    Bidang Spesialisasi Klinis
                  </Label>
                  <span className="text-[10px] text-slate-400">Pilih yang relevan</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {SPECIALTY_OPTIONS.map((item) => {
                    const isSelected = selectedSpecialties.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => handleToggleSpecialty(item)}
                        className={`text-[10px] px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer border ${
                          isSelected
                            ? "bg-teal-600 text-white border-teal-600 font-semibold shadow-2xs"
                            : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-teal-400"
                        }`}
                      >
                        {isSelected ? `✓ ${item}` : `+ ${item}`}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Upload Dokumen SIPP/STR */}
              <div className="space-y-1.5 pt-1">
                <Label className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold block">
                  Unggah Dokumen Lisensi SIPP / STR (PDF / JPG / PNG)
                </Label>
                <label className="p-3 rounded-xl border border-dashed border-teal-300 dark:border-teal-800 bg-white/70 dark:bg-slate-900/60 text-center space-y-1.5 block cursor-pointer hover:bg-teal-50/40 dark:hover:bg-slate-900/80 transition-colors">
                  <input
                    type="file"
                    accept=".pdf,image/png,image/jpeg"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={submitting}
                  />
                  <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/80 text-teal-700 dark:text-teal-300 flex items-center justify-center mx-auto">
                    {selectedFile ? <FileCheck2 size={16} /> : <UploadCloud size={16} />}
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400">
                    {selectedFile ? (
                      <div className="flex items-center justify-center gap-1.5 font-semibold text-teal-700 dark:text-teal-300 font-mono">
                        <span>{selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFile(null);
                          }}
                          className="p-0.5 rounded hover:bg-rose-100 text-rose-500"
                          title="Hapus file"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <span>Klik untuk memilih berkas SIPP/STR (Maks. 5MB)</span>
                    )}
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* 7. Conditional: Khusus Relawan (Sesuai Form Registrasi Pendengar Sebaya) */}
          {role === "relawan" && (
            <div className="space-y-3 p-3.5 rounded-xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200/80 dark:border-teal-900/60 animate-in fade-in">
              <div className="flex items-center gap-1.5 text-xs font-bold text-teal-900 dark:text-teal-200">
                <Briefcase size={15} className="text-teal-600" />
                <span>Profil & Berkas Pendengar Sebaya</span>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold">
                  Latar Belakang Pendidikan / Pengalaman
                </Label>
                <Input
                  placeholder="Misal: Mahasiswa Psikologi S1 semester 6 / Pelatihan PFA"
                  value={latarBelakang}
                  onChange={(e) => setLatarBelakang(e.target.value)}
                  className={isControlClass}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold">
                  Alasan Bergabung sebagai Relawan
                </Label>
                <Input
                  placeholder="Misal: Ingin mengasah empati aktif dan membantu sesama"
                  value={alasanBergabung}
                  onChange={(e) => setAlasanBergabung(e.target.value)}
                  className={isControlClass}
                />
              </div>

              {/* Upload Dokumen CV/Portofolio */}
              <div className="space-y-1.5 pt-1">
                <Label className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold block">
                  Unggah Dokumen CV / Portofolio Relawan (PDF / JPG / PNG)
                </Label>
                <label className="p-3 rounded-xl border border-dashed border-teal-300 dark:border-teal-800 bg-white/70 dark:bg-slate-900/60 text-center space-y-1.5 block cursor-pointer hover:bg-teal-50/40 dark:hover:bg-slate-900/80 transition-colors">
                  <input
                    type="file"
                    accept=".pdf,image/png,image/jpeg"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={submitting}
                  />
                  <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/80 text-teal-700 dark:text-teal-300 flex items-center justify-center mx-auto">
                    {selectedFile ? <FileCheck2 size={16} /> : <UploadCloud size={16} />}
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400">
                    {selectedFile ? (
                      <div className="flex items-center justify-center gap-1.5 font-semibold text-teal-700 dark:text-teal-300 font-mono">
                        <span>{selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFile(null);
                          }}
                          className="p-0.5 rounded hover:bg-rose-100 text-rose-500"
                          title="Hapus file"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <span>Klik untuk memilih berkas CV / Sertifikat (Maks. 5MB)</span>
                    )}
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* 8. Footer: Button Daftarkan Pengguna memanjang & Batal di ujung */}
          <div className="pt-3 flex items-center gap-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="submit"
              disabled={submitting}
              size="sm"
              className="flex-1 h-9 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs gap-1.5 cursor-pointer shadow-xs"
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-9 px-4 rounded-xl border-slate-200 dark:border-slate-700 text-xs cursor-pointer text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
            >
              Batal
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
