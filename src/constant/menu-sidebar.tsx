import {
  Calendar,
  Home,
  MessageCircle,
  History,
  Settings,
  HelpCircle,
  Coins,
  Stethoscope,
  ClipboardList,
  Users,
  Wallet,
  Headphones,
  BookOpen,
  ShieldCheck,
  FileCheck2,
  SlidersHorizontal,
  AlertTriangle,
  LucideIcon,
} from "lucide-react";
import { UserRole } from "./mock-users";

export interface MenuItem {
  title: string;
  description: string;
  url: string;
  icon: LucideIcon;
  badge?: string;
}

export interface RoleMenuConfig {
  roleTitle: string;
  badgeLabel: string;
  mainItems: MenuItem[];
  utilityItems: MenuItem[];
}

export const roleMenuConfigs: Record<UserRole, RoleMenuConfig> = {
  patient: {
    roleTitle: "Pasien / Klien",
    badgeLabel: "Pasien Terverifikasi",
    mainItems: [
      {
        title: "Beranda",
        description: "Ringkasan emosi dan aktivitas",
        url: "/patient/beranda",
        icon: Home,
      },
      {
        title: "Teman Bicara",
        description: "Curhat AI & psikolog klinis",
        url: "/patient/room",
        icon: MessageCircle,
        badge: "15",
      },
      {
        title: "Jadwal Bicara",
        description: "Atur janji temu konseling",
        url: "/patient/schedule",
        icon: Calendar,
      },
    ],
    utilityItems: [
      {
        title: "Top Up Koin",
        description: "Beli saldo sesi konseling",
        url: "/patient/top-up",
        icon: Coins,
      },
      {
        title: "Mutasi & Riwayat",
        description: "Arus koin & invoice sesi",
        url: "/patient/top-up/history",
        icon: History,
      },
      {
        title: "Pengaturan Akun",
        description: "Profil dan privasi medis",
        url: "/patient/settings",
        icon: Settings,
      },
      {
        title: "Pusat Bantuan",
        description: "FAQ dan kontak darurat",
        url: "/help-center",
        icon: HelpCircle,
      },
    ],
  },
  counselor: {
    roleTitle: "Psikolog Klinis",
    badgeLabel: "Psikolog Berlisensi SIPPK",
    mainItems: [
      {
        title: "Beranda Praktik",
        description: "Ikhtisar jadwal & pasien aktif",
        url: "/counselor/beranda",
        icon: Home,
      },
      {
        title: "Ruang Konseling",
        description: "Sesi privat & catatan SOAP",
        url: "/counselor/room",
        icon: MessageCircle,
        badge: "Live",
      },
      {
        title: "Jadwal Konseling",
        description: "Konfirmasi & kalender sesi",
        url: "/counselor/schedule",
        icon: Calendar,
        badge: "Baru",
      },
      {
        title: "Catatan Klien",
        description: "Jurnal evaluasi dan rekam sesi",
        url: "/counselor/clients",
        icon: ClipboardList,
      },
    ],
    utilityItems: [
      {
        title: "Honor & Payout",
        description: "Pencairan dana & riwayat payout",
        url: "/counselor/earnings",
        icon: Wallet,
      },
      {
        title: "Pengaturan Praktik",
        description: "Profil SIPPK dan tarif sesi",
        url: "/counselor/settings",
        icon: Settings,
      },
      {
        title: "Pusat Bantuan",
        description: "Panduan etika klinis HIMPSI",
        url: "/help-center",
        icon: HelpCircle,
      },
    ],
  },
  peer_listener: {
    roleTitle: "Pendengar Sebaya",
    badgeLabel: "Relawan Empati Terlatih",
    mainItems: [
      {
        title: "Antrean Curhat",
        description: "Ruang penerimaan teman bicara",
        url: "/listener/beranda",
        icon: Headphones,
        badge: "Siaga",
      },
      {
        title: "Ruang Dengar",
        description: "Sesi percakapan aktif anonim",
        url: "/listener/queue",
        icon: MessageCircle,
      },
    ],
    utilityItems: [
      {
        title: "Honor & Payout",
        description: "Pencairan dana & riwayat payout",
        url: "/listener/earnings",
        icon: Wallet,
      },
      {
        title: "Panduan PFA",
        description: "Etika pendengar & eskalasi 119",
        url: "/listener/guidelines",
        icon: BookOpen,
      },
      {
        title: "Pengaturan Akun",
        description: "Profil relawan & preferensi",
        url: "/listener/settings",
        icon: Settings,
      },
      {
        title: "Pusat Bantuan",
        description: "Kontak koordinator pendengar",
        url: "/help-center",
        icon: HelpCircle,
      },
    ],
  },
  admin: {
    roleTitle: "Administrator",
    badgeLabel: "Platform Administrator",
    mainItems: [
      {
        title: "Beranda",
        description: "Statistik sistem & aktivitas",
        url: "/admin/beranda",
        icon: Home,
      },
      {
        title: "Manajemen Pengguna",
        description: "Daftar akun & verifikasi mitra",
        url: "/admin/users",
        icon: Users,
      },
      {
        title: "Eskalasi Krisis",
        description: "Alarm keselamatan & intervensi",
        url: "/admin/crisis-feed",
        icon: AlertTriangle,
        badge: "Kritis",
      },
    ],
    utilityItems: [
      {
        title: "Riwayat Transaksi",
        description: "Audit koin & pembayaran",
        url: "/admin/transactions",
        icon: History,
      },
      {
        title: "Pengaturan Sistem",
        description: "Konfigurasi tarif & fitur",
        url: "/admin/settings",
        icon: SlidersHorizontal,
      },
    ],
  },
};

export function getMenuItemsByRole(role: UserRole = "patient"): RoleMenuConfig {
  return roleMenuConfigs[role] || roleMenuConfigs.patient;
}

// Fallback legacy exports for backward compatibility
export const mainItems = roleMenuConfigs.patient.mainItems;
export const utilityItems = roleMenuConfigs.patient.utilityItems;
