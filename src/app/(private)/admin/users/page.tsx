"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Users,
  Search,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { userService } from "@/services/user.service";
import type { AdminUserRow, ApiAccountStatus, ApiRole } from "@/types/user-profile";

const statusBadgeConfig: Record<
  ApiAccountStatus,
  { label: string; className: string }
> = {
  active: {
    label: "Aktif",
    className: "bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  },
  unverified_email: {
    label: "Email Belum Verifikasi",
    className: "bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  },
  incomplete_profile: {
    label: "Profil Belum Lengkap",
    className: "bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  },
  pending_approval: {
    label: "Menunggu Persetujuan",
    className: "bg-pink-50 dark:bg-pink-950 text-pink-800 dark:text-pink-300 border-pink-200 dark:border-pink-800",
  },
  pending_verification: {
    label: "Verifikasi Berkas",
    className: "bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800",
  },
  rejected: {
    label: "Ditolak",
    className: "bg-rose-50 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800",
  },
  suspended: {
    label: "Ditangguhkan",
    className: "bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800",
  },
};

const roleMapLabel: Record<ApiRole, string> = {
  pasien: "Pasien",
  psikolog: "Psikolog Klinis",
  relawan: "Pendengar Sebaya",
  admin: "Administrator",
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState<number>(0);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const apiRole = roleFilter === "all" ? undefined : (roleFilter as ApiRole);
      const res = await userService.getAdminUsers({
        role: apiRole,
        search: search.trim() || undefined,
        limit: 50,
      });

      if (res && res.success && Array.isArray(res.data)) {
        setUsers(res.data);
        setTotal(res.meta?.total || res.data.length);
      } else {
        setUsers([]);
        setTotal(0);
      }
    } catch (err) {
      console.error("Gagal mengambil data user:", err);
      setUsers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [roleFilter, search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 250);

    return () => clearTimeout(timer);
  }, [fetchUsers]);

  const formatDate = (isoString?: string) => {
    if (!isoString) return "-";
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(date);
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 font-nunito pb-12 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 dark:text-white tracking-tight">
            Manajemen Pengguna & Pengawasan Akun
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Direktori akun terdaftar, status kepatuhan etika, dan peran akses platform ({total} akun)
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchUsers}
          disabled={loading}
          className="self-start sm:self-auto text-xs gap-1.5 rounded-xl border-slate-200 dark:border-slate-800"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          <span>Segarkan Data</span>
        </Button>
      </div>

      {/* 2. Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { key: "all", label: "Semua Peran" },
            { key: "pasien", label: "Pasien" },
            { key: "psikolog", label: "Psikolog Klinis" },
            { key: "relawan", label: "Pendengar Sebaya" },
            { key: "admin", label: "Admin" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setRoleFilter(tab.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                roleFilter === tab.key
                  ? "bg-teal-600 text-white shadow-2xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-64 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Cari nama, email, no WA..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-8 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl"
          />
        </div>
      </div>

      {/* 3. Users Table */}
      <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
        <CardContent className="p-0 sm:p-2">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 text-slate-600 dark:text-slate-400 font-semibold">
                  <th className="p-3.5 pl-4">Pengguna</th>
                  <th className="p-3.5">Peran Akun</th>
                  <th className="p-3.5">Nomor WhatsApp</th>
                  <th className="p-3.5">Bergabung</th>
                  <th className="p-3.5">Status Akun</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw size={16} className="animate-spin text-teal-600" />
                        <span>Memuat data pengguna dari database...</span>
                      </div>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400 space-y-1">
                      <Users size={28} className="mx-auto opacity-40 text-slate-400 mb-2" />
                      <p className="font-semibold text-slate-700 dark:text-slate-300">
                        Tidak ada pengguna yang sesuai
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Coba sesuaikan kata kunci pencarian atau filter peran akun.
                      </p>
                    </td>
                  </tr>
                ) : (
                  users.map((u) => {
                    const statusCfg = statusBadgeConfig[u.status] || {
                      label: u.status,
                      className: "bg-slate-100 text-slate-700 border-slate-200",
                    };

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-3.5 pl-4">
                          <p className="font-bold font-heading text-slate-900 dark:text-white text-xs sm:text-sm">
                            {u.fullName || u.email.split("@")[0]}
                          </p>
                          <p className="text-[11px] text-slate-400 font-nunito">{u.email}</p>
                        </td>

                        <td className="p-3.5">
                          <span className="font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950 px-2 py-0.5 rounded text-[11px] capitalize">
                            {roleMapLabel[u.role] || u.role}
                          </span>
                        </td>

                        <td className="p-3.5 font-mono text-slate-700 dark:text-slate-300">
                          {u.no_wa || "-"}
                        </td>

                        <td className="p-3.5 text-slate-500 font-nunito">
                          {formatDate(u.created_at)}
                        </td>

                        <td className="p-3.5">
                          <Badge className={`text-[10px] border ${statusCfg.className}`}>
                            {statusCfg.label}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
