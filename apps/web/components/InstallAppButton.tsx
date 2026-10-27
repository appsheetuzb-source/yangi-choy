"use client";
import { useCallback, useState, useSyncExternalStore } from "react";

// Chrome/Edge (kompyuter va Android) beradigan hodisa — lib.dom da yo'q
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    /** public/install-prompt.js (layout.tsx, beforeInteractive) shu yerga saqlaydi */
    __appInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

type Holat = "yashirin" | "taklif" | "ios" | "ornatilgan";
const OZGARDI = "app:install-changed";   // taklif ishlatilganda (prompt chaqirilgach) ichki xabar

/** Ilova allaqachon o'rnatilgan (alohida oynada ochilgan) */
function ornatilganmi(): boolean {
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;   // iOS Safari
}
function iosmi(): boolean {
  // iPadOS 13+ o'zini Mac deb ko'rsatadi — sensorli ekran bo'yicha ajratamiz
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** Joriy holat — window'dagi saqlangan taklif va ko'rinish rejimidan */
function holatOl(): Holat {
  if (ornatilganmi()) return "ornatilgan";
  if (window.__appInstallPrompt) return "taklif";   // faqat taklif HAQIQATAN saqlangan bo'lsa tugma
  if (iosmi()) return "ios";
  return "yashirin";
}
function obuna(yangila: () => void) {
  const mq = window.matchMedia("(display-mode: standalone)");
  window.addEventListener("app:installable", yangila);
  window.addEventListener("app:installed", yangila);
  window.addEventListener(OZGARDI, yangila);
  mq.addEventListener("change", yangila);
  return () => {
    window.removeEventListener("app:installable", yangila);
    window.removeEventListener("app:installed", yangila);
    window.removeEventListener(OZGARDI, yangila);
    mq.removeEventListener("change", yangila);
  };
}

const QATOR: React.CSSProperties = {
  width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 9,
  fontSize: 12.5, fontWeight: 500, color: "var(--text-2)", cursor: "pointer", border: "none",
  background: "transparent", transition: "all .12s", textAlign: "left",
};
const ustida = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = "var(--white)"; e.currentTarget.style.color = "var(--text)"; };
const tashqarida = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-2)"; };

const YUKLASH = (<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>);
const ULASHISH = (<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12H6a2 2 0 00-2 2v5a2 2 0 002 2h12a2 2 0 002-2v-5a2 2 0 00-2-2h-2M12 3v12m0-12L8 7m4-4l4 4"/></svg>);

/**
 * Sidebar'dagi "Ilovani o'rnatish" bandi. Uch holat:
 *   • brauzer taklif bergan  → tugma, bosilganda o'rnatish oynasi;
 *   • iPhone/iPad            → Safari taklif bermaydi — qo'lda ko'rsatma;
 *   • o'rnatilgan / taklif yo'q → hech narsa ko'rsatilmaydi.
 */
export default function InstallAppButton() {
  // Hodisa React'dan OLDIN kelgan bo'lsa ham o'qiladi (install-prompt.js saqlab qo'ygan); serverda — yashirin
  const holat = useSyncExternalStore(obuna, holatOl, () => "yashirin" as Holat);
  const [korsatma, setKorsatma] = useState(false);

  const ornat = useCallback(async () => {
    const hodisa = window.__appInstallPrompt;
    // Taklif BIR MARTALIK — prompt() dan OLDIN bo'shatiladi; natijadan qat'i nazar tugma yashirinadi
    // (qabul qilinsa "appinstalled" keladi, rad etilsa yoki xato bo'lsa qayta bosish baribir ishlamaydi)
    window.__appInstallPrompt = null;
    window.dispatchEvent(new Event(OZGARDI));
    if (!hodisa) return;
    try {
      await hodisa.prompt();
      await hodisa.userChoice;
    } catch { /* brauzer rad etdi — tugma allaqachon yashirilgan */ }
  }, []);

  if (holat === "yashirin" || holat === "ornatilgan") return null;

  if (holat === "ios") {
    return (
      <div>
        <button type="button" style={QATOR} onMouseEnter={ustida} onMouseLeave={tashqarida}
          aria-expanded={korsatma} onClick={() => setKorsatma(o => !o)}>
          {ULASHISH}
          Ilovani o&apos;rnatish
        </button>
        {korsatma && (
          <p style={{ margin: "4px 4px 2px", padding: "8px 10px", borderRadius: 9, background: "var(--white)", fontSize: 12, lineHeight: 1.45, color: "var(--text-2)" }}>
            Safari&apos;da «Ulashish» tugmasini bosib, «Ekranga qo&apos;shish»ni tanlang.
          </p>
        )}
      </div>
    );
  }

  return (
    <button type="button" style={QATOR} onMouseEnter={ustida} onMouseLeave={tashqarida} onClick={ornat}>
      {YUKLASH}
      Ilovani o&apos;rnatish
    </button>
  );
}
