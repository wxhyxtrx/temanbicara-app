"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SettingsAuditTab } from "@/components/views/admin/settings/settings-audit-tab";
import {
  FLAT_GROUPS,
  type FlatGroup,
  type FlatKey,
  fromLocalInput,
  getChangedSettings,
  isMaintenanceRangeValid,
  isValidLocalInput,
  inputClass,
  invalidNumberKeys,
  labelClass,
  NumberField,
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
  Clock,
  History,
  Percent,
  RefreshCw,
  Save,
  Server,
  SlidersHorizontal,
  Undo2,
  Users,
  Wallet,
} from "lucide-react";


type SettingsSubTab = "keuangan" | "sesi" | "relawan" | "sistem";

const SUB_TAB_GROUPS: Record<
  SettingsSubTab,
  { label: string; icon: React.ComponentType<{ size?: number; className?: string }>; keys: SettingKey[] }
> = {
  keuangan: {
    label: "Keuangan",
    icon: Wallet,
    keys: ["topup", "revenue_share", "tip", "holding", "payout"],
  },
  sesi: {
    label: "Sesi",
    icon: Clock,
    keys: [
      "booking",
      "strike",
      "rating",
      "refund_policy",
      "psikolog_late",
      "patient_noshow",
      "extension_price",
    ],
  },
  relawan: {
    label: "Relawan",
    icon: Users,
    keys: ["relawan"],
  },
  sistem: {
    label: "Sistem",
    icon: Server,
    keys: ["maintenance", "upload", "media_retention"],
  },
};

const SUB_TAB_ORDER: SettingsSubTab[] = ["keuangan", "sesi", "relawan", "sistem"];

export default function AdminSettingsPage() {
  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>("keuangan");
  const [form, setForm] = useState<SystemSettings | null>(null);
  const [originalSettings, setOriginalSettings] = useState<SystemSettings | null>(null);
  const [meta, setMeta] = useState<AdminSettingsResult["meta"]>();
  const [isLoading, setIsLoading] = useState(true);
  const [isFallback, setIsFallback] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [revenueShareDraft, setRevenueShareDraft] = useState<string | null>(null);
  const [maintenanceDraft, setMaintenanceDraft] = useState({ scheduled_start: "", estimated_end: "" });
  const [refreshWarning, setRefreshWarning] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await systemSettingsClient.getAdminSettings();
      setForm(res.settings);
      setOriginalSettings(res.settings);
      setMaintenanceDraft({
        scheduled_start: toLocalInput(res.settings.maintenance.scheduled_start),
        estimated_end: toLocalInput(res.settings.maintenance.estimated_end),
      });
      setRevenueShareDraft(null);
      setMeta(res.meta);
      setIsFallback(res.isFallback);
      setLoadError(res.error ?? null);
      // Fresh form replaced every value, so earlier save/validation messages are stale.
      setSaveError(null);
      setFieldErrors({});
      setSaveSuccess(false);
      setRefreshWarning(null);
    } catch (error: unknown) {
      setForm(null);
      setOriginalSettings(null);
      setMeta(undefined);
      setIsFallback(false);
      setLoadError(error instanceof Error ? error.message : "Gagal memuat pengaturan sistem");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Editing a group clears its stale red error and the global validation banner.
  const clearErrorFor = (key: SettingKey) => {
    setSaveSuccess(false);
    setSaveError(null);
    setFieldErrors((errors) => {
      if (!errors[key]) return errors;
      const next = { ...errors };
      delete next[key];
      return next;
    });
  };

  const updateGroup = <K extends SettingKey>(key: K, value: SystemSettings[K]) => {
    clearErrorFor(key);
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const updateFlat = <K extends FlatKey>(key: K, field: keyof SystemSettings[K], value: number) => {
    if (!form) return;
    updateGroup(key, { ...form[key], [field]: value });
  };

  // Section error <p> id; only set when that key has an error so aria-describedby never points at nothing.
  const errorIdFor = (key: SettingKey) => (fieldErrors[key] ? `settings-error-${key}` : undefined);
  const maintenanceErrorId = errorIdFor("maintenance");
  const maintenanceAria = { "aria-invalid": !!maintenanceErrorId || undefined, "aria-describedby": maintenanceErrorId };

  const findFirstErrorSubTab = (errors: Record<string, string>): SettingsSubTab | null => {
    for (const tab of SUB_TAB_ORDER) {
      if (SUB_TAB_GROUPS[tab].keys.some((k) => Boolean(errors[k]))) {
        return tab;
      }
    }
    return null;
  };

  const subTabHasError = (tab: SettingsSubTab): boolean => {
    return SUB_TAB_GROUPS[tab].keys.some((k) => Boolean(fieldErrors[k]));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || isFallback || isSaving) return;
    const changes = getChangedSettings(form, originalSettings, maintenanceDraft, revenueShareDraft);
    if (Object.keys(changes).length === 0) return;

    setSaveSuccess(false);
    setRefreshWarning(null);

    if (changes.maintenance) {
      const invalidMaintenanceDate = Object.values(maintenanceDraft).some((value) => !isValidLocalInput(value));
      const invalidMaintenanceRange = !isMaintenanceRangeValid(maintenanceDraft.scheduled_start, maintenanceDraft.estimated_end);
      if (invalidMaintenanceDate || invalidMaintenanceRange) {
        const errs = {
          maintenance: invalidMaintenanceRange
            ? "Estimasi selesai harus lebih akhir dari mulai terjadwal."
            : "Isi tanggal maintenance yang valid atau kosongkan waktunya.",
        };
        setFieldErrors(errs);
        setSaveError(
          invalidMaintenanceRange
            ? "Rentang maintenance tidak valid. Periksa kartu bertanda merah."
            : "Tanggal maintenance tidak valid. Periksa kartu bertanda merah."
        );
        setActiveSubTab("sistem");
        return;
      }
    }

    if (changes.revenue_share) {
      const revenueSharePercent = Number(revenueShareDraft ?? String(form.revenue_share.mitra_bps / 100));
      if (!Number.isFinite(revenueSharePercent) || revenueSharePercent < 0) {
        setFieldErrors({ revenue_share: "Isi porsi mitra dengan persentase valid." });
        setSaveError("Ada angka kosong atau tidak valid. Periksa kartu bertanda merah.");
        setActiveSubTab("keuangan");
        return;
      }
    }

    const invalid = invalidNumberKeys(form).filter((k) => k in changes);
    if (invalid.length) {
      const errs = Object.fromEntries(invalid.map((k) => [k, "Isi semua angka dengan nilai yang valid."]));
      setFieldErrors(errs);
      setSaveError("Ada angka kosong atau tidak valid. Periksa kartu bertanda merah.");
      const firstTab = findFirstErrorSubTab(errs);
      if (firstTab) setActiveSubTab(firstTab);
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);
    setRefreshWarning(null);
    setSaveError(null);
    setFieldErrors({});

    try {
      const res = await systemSettingsClient.updateAdminSettings(changes);
      if (res.success && res.settings) {
        setForm(res.settings);
        setOriginalSettings(res.settings);
        setMaintenanceDraft({
          scheduled_start: toLocalInput(res.settings.maintenance.scheduled_start),
          estimated_end: toLocalInput(res.settings.maintenance.estimated_end),
        });
        setRevenueShareDraft(null);
        setSaveSuccess(true);
        // Refresh meta (updated_at); a failed refresh must not replace saved values with defaults.
        try {
          const fresh = await systemSettingsClient.getAdminSettings();
          setIsFallback(fresh.isFallback);
          setLoadError(fresh.error ?? null);
          if (!fresh.isFallback) {
            setRefreshWarning(null);
            setForm(fresh.settings);
            setOriginalSettings(fresh.settings);
            setMeta(fresh.meta);
            setMaintenanceDraft({
              scheduled_start: toLocalInput(fresh.settings.maintenance.scheduled_start),
              estimated_end: toLocalInput(fresh.settings.maintenance.estimated_end),
            });
            setRevenueShareDraft(null);
          } else {
            setRefreshWarning(
              `Pengaturan tersimpan, tetapi nilai terbaru dan metadata server tidak dapat diperbarui${fresh.error ? `: ${fresh.error}` : "."}`
            );
          }
        } catch (error) {
          // Unknown server state: keep saved form, block save until a manual reload succeeds.
          setIsFallback(true);
          setLoadError(error instanceof Error ? error.message : null);
          setRefreshWarning(
            error instanceof Error
              ? `Pengaturan tersimpan, tetapi nilai terbaru dan metadata server tidak dapat diperbarui: ${error.message}`
              : "Pengaturan tersimpan, tetapi nilai terbaru dan metadata server tidak dapat diperbarui."
          );
        }
      } else {
        const details = res.details ?? {};
        setFieldErrors(details);
        setSaveError(
          res.details
            ? "Beberapa parameter tidak valid. Periksa kartu bertanda merah."
            : res.error ?? "Gagal menyimpan konfigurasi"
        );
        const firstTab = findFirstErrorSubTab(details);
        if (firstTab) setActiveSubTab(firstTab);
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Gagal menyimpan konfigurasi");
    } finally {
      setIsSaving(false);
    }
  };

  const renderGroup = (key: SettingKey) => {
    if (!form) return null;
    const errorId = errorIdFor(key);
    const common = { meta: meta?.[key], error: fieldErrors[key], errorId };

    if (key === "revenue_share") {
      const currentBps = revenueShareDraft !== null
        ? (Number.isFinite(Number(revenueShareDraft)) ? Math.round(Number(revenueShareDraft) * 100) : form.revenue_share.mitra_bps)
        : form.revenue_share.mitra_bps;
      return (
        <SettingSection key={key} title="Bagi Hasil Mitra" icon={Percent} {...common}>
          <div className="max-w-md">
            <div className="space-y-1.5 min-w-0">
              <Label htmlFor="revenue_share-mitra" className={labelClass}>Porsi mitra (%)</Label>
              <Input
                id="revenue_share-mitra"
                type="number"
                inputMode="decimal"
                min={0}
                step={0.01}
                value={revenueShareDraft ?? String(form.revenue_share.mitra_bps / 100)}
                onChange={(event) => {
                  clearErrorFor("revenue_share");
                  setRevenueShareDraft(event.target.value);
                }}
                aria-invalid={!!errorId || undefined}
                aria-describedby={errorId}
                className={inputClass}
                required
              />
            </div>
            <span className="text-[11px] text-slate-400">Disimpan sebagai {currentBps} bps</span>
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
                  errorId={errorId}
                  label={`Tier ${i + 1}: minimal menit sebelum sesi`}
                  value={tier.min_minutes_before}
                  onChange={(v) => setTier(i, { min_minutes_before: v })}
                />
                <NumberField
                  id={`refund-${i}-pct`}
                  errorId={errorId}
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
              errorId={errorId}
              label={label}
              value={values[field]}
              onChange={(v) => updateFlat(key, field as keyof SystemSettings[typeof key], v)}
            />
          ))}
        </div>
      </SettingSection>
    );
  };

  const changes = getChangedSettings(form, originalSettings, maintenanceDraft, revenueShareDraft);
  const hasChanges = Object.keys(changes).length > 0;
  const saveDisabled = isLoading || isSaving || isFallback || !form || !hasChanges;
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
            <div className="space-y-6 animate-pulse">
              <div className="flex gap-2 pb-1 overflow-x-auto">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-9 w-28 rounded-xl shrink-0" />
                ))}
              </div>
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 space-y-4 bg-white dark:bg-slate-900">
                <Skeleton className="w-48 h-5 rounded-md" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="w-32 h-4 rounded-md" />
                      <Skeleton className="w-full h-9 rounded-xl" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : !form ? (
            <div role="alert" className="flex flex-col items-center justify-center gap-3 h-40 text-xs text-red-700 dark:text-red-300">
              <p>{loadError ?? "Pengaturan sistem tidak tersedia."}</p>
              <Button type="button" variant="outline" onClick={() => load()} className="h-8 text-xs rounded-xl gap-1.5 cursor-pointer">
                <RefreshCw size={13} /> Muat ulang
              </Button>
            </div>
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
                      Gagal memuat pengaturan dari server{loadError ? ` (${loadError})` : ""}.{" "}
                      {refreshWarning ? "Nilai di bawah adalah data yang baru disimpan" : "Nilai di bawah adalah default lokal"}; muat ulang
                      data admin terbaru sebelum menyimpan lagi.
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

              {refreshWarning && (
                <div role="alert" className="flex items-start gap-2 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-semibold">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span className="break-words">{refreshWarning}</span>
                </div>
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

              <form onSubmit={handleSave}>
                {/* Native fieldset disable blocks edits while saving so the response cannot overwrite them. */}
                <fieldset disabled={isSaving} className="space-y-6 min-w-0">
                  <Tabs value={activeSubTab} onValueChange={(val) => setActiveSubTab(val as SettingsSubTab)} className="w-full">
                    <TabsList className="flex flex-wrap sm:inline-flex w-full sm:w-auto h-auto p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl gap-1">
                      {SUB_TAB_ORDER.map((tab) => {
                        const config = SUB_TAB_GROUPS[tab];
                        const Icon = config.icon;
                        const hasErr = subTabHasError(tab);
                        return (
                          <TabsTrigger
                            key={tab}
                            value={tab}
                            className={`cursor-pointer text-xs font-semibold py-2 px-3.5 gap-1.5 rounded-lg transition-all ${
                              hasErr
                                ? "text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/30"
                                : ""
                            }`}
                          >
                            <Icon size={14} className={hasErr ? "text-rose-600 dark:text-rose-400" : "text-slate-500 dark:text-slate-400"} />
                            <span>{config.label}</span>
                            {hasErr && (
                              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse ml-0.5" />
                            )}
                          </TabsTrigger>
                        );
                      })}
                    </TabsList>

                    <TabsContent value="keuangan" className="space-y-6 mt-4">
                      {SUB_TAB_GROUPS.keuangan.keys.map(renderGroup)}
                    </TabsContent>

                    <TabsContent value="sesi" className="space-y-6 mt-4">
                      {SUB_TAB_GROUPS.sesi.keys.map(renderGroup)}
                    </TabsContent>

                    <TabsContent value="relawan" className="space-y-6 mt-4">
                      {SUB_TAB_GROUPS.relawan.keys.map(renderGroup)}
                    </TabsContent>

                    <TabsContent value="sistem" className="space-y-6 mt-4">
                      <SettingSection
                        title="Jadwal Pemeliharaan Server (Maintenance)"
                        icon={Server}
                        meta={meta?.maintenance}
                        error={fieldErrors.maintenance}
                        errorId={maintenanceErrorId}
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5 min-w-0">
                            <Label htmlFor="maintenance-start" className={labelClass}>
                              Mulai terjadwal (waktu lokal)
                            </Label>
                            <div className="flex gap-2">
                              <Input
                                id="maintenance-start"
                                {...maintenanceAria}
                                type="datetime-local"
                                value={maintenanceDraft.scheduled_start}
                                onChange={(e) => {
                                  setMaintenanceDraft((draft) => ({ ...draft, scheduled_start: e.target.value }));
                                  updateGroup("maintenance", { ...form.maintenance, scheduled_start: fromLocalInput(e.target.value) });
                                }}
                                className={`${inputClass} min-w-0`}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  const now = new Date();
                                  const localValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
                                  setMaintenanceDraft((draft) => ({ ...draft, scheduled_start: localValue }));
                                  updateGroup("maintenance", { ...form.maintenance, scheduled_start: now.toISOString() });
                                }}
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
                              {...maintenanceAria}
                              type="datetime-local"
                              value={maintenanceDraft.estimated_end}
                              onChange={(e) => {
                                setMaintenanceDraft((draft) => ({ ...draft, estimated_end: e.target.value }));
                                updateGroup("maintenance", { ...form.maintenance, estimated_end: fromLocalInput(e.target.value) });
                              }}
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
                            {...maintenanceAria}
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

                      {renderGroup("upload")}
                      {renderGroup("media_retention")}
                    </TabsContent>
                  </Tabs>

                  <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                    <Button
                      type="submit"
                      disabled={saveDisabled}
                      className="text-xs sm:text-sm bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl px-6 py-2.5 h-10 shadow-xs gap-1.5 cursor-pointer"
                    >
                      {isSaving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
                      {isSaving ? "Menyimpan..." : "Simpan Konfigurasi Sistem"}
                    </Button>
                  </div>
                </fieldset>
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
