"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, ForgotPasswordDTO } from "@/lib/validations/auth";
import { authService } from "@/services/auth.service";
import { notify } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/shared/atoms/Logo";
import { ThemeToggle } from "@/components/shared/atoms/theme-toggle";
import {
  Mail,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";

export default function ForgotPasswordView() {
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ForgotPasswordDTO>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: ForgotPasswordDTO) => {
    setLoading(true);
    setServerError(null);

    try {
      const res = await authService.requestPasswordReset(data.email);
      setSubmittedEmail(data.email);
      setIsSuccess(true);
      notify.success(
        "Permintaan Terkirim",
        res.message ||
          "Jika email terdaftar, tautan pemulihan kata sandi telah dikirim ke kotak masuk Anda."
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Gagal memproses permintaan pemulihan kata sandi. Silakan coba beberapa saat lagi.";
      setServerError(message);
      notify.error("Gagal Mengirim", message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetForm = () => {
    setIsSuccess(false);
    setServerError(null);
    reset({ email: submittedEmail });
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
        {!isSuccess ? (
          /* Form Mode */
          <>
            {/* Header / Brand */}
            <div className="flex flex-col items-center text-center space-y-2 min-w-0">
              <Logo size="lg" showTagline />

              <div className="pt-2 min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold font-heading text-slate-900 dark:text-white leading-tight min-w-0">
                  Lupa Kata Sandi?
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-nunito mt-1 leading-relaxed min-w-0">
                  Masukkan alamat email yang terdaftar untuk menerima tautan pemulihan kata sandi akun Anda.
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
              className="space-y-3.5 min-w-0"
              onSubmit={handleSubmit(onSubmit)}
              noValidate
            >
              <div className="space-y-1.5 min-w-0">
                <label
                  htmlFor="email"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300 block min-w-0"
                >
                  Email Akun
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="nama@email.com"
                  autoComplete="email"
                  aria-label="Alamat email akun"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? "email-error" : undefined}
                  {...register("email")}
                  className={`h-10 text-xs sm:text-sm bg-slate-50/50 dark:bg-slate-800/60 dark:text-slate-100 rounded-xl focus-visible:ring-teal-600 min-w-0 ${
                    errors.email
                      ? "border-rose-400 focus-visible:ring-rose-500 bg-rose-50/30 dark:bg-rose-950/30"
                      : "border-slate-200 dark:border-slate-700"
                  }`}
                />
                {errors.email && (
                  <p
                    id="email-error"
                    role="alert"
                    className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1 min-w-0"
                  >
                    <AlertCircle size={12} className="shrink-0" />
                    <span className="min-w-0">{errors.email.message}</span>
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={loading}
                aria-label={loading ? "Mengirim tautan pemulihan..." : "Kirim Tautan Pemulihan"}
                className="w-full h-11 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs sm:text-sm cursor-pointer shadow-md shadow-teal-700/20 gap-2 mt-1 min-w-0"
              >
                {loading ? (
                  <>
                    <RefreshCw size={15} className="animate-spin shrink-0" />
                    <span className="truncate min-w-0">Mengirim...</span>
                  </>
                ) : (
                  <>
                    <span className="truncate min-w-0">Kirim Tautan Pemulihan</span>
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
              Ingat kata sandi akun Anda?{" "}
              <Link
                href="/login"
                aria-label="Kembali ke halaman masuk"
                className="text-teal-700 dark:text-teal-400 hover:underline font-bold"
              >
                Masuk ke Akun
              </Link>
            </p>
          </>
        ) : (
          /* Success Mode */
          <div className="text-center space-y-5 min-w-0 animate-in fade-in-50 duration-200">
            {/* Success Icon */}
            <div className="w-16 h-16 rounded-2xl border bg-teal-50 dark:bg-teal-950/60 border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400 mx-auto flex items-center justify-center shadow-xs">
              <Mail size={32} className="shrink-0" />
            </div>

            {/* Heading & Uniform Description */}
            <div className="space-y-2 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold font-heading text-slate-900 dark:text-white leading-tight min-w-0">
                Periksa Email Anda
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-nunito min-w-0">
                Jika email terdaftar, tautan pemulihan kata sandi telah dikirim ke kotak masuk Anda. Silakan periksa folder inbox atau spam.
              </p>
            </div>

            {/* Submitted Email Badge */}
            {submittedEmail && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2 justify-center min-w-0">
                <CheckCircle2 size={14} className="text-teal-600 dark:text-teal-400 shrink-0" />
                <span className="font-semibold truncate min-w-0">{submittedEmail}</span>
              </div>
            )}

            {/* Action Group */}
            <div className="space-y-2.5 pt-2 min-w-0">
              <Link
                href="/login"
                className="block w-full min-w-0"
                aria-label="Kembali ke Halaman Masuk"
              >
                <Button className="w-full h-11 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md shadow-teal-700/20 gap-2 cursor-pointer min-w-0">
                  <span className="truncate min-w-0">Kembali ke Halaman Masuk</span>
                  <ArrowRight size={15} className="shrink-0" />
                </Button>
              </Link>

              <Button
                type="button"
                variant="outline"
                onClick={handleResetForm}
                aria-label="Kirim ulang tautan pemulihan"
                className="w-full h-10 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold gap-2 cursor-pointer min-w-0"
              >
                <RefreshCw size={14} className="shrink-0" />
                <span className="truncate min-w-0">Kirim Ulang</span>
              </Button>
            </div>

            {/* Privacy Note */}
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 font-medium text-center pt-2 border-t border-slate-100 dark:border-slate-800 min-w-0">
              <ShieldCheck size={14} className="text-teal-600 dark:text-teal-400 shrink-0" />
              <span className="truncate min-w-0">Privat & Rahasia • Terikat Kode Etik HIMPSI</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
