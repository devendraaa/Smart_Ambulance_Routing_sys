import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["172.18.160.1"], // ✅ add this
};

export default nextConfig;