import type { NextConfig } from "next";

const superadminApiUrl =
  process.env.NEXT_PUBLIC_SUPERADMIN_API_URL || "http://localhost:3000";

const nextConfig: NextConfig = {
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
