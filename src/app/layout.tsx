import type { Metadata } from "next";
import { Poppins, Nunito } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
});

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-nunito",
});

export const metadata: Metadata = {
  title: "TemanBicara - Layanan Telekonseling & Kesehatan Mental",
  description: "Platform telekonseling kesehatan mental privat bersama psikolog klinis berlisensi HIMPSI dan pendamping emosi AI 24/7.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var stored = localStorage.getItem('tb_theme');
                var isDark = stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches);
                if (isDark) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (e) {}
              if (typeof window !== 'undefined') {
                if (!window.ethereum) { window.ethereum = {}; }
                window.addEventListener('error', function(e) {
                  if (e.message && e.message.indexOf('ethereum') !== -1) {
                    e.stopImmediatePropagation();
                  }
                });
              }
            `,
          }}
        />
      </head>
      <body className={`${poppins.variable} ${nunito.variable} antialiased bg-background text-foreground transition-colors duration-200`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
