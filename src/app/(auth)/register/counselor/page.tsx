"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/shared/atoms/Logo";
import { ThemeToggle } from "@/components/shared/atoms/theme-toggle";
import {
  Stethoscope,
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
  UploadCloud,
  FileCheck2,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertCircle,
  Building2,
  GraduationCap,
} from "lucide-react";
import { useVerificationStore } from "@/store/verification-store";
import { useUserStore } from "@/store/user-store";

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
  const addVerification = useVerificationStore((state) => state.addVerification);
  const loginWithRole = useUserStore((state) => state.loginWithRole);

  const [fullName, setFullName] = useState("Dr. Dimas Prasetyo, M.Psi., Psikolog");
  const [email, setEmail] = useState("dimas.prasetyo@email.com");
  const [phone, setPhone] = useState("+62 812-9988-7711");
  const [sippkNumber, setSippkNumber] = useState("SIPPK-202304-1082-03");
  const [strNumber, setStrNumber] = useState("STR-198804-09821");
  const [institution, setInstitution] = useState("Magister Profesi Psikologi Klinis - Universitas Indonesia");
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([
    "Kecemasan & Panic Attack",
    "Workplace Burnout & Tekanan Kerja",
  ]);
  const [selectedApproaches, setSelectedApproaches] = useState<string[]>([
    "Cognitive Behavioral Therapy (CBT)",
  ]);
  const [experienceYears, setExperienceYears] = useState("8");
  const [hourlyRateCoins, setHourlyRateCoins] = useState("15");
  const [uploadedFile, setUploadedFile] = useState<string>("SIPPK_STR_DimasPrasetyo_2026.pdf");
  const [agreeCodeOfEthics, setAgreeCodeOfEthics] = useState(true);

  const [loading, setLoading] = useState(false);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    setTimeout(() => {
      // Simpan ke verification store
      addVerification({
        applicantName: fullName,
        applicantEmail: email,
        roleType: "Psikolog Klinis",
        credentialNumber: `SIPPK: ${sippkNumber} | STR: ${strNumber}`,
        institution: institution,
        documentName: uploadedFile || "Dokumen_SIPPK_Psikolog.pdf",
        specialty: selectedSpecialties.join(", "),
        notes: `Pengalaman: ${experienceYears} tahun. Pendekatan: ${selectedApproaches.join(", ")}. Tarif: ${hourlyRateCoins} Koin.`,
      });

      setLoading(false);
      setIsSubmitted(true);
    }, 600);
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
            <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 size={36} />
            </div>

            <div className="space-y-2 max-w-lg mx-auto">
              <Badge className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 font-semibold text-xs px-3 py-1">
                Aplikasi Kredensial Medis Terkirim
              </Badge>
              <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 dark:text-white">
                Pendaftaran Kemitraan Berhasil Dikirim!
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-nunito leading-relaxed">
                Terima kasih, <strong>{fullName}</strong>. Data kredensial SIPPK dan STR Anda telah masuk ke sistem audit kepatuhan medis TemanBicara.
              </p>
            </div>

            {/* Verification Stepper Progress */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 max-w-md mx-auto text-left space-y-3.5">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  ✓
                </span>
                <div className="text-xs">
                  <p className="font-bold text-slate-900 dark:text-white">Formulir Kemitraan Diterima</p>
                  <p className="text-[11px] text-slate-500">Kredensial SIPPK: {sippkNumber}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold shrink-0 animate-pulse">
                  ⏳
                </span>
                <div className="text-xs">
                  <p className="font-bold text-amber-800 dark:text-amber-300">Peninjauan Dokumen oleh Admin</p>
                  <p className="text-[11px] text-slate-500">Estimasi verifikasi: 1 x 24 Jam kerja</p>
                </div>
              </div>

              <div className="flex items-center gap-3 opacity-60">
                <span className="w-6 h-6 rounded-full bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center text-xs font-bold shrink-0">
                  3
                </span>
                <div className="text-xs">
                  <p className="font-bold text-slate-700 dark:text-slate-300">Aktivasi Portal Konseling</p>
                  <p className="text-[11px] text-slate-500">Mulai membuka slot praktik mandiri & melayani pasien</p>
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/admin/verifications">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto text-xs border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-slate-800 rounded-xl h-10 px-5 font-semibold cursor-pointer"
                >
                  Buka Panel Verifikasi Admin (Demo)
                </Button>
              </Link>

              <Button
                onClick={() => {
                  loginWithRole("counselor");
                  router.push("/counselor/beranda");
                }}
                className="w-full sm:w-auto text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-xl h-10 px-6 font-bold shadow-xs cursor-pointer gap-2"
              >
                <span>Masuk ke Portal Psikolog (Demo)</span>
                <ArrowRight size={14} />
              </Button>
            </div>
          </div>
        ) : (
          /* Registration Form */
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-xl p-6 sm:p-10 space-y-6">
            {/* Header Form */}
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

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Bagian 1: Identitas Pribadi & Gelar */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-teal-800 dark:text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck size={14} />
                  <span>1. Identitas Tenaga Psikologi</span>
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
                      placeholder="Dr. Anita Wijaya, M.Psi., Psikolog"
                      className="h-10 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/60 rounded-xl"
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
                      placeholder="psikolog@email.com"
                      className="h-10 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/60 rounded-xl"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Nomor WhatsApp Aktif
                    </label>
                    <Input
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+62 812-xxxx-xxxx"
                      className="h-10 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/60 rounded-xl"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Pengalaman Praktik Klinis
                    </label>
                    <Input
                      required
                      type="number"
                      min="1"
                      value={experienceYears}
                      onChange={(e) => setExperienceYears(e.target.value)}
                      placeholder="Tahun pengalaman (misal: 7)"
                      className="h-10 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/60 rounded-xl"
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
                      Nomor SIPPK (Izin Praktik Psikolog)
                    </label>
                    <Input
                      required
                      value={sippkNumber}
                      onChange={(e) => setSippkNumber(e.target.value)}
                      placeholder="Contoh: SIPPK-2021-0481"
                      className="h-10 text-xs sm:text-sm font-mono bg-slate-50 dark:bg-slate-800/60 rounded-xl"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Nomor STR Tenaga Kesehatan
                    </label>
                    <Input
                      required
                      value={strNumber}
                      onChange={(e) => setStrNumber(e.target.value)}
                      placeholder="Contoh: STR-198804-09821"
                      className="h-10 text-xs sm:text-sm font-mono bg-slate-50 dark:bg-slate-800/60 rounded-xl"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Almamater Pendidikan Magister Profesi Psikologi
                    </label>
                    <Input
                      required
                      value={institution}
                      onChange={(e) => setInstitution(e.target.value)}
                      placeholder="Universitas Indonesia, Universitas Gadjah Mada, dll."
                      className="h-10 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/60 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              {/* Bagian 3: Spesialisasi & Pendekatan Terapi */}
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-bold text-teal-800 dark:text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={14} />
                  <span>3. Spesialisasi & Pendekatan Klinis</span>
                </h3>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    Pilih Fokus Masalah yang Anda Dampingi:
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

                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    Pendekatan Terapi Berbasis Bukti yang Anda Gunakan:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {approachesOptions.map((item) => {
                      const isSelected = selectedApproaches.includes(item);
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => handleToggleApproach(item)}
                          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer border ${
                            isSelected
                              ? "bg-teal-700 text-white border-teal-700 shadow-2xs font-semibold dark:bg-teal-600"
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
                  4. Upload Salinan Dokumen SIPPK / STR (PDF/Scan):
                </label>
                <div className="p-4 rounded-2xl border-2 border-dashed border-teal-300 dark:border-teal-800 bg-teal-50/30 dark:bg-teal-950/20 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/80 text-teal-700 dark:text-teal-300 flex items-center justify-center mx-auto">
                    <FileCheck2 size={20} />
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 font-nunito">
                    <span className="font-semibold text-teal-700 dark:text-teal-300 font-mono">
                      {uploadedFile}
                    </span>{" "}
                    (Terlampir)
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Format didukung: PDF, JPG, PNG (Maksimal 5MB)
                  </p>
                </div>
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
                    Saya menyatakan secara sadar bahwa data SIPPK dan STR yang saya kirimkan adalah valid, dan saya berkomitmen mematuhi Kode Etik Psikologi Indonesia (HIMPSI).
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
                  {loading ? "Memproses Dokumen..." : "Kirim Pengajuan Kemitraan Psikolog"}
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
