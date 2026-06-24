import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,

  // FAQAT dev rejim uchun — LAN IP (telefon/boshqa qurilma) orqali dev serverni ochishga ruxsat.
  // Next.js 15+ standart holatda localhost'dan tashqari origin'larning dev-asset/HMR so'rovlarini
  // bloklaydi (shu sababli LAN IP'da sahifa hidratsiya bo'lmay spinner qotardi). Production'ga ta'siri yo'q.
  allowedDevOrigins: ["192.168.150.105", "192.168.*.*", "10.*.*.*", "172.16.*.*"],

  // Kichik VPS'da build xotirasini kamaytirish (lokalda allaqachon tekshiriladi)
  typescript: { ignoreBuildErrors: true },

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
