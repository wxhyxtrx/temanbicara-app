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
  Heart,
  Bell,
  Save,
  CheckCircle2,
  Headphones,
  ShieldCheck,
} from "lucide-react";
import { useUserStore } from "@/store/user-store";

export default function ListenerSettingsPage() {
  const user = useUserStore((state) => state.user);

  const [alias, setAlias] = useState(user.alias || "Dewi Lestari");
  const [maxSessionsDaily, setMaxSessionsDaily] = useState(5);
  const [notifyQueue, setNotifyQueue] = useState(true);
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
          Pengaturan Relawan Pendengar Sebaya
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Kelola profil empati, batas kapasitas harian, dan notifikasi antrean curhat
        </p>
      </div>

      {saveSuccess && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>Pengaturan akun relawan berhasil diperbarui.</span>
        </div>
      )}

      {/* 2. Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="font-heading text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Headphones size={18} className="text-teal-600 dark:text-teal-400" />
              Profil Relawan & Batasan Emosional
            </CardTitle>
          </CardHeader>

          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="listenerAlias" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Nama Panggilan / Alias Pendengar di Chat
                </Label>
                <Input
                  id="listenerAlias"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  className="h-9 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="maxSessions" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Batas Maksimal Sesi Curhat per Hari
                </Label>
                <Input
                  id="maxSessions"
                  type="number"
                  min={1}
                  max={10}
                  value={maxSessionsDaily}
                  onChange={(e) => setMaxSessionsDaily(Number(e.target.value))}
                  className="h-9 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl"
                  required
                />
                <span className="text-[11px] text-slate-400 font-nunito">
                  Membantu menjaga kesehatan mental Anda dari kelelahan empati (compassion fatigue)
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="font-heading text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Bell size={18} className="text-teal-600 dark:text-teal-400" />
              Preferensi Notifikasi Antrean
            </CardTitle>
          </CardHeader>

          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  Pemberitahuan Antrean Curhat Baru
                </p>
                <p className="text-xs text-slate-500 font-nunito">
                  Bunyikan nada lembut saat ada teman bicara yang masuk antrean saat status Anda sedang Siaga.
                </p>
              </div>
              <Switch checked={notifyQueue} onCheckedChange={setNotifyQueue} className="cursor-pointer" />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            className="text-xs sm:text-sm bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl px-6 py-2.5 h-10 shadow-xs gap-1.5 cursor-pointer"
          >
            <Save size={15} />
            Simpan Perubahan
          </Button>
        </div>
      </form>
    </div>
  );
}
