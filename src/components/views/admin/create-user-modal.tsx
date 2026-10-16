"use client";

import React, { useState, useMemo } from "react";
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
  GraduationCap,
  Briefcase,
} from "lucide-react";
import { userService } from "@/services/user.service";
import { authService } from "@/services/auth.service";
import { notify } from "@/lib/toast";
import type { ApiRole, ApiAccountStatus } from "@/types/user-profile";
import {
  adminCreatePsikologSchema,
  adminCreateRelawanSchema,
  phoneRegex,
} from "@/lib/validations/auth";
import { cn } from "@/lib/utils";

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

  // Field touched state untuk tracking error per isian
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const markTouched = (field: string) => {
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  };

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
    setTouched({});
  };

  const handleRoleChange = (newRole: ApiRole) => {
    setRole(newRole);
    setTouched({});
    setSelectedFile(null);
  };

  const handleToggleSpecialty = (item: string) => {
    markTouched("spesialisasi");
    setSelectedSpecialties((prev) =>
      prev.includes(item) ? prev.filter((s) => s !== item) : [...prev, item]
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    markTouched("document");
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        notify.warning("Ukuran Terlalu Besar", "Maksimal ukuran dokumen adalah 5MB");
        return;
      }
      setSelectedFile(file);
    }
  };

  // Validasi Zod per isian sesuai role
  const errors = useMemo(() => {
    const errs: Record<string, string> = {};

    if (role === "psikolog") {
      const numTarif = tarifSesi.trim() === "" ? 0 : Number(tarifSesi);
      const numPengalaman = tahunPengalaman.trim() === "" ? -1 : Number(tahunPengalaman);

      const parsed = adminCreatePsikologSchema.safeParse({
        nama_lengkap_gelar: fullName.trim(),
        email: email.trim(),
        no_wa: noWa.trim(),
        password,
        nomor_sipp_str: nomorSipp.trim(),
        dokumen_sipp_str_url: selectedFile ? selectedFile.name : "",
        spesialisasi: selectedSpecialties,
        tahun_pengalaman: numPengalaman,
        tarif_sesi: Number.isNaN(numTarif) ? -1 : numTarif,
      });

      if (!parsed.success) {
        parsed.error.issues.forEach((issue) => {
          const field = issue.path[0] as string;
          if (!errs[field]) {
            errs[field] = issue.message;
          }
        });
      }
    } else if (role === "relawan") {
      const parsed = adminCreateRelawanSchema.safeParse({
        nama_lengkap: fullName.trim(),
        email: email.trim(),
        no_wa: noWa.trim(),
        password,
        latar_belakang: latarBelakang.trim(),
        dokumen_cv_url: selectedFile ? selectedFile.name : "",
        alasan_bergabung: alasanBergabung.trim(),
      });

      if (!parsed.success) {
        parsed.error.issues.forEach((issue) => {
          const field = issue.path[0] as string;
          if (!errs[field]) {
            errs[field] = issue.message;
          }
        });
      }
    } else if (role === "pasien") {
      if (!fullName.trim() || fullName.trim().length < 2) {
        errs.fullName = "Nama lengkap minimal 2 karakter";
      }
      if (!email.trim() || !email.includes("@")) {
        errs.email = "Format email tidak valid";
      }
      if (!password || password.length < 6) {
        errs.password = "Password minimal 6 karakter";
      }
      if (noWa.trim() && !phoneRegex.test(noWa.trim())) {
        errs.no_wa = "Format nomor WhatsApp tidak valid (contoh: 08123456789)";
      }
    } else if (role === "admin") {
      if (!fullName.trim() || fullName.trim().length < 2) {
        errs.fullName = "Nama lengkap minimal 2 karakter";
      }
      if (!email.trim() || !email.includes("@")) {
        errs.email = "Format email tidak valid";
      }
      if (!password || password.length < 6) {
        errs.password = "Password minimal 6 karakter";
      }
      if (noWa.trim() && !phoneRegex.test(noWa.trim())) {
        errs.no_wa = "Format nomor WhatsApp tidak valid (contoh: 08123456789)";
      }
      if (!level) {
        errs.level = "Level akses wajib dipilih";
      }
    }

    return errs;
  }, [
    role,
    fullName,
    email,
    password,
    noWa,
    nomorSipp,
    selectedFile,
    selectedSpecialties,
    tahunPengalaman,
    tarifSesi,
    latarBelakang,
    alasanBergabung,
    level,
  ]);

  const isValid = Object.keys(errors).length === 0;

  const getError = (key: string) => {
    if (!touched[key]) return undefined;
    return errors[key];
  };

  const isControlClass =
    "w-full h-9 text-xs bg-slate-50/50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 rounded-xl transition-colors";

  const getControlClass = (key: string) =>
    cn(isControlClass, getError(key) && "border-rose-400 dark:border-rose-500 focus-visible:ring-rose-400/30");

  const nameError =
    role === "psikolog"
      ? getError("nama_lengkap_gelar")
      : role === "relawan"
        ? getError("nama_lengkap")
        : getError("fullName");

  const docError = role === "psikolog" ? getError("dokumen_sipp_str_url") : getError("dokumen_cv_url");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      notify.warning("Form Belum Lengkap", "Mohon lengkapi seluruh isian wajib dengan data valid.");
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
        tarif_sesi: role === "psikolog" ? (tarifSesi.trim() ? Number(tarifSesi) : 0) : undefined,
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
              {role === "psikolog" ? "Nama Lengkap & Gelar" : "Nama Lengkap"} <span className="text-rose-500">*</span>
            </Label>
            <Input
              placeholder={role === "psikolog" ? "Contoh: Dr. Maya Indah, M.Psi., Psikolog" : "Contoh: Budi Santoso"}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              onBlur={() => markTouched(role === "psikolog" ? "nama_lengkap_gelar" : role === "relawan" ? "nama_lengkap" : "fullName")}
              required
              className={getControlClass(role === "psikolog" ? "nama_lengkap_gelar" : role === "relawan" ? "nama_lengkap" : "fullName")}
            />
            {nameError && <p className="text-[10px] text-rose-500 font-medium">{nameError}</p>}
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
                onBlur={() => markTouched("email")}
                required
                className={getControlClass("email")}
              />
              {getError("email") && <p className="text-[10px] text-rose-500 font-medium">{getError("email")}</p>}
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold">
                Password {role === "psikolog" || role === "relawan" ? "(Min. 8 char)" : "(Min. 6 char)"} <span className="text-rose-500">*</span>
              </Label>
              <PasswordInput
                placeholder={role === "psikolog" || role === "relawan" ? "Min. 8 karakter" : "Min. 6 karakter"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => markTouched("password")}
                required
                className={getControlClass("password")}
              />
              {getError("password") && <p className="text-[10px] text-rose-500 font-medium">{getError("password")}</p>}
            </div>
          </div>

          {/* 3. Peran Akun & Status Awal */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold">
                Peran Akun <span className="text-rose-500">*</span>
              </Label>
              <Select value={role} onValueChange={(val) => handleRoleChange(val as ApiRole)}>
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
              Nomor WhatsApp {role === "psikolog" || role === "relawan" ? <span className="text-rose-500">*</span> : "(Opsional)"}
            </Label>
            <PhoneInput
              placeholder="812 3456 7890"
              value={noWa}
              onChange={(e) => setNoWa(e.target.value)}
              onBlur={() => markTouched("no_wa")}
              className={getControlClass("no_wa")}
            />
            {getError("no_wa") && <p className="text-[10px] text-rose-500 font-medium">{getError("no_wa")}</p>}
          </div>

          {/* 5. Conditional: Khusus Admin */}
          {role === "admin" && (
            <div className="space-y-1 animate-in fade-in">
              <Label className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold">
                Tingkat Akses Admin <span className="text-rose-500">*</span>
              </Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger className={getControlClass("level")}>
                  <SelectValue placeholder="Pilih Level" />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectItem value="operator">Operator (Kelola Pengguna & Konten)</SelectItem>
                  <SelectItem value="superadmin">Superadministrator (Akses Penuh Sistem)</SelectItem>
                </SelectContent>
              </Select>
              {getError("level") && <p className="text-[10px] text-rose-500 font-medium">{getError("level")}</p>}
            </div>
          )}

          {/* 6. Conditional: Khusus Psikolog */}
          {role === "psikolog" && (
            <div className="space-y-3 p-3.5 rounded-xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200/80 dark:border-teal-900/60 animate-in fade-in">
              <div className="flex items-center gap-1.5 text-xs font-bold text-teal-900 dark:text-teal-200">
                <GraduationCap size={15} className="text-teal-600" />
                <span>Kredensial & Berkas Praktik Psikolog</span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold">
                    Nomor SIPP / STR <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    placeholder="Contoh: SIPP-2024-9988"
                    value={nomorSipp}
                    onChange={(e) => setNomorSipp(e.target.value)}
                    onBlur={() => markTouched("nomor_sipp_str")}
                    className={getControlClass("nomor_sipp_str")}
                  />
                  {getError("nomor_sipp_str") && (
                    <p className="text-[10px] text-rose-500 font-medium">{getError("nomor_sipp_str")}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold">
                    Pengalaman Praktik (Tahun) <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="Contoh: 3"
                    value={tahunPengalaman}
                    onChange={(e) => setTahunPengalaman(e.target.value)}
                    onBlur={() => markTouched("tahun_pengalaman")}
                    className={getControlClass("tahun_pengalaman")}
                  />
                  {getError("tahun_pengalaman") && (
                    <p className="text-[10px] text-rose-500 font-medium">{getError("tahun_pengalaman")}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold">
                  Tarif Sesi Telekonsultasi Rp (Kelipatan Rp 10.000)
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="10000"
                  placeholder="Contoh: 150000"
                  value={tarifSesi}
                  onChange={(e) => setTarifSesi(e.target.value)}
                  onBlur={() => markTouched("tarif_sesi")}
                  className={getControlClass("tarif_sesi")}
                />
                {getError("tarif_sesi") && (
                  <p className="text-[10px] text-rose-500 font-medium">{getError("tarif_sesi")}</p>
                )}
              </div>

              {/* Bidang Spesialisasi Toggle */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold">
                    Bidang Spesialisasi Klinis <span className="text-rose-500">*</span>
                  </Label>
                  <span className="text-[10px] text-slate-400">Minimal pilih 1</span>
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
                {getError("spesialisasi") && (
                  <p className="text-[10px] text-rose-500 font-medium">{getError("spesialisasi")}</p>
                )}
              </div>

              {/* Upload Dokumen SIPP/STR */}
              <div className="space-y-1.5 pt-1">
                <Label className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold block">
                  Unggah Dokumen Lisensi SIPP / STR (PDF / JPG / PNG) <span className="text-rose-500">*</span>
                </Label>
                <label
                  className={cn(
                    "p-3 rounded-xl border border-dashed bg-white/70 dark:bg-slate-900/60 text-center space-y-1.5 block cursor-pointer hover:bg-teal-50/40 dark:hover:bg-slate-900/80 transition-colors",
                    docError
                      ? "border-rose-400 dark:border-rose-500 bg-rose-50/30"
                      : "border-teal-300 dark:border-teal-800"
                  )}
                >
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
                        <span>
                          {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFile(null);
                            markTouched("document");
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
                {docError && <p className="text-[10px] text-rose-500 font-medium">{docError}</p>}
              </div>
            </div>
          )}

          {/* 7. Conditional: Khusus Relawan */}
          {role === "relawan" && (
            <div className="space-y-3 p-3.5 rounded-xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200/80 dark:border-teal-900/60 animate-in fade-in">
              <div className="flex items-center gap-1.5 text-xs font-bold text-teal-900 dark:text-teal-200">
                <Briefcase size={15} className="text-teal-600" />
                <span>Profil & Berkas Pendengar Sebaya</span>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold">
                  Latar Belakang Pendidikan / Pengalaman <span className="text-rose-500">*</span>
                </Label>
                <Input
                  placeholder="Misal: Mahasiswa Psikologi S1 semester 6 / Pelatihan PFA"
                  value={latarBelakang}
                  onChange={(e) => setLatarBelakang(e.target.value)}
                  onBlur={() => markTouched("latar_belakang")}
                  className={getControlClass("latar_belakang")}
                />
                {getError("latar_belakang") && (
                  <p className="text-[10px] text-rose-500 font-medium">{getError("latar_belakang")}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold">
                  Alasan Bergabung sebagai Relawan <span className="text-rose-500">*</span>
                </Label>
                <Input
                  placeholder="Misal: Ingin mengasah empati aktif dan membantu sesama (min. 10 karakter)"
                  value={alasanBergabung}
                  onChange={(e) => setAlasanBergabung(e.target.value)}
                  onBlur={() => markTouched("alasan_bergabung")}
                  className={getControlClass("alasan_bergabung")}
                />
                {getError("alasan_bergabung") && (
                  <p className="text-[10px] text-rose-500 font-medium">{getError("alasan_bergabung")}</p>
                )}
              </div>

              {/* Upload Dokumen CV/Portofolio */}
              <div className="space-y-1.5 pt-1">
                <Label className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold block">
                  Unggah Dokumen CV / Portofolio Relawan (PDF / JPG / PNG) <span className="text-rose-500">*</span>
                </Label>
                <label
                  className={cn(
                    "p-3 rounded-xl border border-dashed bg-white/70 dark:bg-slate-900/60 text-center space-y-1.5 block cursor-pointer hover:bg-teal-50/40 dark:hover:bg-slate-900/80 transition-colors",
                    docError
                      ? "border-rose-400 dark:border-rose-500 bg-rose-50/30"
                      : "border-teal-300 dark:border-teal-800"
                  )}
                >
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
                        <span>
                          {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFile(null);
                            markTouched("document");
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
                {docError && <p className="text-[10px] text-rose-500 font-medium">{docError}</p>}
              </div>
            </div>
          )}

          {/* 8. Footer: Button Daftarkan Pengguna & Batal */}
          <div className="pt-3 flex items-center gap-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="submit"
              disabled={!isValid || submitting}
              size="sm"
              className="flex-1 h-9 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
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
