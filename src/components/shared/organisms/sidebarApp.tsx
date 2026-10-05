"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { mainItems, utilityItems } from "@/constant/menu-sidebar";
import { WalletMinimal, Plus, LogOut, ShieldCheck, ChevronRight } from "lucide-react";
import { Logo } from "@/components/shared/atoms/Logo";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useUserStore } from "@/store/user-store";

export function AppSidebar() {
  const pathname = usePathname();
  const { setOpenMobile, isMobile } = useSidebar();
  const user = useUserStore((state) => state.user);
  const logout = useUserStore((state) => state.logout);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const displayName = mounted
    ? (user.fullName && user.fullName !== "Matthew Johnson" ? user.fullName : "Wahyu Tricahyo")
    : "Wahyu Tricahyo";
  const displayInitials = mounted
    ? (user.avatarInitials && user.avatarInitials !== "MJ" ? user.avatarInitials : "WT")
    : "WT";
  const displayCoins = mounted ? user.coins : 50;

  // Handler auto-close sidebar pada mobile dan tablet (< 1024px)
  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleLogout = () => {
    logout();
    handleNavClick();
  };

  return (
    <Sidebar className="border-r border-slate-200/90 dark:border-slate-800 !bg-white dark:!bg-slate-900 text-slate-900 dark:text-slate-100 font-nunito select-none transition-colors duration-200">
      {/* 1. Header Logo */}
      <SidebarHeader className="p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <Link
          href="/beranda"
          onClick={handleNavClick}
          className="flex items-center px-1 hover:opacity-85 transition-opacity"
        >
          <Logo size="md" showTagline />
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3 py-2 space-y-3 bg-white dark:bg-slate-900">
        {/* 2. Patient Profile Card */}
        <SidebarGroup className="p-0">
          <Link
            href="/settings"
            onClick={handleNavClick}
            className="flex items-center justify-between p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 hover:bg-teal-50/50 dark:hover:bg-slate-800 hover:border-teal-200 dark:hover:border-teal-700 transition-all duration-150 group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-950 dark:to-teal-900 text-teal-800 dark:text-teal-300 font-bold text-xs flex items-center justify-center border border-teal-200 dark:border-teal-700 shrink-0 font-heading shadow-2xs">
                {displayInitials}
              </div>
              <div className="min-w-0 space-y-0.5">
                <p className="font-heading font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate group-hover:text-teal-800 dark:group-hover:text-teal-300 transition-colors">
                  {displayName}
                </p>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-nunito">
                  <ShieldCheck size={12} className="text-teal-600 dark:text-teal-400 shrink-0" />
                  <span className="truncate">Pasien Terverifikasi</span>
                </div>
              </div>
            </div>

            <ChevronRight size={14} className="text-slate-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 shrink-0 transition-colors" />
          </Link>
        </SidebarGroup>

        {/* 3. Main Navigation */}
        <SidebarGroup className="p-0 space-y-1">
          <SidebarGroupLabel className="text-[11px] font-bold px-3 py-1 text-slate-400 dark:text-slate-500 uppercase tracking-wider font-heading">
            Menu Utama
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {mainItems.map((item) => {
                const isActive = pathname === item.url || pathname.startsWith(`${item.url}/`);
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className="h-auto p-0"
                    >
                      <Link
                        href={item.url}
                        onClick={handleNavClick}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs sm:text-sm transition-all duration-150 ${
                          isActive
                            ? "bg-teal-50 dark:bg-teal-950/70 text-teal-900 dark:text-teal-200 font-bold border border-teal-200/90 dark:border-teal-800 shadow-2xs"
                            : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white font-medium"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Icon
                            size={18}
                            className={`shrink-0 ${
                              isActive ? "text-teal-600 dark:text-teal-400" : "text-slate-500 dark:text-slate-400"
                            }`}
                          />
                          <span className="truncate">{item.title}</span>
                        </div>

                        {/* High-Contrast Badge */}
                        {item.badge && (
                          <span
                            className={`ml-auto shrink-0 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold font-mono tracking-tight shadow-xs ${
                              isActive
                                ? "bg-teal-700 text-white ring-1 ring-teal-800"
                                : "bg-teal-600 text-white"
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="px-2">
          <SidebarSeparator className="bg-slate-100 dark:bg-slate-800" />
        </div>

        {/* 4. Utility Navigation */}
        <SidebarGroup className="p-0 space-y-1">
          <SidebarGroupLabel className="text-[11px] font-bold px-3 py-1 text-slate-400 dark:text-slate-500 uppercase tracking-wider font-heading">
            Dukungan & Akun
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {utilityItems.map((item) => {
                const isActive =
                  item.url === "/top-up"
                    ? pathname === "/top-up"
                    : pathname === item.url || pathname.startsWith(`${item.url}/`);
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className="h-auto p-0"
                    >
                      <Link
                        href={item.url}
                        onClick={handleNavClick}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs sm:text-sm transition-all duration-150 ${
                          isActive
                            ? "bg-teal-50 dark:bg-teal-950/70 text-teal-900 dark:text-teal-200 font-bold border border-teal-200/90 dark:border-teal-800 shadow-2xs"
                            : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white font-medium"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Icon
                            size={18}
                            className={`shrink-0 ${
                              isActive ? "text-teal-600 dark:text-teal-400" : "text-slate-500 dark:text-slate-400"
                            }`}
                          />
                          <span className="truncate">{item.title}</span>
                        </div>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* 5. Footer: Saldo Koin & Logout */}
      <SidebarFooter className="p-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
        {/* Wallet Balance Strip */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80">
          <Link
            href="/top-up"
            onClick={handleNavClick}
            className="flex items-center gap-2.5 hover:opacity-85 transition-opacity min-w-0"
          >
            <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-400 flex items-center justify-center shrink-0 border border-teal-100 dark:border-teal-800">
              <WalletMinimal size={16} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                Saldo Konseling
              </span>
              <span className="text-xs sm:text-sm font-bold text-teal-800 dark:text-teal-300 font-heading truncate">
                {displayCoins} Koin
              </span>
            </div>
          </Link>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/top-up" onClick={handleNavClick}>
                  <button
                    type="button"
                    className="h-7 w-7 rounded-lg bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center shrink-0 transition-colors shadow-2xs cursor-pointer"
                    aria-label="Top Up Koin"
                  >
                    <Plus size={14} strokeWidth={2.5} />
                  </button>
                </Link>
              </TooltipTrigger>
              <TooltipContent align="end">
                <p className="text-xs">Top Up Koin</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Logout Row */}
        <Link
          href="/login"
          onClick={handleLogout}
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-400 transition-colors cursor-pointer group"
        >
          <LogOut size={16} className="text-slate-400 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors" />
          <span>Keluar dari Akun</span>
        </Link>
      </SidebarFooter>
    </Sidebar>
  );
}
