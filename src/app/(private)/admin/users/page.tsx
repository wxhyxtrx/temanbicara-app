"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Users,
  Search,
  ShieldCheck,
  CheckCircle2,
  Ban,
  UserCheck,
  MoreVertical,
  Mail,
  Coins,
} from "lucide-react";
import { UserRole } from "@/constant/mock-users";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: "Aktif" | "Ditangguhkan";
  coins: number;
  joinedDate: string;
}

const mockUserRows: UserRow[] = [
  {
    id: "usr-1",
    name: "Wahyu Tricahyo",
    email: "pasien.wahyu@temanbicara.id",
    role: "patient",
    status: "Aktif",
    coins: 50,
    joinedDate: "1 Okt 2026",
  },
  {
    id: "usr-2",
    name: "Dr. Sarah Alatas, M.Psi",
    email: "psikolog.sarah@temanbicara.id",
    role: "counselor",
    status: "Aktif",
    coins: 620,
    joinedDate: "15 Jan 2026",
  },
  {
    id: "usr-3",
    name: "Dewi Lestari",
    email: "relawan.dewi@temanbicara.id",
    role: "peer_listener",
    status: "Aktif",
    coins: 0,
    joinedDate: "12 Mar 2026",
  },
  {
    id: "usr-4",
    name: "Admin Pusat",
    email: "admin@temanbicara.id",
    role: "admin",
    status: "Aktif",
    coins: 9999,
    joinedDate: "1 Jan 2026",
  },
  {
    id: "usr-5",
    name: "Rizky Ramadhan",
    email: "rizky.r@example.com",
    role: "patient",
    status: "Ditangguhkan",
    coins: 10,
    joinedDate: "18 Sep 2026",
  },
];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>(mockUserRows);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const handleToggleStatus = (id: string) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id ? { ...u, status: u.status === "Aktif" ? "Ditangguhkan" : "Aktif" } : u
      )
    );
  };

  const filtered = users.filter((u) => {
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    const matchSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    return matchRole && matchSearch;
  });

  return (
    <div className="space-y-6 sm:space-y-8 font-nunito pb-12 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* 1. Header */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 dark:text-white tracking-tight">
          Manajemen Pengguna & Pengawasan Akun
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Kelola direktori akun terdaftar, status kepatuhan etika, dan peran akses platform
        </p>
      </div>

      {/* 2. Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { key: "all", label: "Semua Peran" },
            { key: "patient", label: "Pasien" },
            { key: "counselor", label: "Psikolog Klinis" },
            { key: "peer_listener", label: "Pendengar Sebaya" },
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

        <div className="w-full sm:w-64">
          <Input
            placeholder="Cari nama / email akun..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl"
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
                  <th className="p-3.5">Saldo Koin</th>
                  <th className="p-3.5">Bergabung</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 pr-4 text-center">Moderasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="p-3.5 pl-4">
                      <p className="font-bold font-heading text-slate-900 dark:text-white text-xs sm:text-sm">
                        {u.name}
                      </p>
                      <p className="text-[11px] text-slate-400 font-nunito">{u.email}</p>
                    </td>

                    <td className="p-3.5">
                      <span className="font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950 px-2 py-0.5 rounded text-[11px] capitalize">
                        {u.role.replace("_", " ")}
                      </span>
                    </td>

                    <td className="p-3.5 font-mono font-bold text-slate-800 dark:text-slate-200">
                      {u.coins} Koin
                    </td>

                    <td className="p-3.5 text-slate-500 font-nunito">{u.joinedDate}</td>

                    <td className="p-3.5">
                      <Badge
                        className={`text-[10px] ${
                          u.status === "Aktif"
                            ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-200"
                            : "bg-rose-50 text-rose-800 border-rose-200"
                        }`}
                      >
                        {u.status}
                      </Badge>
                    </td>

                    <td className="p-3.5 pr-4 text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleStatus(u.id)}
                        className={`h-7 text-xs rounded-lg px-2.5 font-semibold cursor-pointer ${
                          u.status === "Aktif"
                            ? "border-rose-200 text-rose-600 hover:bg-rose-50"
                            : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                        }`}
                      >
                        {u.status === "Aktif" ? "Tangguhkan" : "Pulihkan"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
