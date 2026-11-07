"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import type { CrisisAlertItem } from "@/types/crisis";
import {
  PhoneCall,
  CheckCircle2,
  XCircle,
  KeyRound,
  UserCheck,
  Clock,
  ShieldAlert,
  MessageSquare,
  User,
} from "lucide-react";

interface CrisisFeedTableProps {
  alerts: CrisisAlertItem[];
  onOpenEmergencyContact: (alert: CrisisAlertItem) => void;
  onOpenHandleDialog: (alert: CrisisAlertItem, status: "handled" | "false_alarm") => void;
}

export function formatWIB(isoString?: string | null): string {
  if (!isoString) return "-";
  try {
    return (
      new Date(isoString).toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }) + " WIB"
    );
  } catch {
    return isoString;
  }
}

export function CrisisFeedTable({
  alerts,
  onOpenEmergencyContact,
  onOpenHandleDialog,
}: CrisisFeedTableProps) {
  const renderStatusBadge = (status: CrisisAlertItem["status"]) => {
    switch (status) {
      case "new":
        return (
          <Badge className="bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800 text-[11px] font-bold shadow-2xs">
            Baru
          </Badge>
        );
      case "handled":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800 text-[11px] font-semibold">
            Ditangani
          </Badge>
        );
      case "false_alarm":
        return (
          <Badge className="bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 text-[11px] font-semibold">
            Alarm Palsu
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const renderSourceBadge = (source: CrisisAlertItem["source"]) => {
    if (source === "booking") {
      return (
        <Badge className="bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 text-[10px] font-medium">
          Konseling
        </Badge>
      );
    }
    return (
      <Badge className="bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 text-[10px] font-medium">
        Curhat Sebaya
      </Badge>
    );
  };

  const renderDetectionType = (alert: CrisisAlertItem) => {
    if (alert.detected_by === "keyword") {
      return (
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 font-mono">
            <KeyRound size={12} className="shrink-0" />
            <span>Kata Kunci</span>
          </span>
          {alert.snippet ? (
            <p
              className="text-[11px] text-slate-600 dark:text-slate-300 italic font-mono truncate max-w-[200px]"
              title={alert.snippet}
            >
              &quot;{alert.snippet}&quot;
            </p>
          ) : (
            <span className="text-[10px] text-slate-400 italic">Tanpa cuplikan</span>
          )}
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
          <UserCheck size={12} className="shrink-0" />
          <span>Manual</span>
        </span>
        <span className="text-[11px] text-slate-600 dark:text-slate-300 truncate max-w-[200px]" title={alert.reporter_name || "Pendamping"}>
          Oleh: {alert.reporter_name || "Pendamping"}
        </span>
        {alert.snippet && (
          <p
            className="text-[10px] text-slate-500 dark:text-slate-400 italic truncate max-w-[200px]"
            title={alert.snippet}
          >
            Catatan: {alert.snippet}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="w-full min-w-0 space-y-4 font-nunito">
      {/* 1. Mobile Cards View (< 768px) */}
      <div className="block md:hidden space-y-3 min-w-0">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`p-4 rounded-2xl border transition-all min-w-0 space-y-3 ${
              alert.status === "new"
                ? "bg-rose-50/30 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900"
                : "bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800"
            }`}
          >
            {/* Header Card */}
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                {renderStatusBadge(alert.status)}
                {renderSourceBadge(alert.source)}
                <Badge
                  variant="outline"
                  className={`font-mono text-[10px] ${
                    alert.hit_count > 1
                      ? "border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-950/50"
                      : "text-slate-500"
                  }`}
                >
                  Hit: {alert.hit_count}
                </Badge>
              </div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 font-mono">
                {formatWIB(alert.created_at)}
              </span>
            </div>

            {/* Patient & Detection */}
            <div className="space-y-1.5 min-w-0 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <User size={13} className="text-slate-400 shrink-0" />
                <span className="font-bold text-slate-900 dark:text-white truncate">
                  {alert.patient_display_name}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 min-w-0">
                {renderDetectionType(alert)}
              </div>

              {alert.admin_note && (
                <div className="p-2 rounded-lg bg-teal-50/50 dark:bg-teal-950/30 border border-teal-100 dark:border-teal-900/40 text-[11px] text-teal-900 dark:text-teal-200">
                  <span className="font-semibold block text-[10px] text-teal-700 dark:text-teal-400">
                    Catatan Penanganan:
                  </span>
                  <p className="line-clamp-2">{alert.admin_note}</p>
                </div>
              )}
            </div>

            {/* Actions Buttons */}
            <div className="pt-1 flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenEmergencyContact(alert)}
                className="h-8 text-xs rounded-xl gap-1.5 border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/50 cursor-pointer"
              >
                <PhoneCall size={12} />
                <span>Lihat Kontak Darurat</span>
              </Button>

              {alert.status === "new" && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenHandleDialog(alert, "handled")}
                    className="h-8 text-xs rounded-xl gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/50 cursor-pointer"
                  >
                    <CheckCircle2 size={12} />
                    <span>Tandai Ditangani</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onOpenHandleDialog(alert, "false_alarm")}
                    className="h-8 text-xs rounded-xl gap-1 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <XCircle size={12} />
                    <span>Alarm Palsu</span>
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 2. Desktop Table View (>= 768px) */}
      <div className="hidden md:block rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs min-w-0">
        <div className="overflow-x-auto min-w-0">
          <Table className="min-w-[850px] text-xs">
            <TableHeader className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800">
              <TableRow>
                <TableHead className="w-[155px] font-semibold text-slate-600 dark:text-slate-400">
                  Waktu (WIB)
                </TableHead>
                <TableHead className="w-[140px] font-semibold text-slate-600 dark:text-slate-400">
                  Pasien
                </TableHead>
                <TableHead className="w-[110px] font-semibold text-slate-600 dark:text-slate-400">
                  Sumber
                </TableHead>
                <TableHead className="min-w-[200px] font-semibold text-slate-600 dark:text-slate-400">
                  Deteksi & Cuplikan
                </TableHead>
                <TableHead className="w-[80px] font-semibold text-slate-600 dark:text-slate-400 text-center">
                  Hit
                </TableHead>
                <TableHead className="w-[110px] font-semibold text-slate-600 dark:text-slate-400">
                  Status
                </TableHead>
                <TableHead className="w-[200px] font-semibold text-slate-600 dark:text-slate-400 text-right">
                  Aksi Penanganan
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100 dark:divide-slate-800">
              {alerts.map((alert) => (
                <TableRow
                  key={alert.id}
                  className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors ${
                    alert.status === "new" ? "bg-rose-50/20 dark:bg-rose-950/10" : ""
                  }`}
                >
                  {/* Waktu */}
                  <TableCell className="font-mono text-[11px] text-slate-600 dark:text-slate-400 align-top">
                    {formatWIB(alert.created_at)}
                  </TableCell>

                  {/* Pasien */}
                  <TableCell className="align-top">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="font-bold text-slate-900 dark:text-white truncate">
                        {alert.patient_display_name}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400 truncate max-w-[120px]">
                        ID: {alert.patient_id.slice(0, 8)}...
                      </span>
                    </div>
                  </TableCell>

                  {/* Sumber */}
                  <TableCell className="align-top">
                    {renderSourceBadge(alert.source)}
                  </TableCell>

                  {/* Deteksi & Snippet */}
                  <TableCell className="align-top min-w-0">
                    {renderDetectionType(alert)}
                    {alert.admin_note && (
                      <p className="text-[10px] text-teal-700 dark:text-teal-300 mt-1 line-clamp-1 italic" title={alert.admin_note}>
                        Catatan: {alert.admin_note}
                      </p>
                    )}
                  </TableCell>

                  {/* Hit Counter */}
                  <TableCell className="align-top text-center">
                    <Badge
                      variant="outline"
                      className={`font-mono text-[10px] px-1.5 ${
                        alert.hit_count > 1
                          ? "border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-950/50 font-bold"
                          : "text-slate-500"
                      }`}
                    >
                      {alert.hit_count}
                    </Badge>
                  </TableCell>

                  {/* Status */}
                  <TableCell className="align-top">
                    <div className="flex flex-col gap-1">
                      {renderStatusBadge(alert.status)}
                      {alert.handler_name && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[100px]">
                          Oleh {alert.handler_name}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* Aksi */}
                  <TableCell className="align-top text-right">
                    <div className="flex flex-col items-end gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenEmergencyContact(alert)}
                        className="h-7 px-2.5 text-[11px] rounded-lg gap-1 border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/50 cursor-pointer"
                        title="Buka nomor kontak darurat pasien"
                      >
                        <PhoneCall size={11} />
                        <span>Kontak Darurat</span>
                      </Button>

                      {alert.status === "new" && (
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onOpenHandleDialog(alert, "handled")}
                            className="h-7 px-2 text-[11px] rounded-lg gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/50 cursor-pointer"
                            title="Tandai alarm telah ditangani"
                          >
                            <CheckCircle2 size={11} />
                            <span>Ditangani</span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onOpenHandleDialog(alert, "false_alarm")}
                            className="h-7 px-2 text-[11px] rounded-lg gap-1 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
                            title="Tandai sebagai alarm palsu"
                          >
                            <XCircle size={11} />
                            <span>Palsu</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
