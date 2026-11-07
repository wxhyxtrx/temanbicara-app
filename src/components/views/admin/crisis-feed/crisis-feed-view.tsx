"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TablePaginationFooter } from "@/components/shared/atoms/Table";
import { notify } from "@/lib/toast";
import { crisisClient, CrisisApiError } from "@/services/crisis.client";
import type { CrisisAlertItem, CrisisAlertStatus } from "@/types/crisis";
import { CrisisFeedTable } from "./crisis-feed-table";
import { CrisisEmergencyContactModal } from "./crisis-emergency-contact-modal";
import { CrisisHandleDialog } from "./crisis-handle-dialog";
import {
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  Inbox,
  Filter,
  CheckCircle2,
  XCircle,
} from "lucide-react";

type StatusFilter = "all" | CrisisAlertStatus;

export function CrisisFeedView() {
  const [alerts, setAlerts] = useState<CrisisAlertItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);
  const [total, setTotal] = useState<number>(0);
  const [unhandledCount, setUnhandledCount] = useState<number>(0);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [emergencyAlert, setEmergencyAlert] = useState<CrisisAlertItem | null>(null);
  const [handleDialogState, setHandleDialogState] = useState<{
    isOpen: boolean;
    alert: CrisisAlertItem | null;
    targetStatus: "handled" | "false_alarm";
  }>({
    isOpen: false,
    alert: null,
    targetStatus: "handled",
  });

  const fetchAlerts = useCallback(
    async (targetPage: number, targetStatus: StatusFilter, targetLimit: number = limit) => {
      try {
        setLoading(true);
        setError(null);
        const res = await crisisClient.adminGetAlerts({
          status: targetStatus,
          page: targetPage,
          limit: targetLimit,
        });

        if (res.success && Array.isArray(res.data)) {
          if (res.data.length === 0 && targetPage > 1 && res.pagination.totalPages < targetPage) {
            setPage(res.pagination.totalPages);
            return;
          }
          setAlerts(res.data);
          setTotal(res.pagination.total);
          setUnhandledCount(res.pagination.unhandled_count);
        } else {
          setAlerts([]);
          setTotal(0);
        }
      } catch (err: unknown) {
        console.error("Gagal memuat feed krisis admin:", err);
        const msg =
          err instanceof CrisisApiError
            ? err.message
            : err instanceof Error
            ? err.message
            : "Gagal memuat feed krisis keselamatan pasien";
        setError(msg);
        notify.error("Gagal Memuat Feed Krisis", msg);
        setAlerts([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [limit]
  );

  useEffect(() => {
    fetchAlerts(page, statusFilter, limit);
  }, [fetchAlerts, page, statusFilter, limit]);

  // Listener sinkronisasi event refresh
  useEffect(() => {
    const handleRefreshEvent = () => {
      fetchAlerts(page, statusFilter, limit);
    };
    if (typeof window !== "undefined") {
      window.addEventListener("crisis:refresh", handleRefreshEvent);
      return () => {
        window.removeEventListener("crisis:refresh", handleRefreshEvent);
      };
    }
  }, [fetchAlerts, page, statusFilter, limit]);

  const handleFilterChange = (newStatus: StatusFilter) => {
    setStatusFilter(newStatus);
    setPage(1);
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  };

  const openEmergencyModal = (alert: CrisisAlertItem) => {
    setEmergencyAlert(alert);
  };

  const closeEmergencyModal = () => {
    setEmergencyAlert(null);
  };

  const openHandleDialog = (alert: CrisisAlertItem, status: "handled" | "false_alarm") => {
    setHandleDialogState({
      isOpen: true,
      alert,
      targetStatus: status,
    });
  };

  const closeHandleDialog = () => {
    setHandleDialogState((prev) => ({ ...prev, isOpen: false }));
  };

  const handleSuccessUpdate = () => {
    fetchAlerts(page, statusFilter, limit);
  };

  return (
    <div className="w-full min-w-0 max-w-7xl mx-auto space-y-6 font-nunito text-slate-900 dark:text-slate-100 pb-12">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-5 min-w-0">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-200 dark:border-rose-900 shadow-2xs">
              <ShieldAlert size={20} />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold font-heading tracking-tight text-slate-900 dark:text-white truncate">
              Eskalasi Krisis
            </h1>
            {unhandledCount > 0 && (
              <Badge className="bg-rose-600 text-white font-mono text-xs px-2 py-0.5 rounded-full font-bold animate-pulse shadow-xs">
                {unhandledCount} Baru
              </Badge>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Pusat pemantauan alarm keselamatan pasien, deteksi kata kunci risiko, dan protokol kontak darurat.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => fetchAlerts(page, statusFilter, limit)}
          className="rounded-xl h-9 text-xs gap-2 shrink-0 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shadow-2xs"
        >
          <RefreshCw size={14} className={loading ? "animate-spin text-teal-600" : ""} />
          <span>Muat Ulang</span>
        </Button>
      </div>

      {/* 2. Statistical Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 min-w-0">
        {/* Baru / Perlu Penanganan */}
        <div
          onClick={() => handleFilterChange("new")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer min-w-0 ${
            statusFilter === "new"
              ? "bg-rose-50 border-rose-300 dark:bg-rose-950/40 dark:border-rose-800 ring-2 ring-rose-500/20"
              : "bg-white border-slate-200 hover:border-rose-200 dark:bg-slate-900 dark:border-slate-800"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-rose-700 dark:text-rose-400 mb-1.5">
            <span className="font-semibold">Perlu Tindakan</span>
            <ShieldAlert size={16} />
          </div>
          <div className="text-2xl font-bold font-heading text-rose-600 dark:text-rose-400">
            {unhandledCount}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
            Alarm krisis belum ditangani
          </p>
        </div>

        {/* Ditangani */}
        <div
          onClick={() => handleFilterChange("handled")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer min-w-0 ${
            statusFilter === "handled"
              ? "bg-emerald-50 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800 ring-2 ring-emerald-500/20"
              : "bg-white border-slate-200 hover:border-emerald-200 dark:bg-slate-900 dark:border-slate-800"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400 mb-1.5">
            <span className="font-semibold">Telah Ditangani</span>
            <CheckCircle2 size={16} />
          </div>
          <div className="text-2xl font-bold font-heading text-emerald-600 dark:text-emerald-400">
            {statusFilter === "handled" ? total : "-"}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
            Intervensi selesai
          </p>
        </div>

        {/* Alarm Palsu */}
        <div
          onClick={() => handleFilterChange("false_alarm")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer min-w-0 ${
            statusFilter === "false_alarm"
              ? "bg-slate-100 border-slate-300 dark:bg-slate-800 dark:border-slate-700 ring-2 ring-slate-500/20"
              : "bg-white border-slate-200 hover:border-slate-300 dark:bg-slate-900 dark:border-slate-800"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 mb-1.5">
            <span className="font-semibold">Alarm Palsu</span>
            <XCircle size={16} />
          </div>
          <div className="text-2xl font-bold font-heading text-slate-700 dark:text-slate-300">
            {statusFilter === "false_alarm" ? total : "-"}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
            Konfirmasi non-krisis
          </p>
        </div>

        {/* Total Keseluruhan */}
        <div
          onClick={() => handleFilterChange("all")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer min-w-0 ${
            statusFilter === "all"
              ? "bg-teal-50 border-teal-300 dark:bg-teal-950/40 dark:border-teal-800 ring-2 ring-teal-500/20"
              : "bg-white border-slate-200 hover:border-teal-200 dark:bg-slate-900 dark:border-slate-800"
          }`}
        >
          <div className="flex items-center justify-between text-xs text-teal-700 dark:text-teal-400 mb-1.5">
            <span className="font-semibold">Semua Riwayat</span>
            <Filter size={16} />
          </div>
          <div className="text-2xl font-bold font-heading text-teal-700 dark:text-teal-300">
            {statusFilter === "all" ? total : "-"}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
            Total seluruh rekaman
          </p>
        </div>
      </div>

      {/* 3. Status Tabs Navigation */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto min-w-0">
        <button
          type="button"
          onClick={() => handleFilterChange("all")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
            statusFilter === "all"
              ? "bg-teal-600 text-white shadow-2xs"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          Semua Kasus {statusFilter === "all" ? `(${total})` : ""}
        </button>

        <button
          type="button"
          onClick={() => handleFilterChange("new")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
            statusFilter === "new"
              ? "bg-rose-600 text-white shadow-2xs"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <span>Baru</span>
          {unhandledCount > 0 && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                statusFilter === "new" ? "bg-white text-rose-700" : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
              }`}
            >
              {unhandledCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleFilterChange("handled")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
            statusFilter === "handled"
              ? "bg-emerald-600 text-white shadow-2xs"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          Ditangani {statusFilter === "handled" ? `(${total})` : ""}
        </button>

        <button
          type="button"
          onClick={() => handleFilterChange("false_alarm")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
            statusFilter === "false_alarm"
              ? "bg-slate-700 text-white shadow-2xs"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          Alarm Palsu {statusFilter === "false_alarm" ? `(${total})` : ""}
        </button>
      </div>

      {/* 4. Content State (Loading / Error / Empty / Table) */}
      {loading ? (
        <div className="space-y-3 min-w-0">
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      ) : error ? (
        <div className="p-8 rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50/70 dark:bg-rose-950/30 text-center space-y-3 min-w-0">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/60 dark:text-rose-300 flex items-center justify-center mx-auto">
            <AlertTriangle size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="font-heading font-bold text-sm sm:text-base text-rose-900 dark:text-rose-200">
              Gagal Memuat Feed Krisis
            </h3>
            <p className="text-xs text-rose-700 dark:text-rose-300 max-w-md mx-auto">
              {error}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fetchAlerts(page, statusFilter, limit)}
            className="rounded-xl text-xs border-rose-300 hover:bg-rose-100 dark:border-rose-800 cursor-pointer"
          >
            Coba Lagi
          </Button>
        </div>
      ) : alerts.length === 0 ? (
        <div className="p-12 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center space-y-3 min-w-0 shadow-2xs">
          <div className="w-12 h-12 rounded-full bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto">
            <ShieldCheck size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="font-heading font-bold text-sm sm:text-base text-slate-800 dark:text-white">
              Tidak Ada Alarm Krisis
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {statusFilter === "new"
                ? "Semua alarm krisis keselamatan telah ditangani atau belum ada alarm baru yang terdeteksi."
                : "Belum ada catatan alarm krisis yang sesuai dengan filter yang dipilih saat ini."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4 min-w-0">
          <CrisisFeedTable
            alerts={alerts}
            onOpenEmergencyContact={openEmergencyModal}
            onOpenHandleDialog={openHandleDialog}
          />

          <TablePaginationFooter
            totalItems={total}
            page={page}
            limit={limit}
            onPageChange={setPage}
            onChangeLimit={handleLimitChange}
            className="border-t-0 px-0 py-1"
          />
        </div>
      )}

      {/* 5. Modals */}
      <CrisisEmergencyContactModal
        isOpen={!!emergencyAlert}
        onClose={closeEmergencyModal}
        alert={emergencyAlert}
      />

      <CrisisHandleDialog
        isOpen={handleDialogState.isOpen}
        onClose={closeHandleDialog}
        alert={handleDialogState.alert}
        targetStatus={handleDialogState.targetStatus}
        onSuccess={handleSuccessUpdate}
      />
    </div>
  );
}
