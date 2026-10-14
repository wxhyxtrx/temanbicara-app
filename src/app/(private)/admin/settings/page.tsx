"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SettingsAuditTab } from "@/components/views/admin/settings/settings-audit-tab";
import {
  FLAT_GROUPS,
  type FlatGroup,
  type FlatKey,
  fromLocalInput,
  inputClass,
  labelClass,
  NumberField,
  ORDER,
  SettingSection,
  type SettingKey,
  toLocalInput,
} from "@/components/views/admin/settings/settings-form-parts";
import { systemSettingsClient, type AdminSettingsResult } from "@/services/system-settings.client";
import type { SystemSettings } from "@/types/system-settings";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  History,
  Percent,
  RefreshCw,
  Save,
  Server,
  SlidersHorizontal,
  Undo2,
} from "lucide-react";


export default function AdminSettingsPage() {
  const [form, setForm] = useState<SystemSettings | null>(null);
  const [meta, setMeta] = useState<AdminSettingsResult["meta"]>();
  const [isLoading, setIsLoading] = useState(true);
  const [isFallback, setIsFallback] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    const res = await systemSettingsClient.getAdminSettings();
    setForm(res.settings);
    setMeta(res.meta);
    setIsFallback(res.isFallback);
    setLoadError(res.error ?? null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateGroup = <K extends SettingKey>(key: K, value: SystemSettings[K]) => {
    setSaveSuccess(false);
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const updateFlat = <K extends FlatKey>(key: K, field: keyof SystemSettings[K], value: number) => {
    if (!form) return;
    updateGroup(key, { ...form[key], [field]: value });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || isFallback || isSaving) return;
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);
    setFieldErrors({});
    // All 13 groups; server validates each key independently.
    const res = await systemSettingsClient.updateAdminSettings(form);
    if (res.success && res.settings) {
      setForm(res.settings);
      setSaveSuccess(true);
      // Refresh meta (updated_at); a failed refresh must not replace saved values with defaults.
      const fresh = await systemSettingsClient.getAdminSettings();
      if (!fresh.isFallback) {
        setForm(fresh.settings);
        setMeta(fresh.meta);
      }
    } else {
      setFieldErrors(res.details ?? {});
      setSaveError(res.details ? "Beberapa parameter tidak valid. Periksa kartu bertanda merah." : res.error ?? "Gagal menyimpan konfigurasi");
    }
    setIsSaving(false);
  };

  const renderGroup = (key: SettingKey) => {
    if (!form) return null;
    const common = { meta: meta?.[key], error: fieldErrors[key] };

    if (key === "revenue_share") {
      return (
        <SettingSection key={key} title="Bagi Hasil Mitra" icon={Percent} {...common}>
          <div className="max-w-md">
            <NumberField
              id="revenue_share-mitra"
              label="Porsi mitra (%)"
              step={0.01}
              value={form.revenue_share.mitra_bps / 100}
              onChange={(pct) => updateGroup("revenue_share", { mitra_bps: Math.round(pct * 100) })}
            />
            <span className="text-[11px] text-slate-400">Disimpan sebagai {form.revenue_share.mitra_bps} bps</span>
          </div>
        </SettingSection>
      );
    }

    if (key === "refund_policy") {
      const setTier = (index: number, patch: Partial<SystemSettings["refund_policy"][number]>) =>
        updateGroup(
          "refund_policy",
          form.refund_policy.map((tier, i) => (i === index ? { ...tier, ...patch } : tier))
        );
      return (
        <SettingSection key={key} title="Kebijakan Refund Pembatalan" icon={Undo2} {...common}>
          {form.refund_policy.length === 0 ? (
            <p className="text-xs text-slate-500">Belum ada tier refund dari server.</p>
          ) : (
            form.refund_policy.map((tier, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <NumberField
                  id={`refund-${i}-minutes`}
                  label={`Tier ${i + 1}: minimal menit sebelum sesi`}
                  value={tier.min_minutes_before}
                  onChange={(v) => setTier(i, { min_minutes_before: v })}
                />
                <NumberField
                  id={`refund-${i}-pct`}
                  label={`Tier ${i + 1}: refund (%)`}
                  value={tier.refund_pct}
                  onChange={(v) => setTier(i, { refund_pct: v })}
                />
              </div>
            ))
          )}
        </SettingSection>
      );
    }

    if (key === "maintenance") return null;

    const group = FLAT_GROUPS[key] as FlatGroup<typeof key>;
    const values = form[key] as unknown as Record<string, number>;
    return (
      <SettingSection key={key} title={group.title} icon={group.icon} {...common}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {group.fields.map(({ field, label }) => (
            <NumberField
              key={field}
              id={`${key}-${field}`}
              label={label}
              value={values[field]}
              onChange={(v) => updateFlat(key, field as keyof SystemSettings[typeof key], v)}
            />
          ))}
        </div>
      </SettingSection>
    );
  };

  const saveDisabled = isLoading || isSaving || isFallback || !form;
  const hasMeta = !!meta && Object.keys(meta).length > 0;

  return (
    <div className="space-y-6 sm:space-y-8 font-nunito pb-12 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 dark:text-white tracking-tight">
          Pengaturan Sistem & Operasional Platform
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Konfigurasi ekonomi koin, kebijakan sesi, relawan, unggahan, dan jadwal maintenance
        </p>
      </div>

      <Tabs defaultValue="settings" className="gap-4">
        <TabsList className="max-w-full">
          <TabsTrigger value="settings" className="cursor-pointer text-xs sm:text-sm">
            <SlidersHorizontal size={14} />
            Pengaturan
          </TabsTrigger>
          <TabsTrigger value="audit" className="cursor-pointer text-xs sm:text-sm">
            <History size={14} />
            Riwayat Audit
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 h-40 text-xs text-slate-500">
              <RefreshCw size={14} className="animate-spin text-teal-600" />
              Memuat pengaturan sistem...
            </div>
          ) : !form ? (
            <p className="text-xs text-slate-500 text-center h-40">Pengaturan sistem tidak tersedia.</p>
          ) : (
            <>
              {isFallback && (
                <div
                  role="alert"
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-semibold"
                >
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <span className="break-words">
                      Gagal memuat pengaturan dari server{loadError ? ` (${loadError})` : ""}. Nilai di bawah adalah
                      default lokal dan tidak bisa disimpan.
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => load()}
                    className="h-8 text-xs rounded-xl gap-1.5 cursor-pointer shrink-0"
                  >
                    <RefreshCw size={13} />
                    Muat ulang
                  </Button>
                </div>
              )}

              {!isFallback && !hasMeta && (
                <p className="text-xs text-slate-500">
                  Belum ada perubahan tersimpan; menampilkan nilai default dari server.
                </p>
              )}

              {saveSuccess && (
                <div
                  role="status"
                  className="flex items-center gap-2 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold"
                >
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>Konfigurasi parameter sistem berhasil disimpan di server.</span>
                </div>
              )}

              {saveError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-semibold"
                >
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span className="break-words">{saveError}</span>
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-6">
                <SettingSection
                  title="Jadwal Pemeliharaan Server (Maintenance)"
                  icon={Server}
                  meta={meta?.maintenance}
                  error={fieldErrors.maintenance}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5 min-w-0">
                      <Label htmlFor="maintenance-start" className={labelClass}>
                        Mulai terjadwal (waktu lokal)
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id="maintenance-start"
                          type="datetime-local"
                          value={toLocalInput(form.maintenance.scheduled_start)}
                          onChange={(e) =>
                            updateGroup("maintenance", {
                              ...form.maintenance,
                              scheduled_start: fromLocalInput(e.target.value),
                            })
                          }
                          className={`${inputClass} min-w-0`}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            updateGroup("maintenance", {
                              ...form.maintenance,
                              scheduled_start: new Date().toISOString(),
                            })
                          }
                          className="h-9 text-xs rounded-xl cursor-pointer shrink-0"
                        >
                          Aktifkan sekarang
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <Label htmlFor="maintenance-end" className={labelClass}>
                        Estimasi selesai (waktu lokal)
                      </Label>
                      <Input
                        id="maintenance-end"
                        type="datetime-local"
                        value={toLocalInput(form.maintenance.estimated_end)}
                        onChange={(e) =>
                          updateGroup("maintenance", {
                            ...form.maintenance,
                            estimated_end: fromLocalInput(e.target.value),
                          })
                        }
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="maintenance-message" className={labelClass}>
                      Pesan maintenance
                    </Label>
                    <textarea
                      id="maintenance-message"
                      rows={3}
                      maxLength={500}
                      value={form.maintenance.message}
                      onChange={(e) => updateGroup("maintenance", { ...form.maintenance, message: e.target.value })}
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50"
                    />
                    <span className="text-[11px] text-slate-400">
                      Kosongkan waktu mulai untuk membatalkan jadwal maintenance.
                    </span>
                  </div>
                </SettingSection>

                {ORDER.map(renderGroup)}

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    disabled={saveDisabled}
                    className="text-xs sm:text-sm bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl px-6 py-2.5 h-10 shadow-xs gap-1.5 cursor-pointer"
                  >
                    {isSaving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
                    {isSaving ? "Menyimpan..." : "Simpan Konfigurasi Sistem"}
                  </Button>
                </div>
              </form>
            </>
          )}
        </TabsContent>

        <TabsContent value="audit">
          <SettingsAuditTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
