"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/shared/atoms/theme-toggle";
import {
  HeartHandshake,
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
  FileCheck2,
  CheckCircle2,
  Clock,
  Sparkles,
  Users,
  AlertTriangle,
  BookOpen,
  UploadCloud,
  AlertCircle,
} from "lucide-react";
import { notify } from "@/lib/toast";
import { authService } from "@/services/auth.service";

const listenerTopicInterests = [
  "Curhat Stres Kuliah & Skripsi",
  "Quarter-Life Crisis & Arah Hidup",
  "Kesepian & Rasa Hampa",
  "Overthinking Masa Depan",
  "Kelelahan Kerja (Burnout)",
  "Beban Ekspektasi Keluarga",
];

export default function ListenerRegistrationPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [alias, setAlias] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [pfaBackground, setPfaBackground] = useState("");
  const [reasonToJoin, setReasonToJoin] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [agreeRules, setAgreeRules] = useState(false);

  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleToggleTopic = (topic: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      notify.warning("Ukuran File Terlalu Besar", "Ukuran file CV maksimal 2MB.");
      return;
    }
    setSelectedFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!fullName.trim() || fullName.length < 2) {
      setFormError("Nama lengkap minimal 2 karakter.");
      notify.warning("Data Belum Lengkap", "Nama lengkap minimal 2 karakter.");
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

    if (!pfaBackground.trim()) {
      setFormError("Latar belakang atau riwayat pelatihan PFA wajib diisi.");
      notify.warning("Data Kosong", "Latar belakang wajib diisi.");
      return;
    }

    if (!selectedFile) {
      setFormError("Dokumen CV wajib diunggah (PDF, maksimal 2MB).");
      notify.warning("Berkas Kosong", "Dokumen CV wajib diunggah.");
      return;
    }

    if (!reasonToJoin.trim() || reasonToJoin.length < 10) {
      setFormError("Alasan bergabung minimal 10 karakter.");
      notify.warning("Alasan Kosong", "Alasan bergabung minimal 10 karakter.");
      return;
    }

    if (!agreeRules) {
      setFormError("Anda wajib menyetujui pakta integritas relawan.");
      notify.warning("Persetujuan Diperlukan", "Setujui pakta integritas untuk melanjutkan.");
      return;
    }

    setLoading(true);

    try {
      // 1. Dapatkan presigned upload URL
      const presigned = await authService.getPresignedUrl({
        file_name: selectedFile.name,
        file_type: selectedFile.type || "application/pdf",
        document_type: "cv",
        user_email_or_temp_id: email.trim().toLowerCase(),
      });

      // 2. Unggah file binary ke storage
      await authService.uploadBinaryFile(presigned.data.upload_url, selectedFile);

      // 3. Normalisasi nomor kontak
      let cleanPhone = phone.trim().replace(/[\s-]/g, "");
      if (cleanPhone.startsWith("+")) cleanPhone = cleanPhone.substring(1);
      if (cleanPhone.startsWith("8")) cleanPhone = "0" + cleanPhone;

      // 4. Submit registrasi relawan
      const res = await authService.registerRelawan({
        nama_lengkap: fullName.trim(),
        email: email.trim().toLowerCase(),
        no_wa: cleanPhone,
        password,
        password_confirmation: passwordConfirmation,
        latar_belakang: pfaBackground.trim(),
        dokumen_cv_url: presigned.data.file_path,
        alasan_bergabung: reasonToJoin.trim(),
      });

      if (res.success) {
        notify.success("Pendaftaran Terkirim", res.message || "Aplikasi Anda berhasil diajukan.");
        setIsSubmitted(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mengajukan pendaftaran. Periksa koneksi dan data.";
      setFormError(msg);
      notify.error("Registrasi Gagal", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-10 px-4 relative overflow-hidden bg-gradient-to-br from-pink-50/70 via-slate-50 to-teal-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-teal-950/40 text-slate-900 dark:text-slate-100 font-nunito transition-colors duration-200">
      {/* Ambient Glow Orbs */}
      <div className="absolute top-10 right-10 w-96 h-96 rounded-full bg-pink-200/20 dark:bg-pink-900/15 blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-96 h-96 rounded-full bg-teal-200/20 dark:bg-teal-900/10 blur-3xl pointer-events-none" />

      {/* Top Header Navigation */}
      <div className="max-w-3xl mx-auto mb-6 flex items-center justify-between relative z-10">
        <Link
          href="/register"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-pink-700 dark:hover:text-pink-400 transition-colors"
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
            <div className="w-16 h-16 rounded-full bg-pink-50 dark:bg-pink-950/80 border border-pink-200 dark:border-pink-800 text-pink-600 dark:text-pink-400 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 size={36} />
            </div>

            <div className="space-y-2 max-w-lg mx-auto">
              <Badge className="bg-pink-100 dark:bg-pink-950 text-pink-800 dark:text-pink-300 border-pink-300 font-semibold text-xs px-3 py-1">
                Aplikasi Relawan Terkirim
              </Badge>
              <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 dark:text-white">
                Pendaftaran Relawan Berhasil Dikirim!
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-nunito leading-relaxed">
                Terima kasih atas kepedulianmu, <strong>{fullName}</strong>. Berkas CV dan data profil Anda telah masuk ke sistem peninjauan tim kurasi TemanBicara.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 max-w-md mx-auto text-left space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-pink-100 dark:bg-pink-900/60 text-pink-700 dark:text-pink-300 flex items-center justify-center font-bold text-xs shrink-0">
                  1
                </div>
                <div className="text-xs">
                  <p className="font-bold text-slate-800 dark:text-slate-200">Verifikasi Dokumen CV</p>
                  <p className="text-[11px] text-slate-500">Estimasi proses review 1 - 3 hari kerja</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold text-xs shrink-0">
                  2
                </div>
                <div className="text-xs">
                  <p className="font-bold text-slate-700 dark:text-slate-300">Pemberitahuan via Email & WA</p>
                  <p className="text-[11px] text-slate-500">Hasil verifikasi akan dikirim langsung ke akun Anda</p>
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/login">
                <Button
                  className="w-full sm:w-auto text-xs bg-pink-600 hover:bg-pink-700 text-white rounded-xl h-10 px-6 font-bold shadow-xs cursor-pointer gap-2"
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
              <div className="w-12 h-12 rounded-2xl bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20 flex items-center justify-center mx-auto mb-2">
                <HeartHandshake size={24} />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold font-heading text-slate-900 dark:text-white">
                Pendaftaran Relawan Pendengar Sebaya
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-nunito max-w-lg mx-auto">
                Bantu ringankan beban mereka yang sedang lelah. Berikan ruang mendengar tanpa menghakimi dengan prinsip dasar Psychological First Aid (PFA).
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
                <h3 className="text-xs font-bold text-pink-700 dark:text-pink-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Users size={14} />
                  <span>1. Identitas & Akun Relawan</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Nama Lengkap Resmi
                    </label>
                    <Input
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Contoh: Siti Nurhaliza"
                      className="h-10 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/60 rounded-xl"
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Nama Samaran / Panggilan di Chat
                    </label>
                    <Input
                      value={alias}
                      onChange={(e) => setAlias(e.target.value)}
                      placeholder="Contoh: Kak Siti"
                      className="h-10 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/60 rounded-xl"
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Alamat Email
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
                      Nomor WhatsApp
                    </label>
                    <Input
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="081987654321"
                      className="h-10 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/60 rounded-xl"
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Kata Sandi
                    </label>
                    <Input
                      required
                      type="password"
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
                    <Input
                      required
                      type="password"
                      value={passwordConfirmation}
                      onChange={(e) => setPasswordConfirmation(e.target.value)}
                      placeholder="Ulangi kata sandi"
                      className="h-10 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/60 rounded-xl"
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>

              {/* Bagian 2: Latar Belakang & Alasan */}
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-bold text-pink-700 dark:text-pink-300 uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen size={14} />
                  <span>2. Latar Belakang & Komitmen</span>
                </h3>

                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Latar Belakang Pendidikan / Pengalaman PFA
                    </label>
                    <Input
                      required
                      value={pfaBackground}
                      onChange={(e) => setPfaBackground(e.target.value)}
                      placeholder="Contoh: Mahasiswa S1 Psikologi Semester 7 / Sertifikat PFA Kemenkes"
                      className="h-10 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/60 rounded-xl"
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Alasan Ingin Bergabung Menjadi Relawan
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={reasonToJoin}
                      onChange={(e) => setReasonToJoin(e.target.value)}
                      placeholder="Jelaskan motivasi Anda menjadi pendengar suportif bagi sesama..."
                      className="w-full p-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-pink-500"
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>

              {/* Bagian 3: Minat Topik Curhat */}
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-bold text-pink-700 dark:text-pink-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={14} />
                  <span>3. Topik Curhat Pilihan (Opsional)</span>
                </h3>

                <div className="flex flex-wrap gap-1.5">
                  {listenerTopicInterests.map((topic) => {
                    const isSelected = selectedTopics.includes(topic);
                    return (
                      <button
                        key={topic}
                        type="button"
                        onClick={() => handleToggleTopic(topic)}
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer border ${
                          isSelected
                            ? "bg-pink-600 text-white border-pink-600 shadow-2xs font-semibold"
                            : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-pink-300"
                        }`}
                      >
                        {isSelected ? `✓ ${topic}` : `+ ${topic}`}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bagian 4: Upload Bukti CV */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  4. Unggah Dokumen CV (PDF, Maksimal 2MB):
                </label>
                <label className="p-4 rounded-2xl border-2 border-dashed border-pink-300 dark:border-pink-800 bg-pink-50/30 dark:bg-pink-950/20 text-center space-y-2 block cursor-pointer hover:bg-pink-50/50 transition-colors">
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={loading}
                  />
                  <div className="w-10 h-10 rounded-full bg-pink-100 dark:bg-pink-900/80 text-pink-700 dark:text-pink-300 flex items-center justify-center mx-auto">
                    {selectedFile ? <FileCheck2 size={20} /> : <UploadCloud size={20} />}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 font-nunito">
                    {selectedFile ? (
                      <span className="font-semibold text-pink-700 dark:text-pink-300 font-mono">
                        {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)
                      </span>
                    ) : (
                      <span>Klik untuk memilih file CV dari perangkat Anda</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Format didukung: PDF resmi (Maksimal 2MB)
                  </p>
                </label>
              </div>

              {/* Pakta Integritas */}
              <div className="space-y-2 pt-1">
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="agreeRules"
                    required
                    checked={agreeRules}
                    onChange={(e) => setAgreeRules(e.target.checked)}
                    className="mt-1 rounded border-slate-300 text-pink-600 focus:ring-pink-500 cursor-pointer"
                  />
                  <label htmlFor="agreeRules" className="text-xs text-slate-600 dark:text-slate-400 font-nunito leading-relaxed cursor-pointer">
                    Saya menyatakan data yang diberikan adalah benar dan berkomitmen mendampingi dengan empati tanpa menghakimi.
                  </label>
                </div>
              </div>

              {/* Submit CTA */}
              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold h-11 rounded-xl text-xs sm:text-sm shadow-md shadow-pink-600/20 cursor-pointer"
                >
                  {loading ? "Mengunggah & Mengirim Data..." : "Kirim Pendaftaran Relawan"}
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
