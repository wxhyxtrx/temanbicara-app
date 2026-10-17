"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PublicPsychologist } from "@/types/user-profile";
import { MdVerified } from "react-icons/md";
import { Sparkles, Calendar, User, Clock } from "lucide-react";
import { tarifToCoins, formatRupiah, getInitials } from "@/lib/booking-utils";

interface PsychologistCardProps {
  psychologist: PublicPsychologist;
  onViewProfile: (psychologist: PublicPsychologist) => void;
  onSelectSlot?: (psychologist: PublicPsychologist) => void;
  compact?: boolean;
}

export function PsychologistCard({
  psychologist,
  onViewProfile,
  onSelectSlot,
  compact = false,
}: PsychologistCardProps) {
  const coins = tarifToCoins(psychologist.tarif_sesi);
  const rupiahText = formatRupiah(psychologist.tarif_sesi);
  const initials = getInitials(psychologist.nama_lengkap_gelar);

  return (
    <div className="p-3.5 sm:p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-800/50 hover:border-teal-200 dark:hover:border-teal-700 hover:bg-slate-50/70 dark:hover:bg-slate-800/90 transition-all flex flex-col justify-between gap-3 shadow-2xs">
      <div className="flex items-start gap-3 min-w-0">
        <div className="relative shrink-0 mt-0.5">
          {psychologist.avatar_url ? (
            <img
              src={psychologist.avatar_url}
              alt={psychologist.nama_lengkap_gelar}
              className="w-11 h-11 rounded-full object-cover border border-teal-200 dark:border-teal-700"
            />
          ) : (
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-950 dark:to-teal-900 text-teal-800 dark:text-teal-300 font-bold text-xs flex items-center justify-center border border-teal-200 dark:border-teal-700 font-heading">
              {initials}
            </div>
          )}
          <span
            className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-800"
            title="Tersedia untuk booking"
          />
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white font-heading truncate">
              {psychologist.nama_lengkap_gelar}
            </h3>
            <MdVerified className="text-sky-500 text-xs shrink-0" title="SIPPK Terverifikasi" />
            <Badge
              variant="outline"
              className="text-[10px] px-2 py-0.5 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200/80 dark:border-amber-800 font-semibold gap-1"
            >
              <Sparkles size={10} className="text-amber-500" />
              <span>Psikolog baru</span>
            </Badge>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-nunito flex-wrap">
            <span className="flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300">
              <Clock size={12} className="text-teal-600 dark:text-teal-400" />
              {psychologist.tahun_pengalaman} Thn Pengalaman
            </span>
            <span>•</span>
            <span className="font-semibold text-teal-700 dark:text-teal-300 font-mono">
              {coins} Koin
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              ({rupiahText})
            </span>
          </div>

          {/* Label Spesialisasi */}
          <div className="flex flex-wrap gap-1 pt-1">
            {psychologist.spesialisasi && psychologist.spesialisasi.length > 0 ? (
              psychologist.spesialisasi.map((spec) => (
                <Badge
                  key={spec}
                  variant="outline"
                  className="text-[10px] font-medium bg-slate-50 dark:bg-slate-800/80 text-teal-800 dark:text-teal-300 border-teal-200/60 dark:border-teal-800/60 px-2 py-0.5 rounded-md"
                >
                  {spec}
                </Badge>
              ))
            ) : (
              <Badge
                variant="outline"
                className="text-[10px] font-medium bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-md"
              >
                Konseling Klinis Umum
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onViewProfile(psychologist)}
          className="text-xs border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold rounded-xl px-3 py-1.5 h-8 cursor-pointer gap-1"
        >
          <User size={13} />
          <span>Lihat Profil</span>
        </Button>
        {onSelectSlot && (
          <Button
            size="sm"
            onClick={() => onSelectSlot(psychologist)}
            className="text-xs bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl px-3.5 py-1.5 h-8 shadow-2xs cursor-pointer gap-1.5"
          >
            <Calendar size={13} />
            <span>Pilih Jadwal</span>
          </Button>
        )}
      </div>
    </div>
  );
}
