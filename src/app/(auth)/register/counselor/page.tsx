"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/shared/atoms/theme-toggle";
import {
  Stethoscope,
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
  UploadCloud,
  FileCheck2,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  GraduationCap,
} from "lucide-react";
import { notify } from "@/lib/toast";
import { authService } from "@/services/auth.service";
import { usePublicSettings } from "@/hooks/use-public-settings";

const specialtyOptions = [
  "Kecemasan & Panic Attack",
  "Workplace Burnout & Tekanan Kerja",
  "Trauma & Regulasi Emosi",
  "Depresi & Mood Disorder",
  "Dinamika Pasangan & Hubungan",
  "Quarter-Life Crisis & Identitas Diri",
  "Pengasuhan Anak & Keluarga",
];

const approachesOptions = [
  "Cognitive Behavioral Therapy (CBT)",
  "Mindfulness-Based Stress Reduction (MBSR)",
  "Acceptance & Commitment Therapy (ACT)",
  "Solution-Focused Brief Therapy (SFBT)",
  "Emotion-Focused Therapy (EFT)",
];

export default function CounselorRegistrationPage() {
  const router = useRouter();
  const { settings } = usePublicSettings();
  const verificationMaxMb = settings?.upload?.verification_max_mb ?? 5;

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [strNumber, setStrNumber] = useState("");
  const [institution, setInstitution] = useState("");
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [selectedApproaches, setSelectedApproaches] = useState<string[]>([]);
  const [experienceYears, setExperienceYears] = useState("");
  const [sessionRate, setSessionRate] = useState("150000");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [agreeCodeOfEthics, setAgreeCodeOfEthics] = useState(false);

  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleToggleSpecialty = (item: string) => {
    setSelectedSpecialties((prev) =>
      prev.includes(item) ? prev.filter((s) => s !== item) : [...prev, item]
    );
  };

  const handleToggleApproach = (item: string) => {
    setSelectedApproaches((prev) =>
      prev.includes(item) ? prev.filter((a) => a !== item) : [...prev, item]
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) {
      notify.warning("Format Berkas Tidak Valid", "Hanya berkas format PDF (.pdf) yang diperbolehkan.");
      e.target.value = "";
      return;
    }

    if (file.size > verificationMaxMb * 1024 * 1024) {
      notify.warning("Ukuran File Terlalu Besar", `Dokumen SIPPK/STR maksimal ${verificationMaxMb} MB.`);
      e.target.value = "";
      return;
    }
    setSelectedFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!fullName.trim() || fullName.length < 3) {
      setFormError("Nama lengkap beserta gelar wajib diisi.");
      notify.warning("Data Belum Lengkap", "Nama dan gelar wajib diisi.");
      return;
    }

    if (!email.trim() || !email.includes("@")) {
      setFormError("Format email tidak valid.");
      notify.warning("Email Tidak Valid", "Format email tidak valid.");
      return;
    }

    if (!password || password.length < 8) {
      setFormError("Kata sandi minimal 8 karakter.");
      notify.warning("Sandi Terlalu Pendek", "Kata sandi minimal 8 karakter.");
      return;
    }

    if (passwordConfirmation !== password) {
      setFormError("Konfirmasi kata sandi tidak cocok.");
      notify.warning("Sandi Tidak Cocok", "Konfirmasi kata sandi tidak cocok.");
      return;
    }

    if (!strNumber.trim() || strNumber.length < 5) {
      setFormError("Nomor SIPP / STR wajib diisi.");
      notify.warning("Kredensial Belum Diisi", "Nomor SIPP/STR wajib diisi.");
      return;
    }

    if (!selectedFile) {
      setFormError("Dokumen SIPP/STR wajib diunggah.");
      notify.warning("Berkas Kosong", "Dokumen SIPP/STR wajib diunggah.");
      return;
    }

    if (selectedFile.type !== "application/pdf" || !selectedFile.name.toLowerCase().endsWith(".pdf")) {
      setFormError("Format dokumen harus PDF (.pdf).");
      notify.warning("Format Berkas Tidak Valid", "Hanya dokumen berformat PDF (.pdf) yang diperbolehkan.");
      return;
    }

    if (selectedFile.size > verificationMaxMb * 1024 * 1024) {
      setFormError(`Dokumen SIPPK/STR maksimal ${verificationMaxMb} MB.`);
      notify.warning("Ukuran File Terlalu Besar", `Dokumen SIPPK/STR maksimal ${verificationMaxMb} MB.`);
      return;
    }

    if (selectedSpecialties.length === 0) {
      setFormError("Pilih minimal 1 bidang spesialisasi klinis.");
      notify.warning("Spesialisasi Kosong", "Pilih minimal 1 spesialisasi.");
      return;
    }

    if (!agreeCodeOfEthics) {
      setFormError("Anda wajib menyetujui komitmen kode etik psikologi.");
      notify.warning("Persetujuan Diperlukan", "Setujui kode etik untuk melanjutkan.");
      return;
    }

    setLoading(true);

    try {
      // 1. Presigned Upload URL
      const presigned = await authService.getPresignedUrl({
        file_name: selectedFile.name,
        file_type: selectedFile.type,
        document_type: "sipp_str",
        user_email_or_temp_id: email.trim().toLowerCase(),
      });

      // 2. Binary Upload
      await authService.uploadBinaryFile(presigned.data.upload_url, selectedFile);

      // 3. Normalisasi telepon
      let cleanPhone = phone.trim().replace(/[\s-]/g, "");
      if (cleanPhone.startsWith("+")) cleanPhone = cleanPhone.substring(1);
      if (cleanPhone.startsWith("8")) cleanPhone = "0" + cleanPhone;

      // 4. Submit registrasi psikolog
      const res = await authService.registerPsikolog({
        nama_lengkap_gelar: fullName.trim(),
        email: email.trim().toLowerCase(),
        no_wa: cleanPhone,
        password,
        password_confirmation: passwordConfirmation,
        nomor_sipp_str: strNumber.trim(),
        dokumen_sipp_str_url: presigned.data.file_path,
        spesialisasi: selectedSpecialties,
        tahun_pengalaman: parseInt(experienceYears, 10) || 0,
        tarif_sesi: parseFloat(sessionRate) || 0,
      });

      if (res.success) {
        notify.success("Pendaftaran Terkirim", res.message || "Aplikasi kemitraan Anda berhasil diajukan.");
        setIsSubmitted(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mengajukan pendaftaran psikolog. Periksa data kembali.";
      setFormError(msg);
      notify.error("Registrasi Gagal", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-10 px-4 relative overflow-hidden bg-gradient-to-br from-teal-50/70 via-slate-50 to-emerald-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-teal-950/40 text-slate-900 dark:text-slate-100 font-nunito transition-colors duration-200">
      {/* Ambient Glow Orbs */}
      <div className="absolute top-10 right-10 w-96 h-96 rounded-full bg-teal-200/20 dark:bg-teal-900/15 blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-96 h-96 rounded-full bg-emerald-200/20 dark:bg-emerald-900/10 blur-3xl pointer-events-none" />

      {/* Top Header Navigation */}
      <div className="max-w-3xl mx-auto mb-6 flex items-center justify-between relative z-10">
        <Link
          href="/register"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-teal-700 dark:hover:text-teal-400 transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Kembali ke Registrasi Pasien</span>
        </Link>

        <ThemeToggle />
      </div>

      <div className="max-w-3xl mx-auto relative z-10">
        {isSubmitted ? (
          /* Confirmation Screen */
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-10 space-y-6 text-center animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-full bg-teal-50 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 size={36} />
            </div>

            <div className="space-y-2 max-w-lg mx-auto">
              <Badge className="bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border-teal-300 font-semibold text-xs px-3 py-1">
                Kredensial Sedang Divalidasi
              </Badge>
              <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 dark:text-white">
                Pendaftaran Kemitraan Berhasil Dikirim!
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-nunito leading-relaxed">
                Terima kasih, <strong>{fullName}</strong>. Berkas SIPPK/STR Anda sedang diverifikasi oleh tim kurasi klinis TemanBicara.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 max-w-md mx-auto text-left space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold text-xs shrink-0">
                  1
                </div>
                <div className="text-xs">
                  <p className="font-bold text-slate-800 dark:text-slate-200">Verifikasi Dokumen SIPPK/STR</p>
                  <p className="text-[11px] text-slate-500">Pengecekan ke database HIMPSI/Kemenkes (1-3 hari kerja)</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold text-xs shrink-0">
                  2
                </div>
                <div className="text-xs">
                  <p className="font-bold text-slate-700 dark:text-slate-300">Aktivasi Ruang Praktik Klinis</p>
                  <p className="text-[11px] text-slate-500">Setelah diverifikasi, Anda dapat mengatur jadwal telekonsultasi</p>
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/login">
                <Button
                  className="w-full sm:w-auto text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-xl h-10 px-6 font-bold shadow-xs cursor-pointer gap-2"
                >
                  <span>Kembali ke Halaman Masuk</span>
                  <ArrowRight size={14} />
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          /* Registration Form */
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-xl p-6 sm:p-10 space-y-6">
            <div className="space-y-2 text-center pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 flex items-center justify-center mx-auto mb-2">
                <Stethoscope size={24} />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold font-heading text-slate-900 dark:text-white">
                Pendaftaran Kemitraan Psikolog Klinis
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-nunito max-w-lg mx-auto">
                Bergabunglah bersama TemanBicara untuk memperluas jangkauan layanan kesehatan mental profesional berbasis etika HIMPSI.
              </p>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0 text-rose-500" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Bagian 1: Identitas & Akun */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-teal-800 dark:text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck size={14} />
                  <span>1. Identitas & Akun Tenaga Psikologi</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Nama Lengkap & Gelar Klinis
                    </label>
                    <Input
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Contoh: Dr. Nadia Wijaya, M.Psi., Psikolog"
                      className="h-10 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/60 rounded-xl"
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Email Profesional
                    </label>
                    <Input
                      required
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nama@email.com"
                      className="h-10 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/60 rounded-xl"
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Nomor WhatsApp Aktif
                    </label>
                    <PhoneInput
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="812 3456 7890"
                      className="h-10 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/60 rounded-xl"
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Pengalaman Praktik (Tahun)
                    </label>
                    <Input
                      required
                      type="number"
                      min="0"
                      value={experienceYears}
                      onChange={(e) => setExperienceYears(e.target.value)}
                      placeholder="Contoh: 5"
                      className="h-10 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/60 rounded-xl"
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Kata Sandi
                    </label>
                    <PasswordInput
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimal 8 karakter"
                      className="h-10 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/60 rounded-xl"
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Konfirmasi Kata Sandi
                    </label>
                    <PasswordInput
                      required
                      value={passwordConfirmation}
                      onChange={(e) => setPasswordConfirmation(e.target.value)}
                      placeholder="Ulangi kata sandi"
                      className="h-10 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/60 rounded-xl"
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>

              {/* Bagian 2: Kredensial Medis & Legalitas */}
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-bold text-teal-800 dark:text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
                  <GraduationCap size={15} />
                  <span>2. Kredensial & Legalitas Praktik (Wajib)</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Nomor SIPP / STR Tenaga Kesehatan
                    </label>
                    <Input
                      required
                      value={strNumber}
                      onChange={(e) => setStrNumber(e.target.value)}
                      placeholder="Contoh: 19876543-2023-STR"
                      className="h-10 text-xs sm:text-sm font-mono bg-slate-50 dark:bg-slate-800/60 rounded-xl"
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Tarif Sesi Telekonsultasi (Rp)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      value={sessionRate}
                      onChange={(e) => setSessionRate(e.target.value)}
                      placeholder="150000"
                      className="h-10 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/60 rounded-xl"
                      disabled={loading}
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Almamater Pendidikan Magister Profesi Psikologi (Opsional)
                    </label>
                    <Input
                      value={institution}
                      onChange={(e) => setInstitution(e.target.value)}
                      placeholder="Universitas Indonesia, UGM, Unpad, dll."
                      className="h-10 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/60 rounded-xl"
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>

              {/* Bagian 3: Spesialisasi Klinis */}
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-bold text-teal-800 dark:text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={14} />
                  <span>3. Spesialisasi Klinis</span>
                </h3>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    Pilih Bidang Spesialisasi:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {specialtyOptions.map((item) => {
                      const isSelected = selectedSpecialties.includes(item);
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => handleToggleSpecialty(item)}
                          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer border ${
                            isSelected
                              ? "bg-teal-600 text-white border-teal-600 shadow-2xs font-semibold"
                              : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-teal-400"
                          }`}
                        >
                          {isSelected ? `✓ ${item}` : `+ ${item}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Bagian 4: Upload Dokumen SIPPK/STR */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  4. Unggah Salinan Dokumen SIPPK / STR (PDF, Maksimal {verificationMaxMb} MB):
                </label>
                <label className="p-4 rounded-2xl border-2 border-dashed border-teal-300 dark:border-teal-800 bg-teal-50/30 dark:bg-teal-950/20 text-center space-y-2 block cursor-pointer hover:bg-teal-50/50 transition-colors">
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={loading}
                  />
                  <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/80 text-teal-700 dark:text-teal-300 flex items-center justify-center mx-auto">
                    {selectedFile ? <FileCheck2 size={20} /> : <UploadCloud size={20} />}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 font-nunito">
                    {selectedFile ? (
                      <span className="font-semibold text-teal-700 dark:text-teal-300 font-mono">
                        {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)
                      </span>
                    ) : (
                      <span>Klik untuk memilih berkas SIPPK/STR dari perangkat Anda</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    PDF, maksimal {verificationMaxMb} MB
                  </p>
                </label>
              </div>

              {/* Pakta Integritas */}
              <div className="space-y-2 pt-1">
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="agreeEthics"
                    required
                    checked={agreeCodeOfEthics}
                    onChange={(e) => setAgreeCodeOfEthics(e.target.checked)}
                    className="mt-1 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                  />
                  <label htmlFor="agreeEthics" className="text-xs text-slate-600 dark:text-slate-400 font-nunito leading-relaxed cursor-pointer">
                    Saya menyatakan secara sadar bahwa data SIPPK dan STR yang saya kirimkan adalah sah dan valid sesuai Kode Etik HIMPSI.
                  </label>
                </div>
              </div>

              {/* Submit CTA */}
              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold h-11 rounded-xl text-xs sm:text-sm shadow-md shadow-teal-600/20 cursor-pointer"
                >
                  {loading ? "Mengunggah & Memproses..." : "Kirim Pengajuan Kemitraan Psikolog"}
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
