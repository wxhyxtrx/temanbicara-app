import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  devIndicators: false,
  allowedDevOrigins: ["localhost", "192.168.1.3", "0.0.0.0"],
  async redirects() {
    return [
      { source: "/beranda", destination: "/patient/beranda", permanent: true },
      { source: "/room", destination: "/patient/room", permanent: true },
      { source: "/schedule", destination: "/patient/schedule", permanent: true },
      { source: "/top-up", destination: "/patient/top-up", permanent: true },
      { source: "/top-up/history", destination: "/patient/top-up/history", permanent: true },
      { source: "/settings", destination: "/patient/settings", permanent: true },
    ];
  },
};

export default nextConfig;
