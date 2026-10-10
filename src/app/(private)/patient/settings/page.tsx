"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User,
  ShieldCheck,
  Bell,
  Lock,
  Camera,
  Smartphone,
  Download,
  AlertTriangle,
  KeyRound,
  EyeOff,
  HeartPulse,
  Save,
  CheckCircle2,
} from "lucide-react";
import { MdVerified } from "react-icons/md";
import { useUserStore } from "@/store/user-store";
import { useNotificationStore } from "@/store/notification-store";

export default function PatientSettingsPage() {
  const user = useUserStore((state) => state.user);
  const updateProfile = useUserStore((state) => state.updateProfile);

  const [mounted, setMounted] = useState(false);
  const [fullName, setFullName] = useState(user.fullName);
  const [alias, setAlias] = useState(user.alias);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone);
  const [emergencyContact, setEmergencyContact] = useState(user.emergencyContact);
  const [mentalNotes, setMentalNotes] = useState(user.mentalNotes);

  const [isAnonymousDefault, setIsAnonymousDefault] = useState(user.isAnonymousDefault || false);
  const [sessionReminder, setSessionReminder] = useState(true);
  const [psychologistMessageAlert, setPsychologistMessageAlert] = useState(true);
  const [twoFactorAuth, setTwoFactorAuth] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  React.useEffect(() => {
    setMounted(true);
    const initialName = user.fullName && !["Matthew Johnson", "Matthew"].includes(user.fullName) ? user.fullName : "Wahyu Tricahyo";
    const initialAlias = user.alias && !["Matt", "Matthew", "Pasien"].includes(user.alias) ? user.alias : (initialName.trim().split(" ")[0] || "Wahyu");
    setFullName(initialName);
    setAlias(initialAlias);
    setEmail(user.email);
    setPhone(user.phone);
    setEmergencyContact(user.emergencyContact);
    setMentalNotes(user.mentalNotes);
    setIsAnonymousDefault(user.isAnonymousDefault || false);
  }, [user]);

  const handleFullNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFullName(val);
    const firstName = val.trim().split(" ")[0] || "Wahyu";
    if (!alias || ["Matt", "Matthew", "Pasien"].includes(alias) || alias === fullName.trim().split(" ")[0]) {
      setAlias(firstName);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedAlias = (alias && !["Matt", "Matthew", "Pasien"].includes(alias.trim()))
      ? alias.trim()
      : (fullName.trim().split(" ")[0] || "Wahyu");
    updateProfile({
      fullName: fullName.trim(),
      alias: resolvedAlias,
      email: email.trim(),
      phone: phone.trim(),
      emergencyContact: emergencyContact.trim(),
      mentalNotes: mentalNotes.trim(),
      isAnonymousDefault,
    });

    useNotificationStore.getState().addNotification({
      title: "Profil Diperbarui",
      message: "Data identitas pasien dan preferensi akun berhasil disimpan.",
      type: "sistem",
      actionUrl: "/patient/settings",
    });

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="flex flex-col gap-6 font-nunito pb-12 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* 1. Page Header */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 dark:text-white tracking-tight">
          Pengaturan & Privasi Pasien
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Kelola identitas klinis, tingkat kerahasiaan konseling, notifikasi sesi, dan keamanan akunmu
        </p>
      </div>

      {saveSuccess && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold animate-in fade-in duration-200">
          <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Pengaturan berhasil diperbarui dan disimpan secara aman.</span>
        </div>
      )}

      {/* 2. Main Tabs Navigation */}
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
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-teal-800 dark:data-[state=active]:text-teal-300 text-slate-600 dark:text-slate-400 data-[state=active]:shadow-xs rounded-lg px-3.5 py-2 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Lock size={15} />
            <span>Keamanan Akun</span>
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
                    {user.avatarInitials || "TB"}
                  </div>
                  <Button
                    size="icon"
                    variant="outline"
                    className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-xs cursor-pointer"
                    title="Ganti foto avatar"
                    type="button"
                    onClick={() => alert("Fitur unggah avatar khusus segera hadir. Inisial otomatis diperbarui dari nama Anda.")}
                  >
                    <Camera size={13} />
                  </Button>
                </div>

                <div className="space-y-2 text-center sm:text-left flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <h3 className="font-heading font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                      {user.fullName}
                    </h3>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      <MdVerified className="text-sky-500 text-xs" /> Pasien Terverifikasi
                    </span>
                    <Badge variant="outline" className="text-[10px] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700">
                      ID: {user.patientId}
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
                Data pendukung untuk penyesuaian asesmen usia dan kebutuhan konseling
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 sm:p-6">
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Nama Lengkap (Sesuai KTP/Paspor)
                    </Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={handleFullNameChange}
                      required
                      className="h-9 text-xs sm:text-sm bg-slate-50/50 dark:bg-slate-800/60 dark:text-slate-100 border-slate-200 dark:border-slate-700 rounded-xl focus-visible:ring-teal-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="alias" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Nama Panggilan / Alias di Chat
                    </Label>
                    <Input
                      id="alias"
                      value={alias}
                      onChange={(e) => setAlias(e.target.value)}
                      className="h-9 text-xs sm:text-sm bg-slate-50/50 dark:bg-slate-800/60 dark:text-slate-100 border-slate-200 dark:border-slate-700 rounded-xl focus-visible:ring-teal-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Alamat Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-9 text-xs sm:text-sm bg-slate-50/50 dark:bg-slate-800/60 dark:text-slate-100 border-slate-200 dark:border-slate-700 rounded-xl focus-visible:ring-teal-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Nomor WhatsApp (Pengingat Sesi)
                    </Label>
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="h-9 text-xs sm:text-sm bg-slate-50/50 dark:bg-slate-800/60 dark:text-slate-100 border-slate-200 dark:border-slate-700 rounded-xl focus-visible:ring-teal-600"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="emergencyContact" className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <HeartPulse size={14} className="text-rose-600 dark:text-rose-400" />
                        Kontak Darurat (SOP Keamanan Kesehatan Mental)
                      </Label>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">Hanya dihubungi saat situasi darurat keselamatan jiwa</span>
                    </div>
                    <Input
                      id="emergencyContact"
                      placeholder="Nama Kerabat - Hubungan - No. Telepon (Contoh: Sarah - Pasangan - 0811223344)"
                      value={emergencyContact}
                      onChange={(e) => setEmergencyContact(e.target.value)}
                      className="h-9 text-xs sm:text-sm bg-slate-50/50 dark:bg-slate-800/60 dark:text-slate-100 border-slate-200 dark:border-slate-700 rounded-xl focus-visible:ring-teal-600"
                    />
                  </div>

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
                    className="text-xs bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl px-5 py-2 cursor-pointer shadow-xs gap-1.5"
                  >
                    <Save size={14} />
                    Simpan Perubahan
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
                    Selalu gunakan inisial acak ("Pengguna Anonim") setiap kali memulai percakapan baru dengan AI maupun psikolog.
                  </p>
                </div>
                <Switch
                  checked={isAnonymousDefault}
                  onCheckedChange={setIsAnonymousDefault}
                  className="cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between gap-4 pt-4">
                <div className="space-y-0.5 min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white font-heading">
                    Enkripsi Berlapis Riwayat Chat
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-nunito leading-relaxed">
                    Percakapan dienkripsi dengan standar AES-256 end-to-end. Hanya Anda dan psikolog yang memiliki kunci dekripsi.
                  </p>
                </div>
                <span className="text-[11px] font-bold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/70 border border-teal-200 dark:border-teal-800 px-2.5 py-1 rounded-full shrink-0">
                  Aktif Permanen
                </span>
              </div>

              <div className="flex items-center justify-between gap-4 pt-4">
                <div className="space-y-0.5 min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white font-heading">
                    Unduh Catatan Rekam Medis Konseling
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-nunito leading-relaxed">
                    Ekspor seluruh catatan refleksi, hasil asesmen DASS-21, dan ringkasan sesi dalam format PDF terenkripsi sandi.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl px-3 h-8 font-semibold shrink-0 gap-1.5"
                  onClick={() => alert("Permintaan unduh arsip data konseling sedang diproses.")}
                >
                  <Download size={13} />
                  Ekspor PDF
                </Button>
              </div>

              <div className="flex items-center justify-between gap-4 pt-4 text-rose-900 dark:text-rose-200">
                <div className="space-y-0.5 min-w-0">
                  <p className="text-xs sm:text-sm font-bold font-heading text-rose-800 dark:text-rose-300">
                    Hapus Seluruh Riwayat Konsultasi
                  </p>
                  <p className="text-xs text-rose-600/80 dark:text-rose-400 font-nunito leading-relaxed">
                    Menghapus permanen semua transkrip chat dan rekaman sesi dari server TemanBicara. Tindakan ini tidak dapat dibatalkan.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl px-3 h-8 font-semibold shrink-0"
                  onClick={() => confirm("Apakah Anda yakin ingin menghapus permanen semua riwayat konseling?")}
                >
                  Hapus Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: NOTIFIKASI */}
        <TabsContent value="notifications" className="space-y-6">
          <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="font-heading text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Bell size={18} className="text-teal-600 dark:text-teal-400" />
                Preferensi Notifikasi & Pengingat Sesi
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
                Pastikan Anda tidak melewatkan sesi konseling penting bersama psikolog
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 sm:p-6 space-y-4 divide-y divide-slate-100 dark:divide-slate-800">
              <div className="flex items-center justify-between gap-4 pt-1 first:pt-0">
                <div className="space-y-0.5 min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white font-heading">
                    Pengingat Sesi Konseling (WhatsApp & Email)
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
                    Kirimkan notifikasi pengingat 1 jam dan 15 menit sebelum sesi dimulai.
                  </p>
                </div>
                <Switch checked={sessionReminder} onCheckedChange={setSessionReminder} className="cursor-pointer" />
              </div>

              <div className="flex items-center justify-between gap-4 pt-4">
                <div className="space-y-0.5 min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white font-heading">
                    Pesan Masuk dari Psikolog
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
                    Pemberitahuan saat psikolog mengirimkan lembar refleksi atau membalas chat.
                  </p>
                </div>
                <Switch checked={psychologistMessageAlert} onCheckedChange={setPsychologistMessageAlert} className="cursor-pointer" />
              </div>

              <div className="flex items-center justify-between gap-4 pt-4">
                <div className="space-y-0.5 min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white font-heading">
                    Pengingat Check-in Emosi Harian
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
                    Pengingat lembut setiap sore untuk mengisi catatan suasana hati dan relaksasi napas.
                  </p>
                </div>
                <Switch defaultChecked className="cursor-pointer" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: KEAMANAN AKUN */}
        <TabsContent value="security" className="space-y-6">
          <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="font-heading text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <KeyRound size={18} className="text-teal-600 dark:text-teal-400" />
                Ubah Kata Sandi
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
                Gunakan kombinasi minimal 8 karakter dengan huruf besar, angka, dan simbol
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 sm:p-6">
              <form onSubmit={handleSave} className="space-y-3.5 max-w-md">
                <div className="space-y-1.5">
                  <Label htmlFor="currentPassword" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Kata Sandi Saat Ini
                  </Label>
                  <Input id="currentPassword" type="password" placeholder="••••••••" className="h-9 text-xs bg-slate-50/50 dark:bg-slate-800/60 dark:text-slate-100 border-slate-200 dark:border-slate-700 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="newPassword" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Kata Sandi Baru
                  </Label>
                  <Input id="newPassword" type="password" placeholder="••••••••" className="h-9 text-xs bg-slate-50/50 dark:bg-slate-800/60 dark:text-slate-100 border-slate-200 dark:border-slate-700 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Konfirmasi Kata Sandi Baru
                  </Label>
                  <Input id="confirmPassword" type="password" placeholder="••••••••" className="h-9 text-xs bg-slate-50/50 dark:bg-slate-800/60 dark:text-slate-100 border-slate-200 dark:border-slate-700 rounded-xl" />
                </div>
                <div className="pt-2">
                  <Button type="submit" className="text-xs bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl px-5 py-2 cursor-pointer shadow-xs">
                    Perbarui Kata Sandi
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="font-heading text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Smartphone size={18} className="text-teal-600 dark:text-teal-400" />
                Autentikasi Dua Faktor (2FA)
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
                Tambahkan verifikasi OTP via WhatsApp atau aplikasi autentikator untuk keamanan ekstra
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white font-heading">
                    Verifikasi OTP saat Login
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
                    Kirim kode 6 digit ke nomor ponsel setiap login dari perangkat baru.
                  </p>
                </div>
                <Switch checked={twoFactorAuth} onCheckedChange={setTwoFactorAuth} className="cursor-pointer" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
