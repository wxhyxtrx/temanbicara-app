import React from "react";
import Layouts from "@/components/shared/layouts";
import { Card, CardContent } from "@/components/ui/card";
import { Brain, MessageSquareHeart, ShieldCheck, Activity, CheckCircle } from "lucide-react";

export default function FeaturesSection() {
  const clinicalPillars = [
    {
      icon: <Brain className="w-6 h-6 text-teal-600 dark:text-teal-400" />,
      tag: "Sesi 1-on-1 Terstruktur",
      title: "Konsultasi Psikolog Klinis",
      description:
        "Sesi mendalam bersama psikolog berlisensi resmi (SIPPK). Pendekatan berbasis bukti ilmiah seperti CBT, ACT, dan Mindfulness untuk mengatasi kecemasan, burnout, depresi, atau krisis hidup.",
      features: [
        "Psikolog tersumpah & anggota HIMPSI",
        "Chat privat dengan gambar & pesan suara",
        "Rencana pemulihan terarah",
      ],
      highlight: true,
    },
    {
      icon: <MessageSquareHeart className="w-6 h-6 text-teal-600 dark:text-teal-400" />,
      tag: "Dukungan Sebaya",
      title: "Curhat dengan Pendengar Sebaya",
      description:
        "Ruang katarsis saat pikiran terasa penuh. Relawan pendengar terlatih dengan kerangka Psychological First Aid (PFA) siap mendengarkan dan memvalidasi emosimu tanpa penghakiman.",
      features: [
        "Relawan terlatih panduan PFA",
        "Diteruskan ke bantuan darurat 119 bila ada risiko",
        "Bebas meluapkan apa pun tanpa penghakiman",
      ],
      highlight: false,
    },
    {
      icon: <ShieldCheck className="w-6 h-6 text-teal-600 dark:text-teal-400" />,
      tag: "Jaminan Privasi Total",
      title: "Kerahasiaan & Anonimitas 100%",
      description:
        "Identitasmu sepenuhnya milikmu. Gunakan nama inisial atau samaran. Seluruh percakapan privat & rahasia, dilindungi standar kerahasiaan medis yang ketat.",
      features: [
        "Pilihan anonim penuh",
        "Tanpa riwayat yang dibagikan ke pihak ketiga",
        "Lingkungan aman bebas stigma sosial",
      ],
      highlight: false,
    },
    {
      icon: <Activity className="w-6 h-6 text-teal-600 dark:text-teal-400" />,
      tag: "Jadwal & Pembayaran",
      title: "Reservasi Fleksibel dengan Koin",
      description:
        "Pilih psikolog dan slot waktu yang cocok, bayar dengan koin yang di-top-up lewat Midtrans. Jadwal bisa diubah, dan koin dikembalikan sesuai kebijakan bila sesi dibatalkan.",
      features: [
        "Top-up koin via Midtrans",
        "Reschedule & refund otomatis",
        "Ulasan setelah sesi selesai",
      ],
      highlight: false,
    },
  ];

  return (
    <div className="space-y-16 md:space-y-24 py-6">
      <Layouts className="space-y-12">
        {/* Section Header */}
        <div className="flex flex-col items-center text-center max-w-3xl mx-auto space-y-4">
          <span className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-3.5 py-1.5 rounded-full border border-teal-200 dark:border-teal-800">
            Layanan & Pendekatan Konseling
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold font-heading text-slate-900 dark:text-white leading-tight">
            Pendekatan Holistik untuk Setiap Fase Kesehatan Mentalmu
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 font-nunito leading-relaxed">
            Tidak ada masalah yang terlalu sepele untuk didengar. Kami menyediakan spektrum dukungan lengkap, mulai dari pertolongan pertama hingga pendampingan klinis profesional.
          </p>
        </div>

        {/* 4 Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {clinicalPillars.map((pillar, idx) => (
            <Card
              key={idx}
              className={`rounded-2xl border transition-all duration-300 hover:shadow-lg ${
                pillar.highlight
                  ? "bg-gradient-to-br from-teal-50/60 via-white to-emerald-50/30 dark:from-teal-950/50 dark:via-slate-900 dark:to-emerald-950/20 border-teal-200 dark:border-teal-800 shadow-sm"
                  : "bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 hover:border-teal-200 dark:hover:border-teal-700"
              }`}
            >
              <CardContent className="p-6 sm:p-8 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-950/80 border border-teal-100 dark:border-teal-800 flex items-center justify-center">
                    {pillar.icon}
                  </div>
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {pillar.tag}
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-bold font-heading text-slate-900 dark:text-white">
                    {pillar.title}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 font-nunito leading-relaxed">
                    {pillar.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  {pillar.features.map((feat, fIdx) => (
                    <div key={fIdx} className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                      <CheckCircle size={15} className="text-teal-600 dark:text-teal-400 flex-shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </Layouts>
    </div>
  );
}
