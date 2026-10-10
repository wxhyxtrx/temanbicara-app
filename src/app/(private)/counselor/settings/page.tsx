"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  User,
  ShieldCheck,
  Building2,
  Bell,
  Save,
  CheckCircle2,
  FileCheck2,
  Coins,
} from "lucide-react";
import { MdVerified } from "react-icons/md";
import { useUserStore } from "@/store/user-store";

export default function CounselorSettingsPage() {
  const user = useUserStore((state) => state.user);

  const [fullName, setFullName] = useState(user.fullName || "Dr. Sarah Alatas, M.Psi");
  const [sippk, setSippk] = useState(user.counselorData?.licenseNumber || "198402-2019-01");
  const [rateCoins, setRateCoins] = useState(user.counselorData?.hourlyRateCoins || 60);
  const [bankAccount, setBankAccount] = useState("8820491823");
  const [bankName, setBankName] = useState("Bank Central Asia (BCA)");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 sm:space-y-8 font-nunito pb-12 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* 1. Header */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 dark:text-white tracking-tight">
          Pengaturan Praktik & Lisensi SIPPK
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Kelola kredensial klinis, tarif sesi koin, dan rekening penerima honor konsultasi
        </p>
      </div>

      {saveSuccess && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>Pengaturan profil praktik psikolog berhasil disimpan.</span>
        </div>
      )}

      {/* 2. Main Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Card 1: Identitas & Lisensi */}
        <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="font-heading text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck size={18} className="text-teal-600 dark:text-teal-400" />
              Kredensial & Izin Praktik Psikolog
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
              Nomor Surat Izin Praktik Psikologi Klinis terverifikasi oleh HIMPSI dan Kementerian Kesehatan
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="counselorName" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Nama Lengkap & Gelar Akademik
                </Label>
                <Input
                  id="counselorName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-9 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sippkNumber" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Nomor SIPPK Resmi
                </Label>
                <div className="relative">
                  <Input
                    id="sippkNumber"
                    value={sippk}
                    onChange={(e) => setSippk(e.target.value)}
                    className="h-9 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl pr-24"
                    required
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded border border-emerald-200">
                    Terverifikasi
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="hourlyCoins" className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Coins size={14} className="text-teal-600" /> Tarif per Sesi Konseling (Koin)
                </Label>
                <Input
                  id="hourlyCoins"
                  type="number"
                  min={30}
                  max={200}
                  value={rateCoins}
                  onChange={(e) => setRateCoins(Number(e.target.value))}
                  className="h-9 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl"
                  required
                />
                <span className="text-[11px] text-slate-500 font-nunito">
                  Tarif riil yang dibayar klien: Rp {(rateCoins * 10000).toLocaleString("id-ID")} / 50 menit
                </span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Afiliasi Profesi
                </Label>
                <Input
                  disabled
                  value="Himpunan Psikologi Indonesia (HIMPSI)"
                  className="h-9 text-xs sm:text-sm bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Rekening Bank Pencairan */}
        <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="font-heading text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 size={18} className="text-teal-600 dark:text-teal-400" />
              Rekening Bank Pencairan Honor
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
              Rekening untuk transfer pencairan honor koin konsultasi mingguan
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
                  className="h-9 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl"
                  required
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
                  className="h-9 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl"
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Notifikasi Sesi */}
        <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="font-heading text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Bell size={18} className="text-teal-600 dark:text-teal-400" />
              Preferensi Notifikasi Booking Klien
            </CardTitle>
          </CardHeader>

          <CardContent className="p-4 sm:p-6 space-y-4 divide-y divide-slate-100 dark:divide-slate-800">
            <div className="flex items-center justify-between gap-4 pt-1 first:pt-0">
              <div className="space-y-0.5">
                <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  Notifikasi Instan via WhatsApp
                </p>
                <p className="text-xs text-slate-500 font-nunito">
                  Kirim ringkasan saat ada klien baru yang memesan jadwal konsultasi Anda.
                </p>
              </div>
              <Switch checked={notifyWhatsapp} onCheckedChange={setNotifyWhatsapp} className="cursor-pointer" />
            </div>

            <div className="flex items-center justify-between gap-4 pt-4">
              <div className="space-y-0.5">
                <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  Pengingat Email Kalender Google
                </p>
                <p className="text-xs text-slate-500 font-nunito">
                  Sinkronisasi undangan kalender .ics otomatis 15 menit sebelum sesi dimulai.
                </p>
              </div>
              <Switch checked={notifyEmail} onCheckedChange={setNotifyEmail} className="cursor-pointer" />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            className="text-xs sm:text-sm bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl px-6 py-2.5 h-10 shadow-xs gap-1.5 cursor-pointer"
          >
            <Save size={15} />
            Simpan Pengaturan Praktik
          </Button>
        </div>
      </form>
    </div>
  );
}
