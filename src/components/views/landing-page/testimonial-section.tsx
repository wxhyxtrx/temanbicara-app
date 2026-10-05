"use client";

import React from "react";
import Layouts from "@/components/shared/layouts";
import TestimonialCard from "@/components/shared/molecules/testimonial-card";
import { Badge } from "@/components/ui/badge";
import { testimonials } from "@/constant/testimonial";
import { Star, ShieldCheck } from "lucide-react";

export default function TestimonialSection() {
  const topRowTestimonials = testimonials.slice(0, 3);
  const bottomRowTestimonials = testimonials.slice(3, 6);

  return (
    <div className="relative py-12 md:py-20 bg-slate-50/50 dark:bg-slate-950/60 overflow-hidden border-y border-slate-200/80 dark:border-slate-800">
      <Layouts>
        {/* Header Section */}
        <div className="text-center mb-10 md:mb-14 px-4 max-w-2xl mx-auto space-y-3">
          <Badge className="bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 px-3.5 py-1.5 rounded-full inline-flex items-center gap-1.5 font-nunito text-xs">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span className="font-semibold">Rating Rata-rata 4.9 dari 1.200+ Ulasan Klien</span>
          </Badge>

          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold font-heading text-slate-900 dark:text-white leading-tight">
            Kisah Nyata Mereka yang Telah Menemukan Ruang Tenang
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-nunito leading-relaxed">
            Setiap langkah kecil untuk mencari bantuan adalah bentuk keberanian. Inilah pengalaman mereka yang memulihkan diri bersama TemanBicara.
          </p>
        </div>

        {/* Testimonials Marquee Scroll */}
        <div className="relative space-y-4">
          {/* Left Fade Gradient */}
          <div className="absolute left-0 top-0 bottom-0 w-12 sm:w-28 bg-gradient-to-r from-slate-50 dark:from-slate-950 to-transparent z-10 pointer-events-none" />

          {/* Right Fade Gradient */}
          <div className="absolute right-0 top-0 bottom-0 w-12 sm:w-28 bg-gradient-to-l from-slate-50 dark:from-slate-950 to-transparent z-10 pointer-events-none" />

          {/* Top Row - Moving Right */}
          <div className="relative overflow-hidden">
            <div className="flex animate-scroll-right py-2">
              {[...topRowTestimonials, ...topRowTestimonials, ...topRowTestimonials].map((item, index) => (
                <TestimonialCard key={`top-${item.id}-${index}`} testimonial={item} />
              ))}
            </div>
          </div>

          {/* Bottom Row - Moving Left */}
          <div className="relative overflow-hidden">
            <div className="flex animate-scroll-left py-2">
              {[...bottomRowTestimonials, ...bottomRowTestimonials, ...bottomRowTestimonials].map((item, index) => (
                <TestimonialCard key={`bottom-${item.id}-${index}`} testimonial={item} />
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400 pt-6">
          <ShieldCheck size={15} className="text-teal-600 dark:text-teal-400" />
          <span>Nama dan detail sensitif telah disamarkan demi menjaga kerahasiaan konseling.</span>
        </div>
      </Layouts>
    </div>
  );
}
