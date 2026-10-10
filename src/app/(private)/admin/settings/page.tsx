"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  SlidersHorizontal,
  Coins,
  ShieldCheck,
  PhoneCall,
  Save,
  CheckCircle2,
  Server,
} from "lucide-react";

export default function AdminSettingsPage() {
  const [coinRate, setCoinRate] = useState(10000);
  const [platformFeePercent, setPlatformFeePercent] = useState(10);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [emergencyPhone, setEmergencyPhone] = useState("119 ext. 8");
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
          Pengaturan Sistem & Operasional Platform
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Konfigurasi nilai tukar koin platform, pembagian komisi, dan parameter keselamatan krisis
        </p>
      </div>

      {saveSuccess && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>Konfigurasi parameter sistem berhasil disimpan dan diperbarui di server.</span>
        </div>
      )}

      {/* 2. Form Settings */}
      <form onSubmit={handleSave} className="space-y-6">
        <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="font-heading text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Coins size={18} className="text-teal-600 dark:text-teal-400" />
              Ekonomi Koin & Kebijakan Tarif
            </CardTitle>
          </CardHeader>

          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="coinRate" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Nilai Tukar 1 Koin Konseling (Rupiah)
                </Label>
                <Input
                  id="coinRate"
                  type="number"
                  value={coinRate}
                  onChange={(e) => setCoinRate(Number(e.target.value))}
                  className="h-9 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="platformFee" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Potongan Operasional Platform (%)
                </Label>
                <Input
                  id="platformFee"
                  type="number"
                  min={0}
                  max={30}
                  value={platformFeePercent}
                  onChange={(e) => setPlatformFeePercent(Number(e.target.value))}
                  className="h-9 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl"
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="font-heading text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <PhoneCall size={18} className="text-teal-600 dark:text-teal-400" />
              Protokol Darurat & Hotline Nasional
            </CardTitle>
          </CardHeader>

          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="space-y-1.5 max-w-md">
              <Label htmlFor="emergencyNumber" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Nomor Hotline Krisis Darurat Utama
              </Label>
              <Input
                id="emergencyNumber"
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(e.target.value)}
                className="h-9 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl"
                required
              />
              <span className="text-[11px] text-slate-400">
                Ditampilkan di widget krisis pada seluruh portal pengguna
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="font-heading text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Server size={18} className="text-teal-600 dark:text-teal-400" />
              Mode Pemeliharaan Server (Maintenance)
            </CardTitle>
          </CardHeader>

          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  Aktifkan Mode Maintenance
                </p>
                <p className="text-xs text-slate-500 font-nunito">
                  Bila diaktifkan, hanya administrator yang dapat mengakses platform.
                </p>
              </div>
              <Switch checked={maintenanceMode} onCheckedChange={setMaintenanceMode} className="cursor-pointer" />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            className="text-xs sm:text-sm bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl px-6 py-2.5 h-10 shadow-xs gap-1.5 cursor-pointer"
          >
            <Save size={15} />
            Simpan Konfigurasi Sistem
          </Button>
        </div>
      </form>
    </div>
  );
}
