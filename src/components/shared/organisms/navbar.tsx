"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Layouts from "@/components/shared/layouts";
import { Logo } from "@/components/shared/atoms/Logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/atoms/theme-toggle";
import { Menu, X, HeartPulse } from "lucide-react";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-200 ${
        scrolled
          ? "bg-white/95 dark:bg-slate-950/95 backdrop-blur-md shadow-xs border-b border-slate-200/80 dark:border-slate-800 py-3"
          : "bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm border-b border-slate-100 dark:border-slate-900 py-4"
      }`}
    >
      <Layouts>
        <div className="flex justify-between items-center">
          {/* Logo */}
          <div
            className="cursor-pointer"
            onClick={() => scrollToSection("hero")}
          >
            <Logo showTagline size="md" />
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 lg:gap-9 font-medium text-sm text-slate-600 dark:text-slate-300 font-heading">
            <span
              className="cursor-pointer hover:text-teal-700 dark:hover:text-teal-400 transition-colors"
              onClick={() => scrollToSection("features")}
            >
              Layanan Terapi
            </span>
            <span
              className="cursor-pointer hover:text-teal-700 dark:hover:text-teal-400 transition-colors"
              onClick={() => scrollToSection("testimonial")}
            >
              Kisah Klien
            </span>
            <span
              className="cursor-pointer hover:text-teal-700 dark:hover:text-teal-400 transition-colors"
              onClick={() => scrollToSection("join")}
            >
              Tentang Kami
            </span>
            <Link
              href="/help-center"
              className="hover:text-teal-700 dark:hover:text-teal-400 transition-colors"
            >
              Pusat Bantuan
            </Link>
          </nav>

          {/* Desktop Action Group */}
          <div className="hidden md:flex items-center gap-2.5">
            <Link
              href="/help-center"
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors"
            >
              <HeartPulse size={14} className="text-rose-600 dark:text-rose-400" />
              Hotline 119
            </Link>

            {/* Dark / Light Mode Toggle */}
            <ThemeToggle />

            <Link href="/login">
              <Button
                variant="ghost"
                className="text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white font-semibold cursor-pointer text-xs sm:text-sm"
              >
                Masuk
              </Button>
            </Link>
            <Link href="/register">
              <Button
                className="bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl px-4 sm:px-5 cursor-pointer shadow-xs text-xs sm:text-sm"
              >
                Mulai Konseling
              </Button>
            </Link>
          </div>

          {/* Mobile Menu & Theme Toggle */}
          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle />
            <button
              className="p-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden pt-4 pb-6 px-2 border-t border-slate-200 dark:border-slate-800 mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col space-y-3 font-heading text-slate-800 dark:text-slate-200 text-sm">
              <span
                className="cursor-pointer hover:text-teal-700 dark:hover:text-teal-400 transition-colors py-2 px-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-900"
                onClick={() => scrollToSection("features")}
              >
                Layanan Terapi
              </span>
              <span
                className="cursor-pointer hover:text-teal-700 dark:hover:text-teal-400 transition-colors py-2 px-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-900"
                onClick={() => scrollToSection("testimonial")}
              >
                Kisah Klien
              </span>
              <span
                className="cursor-pointer hover:text-teal-700 dark:hover:text-teal-400 transition-colors py-2 px-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-900"
                onClick={() => scrollToSection("join")}
              >
                Tentang Kami
              </span>
              <Link
                href="/help-center"
                className="hover:text-teal-700 dark:hover:text-teal-400 transition-colors py-2 px-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-900"
              >
                Pusat Bantuan
              </Link>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2.5">
                <Link href="/login" className="w-full">
                  <Button variant="outline" className="w-full font-semibold border-slate-300 dark:border-slate-700 dark:text-slate-200">
                    Masuk ke Akun
                  </Button>
                </Link>
                <Link href="/register" className="w-full">
                  <Button className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl">
                    Mulai Konseling Sekarang
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </Layouts>
    </header>
  );
}
export default Navbar;
