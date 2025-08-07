import { Calendar, Home, MessageCircle, BookOpen, History, Settings, CreditCard, HelpCircle, LogOut, User, Coins } from "lucide-react"

// Menu items untuk sidebar
export const mainItems = [
    {
        title: "Beranda",
        description: "Ringkasan aktivitas dan statistik",
        url: "/beranda",
        icon: Home,
    },
    {
        title: "Teman Bicara",
        description: "Mulai percakapan dengan AI atau manusia",
        url: "/room",
        icon: MessageCircle,
        badge: "15",
    },
    {
        title: "Jadwal Bicara",
        description: "Atur dan lihat jadwal sesi",
        url: "/schedule",
        icon: Calendar,
    },
]

export const utilityItems = [
    {
        title: "Pengaturan Akun",
        description: "Profil, preferensi, dan notifikasi",
        url: "/settings",
        icon: Settings,
    },
    {
        title: "Top Up",
        description: "Top up coin akun",
        url: "/top-up",
        icon: Coins,
    },
    {
        title: "Pusat Bantuan",
        description: "FAQ dan kontak CS",
        url: "/help-center",
        icon: HelpCircle,
    },
]
