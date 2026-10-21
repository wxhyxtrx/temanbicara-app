"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  HeartHandshake,
  Tag,
  Clock,
  Heart,
  Loader2,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import type { RelawanPeerTicketDTO } from "@/types/peer-tickets";
import { formatWibTime, formatWibDateShort } from "@/lib/booking-utils";

interface ListenerClaimDialogProps {
  ticket: RelawanPeerTicketDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmClaim: (ticket: RelawanPeerTicketDTO) => Promise<void>;
  isClaiming: boolean;
}

const emotionStyles: Record<string, string> = {
  Kewalahan: "bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800",
  Cemas: "bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  Sedih: "bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  Lelah: "bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700",
  Bingung: "bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800",
};

export function ListenerClaimDialog({
  ticket,
  open,
  onOpenChange,
  onConfirmClaim,
  isClaiming,
}: ListenerClaimDialogProps) {
  if (!ticket) return null;

  const timeFormatted = ticket.created_at ? formatWibTime(ticket.created_at) : "";
  const dateFormatted = ticket.created_at ? formatWibDateShort(ticket.created_at) : "";
  const emotionClass =
    emotionStyles[ticket.emotion] ||
    "bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800";

  const handleConfirm = async () => {
    await onConfirmClaim(ticket);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !isClaiming && onOpenChange(val)}>
      <DialogContent className="max-w-md sm:max-w-lg rounded-2xl font-nunito p-5 sm:p-6 min-w-0">
        <DialogHeader className="space-y-2 text-left min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="p-2 rounded-xl bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 shrink-0">
              <HeartHandshake size={20} />
            </span>
            <div className="min-w-0">
              <DialogTitle className="font-heading text-lg font-bold text-slate-900 dark:text-white truncate">
                Konfirmasi Ambil Tiket Curhat
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                Pastikan Anda siap mendampingi teman bicara berikut dengan empati.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Ticket Summary Box */}
        <div className="space-y-3 py-2 min-w-0">
          <div className="p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-full bg-teal-200 dark:bg-teal-800/60 flex items-center justify-center text-teal-900 dark:text-teal-100 font-bold text-xs shrink-0">
                  {ticket.patient_alias ? ticket.patient_alias.slice(0, 2).toUpperCase() : "TB"}
                </div>
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                  {ticket.patient_alias}
                </span>
              </div>

              <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                <Clock className="size-3 text-slate-400" />
                <span>
                  {dateFormatted ? `${dateFormatted} • ` : ""}{timeFormatted}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <Badge
                variant="outline"
                className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${emotionClass}`}
              >
                <Heart className="size-3 mr-1 shrink-0" />
                {ticket.emotion}
              </Badge>
              <Badge
                variant="outline"
                className="text-xs px-2.5 py-0.5 rounded-full border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
              >
                <Tag className="size-3 mr-1 shrink-0" />
                {ticket.topic}
              </Badge>
            </div>

            <div className="space-y-1 min-w-0">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                Cuplikan Curhat:
              </span>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed line-clamp-4 break-words">
                &ldquo;{ticket.content}&rdquo;
              </p>
            </div>
          </div>

          {/* PFA Ethical Commitment Reminder */}
          <div className="p-3 rounded-xl border border-teal-200/80 dark:border-teal-900/60 bg-teal-50/60 dark:bg-teal-950/30 flex items-start gap-2.5 text-xs text-teal-950 dark:text-teal-200 min-w-0">
            <ShieldCheck className="size-4 shrink-0 text-teal-600 dark:text-teal-400 mt-0.5" />
            <div className="space-y-0.5 min-w-0">
              <p className="font-bold text-teal-900 dark:text-teal-100">
                Komitmen Pendampingan Empatik (PFA)
              </p>
              <p className="text-[11px] text-teal-800 dark:text-teal-300 leading-relaxed">
                Hadir dengan rasa penerimaan tanpa prasangka, validasi perasaan teman bicara, dan jaga kerahasiaan percakapan. Jika ada tanda bahaya darurat, segera sarankan Hotline SEJIWA 119.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={isClaiming}
            onClick={() => onOpenChange(false)}
            className="rounded-xl border-slate-200 dark:border-slate-700 text-xs h-9 cursor-pointer"
          >
            Batal
          </Button>
          <Button
            type="button"
            disabled={isClaiming}
            onClick={handleConfirm}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs h-9 px-4 cursor-pointer gap-2 shadow-sm"
          >
            {isClaiming ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Mengklaim Tiket...</span>
              </>
            ) : (
              <>
                <HeartHandshake size={14} />
                <span>Ambil & Tangani Tiket</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
