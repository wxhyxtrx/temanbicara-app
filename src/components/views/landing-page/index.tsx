import React from "react";
import HeroSection from "./hero-section";
import FeaturesSection from "./features-section";
import JoinSection from "./join-section";
import TestimonialSection from "./testimonial-section";
import StartNowSection from "./startnow-section";

export default function Landing() {
  return (
    <div className="w-full bg-slate-50/40 dark:bg-slate-950 transition-colors duration-200">
      <section id="hero">
        <HeroSection />
      </section>
      <section id="features" className="bg-white dark:bg-slate-900/60 py-12 md:py-20 border-t border-slate-200/70 dark:border-slate-800">
        <FeaturesSection />
      </section>
      <section id="join">
        <JoinSection />
      </section>
      <section id="testimonial">
        <TestimonialSection />
      </section>
      <section id="start-now" className="bg-white dark:bg-slate-900/40 py-12 md:py-16">
        <StartNowSection />
      </section>
    </div>
  );
}
