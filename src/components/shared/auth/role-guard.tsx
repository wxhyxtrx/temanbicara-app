"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserRole } from "@/constant/mock-users";
import { useUserStore } from "@/store/user-store";
import { ShieldAlert, ArrowRight, RefreshCw, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RoleGuardProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}

const roleNames: Record<UserRole, string> = {
  patient: "Pasien / Klien",
  counselor: "Psikolog Klinis",
  peer_listener: "Pendengar Sebaya",
  admin: "Administrator",
};

const roleHomes: Record<UserRole, string> = {
  patient: "/patient/beranda",
  counselor: "/counselor/beranda",
  peer_listener: "/listener/beranda",
  admin: "/admin/beranda",
};

export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const router = useRouter();
  const user = useUserStore((state) => state.user);
  const switchRole = useUserStore((state) => state.switchRole);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <>{children}</>;
  }

  const isAuthorized = allowedRoles.includes(user.role);

  if (!isAuthorized) {
    const userRoleName = roleNames[user.role] || user.role;
    const requiredRoleNames = allowedRoles.map((r) => roleNames[r] || r).join(" atau ");
    const myPortalUrl = roleHomes[user.role] || "/patient/beranda";

    return (
      <div className="min-h-[60vh] flex items-center justify-center font-nunito p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-lg">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
            <ShieldAlert size={28} />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold font-heading text-slate-900 dark:text-white">
              Akses Portal Terbatas
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Halaman ini dikhususkan bagi peran <strong className="text-slate-800 dark:text-slate-200">{requiredRoleNames}</strong>.
              Saat ini Anda sedang aktif sebagai <strong className="text-teal-700 dark:text-teal-400">{userRoleName}</strong>.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-2.5 justify-center">
            <Button
              onClick={() => router.push(myPortalUrl)}
              className="text-xs bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl h-10 px-5 gap-1.5 cursor-pointer shadow-xs"
            >
              <span>Kembali ke Portal Saya</span>
              <ArrowRight size={14} />
            </Button>

            {allowedRoles[0] && (
              <Button
                variant="outline"
                onClick={() => {
                  switchRole(allowedRoles[0]);
                  router.push(roleHomes[allowedRoles[0]]);
                }}
                className="text-xs border-slate-200 dark:border-slate-700 rounded-xl h-10 px-4 font-semibold gap-1.5 cursor-pointer"
              >
                <RefreshCw size={13} />
                <span>Ganti ke Akun {roleNames[allowedRoles[0]]}</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
