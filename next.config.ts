import type { NextConfig } from "next";
import { legacyRoutes } from "./lib/navigation";
const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return Object.entries(legacyRoutes).flatMap(([source, destination]) => [
      { source: `/${source}`, destination, permanent: false },
      { source: `/example/${source}`, destination, permanent: false },
    ]);
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
export default nextConfig;
