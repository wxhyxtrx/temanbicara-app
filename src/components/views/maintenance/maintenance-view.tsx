'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/shared/atoms/Logo';
import { ThemeToggle } from '@/components/shared/atoms/theme-toggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { systemSettingsClient } from '@/services/system-settings.client';
import type { PublicSettings } from '@/types/system-settings';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  ShieldCheck,
  WifiOff,
  Wrench,
} from 'lucide-react';

const POLLING_INTERVAL_MS = 25_000;
const DEFAULT_MAINTENANCE_MESSAGE =
  'Sistem sedang dalam pemeliharaan. Silakan coba beberapa saat lagi.';

export function formatWibDateTime(iso: string | null | undefined): string | null {
  if (!iso || typeof iso !== 'string' || !iso.trim()) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  try {
    const parts = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);

    const find = (type: string) => parts.find((p) => p.type === type)?.value || '';
    const day = find('day');
    const month = find('month');
    const year = find('year');
    const hour = find('hour');
    const minute = find('minute');

    if (!day || !month || !year || !hour || !minute) return null;
    return `${day} ${month} ${year}, ${hour}:${minute} WIB`;
  } catch {
    return null;
  }
}

export function MaintenanceView() {
  const router = useRouter();
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [isRedirecting, setIsRedirecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const checkStatus = useCallback(
    async (isManual = false) => {
      if (isManual) {
        setIsChecking(true);
      }
      try {
        const res = await systemSettingsClient.getPublicSettings();

        if (res.isFallback) {
          if (!settings) {
            setError(res.error || 'Gagal memuat status pemeliharaan.');
          } else if (isManual) {
            setFeedbackMessage('Gagal memperbarui status. Periksa koneksi internet Anda.');
          }
          return;
        }

        const phase = res.settings.maintenance.phase;
        if (phase === 'none' || phase === 'scheduled') {
          setIsRedirecting(true);
          router.replace('/');
          return;
        }

        setSettings(res.settings);
        setError(null);
        if (isManual) {
          setFeedbackMessage('Status berhasil diperbarui.');
        }
      } catch (err) {
        if (!settings) {
          setError(err instanceof Error ? err.message : 'Terjadi kesalahan jaringan.');
        } else if (isManual) {
          setFeedbackMessage('Gagal memperbarui status. Coba lagi beberapa saat lagi.');
        }
      } finally {
        if (isManual) {
          setIsChecking(false);
        }
      }
    },
    [router, settings]
  );

  useEffect(() => {
    let isMounted = true;

    async function initialLoad() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await systemSettingsClient.getPublicSettings();
        if (!isMounted) return;

        if (res.isFallback) {
          setError(res.error || 'Gagal memuat status pemeliharaan.');
        } else {
          const phase = res.settings.maintenance.phase;
          if (phase === 'none' || phase === 'scheduled') {
            setIsRedirecting(true);
            router.replace('/');
            return;
          }
          setSettings(res.settings);
        }
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Terjadi kesalahan jaringan.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initialLoad();

    return () => {
      isMounted = false;
    };
  }, [router]);

  useEffect(() => {
    if (isRedirecting) return;

    const timer = setInterval(() => {
      checkStatus(false);
    }, POLLING_INTERVAL_MS);

    return () => {
      clearInterval(timer);
    };
  }, [checkStatus, isRedirecting]);

  useEffect(() => {
    if (!feedbackMessage) return;
    const timeout = setTimeout(() => {
      setFeedbackMessage(null);
    }, 4000);
    return () => clearTimeout(timeout);
  }, [feedbackMessage]);

  const rawMessage = settings?.maintenance?.message?.trim();
  const displayMessage = rawMessage || DEFAULT_MAINTENANCE_MESSAGE;
  const estimatedEndFormatted = formatWibDateTime(settings?.maintenance?.estimated_end);

  return (
    <div className="min-h-screen w-full flex flex-col justify-between items-center bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4 sm:p-6 overflow-x-hidden">
      <header className="w-full max-w-4xl flex items-center justify-between gap-4 py-2 min-w-0">
        <Logo href="/" size="md" />
        <ThemeToggle />
      </header>

      <main className="w-full flex-1 flex items-center justify-center py-8 min-w-0">
        {isRedirecting ? (
          <div
            className="w-full max-w-lg min-w-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl flex flex-col items-center text-center"
            role="status"
            aria-live="polite"
          >
            <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200/80 dark:border-teal-800/80 text-teal-600 dark:text-teal-400 mb-4 shadow-xs">
              <CheckCircle2 className="size-8 sm:size-10" aria-hidden="true" />
            </div>
            <h1 className="text-xl sm:text-2xl font-heading font-bold text-slate-900 dark:text-white tracking-tight break-words mb-2">
              Sistem Telah Aktif
            </h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed break-words mb-6 max-w-md">
              Pemeliharaan sistem telah selesai. Mengalihkan Anda kembali ke halaman utama...
            </p>
            <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400 text-sm font-medium">
              <RefreshCw className="size-4 animate-spin" aria-hidden="true" />
              <span>Memproses pengalihan...</span>
            </div>
          </div>
        ) : isLoading ? (
          <div
            className="w-full max-w-lg min-w-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl flex flex-col items-center text-center"
            role="status"
            aria-busy="true"
            aria-live="polite"
          >
            <span className="sr-only">Memuat status pemeliharaan sistem...</span>
            <Skeleton className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl mb-4" />
            <Skeleton className="h-6 w-36 rounded-full mb-3" />
            <Skeleton className="h-8 w-4/5 rounded-md mb-3" />
            <Skeleton className="h-4 w-full rounded mb-1.5" />
            <Skeleton className="h-4 w-5/6 rounded mb-6" />
            <Skeleton className="h-24 w-full rounded-xl mb-6" />
            <Skeleton className="h-10 w-44 rounded-xl" />
          </div>
        ) : error && !settings ? (
          <div
            className="w-full max-w-lg min-w-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl flex flex-col items-center text-center"
            role="alert"
          >
            <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200/80 dark:border-rose-800/80 text-rose-600 dark:text-rose-400 mb-4 shadow-xs">
              <WifiOff className="size-8 sm:size-10" aria-hidden="true" />
            </div>
            <Badge
              variant="outline"
              className="mb-3 px-3 py-1 text-xs font-semibold uppercase tracking-wider bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60"
            >
              Koneksi Terputus
            </Badge>
            <h1 className="text-xl sm:text-2xl font-heading font-bold text-slate-900 dark:text-white tracking-tight break-words mb-2">
              Gagal Memuat Status
            </h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed break-words mb-6 max-w-md">
              Tidak dapat terhubung ke server untuk memeriksa status pemeliharaan. Silakan periksa
              koneksi internet Anda dan coba lagi.
            </p>
            <Button
              type="button"
              onClick={() => checkStatus(true)}
              disabled={isChecking}
              variant="default"
              className="w-full sm:w-auto min-w-[180px] h-10 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium shadow-xs transition-all focus-visible:ring-2 focus-visible:ring-teal-500 cursor-pointer"
              aria-label="Coba memuat status pemeliharaan kembali"
            >
              <RefreshCw
                className={cn('size-4 mr-2', isChecking && 'animate-spin')}
                aria-hidden="true"
              />
              <span>{isChecking ? 'Memeriksa...' : 'Coba Lagi'}</span>
            </Button>
          </div>
        ) : (
          <div className="w-full max-w-lg min-w-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl flex flex-col items-center text-center">
            <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200/80 dark:border-amber-800/80 text-amber-600 dark:text-amber-400 mb-4 shadow-xs">
              <Wrench className="size-8 sm:size-10" aria-hidden="true" />
            </div>

            <Badge
              variant="outline"
              className="mb-3 px-3 py-1 text-xs font-semibold uppercase tracking-wider bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60"
            >
              Pemeliharaan Sistem
            </Badge>

            <h1 className="text-xl sm:text-2xl font-heading font-bold text-slate-900 dark:text-white tracking-tight break-words mb-3">
              Pemeliharaan Sistem Sedang Berlangsung
            </h1>

            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed break-words mb-6 max-w-md">
              {displayMessage}
            </p>

            <section
              aria-labelledby="maintenance-estimated-time-label"
              className="w-full rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 p-4 mb-6 flex flex-col sm:flex-row items-center sm:items-start gap-3.5 text-center sm:text-left min-w-0"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-950/80 border border-teal-200/80 dark:border-teal-800 text-teal-600 dark:text-teal-400">
                <Clock className="size-5" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  id="maintenance-estimated-time-label"
                  className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                >
                  Perkiraan Selesai
                </p>
                <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white break-words mt-0.5">
                  {estimatedEndFormatted || 'Belum ditentukan'}
                </p>
                {!estimatedEndFormatted && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 break-words">
                    Waktu selesai belum ditentukan. Tim teknis sedang bekerja untuk memulihkan
                    layanan secepat mungkin.
                  </p>
                )}
              </div>
            </section>

            <div className="w-full flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-6 px-2 min-w-0">
              <ShieldCheck className="size-4 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden="true" />
              <span className="break-words">
                Data akun, sesi konseling, dan saldo Anda tetap tersimpan dengan aman.
              </span>
            </div>

            <Button
              type="button"
              onClick={() => checkStatus(true)}
              disabled={isChecking}
              variant="default"
              className="w-full sm:w-auto min-w-[180px] h-10 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium shadow-xs transition-all focus-visible:ring-2 focus-visible:ring-teal-500 cursor-pointer"
              aria-label="Periksa kembali status pemeliharaan sistem"
            >
              <RefreshCw
                className={cn('size-4 mr-2', isChecking && 'animate-spin')}
                aria-hidden="true"
              />
              <span>{isChecking ? 'Memeriksa...' : 'Periksa Kembali'}</span>
            </Button>

            <div aria-live="polite" className="mt-3 min-h-[20px] text-center">
              {feedbackMessage && (
                <p className="text-xs font-medium text-teal-700 dark:text-teal-300 animate-in fade-in duration-200">
                  {feedbackMessage}
                </p>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="w-full max-w-4xl py-4 text-center text-xs text-slate-400 dark:text-slate-500 min-w-0">
        <p>&copy; {new Date().getFullYear()} TemanBicara. Hak cipta dilindungi.</p>
      </footer>
    </div>
  );
}
