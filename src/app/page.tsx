import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Navbar, Footer } from "@/components/shared/organisms";
import { FeatureCard, StepCard } from "@/components/shared/molecules";
import { MessageCircle, Shield, Users, Briefcase, PieChart, Hand } from "lucide-react";
import Landing from "@/components/views/landing-page";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Landing />

      <Footer />
    </div>
  );
}
