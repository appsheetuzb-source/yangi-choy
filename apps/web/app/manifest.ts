import type { MetadataRoute } from "next";

// Web App Manifest (PWA) — "Ilovani o'rnatish".
// Next.js buni /manifest.webmanifest manzilida beradi va <head> ga <link rel="manifest"> ni
// o'zi qo'shadi. Manifest + ikonkalar + HTTPS bo'lsa Chrome/Edge o'rnatish taklifini beradi.
// Service worker shart emas (public/sw.js faqat push uchun).
// Ikonkalar: public/icons/ — scripts/make-pwa-icons.py yasaydi.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Musaffo Tea",
    short_name: "Musaffo Tea",
    description: "Musaffo Tea boshqaruv paneli",
    lang: "uz",
    dir: "ltr",
    // Bosh sahifa; sessiya bo'lmasa AppShell /login ga yo'naltiradi
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    // Ilova foni: globals.css --bg (layout.tsx viewport.themeColor bilan bir xil)
    background_color: "#e7eefb",
    theme_color: "#e7eefb",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
