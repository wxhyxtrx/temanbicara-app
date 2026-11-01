import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  devIndicators: false,
  allowedDevOrigins: ["localhost", "192.168.1.3", "0.0.0.0"],
  env: {
    NEXT_PUBLIC_PAYMENT_IS_PRODUCTION: process.env.PAYMENT_IS_PRODUCTION,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=(), interest-cohort=()",
          },
          {
            key: "Content-Security-Policy-Report-Only",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://app.sandbox.midtrans.com https://app.midtrans.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://app.sandbox.midtrans.com https://app.midtrans.com; img-src 'self' data: blob: https://*.supabase.co; style-src 'self' 'unsafe-inline'; font-src 'self' data:; frame-src https://app.sandbox.midtrans.com https://app.midtrans.com; report-uri /api/security/csp-report;",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/beranda", destination: "/patient/beranda", permanent: true },
      { source: "/room", destination: "/patient/beranda", permanent: true },
      { source: "/patient/room", destination: "/patient/beranda", permanent: true },
      { source: "/schedule", destination: "/patient/schedule", permanent: true },
      { source: "/top-up", destination: "/patient/top-up", permanent: true },
      { source: "/top-up/history", destination: "/patient/top-up/history", permanent: true },
      { source: "/settings", destination: "/patient/settings", permanent: true },
    ];
  },
};

export default nextConfig;
