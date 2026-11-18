"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Navbar, Footer } from "@/components/shared/organisms";
import { Search, FileText, ShieldCheck, HeartPulse, Phone, HeartHandshake, CalendarCheck, ArrowRight } from "lucide-react";
import { useUserStore } from "@/store/user-store";
import Link from "next/link";

// Jawaban disesuaikan dengan aturan yang benar-benar berjalan di kode (booking-utils, refund, reschedule, peer-tickets).
const faqCategories = [
  {
    id: "clinical",
    title: "Konseling dengan Psikolog",
    icon: <ShieldCheck size={18} className="text-teal-600 dark:text-teal-400" />,
    faqs: [
      {
        question: "Bagaimana psikolog di TemanBicara diverifikasi?",
        answer:
          "Saat mendaftar, psikolog wajib mengunggah dokumen izin praktik (SIPPK) dan dokumen pendukung dalam format PDF. Admin memeriksa dokumen tersebut, dan akun psikolog baru bisa menerima jadwal setelah disetujui.",
      },
      {
        question: "Berapa lama satu sesi konseling?",
        answer:
          "Satu sesi berlangsung 45 menit dalam bentuk chat privat (teks, gambar, dan pesan suara). Ruang sesi terbuka 10 menit sebelum jadwal. Kamu bisa mengajukan perpanjangan 10 menit, dan perpanjangan berlaku jika psikolog menyetujuinya.",
      },
      {
        question: "Bisakah saya memindahkan jadwal (reschedule)?",
        answer:
          "Bisa, maksimal 1 kali per sesi dan paling lambat 24 jam sebelum sesi dimulai, ke slot kosong milik psikolog yang sama. Jika kurang dari 24 jam, kamu bisa membatalkan sesi sesuai ketentuan refund.",
      },
      {
        question: "Bagaimana jika psikolog membatalkan jadwal?",
        answer:
          "Kamu akan mendapat notifikasi dan bisa memilih: pindah ke slot lain, atau refund koin 100%.",
      },
      {
        question: "Bagaimana dengan ulasan dan tip?",
        answer:
          "Setelah sesi selesai, kamu bisa memberi rating dan ulasan untuk psikolog. Kamu juga bisa memberi tip koin sebagai apresiasi (sekali per sesi).",
      },
    ],
  },
  {
    id: "peer",
    title: "Curhat Sebaya",
    icon: <HeartHandshake size={18} className="text-teal-600 dark:text-teal-400" />,
    faqs: [
      {
        question: "Apa bedanya Curhat Sebaya dengan konseling psikolog?",
        answer:
          "Curhat Sebaya adalah ruang bercerita dengan relawan pendengar yang dibekali panduan Psychological First Aid (PFA), tanpa biaya koin. Relawan bukan tenaga profesional: mereka mendengarkan dan menemani, bukan mendiagnosis atau memberi terapi. Untuk penanganan klinis, pesanlah sesi dengan psikolog.",
      },
      {
        question: "Berapa lama sesi Curhat Sebaya?",
        answer:
          "Setelah tiketmu diambil relawan, relawan harus menyapa dalam 10 menit. Sejak sapaan pertama, ruang obrolan aktif hingga 24 jam, lalu berubah menjadi hanya-baca.",
      },
      {
        question: "Apa yang terjadi jika ada tanda bahaya keselamatan?",
        answer:
          "Relawan dan psikolog dapat mengirim laporan krisis yang langsung masuk ke admin untuk ditindaklanjuti. Dalam keadaan darurat, segera hubungi layanan 119 ext. 8.",
      },
    ],
  },
  {
    id: "privacy-mode",
    title: "Kerahasiaan & Mode Anonim",
    icon: <ShieldCheck size={18} className="text-teal-600 dark:text-teal-400" />,
    faqs: [
      {
        question: "Siapa yang bisa membaca percakapan saya?",
        answer:
          "Isi sesi hanya bisa diakses oleh kamu dan psikolog atau relawan yang mendampingimu. Gambar dan pesan suara disimpan di penyimpanan privat dan dihapus otomatis setelah masa simpan berakhir.",
      },
      {
        question: "Bisakah saya memakai nama samaran?",
        answer:
          "Bisa. Aktifkan \"Mode Anonim Otomatis\" di Pengaturan Akun, maka namamu ditampilkan sebagai nama samaran. Di Curhat Sebaya, kamu juga bisa memakai alias untuk setiap tiket.",
      },
    ],
  },
  {
    id: "coins-packages",
    title: "Koin & Pembayaran",
    icon: <FileText size={18} className="text-teal-600 dark:text-teal-400" />,
    faqs: [
      {
        question: "Berapa koin untuk satu sesi?",
        answer:
          "Tarif ditentukan oleh masing-masing psikolog dan tampil di profilnya dalam satuan koin (1 koin = Rp10.000). Curhat Sebaya tidak memakai koin.",
      },
      {
        question: "Apakah koin bisa dikembalikan jika saya membatalkan sesi?",
        answer:
          "Bisa, sesuai kebijakan refund yang berlaku saat kamu memesan. Bawaannya: refund 100% jika dibatalkan 60 menit atau lebih sebelum sesi, 65% jika 30–60 menit sebelumnya, dan 0% jika kurang dari 30 menit.",
      },
      {
        question: "Bagaimana cara membeli koin?",
        answer:
          "Lewat menu Top Up Koin. Pembayaran diproses oleh Midtrans; metode yang tersedia (virtual account, QRIS, e-wallet, kartu) tampil di halaman pembayaran. Koin masuk otomatis setelah pembayaran terkonfirmasi. Situs demo ini memakai Midtrans mode sandbox, jadi tidak ada uang sungguhan yang ditarik.",
      },
    ],
  },
];

export default function PublicHelpCenterPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const user = useUserStore((state) => state.user);
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);

  const syncSession = useUserStore((state) => state.syncSession);

  useEffect(() => {
    let active = true;
    void syncSession({ silent: true }).then(() => {
      if (active) setMounted(true);
    });
    return () => { active = false; };
  }, [syncSession]);

  const getPortalHome = (role?: string) => {
    switch (role) {
      case "counselor":
      case "psikolog":
        return "/counselor/beranda";
      case "peer_listener":
      case "relawan":
        return "/listener/beranda";
      case "admin":
        return "/admin/beranda";
      case "patient":
      case "pasien":
      default:
        return "/patient/beranda";
    }
  };

  const getPortalLabel = (role?: string) => {
    switch (role) {
      case "counselor":
      case "psikolog":
        return "Ke Beranda Praktik";
      case "peer_listener":
      case "relawan":
        return "Ke Beranda Relawan";
      case "admin":
        return "Ke Beranda Admin";
      case "patient":
      case "pasien":
      default:
        return "Ke Beranda Pasien";
    }
  };

  const targetHref = mounted && isAuthenticated ? getPortalHome(user?.role) : "/";
  const targetLabel = mounted && isAuthenticated ? getPortalLabel(user?.role) : "Ke Halaman Utama";

  const query = searchQuery.trim().toLowerCase();
  const visibleCategories = faqCategories
    .map((c) => ({
      ...c,
      faqs: query ? c.faqs.filter((f) => `${f.question} ${f.answer}`.toLowerCase().includes(query)) : c.faqs,
    }))
    .filter((c) => c.faqs.length > 0);

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-nunito transition-colors duration-200">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-8">
        {/* 1. Page Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 dark:text-white tracking-tight">
              Pusat Bantuan
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Jawaban seputar sesi konseling, curhat sebaya, privasi, koin, dan kontak bantuan darurat
            </p>
          </div>

          {!mounted ? (
            <span role="status" className="text-xs text-slate-500 dark:text-slate-400">Memuat sesi...</span>
          ) : <Link href={targetHref} className="shrink-0">
            <Button className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs px-4 h-9 font-semibold gap-1.5 shadow-xs cursor-pointer">
              <span>{targetLabel}</span>
              <ArrowRight size={14} />
            </Button>
          </Link>}
        </div>

        {/* 2. Top Emergency Crisis Hotlines Banner */}
        <div className="rounded-2xl p-4 sm:p-5 bg-gradient-to-r from-rose-50 via-rose-50/70 to-white dark:from-rose-950/40 dark:via-rose-950/20 dark:to-slate-900 border border-rose-200/90 dark:border-rose-900/60 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
              <HeartPulse size={20} />
            </div>
            <div className="space-y-0.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold font-heading text-rose-950 dark:text-rose-100">
                  Layanan Bantuan Krisis Emosional Akut & Pencegahan Bunuh Diri
                </h3>
                <span className="text-[11px] font-bold text-rose-900 dark:text-rose-200 bg-rose-100 dark:bg-rose-900/80 border border-rose-300 dark:border-rose-700 px-2.5 py-0.5 rounded-full shrink-0 shadow-2xs">
                  24 Jam Bebas Pulsa
                </span>
              </div>
              <p className="text-xs text-rose-800 dark:text-rose-300 font-nunito leading-relaxed">
                Jika Anda atau seseorang yang Anda kenal sedang berada dalam krisis keselamatan jiwa, segera hubungi saluran bantuan nasional:
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-end md:self-center shrink-0">
            <a
              href="tel:119"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 !text-white font-bold text-xs sm:text-sm shadow-sm transition-all hover:scale-[1.02] cursor-pointer ring-1 ring-rose-700"
            >
              <Phone size={15} className="!text-white shrink-0 fill-white" />
              <span className="!text-white font-bold tracking-wide">Hotline Kemenkes: 119 (ext. 8)</span>
            </a>
            <a
              href="https://sejiwa.kemenkes.go.id"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-slate-800 !text-slate-900 dark:!text-slate-200 border border-rose-300 dark:border-rose-900/70 font-bold text-xs sm:text-sm shadow-2xs transition-colors"
            >
              <span className="!text-slate-900 dark:!text-slate-200 font-bold">Portal SEJIWA</span>
            </a>
          </div>
        </div>

        {/* 3. Search Bar (memfilter FAQ) */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400" size={17} />
          <Input
            aria-label="Cari pertanyaan"
            placeholder="Cari pertanyaan (contoh: reschedule, refund, anonim, curhat sebaya)..."
            className="pl-11 h-11 text-xs sm:text-sm bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 dark:text-slate-100 rounded-2xl shadow-xs focus-visible:ring-teal-600"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* 4. FAQ */}
        <div className="grid grid-cols-1 gap-6">
          {visibleCategories.length === 0 && (
            <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
              <CalendarCheck size={24} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              Tidak ada pertanyaan yang cocok dengan &quot;{searchQuery}&quot;.
            </div>
          )}
          {visibleCategories.map((category) => (
            <Card key={category.id} className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
              <CardHeader className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/80">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/80 border border-teal-200/70 dark:border-teal-800 flex items-center justify-center shrink-0">
                    {category.icon}
                  </div>
                  <div>
                    <CardTitle className="font-heading text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                      {category.title}
                    </CardTitle>
                    <CardDescription className="text-[11px] text-slate-500 dark:text-slate-400 font-nunito">
                      {category.faqs.length} pertanyaan
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-5 pt-2">
                <Accordion type="single" collapsible className="w-full">
                  {category.faqs.map((faq, index) => (
                    <AccordionItem key={index} value={`item-${index}`} className="border-b border-slate-100 dark:border-slate-800 last:border-b-0 py-1">
                      <AccordionTrigger className="text-left font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 hover:text-teal-700 dark:hover:text-teal-400 py-3 font-heading cursor-pointer">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-nunito pb-3">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
