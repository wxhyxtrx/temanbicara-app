import React from "react";
import Link from "next/link";
import { Mail, Phone, MapPin, ShieldCheck, HeartPulse } from "lucide-react";
import Layouts from "../layouts";
import { Logo } from "@/components/shared/atoms/Logo";

export default function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-400 pt-16 pb-12 border-t border-slate-800/80">
      <Layouts>
        <div className="space-y-12">
          {/* Main Footer Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-10">
            {/* Brand & Description (4 Cols) */}
            <div className="lg:col-span-5 space-y-4">
              <Logo variant="dark" showTagline size="lg" />
              <p className="text-xs sm:text-sm font-nunito text-slate-400 leading-relaxed max-w-sm pt-1">
                Suaka kesehatan mental dan platform konsultasi psikolog klinis berlisensi di Indonesia. Menyediakan ruang bercerita yang hangat, aman, dan tanpa penghakiman.
              </p>
              <div className="flex items-center gap-2 text-xs text-teal-400 font-medium pt-1">
                <ShieldCheck size={16} />
                <span>Kerahasiaan Berstandar Etika Psikologi (HIMPSI)</span>
              </div>
            </div>

            {/* Layanan Konseling (2 Cols) */}
            <div className="lg:col-span-2 space-y-3 font-heading">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                Layanan
              </h4>
              <ul className="space-y-2 text-xs font-nunito">
                <li>
                  <Link href="/login" className="hover:text-teal-400 transition-colors">
                    Konsultasi Psikolog
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="hover:text-teal-400 transition-colors">
                    Curhat AI 24/7
                  </Link>
                </li>
                <li>
                  <Link href="/schedule" className="hover:text-teal-400 transition-colors">
                    Jadwal Sesi
                  </Link>
                </li>
                <li>
                  <Link href="/top-up" className="hover:text-teal-400 transition-colors">
                    Paket Sesi
                  </Link>
                </li>
              </ul>
            </div>

            {/* Bantuan & Etika (2 Cols) */}
            <div className="lg:col-span-2 space-y-3 font-heading">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                Dukungan
              </h4>
              <ul className="space-y-2 text-xs font-nunito">
                <li>
                  <Link href="/help-center" className="hover:text-teal-400 transition-colors">
                    Pusat Bantuan & FAQ
                  </Link>
                </li>
                <li>
                  <a href="#" className="hover:text-teal-400 transition-colors">
                    Kebijakan Privasi
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-teal-400 transition-colors">
                    Syarat & Ketentuan
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-teal-400 transition-colors">
                    Standar Etika
                  </a>
                </li>
              </ul>
            </div>

            {/* Emergency Hotline (3 Cols) */}
            <div className="lg:col-span-3 space-y-3">
              <h4 className="text-sm font-bold text-white font-heading uppercase tracking-wider flex items-center gap-1.5">
                <HeartPulse size={16} className="text-rose-500" />
                Bantuan Darurat Krisis
              </h4>
              <p className="text-xs font-nunito text-slate-400 leading-relaxed">
                Jika kamu atau kerabatmu sedang mengalami krisis emosional akut atau ancaman keselamatan diri, segera hubungi saluran bantuan nasional:
              </p>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <p className="text-xs font-bold text-rose-400">Hotline Krisis Kemenkes RI</p>
                <p className="text-sm font-mono font-bold text-white">119 (ext. 8) / Bebas Pulsa</p>
                <p className="text-[11px] text-slate-500">Layanan SEJIWA 24 Jam</p>
              </div>
            </div>
          </div>

          {/* Clinical Ethics Disclaimer */}
          <div className="rounded-xl p-4 bg-slate-900/60 border border-slate-800 text-[11px] font-nunito text-slate-400 leading-relaxed">
            <span className="font-semibold text-slate-300">Pemberitahuan Medis: </span>
            TemanBicara menyediakan layanan konseling dan psikoterapi non-darurat. Layanan ini bukan pengganti instalasi gawat darurat psikiatri di rumah sakit. Percakapan dilindungi kerahasiaan konseling sesuai perundang-undangan dan kode etik profesi.
          </div>

          {/* Bottom Bar */}
          <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-nunito text-slate-400">
            <p>© {new Date().getFullYear()} TemanBicara. Seluruh Hak Cipta Dilindungi.</p>
            <p className="text-slate-400">Dibangun dengan empati untuk kesehatan mental Indonesia.</p>
          </div>
        </div>
      </Layouts>
    </footer>
  );
}
