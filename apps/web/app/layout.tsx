import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Yangi Choy",
  description: "Yangi Choy boshqaruv paneli",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body>
        <Sidebar />
        <div className="page-wrap">{children}</div>
      </body>
    </html>
  );
}
