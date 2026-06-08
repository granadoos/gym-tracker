import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
    allowedDevOrigins: [
    "192.168.2.3",  
    "192.168.2.82",
    "192.168.2.0/24",
    "localhost",
  ],
};

export default nextConfig;
