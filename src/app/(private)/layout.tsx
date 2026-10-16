"use client";

import { AppSidebar } from "@/components/shared/organisms/sidebarApp";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ShieldCheck, HeartPulse, Stethoscope, Headphones, ShieldAlert } from "lucide-react";
import React from "react";
import { usePathname } from "next/navigation";
import { getMenuItemsByRole } from "@/constant/menu-sidebar";
import Link from "next/link";
import { useUserStore, UserRole } from "@/store/user-store";
import { NotificationDropdown } from "@/components/shared/organisms/notification-dropdown";
import { ThemeToggle } from "@/components/shared/atoms/theme-toggle";
import { GlobalToastListener } from "@/components/shared/global-toast-listener";
import { Skeleton } from "@/components/ui/skeleton";
import { mockUsers } from "@/constant/mock-users";

export default function PrivateLayouts({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useUserStore((state) => state.user);
  const isProfileLoaded = useUserStore((state) => state.isProfileLoaded);
  const syncSession = useUserStore((state) => state.syncSession);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    syncSession();
  }, [syncSession]);

  const currentRole: UserRole = mounted && user?.role ? user.role : "patient";
  const menuConfig = getMenuItemsByRole(currentRole);

  const defaultFallbackUser = mockUsers[currentRole] || mockUsers.patient;

  const displayName = mounted
    ? user.fullName || defaultFallbackUser.fullName
    : defaultFallbackUser.fullName;
  const displayInitials = mounted
    ? user.avatarInitials || defaultFallbackUser.avatarInitials
    : defaultFallbackUser.avatarInitials;

  const getAvatarBgClass = () => {
    switch (currentRole) {
      case "counselor":
        return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800";
      case "peer_listener":
        return "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800";
      case "admin":
        return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800";
      case "patient":
      default:
        return "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800";
    }
  };

  const getPageTitle = () => {
    const allMenuItems = [...menuConfig.mainItems, ...menuConfig.utilityItems];
    const exact = allMenuItems.find((item) => pathname === item.url);
    if (exact) return exact.title;
    const currentMenuItem = allMenuItems.find((item) => pathname.startsWith(`${item.url}/`));
    if (currentMenuItem) return currentMenuItem.title;
    return "TemanBicara";
  };

  const renderRoleBadge = () => {
    switch (currentRole) {
      case "counselor":
        return (
          <span className="text-[11px] text-purple-700 dark:text-purple-300 flex items-center justify-end gap-1 font-semibold">
            <Stethoscope size={11} className="text-purple-600 dark:text-purple-400" />
            Psikolog Berlisensi
          </span>
        );
      case "peer_listener":
        return (
          <span className="text-[11px] text-sky-700 dark:text-sky-300 flex items-center justify-end gap-1 font-semibold">
            <Headphones size={11} className="text-sky-600 dark:text-sky-400" />
            Pendengar Sebaya
          </span>
        );
      case "admin":
        return (
          <span className="text-[11px] text-amber-700 dark:text-amber-300 flex items-center justify-end gap-1 font-semibold">
            <ShieldAlert size={11} className="text-amber-600 dark:text-amber-400" />
            Administrator
          </span>
        );
      case "patient":
      default:
        return (
          <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-end gap-1 font-medium">
            <ShieldCheck size={11} className="text-teal-600 dark:text-teal-400" />
            Pasien Terverifikasi
          </span>
        );
    }
  };

  return (
    <SidebarProvider>
      <GlobalToastListener />
      <AppSidebar />
      <SidebarInset className="bg-slate-50/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen transition-colors duration-200">
        <header className="sticky top-0 z-40 w-full flex items-center justify-between border-b border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 px-4 md:px-8 py-3 backdrop-blur-md shadow-2xs transition-colors duration-200">
          <div className="flex items-center gap-3 md:gap-4">
            <SidebarTrigger className="h-9 w-9 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer" />
            <div className="flex items-center gap-3">
              <h1 className="text-lg md:text-xl font-heading font-bold text-slate-900 dark:text-white">
                {getPageTitle()}
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Ruang Aman & Privat
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/help-center"
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors"
            >
              <HeartPulse size={14} className="text-rose-600 dark:text-rose-400" />
              Hotline Darurat: 119
            </Link>

            {/* Interactive Notification Center Popover */}
            <NotificationDropdown />

            {/* Theme Toggle Button */}
            <ThemeToggle />

            <div className="hidden sm:flex items-center pl-2 border-l border-slate-200 dark:border-slate-800">
              {!mounted || !isProfileLoaded ? (
                <div className="flex items-center gap-2.5 h-8">
                  <div className="flex flex-col items-end gap-1.5 py-0.5">
                    <Skeleton className="h-3.5 w-24 rounded" />
                    <Skeleton className="h-3 w-16 rounded" />
                  </div>
                  <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                </div>
              ) : (
                <div className="flex items-center gap-2.5 h-8">
                  <div className="flex flex-col text-right">
                    <span className="text-xs font-semibold text-slate-800 dark:text-white leading-tight">
                      {displayName}
                    </span>
                    {renderRoleBadge()}
                  </div>
                  <div
                    className={`w-8 h-8 rounded-full font-bold text-xs flex items-center justify-center border shrink-0 font-heading shadow-2xs ${getAvatarBgClass()}`}
                  >
                    {displayInitials}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="px-3.5 sm:px-6 md:px-8 lg:px-10 py-6 w-full max-w-[1520px] mx-auto">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
