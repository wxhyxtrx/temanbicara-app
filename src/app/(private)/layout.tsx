"use client"

import { AppSidebar } from '@/components/shared/organisms/sidebarApp'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Bell, ShieldCheck, HeartPulse } from "lucide-react"
import React from 'react'
import { usePathname } from 'next/navigation'
import { mainItems, utilityItems } from '@/constant/menu-sidebar'
import Link from 'next/link'
import { useUserStore } from '@/store/user-store'
import { NotificationDropdown } from '@/components/shared/organisms/notification-dropdown'
import { ThemeToggle } from '@/components/shared/atoms/theme-toggle'

export default function PrivateLayouts({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const user = useUserStore((state) => state.user)
    const [mounted, setMounted] = React.useState(false)

    React.useEffect(() => {
        setMounted(true)
    }, [])

    const displayName = mounted
        ? (user.fullName && user.fullName !== "Matthew Johnson" ? user.fullName : "Wahyu Tricahyo")
        : "Wahyu Tricahyo"
    
    const getPageTitle = () => {
        const allMenuItems = [...mainItems, ...utilityItems]
        const exact = allMenuItems.find(item => pathname === item.url)
        if (exact) return exact.title
        const currentMenuItem = allMenuItems.find(item => pathname.startsWith(`${item.url}/`))
        return currentMenuItem?.title || "TemanBicara"
    }
    
    return (
        <SidebarProvider>
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
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
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

                        <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
                            <div className="flex flex-col text-right">
                                <span className="text-xs font-semibold text-slate-800 dark:text-white leading-tight">{displayName}</span>
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-end gap-1">
                                    <ShieldCheck size={11} className="text-teal-600 dark:text-teal-400" /> Pasien Terverifikasi
                                </span>
                            </div>
                        </div>
                    </div>
                </header>
                
                <main className="px-3.5 sm:px-6 md:px-8 lg:px-10 py-6 w-full max-w-[1520px] mx-auto">
                    {children}
                </main>
            </SidebarInset>
        </SidebarProvider>
    )
}
