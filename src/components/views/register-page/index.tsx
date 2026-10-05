"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/shared/atoms/theme-toggle";
import { FcGoogle } from "react-icons/fc";
import { FaFacebook } from "react-icons/fa";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/shared/atoms/Logo";
import { ShieldCheck, ArrowLeft, ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useUserStore } from "@/store/user-store";

const registerSchema = z.object({
  fullName: z
    .string()
    .min(3, "Nama lengkap minimal 3 karakter"),
  email: z
    .string()
    .min(1, "Alamat email wajib diisi")
    .email("Format email tidak valid (contoh: nama@email.com)"),
  password: z
    .string()
    .min(8, "Kata sandi minimal 8 karakter demi perlindungan data medis"),
  agreeTerms: z
    .boolean()
    .refine((val) => val === true, "Wajib menyetujui syarat & ketentuan konseling"),
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
      registerUser(data.fullName, data.email);
      router.push("/beranda");
    }, 450);
  };

  const handleSocialRegister = (provider: string) => {
    setLoading(true);
    setTimeout(() => {
      registerUser(`${provider} User`, `${provider.toLowerCase()}.user@temanbicara.id`);
      router.push("/beranda");
    }, 450);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden bg-gradient-to-br from-teal-50/70 via-slate-50 to-emerald-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-teal-950/40 text-slate-900 dark:text-slate-100 font-nunito transition-colors duration-200">
      {/* Calming ambient background orbs */}
      <div className="absolute top-10 -right-20 w-80 h-80 rounded-full bg-teal-200/30 dark:bg-teal-900/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-96 h-96 rounded-full bg-emerald-200/25 dark:bg-emerald-900/10 blur-3xl pointer-events-none" />

      {/* Top Bar: Back to Home Button & Theme Toggle */}
      <div className="w-full max-w-md mb-4 flex items-center justify-between relative z-10">
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
      <div className="w-full max-w-md bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-xl shadow-teal-900/5 dark:shadow-black/40 p-6 sm:p-8 space-y-6 relative z-10 backdrop-blur-xs">
        {/* Brand & Heading */}
        <div className="flex flex-col items-center text-center space-y-2">
          <Logo size="lg" showTagline />

          <div className="pt-2">
            <h1 className="text-xl sm:text-2xl font-bold font-heading text-slate-900 dark:text-white leading-tight">
              Mulai Perjalanan Pemulihanmu
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-nunito mt-1">
              Buat akun privat untuk mengakses psikolog klinis & ruang suaka mental
            </p>
          </div>
        </div>

        {/* Social Quick Sign-Up */}
        <div className="space-y-2.5">
          <Button
            type="button"
            variant="outline"
            className="w-full flex items-center justify-center gap-2.5 h-10 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 rounded-xl cursor-pointer"
            onClick={() => handleSocialRegister("Google")}
            disabled={loading}
          >
            <FcGoogle className="h-4 w-4" />
            <span>Daftar dengan Google</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full flex items-center justify-center gap-2.5 h-10 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 rounded-xl cursor-pointer"
            onClick={() => handleSocialRegister("Facebook")}
            disabled={loading}
          >
            <FaFacebook className="h-4 w-4 text-blue-600" />
            <span>Daftar dengan Facebook</span>
          </Button>
        </div>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-slate-200 dark:border-slate-800" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white dark:bg-slate-900 px-3 text-slate-400 dark:text-slate-500 font-medium">
              atau daftar dengan email
            </span>
          </div>
        </div>

        {/* Validated Form */}
        <form className="space-y-3.5" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nama Lengkap / Alias</label>
            <Input
              type="text"
              placeholder="Contoh: Wahyu Tricahyo"
              {...register("fullName")}
              className={`h-10 text-xs sm:text-sm bg-slate-50/50 dark:bg-slate-800/60 dark:text-slate-100 rounded-xl focus-visible:ring-teal-600 ${
                errors.fullName
                  ? "border-rose-400 focus-visible:ring-rose-500 bg-rose-50/30 dark:bg-rose-950/30"
                  : "border-slate-200 dark:border-slate-700"
              }`}
            />
            {errors.fullName && (
              <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1">
                <AlertCircle size={12} className="shrink-0" />
                <span>{errors.fullName.message}</span>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Alamat Email</label>
            <Input
              type="email"
              placeholder="nama@email.com"
              {...register("email")}
              className={`h-10 text-xs sm:text-sm bg-slate-50/50 dark:bg-slate-800/60 dark:text-slate-100 rounded-xl focus-visible:ring-teal-600 ${
                errors.email
                  ? "border-rose-400 focus-visible:ring-rose-500 bg-rose-50/30 dark:bg-rose-950/30"
                  : "border-slate-200 dark:border-slate-700"
              }`}
            />
            {errors.email && (
              <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1">
                <AlertCircle size={12} className="shrink-0" />
                <span>{errors.email.message}</span>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Kata Sandi</label>
            <Input
              type="password"
              placeholder="Minimal 8 karakter"
              {...register("password")}
              className={`h-10 text-xs sm:text-sm bg-slate-50/50 dark:bg-slate-800/60 dark:text-slate-100 rounded-xl focus-visible:ring-teal-600 ${
                errors.password
                  ? "border-rose-400 focus-visible:ring-rose-500 bg-rose-50/30 dark:bg-rose-950/30"
                  : "border-slate-200 dark:border-slate-700"
              }`}
            />
            {errors.password && (
              <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1">
                <AlertCircle size={12} className="shrink-0" />
                <span>{errors.password.message}</span>
              </p>
            )}
          </div>

          <div className="space-y-1 pt-1">
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="terms"
                {...register("agreeTerms")}
                className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-teal-600 focus:ring-teal-600 mt-0.5"
              />
              <label htmlFor="terms" className="text-[11px] text-slate-500 dark:text-slate-400 font-nunito leading-tight">
                Saya menyetujui{" "}
                <a href="#" className="text-teal-700 dark:text-teal-400 font-semibold hover:underline">
                  Syarat & Ketentuan Konseling
                </a>{" "}
                serta{" "}
                <a href="#" className="text-teal-700 dark:text-teal-400 font-semibold hover:underline">
                  Kebijakan Kerahasiaan Data Medis
                </a>
                .
              </label>
            </div>
            {errors.agreeTerms && (
              <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1 pl-6">
                <AlertCircle size={12} className="shrink-0" />
                <span>{errors.agreeTerms.message}</span>
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs sm:text-sm cursor-pointer shadow-md shadow-teal-700/20 gap-2 mt-2"
          >
            <span>{loading ? "Mendaftarkan Akun..." : "Buat Akun Konseling"}</span>
            <ArrowRight size={16} />
          </Button>
        </form>

        {/* Privacy Note */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 font-medium text-center pt-1 border-t border-slate-100 dark:border-slate-800">
          <ShieldCheck size={14} className="text-teal-600 dark:text-teal-400 shrink-0" />
          <span>Privasi Terlindungi • Bebas Pilih Mode Anonim</span>
        </div>

        {/* Login CTA */}
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          Sudah memiliki akun?{" "}
          <Link href="/login" className="text-teal-700 dark:text-teal-400 hover:underline font-bold">
            Masuk Sekarang
          </Link>
        </p>
      </div>
    </div>
  );
}
