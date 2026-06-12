"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { canAccess } from "@/lib/auth";
import Sidebar from "./Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();

  const isLoginPage = pathname === "/login";

  useEffect(() => {
    if (loading) return;
    if (!user && !isLoginPage) {
      router.replace("/login");
      return;
    }
    if (user && !isLoginPage && !canAccess(user, pathname)) {
      // Sotuvchi unauthorized sahifaga o'tmoqchi bo'lsa
      router.replace("/sotuv");
    }
  }, [user, loading, pathname, isLoginPage, router]);

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
      <div className="spinner--page" />
    </div>
  );

  if (isLoginPage) return <>{children}</>;
  if (!user) return null;

  return (
    <>
      <Sidebar />
      <div className="page-wrap">{children}</div>
    </>
  );
}
