"use client";
// O'ng pastdagi "Ilovani o'rnatish" taklif kartasi — tizimga kirgan foydalanuvchiga.
// Brauzer o'rnatishni taklif qilsa (yoki iPhone/iPad bo'lsa) ~1 soniyadan keyin chiqadi.
// "×" bilan yopilsa — keyingi kirishgacha chiqmaydi (lib/pwa-install.ts). Sidebar'dagi tugma
// har doim qoladi.
import { useEffect, useState } from "react";
import { usePwaHolat, pwaOrnat, taklifYopilganmi, taklifniYop } from "@/lib/pwa-install";
import { IOS_KORSATMA } from "./InstallAppButton";

const YUKLASH = (<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>);

export default function InstallPromptToast({ userId }: { userId: string }) {
  const holat = usePwaHolat();
  const [yopildi, setYopildi] = useState(() => typeof window !== "undefined" && taklifYopilganmi(userId));
  const [vaqtKeldi, setVaqtKeldi] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setVaqtKeldi(true), 1200);
    const c = () => setIsMobile(window.innerWidth < 768);
    const raf = requestAnimationFrame(c);
    window.addEventListener("resize", c);
    return () => { window.clearTimeout(t); cancelAnimationFrame(raf); window.removeEventListener("resize", c); };
  }, []);

  if (!vaqtKeldi || yopildi || (holat !== "taklif" && holat !== "ios")) return null;

  const yop = () => { taklifniYop(userId); setYopildi(true); };
  const ios = holat === "ios";

  return (
    <div role="dialog" aria-label="Ilovani o'rnatish"
      style={{
        position: "fixed", zIndex: 45,
        ...(isMobile ? { left: 12, right: 12, bottom: 92 } : { right: 24, bottom: 24, width: 400 }),
        background: "var(--white)", border: "1px solid var(--border)", borderRadius: 16,
        boxShadow: "0 12px 40px rgba(15,42,76,.18)", padding: "16px 16px 16px 18px",
        display: "flex", gap: 14, alignItems: "flex-start",
        animation: "modalIn .25s cubic-bezier(.4,0,.2,1)",
      }}>
      <span style={{ width: 44, height: 44, borderRadius: 12, background: "var(--primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {YUKLASH}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 15, fontWeight: 800, color: "var(--text)", marginBottom: 4 }}>Ilovani o&apos;rnatish</p>
        <p style={{ fontSize: 13, lineHeight: 1.45, color: "var(--text-2)" }}>
          Musaffo Tea&apos;ni ilova sifatida o&apos;rnating: tezroq ochiladi va alohida oynada ishlaydi.
        </p>
        {ios ? (
          <>
            <p style={{ fontSize: 12.5, lineHeight: 1.45, color: "var(--text)", fontWeight: 600, marginTop: 8, padding: "8px 10px", background: "var(--bg)", borderRadius: 9 }}>
              {IOS_KORSATMA}
            </p>
            <button type="button" className="btn btn--primary" onClick={yop} style={{ marginTop: 10, padding: "8px 16px", fontSize: 13 }}>
              Tushunarli
            </button>
          </>
        ) : (
          <button type="button" className="btn btn--primary" onClick={() => { void pwaOrnat(); }}
            style={{ marginTop: 10, padding: "8px 16px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            O&apos;rnatish
          </button>
        )}
      </div>
      <button type="button" onClick={yop} aria-label="Yopish" title="Yopish"
        style={{ width: 28, height: 28, borderRadius: 8, border: "none", background: "transparent", color: "var(--text-3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
  );
}
