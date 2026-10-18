"use client";

import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Switch } from "@/components/ui/switch";
import {
  User,
  Heart,
  Bell,
  Save,
  CheckCircle2,
  Headphones,
  ShieldCheck,
  Lock,
  Plus,
  X,
  Loader2,
} from "lucide-react";
import { useUserStore } from "@/store/user-store";
import { notify } from "@/lib/toast";
import { userService, UserApiError } from "@/services/user.service";
import type { RelawanProfile, UpdateMeRelawanPayload } from "@/types/user-profile";

const SUGGESTED_TOPICS = [
  "Stres Akademik & Skripsi",
  "Karier & Quarter-life Crisis",
  "Hubungan & Asmara",
  "Keluarga & Pertemanan",
  "Kesepian & Isolasi",
  "Kecemasan Ringan",
  "Duka & Kehilangan",
  "Manajemen Waktu & Burnout",
];

export default function ListenerSettingsPage() {
  const user = useUserStore((state) => state.user);

  const [mounted, setMounted] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Read-only
  const [fullName, setFullName] = useState("");

  // Editable
  const [aliasName, setAliasName] = useState("");
  const [phone, setPhone] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [newTopicInput, setNewTopicInput] = useState("");

  // Preferences
  const [notifyQueue, setNotifyQueue] = useState(true);

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
          const p = res.data.profile as RelawanProfile | null;

          setFullName(p?.nama_lengkap || u.fullName || user.fullName || "");
          setAliasName(p?.alias_name || user.alias || "");
          setPhone(u.no_wa || "");

          if (Array.isArray(p?.topik_keahlian) && p.topik_keahlian.length > 0) {
            setTopics(p.topik_keahlian);
          } else {
            setTopics(["Karier & Quarter-life Crisis", "Kesepian & Isolasi"]);
          }
        }
      } catch (err) {
        console.error("Gagal memuat profil relawan dari API:", err);
      } finally {
        if (isSubscribed) setLoadingProfile(false);
      }
    }

    loadMe();

    return () => {
      isSubscribed = false;
    };
  }, []);

  const handleAddTopic = (topicToAdd: string) => {
    const trimmed = topicToAdd.trim();
    if (!trimmed) return;
    if (topics.includes(trimmed)) return;
    if (topics.length >= 10) {
      notify.error("Batas Maksimal", "Maksimal 10 topik keahlian.");
      return;
    }
    setTopics((prev) => [...prev, trimmed]);
    setNewTopicInput("");
  };

  const handleRemoveTopic = (topicToRemove: string) => {
    setTopics((prev) => prev.filter((t) => t !== topicToRemove));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    const payload: UpdateMeRelawanPayload = {
      alias_name: aliasName.trim(),
      topik_keahlian: topics,
    };

    if (phone.trim()) {
      payload.no_wa = phone.trim();
    }

    try {
      const res = await userService.updateMe(payload);
      if (res.success && res.data) {
        useUserStore.getState().setAuthSession(res.data.user, undefined, res.data.profile);
        await useUserStore.getState().syncSession();

        notify.success("Pengaturan Disimpan", "Profil relawan pendengar berhasil diperbarui.");
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
          Pengaturan Relawan Pendengar Sebaya
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Kelola kontak WhatsApp, nama samaran (alias), dan topik pendampingan empati
        </p>
      </div>

      {saveSuccess && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>Pengaturan akun relawan berhasil diperbarui.</span>
        </div>
      )}

      {/* 2. Settings Form */}
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
            <div className="flex justify-end pt-2">
              <Skeleton className="w-32 h-9 rounded-xl" />
            </div>
          </Card>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
        <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="font-heading text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Headphones size={18} className="text-teal-600 dark:text-teal-400" />
              Profil Relawan & Identitas Empati
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
              Nama lengkap terlindungi dan dikunci, hanya nama samaran yang tampil kepada teman bicara
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nama Lengkap (Read-only dengan Ikon Gembok) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Lock size={13} className="text-slate-400" />
                    Nama Lengkap (KTP)
                  </Label>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-nunito">
                    Hubungi admin untuk mengubah
                  </span>
                </div>
                <div className="relative">
                  <Input
                    disabled
                    value={loadingProfile ? "Memuat..." : fullName}
                    className="h-9 text-xs sm:text-sm bg-slate-100/80 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 rounded-xl cursor-not-allowed pl-8"
                  />
                  <Lock size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Nomor WhatsApp */}
              <div className="space-y-1.5">
                <Label htmlFor="listenerPhone" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Nomor WhatsApp Relawan
                </Label>
                <PhoneInput
                  id="listenerPhone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="812 3456 7890"
                  className="h-9 text-xs sm:text-sm bg-slate-50/50 dark:bg-slate-800/60 dark:text-slate-100 border-slate-200 dark:border-slate-700 rounded-xl focus-within:ring-teal-600"
                />
                {errors.no_wa && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">{errors.no_wa}</p>
                )}
              </div>

              {/* Nama Samaran / Alias */}
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="listenerAlias" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Nama Panggilan / Alias Pendengar di Chat (Tampil ke Teman Bicara)
                </Label>
                <Input
                  id="listenerAlias"
                  value={aliasName}
                  onChange={(e) => setAliasName(e.target.value)}
                  placeholder="Contoh: Sahabat Dewi"
                  className="h-9 text-xs sm:text-sm bg-slate-50/50 dark:bg-slate-800/60 dark:text-slate-100 border-slate-200 dark:border-slate-700 rounded-xl"
                  required
                />
                {errors.alias_name && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">{errors.alias_name}</p>
                )}
              </div>
            </div>

            {/* Topik Keahlian & Kesiapan Pendampingan */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Topik Keahlian & Minat Pendampingan Empati ({topics.length}/10)
              </Label>

              {/* Selected Topics */}
              <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                {topics.length === 0 ? (
                  <span className="text-xs text-slate-400 italic">Belum ada topik dipilih</span>
                ) : (
                  topics.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-200 text-xs font-semibold"
                    >
                      {t}
                      <button
                        type="button"
                        onClick={() => handleRemoveTopic(t)}
                        className="hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                        title="Hapus"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))
                )}
              </div>

              {/* Input New Topic */}
              <div className="flex items-center gap-2">
                <Input
                  value={newTopicInput}
                  onChange={(e) => setNewTopicInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTopic(newTopicInput);
                    }
                  }}
                  placeholder="Ketik topik baru lalu tekan Tambah"
                  className="h-8 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddTopic(newTopicInput)}
                  className="h-8 text-xs rounded-xl shrink-0 gap-1"
                >
                  <Plus size={13} />
                  Tambah
                </Button>
              </div>

              {/* Suggestions */}
              <div className="space-y-1 pt-1">
                <span className="text-[11px] text-slate-400 block font-nunito">Saran topik pendengar:</span>
                <div className="flex flex-wrap gap-1">
                  {SUGGESTED_TOPICS.filter((st) => !topics.includes(st)).map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => handleAddTopic(sug)}
                      className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 hover:bg-teal-50 dark:bg-slate-800 dark:hover:bg-teal-950/60 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                    >
                      + {sug}
                    </button>
                  ))}
                </div>
              </div>

              {errors.topik_keahlian && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">{errors.topik_keahlian}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Preferensi Notifikasi (Coming Soon) */}
        <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <CardHeader className="p-4 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="font-heading text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Bell size={18} className="text-teal-600 dark:text-teal-400" />
                Preferensi Notifikasi Antrean
              </CardTitle>
              <Badge
                variant="outline"
                className="text-[10px] bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
              >
                Coming Soon
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
              Notifikasi browser dan Web Audio untuk antrean curhat masuk sedang dalam tahap pengembangan
            </CardDescription>
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
                <span>Simpan Perubahan</span>
              </>
            )}
          </Button>
        </div>
      </form>
      )}
    </div>
  );
}
