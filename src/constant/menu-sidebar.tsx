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
        url: "/chat",
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
        title: "Paket & Langganan",
        description: "Upgrade akun dan info pembayaran",
        url: "/subscription",
        icon: CreditCard,
    },
    {
        title: "Pusat Bantuan",
        description: "FAQ dan kontak CS",
        url: "/help",
        icon: HelpCircle,
    },
]
