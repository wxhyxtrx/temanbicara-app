import { ReactNode } from "react";

interface StepCardProps {
  number: string;
  title: string;
  description: string;
}

export default function StepCard({ number, title, description }: StepCardProps) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 sm:w-16 sm:h-16 bg-primary text-white rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
        <span className="text-lg sm:text-xl font-bold font-poppins">{number}</span>
      </div>
      <h3 className="text-lg sm:text-xl font-semibold mb-2 text-foreground font-poppins">
        {title}
      </h3>
      <p className="text-sm sm:text-base text-muted-foreground font-nunito">
        {description}
      </p>
    </div>
  );
}