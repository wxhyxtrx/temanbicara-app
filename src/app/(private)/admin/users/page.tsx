"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Search,
  RefreshCw,
  Eye,
  UserPlus,
  Filter,
} from "lucide-react";
import { userService } from "@/services/user.service";
import { UserDetailModal } from "@/components/views/admin/user-detail-modal";
import { CreateUserModal } from "@/components/views/admin/create-user-modal";
import { DeleteUserDialog } from "@/components/views/admin/delete-user-dialog";
import type { AdminUserRow, ApiAccountStatus, ApiRole } from "@/types/user-profile";

const statusBadgeConfig: Record<
  ApiAccountStatus,
  { label: string; className: string }
> = {
  active: {
    label: "Aktif",
    className:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
  },
  unverified_email: {
    label: "Email Belum Verifikasi",
    className:
      "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25",
  },
  incomplete_profile: {
    label: "Profil Belum Lengkap",
    className:
      "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/25",
  },
  pending_approval: {
    label: "Menunggu Persetujuan",
    className:
      "bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-500/25",
  },
  pending_verification: {
    label: "Verifikasi Berkas",
    className:
      "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/25",
  },
  rejected: {
    label: "Ditolak",
    className:
      "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25",
  },
  suspended: {
    label: "Ditangguhkan",
    className:
      "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/25",
  },
};

const roleBadgeConfig: Record<
  ApiRole,
  { label: string; className: string }
> = {
  pasien: {
    label: "Pasien",
    className:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  },
  psikolog: {
    label: "Psikolog Klinis",
    className:
      "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
  },
  relawan: {
    label: "Pendengar Sebaya",
    className:
      "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20",
  },
  admin: {
    label: "Administrator",
    className:
      "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  },
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState<number>(0);

  // Modals state
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteTargetUser, setDeleteTargetUser] = useState<AdminUserRow | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const apiRole = roleFilter === "all" ? undefined : (roleFilter as ApiRole);
      const apiStatus = statusFilter === "all" ? undefined : (statusFilter as ApiAccountStatus);
      const res = await userService.getAdminUsers({
        role: apiRole,
        status: apiStatus,
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
  }, [roleFilter, statusFilter, search]);

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

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="text-xs gap-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold cursor-pointer shadow-xs"
          >
            <UserPlus size={14} />
            <span>Tambah Pengguna</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchUsers}
            disabled={loading}
            className="text-xs gap-1.5 rounded-xl border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span>Segarkan</span>
          </Button>
        </div>
      </div>

      {/* 2. Filters & Search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs">
        {/* Role Tabs */}
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
                  ? "bg-teal-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/60"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Status Filter & Search */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          <div className="w-full sm:w-44 flex items-center gap-1.5">
            <Filter size={14} className="text-slate-400 shrink-0" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 text-xs bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 rounded-xl">
                <SelectValue placeholder="Filter Status" />
              </SelectTrigger>
              <SelectContent className="text-xs">
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="suspended">Ditangguhkan</SelectItem>
                <SelectItem value="pending_approval">Menunggu Persetujuan</SelectItem>
                <SelectItem value="pending_verification">Verifikasi Berkas</SelectItem>
                <SelectItem value="rejected">Ditolak</SelectItem>
                <SelectItem value="unverified_email">Email Belum Verifikasi</SelectItem>
                <SelectItem value="incomplete_profile">Profil Belum Lengkap</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-full sm:w-60 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Cari nama, email, no WA..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-8 text-xs bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 rounded-xl"
            />
          </div>
        </div>
      </div>

      {/* 3. Users Table */}
      <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Pengguna</th>
                  <th className="py-3.5 px-4">Peran Akun</th>
                  <th className="py-3.5 px-4">Nomor WhatsApp</th>
                  <th className="py-3.5 px-4">Bergabung</th>
                  <th className="py-3.5 px-4">Status Akun</th>
                  <th className="py-3.5 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw size={16} className="animate-spin text-teal-600" />
                        <span>Memuat data pengguna dari database...</span>
                      </div>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 space-y-1">
                      <Users size={28} className="mx-auto opacity-40 text-slate-400 mb-2" />
                      <p className="font-semibold text-slate-700 dark:text-slate-300">
                        Tidak ada pengguna yang sesuai
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Coba sesuaikan kata kunci pencarian atau filter status dan peran akun.
                      </p>
                    </td>
                  </tr>
                ) : (
                  users.map((u) => {
                    const statusCfg = statusBadgeConfig[u.status] || {
                      label: u.status,
                      className: "bg-slate-100 text-slate-700 border-slate-200",
                    };
                    const roleCfg = roleBadgeConfig[u.role] || {
                      label: u.role,
                      className: "bg-slate-100 text-slate-700 border-slate-200",
                    };

                    return (
                      <tr
                        key={u.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <p className="font-bold font-heading text-slate-900 dark:text-white text-xs sm:text-sm">
                            {u.fullName || u.email.split("@")[0]}
                          </p>
                          <p className="text-[11px] text-slate-400 font-nunito">{u.email}</p>
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-block font-semibold px-2.5 py-0.5 rounded-lg border text-[11px] ${roleCfg.className}`}
                          >
                            {roleCfg.label}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                          {u.no_wa ? (
                            <span>{u.no_wa}</span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 italic text-[11px]">
                              Tidak ada
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 font-nunito">
                          {formatDate(u.created_at)}
                        </td>

                        <td className="py-3.5 px-4">
                          <Badge className={`text-[10px] border shadow-none ${statusCfg.className}`}>
                            {statusCfg.label}
                          </Badge>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedUser(u)}
                            className="h-7 px-2.5 text-xs text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/50 rounded-lg gap-1 cursor-pointer font-semibold"
                          >
                            <Eye size={13} />
                            <span>Detail / Kelola</span>
                          </Button>
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

      {/* 4. Modals */}
      <UserDetailModal
        user={selectedUser}
        open={!!selectedUser}
        onOpenChange={(open) => !open && setSelectedUser(null)}
        onUpdated={fetchUsers}
        onOpenDelete={(u) => {
          setSelectedUser(null);
          setDeleteTargetUser(u);
        }}
        statusBadgeConfig={statusBadgeConfig}
        roleBadgeConfig={roleBadgeConfig}
        formatDate={formatDate}
      />

      <CreateUserModal
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={fetchUsers}
      />

      <DeleteUserDialog
        user={deleteTargetUser}
        open={!!deleteTargetUser}
        onOpenChange={(open) => !open && setDeleteTargetUser(null)}
        onDeleted={fetchUsers}
      />
    </div>
  );
}
