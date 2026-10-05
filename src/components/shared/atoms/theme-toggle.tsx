"use client";

import React, { useEffect, useState } from "react";
import { useThemeStore } from "@/store/theme-store";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ThemeToggleProps {
  className?: string;
  variant?: "ghost" | "outline";
}

export function ThemeToggle({ className = "", variant = "outline" }: ThemeToggleProps) {
  const { theme, toggleTheme, setTheme } = useThemeStore();
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    // Sync initial theme from localStorage or system preference
    const stored = localStorage.getItem("tb_theme");
    if (stored === "dark" || stored === "light") {
      setTheme(stored);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
    } else {
      setTheme("light");
    }
  }, [setTheme]);

  if (!mounted) {
    return (
      <div className={`w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-800 ${className}`} />
    );
  }

  const isDark = theme === "dark";

  return (
    <Button
      type="button"
      variant={variant}
      size="icon"
      onClick={toggleTheme}
      className={`relative h-9 w-9 rounded-xl border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all cursor-pointer shadow-2xs ${className}`}
      title={isDark ? "Beralih ke Mode Terang (Light Mode)" : "Beralih ke Mode Gelap (Dark Mode)"}
      aria-label="Toggle theme mode"
    >
      {isDark ? (
        <Sun size={17} className="text-amber-400 animate-in spin-in-90 duration-300" />
      ) : (
        <Moon size={17} className="text-slate-700 animate-in spin-in-90 duration-300" />
      )}
    </Button>
  );
}
