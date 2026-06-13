import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,

  // Kichik VPS'da build xotirasini kamaytirish (lokalda allaqachon tekshiriladi)
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  // Bundle analyzer off by default
  experimental: {
    optimizePackageImports: ["recharts"],
  },

  // Static assets long-term cache
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
