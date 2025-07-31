"use client"

import Image from "next/image"
import { useState } from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarSeparator,
} from "@/components/ui/sidebar"
import { mainItems, utilityItems } from "@/constant/menu-sidebar"
import { Coins, Plus, WalletMinimal } from "lucide-react"
import Link from "next/link"
import { LiaPowerOffSolid } from "react-icons/lia"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export function AppSidebar() {
    const [activeItem, setActiveItem] = useState("Beranda")

    return (
        <Sidebar className="border-r border-accent !bg-white ">
            <SidebarHeader className="p-3">
                <div className="flex items-center gap-2 px-2">
                    <Image
                        src="/images/icon.png"
                        alt="TemanBicara Logo"
                        width={40}
                        height={40}
                        className="object-contain"
                    />
                    <span className="font-heading font-bold text-lg text-foreground">TemanBicara</span>
                </div>
            </SidebarHeader>

            <SidebarContent className="px-2">
                {/* User Profile Section */}
                <SidebarGroup>
                    <div className="flex items-center gap-3 px-3 py-3 mb-2 bg-background border border-secondary-background rounded-xl mx-2 overflow-hidden">
                        <Avatar>
                            <AvatarImage src="/images/avatar-placeholder.png" alt="User" />
                            <AvatarFallback className="bg-primary/20 text-foreground">TB</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0 overflow-hidden">
                            <span className="font-medium text-foreground text-sm truncate">Matthew Johnson</span>
                            <div className="flex items-center gap-1">
                                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs py-0 h-5">
                                    Premium
                                </Badge>
                            </div>
                        </div>
                    </div>
                </SidebarGroup>

                {/* Main Navigation */}
                <SidebarGroup>
                    <SidebarGroupLabel className="text-xs font-semibold px-3 text-primary">Menu</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {mainItems.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={activeItem === item.title}
                                        onClick={() => setActiveItem(item.title)}
                                    >
                                        <Link href={item.url} className="flex flex-col items-start gap-0 py-2 text-sm !text-foreground">
                                            <div className="flex items-center w-full">
                                                <item.icon className={`${activeItem === item.title ? "text-primary" : ""} mr-2 w-4.5 h-4.5`} />
                                                <span className="font-medium">{item.title}</span>
                                            </div>
                                            <span className="text-xs text-muted-foreground pl-6 truncate">{item.description}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                    {item.badge && (
                                        <SidebarMenuBadge className="bg-primary text-primary-foreground">
                                            {item.badge}
                                        </SidebarMenuBadge>
                                    )}
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
                <div className="px-3">
                    <SidebarSeparator className="border-background bg-primary/20" />
                </div>
                {/* Utility Navigation */}
                <SidebarGroup>
                    <SidebarGroupLabel className="text-xs font-semibold px-3 text-primary">Utilitas</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {utilityItems.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={activeItem === item.title}
                                        onClick={() => setActiveItem(item.title)}
                                    >
                                        <Link href={item.url} className="flex items-center text-sm !text-foreground">
                                            <item.icon className={`${activeItem === item.title ? "text-primary" : ""} mr-2 w-4.5 h-4.5`} />
                                            <span>{item.title}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className=" p-3 ">
                <div className="flex items-center justify-between bg-background p-3 rounded-xl border border-secondary-background">
                    <div className="flex items-center justify-between gap-2 text-foreground w-full">
                        <div className="flex items-center gap-3">
                            <WalletMinimal size={18} />
                            <div className="flex flex-col">
                                <span className="text-xs font-medium ">Saldo</span>
                                <span className="text-sm font-bold text-primary">60 coin</span>
                            </div>
                        </div>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="secondary" size="icon" className="relative !text-foreground cursor-pointer">
                                        <Plus className="size-5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Top Up</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </div>
                {/* Logout */}
                <a href="/logout" className="flex items-center gap-2">
                    <Button variant="secondary" size="icon" className="relative !text-foreground">
                        <LiaPowerOffSolid className="size-5" />
                    </Button>
                    <p className="font-nunito text-foreground font-semibold">Logout</p>
                </a>
            </SidebarFooter>
        </Sidebar>
    )
}