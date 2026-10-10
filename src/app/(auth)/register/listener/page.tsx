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
} from "lucide-react";
import { useVerificationStore } from "@/store/verification-store";
import { useUserStore } from "@/store/user-store";

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
  const addVerification = useVerificationStore((state) => state.addVerification);
  const loginWithRole = useUserStore((state) => state.loginWithRole);

  const [fullName, setFullName] = useState("Rian Permana, S.Sos.");
  const [alias, setAlias] = useState("Rian");
  const [email, setEmail] = useState("rian.permana@email.com");
  const [phone, setPhone] = useState("+62 856-7788-9900");
  const [pfaBackground, setPfaBackground] = useState("Pelatihan Psychological First Aid (PFA) WHO & Kemenkes RI");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([
    "Curhat Stres Kuliah & Skripsi",
    "Quarter-Life Crisis & Arah Hidup",
    "Overthinking Masa Depan",
  ]);
  const [timeCommitment, setTimeCommitment] = useState("4 - 6 Jam / Pekan");
  const [uploadedFile, setUploadedFile] = useState("Sertifikat_Pelatihan_PFA_RianPermana.pdf");
  const [agreeRules, setAgreeRules] = useState(true);

  const [loading, setLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleToggleTopic = (topic: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    setTimeout(() => {
      // Simpan ke verification store
      addVerification({
        applicantName: `${fullName} (Alias: ${alias})`,
        applicantEmail: email,
        roleType: "Pendengar Sebaya",
        credentialNumber: `PFA Badge: ${pfaBackground.slice(0, 32)}`,
        institution: pfaBackground,
        documentName: uploadedFile || "Sertifikat_PFA_Relawan.pdf",
        specialty: selectedTopics.join(", "),
        notes: `Komitmen waktu: ${timeCommitment}. Siap mendampingi pasien secara anonim sesuai modul Look-Listen-Link.`,
      });

      setLoading(false);
      setIsSubmitted(true);
    }, 600);
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
                Terima kasih atas kepedulianmu, <strong>{fullName}</strong>. Data pengalaman PFA Anda telah masuk ke sistem peninjauan relawan TemanBicara.
              </p>
            </div>

            {/* Stepper Progress */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 max-w-md mx-auto text-left space-y-3.5">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-pink-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  ✓
                </span>
                <div className="text-xs">
                  <p className="font-bold text-slate-900 dark:text-white">Formulir Relawan Diterima</p>
                  <p className="text-[11px] text-slate-500">Nama Panggilan di Antrean: "{alias}"</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold shrink-0 animate-pulse">
                  ⏳
                </span>
                <div className="text-xs">
                  <p className="font-bold text-amber-800 dark:text-amber-300">Peninjauan Sertifikasi PFA</p>
                  <p className="text-[11px] text-slate-500">Pemberitahuan via email dalam 1x24 Jam</p>
                </div>
              </div>

              <div className="flex items-center gap-3 opacity-60">
                <span className="w-6 h-6 rounded-full bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center text-xs font-bold shrink-0">
                  3
                </span>
                <div className="text-xs">
                  <p className="font-bold text-slate-700 dark:text-slate-300">Aktivasi Ruang Dengar Sebaya</p>
                  <p className="text-[11px] text-slate-500">Siap menerima dan mendampingi keluh kesah pasien</p>
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/admin/verifications">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto text-xs border-pink-200 dark:border-pink-800 text-pink-700 dark:text-pink-300 hover:bg-pink-50 dark:hover:bg-slate-800 rounded-xl h-10 px-5 font-semibold cursor-pointer"
                >
                  Buka Panel Verifikasi Admin (Demo)
                </Button>
              </Link>

              <Button
                onClick={() => {
                  loginWithRole("peer_listener");
                  router.push("/listener/beranda");
                }}
                className="w-full sm:w-auto text-xs bg-pink-600 hover:bg-pink-700 text-white rounded-xl h-10 px-6 font-bold shadow-xs cursor-pointer gap-2"
              >
                <span>Masuk ke Portal Relawan (Demo)</span>
                <ArrowRight size={14} />
              </Button>
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

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Bagian 1: Identitas & Nama Panggilan */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-pink-700 dark:text-pink-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Users size={14} />
                  <span>1. Identitas Relawan</span>
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
                      placeholder="Rian Permana, S.Sos."
                      className="h-10 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/60 rounded-xl"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Nama Samaran / Panggilan (Publik di Chat)
                    </label>
                    <Input
                      required
                      value={alias}
                      onChange={(e) => setAlias(e.target.value)}
                      placeholder="Kak Rian / Rian"
                      className="h-10 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/60 rounded-xl"
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
                      placeholder="rian@email.com"
                      className="h-10 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/60 rounded-xl"
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
                      placeholder="+62 856-xxxx-xxxx"
                      className="h-10 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/60 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              {/* Bagian 2: Pengalaman & Pelatihan PFA */}
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-bold text-pink-700 dark:text-pink-300 uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen size={14} />
                  <span>2. Pelatihan Psychological First Aid (PFA)</span>
                </h3>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Latar Belakang / Sertifikat Pelatihan PFA
                  </label>
                  <Input
                    required
                    value={pfaBackground}
                    onChange={(e) => setPfaBackground(e.target.value)}
                    placeholder="Contoh: Pelatihan PFA Kemenkes RI, Mahasiswa S1 Psikologi UI, Pekerja Sosial, dll."
                    className="h-10 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/60 rounded-xl"
                  />
                </div>
              </div>

              {/* Bagian 3: Minat Topik Curhat yang Ingin Didampingi */}
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-bold text-pink-700 dark:text-pink-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={14} />
                  <span>3. Topik Curhat Pilihan</span>
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

              {/* Bagian 4: Upload Bukti Sertifikat / CV */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  4. Upload Bukti Sertifikat PFA / CV Relawan:
                </label>
                <div className="p-4 rounded-2xl border-2 border-dashed border-pink-300 dark:border-pink-800 bg-pink-50/30 dark:bg-pink-950/20 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-pink-100 dark:bg-pink-900/80 text-pink-700 dark:text-pink-300 flex items-center justify-center mx-auto">
                    <FileCheck2 size={20} />
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 font-nunito">
                    <span className="font-semibold text-pink-700 dark:text-pink-300 font-mono">
                      {uploadedFile}
                    </span>{" "}
                    (Terlampir)
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Format didukung: PDF, JPG, PNG (Maksimal 5MB)
                  </p>
                </div>
              </div>

              {/* Rambu Etika Relawan */}
              <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 space-y-2 text-xs text-amber-900 dark:text-amber-200">
                <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                  <AlertTriangle size={15} />
                  <span>3 Rambu Mutlak Pendengar Sebaya:</span>
                </div>
                <ul className="list-disc pl-5 space-y-1 text-[11px] leading-relaxed">
                  <li>Tidak memberikan diagnosa medis gangguan jiwa atau resep obat.</li>
                  <li>Menjaga kerahasiaan identitas pasien 100% dan tidak meminta kontak pribadi di luar platform.</li>
                  <li>Wajib segera menekan tombol rujukan psikolog klinis / SEJIWA 119 bila pasien menunjukkan risiko menyakiti diri.</li>
                </ul>
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
                    Saya menyetujui pakta integritas relawan dan berkomitmen mendampingi dengan empati tanpa menghakimi.
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
                  {loading ? "Memproses Data..." : "Kirim Pendaftaran Relawan Pendengar"}
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
