import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";
import AppShell from "@/components/AppShell";
import CacheWarmer from "@/components/CacheWarmer";

// Barcha sahifalar dynamic (statik prerender YO'Q) — Next.js javobga
// `no-store` Cache-Control qo'yadi, shuning uchun deploydan keyin brauzer
// eski HTML/chunk'larni keshlab qolmaydi (qattiq yangilash shart emas).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Musaffo Tea",
  description: "Musaffo Tea boshqaruv paneli",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#e7eefb",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body>
        <AuthProvider>
          <CacheWarmer />
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
