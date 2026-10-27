"use client";
import { useState } from "react";
import { usePwaHolat, pwaOrnat } from "@/lib/pwa-install";

const QATOR: React.CSSProperties = {
  width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 9,
  fontSize: 12.5, fontWeight: 500, color: "var(--text-2)", cursor: "pointer", border: "none",
  background: "transparent", transition: "all .12s", textAlign: "left",
};
const ustida = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = "var(--white)"; e.currentTarget.style.color = "var(--text)"; };
const tashqarida = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-2)"; };

export const YUKLASH_ICON = (<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>);
const ULASHISH = (<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12H6a2 2 0 00-2 2v5a2 2 0 002 2h12a2 2 0 002-2v-5a2 2 0 00-2-2h-2M12 3v12m0-12L8 7m4-4l4 4"/></svg>);
export const IOS_KORSATMA = "Safari'da «Ulashish» tugmasini bosib, «Ekranga qo'shish»ni tanlang.";

/**
 * Sidebar'dagi "Ilovani o'rnatish" bandi. Uch holat:
 *   • brauzer taklif bergan  → tugma, bosilganda o'rnatish oynasi;
 *   • iPhone/iPad            → Safari taklif bermaydi — qo'lda ko'rsatma;
 *   • o'rnatilgan / taklif yo'q → hech narsa ko'rsatilmaydi.
 */
export default function InstallAppButton() {
  const holat = usePwaHolat();
  const [korsatma, setKorsatma] = useState(false);

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
            {IOS_KORSATMA}
          </p>
        )}
      </div>
    );
  }

  return (
    <button type="button" style={QATOR} onMouseEnter={ustida} onMouseLeave={tashqarida} onClick={pwaOrnat}>
      {YUKLASH_ICON}
      Ilovani o&apos;rnatish
    </button>
  );
}
