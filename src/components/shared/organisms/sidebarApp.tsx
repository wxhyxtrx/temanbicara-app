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
import { getMenuItemsByRole } from "@/constant/menu-sidebar";
import {
  WalletMinimal,
  Plus,
  LogOut,
  ShieldCheck,
  ChevronRight,
  Stethoscope,
  Headphones,
  ShieldAlert,
  Wallet,
  Sparkles,
} from "lucide-react";
import { Logo } from "@/components/shared/atoms/Logo";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { mockUsers } from "@/constant/mock-users";
import { useUserStore, UserRole } from "@/store/user-store";
import { authService } from "@/services/auth.service";
import { walletClient } from "@/services/wallet.client";
import { Skeleton } from "@/components/ui/skeleton";

export function AppSidebar() {
  const pathname = usePathname();
  const { setOpenMobile, isMobile } = useSidebar();
  const user = useUserStore((state) => state.user);
  const isProfileLoaded = useUserStore((state) => state.isProfileLoaded);
  const logout = useUserStore((state) => state.logout);
  const [mounted, setMounted] = React.useState(false);
  const [patientCoins, setPatientCoins] = React.useState<number | null>(null);

  const refreshCoins = React.useCallback(() => {
    if (user?.role === "patient" || !user?.role) {
      walletClient
        .getWalletMe()
        .then((data) => setPatientCoins(data.coin_balance))
        .catch(() => {
          setPatientCoins(0);
        });
    }
  }, [user?.role]);

  React.useEffect(() => {
    setMounted(true);
    refreshCoins();

    if (typeof window !== "undefined") {
      const handleWalletRefresh = () => {
        refreshCoins();
      };
      window.addEventListener("wallet:refresh", handleWalletRefresh);
      return () => {
        window.removeEventListener("wallet:refresh", handleWalletRefresh);
      };
    }
  }, [refreshCoins]);

  const getEffectiveRole = (): UserRole => {
    // 1. Pathname check is 100% deterministic on BOTH Server (SSR) and Client!
    if (pathname?.startsWith("/admin")) return "admin";
    if (pathname?.startsWith("/counselor")) return "counselor";
    if (pathname?.startsWith("/listener")) return "peer_listener";
    if (pathname?.startsWith("/patient")) return "patient";

    // 2. Cookie check only after mounted (never during initial client hydration)
    if (mounted && typeof document !== "undefined") {
      const match = document.cookie.match(/tb_user_role=([^;]+)/);
      if (match && match[1]) {
        const roleMap: Record<string, UserRole> = {
          pasien: "patient",
          patient: "patient",
          relawan: "peer_listener",
          peer_listener: "peer_listener",
          psikolog: "counselor",
          counselor: "counselor",
          admin: "admin",
        };
        if (roleMap[match[1]]) {
          return roleMap[match[1]];
        }
      }
    }
    return mounted && user?.role ? user.role : "patient";
  };

  const currentRole = getEffectiveRole();
  const menuConfig = getMenuItemsByRole(currentRole);

  const activeUrl = React.useMemo(() => {
    if (!pathname) return null;
    const currentPath = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
    const allNavItems = [...menuConfig.mainItems, ...menuConfig.utilityItems];
    return allNavItems
      .filter((item) => {
        const itemPath = item.url.length > 1 && item.url.endsWith("/") ? item.url.slice(0, -1) : item.url;
        return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
      })
      .reduce<string | null>((longest, item) => {
        if (!longest) return item.url;
        return item.url.length > longest.length ? item.url : longest;
      }, null);
  }, [menuConfig, pathname]);

  const defaultFallbackUser = mockUsers[currentRole] || mockUsers.patient;

  const displayName = mounted
    ? user.fullName || defaultFallbackUser.fullName
    : defaultFallbackUser.fullName;
  const displayInitials = mounted
    ? user.avatarInitials || defaultFallbackUser.avatarInitials
    : defaultFallbackUser.avatarInitials;

  // Handler auto-close sidebar pada mobile dan tablet (< 1024px)
  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleLogout = async () => {
    handleNavClick();
    try {
      await authService.logout();
    } catch {
      // Ignore network errors on logout
    }
    logout();
    window.location.href = "/login";
  };

  const getPortalHome = () => {
    switch (currentRole) {
      case "counselor":
        return "/counselor/beranda";
      case "peer_listener":
        return "/listener/beranda";
      case "admin":
        return "/admin/beranda";
      case "patient":
      default:
        return "/patient/beranda";
    }
  };

  const getSettingsUrl = () => {
    switch (currentRole) {
      case "counselor":
        return "/counselor/settings";
      case "peer_listener":
        return "/listener/settings";
      case "admin":
        return "/admin/settings";
      case "patient":
      default:
        return "/patient/settings";
    }
  };

  const renderRoleBadge = () => {
    switch (currentRole) {
      case "counselor":
        return (
          <div className="flex items-center gap-1.5 text-[11px] text-purple-700 dark:text-purple-300 font-nunito font-semibold">
            <Stethoscope size={12} className="shrink-0" />
            <span className="truncate">{menuConfig.badgeLabel}</span>
          </div>
        );
      case "peer_listener":
        return (
          <div className="flex items-center gap-1.5 text-[11px] text-sky-700 dark:text-sky-300 font-nunito font-semibold">
            <Headphones size={12} className="shrink-0" />
            <span className="truncate">{menuConfig.badgeLabel}</span>
          </div>
        );
      case "admin":
        return (
          <div className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300 font-nunito font-semibold">
            <ShieldAlert size={12} className="shrink-0" />
            <span className="truncate">{menuConfig.badgeLabel}</span>
          </div>
        );
      case "patient":
      default:
        return (
          <div className="flex items-center gap-1.5 text-[11px] text-teal-700 dark:text-teal-300 font-nunito">
            <ShieldCheck size={12} className="shrink-0" />
            <span className="truncate">{menuConfig.badgeLabel}</span>
          </div>
        );
    }
  };

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

  return (
    <Sidebar className="border-r border-slate-200/90 dark:border-slate-800 !bg-white dark:!bg-slate-900 text-slate-900 dark:text-slate-100 font-nunito select-none transition-colors duration-200">
      {/* 1. Header Logo */}
      <SidebarHeader className="p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <Link
          href={getPortalHome()}
          onClick={handleNavClick}
          className="flex items-center px-1 hover:opacity-85 transition-opacity"
        >
          <Logo size="md" showTagline />
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3 py-2 space-y-3 bg-white dark:bg-slate-900">
        {/* 2. User Profile Card with Dynamic Role */}
        <SidebarGroup className="p-0">
          {!mounted || !isProfileLoaded ? (
            <div className="flex items-center justify-between p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60">
              <div className="flex items-center gap-3 min-w-0">
                <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                <div className="min-w-0 space-y-1.5">
                  <Skeleton className="h-4 w-28 rounded" />
                  <Skeleton className="h-3 w-20 rounded" />
                </div>
              </div>
            </div>
          ) : (
            <Link
              href={getSettingsUrl()}
              onClick={handleNavClick}
              className="flex items-center justify-between p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 hover:bg-teal-50/50 dark:hover:bg-slate-800 hover:border-teal-200 dark:hover:border-teal-700 transition-all duration-150 group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-full font-bold text-xs flex items-center justify-center border shrink-0 font-heading shadow-2xs ${getAvatarBgClass()}`}
                >
                  {displayInitials}
                </div>
                <div className="min-w-0 space-y-0.5">
                  <p className="font-heading font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate group-hover:text-teal-800 dark:group-hover:text-teal-300 transition-colors">
                    {displayName}
                  </p>
                  {renderRoleBadge()}
                </div>
              </div>

              <ChevronRight size={14} className="text-slate-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 shrink-0 transition-colors" />
            </Link>
          )}
        </SidebarGroup>

        {/* 3. Main Navigation */}
        <SidebarGroup className="p-0 space-y-1">
          <SidebarGroupLabel className="text-[11px] font-bold px-3 py-1 text-slate-400 dark:text-slate-500 uppercase tracking-wider font-heading">
            {currentRole === "patient" ? "Menu Konseling" : `Portal ${menuConfig.roleTitle}`}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {menuConfig.mainItems.map((item) => {
                const isActive = item.url === activeUrl;
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
            Dukungan & Fitur
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {menuConfig.utilityItems.map((item) => {
                const isActive = item.url === activeUrl;
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

      {/* 5. Footer: Dynamic Wallet / Mode Status & Logout */}
      <SidebarFooter className="p-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
        {/* Dynamic Footer Card based on Role */}
        {currentRole === "counselor" ? (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800">
            <Link
              href="/counselor/earnings"
              onClick={handleNavClick}
              className="flex items-center gap-2.5 hover:opacity-85 transition-opacity min-w-0"
            >
              <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/80 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0 border border-purple-200 dark:border-purple-700">
                <Wallet size={16} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-purple-700 dark:text-purple-300 font-semibold uppercase tracking-wider">
                  Honor & Payout
                </span>
                <span className="text-xs sm:text-sm font-bold text-purple-900 dark:text-purple-200 font-heading truncate">
                  Pencairan Dana
                </span>
              </div>
            </Link>
          </div>
        ) : currentRole === "peer_listener" ? (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-sky-50/70 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800">
            <Link
              href="/listener/earnings"
              onClick={handleNavClick}
              className="flex items-center gap-2.5 hover:opacity-85 transition-opacity min-w-0"
            >
              <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-900/80 text-sky-700 dark:text-sky-300 flex items-center justify-center shrink-0 border border-sky-200 dark:border-sky-700">
                <Wallet size={16} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-sky-700 dark:text-sky-300 font-semibold uppercase tracking-wider">
                  Honor & Payout
                </span>
                <span className="text-xs sm:text-sm font-bold text-sky-900 dark:text-sky-200 font-heading truncate">
                  Pencairan Dana
                </span>
              </div>
            </Link>
          </div>
        ) : currentRole === "admin" ? (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/80 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 border border-amber-200 dark:border-amber-700">
                <ShieldAlert size={16} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold uppercase tracking-wider">
                  Akses Sistem
                </span>
                <span className="text-xs font-bold text-amber-900 dark:text-amber-200 font-heading">
                  Super Administrator
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80">
            <Link
              href="/patient/top-up"
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
                {patientCoins === null ? (
                  <Skeleton className="h-4 w-16 rounded mt-0.5" />
                ) : (
                  <span className="text-xs sm:text-sm font-bold text-teal-800 dark:text-teal-300 font-heading truncate">
                    {patientCoins} Koin
                  </span>
                )}
              </div>
            </Link>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/patient/top-up" onClick={handleNavClick}>
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
        )}

        {/* Logout Row */}
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-400 transition-colors cursor-pointer group text-left"
        >
          <LogOut size={16} className="text-slate-400 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors" />
          <span>Keluar dari Akun</span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
