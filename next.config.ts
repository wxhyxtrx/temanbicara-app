import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  devIndicators: false,
  allowedDevOrigins: ["localhost", "192.168.1.3", "0.0.0.0"],
};

export default nextConfig;
