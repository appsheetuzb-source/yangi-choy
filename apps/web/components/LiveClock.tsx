"use client";
import { useState, useEffect, CSSProperties } from "react";

/**
 * Jonli soat (HH:MM:SS) — har sekund yangilanadi.
 * ALOHIDA komponent: har-sekund yangilanish faqat shu span'ni qayta chizadi,
 * ota-forma (Sana input va h.k.) qayta render bo'lmaydi.
 */
export default function LiveClock({ style }: { style?: CSSProperties }) {
  const [t, setT] = useState("");
  useEffect(() => {
    const p = (n: number) => String(n).padStart(2, "0");
    const tick = () => { const d = new Date(); setT(p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds())); };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);
  return (
    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-3)", fontVariantNumeric: "tabular-nums", textAlign: "center", whiteSpace: "nowrap", ...style }}>{t}</span>
  );
}
