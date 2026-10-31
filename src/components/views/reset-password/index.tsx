"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetPasswordSchema, ResetPasswordDTO } from "@/lib/validations/auth";
import { authService } from "@/services/auth.service";
import { notify } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Logo } from "@/components/shared/atoms/Logo";
import { ThemeToggle } from "@/components/shared/atoms/theme-toggle";
import {
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  AlertTriangle,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";

type LinkStatus = "CHECKING" | "READY" | "INVALID_LINK";

export default function ResetPasswordView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [linkStatus, setLinkStatus] = useState<LinkStatus>("CHECKING");
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const hasExtractedRef = useRef(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordDTO>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirm_password: "",
    },
  });

  useEffect(() => {
    if (hasExtractedRef.current) return;
    hasExtractedRef.current = true;

    // 1. Periksa parameter error pada searchParams URL
    const errorParam = searchParams.get("error") || searchParams.get("error_code");
    if (errorParam) {
      setLinkStatus("INVALID_LINK");
      return;
    }

    if (typeof window === "undefined") return;

    // 2. Ekstrak token dari hash URL murni
    const rawHash = window.location.hash;
    if (!rawHash) {
      setLinkStatus("INVALID_LINK");
      return;
    }

    const hashString = rawHash.replace(/^#/, "");
    const hashParams = new URLSearchParams(hashString);

    // Cek apakah hash memuat error
    if (hashParams.get("error") || hashParams.get("error_code")) {
      setLinkStatus("INVALID_LINK");
      return;
    }

    const accessToken = hashParams.get("access_token");
    const type = hashParams.get("type");

    // Jika token tidak ada atau tipe bukan recovery (bila disertakan)
    if (!accessToken || (type && type !== "recovery")) {
      setLinkStatus("INVALID_LINK");
      return;
    }

    // Token recovery valid ditemukan di hash
    setToken(accessToken);
    setLinkStatus("READY");

    // 3. Segera bersihkan hash dari browser history
    try {
      window.history.replaceState(null, "", window.location.pathname);
    } catch {
      // Fallback aman bila browser membatasi replaceState
    }
  }, [searchParams]);

  const onSubmit = async (data: ResetPasswordDTO) => {
    if (!token) {
      setServerError("Tautan pemulihan tidak valid atau sudah kedaluwarsa.");
      setLinkStatus("INVALID_LINK");
      return;
    }

    setLoading(true);
    setServerError(null);

    try {
      await authService.resetPassword({
        access_token: token,
        password: data.password,
      });

      notify.success(
        "Kata Sandi Berhasil Diperbarui",
        "Silakan masuk dengan kata sandi baru Anda."
      );

      router.push("/login");
    } catch (err: unknown) {
      let message =
        err instanceof Error
          ? err.message
          : "Gagal memperbarui kata sandi. Silakan coba beberapa saat lagi.";

      // Sanitasi pesan teknis agar tetap ramah bahasa Indonesia
      if (
        message.includes("Server configuration error") ||
        message.includes("supabase") ||
        message.includes("PGRST") ||
        message.includes("fetch failed")
      ) {
        message = "Gagal memperbarui kata sandi. Silakan coba beberapa saat lagi.";
      }

      setServerError(message);
      notify.error("Gagal Memperbarui Kata Sandi", message);

      const lowerMessage = message.toLowerCase();
      if (
        lowerMessage.includes("tidak valid") ||
        lowerMessage.includes("kedaluwarsa") ||
        lowerMessage.includes("invalid") ||
        lowerMessage.includes("expired")
      ) {
        setLinkStatus("INVALID_LINK");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden bg-gradient-to-br from-teal-50/70 via-slate-50 to-emerald-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-teal-950/40 text-slate-900 dark:text-slate-100 font-nunito transition-colors duration-200">
      {/* Ambient decorative background glows */}
      <div className="absolute top-10 -left-20 w-80 h-80 rounded-full bg-teal-200/30 dark:bg-teal-900/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-96 h-96 rounded-full bg-emerald-200/25 dark:bg-emerald-900/10 blur-3xl pointer-events-none" />

      {/* Top Bar Navigation */}
      <div className="w-full max-w-lg mb-4 flex items-center justify-between relative z-10 min-w-0">
        <Link
          href="/login"
          aria-label="Kembali ke Halaman Masuk"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-teal-700 dark:hover:text-teal-400 transition-colors min-w-0"
        >
          <ArrowLeft size={14} className="shrink-0" />
          <span className="truncate min-w-0">Kembali ke Halaman Masuk</span>
        </Link>

        <ThemeToggle />
      </div>

      {/* Main Card Container */}
      <div className="w-full max-w-lg bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-xl shadow-teal-900/5 dark:shadow-black/40 p-6 sm:p-8 space-y-5 relative z-10 backdrop-blur-xs min-w-0">
        {linkStatus === "CHECKING" && (
          <div className="flex flex-col items-center text-center space-y-4 py-8 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400 flex items-center justify-center shadow-xs">
              <RefreshCw size={26} className="animate-spin shrink-0" />
            </div>
            <div className="space-y-1.5 min-w-0">
              <h2 className="text-lg sm:text-xl font-bold font-heading text-slate-900 dark:text-white min-w-0">
                Memverifikasi Tautan...
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-nunito max-w-sm min-w-0">
                Mohon tunggu sebentar, kami sedang memvalidasi tautan pemulihan kata sandi Anda.
              </p>
            </div>
          </div>
        )}

        {linkStatus === "INVALID_LINK" && (
          <div className="text-center space-y-5 min-w-0 animate-in fade-in-50 duration-200">
            {/* Warning Icon */}
            <div className="w-16 h-16 rounded-2xl border bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center shadow-xs">
              <AlertTriangle size={32} className="shrink-0" />
            </div>

            {/* Heading & Description */}
            <div className="space-y-2 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold font-heading text-slate-900 dark:text-white leading-tight min-w-0">
                Tautan Pemulihan Tidak Valid atau Kedaluwarsa
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-nunito min-w-0">
                Tautan pemulihan kata sandi ini tidak valid atau sudah kedaluwarsa. Silakan ajukan permohonan tautan pemulihan yang baru.
              </p>
            </div>

            {/* Action Group */}
            <div className="space-y-2.5 pt-2 min-w-0">
              <Link
                href="/forgot-password"
                className="block w-full min-w-0"
                aria-label="Minta Tautan Baru"
              >
                <Button className="w-full h-11 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md shadow-teal-700/20 gap-2 cursor-pointer min-w-0">
                  <span className="truncate min-w-0">Minta Tautan Baru</span>
                  <ArrowRight size={15} className="shrink-0" />
                </Button>
              </Link>

              <Link
                href="/login"
                className="block w-full min-w-0"
                aria-label="Kembali ke Halaman Masuk"
              >
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-10 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold gap-2 cursor-pointer min-w-0"
                >
                  <ArrowLeft size={14} className="shrink-0" />
                  <span className="truncate min-w-0">Kembali ke Halaman Masuk</span>
                </Button>
              </Link>
            </div>

            {/* Privacy Note */}
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 font-medium text-center pt-2 border-t border-slate-100 dark:border-slate-800 min-w-0">
              <ShieldCheck size={14} className="text-teal-600 dark:text-teal-400 shrink-0" />
              <span className="truncate min-w-0">Privat & Rahasia • Terikat Kode Etik HIMPSI</span>
            </div>
          </div>
        )}

        {linkStatus === "READY" && (
          <>
            {/* Header / Brand */}
            <div className="flex flex-col items-center text-center space-y-2 min-w-0">
              <Logo size="lg" showTagline />

              <div className="pt-2 min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold font-heading text-slate-900 dark:text-white leading-tight min-w-0">
                  Buat Kata Sandi Baru
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-nunito mt-1 leading-relaxed min-w-0">
                  Masukkan kata sandi baru untuk akun Anda. Minimal 8 karakter dan maksimal 72 karakter.
                </p>
              </div>
            </div>

            {/* Error Banner */}
            {serverError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2 min-w-0"
              >
                <AlertCircle size={15} className="shrink-0 text-rose-600 dark:text-rose-400" />
                <span className="min-w-0">{serverError}</span>
              </div>
            )}

            {/* Form */}
            <form
              className="space-y-4 min-w-0"
              onSubmit={handleSubmit(onSubmit)}
              noValidate
            >
              {/* Kata Sandi Baru */}
              <div className="space-y-1.5 min-w-0">
                <label
                  htmlFor="password"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300 block min-w-0"
                >
                  Kata Sandi Baru
                </label>
                <PasswordInput
                  id="password"
                  placeholder="Minimal 8 karakter"
                  autoComplete="new-password"
                  aria-label="Kata sandi baru"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? "password-error" : undefined}
                  {...register("password")}
                  className={`h-10 text-xs sm:text-sm bg-slate-50/50 dark:bg-slate-800/60 dark:text-slate-100 rounded-xl focus-visible:ring-teal-600 min-w-0 ${
                    errors.password
                      ? "border-rose-400 focus-visible:ring-rose-500 bg-rose-50/30 dark:bg-rose-950/30"
                      : "border-slate-200 dark:border-slate-700"
                  }`}
                />
                {errors.password && (
                  <p
                    id="password-error"
                    role="alert"
                    className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1 min-w-0"
                  >
                    <AlertCircle size={12} className="shrink-0" />
                    <span className="min-w-0">{errors.password.message}</span>
                  </p>
                )}
              </div>

              {/* Konfirmasi Kata Sandi Baru */}
              <div className="space-y-1.5 min-w-0">
                <label
                  htmlFor="confirm_password"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300 block min-w-0"
                >
                  Konfirmasi Kata Sandi
                </label>
                <PasswordInput
                  id="confirm_password"
                  placeholder="Ulangi kata sandi baru"
                  autoComplete="new-password"
                  aria-label="Konfirmasi kata sandi baru"
                  aria-invalid={!!errors.confirm_password}
                  aria-describedby={errors.confirm_password ? "confirm-password-error" : undefined}
                  {...register("confirm_password")}
                  className={`h-10 text-xs sm:text-sm bg-slate-50/50 dark:bg-slate-800/60 dark:text-slate-100 rounded-xl focus-visible:ring-teal-600 min-w-0 ${
                    errors.confirm_password
                      ? "border-rose-400 focus-visible:ring-rose-500 bg-rose-50/30 dark:bg-rose-950/30"
                      : "border-slate-200 dark:border-slate-700"
                  }`}
                />
                {errors.confirm_password && (
                  <p
                    id="confirm-password-error"
                    role="alert"
                    className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1 min-w-0"
                  >
                    <AlertCircle size={12} className="shrink-0" />
                    <span className="min-w-0">{errors.confirm_password.message}</span>
                  </p>
                )}
              </div>

              {/* Tombol Simpan */}
              <Button
                type="submit"
                disabled={loading}
                aria-label={loading ? "Menyimpan kata sandi baru..." : "Simpan Kata Sandi"}
                className="w-full h-11 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs sm:text-sm cursor-pointer shadow-md shadow-teal-700/20 gap-2 mt-2 min-w-0"
              >
                {loading ? (
                  <>
                    <RefreshCw size={15} className="animate-spin shrink-0" />
                    <span className="truncate min-w-0">Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <span className="truncate min-w-0">Simpan Kata Sandi</span>
                    <ArrowRight size={16} className="shrink-0" />
                  </>
                )}
              </Button>
            </form>

            {/* Privacy Note */}
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 font-medium text-center pt-1 border-t border-slate-100 dark:border-slate-800 min-w-0">
              <ShieldCheck size={14} className="text-teal-600 dark:text-teal-400 shrink-0" />
              <span className="truncate min-w-0">Privat & Rahasia • Terikat Kode Etik HIMPSI</span>
            </div>

            {/* Back to Login Link */}
            <p className="text-center text-xs text-slate-500 dark:text-slate-400 min-w-0">
              Kembali ke{" "}
              <Link
                href="/login"
                aria-label="Kembali ke halaman masuk"
                className="text-teal-700 dark:text-teal-400 hover:underline font-bold"
              >
                Halaman Masuk
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
