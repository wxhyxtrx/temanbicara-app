import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Testimonial } from "@/constant/testimonial";
import { Quote, Star } from "lucide-react";

export function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <Card className="w-72 sm:w-80 md:w-[360px] h-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow rounded-2xl flex-shrink-0 mx-2.5 sm:mx-3 p-0 overflow-hidden">
      <CardContent className="p-5 sm:p-6 h-full flex flex-col justify-between space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Quote className="w-5 h-5 text-teal-600 dark:text-teal-400 opacity-60" />
            <div className="flex items-center gap-0.5">
              {Array.from({ length: testimonial.rating }).map((_, i) => (
                <Star key={i} size={13} className="text-amber-400 fill-amber-400" />
              ))}
            </div>
          </div>
          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-nunito italic">
            "{testimonial.text}"
          </p>
        </div>

        <div className="flex items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="w-9 h-9 rounded-full bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 font-bold text-xs flex items-center justify-center border border-teal-200 dark:border-teal-800 flex-shrink-0 font-heading">
            {testimonial.initials}
          </div>
          <div className="leading-tight min-w-0">
            <p className="font-bold font-heading text-xs sm:text-sm text-slate-900 dark:text-white truncate">
              {testimonial.author}
            </p>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] truncate">{testimonial.role}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default TestimonialCard;
