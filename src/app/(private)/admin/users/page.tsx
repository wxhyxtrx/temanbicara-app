"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  FileCheck2,
  CheckCircle2,
  ShieldCheck,
  Clock,
  Sparkles,
} from "lucide-react";
import { userService } from "@/services/user.service";
import { UserDetailModal } from "@/components/views/admin/user-detail-modal";
import { CreateUserModal } from "@/components/views/admin/create-user-modal";
import { DeleteUserDialog } from "@/components/views/admin/delete-user-dialog";
import { useUserStore } from "@/store/user-store";
import type { AdminUserRow, ApiAccountStatus, ApiRole } from "@/types/user-profile";
import { Tables, Column } from "@/components/shared/atoms/Table";

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

function AdminUsersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentUser = useUserStore((state) => state.user);

  const initialTab = searchParams.get("tab") === "verifications" ? "verifications" : "all";
  const [activeTab, setActiveTab] = useState<"all" | "verifications">(initialTab);

  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [verificationSubFilter, setVerificationSubFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState<number>(0);
  const [pendingMitraCount, setPendingMitraCount] = useState<number>(0);

  // Modals state
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteTargetUser, setDeleteTargetUser] = useState<AdminUserRow | null>(null);

  // Sync tab with URL search parameter
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "verifications" && activeTab !== "verifications") {
      setActiveTab("verifications");
    } else if (!tabParam && activeTab === "verifications") {
      // Keep or allow tab
    }
  }, [searchParams, activeTab]);

  const handleTabChange = (tab: "all" | "verifications") => {
    setActiveTab(tab);
    if (tab === "verifications") {
      router.replace("/admin/users?tab=verifications");
    } else {
      router.replace("/admin/users");
    }
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      let apiRole: ApiRole | undefined;
      let apiStatus: ApiAccountStatus | undefined;

      if (activeTab === "verifications") {
        // Verification tab focuses on partners (psikolog & relawan)
        if (roleFilter !== "all" && (roleFilter === "psikolog" || roleFilter === "relawan")) {
          apiRole = roleFilter as ApiRole;
        }

        if (verificationSubFilter === "pending") {
          apiStatus = "pending_verification";
        } else if (verificationSubFilter === "approved") {
          apiStatus = "active";
        } else if (verificationSubFilter === "rejected") {
          apiStatus = "rejected";
        }
      } else {
        apiRole = roleFilter === "all" ? undefined : (roleFilter as ApiRole);
        apiStatus = statusFilter === "all" ? undefined : (statusFilter as ApiAccountStatus);
      }

      const res = await userService.getAdminUsers({
        role: apiRole,
        status: apiStatus,
        search: search.trim() || undefined,
        limit: 100,
      });

      if (res && res.success && Array.isArray(res.data)) {
        let filtered = res.data.filter(
          (u) => u.id !== currentUser?.id && u.email !== currentUser?.email
        );

        if (activeTab === "verifications") {
          // Keep only psikolog & relawan
          filtered = filtered.filter((u) => u.role === "psikolog" || u.role === "relawan");
        }

        setUsers(filtered);
        setTotal(filtered.length);
      } else {
        setUsers([]);
        setTotal(0);
      }

      // Check pending count for badge indicator
      const countRes = await userService.getAdminUsers({
        status: "pending_verification",
        limit: 100,
      });
      if (countRes && countRes.success && Array.isArray(countRes.data)) {
        const pendingCount = countRes.data.filter(
          (u) => u.role === "psikolog" || u.role === "relawan"
        ).length;
        setPendingMitraCount(pendingCount);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("Sesi tidak valid") && !msg.includes("kedaluwarsa") && !msg.includes("INVALID_TOKEN")) {
        console.error("Gagal mengambil data user:", err);
      }
      setUsers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [activeTab, roleFilter, statusFilter, verificationSubFilter, search, currentUser?.id, currentUser?.email]);

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

  const columns: Column<AdminUserRow>[] = [
    {
      label: activeTab === "verifications" ? "Praktisi / Pemohon" : "Pengguna",
      className: "w-[26%]",
      renderCell: (u) => (
        <div>
          <p className="font-bold font-heading text-slate-900 dark:text-white text-xs sm:text-sm">
            {u.fullName || u.email.split("@")[0]}
          </p>
          <p className="text-[11px] text-slate-400 font-nunito">{u.email}</p>
        </div>
      ),
    },
    {
      label: "Peran Akun",
      className: "w-[16%]",
      renderCell: (u) => {
        const roleCfg = roleBadgeConfig[u.role] || {
          label: u.role,
          className: "bg-slate-100 text-slate-700 border-slate-200",
        };
        return (
          <span
            className={`inline-block font-semibold px-2.5 py-0.5 rounded-lg border text-[11px] ${roleCfg.className}`}
          >
            {roleCfg.label}
          </span>
        );
      },
    },
    {
      label: "Nomor WhatsApp",
      className: "w-[18%]",
      renderCell: (u) =>
        u.no_wa ? (
          <span className="font-mono text-slate-700 dark:text-slate-300">{u.no_wa}</span>
        ) : (
          <span className="text-slate-400 dark:text-slate-500 italic text-[11px]">
            Tidak ada
          </span>
        ),
    },
    {
      label: activeTab === "verifications" ? "Diajukan Pada" : "Bergabung",
      className: "w-[14%]",
      renderCell: (u) => (
        <span className="text-slate-500 dark:text-slate-400 font-nunito text-xs">
          {formatDate(u.created_at)}
        </span>
      ),
    },
    {
      label: activeTab === "verifications" ? "Status Verifikasi" : "Status Akun",
      className: "w-[14%]",
      renderCell: (u) => {
        const statusCfg = statusBadgeConfig[u.status] || {
          label: u.status,
          className: "bg-slate-100 text-slate-700 border-slate-200",
        };
        return (
          <Badge className={`text-[10px] border shadow-none ${statusCfg.className}`}>
            {statusCfg.label}
          </Badge>
        );
      },
    },
    {
      label: "Aksi",
      align: "center",
      className: "w-[12%]",
      renderCell: (u) => (
        <div className="flex justify-center">
          {activeTab === "verifications" ? (
            <Button
              size="sm"
              onClick={() => setSelectedUser(u)}
              className="h-7.5 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg gap-1.5 cursor-pointer font-bold shadow-2xs"
            >
              <FileCheck2 size={13} />
              <span>Tinjau Kredensial</span>
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedUser(u)}
              className="h-7 px-2.5 text-xs text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/50 rounded-lg gap-1 cursor-pointer font-semibold"
            >
              <Eye size={13} />
              <span>Detail / Kelola</span>
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8 font-nunito pb-12 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 dark:text-white tracking-tight">
            Manajemen Pengguna & Verifikasi Mitra
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {activeTab === "verifications"
              ? "Validasi dokumen legal lisensi praktik SIPPK/STR psikolog klinis dan berkas pendengar sebaya"
              : `Direktori seluruh akun terdaftar, status kepatuhan etika, dan peran akses platform (${total} akun)`}
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

      {/* 2. Main Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => handleTabChange("all")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === "all"
              ? "bg-teal-600 text-white shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Users size={16} />
          <span>Semua Pengguna</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("verifications")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === "verifications"
              ? "bg-teal-600 text-white shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <FileCheck2 size={16} />
          <span>Verifikasi Mitra (SIPPK / STR)</span>
          {pendingMitraCount > 0 && (
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                activeTab === "verifications"
                  ? "bg-white text-teal-800"
                  : "bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200"
              }`}
            >
              {pendingMitraCount} Baru
            </span>
          )}
        </button>
      </div>

      {/* 3. Filters & Search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs">
        {/* Role Tabs or Verification Status Tabs */}
        {activeTab === "verifications" ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { key: "pending", label: "Menunggu Tinjauan" },
              { key: "approved", label: "Disetujui (Aktif)" },
              { key: "rejected", label: "Ditolak" },
              { key: "all", label: "Semua Kredensial" },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setVerificationSubFilter(tab.key as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  verificationSubFilter === tab.key
                    ? "bg-teal-600 text-white shadow-xs"
                    : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/60"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : (
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
        )}

        {/* Status Filter & Search */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          {activeTab === "all" && (
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
          )}

          {activeTab === "verifications" && (
            <div className="w-full sm:w-44 flex items-center gap-1.5">
              <Filter size={14} className="text-slate-400 shrink-0" />
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="h-9 text-xs bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 rounded-xl">
                  <SelectValue placeholder="Filter Jenis Mitra" />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectItem value="all">Semua Mitra</SelectItem>
                  <SelectItem value="psikolog">Psikolog Klinis (SIPPK)</SelectItem>
                  <SelectItem value="relawan">Pendengar Sebaya (CV)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="w-full sm:w-60 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder={activeTab === "verifications" ? "Cari nama / SIPPK..." : "Cari nama, email, WA..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-8 text-xs bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 rounded-xl"
            />
          </div>
        </div>
      </div>

      {/* 4. Table */}
      <Tables
        columns={columns}
        data={users}
        isLoading={loading}
        emptyTitle={activeTab === "verifications" ? "Tidak ada permohonan verifikasi" : "Tidak ada pengguna yang sesuai"}
        emptyDescription={
          activeTab === "verifications"
            ? "Semua permohonan lisensi mitra telah ditinjau atau tidak ditemukan sesuai filter."
            : "Coba sesuaikan kata kunci pencarian atau filter status dan peran akun."
        }
      />

      {/* 5. Modals */}
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

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">Memuat data pengguna...</div>}>
      <AdminUsersContent />
    </Suspense>
  );
}
