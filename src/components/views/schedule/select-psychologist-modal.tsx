"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { PublicPsychologist } from "@/types/user-profile";
import { userService } from "@/services/user.service";
import { getInitials, tarifToCoins, formatRupiah } from "@/lib/booking-utils";
import {
  Search,
  Users,
  ShieldCheck,
  Star,
  Calendar,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import { MdVerified } from "react-icons/md";

interface SelectPsychologistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPsychologist: (psychologist: PublicPsychologist) => void;
}

export function SelectPsychologistModal({
  isOpen,
  onClose,
  onSelectPsychologist,
}: SelectPsychologistModalProps) {
  const [psychologists, setPsychologists] = useState<PublicPsychologist[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);

    userService
      .getPsychologists({ limit: 50 })
      .then((res) => {
        if (isMounted && res?.success && Array.isArray(res.data)) {
          setPsychologists(res.data);
        }
      })
      .catch((err) => {
        console.error("Gagal memuat psikolog terverifikasi:", err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const filteredPsychologists = useMemo(() => {
    if (!searchQuery.trim()) return psychologists;
    const q = searchQuery.toLowerCase().trim();
    return psychologists.filter(
      (p) =>
        p.nama_lengkap_gelar.toLowerCase().includes(q) ||
        p.spesialisasi.some((s) => s.toLowerCase().includes(q))
    );
  }, [psychologists, searchQuery]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden font-nunito p-4 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-2xl box-border">
        <DialogHeader className="space-y-1 pb-3 border-b border-slate-100 dark:border-slate-800 w-full min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-400 flex items-center justify-center shrink-0">
              <Users size={18} />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base sm:text-lg font-bold font-heading text-slate-900 dark:text-white truncate">
                Pilih Psikolog Klinis
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Pilih psikolog berlisensi resmi untuk melihat jadwal praktik dan reservasi sesi
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Search Input */}
        <div className="pt-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <Input
              placeholder="Cari berdasarkan nama psikolog atau topik keluhan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs bg-slate-50/70 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 rounded-xl"
            />
          </div>
        </div>

        {/* List of Psychologists */}
        <div className="space-y-3 pt-2">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 animate-pulse flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-700" />
                    <div className="space-y-2">
                      <div className="w-36 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                      <div className="w-24 h-3 bg-slate-200 dark:bg-slate-700 rounded" />
                    </div>
                  </div>
                  <div className="w-20 h-8 bg-slate-200 dark:bg-slate-700 rounded-xl" />
                </div>
              ))}
            </div>
          ) : filteredPsychologists.length === 0 ? (
            <div className="py-10 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
              <Users className="w-8 h-8 mx-auto text-slate-400 opacity-60" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {searchQuery ? "Tidak ada psikolog yang cocok" : "Belum ada psikolog terverifikasi"}
              </p>
              <p className="text-[11px] text-slate-400">
                {searchQuery
                  ? "Coba gunakan kata kunci nama atau spesialisasi lain."
                  : "Psikolog berlisensi akan tampil di sini begitu terdaftar."}
              </p>
            </div>
          ) : (
            filteredPsychologists.map((psychologist) => {
              const coins = tarifToCoins(psychologist.tarif_sesi);
              return (
                <div
                  key={psychologist.id}
                  className="p-3.5 sm:p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-teal-300 dark:hover:border-teal-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      {psychologist.avatar_url ? (
                        <img
                          src={psychologist.avatar_url}
                          alt={psychologist.nama_lengkap_gelar}
                          className="w-12 h-12 rounded-xl object-cover border border-teal-200 dark:border-teal-700 shadow-2xs"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-600 to-teal-800 text-white font-bold text-sm flex items-center justify-center font-heading shadow-2xs">
                          {getInitials(psychologist.nama_lengkap_gelar)}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white font-heading truncate">
                          {psychologist.nama_lengkap_gelar}
                        </h4>
                        <MdVerified className="text-sky-500 text-xs shrink-0" />
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                        <span className="flex items-center gap-1">
                          <ShieldCheck size={12} className="text-emerald-500" />
                          <span>{psychologist.tahun_pengalaman} Thn Pengalaman</span>
                        </span>
                        {psychologist.rating_avg !== null && psychologist.rating_avg !== undefined && (
                          <span className="flex items-center gap-0.5 text-amber-500 font-semibold">
                            <Star size={11} className="fill-amber-400" />
                            <span>{Number(psychologist.rating_avg).toFixed(1)}</span>
                          </span>
                        )}
                        {psychologist.attendance_pct !== null && psychologist.attendance_pct !== undefined && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            Kehadiran {psychologist.attendance_pct}%
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {psychologist.spesialisasi.slice(0, 3).map((spec, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 rounded-md"
                          >
                            {spec}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center sm:flex-col sm:items-end justify-between sm:justify-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                    <div className="text-left sm:text-right">
                      <span className="font-extrabold text-teal-700 dark:text-teal-400 font-mono text-xs sm:text-sm block">
                        {coins} Koin
                      </span>
                      <span className="text-[10px] text-slate-400 block font-nunito">
                        {formatRupiah(psychologist.tarif_sesi)} / sesi
                      </span>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => onSelectPsychologist(psychologist)}
                      className="text-xs bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl px-3.5 py-1.5 h-8 shadow-2xs cursor-pointer gap-1.5"
                    >
                      <Calendar size={13} />
                      <span>Pilih Jadwal</span>
                      <ArrowRight size={12} />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
