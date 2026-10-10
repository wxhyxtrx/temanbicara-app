"use client";

import React from "react";
import { Toaster as Sonner, ToasterProps } from "sonner";
import { useThemeStore } from "@/store/theme-store";

export function Toaster({ ...props }: ToasterProps) {
  const theme = useThemeStore((state) => state.theme);

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-right"
      richColors
      closeButton
      duration={4000}
      className="toaster group font-nunito"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white dark:group-[.toaster]:bg-slate-900 group-[.toaster]:text-slate-900 dark:group-[.toaster]:text-slate-100 group-[.toaster]:border-slate-200/90 dark:group-[.toaster]:border-slate-800 group-[.toaster]:shadow-xl group-[.toaster]:rounded-2xl group-[.toaster]:p-3.5 group-[.toaster]:gap-2.5",
          title: "text-xs sm:text-sm font-bold font-heading text-slate-900 dark:text-white leading-tight",
          description: "group-[.toast]:text-slate-600 dark:group-[.toast]:text-slate-400 text-xs font-nunito leading-snug mt-0.5",
          actionButton:
            "group-[.toast]:bg-teal-700 hover:group-[.toast]:bg-teal-800 group-[.toast]:text-white font-semibold rounded-xl text-xs px-3 py-1.5 transition-colors cursor-pointer shadow-xs",
          cancelButton:
            "group-[.toast]:bg-slate-100 dark:group-[.toast]:bg-slate-800 group-[.toast]:text-slate-700 dark:group-[.toast]:text-slate-300 font-medium rounded-xl text-xs px-3 py-1.5 transition-colors cursor-pointer",
          closeButton:
            "group-[.toast]:bg-white dark:group-[.toast]:bg-slate-800 group-[.toast]:border-slate-200 dark:group-[.toast]:border-slate-700 group-[.toast]:text-slate-500 hover:group-[.toast]:text-slate-900 dark:hover:group-[.toast]:text-white",
          success: "group-[.toaster]:border-emerald-200 dark:group-[.toaster]:border-emerald-800/80 group-[.toaster]:bg-emerald-50/40 dark:group-[.toaster]:bg-emerald-950/30",
          error: "group-[.toaster]:border-rose-200 dark:group-[.toaster]:border-rose-800/80 group-[.toaster]:bg-rose-50/40 dark:group-[.toaster]:bg-rose-950/30",
          warning: "group-[.toaster]:border-amber-200 dark:group-[.toaster]:border-amber-800/80 group-[.toaster]:bg-amber-50/40 dark:group-[.toaster]:bg-amber-950/30",
          info: "group-[.toaster]:border-teal-200 dark:group-[.toaster]:border-teal-800/80 group-[.toaster]:bg-teal-50/40 dark:group-[.toaster]:bg-teal-950/30",
        },
      }}
      {...props}
    />
  );
}

export { toast } from "sonner";
