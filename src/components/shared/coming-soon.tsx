"use client";

import React from "react";
import Link from "next/link";
import { LucideIcon, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface ComingSoonProps {
  icon: LucideIcon;
  title: string;
  description: string;
  badge?: string;
  backHref?: string;
  backLabel?: string;
}

export function ComingSoon({
  icon: Icon,
  title,
  description,
  badge = "Segera Hadir",
  backHref = "/counselor/beranda",
  backLabel = "Kembali ke Beranda Praktik",
}: ComingSoonProps) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center py-12 px-4 font-nunito text-slate-900 dark:text-slate-100">
      <div className="w-full max-w-xl mx-auto text-center space-y-6">
        {/* Glow Icon */}
        <div className="relative inline-flex items-center justify-center">
          <div className="absolute inset-0 bg-teal-500/20 dark:bg-teal-400/10 rounded-full blur-xl transform scale-150 pointer-events-none" />
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-teal-50 dark:bg-teal-950/70 border border-teal-200/80 dark:border-teal-800 text-teal-600 dark:text-teal-400 flex items-center justify-center shadow-xs">
            <Icon size={40} className="sm:w-11 sm:h-11" />
          </div>
        </div>

        {/* Badge & Title */}
        <div className="space-y-3">
          <div className="inline-flex">
            <Badge className="bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800 text-xs px-3 py-1 font-semibold">
              {badge}
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-slate-900 dark:text-white tracking-tight">
            {title}
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-lg mx-auto">
            {description}
          </p>
        </div>

        {/* Small Notice Box */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
          Fitur ini hadir bersama integrasi sistem booking (Fase 3). Anda tetap dapat mengelola profil praktik dan memeriksa saldo honor di Beranda.
        </div>

        {/* Action Button */}
        <div>
          <Link href={backHref}>
            <Button className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl px-5 py-2.5 text-xs sm:text-sm font-semibold shadow-xs cursor-pointer gap-2">
              <ArrowLeft size={16} />
              <span>{backLabel}</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
