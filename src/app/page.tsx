import React from "react";
import { Navbar, Footer } from "@/components/shared/organisms";
import Landing from "@/components/views/landing-page";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-nunito transition-colors duration-200">
      <Navbar />
      <main className="flex-1">
        <Landing />
      </main>
      <Footer />
    </div>
  );
}
