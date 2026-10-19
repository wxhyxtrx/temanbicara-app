"use client";

import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User,
  ShieldCheck,
  Bell,
  Lock,
  Camera,
  Download,
  AlertTriangle,
  HeartPulse,
  Save,
  CheckCircle2,
  Loader2,
  Clock,
} from "lucide-react";
import { MdVerified } from "react-icons/md";
import { useUserStore } from "@/store/user-store";
import { useNotificationStore } from "@/store/notification-store";
import { notify } from "@/lib/toast";
import { userService, UserApiError } from "@/services/user.service";
import type { PasienProfile, UpdateMePasienPayload } from "@/types/user-profile";

export default function PatientSettingsPage() {
  const user = useUserStore((state) => state.user);

  const [mounted, setMounted] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [fullName, setFullName] = useState("");
  const [alias, setAlias] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [kontakDaruratNama, setKontakDaruratNama] = useState("");
  const [kontakDaruratWa, setKontakDaruratWa] = useState("");
  const [mentalNotes, setMentalNotes] = useState("");
  const [isAnonymousDefault, setIsAnonymousDefault] = useState(false);

  // Preferences & Security states
  const [sessionReminder, setSessionReminder] = useState(true);
  const [psychologistMessageAlert, setPsychologistMessageAlert] = useState(true);
  const [twoFactorAuth, setTwoFactorAuth] = useState(false);

  // Status feedback
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setMounted(true);
    let isSubscribed = true;

    async function loadMe() {
      try {
        setLoadingProfile(true);
        const res = await userService.getMe();
        if (!isSubscribed) return;

        if (res.success && res.data) {
          const u = res.data.user;
          const p = res.data.profile as PasienProfile | null;

          setFullName(p?.nama_lengkap || u.fullName || "");
          setAlias(p?.nama_panggilan || "");
          setEmail(u.email || "");
          setPhone(u.no_wa || "");
          setKontakDaruratNama(p?.kontak_darurat_nama || "");
          setKontakDaruratWa(p?.kontak_darurat_wa || "");
          setIsAnonymousDefault(Boolean(p?.is_anonim_default));
        }
      } catch (err) {
        console.error("Gagal memuat profil pasien dari API:", err);
      } finally {
        if (isSubscribed) setLoadingProfile(false);
      }
    }

    loadMe();

    return () => {
      isSubscribed = false;
    };
  }, []);

  const handleFullNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFullName(val);
    if (!alias) {
      setAlias(val.trim().split(" ")[0] || "");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    const payload: UpdateMePasienPayload = {
      nama_lengkap: fullName.trim(),
      nama_panggilan: alias.trim() ? alias.trim() : null,
      is_anonim_default: isAnonymousDefault,
    };

    if (phone.trim()) {
      payload.no_wa = phone.trim();
    }
    if (kontakDaruratNama.trim()) {
      payload.kontak_darurat_nama = kontakDaruratNama.trim();
    }
    if (kontakDaruratWa.trim()) {
      payload.kontak_darurat_wa = kontakDaruratWa.trim();
    }

    try {
      const res = await userService.updateMe(payload);
      if (res.success && res.data) {
        useUserStore.getState().setAuthSession(res.data.user, undefined, res.data.profile);
        await useUserStore.getState().syncSession();

        useNotificationStore.getState().addNotification({
          title: "Profil Diperbarui",
          message: "Data identitas pasien dan preferensi akun berhasil disimpan.",
          type: "sistem",
          actionUrl: "/patient/settings",
        });

        notify.success("Profil Diperbarui", "Data identitas pasien dan preferensi akun berhasil disimpan.");
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

  const handleToggleAnonymous = async (checked: boolean) => {
    setIsAnonymousDefault(checked);
    try {
      const res = await userService.updateMe({ is_anonim_default: checked });
      if (res.success && res.data) {
        useUserStore.getState().setAuthSession(res.data.user, undefined, res.data.profile);
        notify.success(
          "Mode Anonim Diperbarui",
          checked ? "Mode anonim otomatis diaktifkan untuk konsultasi." : "Mode anonim otomatis dinonaktifkan."
        );
      }
    } catch (err: unknown) {
      setIsAnonymousDefault(!checked);
      notify.error("Gagal Mengubah Mode Anonim", err instanceof Error ? err.message : "Terjadi kesalahan.");
    }
  };

  const isEmergencyEmpty = !loadingProfile && (!kontakDaruratNama.trim() || !kontakDaruratWa.trim());

  return (
    <div className="flex flex-col gap-6 font-nunito pb-12 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* 1. Page Header */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 dark:text-white tracking-tight">
          Pengaturan & Privasi Pasien
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Kelola identitas klinis, tingkat kerahasiaan konseling, kontak darurat, dan keamanan akunmu
        </p>
      </div>

      {/* Banner Peringatan Kontak Darurat Kosong */}
      {isEmergencyEmpty && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 text-xs sm:text-sm animate-in fade-in">
          <AlertTriangle className="size-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold font-heading text-sm text-amber-950 dark:text-amber-100">
              Lengkapi kontak darurat demi keselamatanmu
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-300 font-nunito leading-relaxed">
              Informasi kontak darurat Anda belum lengkap. Kontak ini wajib sesuai SOP telekonseling klinis untuk penanganan cepat saat kondisi krisis.
            </p>
          </div>
        </div>
      )}

      {saveSuccess && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold animate-in fade-in duration-200">
          <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Pengaturan berhasil diperbarui dan disimpan secara aman.</span>
        </div>
      )}

      {/* 2. Main Tabs Navigation */}
      {loadingProfile ? (
        <div className="space-y-6 animate-pulse">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-9 w-28 rounded-xl shrink-0" />
            ))}
          </div>
          <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6 shadow-xs">
            <div className="flex items-center gap-4">
              <Skeleton className="w-16 h-16 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="w-48 h-5 rounded-md" />
                <Skeleton className="w-32 h-3 rounded-md" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="w-24 h-4 rounded-md" />
                  <Skeleton className="w-full h-9 rounded-xl" />
                </div>
              ))}
            </div>
            <div className="flex justify-end pt-2">
              <Skeleton className="w-32 h-9 rounded-xl" />
            </div>
          </Card>
        </div>
      ) : (
        <Tabs defaultValue="profile" className="w-full space-y-6">
        <TabsList className="bg-slate-100/90 dark:bg-slate-900 p-1 rounded-xl flex w-full sm:w-auto overflow-x-auto justify-start border border-slate-200/80 dark:border-slate-800">
          <TabsTrigger
            value="profile"
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-teal-800 dark:data-[state=active]:text-teal-300 text-slate-600 dark:text-slate-400 data-[state=active]:shadow-xs rounded-lg px-3.5 py-2 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <User size={15} />
            <span>Profil Pasien</span>
          </TabsTrigger>
          <TabsTrigger
            value="privacy"
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-teal-800 dark:data-[state=active]:text-teal-300 text-slate-600 dark:text-slate-400 data-[state=active]:shadow-xs rounded-lg px-3.5 py-2 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <ShieldCheck size={15} />
            <span>Kerahasiaan Medis</span>
          </TabsTrigger>
          <TabsTrigger
            value="notifications"
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-teal-800 dark:data-[state=active]:text-teal-300 text-slate-600 dark:text-slate-400 data-[state=active]:shadow-xs rounded-lg px-3.5 py-2 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Bell size={15} />
            <span>Notifikasi Sesi</span>
            <Badge
              variant="outline"
              className="ml-1 text-[9px] px-1.5 py-0 bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
            >
              Coming Soon
            </Badge>
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-teal-800 dark:data-[state=active]:text-teal-300 text-slate-600 dark:text-slate-400 data-[state=active]:shadow-xs rounded-lg px-3.5 py-2 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Lock size={15} />
            <span>Keamanan Akun</span>
            <Badge
              variant="outline"
              className="ml-1 text-[9px] px-1.5 py-0 bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
            >
              Coming Soon
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: PROFIL PASIEN */}
        <TabsContent value="profile" className="space-y-6">
          {/* Card Avatar & Status */}
          <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
            <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/80">
              <CardTitle className="font-heading text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Identitas Konseling
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
                Informasi ini digunakan oleh psikolog berlisensi selama sesi konsultasi berlangsung
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                <div className="relative shrink-0">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-950 dark:to-teal-900 border-2 border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 font-bold text-xl flex items-center justify-center font-heading shadow-xs">
                    {user.avatarInitials || (fullName ? fullName.slice(0, 2).toUpperCase() : "TB")}
                  </div>
                  <Button
                    size="icon"
                    variant="outline"
                    className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-xs cursor-pointer"
                    title="Ganti foto avatar"
                    type="button"
                    onClick={() => notify.info("Unggah Avatar", "Fitur unggah avatar khusus segera hadir. Inisial otomatis diperbarui dari nama Anda.")}
                  >
                    <Camera size={13} />
                  </Button>
                </div>

                <div className="space-y-2 text-center sm:text-left flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <h3 className="font-heading font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                      {loadingProfile ? "Memuat profil..." : fullName || user.fullName}
                    </h3>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      <MdVerified className="text-sky-500 text-xs" /> Pasien Terverifikasi
                    </span>
                    <Badge variant="outline" className="text-[10px] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700">
                      ID: {user.patientId || user.id.slice(0, 8)}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-nunito max-w-lg leading-relaxed">
                    Identitasmu hanya dapat diakses oleh psikolog yang bertugas dalam sesimu. Kamu tetap dapat menyamarkan nama ini kapan pun menggunakan Mode Anonim.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Form Biodata Pasien */}
          <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="font-heading text-base font-bold text-slate-900 dark:text-white">
                Data Pribadi & Kontak
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
                Data profil tersimpan langsung ke sistem TemanBicara
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 sm:p-6">
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Nama Lengkap */}
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Nama Lengkap (Sesuai KTP/Paspor)
                    </Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={handleFullNameChange}
                      required
                      placeholder="Masukkan nama lengkap"
                      className="h-9 text-xs sm:text-sm bg-slate-50/50 dark:bg-slate-800/60 dark:text-slate-100 border-slate-200 dark:border-slate-700 rounded-xl focus-visible:ring-teal-600"
                    />
                    {errors.nama_lengkap && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400">{errors.nama_lengkap}</p>
                    )}
                  </div>

                  {/* Nama Panggilan */}
                  <div className="space-y-1.5">
                    <Label htmlFor="alias" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Nama Panggilan / Alias di Chat
                    </Label>
                    <Input
                      id="alias"
                      value={alias}
                      onChange={(e) => setAlias(e.target.value)}
                      placeholder="Contoh: Wahyu"
                      className="h-9 text-xs sm:text-sm bg-slate-50/50 dark:bg-slate-800/60 dark:text-slate-100 border-slate-200 dark:border-slate-700 rounded-xl focus-visible:ring-teal-600"
                    />
                    {errors.nama_panggilan && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400">{errors.nama_panggilan}</p>
                    )}
                  </div>

                  {/* Email (Read-Only) */}
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Alamat Email (Akun)
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      disabled
                      className="h-9 text-xs sm:text-sm bg-slate-100 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 rounded-xl cursor-not-allowed"
                    />
                    <span className="text-[10px] text-slate-400 block font-nunito">
                      Email terikat akun autentikasi dan tidak dapat diubah di sini.
                    </span>
                  </div>

                  {/* Nomor WhatsApp */}
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Nomor WhatsApp (Pengingat Sesi)
                    </Label>
                    <PhoneInput
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="812 3456 7890"
                      className="h-9 text-xs sm:text-sm bg-slate-50/50 dark:bg-slate-800/60 dark:text-slate-100 border-slate-200 dark:border-slate-700 rounded-xl focus-within:ring-teal-600"
                    />
                    {errors.no_wa && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">{errors.no_wa}</p>
                    )}
                  </div>

                  {/* Nama Kontak Darurat */}
                  <div className="space-y-1.5">
                    <Label htmlFor="kontakDaruratNama" className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <HeartPulse size={14} className="text-rose-600 dark:text-rose-400" />
                      Nama Kontak Darurat
                    </Label>
                    <Input
                      id="kontakDaruratNama"
                      placeholder="Contoh: Sarah (Pasangan / Keluarga)"
                      value={kontakDaruratNama}
                      onChange={(e) => setKontakDaruratNama(e.target.value)}
                      className="h-9 text-xs sm:text-sm bg-slate-50/50 dark:bg-slate-800/60 dark:text-slate-100 border-slate-200 dark:border-slate-700 rounded-xl focus-visible:ring-teal-600"
                    />
                    {errors.kontak_darurat_nama && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400">{errors.kontak_darurat_nama}</p>
                    )}
                  </div>

                  {/* Nomor WhatsApp Kontak Darurat */}
                  <div className="space-y-1.5">
                    <Label htmlFor="kontakDaruratWa" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Nomor WhatsApp Kontak Darurat
                    </Label>
                    <PhoneInput
                      id="kontakDaruratWa"
                      value={kontakDaruratWa}
                      onChange={(e) => setKontakDaruratWa(e.target.value)}
                      placeholder="812 3456 7890"
                      className="h-9 text-xs sm:text-sm bg-slate-50/50 dark:bg-slate-800/60 dark:text-slate-100 border-slate-200 dark:border-slate-700 rounded-xl focus-within:ring-teal-600"
                    />
                    {errors.kontak_darurat_wa && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400">{errors.kontak_darurat_wa}</p>
                    )}
                  </div>

                  {/* Catatan Singkat (Lokal) */}
                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="mentalNotes" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Catatan Singkat untuk Psikolog (Opsional)
                    </Label>
                    <textarea
                      id="mentalNotes"
                      rows={3}
                      value={mentalNotes}
                      onChange={(e) => setMentalNotes(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 px-3 py-2 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 font-nunito"
                      placeholder="Contoh: Mengalami insomnia dan beban kerja tinggi sejak 2 bulan terakhir."
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="text-xs bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl px-5 py-2 cursor-pointer shadow-xs gap-1.5 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <>
                        <Save size={14} />
                        <span>Simpan Perubahan</span>
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: KERAHASIAAN MEDIS */}
        <TabsContent value="privacy" className="space-y-6">
          <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="font-heading text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck size={18} className="text-teal-600 dark:text-teal-400" />
                Kontrol Kerahasiaan & Anonimitas
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
                Pegang kendali penuh atas bagaimana identitasmu tampil di setiap ruang konsultasi
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 sm:p-6 space-y-4 divide-y divide-slate-100 dark:divide-slate-800">
              <div className="flex items-center justify-between gap-4 pt-1 first:pt-0">
                <div className="space-y-0.5 min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white font-heading">
                    Mode Anonim Otomatis
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-nunito leading-relaxed">
                    Selalu gunakan inisial acak (&quot;Pengguna Anonim&quot;) setiap kali memulai percakapan baru dengan AI maupun psikolog.
                  </p>
                </div>
                <Switch
                  checked={isAnonymousDefault}
                  onCheckedChange={handleToggleAnonymous}
                  className="cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between gap-4 pt-4">
                <div className="space-y-0.5 min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white font-heading">
                    Kerahasiaan Riwayat Chat
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-nunito leading-relaxed">
                    Percakapan hanya bisa diakses kamu dan psikologmu.
                  </p>
                </div>
                <span className="text-[11px] font-bold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/70 border border-teal-200 dark:border-teal-800 px-2.5 py-1 rounded-full shrink-0">
                  Aktif Permanen
                </span>
              </div>

              <div className="flex items-center justify-between gap-4 pt-4">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white font-heading">
                      Unduh Catatan Rekam Medis Konseling
                    </p>
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1.5 py-0 bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                    >
                      Coming Soon
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-nunito leading-relaxed">
                    Ekspor seluruh catatan refleksi dan ringkasan sesi dalam format PDF.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl px-3 h-8 font-semibold shrink-0 gap-1.5"
                  onClick={() => notify.info("Coming Soon", "Fitur ekspor berkas rekam medis PDF sedang dalam pengembangan.")}
                >
                  <Download size={13} />
                  Ekspor PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: NOTIFIKASI */}
        <TabsContent value="notifications" className="space-y-4">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 text-xs">
            <Clock className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <p className="font-bold font-heading text-xs text-amber-950 dark:text-amber-100">
                  Fitur Notifikasi Sesi (Coming Soon)
                </p>
                <Badge
                  variant="outline"
                  className="text-[9px] px-1.5 py-0 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                >
                  Dalam Pengembangan
                </Badge>
              </div>
              <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed font-nunito">
                Sinkronisasi webhook WhatsApp & Web Push untuk notifikasi pengingat sesi dan pesan evaluasi klinis sedang dipersiapkan. Pengaturan di bawah saat ini beroperasi dalam mode pratinjau lokal.
              </p>
            </div>
          </div>

          <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="font-heading text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Bell size={18} className="text-teal-600 dark:text-teal-400" />
                  Preferensi Pengingat Sesi
                </CardTitle>
                <Badge
                  variant="outline"
                  className="text-[10px] bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                >
                  Coming Soon
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-6 space-y-4 divide-y divide-slate-100 dark:divide-slate-800">
              <div className="flex items-center justify-between gap-4 pt-1 first:pt-0">
                <div className="space-y-0.5">
                  <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white font-heading">
                    Pengingat Janji Temu Sesi
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
                    Kirim notifikasi WhatsApp 30 menit sebelum sesi konseling dimulai.
                  </p>
                </div>
                <Switch
                  checked={sessionReminder}
                  onCheckedChange={setSessionReminder}
                  className="cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between gap-4 pt-4">
                <div className="space-y-0.5">
                  <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white font-heading">
                    Pemberitahuan Pesan Psikolog
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
                    Notifikasi ketika psikolog meninggalkan catatan evaluasi atau tugas latihan mandiri.
                  </p>
                </div>
                <Switch
                  checked={psychologistMessageAlert}
                  onCheckedChange={setPsychologistMessageAlert}
                  className="cursor-pointer"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: KEAMANAN AKUN */}
        <TabsContent value="security" className="space-y-4">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 text-xs">
            <Clock className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <p className="font-bold font-heading text-xs text-amber-950 dark:text-amber-100">
                  Fitur Keamanan Lanjutan (Coming Soon)
                </p>
                <Badge
                  variant="outline"
                  className="text-[9px] px-1.5 py-0 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                >
                  Dalam Pengembangan
                </Badge>
              </div>
              <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed font-nunito">
                Autentikasi dua langkah (2FA OTP) dan pembaruan kata sandi mandiri via email verifikasi Supabase Auth sedang disiapkan untuk rilis berikutnya.
              </p>
            </div>
          </div>

          <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="font-heading text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Lock size={18} className="text-teal-600 dark:text-teal-400" />
                  Keamanan & Autentikasi
                </CardTitle>
                <Badge
                  variant="outline"
                  className="text-[10px] bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                >
                  Coming Soon
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="space-y-0.5">
                  <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white font-heading">
                    Autentikasi Dua Langkah (2FA)
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
                    Amankan akunmu dengan kode OTP WhatsApp saat login dari perangkat baru.
                  </p>
                </div>
                <Switch
                  checked={twoFactorAuth}
                  onCheckedChange={setTwoFactorAuth}
                  className="cursor-pointer"
                />
              </div>

              <div className="space-y-3 pt-1">
                <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white font-heading">
                  Ganti Kata Sandi Akun
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
                  <PasswordInput
                    placeholder="Kata Sandi Lama"
                    className="h-9 text-xs bg-slate-50/50 dark:bg-slate-800/60 rounded-xl"
                  />
                  <PasswordInput
                    placeholder="Kata Sandi Baru"
                    className="h-9 text-xs bg-slate-50/50 dark:bg-slate-800/60 rounded-xl"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs rounded-xl mt-2"
                  onClick={() => notify.info("Coming Soon", "Fitur ubah kata sandi melalui email verifikasi segera aktif.")}
                >
                  Perbarui Kata Sandi
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      )}
    </div>
  );
}
