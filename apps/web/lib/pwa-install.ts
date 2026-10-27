"use client";
// PWA "Ilovani o'rnatish" — umumiy holat (sidebar tugmasi va o'ng pastdagi taklif kartasi uchun).
// public/install-prompt.js (layout.tsx, beforeInteractive) brauzer taklifini React'dan OLDIN
// window.__appInstallPrompt ga saqlaydi va "app:installable" / "app:installed" hodisalarini yuboradi.
import { useSyncExternalStore } from "react";

// Chrome/Edge (kompyuter va Android) beradigan hodisa — lib.dom da yo'q
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    __appInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

/** taklif — brauzer o'rnatishni taklif qilgan; ios — Safari (qo'lda ko'rsatma); qolganida ko'rsatilmaydi */
export type PwaHolat = "yashirin" | "taklif" | "ios" | "ornatilgan";
const OZGARDI = "app:install-changed";   // taklif ishlatilganda ichki xabar

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

function holatOl(): PwaHolat {
  if (ornatilganmi()) return "ornatilgan";
  if (window.__appInstallPrompt) return "taklif";   // faqat taklif HAQIQATAN saqlangan bo'lsa
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

/** Joriy holat; serverda — "yashirin" (hydration mos keladi) */
export function usePwaHolat(): PwaHolat {
  return useSyncExternalStore(obuna, holatOl, () => "yashirin" as PwaHolat);
}

/**
 * Brauzerning o'rnatish oynasini ochadi. Taklif BIR MARTALIK — prompt() dan OLDIN bo'shatiladi,
 * natijadan qat'i nazar tugma/karta yashirinadi (qabul qilinsa "appinstalled" keladi; rad etilsa
 * yoki xato bo'lsa qayta bosish baribir ishlamaydi).
 */
export async function pwaOrnat(): Promise<void> {
  const hodisa = window.__appInstallPrompt;
  window.__appInstallPrompt = null;
  window.dispatchEvent(new Event(OZGARDI));
  if (!hodisa) return;
  try {
    await hodisa.prompt();
    await hodisa.userChoice;
  } catch { /* brauzer rad etdi */ }
}

// ── O'ng pastdagi taklif kartasi: yopilgani (foydalanuvchi bo'yicha) ──
// Har kirishda (login) qayta ko'rsatiladi — AuthContext login'da tozalaydi.
const YOPILGAN_KEY = "pwa_taklif_yopilgan";
export function taklifYopilganmi(userId: string): boolean {
  try { return localStorage.getItem(YOPILGAN_KEY) === userId; } catch { return false; }
}
export function taklifniYop(userId: string): void {
  try { localStorage.setItem(YOPILGAN_KEY, userId); } catch { /* */ }
}
export function taklifniQaytaOch(): void {
  try { localStorage.removeItem(YOPILGAN_KEY); } catch { /* */ }
}
