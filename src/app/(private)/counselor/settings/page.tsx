"use client";

import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  ShieldCheck,
  Building2,
  Save,
  CheckCircle2,
  Coins,
  Lock,
  Plus,
  X,
  Loader2,
} from "lucide-react";
import { useUserStore } from "@/store/user-store";
import { notify } from "@/lib/toast";
import { userService, UserApiError } from "@/services/user.service";
import { usePublicSettings } from "@/hooks/use-public-settings";
import type { PsikologProfile, UpdateMePsikologPayload } from "@/types/user-profile";

const SUGGESTED_SPECIALIZATIONS = [
  "Ansietas Klinis",
  "Depresi & Gangguan Mood",
  "Trauma & PTSD",
  "Konseling Relasi & Pasangan",
  "Burnout Karier & Stres Kerja",
  "Regulasi Emosi",
  "Grief & Duka Cita",
  "Pengembangan Diri",
];

export default function CounselorSettingsPage() {
  const { settings: publicSettings } = usePublicSettings();
  const minExtCoins = publicSettings?.extension_price?.min_coins ?? 1;
  const maxExtCoins = publicSettings?.extension_price?.max_coins ?? 10;

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Read-only credentials
  const [fullNameWithDegree, setFullNameWithDegree] = useState("");
  const [sippNumber, setSippNumber] = useState("");

  // Editable fields
  const [phone, setPhone] = useState("");
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [experienceYears, setExperienceYears] = useState<number>(0);
  const [sessionRate, setSessionRate] = useState<number>(150000);
  const [extensionPriceCoins, setExtensionPriceCoins] = useState<number>(2);

  // Bank Info (payout reference)
  const [bankAccount, setBankAccount] = useState("8820491823");
  const [bankName, setBankName] = useState("Bank Central Asia (BCA)");

  // Status feedback
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let isSubscribed = true;

    async function loadMe() {
      try {
        setLoadingProfile(true);
        const res = await userService.getMe();
        if (!isSubscribed) return;

        if (res.success && res.data) {
          const u = res.data.user;
          const p = res.data.profile as PsikologProfile | null;

          setFullNameWithDegree(p?.nama_lengkap_gelar || u.fullName || "");
          setSippNumber(p?.nomor_sipp_str || "");
          setPhone(u.no_wa || "");

          if (Array.isArray(p?.spesialisasi) && p.spesialisasi.length > 0) {
            setSpecializations(p.spesialisasi);
          } else {
            setSpecializations(["Ansietas Klinis", "Burnout Karier & Stres Kerja"]);
          }

          setExperienceYears(p?.tahun_pengalaman ?? 0);
          const rawTarif = Number(p?.tarif_sesi) || 150000;
          setSessionRate(rawTarif > 0 ? rawTarif : 150000);

          if (typeof p?.extension_price_coins === "number") {
            setExtensionPriceCoins(p.extension_price_coins);
          } else {
            setExtensionPriceCoins(minExtCoins || 2);
          }
        }
      } catch (err) {
        console.error("Gagal memuat profil psikolog dari API:", err);
      } finally {
        if (isSubscribed) setLoadingProfile(false);
      }
    }

    loadMe();

    return () => {
      isSubscribed = false;
    };
  }, [minExtCoins]);

  const handleAddTag = (tagToAdd: string) => {
    const trimmed = tagToAdd.trim();
    if (!trimmed) return;
    if (specializations.includes(trimmed)) return;
    if (specializations.length >= 10) {
      notify.error("Batas Maksimal", "Maksimal 10 bidang spesialisasi.");
      return;
    }
    setSpecializations((prev) => [...prev, trimmed]);
    setNewTagInput("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setSpecializations((prev) => prev.filter((t) => t !== tagToRemove));
  };

  const calculatedCoins = Math.floor(sessionRate / 10000);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    if (specializations.length === 0) {
      setErrors({ spesialisasi: "Minimal tentukan 1 bidang spesialisasi" });
      setIsSubmitting(false);
      return;
    }

    if (sessionRate % 10000 !== 0) {
      setErrors({ tarif_sesi: "Tarif sesi harus kelipatan Rp 10.000" });
      setIsSubmitting(false);
      return;
    }

    if (extensionPriceCoins < minExtCoins || extensionPriceCoins > maxExtCoins) {
      setErrors({
        extension_price_coins: `Tarif perpanjangan sesi harus berada dalam rentang ${minExtCoins} - ${maxExtCoins} koin`,
      });
      setIsSubmitting(false);
      return;
    }

    const payload: UpdateMePsikologPayload = {
      spesialisasi: specializations,
      tahun_pengalaman: Number(experienceYears),
      tarif_sesi: Number(sessionRate),
      extension_price_coins: Number(extensionPriceCoins),
    };

    if (phone.trim()) {
      payload.no_wa = phone.trim();
    }

    try {
      const res = await userService.updateMe(payload);
      if (res.success && res.data) {
        useUserStore.getState().setAuthSession(res.data.user, undefined, res.data.profile);
        await useUserStore.getState().syncSession();

        notify.success("Pengaturan Disimpan", "Profil praktik psikolog berhasil diperbarui.");
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err: unknown) {
      if (err instanceof UserApiError) {
        if (err.status === 409 || err.code === "PHONE_ALREADY_EXISTS") {
          setErrors({ no_wa: err.message });
        } else if (err.status === 422 && err.details) {
          const fieldErrors: Record<string, string> = {};
          for (const [key, msgs] of Object.entries(err.details)) {
            if (Array.isArray(msgs) && msgs.length > 0) {
              fieldErrors[key] = msgs[0];
            }
          }
          setErrors(fieldErrors);
        }
        notify.error("Gagal Menyimpan", err.message);
      } else {
        notify.error("Kesalahan Sistem", err instanceof Error ? err.message : "Gagal memperbarui profil.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 font-nunito pb-12 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* 1. Header */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 dark:text-white tracking-tight">
          Pengaturan Praktik & Lisensi SIPPK
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Kelola kontak WhatsApp, tarif per sesi, tarif ekstensi, spesialisasi klinis, dan kredensial praktik psikolog
        </p>
      </div>

      {saveSuccess && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>Pengaturan profil praktik psikolog berhasil disimpan.</span>
        </div>
      )}

      {/* 2. Main Form */}
      {loadingProfile ? (
        <div className="space-y-6 animate-pulse">
          <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5 shadow-xs">
            <div className="space-y-2">
              <Skeleton className="w-56 h-5 rounded-md" />
              <Skeleton className="w-72 h-3 rounded-md" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="w-28 h-4 rounded-md" />
                  <Skeleton className="w-full h-9 rounded-xl" />
                </div>
              ))}
            </div>
          </Card>
          <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 shadow-xs">
            <Skeleton className="w-48 h-5 rounded-md" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Skeleton className="w-full h-10 rounded-xl" />
              <Skeleton className="w-full h-10 rounded-xl" />
            </div>
            <div className="flex justify-end pt-2">
              <Skeleton className="w-32 h-9 rounded-xl" />
            </div>
          </Card>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
        {/* Card 1: Identitas & Lisensi (Read-Only) */}
        <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="font-heading text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck size={18} className="text-teal-600 dark:text-teal-400" />
              Kredensial & Lisensi Terverifikasi (Terkunci)
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
              Data lisensi hukum dan identitas resmi diverifikasi langsung oleh Admin TemanBicara
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Lock size={13} className="text-slate-400" />
                    Nama Lengkap & Gelar Akademik
                  </Label>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-nunito">
                    Hubungi admin untuk mengubah
                  </span>
                </div>
                <div className="relative">
                  <Input
                    disabled
                    value={loadingProfile ? "Memuat..." : fullNameWithDegree}
                    className="h-9 text-xs sm:text-sm bg-slate-100/80 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 rounded-xl cursor-not-allowed pl-8"
                  />
                  <Lock size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Lock size={13} className="text-slate-400" />
                    Nomor SIPPK / STR Resmi
                  </Label>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-nunito">
                    Hubungi admin untuk mengubah
                  </span>
                </div>
                <div className="relative">
                  <Input
                    disabled
                    value={loadingProfile ? "Memuat..." : sippNumber}
                    className="h-9 text-xs sm:text-sm bg-slate-100/80 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 rounded-xl cursor-not-allowed pl-8 pr-24 font-mono"
                  />
                  <Lock size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                    Terverifikasi
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Pengaturan Sesi & Kontak Praktik */}
        <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="font-heading text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Coins size={18} className="text-teal-600 dark:text-teal-400" />
              Kontak, Tarif Sesi & Pengalaman Praktik
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
              Tentukan tarif sesi konsultasi dan perpanjangan sesi yang ditampilkan kepada calon klien
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4 sm:p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nomor WhatsApp */}
              <div className="space-y-1.5">
                <Label htmlFor="counselorPhone" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Nomor WhatsApp Praktik
                </Label>
                <PhoneInput
                  id="counselorPhone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="812 3456 7890"
                  className="h-9 text-xs sm:text-sm bg-slate-50/50 dark:bg-slate-800/60 dark:text-slate-100 border-slate-200 dark:border-slate-700 rounded-xl focus-within:ring-teal-600"
                />
                {errors.no_wa && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">{errors.no_wa}</p>
                )}
              </div>

              {/* Tahun Pengalaman */}
              <div className="space-y-1.5">
                <Label htmlFor="experienceYears" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Pengalaman Praktik Klinis (Tahun)
                </Label>
                <Input
                  id="experienceYears"
                  type="number"
                  min={0}
                  max={60}
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="h-9 text-xs sm:text-sm bg-slate-50/50 dark:bg-slate-800/60 dark:text-slate-100 border-slate-200 dark:border-slate-700 rounded-xl"
                  required
                />
                {errors.tahun_pengalaman && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400">{errors.tahun_pengalaman}</p>
                )}
              </div>

              {/* Tarif per Sesi Konseling (Rp, kelipatan 10.000) */}
              <div className="space-y-1.5 md:col-span-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="sessionRate" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Tarif per Sesi Konseling 45 Menit (Rp)
                  </Label>
                  <span className="text-xs font-bold font-mono text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/70 px-2.5 py-0.5 rounded-md border border-teal-200 dark:border-teal-800">
                    = {calculatedCoins.toLocaleString("id-ID")} koin
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-400">
                    Rp
                  </span>
                  <Input
                    id="sessionRate"
                    type="number"
                    step={10000}
                    min={50000}
                    max={5000000}
                    value={sessionRate}
                    onChange={(e) => setSessionRate(parseInt(e.target.value, 10) || 0)}
                    className="h-9 text-xs sm:text-sm pl-9 font-mono font-bold bg-slate-50/50 dark:bg-slate-800/60 dark:text-slate-100 border-slate-200 dark:border-slate-700 rounded-xl"
                    required
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-nunito">
                  <span>Kelipatan Rp 10.000 (Min. Rp 50.000, Maks. Rp 5.000.000)</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    1 Koin = Rp 10.000
                  </span>
                </div>
                {errors.tarif_sesi && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">{errors.tarif_sesi}</p>
                )}
              </div>

              {/* Poin 4: Tarif Perpanjangan Sesi (Ekstensi 10 Menit, Koin) */}
              <div className="space-y-1.5 md:col-span-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <Label htmlFor="extensionPriceCoins" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Tarif Perpanjangan Sesi (+10 Menit)
                  </Label>
                  <span className="text-xs font-bold font-mono text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/70 px-2.5 py-0.5 rounded-md border border-teal-200 dark:border-teal-800">
                    = Rp {((Number(extensionPriceCoins) || 0) * 10000).toLocaleString("id-ID")}
                  </span>
                </div>
                <div className="relative">
                  <Input
                    id="extensionPriceCoins"
                    type="number"
                    min={minExtCoins}
                    max={maxExtCoins}
                    step={1}
                    value={extensionPriceCoins}
                    onChange={(e) => setExtensionPriceCoins(parseInt(e.target.value, 10) || 0)}
                    className="h-9 text-xs sm:text-sm pl-3 pr-16 font-mono font-bold bg-slate-50/50 dark:bg-slate-800/60 dark:text-slate-100 border-slate-200 dark:border-slate-700 rounded-xl"
                    required
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    Koin
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-nunito">
                  <span>
                    Rentang pengaturan sistem: {minExtCoins} s/d {maxExtCoins} Koin
                  </span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    1 Koin = Rp 10.000
                  </span>
                </div>
                {errors.extension_price_coins && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
                    {errors.extension_price_coins}
                  </p>
                )}
              </div>
            </div>

            {/* Bidang Spesialisasi Klinis */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Bidang Spesialisasi & Keahlian Konseling ({specializations.length}/10)
              </Label>

              {/* Selected Tags */}
              <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                {specializations.length === 0 ? (
                  <span className="text-xs text-slate-400 italic">Belum ada spesialisasi dipilih</span>
                ) : (
                  specializations.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-200 text-xs font-semibold"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                        title="Hapus"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))
                )}
              </div>

              {/* Input New Tag */}
              <div className="flex items-center gap-2">
                <Input
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTag(newTagInput);
                    }
                  }}
                  placeholder="Ketik spesialisasi baru lalu tekan Tambah"
                  className="h-8 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddTag(newTagInput)}
                  className="h-8 text-xs rounded-xl shrink-0 gap-1"
                >
                  <Plus size={13} />
                  Tambah
                </Button>
              </div>

              {/* Suggestions */}
              <div className="space-y-1 pt-1">
                <span className="text-[11px] text-slate-400 block font-nunito">Saran spesialisasi populer:</span>
                <div className="flex flex-wrap gap-1">
                  {SUGGESTED_SPECIALIZATIONS.filter((s) => !specializations.includes(s)).map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => handleAddTag(sug)}
                      className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 hover:bg-teal-50 dark:bg-slate-800 dark:hover:bg-teal-950/60 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                    >
                      + {sug}
                    </button>
                  ))}
                </div>
              </div>

              {errors.spesialisasi && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">{errors.spesialisasi}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Rekening Bank Pencairan (Coming Soon - Payout API) */}
        <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="font-heading text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 size={18} className="text-teal-600 dark:text-teal-400" />
                Rekening Bank Pencairan Honor
              </CardTitle>
              <Badge
                variant="outline"
                className="text-[10px] bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
              >
                Coming Soon
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
              Integrasi pencairan otomatis ke rekening bank sedang disiapkan. Honor saat ini dicatat dan dikonversi melalui mutasi saldo koin.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="bankName" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Nama Bank
                </Label>
                <Input
                  id="bankName"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  disabled
                  className="h-9 text-xs sm:text-sm bg-slate-100/80 dark:bg-slate-800/40 text-slate-500 border-slate-200 dark:border-slate-700 rounded-xl cursor-not-allowed"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="accountNumber" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Nomor Rekening
                </Label>
                <Input
                  id="accountNumber"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  disabled
                  className="h-9 text-xs sm:text-sm bg-slate-100/80 dark:bg-slate-800/40 text-slate-500 border-slate-200 dark:border-slate-700 rounded-xl cursor-not-allowed font-mono"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">
              * Rekening rujukan pencairan dapat diubah setelah modul integrasi bank mitra resmi dirilis.
            </p>
          </CardContent>
        </Card>

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="text-xs sm:text-sm bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl px-6 py-2.5 h-10 shadow-xs gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Save size={15} />
                <span>Simpan Pengaturan Praktik</span>
              </>
            )}
          </Button>
        </div>
      </form>
      )}
    </div>
  );
}
