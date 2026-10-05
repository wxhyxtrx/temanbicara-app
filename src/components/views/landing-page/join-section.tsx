import React from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ShieldCheck, HeartHandshake, CheckCircle2, ArrowRight, Lock, Award } from "lucide-react";

export default function JoinSection() {
  return (
    <section className="relative py-16 md:py-24 bg-gradient-to-b from-teal-900 via-teal-950 to-slate-950 text-white overflow-hidden">
      {/* Decorative soothing ambient circles */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-10 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10 space-y-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left: Empathetic Call to Action */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-800/60 border border-teal-700/60 text-teal-200 text-xs font-semibold backdrop-blur-md">
              <HeartHandshake size={15} className="text-teal-300" />
              <span>Langkah Awal Menuju Ketenangan Pikiran</span>
            </div>

            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold font-heading leading-tight tracking-tight text-white">
              Kamu Tidak Harus Menghadapi Semua Beban Sendirian
            </h2>

            <p className="text-teal-100/80 text-base md:text-lg font-nunito leading-relaxed max-w-xl mx-auto lg:mx-0">
              Merasa lelah, cemas, atau hampa adalah sinyal alami bahwa tubuh dan jiwamu butuh didengar. Beri dirimu ruang aman tanpa penghakiman bersama para profesional yang siap mendampingi.
            </p>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-center lg:justify-start gap-2.5 text-xs text-teal-200">
                <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
                <span>Konsultasi online fleksibel dari kenyamanan kamarmu</span>
              </div>
              <div className="flex items-center justify-center lg:justify-start gap-2.5 text-xs text-teal-200">
                <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
                <span>Privasi terproteksi penuh tanpa data dibocorkan</span>
              </div>
              <div className="flex items-center justify-center lg:justify-start gap-2.5 text-xs text-teal-200">
                <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
                <span>Opsi pendampingan AI instan saat butuh teman bicara malam hari</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-center lg:justify-start gap-4 pt-4">
              <Link href="/register">
                <Button size="lg" className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl px-8 py-6 text-base shadow-lg shadow-emerald-500/20 cursor-pointer gap-2">
                  Daftar & Mulai Konseling
                  <ArrowRight size={17} />
                </Button>
              </Link>
              <Link href="/help-center">
                <Button size="lg" variant="outline" className="w-full sm:w-auto border-teal-700/80 bg-teal-900/40 text-teal-100 hover:bg-teal-800/60 rounded-xl px-6 py-6 text-base cursor-pointer">
                  Pusat Bantuan & FAQ
                </Button>
              </Link>
            </div>
          </div>

          {/* Right: Modern Clinical Trust Card */}
          <div className="lg:col-span-5">
            <div className="relative rounded-3xl p-6 sm:p-8 bg-gradient-to-b from-teal-800/40 to-teal-900/60 border border-teal-700/50 backdrop-blur-xl shadow-2xl space-y-6">
              <div className="flex items-center gap-3 border-b border-teal-700/50 pb-4">
                <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold font-heading text-white">Komitmen Etika & Keamanan</h3>
                  <p className="text-xs text-teal-300/80">Kerahasiaan Klien Adalah Prioritas Utama</p>
                </div>
              </div>

              <div className="space-y-4 text-xs font-nunito text-teal-100/90 leading-relaxed">
                <p>
                  Seluruh psikolog dan konselor di TemanBicara terikat secara hukum pada kode etik kerahasiaan profesi psikologi (HIMPSI). Kami menjamin percakapan tidak direkam secara publik dan identitasmu dapat disamarkan 100%.
                </p>
                <div className="p-3.5 rounded-xl bg-teal-950/60 border border-teal-800/70 space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-300 font-semibold text-xs">
                    <Lock size={14} />
                    <span>Enkripsi Berlapis End-to-End</span>
                  </div>
                  <p className="text-[11px] text-teal-200/70">
                    Data transmisi sesi dilindungi enkripsi standar SSL/TLS 256-bit berstandar perlindungan data medis.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between text-xs text-teal-300">
                <span className="flex items-center gap-1.5">
                  <Award size={15} /> Layanan Tersertifikasi
                </span>
                <span className="font-semibold text-emerald-400">Verifikasi Resmi</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Pillars Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 pt-4 text-center">
          <div className="bg-teal-900/40 border border-teal-800/60 backdrop-blur-sm p-4 sm:p-5 rounded-2xl">
            <p className="text-2xl sm:text-3xl font-bold font-heading text-white">12.000+</p>
            <p className="text-xs sm:text-sm text-teal-300 font-nunito mt-1">Individu Terbantu</p>
          </div>
          <div className="bg-teal-900/40 border border-teal-800/60 backdrop-blur-sm p-4 sm:p-5 rounded-2xl">
            <p className="text-2xl sm:text-3xl font-bold font-heading text-white">100%</p>
            <p className="text-xs sm:text-sm text-teal-300 font-nunito mt-1">Privasi Terjaga</p>
          </div>
          <div className="bg-teal-900/40 border border-teal-800/60 backdrop-blur-sm p-4 sm:p-5 rounded-2xl">
            <p className="text-2xl sm:text-3xl font-bold font-heading text-white">24/7</p>
            <p className="text-xs sm:text-sm text-teal-300 font-nunito mt-1">Dukungan Siaga</p>
          </div>
          <div className="bg-teal-900/40 border border-teal-800/60 backdrop-blur-sm p-4 sm:p-5 rounded-2xl">
            <p className="text-2xl sm:text-3xl font-bold font-heading text-white">4.9★</p>
            <p className="text-xs sm:text-sm text-teal-300 font-nunito mt-1">Kepuasan Klien</p>
          </div>
        </div>
      </div>
    </section>
  );
}
