import { Card, CardContent } from "@/components/ui/card";
import { ReactNode } from "react";

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
}

export default function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <Card className=" text-center hover:shadow transition-shadow bg-secondary-background border-0 gap-2 px-2 sm:px-4">
      <div className="flex justify-center">
        {icon}
      </div>
      <h3 className="text-lg sm:text-xl font-semibold text-foreground font-poppins">
        {title}
      </h3>
      <p className="text-sm sm:text-base text-muted-foreground font-nunito">
        {description}
      </p>
    </Card>
  );
}