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
import {
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  Sparkles,
  User,
  Stethoscope,
  Headphones,
  ShieldAlert,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useUserStore, UserRole } from "@/store/user-store";
import { mockUsers } from "@/constant/mock-users";

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Alamat email wajib diisi")
    .email("Format email tidak valid (contoh: nama@email.com)"),
  password: z
    .string()
    .min(6, "Kata sandi minimal 6 karakter"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const router = useRouter();
  const { login, loginWithRole } = useUserStore();
  const [loading, setLoading] = useState(false);
  const [activeRoleSelected, setActiveRoleSelected] = useState<UserRole>("patient");
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "wahyu@temanbicara.id",
      password: "password123",
    },
  });

  const getPortalHome = (role: UserRole) => {
    switch (role) {
      case "counselor":
        return "/counselor/beranda";
      case "peer_listener":
        return "/listener/beranda";
      case "admin":
        return "/admin/beranda";
      case "patient":
      default:
        return "/patient/beranda";
    }
  };

  const onSubmit = (data: LoginFormData) => {
    setLoading(true);
    setServerError(null);

    setTimeout(() => {
      const loggedUser = login(data.email);
      router.push(getPortalHome(loggedUser.role));
    }, 400);
  };

  const handleQuickDemoRole = (role: UserRole) => {
    setActiveRoleSelected(role);
    const mock = mockUsers[role];
    setValue("email", mock.email, { shouldValidate: true });
    setValue("password", "password123", { shouldValidate: true });

    // Instan login dan alihkan
    setLoading(true);
    setTimeout(() => {
      const loggedUser = loginWithRole(role);
      router.push(getPortalHome(loggedUser.role));
    }, 350);
  };

  const handleSocialLogin = (provider: string) => {
    setLoading(true);
    setTimeout(() => {
      const loggedUser = login(`${provider.toLowerCase()}.user@temanbicara.id`, `${provider} User`);
      router.push(getPortalHome(loggedUser.role));
    }, 400);
  };

  const demoRoles = [
    {
      role: "patient" as UserRole,
      title: "Pasien",
      name: "Wahyu",
      badgeColor: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
      icon: User,
    },
    {
      role: "counselor" as UserRole,
      title: "Psikolog",
      name: "Dr. Anita",
      badgeColor: "bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800",
      icon: Stethoscope,
    },
    {
      role: "peer_listener" as UserRole,
      title: "Pendengar",
      name: "Rian",
      badgeColor: "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800",
      icon: Headphones,
    },
    {
      role: "admin" as UserRole,
      title: "Admin",
      name: "Siti",
      badgeColor: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
      icon: ShieldAlert,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden bg-gradient-to-br from-teal-50/70 via-slate-50 to-emerald-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-teal-950/40 text-slate-900 dark:text-slate-100 font-nunito transition-colors duration-200">
      {/* Calming ambient background orbs */}
      <div className="absolute top-10 -left-20 w-80 h-80 rounded-full bg-teal-200/30 dark:bg-teal-900/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-96 h-96 rounded-full bg-emerald-200/25 dark:bg-emerald-900/10 blur-3xl pointer-events-none" />

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

      {/* Main Login Card */}
      <div className="w-full max-w-lg bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-xl shadow-teal-900/5 dark:shadow-black/40 p-6 sm:p-8 space-y-5 relative z-10 backdrop-blur-xs">
        {/* Brand & Heading */}
        <div className="flex flex-col items-center text-center space-y-2">
          <Logo size="lg" showTagline />

          <div className="pt-2">
            <h1 className="text-xl sm:text-2xl font-bold font-heading text-slate-900 dark:text-white leading-tight">
              Masuk ke Ruang TemanBicara
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-nunito mt-0.5">
              Pilih akun demonstrasi atau masuk dengan email terdaftar
            </p>
          </div>
        </div>

        {/* Multi-Role Quick Demo Selector */}
        <div className="p-3 rounded-2xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
              <Sparkles size={14} className="text-teal-600 dark:text-teal-400" />
              <span>Coba Demo 4 Role (1-Klik Langsung Masuk)</span>
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold">Demo Cepat</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {demoRoles.map((item) => {
              const Icon = item.icon;
              const isSelected = activeRoleSelected === item.role;
              return (
                <button
                  key={item.role}
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickDemoRole(item.role)}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all cursor-pointer ${
                    isSelected
                      ? "ring-2 ring-teal-500 shadow-xs " + item.badgeColor
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-teal-300 dark:hover:border-teal-700 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-1 text-xs font-bold font-heading">
                    <Icon size={13} className="shrink-0" />
                    <span>{item.title}</span>
                  </div>
                  <span className="text-[10px] opacity-80 mt-0.5 truncate">{item.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Social Quick Login */}
        <div className="grid grid-cols-2 gap-2.5">
          <Button
            type="button"
            variant="outline"
            className="w-full flex items-center justify-center gap-2 h-10 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-xs font-semibold text-slate-700 dark:text-slate-200 rounded-xl cursor-pointer"
            onClick={() => handleSocialLogin("Google")}
            disabled={loading}
          >
            <FcGoogle className="h-4 w-4" />
            <span>Google</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full flex items-center justify-center gap-2 h-10 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-xs font-semibold text-slate-700 dark:text-slate-200 rounded-xl cursor-pointer"
            onClick={() => handleSocialLogin("Facebook")}
            disabled={loading}
          >
            <FaFacebook className="h-4 w-4 text-blue-600" />
            <span>Facebook</span>
          </Button>
        </div>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-slate-200 dark:border-slate-800" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white dark:bg-slate-900 px-3 text-slate-400 dark:text-slate-500 font-medium">
              atau gunakan formulir email
            </span>
          </div>
        </div>

        {serverError && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{serverError}</span>
          </div>
        )}

        {/* Validated Email Form */}
        <form className="space-y-3.5" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Email Akun</label>
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
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Kata Sandi</label>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  alert("Tautan pemulihan kata sandi telah dikirim ke email terdaftar Anda.");
                }}
                className="text-[11px] text-teal-700 dark:text-teal-400 hover:underline font-semibold"
              >
                Lupa kata sandi?
              </a>
            </div>
            <Input
              type="password"
              placeholder="••••••••"
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

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs sm:text-sm cursor-pointer shadow-md shadow-teal-700/20 gap-2 mt-1"
          >
            <span>{loading ? "Memverifikasi..." : "Masuk ke Akun"}</span>
            <ArrowRight size={16} />
          </Button>
        </form>

        {/* Privacy Note */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 font-medium text-center pt-1 border-t border-slate-100 dark:border-slate-800">
          <ShieldCheck size={14} className="text-teal-600 dark:text-teal-400 shrink-0" />
          <span>Kerahasiaan Terenkripsi • Terikat Kode Etik HIMPSI</span>
        </div>

        {/* Register CTA */}
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          Belum memiliki akun TemanBicara?{" "}
          <Link href="/register" className="text-teal-700 dark:text-teal-400 hover:underline font-bold">
            Daftar Sekarang
          </Link>
        </p>
      </div>
    </div>
  );
}
