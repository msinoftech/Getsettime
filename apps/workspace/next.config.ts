import type { NextConfig } from "next";

const superadminApiUrl =
  process.env.NEXT_PUBLIC_SUPERADMIN_API_URL || "http://localhost:3000";

const nextConfig: NextConfig = {
  /**
   * If you open dev via a LAN hostname (e.g. http://192.168.1.5:3001) and HMR stays
   * pending, add that host: `allowedDevOrigins: ['192.168.1.5']`.
   * When set, Next uses strict blocking for cross-origin /_next/* (including WS upgrade).
   */
  ...(process.env.NODE_ENV === "development" &&
  process.env.NEXT_DEV_ALLOWED_ORIGINS?.trim()
    ? {
        allowedDevOrigins: process.env.NEXT_DEV_ALLOWED_ORIGINS.split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      }
    : {}),
  async rewrites() {
    return [
      {
        source: "/api/superadmin/:path*",
        destination: `${superadminApiUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
