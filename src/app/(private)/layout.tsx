"use client"

import { AppSidebar } from '@/components/shared/organisms/sidebarApp'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Bell } from "lucide-react"
import React from 'react'

export default function PrivateLayouts({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="bg-gradient-to-t from-secondary-background to-background min-h-screen">
                <div className="flex items-center p-4 justify-between">
                    <div className='flex items-center gap-5'>
                        <SidebarTrigger className="mr-2 p-4 bg-secondary-background hover:bg-primary/20" />
                        <h1 className="text-xl font-heading font-bold">Beranda</h1>
                    </div>
                </div>
                <div className='px-4 max-w-[1440px] mx-auto'>
                    {children}
                </div>
            </SidebarInset>
            
        </SidebarProvider>
    )
}
