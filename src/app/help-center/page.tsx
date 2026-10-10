"use client";

import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Navbar, Footer } from "@/components/shared/organisms";
import {
  Search,
  HelpCircle,
  MessageCircle,
  FileText,
  ShieldCheck,
  HeartPulse,
  Phone,
  Mail,
  Clock,
  Sparkles,
  BookOpen,
  CalendarCheck,
  Send,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { useUserStore } from "@/store/user-store";
import { useNotificationStore } from "@/store/notification-store";
import Link from "next/link";

export default function PublicHelpCenterPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [ticketSent, setTicketSent] = useState(false);
  const [mounted, setMounted] = useState(false);
  const user = useUserStore((state) => state.user);
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Kategori FAQ Konseling & Layanan Psikologi
  const faqCategories = [
    {
      id: "clinical",
      title: "Layanan Konseling & Psikolog",
      icon: <ShieldCheck size={18} className="text-teal-600 dark:text-teal-400" />,
      faqs: [
        {
          question: "Apakah seluruh psikolog di TemanBicara memiliki izin praktik resmi?",
          answer:
            "Ya, 100% psikolog yang berpraktik di TemanBicara adalah psikolog klinis tersumpah yang memiliki Surat Izin Praktik Psikologi Klinis (SIPPK) dan Surat Tanda Registrasi (STR) aktif dari Himpunan Psikologi Indonesia (HIMPSI). Profil dan nomor lisensi dapat diverifikasi secara transparan.",
        },
        {
          question: "Bagaimana kerahasiaan data dan isi percakapan saya dilindungi?",
          answer:
            "Setiap sesi dilindungi oleh Kode Etik Psikologi Indonesia dan enkripsi end-to-end berstandar data medis. Isi sesi tidak akan dibagikan kepada keluarga, atasan kantor, atau pihak ketiga mana pun tanpa persetujuan tertulis eksplisit dari Anda, kecuali dalam situasi darurat ancaman keselamatan jiwa (sesuai mandat hukum).",
        },
        {
          question: "Apa perbedaan antara Konseling Psikolog Klinis dan Curhat AI?",
          answer:
            "Sesi Psikolog Klinis adalah sesi psikoterapi profesional 60 menit (CBT, ACT, Mindfulness) untuk diagnosis, penanganan trauma, kecemasan, atau depresi. Sedangkan TemanBicara AI adalah pendamping emosi instan 24/7 berbasis Psychological First Aid (PFA) untuk meredakan luapan kepanikan, overthinking, atau katarsis ringan gratis sehari-hari.",
        },
        {
          question: "Bagaimana jika saya perlu menjadwalkan ulang (reschedule) sesi?",
          answer:
            "Anda dapat melakukan penjadwalan ulang bebas biaya maksimal sebelum waktu sesi dimulai melalui menu Jadwal > Detail Janji Temu. Koin Anda akan otomatis dikembalikan jika sesi dibatalkan.",
        },
      ],
    },
    {
      id: "privacy-mode",
      title: "Kerahasiaan & Mode Anonim",
      icon: <ShieldCheck size={18} className="text-teal-600 dark:text-teal-400" />,
      faqs: [
        {
          question: "Apakah saya bisa berkonsultasi secara anonim tanpa foto dan nama asli?",
          answer:
            "Sangat bisa. Anda dapat mengaktifkan 'Mode Anonim' di menu Ruang Chat atau Pengaturan. Nama Anda akan disamarkan menjadi inisial acak (Pengguna Anonim) di layar psikolog, dan Anda dapat memilih sesi via Voice Call atau Chat teks privat.",
        },
        {
          question: "Apakah saya bisa mengunduh atau menghapus riwayat konsultasi saya?",
          answer:
            "Ya, Anda memiliki kendali penuh atas data pribadi Anda. Kunjungi menu Pengaturan > Kerahasiaan Medis untuk mengunduh rekam ringkasan konseling atau mengajukan penghapusan riwayat transkrip secara permanen.",
        },
      ],
    },
    {
      id: "coins-packages",
      title: "Koin, Paket Sesi & Pembayaran",
      icon: <FileText size={18} className="text-teal-600 dark:text-teal-400" />,
      faqs: [
        {
          question: "Berapa koin yang dibutuhkan untuk satu sesi konseling?",
          answer:
            "Sesi konseling Chat Eksklusif 60 menit membutuhkan 15 Koin. Panggilan suara privat (Voice Call) bertarif 5 Koin per jam. Pendampingan chatbot TemanBicara AI dapat diakses 100% gratis 24 jam.",
        },
        {
          question: "Apakah koin yang saya miliki memiliki masa kedaluwarsa?",
          answer:
            "Tidak. Koin TemanBicara tidak memiliki masa kedaluwarsa dan tetap tersimpan aman di dompet akun Anda hingga Anda memutuskan menggunakannya untuk reservasi jadwal.",
        },
        {
          question: "Metode pembayaran apa saja yang didukung?",
          answer:
            "Kami mendukung Virtual Account otomatis (BCA, Mandiri, BNI), QRIS instan dari semua aplikasi perbankan, serta E-Wallet (GoPay, OVO, ShopeePay) dengan konfirmasi otomatis 24 jam.",
        },
      ],
    },
  ];

  // Panduan Pasien
  const guides = [
    {
      title: "Persiapan Menjelang Sesi Konseling Pertama",
      desc: "Langkah sederhana agar sesi terapi 60 menit bersama psikolog berjalan nyaman, tenang, dan efektif.",
      time: "3 menit baca",
      icon: <CalendarCheck className="text-teal-600 dark:text-teal-400" size={20} />,
    },
    {
      title: "Teknik Pernapasan 4-7-8 untuk Serangan Panik",
      desc: "Panduan relaksasi mandiri saat mengalami lonjakan kecemasan atau dada berdebar di malam hari.",
      time: "4 menit baca",
      icon: <HeartPulse className="text-teal-600 dark:text-teal-400" size={20} />,
    },
    {
      title: "Panduan Pemanfaatan Mode Anonim di Chat",
      desc: "Cara menyamarkan identitas dan menjaga privasi penuh selama sesi curhat dan telekonsultasi.",
      time: "2 menit baca",
      icon: <ShieldCheck className="text-teal-600 dark:text-teal-400" size={20} />,
    },
    {
      title: "Memahami Kode Etik Kerahasiaan Psikologi (HIMPSI)",
      desc: "Hak-hak hukum dan perlindungan privasi yang Anda miliki sebagai klien dalam layanan kesehatan jiwa.",
      time: "5 menit baca",
      icon: <BookOpen className="text-teal-600 dark:text-teal-400" size={20} />,
    },
  ];

  const handleSendTicket = (e: React.FormEvent) => {
    e.preventDefault();
    setTicketSent(true);

    useNotificationStore.getState().addNotification({
      title: "Tiket Bantuan Terkirim",
      message: "Pesan Anda telah diterima oleh tim koordinasi klinis TemanBicara.",
      type: "sistem",
      actionUrl: "/help-center",
    });

    setTimeout(() => setTicketSent(false), 3500);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-nunito transition-colors duration-200">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-8">
        {/* 1. Page Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 dark:text-white tracking-tight">
              Pusat Bantuan & Panduan Pasien
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Informasi seputar etika konseling, panduan terapi, regulasi privasi, dan kontak bantuan darurat
            </p>
          </div>

          {mounted && isAuthenticated && (
            <Link href="/patient/beranda">
              <Button className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs px-4 h-9 font-semibold gap-1.5 shadow-xs cursor-pointer">
                <span>Ke Beranda Pasien</span>
                <ArrowRight size={14} />
              </Button>
            </Link>
          )}
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

        {/* 3. Search Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400" size={17} />
          <Input
            placeholder="Ketik kata kunci bantuan (contoh: lisensi psikolog, reschedule, privasi anonim, top-up)..."
            className="pl-11 h-11 text-xs sm:text-sm bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 dark:text-slate-100 rounded-2xl shadow-xs focus-visible:ring-teal-600"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {ticketSent && (
          <div className="flex items-center gap-2 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold animate-in fade-in duration-200">
            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Pesan Anda telah diterima oleh tim koordinasi klinis. Kami akan membalas via email dalam 1x24 jam.</span>
          </div>
        )}

        {/* 4. Main Tabs Navigation */}
        <Tabs defaultValue="faq" className="w-full space-y-6">
          <TabsList className="bg-slate-100/90 dark:bg-slate-900 p-1 rounded-xl flex w-full sm:w-auto overflow-x-auto justify-start border border-slate-200/80 dark:border-slate-800">
            <TabsTrigger
              value="faq"
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-teal-800 dark:data-[state=active]:text-teal-300 text-slate-600 dark:text-slate-400 data-[state=active]:shadow-xs rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <HelpCircle size={15} />
              <span>Pertanyaan Umum (FAQ)</span>
            </TabsTrigger>
            <TabsTrigger
              value="guides"
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-teal-800 dark:data-[state=active]:text-teal-300 text-slate-600 dark:text-slate-400 data-[state=active]:shadow-xs rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <BookOpen size={15} />
              <span>Panduan Pasien</span>
            </TabsTrigger>
            <TabsTrigger
              value="contact"
              className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:text-teal-800 dark:data-[state=active]:text-teal-300 text-slate-600 dark:text-slate-400 data-[state=active]:shadow-xs rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <MessageCircle size={15} />
              <span>Bantuan Layanan & Tiket</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: FAQ ACCORDION */}
          <TabsContent value="faq" className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              {faqCategories.map((category) => (
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
                          Jawaban terstandarisasi etika konseling TemanBicara
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
          </TabsContent>

          {/* TAB 2: PATIENT GUIDES */}
          <TabsContent value="guides">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {guides.map((guide, idx) => (
                <Card key={idx} className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-teal-200 dark:hover:border-teal-700 transition-all cursor-pointer group">
                  <CardContent className="p-4 sm:p-5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/80 border border-teal-200/60 dark:border-teal-800 flex items-center justify-center">
                        {guide.icon}
                      </div>
                      <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 text-[10px] font-mono">
                        {guide.time}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-heading font-bold text-sm text-slate-900 dark:text-white group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors">
                        {guide.title}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-nunito">
                        {guide.desc}
                      </p>
                    </div>
                    <div className="pt-2 flex items-center text-xs font-semibold text-teal-700 dark:text-teal-400 group-hover:translate-x-1 transition-transform">
                      <span>Baca Panduan Selengkapnya →</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* TAB 3: CONTACT FORM & TICKETS */}
          <TabsContent value="contact">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Form Pengajuan Tiket */}
              <Card className="lg:col-span-7 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
                <CardHeader className="p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/80">
                  <CardTitle className="font-heading text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    Kirim Pertanyaan / Keluhan Layanan
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 dark:text-slate-400 font-nunito">
                    Tim koordinasi klinis TemanBicara akan menindaklanjuti pesanmu dalam 1x24 jam kerja
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-5">
                  <form onSubmit={handleSendTicket} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nama Pasien</label>
                        <Input
                          defaultValue={mounted && user.fullName ? user.fullName : ""}
                          placeholder="Nama lengkap Anda"
                          className="h-9 text-xs sm:text-sm bg-slate-50/50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 dark:text-slate-100 rounded-xl"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Alamat Email</label>
                        <Input
                          type="email"
                          defaultValue={mounted && user.email ? user.email : ""}
                          placeholder="email@anda.com"
                          className="h-9 text-xs sm:text-sm bg-slate-50/50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 dark:text-slate-100 rounded-xl"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Subjek Keluhan</label>
                      <Input
                        placeholder="Contoh: Kendala panggilan suara, pertanyaan jadwal, refund koin"
                        className="h-9 text-xs sm:text-sm bg-slate-50/50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 dark:text-slate-100 rounded-xl"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Detail Pesan / Pertanyaan</label>
                      <textarea
                        rows={4}
                        placeholder="Deskripsikan kendala yang kamu alami secara rinci..."
                        className="w-full p-3 text-xs sm:text-sm bg-slate-50/50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-1 focus:ring-teal-600 font-nunito resize-none"
                        required
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl py-2 h-10 text-xs sm:text-sm shadow-xs cursor-pointer gap-2"
                    >
                      <Send size={14} />
                      <span>Kirim Tiket Bantuan</span>
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Saluran Bantuan Langsung */}
              <div className="lg:col-span-5 space-y-4">
                <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs p-4 sm:p-5 space-y-4">
                  <h4 className="font-heading font-bold text-sm text-slate-900 dark:text-white">
                    Saluran Bantuan Langsung
                  </h4>

                  <div className="space-y-3 text-xs">
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                      <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 shrink-0">
                        <MessageCircle size={16} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white font-heading">WhatsApp Layanan Klien</p>
                        <p className="text-slate-500 dark:text-slate-400 text-[11px]">Respon dalam 15-30 menit</p>
                        <a
                          href="https://wa.me/6281234567890"
                          target="_blank"
                          rel="noreferrer"
                          className="text-teal-700 dark:text-teal-400 font-semibold text-xs hover:underline mt-1 inline-block"
                        >
                          +62 812-3456-7890 (Chat)
                        </a>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                      <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 shrink-0">
                        <Mail size={16} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white font-heading">Email Dukungan Medis</p>
                        <p className="text-slate-500 dark:text-slate-400 text-[11px]">Konsultasi & keluhan akun</p>
                        <a
                          href="mailto:bantuan@temanbicara.id"
                          className="text-teal-700 dark:text-teal-400 font-semibold text-xs hover:underline mt-1 inline-block"
                        >
                          bantuan@temanbicara.id
                        </a>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                      <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 shrink-0">
                        <Clock size={16} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white font-heading">Jam Operasional Layanan</p>
                        <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                          Senin – Minggu: 08:00 – 22:00 WIB<br />
                          <strong className="text-teal-700 dark:text-teal-400">TemanBicara AI: Siaga 24 Jam Nonstop</strong>
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <Footer />
    </div>
  );
}
