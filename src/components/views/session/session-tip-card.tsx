"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Coins, Heart, AlertCircle, CheckCircle2, Loader2, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { notify } from "@/lib/toast";
import { bookingClient, BookingApiError } from "@/services/booking.client";
import { systemSettingsClient } from "@/services/system-settings.client";
import { walletClient } from "@/services/wallet.client";

interface SessionTipCardProps {
  bookingId: string;
  compact?: boolean;
  onTipSuccess?: (coins: number) => void;
}

export function SessionTipCard({
  bookingId,
  compact = false,
  onTipSuccess,
}: SessionTipCardProps) {
  const [loadingSettings, setLoadingSettings] = useState<boolean>(true);
  const [minCoins, setMinCoins] = useState<number>(1);
  const [maxCoins, setMaxCoins] = useState<number>(50);
  const [userCoins, setUserCoins] = useState<number | null>(null);

  const [selectedCoins, setSelectedCoins] = useState<number>(5);
  const [customCoins, setCustomCoins] = useState<string>("5");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [alreadyTipped, setAlreadyTipped] = useState<boolean>(false);
  const [tipSuccessAmount, setTipSuccessAmount] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isInsufficientCoins, setIsInsufficientCoins] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    setLoadingSettings(true);
    try {
      const [settingsRes, walletRes] = await Promise.allSettled([
        systemSettingsClient.getPublicSettings(),
        walletClient.getWalletMe(),
      ]);

      if (settingsRes.status === "fulfilled" && settingsRes.value.settings?.tip) {
        const tipCfg = settingsRes.value.settings.tip;
        setMinCoins(tipCfg.min_coins || 1);
        setMaxCoins(tipCfg.max_coins || 50);
        setSelectedCoins(Math.min(5, tipCfg.max_coins || 50));
        setCustomCoins(String(Math.min(5, tipCfg.max_coins || 50)));
      }

      if (walletRes.status === "fulfilled" && walletRes.value) {
        setUserCoins(walletRes.value.coin_balance ?? 0);
      }
    } catch (err: unknown) {
      console.error("Gagal memuat pengaturan tip:", err);
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectPreset = (amount: number) => {
    setSelectedCoins(amount);
    setCustomCoins(String(amount));
    setErrorMsg(null);
    setIsInsufficientCoins(false);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, "");
    setCustomCoins(val);
    const num = parseInt(val, 10);
    if (!isNaN(num)) {
      setSelectedCoins(num);
    }
    setErrorMsg(null);
    setIsInsufficientCoins(false);
  };

  const handleSendTip = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(customCoins, 10);
    if (isNaN(amount) || amount < minCoins || amount > maxCoins) {
      setErrorMsg(`Jumlah tip harus antara ${minCoins} sampai ${maxCoins} koin.`);
      return;
    }

    if (userCoins !== null && userCoins < amount) {
      setIsInsufficientCoins(true);
      setErrorMsg(`Saldo koin Anda (${userCoins} Koin) tidak mencukupi untuk memberikan tip ini.`);
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setIsInsufficientCoins(false);

    try {
      const res = await bookingClient.sendTip(bookingId, { coins: amount });
      if (res.success) {
        setAlreadyTipped(true);
        setTipSuccessAmount(amount);
        if (userCoins !== null) {
          setUserCoins((prev) => (prev !== null ? Math.max(0, prev - amount) : null));
        }
        notify.success(
          "Tip Berhasil Dikirim",
          `Apresiasi sebesar ${amount} Koin telah diteruskan ke psikolog.`
        );
        if (onTipSuccess) onTipSuccess(amount);
      }
    } catch (err: unknown) {
      if (err instanceof BookingApiError) {
        if (err.status === 409 || err.code === "TIP_ALREADY_GIVEN") {
          setAlreadyTipped(true);
          setErrorMsg("Anda sudah pernah memberikan tip untuk sesi ini (maksimal 1x per sesi).");
        } else if (err.status === 402 || err.code === "INSUFFICIENT_COINS") {
          setIsInsufficientCoins(true);
          setErrorMsg("Saldo koin Anda tidak mencukupi. Silakan lakukan top up koin terlebih dahulu.");
        } else {
          setErrorMsg(err.message || "Gagal memberikan tip.");
        }
      } else {
        setErrorMsg(err instanceof Error ? err.message : "Gagal memberikan tip ke psikolog.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingSettings) {
    return (
      <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-center gap-2 text-xs text-slate-400">
        <Loader2 size={13} className="animate-spin text-teal-600" />
        <span>Memuat data tip...</span>
      </div>
    );
  }

  // State jika sudah pernah memberikan tip
  if (alreadyTipped) {
    return (
      <div className="p-3.5 sm:p-4 rounded-2xl border border-emerald-200/90 dark:border-emerald-800/80 bg-emerald-50/30 dark:bg-emerald-950/20 flex items-start gap-3">
        <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5 min-w-0">
          <p className="font-bold text-xs sm:text-sm text-emerald-950 dark:text-emerald-200 font-heading">
            {tipSuccessAmount
              ? `Tip ${tipSuccessAmount} Koin Berhasil Diberikan`
              : "Tip Telah Diberikan"}
          </p>
          <p className="text-[11px] text-emerald-900/80 dark:text-emerald-300/80 leading-relaxed">
            Terima kasih atas apresiasi Anda kepada psikolog. Tip hanya dapat diberikan 1x untuk setiap sesi konseling.
          </p>
        </div>
      </div>
    );
  }

  const presets = [2, 5, 10, 20].filter((p) => p >= minCoins && p <= maxCoins);

  return (
    <form
      onSubmit={handleSendTip}
      className={`rounded-2xl border transition-all ${
        compact
          ? "p-3.5 sm:p-4 border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40"
          : "p-4 sm:p-5 border-teal-200/90 dark:border-teal-800/80 bg-gradient-to-br from-teal-50/40 via-white to-teal-50/20 dark:from-teal-950/20 dark:via-slate-900 dark:to-slate-900"
      } space-y-3`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h4 className="text-xs sm:text-sm font-bold font-heading text-slate-900 dark:text-white flex items-center gap-1.5">
            <Heart size={15} className="fill-rose-500 text-rose-500" />
            <span>Beri Tip Apresiasi untuk Psikolog</span>
            <span className="text-[10px] font-normal text-slate-400">(Opsional)</span>
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Dukung psikolog dengan tip koin sukarela ({minCoins} - {maxCoins} Koin, 1x per sesi)
          </p>
        </div>

        {userCoins !== null && (
          <div className="shrink-0 text-right">
            <span className="text-[10px] text-slate-400 block">Saldo Anda:</span>
            <span className="text-xs font-bold font-mono text-teal-700 dark:text-teal-400">
              {userCoins} Koin
            </span>
          </div>
        )}
      </div>

      {/* Preset Buttons */}
      <div className="flex flex-wrap items-center gap-1.5">
        {presets.map((preset) => {
          const isSelected = selectedCoins === preset;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => handleSelectPreset(preset)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                isSelected
                  ? "bg-teal-600 text-white shadow-xs"
                  : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-teal-300"
              }`}
            >
              <Coins size={12} className={isSelected ? "text-white" : "text-amber-500"} />
              <span>{preset} Koin</span>
            </button>
          );
        })}
      </div>

      {/* Custom Coins Input & CTA */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            type="text"
            inputMode="numeric"
            value={customCoins}
            onChange={handleCustomChange}
            placeholder={`Jumlah koin (${minCoins}-${maxCoins})`}
            className="h-8 text-xs pl-7 pr-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl"
          />
          <Coins size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-amber-500" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
            Koin
          </span>
        </div>

        <Button
          type="submit"
          disabled={submitting}
          className="text-xs bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl h-8 px-4 gap-1.5 shadow-2xs cursor-pointer shrink-0"
        >
          {submitting ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              <span>Mengirim...</span>
            </>
          ) : (
            <>
              <Heart size={12} className="fill-white" />
              <span>Kirim Tip</span>
            </>
          )}
        </Button>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 flex items-start justify-between gap-2 text-xs text-rose-700 dark:text-rose-300">
          <div className="flex items-start gap-1.5">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>

          {isInsufficientCoins && (
            <Link href="/patient/top-up" className="shrink-0">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-6 text-[10px] px-2 border-rose-300 text-rose-700 hover:bg-rose-100 gap-1 rounded-lg"
              >
                <PlusCircle size={10} />
                <span>Top Up</span>
              </Button>
            </Link>
          )}
        </div>
      )}
    </form>
  );
}
