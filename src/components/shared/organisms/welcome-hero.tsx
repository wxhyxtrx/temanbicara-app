import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface WelcomeHeroProps {
  /** Label kecil di atas judul. */
  badge: React.ReactNode;
  /** Titik di depan label: berkedip hijau (aktif) atau abu-abu (nonaktif). */
  badgeLive?: boolean;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Deretan tombol aksi (pakai <HeroAction>). */
  actions?: React.ReactNode;
  /** Kartu info di sisi kanan (pakai <HeroInfoCard>). */
  aside?: React.ReactNode;
  className?: string;
}

/** Hero sambutan bergradien teal di beranda setiap peran; isi per peran lewat props. */
export function WelcomeHero({ badge, badgeLive = true, title, description, actions, aside, className }: WelcomeHeroProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-900 via-teal-950 to-slate-950 text-white p-6 sm:p-8 md:p-10 shadow-lg border border-teal-800/60 dark:border-teal-900/40",
        className
      )}
    >
      <div className="absolute top-0 right-10 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 left-10 w-60 h-60 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 md:gap-8">
        <div className="space-y-3.5 flex-1 min-w-0 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-800/60 border border-teal-700/60 text-teal-200 text-xs font-semibold backdrop-blur-md max-w-full">
            <span className={cn("w-2 h-2 rounded-full shrink-0", badgeLive ? "bg-emerald-400 animate-pulse" : "bg-slate-400")} />
            <span className="min-w-0">{badge}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold font-heading text-white tracking-tight leading-snug">
            {title}
          </h1>

          {description && (
            <p className="text-sm sm:text-base text-teal-100/80 leading-relaxed max-w-xl">{description}</p>
          )}

          {actions && <div className="flex flex-wrap items-center gap-3 pt-2">{actions}</div>}
        </div>

        {aside}
      </div>
    </div>
  );
}

interface HeroActionProps {
  icon?: React.ReactNode;
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** primary = tombol hijau utama, secondary = tombol garis teal. */
  variant?: "primary" | "secondary";
  className?: string;
}

/** Tombol di dalam WelcomeHero. Teks selalu putih/terang agar kontras di atas latar hijau. */
export function HeroAction({ icon, children, href, onClick, disabled, variant = "secondary", className }: HeroActionProps) {
  const button = (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      // Varian "outline" punya override dark:bg/dark:border yang menimpa warna hero, jadi selalu "default".
      variant="default"
      className={cn(
        "w-full sm:w-auto rounded-xl px-5 h-11 text-sm cursor-pointer gap-2",
        variant === "primary"
          ? "bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-600/20"
          : "border border-teal-700/80 bg-teal-900/50 hover:bg-teal-800/60 text-teal-100 hover:text-white font-semibold shadow-none",
        className
      )}
    >
      {icon}
      {children}
    </Button>
  );
  return href ? (
    <Link href={href} className="w-full sm:w-auto">
      {button}
    </Link>
  ) : (
    button
  );
}

interface HeroInfoCardProps {
  title: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

/** Kartu kaca kecil di sisi kanan hero (lisensi, status siaga, standar etika). */
export function HeroInfoCard({ title, children, footer, className }: HeroInfoCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-teal-900/40 border border-teal-700/50 p-4 sm:p-5 backdrop-blur-md w-full lg:w-64 xl:w-72 shrink-0 space-y-3",
        className
      )}
    >
      <div className="text-emerald-300 font-bold text-xs">{title}</div>
      {children && <div className="text-xs text-teal-100/70 leading-relaxed font-nunito">{children}</div>}
      {footer && (
        <div className="pt-2 border-t border-teal-800/80 flex items-center justify-between gap-2 text-[11px] text-teal-300">
          {footer}
        </div>
      )}
    </div>
  );
}
