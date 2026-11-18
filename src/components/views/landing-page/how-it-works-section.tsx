import React from "react";
import Link from "next/link";
import Layouts from "@/components/shared/layouts";
import { Button } from "@/components/ui/button";
import { ArrowRight, UserPlus, Coins, CalendarCheck, MessageCircle } from "lucide-react";

const steps = [
  {
    icon: UserPlus,
    title: "Daftar Akun",
    desc: "Buat akun pasien dengan email atau Google. Kamu bisa memakai nama samaran.",
  },
  {
    icon: Coins,
    title: "Isi Koin",
    desc: "Top-up koin lewat Midtrans (VA, QRIS, e-wallet). Koin dipakai untuk membayar sesi.",
  },
  {
    icon: CalendarCheck,
    title: "Pilih Psikolog & Jadwal",
    desc: "Telusuri profil psikolog terverifikasi, lihat tarif dan ulasannya, lalu pilih slot yang kosong.",
  },
  {
    icon: MessageCircle,
    title: "Mulai Sesi Privat",
    desc: "Masuk ke ruang sesi saat jadwal tiba. Chat teks, gambar, dan pesan suara, lalu beri ulasan setelahnya.",
  },
];

export default function HowItWorksSection() {
  return (
    <div className="relative py-12 md:py-20 bg-slate-50/50 dark:bg-slate-950/60 border-y border-slate-200/80 dark:border-slate-800">
      <Layouts className="space-y-10 md:space-y-14">
        <div className="text-center max-w-2xl mx-auto space-y-3 px-4">
          <span className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">Cara Kerja</span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold font-heading text-slate-900 dark:text-white leading-tight">
            4 Langkah dari Daftar sampai Sesi
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-nunito leading-relaxed">
            Alur yang sama persis dengan yang berjalan di aplikasi, tanpa langkah tersembunyi.
          </p>
        </div>

        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {steps.map(({ icon: Icon, title, desc }, i) => (
            <li
              key={title}
              className="space-y-3 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
                  <Icon size={18} />
                </div>
                <span className="text-xs font-bold text-slate-400 font-heading">0{i + 1}</span>
              </div>
              <h3 className="text-base font-bold font-heading text-slate-900 dark:text-white">{title}</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-nunito leading-relaxed">{desc}</p>
            </li>
          ))}
        </ol>

        <div className="flex justify-center">
          <Link href="/register">
            <Button size="lg" className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl px-8 font-semibold cursor-pointer gap-2">
              Mulai Perjalanan Pemulihanmu
              <ArrowRight size={17} />
            </Button>
          </Link>
        </div>
      </Layouts>
    </div>
  );
}
