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
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useUserStore } from "@/store/user-store";

const registerSchema = z.object({
  fullName: z.string().min(3, "Nama lengkap / nama samaran minimal 3 karakter"),
  email: z
    .string()
    .min(1, "Alamat email wajib diisi")
    .email("Format email tidak valid (contoh: nama@email.com)"),
  password: z
    .string()
    .min(8, "Kata sandi minimal 8 karakter demi perlindungan data medis"),
  agreeTerms: z
    .boolean()
    .refine((val) => val === true, "Wajib menyetujui syarat & ketentuan privasi konseling"),
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function Register() {
  const router = useRouter();
  const { register: registerUser } = useUserStore();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "Wahyu Tricahyo",
      email: "wahyu@temanbicara.id",
      password: "password123",
      agreeTerms: true,
    },
  });

  const onSubmit = (data: RegisterFormData) => {
    setLoading(true);

    setTimeout(() => {
      const newUser = registerUser(data.fullName, data.email, "patient");
      router.push("/patient/beranda");
    }, 450);
  };

  const handleSocialRegister = (provider: string) => {
    setLoading(true);
    setTimeout(() => {
      registerUser(
        `${provider} User`,
        `${provider.toLowerCase()}.user@temanbicara.id`,
        "patient"
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
        {/* Brand & Heading */}
        <div className="flex flex-col items-center text-center space-y-2">
          <Logo size="lg" showTagline />

          <div className="pt-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-800 dark:text-teal-300 text-[11px] font-bold mb-1">
              <User size={13} className="text-teal-600 dark:text-teal-400" />
              <span>Registrasi Akun Pasien / Klien</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold font-heading text-slate-900 dark:text-white leading-tight">
              Mulai Perjalanan Pemulihanmu
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-nunito mt-0.5">
              Ruang aman, privat & terenkripsi untuk berkeluh kesah dan konseling
            </p>
          </div>
        </div>

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
              atau daftar dengan email
            </span>
          </div>
        </div>

        {/* Register Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Nama Lengkap / Nama Samaran (Pseudonim)
            </label>
            <Input
              type="text"
              placeholder="Wahyu Tricahyo"
              className={`h-11 bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 ${
                errors.fullName ? "border-rose-500 focus-visible:ring-rose-500" : ""
              }`}
              {...register("fullName")}
              disabled={loading}
            />
            {errors.fullName && (
              <p className="text-[11px] text-rose-500 font-medium flex items-center gap-1">
                <AlertCircle size={12} /> {errors.fullName.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Alamat Email Aktif
            </label>
            <Input
              type="email"
              placeholder="nama@email.com"
              className={`h-11 bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 ${
                errors.email ? "border-rose-500 focus-visible:ring-rose-500" : ""
              }`}
              {...register("email")}
              disabled={loading}
            />
            {errors.email && (
              <p className="text-[11px] text-rose-500 font-medium flex items-center gap-1">
                <AlertCircle size={12} /> {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Kata Sandi
            </label>
            <Input
              type="password"
              placeholder="Minimal 8 karakter..."
              className={`h-11 bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 ${
                errors.password ? "border-rose-500 focus-visible:ring-rose-500" : ""
              }`}
              {...register("password")}
              disabled={loading}
            />
            {errors.password && (
              <p className="text-[11px] text-rose-500 font-medium flex items-center gap-1">
                <AlertCircle size={12} /> {errors.password.message}
              </p>
            )}
          </div>

          {/* Privacy & Terms Checkbox */}
          <div className="space-y-1 pt-1">
            <div className="flex items-start gap-2.5">
              <input
                type="checkbox"
                id="agreeTerms"
                className="mt-1 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                {...register("agreeTerms")}
                disabled={loading}
              />
              <label htmlFor="agreeTerms" className="text-xs text-slate-600 dark:text-slate-400 font-nunito leading-relaxed cursor-pointer">
                Saya menyetujui <span className="text-teal-700 dark:text-teal-400 font-semibold underline">Syarat Layanan</span> dan perlindungan kerahasiaan data kesehatan mental standar HIMPSI.
              </label>
            </div>
            {errors.agreeTerms && (
              <p className="text-[11px] text-rose-500 font-medium flex items-center gap-1 pl-6">
                <AlertCircle size={12} /> {errors.agreeTerms.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold h-11 rounded-xl text-xs sm:text-sm shadow-md shadow-teal-600/20 cursor-pointer mt-2"
            disabled={loading}
          >
            {loading ? "Menyiapkan Ruang Aman..." : "Daftar Akun Pasien & Mulai Curhat"}
          </Button>
        </form>

        {/* Clinical Privacy Banner */}
        <div className="rounded-2xl p-3 bg-teal-50/50 dark:bg-teal-950/30 border border-teal-200/60 dark:border-teal-900/40 flex items-start gap-2.5 text-xs text-teal-900 dark:text-teal-200 font-nunito">
          <ShieldCheck size={16} className="text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed">
            Identitas Anda terproteksi standar kerahasiaan konseling. Anda bebas menggunakan nama samaran saat bercerita.
          </p>
        </div>

        {/* Login Link */}
        <p className="text-center text-xs text-slate-500 dark:text-slate-400 font-nunito">
          Sudah memiliki akun?{" "}
          <Link href="/login" className="text-teal-700 dark:text-teal-400 font-bold hover:underline">
            Masuk di sini
          </Link>
        </p>

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
      </div>
    </div>
  );
}
