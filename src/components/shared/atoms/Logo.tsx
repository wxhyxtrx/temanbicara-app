import React from "react";
import Link from "next/link";

interface LogoProps {
  className?: string;
  variant?: "light" | "dark";
  showTagline?: boolean;
  size?: "sm" | "md" | "lg";
  href?: string;
}

export function Logo({
  className = "",
  variant = "light",
  showTagline = false,
  size = "md",
  href,
}: LogoProps) {
  const iconSizes = {
    sm: "w-8 h-8",
    md: "w-9 h-9",
    lg: "w-11 h-11",
  };

  const textSizes = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-xl",
  };

  const isDark = variant === "dark";

  const content = (
    <div className={`inline-flex items-center gap-2.5 group select-none ${className}`}>
      {/* Therapeutic Mind & Heart Emblem */}
      <div className={`relative ${iconSizes[size]} flex-shrink-0 transition-transform group-hover:scale-105 duration-200`}>
        <svg
          viewBox="0 0 44 44"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-xs"
        >
          <defs>
            <linearGradient id="tbGradient1" x1="4" y1="4" x2="40" y2="40" gradientUnits="userSpaceOnUse">
              <stop stopColor="#0d9488" />
              <stop offset="1" stopColor="#0f766e" />
            </linearGradient>
            <linearGradient id="tbGradient2" x1="14" y1="8" x2="38" y2="34" gradientUnits="userSpaceOnUse">
              <stop stopColor="#34d399" />
              <stop offset="1" stopColor="#059669" />
            </linearGradient>
          </defs>

          {/* Primary listening sanctuary bubble */}
          <path
            d="M22 6C13.163 6 6 12.716 6 21C6 24.634 7.375 27.962 9.688 30.54L7.5 37.5L15.312 35.125C17.348 35.69 19.596 36 22 36C30.837 36 38 29.284 38 21C38 12.716 30.837 6 22 6Z"
            fill="url(#tbGradient1)"
          />

          {/* Calming inner empathy node / organic leaf heart */}
          <path
            d="M22 13C17.582 13 14 16.582 14 21C14 26 21 30.5 22 31C23 30.5 30 26 30 21C30 16.582 26.418 13 22 13Z"
            fill="#ffffff"
            fillOpacity="0.22"
          />
          <path
            d="M22 15C18.686 15 16 17.686 16 21C16 24.8 21.2 28.3 22 28.8C22.8 28.3 28 24.8 28 21C28 17.686 25.314 15 22 15Z"
            fill="url(#tbGradient2)"
          />

          {/* Center serene point */}
          <circle cx="22" cy="20.5" r="2.2" fill="#ffffff" />
        </svg>
      </div>

      {/* Typography */}
      <div className="flex flex-col leading-tight">
        <span
          className={`font-heading font-bold tracking-tight ${textSizes[size]} ${
            isDark ? "text-white" : "text-slate-900 dark:text-white"
          }`}
        >
          Teman<span className="text-teal-600 dark:text-teal-400">Bicara</span>
        </span>
        {showTagline && (
          <span
            className={`text-[10px] font-medium tracking-wide uppercase ${
              isDark ? "text-slate-400" : "text-slate-500 dark:text-slate-400"
            }`}
          >
            Konseling & Kesehatan Mental
          </span>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex">
        {content}
      </Link>
    );
  }

  return content;
}

export default Logo;
