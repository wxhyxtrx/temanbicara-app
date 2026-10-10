"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/shared/atoms/theme-toggle";
import { FcGoogle } from "react-icons/fc";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/shared/atoms/Logo";
import {
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  User,
  Stethoscope,
  HeartHandshake,
  Lock,
  Phone,
  HeartPulse,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { useUserStore } from "@/store/user-store";

const issueTopics = [
  "Kecemasan & Overthinking",
  "Depresi & Mood Rendah",
  "Hubungan & Keluarga",
  "Burnout & Karier",
  "Trauma & Masa Lalu",
  "Kesepian & Isolasi Diri",
];

export default function Register() {
  const router = useRouter();
  const { register: registerUser } = useUserStore();
  const [loading, setLoading] = useState(false);

  // Stepper State (1: Akun, 2: Kontak Darurat & Profil, 3: Informed Consent)
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form State
  const [fullName, setFullName] = useState("Wahyu Tricahyo");
  const [alias, setAlias] = useState("Wahyu");
  const [email, setEmail] = useState("wahyu@temanbicara.id");
  const [password, setPassword] = useState("password123");
  const [phone, setPhone] = useState("+62 812-3456-7890");

  // Step 2 State
  const [ageGroup, setAgeGroup] = useState<string>("Dewasa Muda (18-24 thn)");
  const [emergencyName, setEmergencyName] = useState("Ibu Ratna (Ibu Kandung)");
  const [emergencyPhone, setEmergencyPhone] = useState("0811-9876-5432");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([
    "Kecemasan & Overthinking",
    "Burnout & Karier",
  ]);

  // Step 3 State: Informed Consents
  const [consentNonEmergency, setConsentNonEmergency] = useState(true);
  const [consentEmergencyContact, setConsentEmergencyContact] = useState(true);
  const [consentPrivacy, setConsentPrivacy] = useState(true);

  // Error messages
  const [stepError, setStepError] = useState<string | null>(null);

  const toggleTopic = (topic: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };

  const handleStep1Next = (e: React.FormEvent) => {
    e.preventDefault();
    setStepError(null);

    if (!fullName.trim() || fullName.length < 3) {
      setStepError("Nama lengkap / nama samaran minimal 3 karakter.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setStepError("Format email tidak valid (contoh: nama@email.com).");
      return;
    }
    if (!password || password.length < 8) {
      setStepError("Kata sandi minimal 8 karakter demi keamanan data medis.");
      return;
    }

    setStep(2);
  };

  const handleStep2Next = (e: React.FormEvent) => {
    e.preventDefault();
    setStepError(null);

    if (!emergencyName.trim()) {
      setStepError("Nama kontak darurat wajib diisi untuk keselamatan pasien.");
      return;
    }
    if (!emergencyPhone.trim() || emergencyPhone.length < 8) {
      setStepError("Nomor telepon kontak darurat tidak valid.");
      return;
    }
    if (selectedTopics.length === 0) {
      setStepError("Pilih minimal satu fokus kebutuhan konseling.");
      return;
    }

    setStep(3);
  };

  const handleFinalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStepError(null);

    if (!consentNonEmergency || !consentEmergencyContact || !consentPrivacy) {
      setStepError("Anda wajib menyetujui seluruh ketentuan informed consent medis untuk melanjutkan.");
      return;
    }

    setLoading(true);

    setTimeout(() => {
      registerUser(fullName, email, "patient", {
        alias: alias.trim() || fullName.split(" ")[0] || "Sahabat",
        phone,
        emergencyContact: `${emergencyName}: ${emergencyPhone}`,
        mentalNotes: `Fokus: ${selectedTopics.join(", ")} | Usia: ${ageGroup}`,
      });
      router.push("/patient/beranda");
    }, 500);
  };

  const handleSocialRegister = (provider: string) => {
    setLoading(true);
    setTimeout(() => {
      registerUser(
        `${provider} User`,
        `${provider.toLowerCase()}.user@temanbicara.id`,
        "patient",
        {
          alias: `${provider} User`,
          emergencyContact: "Kerabat Terdekat: 0811-9876-5432",
          mentalNotes: "Pendaftaran Cepat via Google",
        }
      );
      router.push("/patient/beranda");
    }, 450);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden bg-gradient-to-br from-teal-50/70 via-slate-50 to-emerald-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-teal-950/40 text-slate-900 dark:text-slate-100 font-nunito transition-colors duration-200">
      {/* Ambient Glow Orbs */}
      <div className="absolute top-10 -right-20 w-80 h-80 rounded-full bg-teal-200/30 dark:bg-teal-900/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-96 h-96 rounded-full bg-emerald-200/25 dark:bg-emerald-900/10 blur-3xl pointer-events-none" />

      {/* Top Bar: Back to Home Button & Theme Toggle */}
      <div className="w-full max-w-lg mb-4 flex items-center justify-between relative z-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-teal-700 dark:hover:text-teal-400 transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Kembali ke Beranda Utama</span>
        </Link>

        <ThemeToggle />
      </div>

      {/* Main Register Card */}
      <div className="w-full max-w-lg bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-xl shadow-teal-900/5 dark:shadow-black/40 p-6 sm:p-8 space-y-5 relative z-10 backdrop-blur-xs">
        {/* Brand & Stepper Progress */}
        <div className="flex flex-col items-center text-center space-y-2">
          <Logo size="lg" showTagline />

          <div className="pt-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-800 dark:text-teal-300 text-[11px] font-bold mb-1">
              <User size={13} className="text-teal-600 dark:text-teal-400" />
              <span>Registrasi Pasien & Asesmen Klinis</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold font-heading text-slate-900 dark:text-white leading-tight">
              {step === 1 && "Mulai Perjalanan Pemulihanmu"}
              {step === 2 && "Data Darurat & Profil Kebutuhan"}
              {step === 3 && "Informed Consent & Etika Medis"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-nunito mt-0.5">
              {step === 1 && "Langkah 1 dari 3: Buat akun terproteksi & anonim"}
              {step === 2 && "Langkah 2 dari 3: Kontak darurat wajib demi keselamatan diri"}
              {step === 3 && "Langkah 3 dari 3: Persetujuan privasi & standar perlindungan HIMPSI"}
            </p>
          </div>

          {/* Stepper Indicator */}
          <div className="w-full grid grid-cols-3 gap-2 pt-2">
            <div className={`h-1.5 rounded-full transition-all ${step >= 1 ? "bg-teal-600" : "bg-slate-200 dark:bg-slate-800"}`} />
            <div className={`h-1.5 rounded-full transition-all ${step >= 2 ? "bg-teal-600" : "bg-slate-200 dark:bg-slate-800"}`} />
            <div className={`h-1.5 rounded-full transition-all ${step >= 3 ? "bg-teal-600" : "bg-slate-200 dark:bg-slate-800"}`} />
          </div>
        </div>

        {/* Global Error Banner */}
        {stepError && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <AlertCircle size={15} className="shrink-0 text-rose-500" />
            <span>{stepError}</span>
          </div>
        )}

        {/* ================= STEP 1: AKUN & KEAMANAN ================= */}
        {step === 1 && (
          <form onSubmit={handleStep1Next} className="space-y-4">
            {/* Social Quick Sign-Up */}
            <Button
              type="button"
              variant="outline"
              className="w-full flex items-center justify-center gap-2.5 h-11 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 rounded-xl cursor-pointer transition-colors shadow-xs"
              onClick={() => handleSocialRegister("Google")}
              disabled={loading}
            >
              <FcGoogle className="h-5 w-5" />
              <span>Daftar Cepat dengan Google</span>
            </Button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200 dark:border-slate-800" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white dark:bg-slate-900 px-3 text-slate-400 font-nunito">
                  atau daftar dengan formulir aman
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Nama Lengkap Asli
              </label>
              <Input
                type="text"
                placeholder="Wahyu Tricahyo"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-11 bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100"
                disabled={loading}
              />
              <p className="text-[11px] text-slate-400">Digunakan untuk administrasi medis dan faktur sesi.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Nama Panggilan / Nama Samaran (Alias Bercerita)
              </label>
              <Input
                type="text"
                placeholder="Wahyu / Sahabat Teduh"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                className="h-11 bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100"
                disabled={loading}
              />
              <p className="text-[11px] text-teal-600 dark:text-teal-400">
                Nama ini yang akan dilihat oleh psikolog atau relawan pendengar agar privasimu tetap terjaga.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Alamat Email Aktif
              </label>
              <Input
                type="email"
                placeholder="nama@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100"
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Kata Sandi Akun
              </label>
              <Input
                type="password"
                placeholder="Minimal 8 karakter..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100"
                disabled={loading}
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold h-11 rounded-xl text-xs sm:text-sm shadow-md shadow-teal-600/20 cursor-pointer mt-2 gap-2"
            >
              <span>Lanjut ke Data Darurat (Langkah 2)</span>
              <ArrowRight size={15} />
            </Button>
          </form>
        )}

        {/* ================= STEP 2: KONTAK DARURAT & PROFIL ================= */}
        {step === 2 && (
          <form onSubmit={handleStep2Next} className="space-y-4">
            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
              <HeartPulse size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                <strong>Protokol Etika Medis:</strong> Kontak darurat hanya akan dihubungi oleh tim klinis jika terdeteksi ancaman keselamatan diri akut selama sesi telekonseling.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Kelompok Usia Pasien
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  "Remaja (15-17 thn)",
                  "Dewasa Muda (18-24 thn)",
                  "Dewasa (25-39 thn)",
                  "Dewasa Madya (40+ thn)",
                ].map((age) => (
                  <button
                    type="button"
                    key={age}
                    onClick={() => setAgeGroup(age)}
                    className={`p-2.5 rounded-xl border text-xs text-left transition-all cursor-pointer font-medium ${
                      ageGroup === age
                        ? "border-teal-600 bg-teal-50/80 dark:bg-teal-950/70 text-teal-900 dark:text-teal-200 font-bold"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50/30 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {age}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Nomor WhatsApp Pasien
              </label>
              <Input
                type="tel"
                placeholder="+62 812-3456-7890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-11 bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Nama Kontak Darurat
                </label>
                <Input
                  type="text"
                  placeholder="Ibu Ratna (Ibu Kandung)"
                  value={emergencyName}
                  onChange={(e) => setEmergencyName(e.target.value)}
                  className="h-11 bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  No. Telepon Kontak Darurat
                </label>
                <Input
                  type="tel"
                  placeholder="0811-9876-5432"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  className="h-11 bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Fokus Masalah Utama yang Dihadapi (Bisa pilih lebih dari satu)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {issueTopics.map((topic) => {
                  const active = selectedTopics.includes(topic);
                  return (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => toggleTopic(topic)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all cursor-pointer font-medium ${
                        active
                          ? "bg-teal-600 text-white border-teal-600 font-bold shadow-xs"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-teal-400"
                      }`}
                    >
                      {topic}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                className="w-1/3 h-11 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Kembali
              </Button>
              <Button
                type="submit"
                className="w-2/3 bg-teal-600 hover:bg-teal-700 text-white font-bold h-11 rounded-xl text-xs sm:text-sm shadow-md shadow-teal-600/20 cursor-pointer gap-1.5"
              >
                <span>Lanjut ke Informed Consent</span>
                <ArrowRight size={15} />
              </Button>
            </div>
          </form>
        )}

        {/* ================= STEP 3: INFORMED CONSENT MEDIS ================= */}
        {step === 3 && (
          <form onSubmit={handleFinalSubmit} className="space-y-4">
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-2">
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="consent1"
                    checked={consentNonEmergency}
                    onChange={(e) => setConsentNonEmergency(e.target.checked)}
                    className="mt-1 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                  />
                  <label htmlFor="consent1" className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed cursor-pointer">
                    <strong>Bukan Layanan Gawat Darurat (Non-IGD):</strong> Saya memahami bahwa TemanBicara menyediakan konseling non-darurat. Bila saya sedang dalam krisis akut yang membahayakan nyawa, saya bersedia menghubungi saluran bebas pulsa SEJIWA 119 (ext. 8) atau IGD terdekat.
                  </label>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-2">
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="consent2"
                    checked={consentEmergencyContact}
                    onChange={(e) => setConsentEmergencyContact(e.target.checked)}
                    className="mt-1 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                  />
                  <label htmlFor="consent2" className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed cursor-pointer">
                    <strong>Otorisasi Kontak Darurat:</strong> Saya memberikan izin kepada tim klinis dan administrator platform untuk menghubungi kontak darurat saya ({emergencyName}: {emergencyPhone}) semata-mata bila ditemukan indikasi ancaman keselamatan jiwa.
                  </label>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-2">
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="consent3"
                    checked={consentPrivacy}
                    onChange={(e) => setConsentPrivacy(e.target.checked)}
                    className="mt-1 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                  />
                  <label htmlFor="consent3" className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed cursor-pointer">
                    <strong>Kerahasiaan Berstandar HIMPSI:</strong> Saya menyetujui kebijakan privasi dan informed consent telekonseling sesuai kode etik profesi psikologi Indonesia.
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(2)}
                className="w-1/3 h-11 rounded-xl text-xs font-semibold cursor-pointer"
                disabled={loading}
              >
                Kembali
              </Button>
              <Button
                type="submit"
                className="w-2/3 bg-teal-600 hover:bg-teal-700 text-white font-bold h-11 rounded-xl text-xs sm:text-sm shadow-md shadow-teal-600/20 cursor-pointer gap-1.5"
                disabled={loading}
              >
                <CheckCircle2 size={16} />
                <span>{loading ? "Menyiapkan Ruang Aman..." : "Selesaikan & Buka Akun"}</span>
              </Button>
            </div>
          </form>
        )}

        {/* Separator to Other Roles Onboarding */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center">
            Pendaftaran Peran Lainnya:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Link
              href="/register/counselor"
              className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-teal-400 dark:hover:border-teal-600 hover:bg-slate-50/70 dark:hover:bg-slate-800/60 transition-all flex items-center gap-2.5 group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-400 flex items-center justify-center shrink-0">
                <Stethoscope size={15} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-teal-700 dark:group-hover:text-teal-400 truncate">
                  Mitra Psikolog Klinis
                </p>
                <p className="text-[10px] text-slate-500 truncate">Verifikasi SIPPK & Praktik</p>
              </div>
            </Link>

            <Link
              href="/register/listener"
              className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-pink-400 dark:hover:border-pink-600 hover:bg-slate-50/70 dark:hover:bg-slate-800/60 transition-all flex items-center gap-2.5 group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl bg-pink-50 dark:bg-pink-950 text-pink-700 dark:text-pink-400 flex items-center justify-center shrink-0">
                <HeartHandshake size={15} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-pink-700 dark:group-hover:text-pink-400 truncate">
                  Relawan Pendengar Sebaya
                </p>
                <p className="text-[10px] text-slate-500 truncate">Pelatihan Empati PFA</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Login Link */}
        <p className="text-center text-xs text-slate-500 dark:text-slate-400 font-nunito">
          Sudah memiliki akun?{" "}
          <Link href="/login" className="text-teal-700 dark:text-teal-400 font-bold hover:underline">
            Masuk di sini
          </Link>
        </p>
      </div>
    </div>
  );
}
