"use client";
import { useEffect, useRef, useState } from "react";

// Sahifa ORQAGA/OLDINGA qaytish bilan ochildimi (brauzer/telefon "orqaga" tugmasi, sahifadagi router.back())
// yoki yangi o'tish bilanmi (menyu, havola — Next history.pushState qiladi)?
//  1) Navigation API bor brauzerlarda (Chrome, Edge, Android) — aniq: oxirgi "push"/"traverse" qaysi biri.
//     "replace" e'tiborsiz: Next orqaga qaytgandan keyin ham tarixni replaceState bilan yangilaydi.
//  2) Aks holda — oxirgi popstate mount paytiga juda yaqin bo'lsa (React popstate renderini sinxron bajaradi).
let songgiTur: string | null = null;
let songgiPopstate = 0;
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => { songgiPopstate = Date.now(); });
  const navigation = (window as unknown as { navigation?: EventTarget }).navigation;
  navigation?.addEventListener?.("navigate", e => {
    const tur = (e as Event & { navigationType?: string }).navigationType;
    if (tur === "push" || tur === "traverse" || tur === "reload") songgiTur = tur;
  });
}
const ORQAGA_OYNA_MS = 1500;   // zaxira usul: popstate va mount orasidagi eng katta farq
const TIKLASH_MAX_MS = 6000;   // ma'lumot kech kelsa ham shuncha vaqt sahifa balandligini kutamiz
const QADAM_MS = 40;           // tiklash urinishlari oralig'i (rAF emas — fon/yashirin oynada to'xtab qolmaydi)
const SAQLASH_MS = 120;        // skroll joyini saqlash chastotasi
const BARQAROR_MS = 400;       // maqsadga yetgach joy shuncha vaqt o'zgarmay tursa — tiklash tugadi

function orqagaQaytishmi(mountT: number): boolean {
  if (songgiTur !== null) return songgiTur === "traverse";
  return songgiPopstate > 0 && Math.abs(songgiPopstate - mountT) < ORQAGA_OYNA_MS;
}

interface Saqlangan { y: number; shown?: number }

/** Oxirgi saqlangan joy (yo'q bo'lsa null). Orqaga qaytishmi-yo'qmi — alohida tekshiriladi */
function saqlanganJoy(kalit: string): Saqlangan | null {
  if (typeof window === "undefined") return null;
  try {
    const s = JSON.parse(sessionStorage.getItem(kalit) || "null") as Saqlangan | null;
    return s && typeof s.y === "number" && s.y > 0 ? s : null;
  } catch { return null; }
}

/**
 * Ro'yxat sahifasida skroll joyini eslab qoladi va ORQAGA qaytilganda (masalan detaildan) tiklaydi.
 *  - Skroll paytida sessionStorage'ga { y, shown } yoziladi (shown — windowing'da nechta karta chizilgani).
 *  - Sahifa orqaga qaytish bilan ochilsa: `tayyor` bo'lgach shown tiklanadi va sahifa yetarli balandlikka
 *    yetguncha (maks. 6 s) o'sha joyga skroll qilinadi. Foydalanuvchi o'zi skroll qilsa/bossa — to'xtaydi.
 *  - Menyudan yangi ochilsa — avvalgidek tepadan boshlanadi.
 * Hook windowing'ni qayta tiklovchi effektlardan (setShown(60)) KEYIN chaqirilishi kerak.
 */
export function useSkrollTiklash(kalit: string, tayyor: boolean, shown?: number, setShown?: (n: number) => void) {
  // Maqsad mount paytida bir marta o'qiladi — keyingi skroll hodisalari (sahifa qisqarib 0 ga tushishi) uni bosib ketmasin
  const [maqsad] = useState(() => saqlanganJoy(kalit));
  // Orqaga qaytishmi? React popstate paytidagi renderni SINXRON bajaradi — sahifa bizning popstate
  // tinglovchimiz ishlashidan OLDIN mount bo'ladi. Shuning uchun bir tick keyin (hodisa tugagach) tekshiramiz.
  const [orqaga, setOrqaga] = useState(false);
  useEffect(() => {
    if (!maqsad) return;
    const mountT = Date.now();
    const t = setTimeout(() => {
      if (orqagaQaytishmi(mountT)) setOrqaga(true);
      // Yangi o'tish (menyu, havola, qayta yuklash): eski joy endi bu ro'yxatga tegishli emas. O'chirilmasa —
      // foydalanuvchi skroll qilmay detailga kirib qaytganda eski (boshqa safar qolgan) joyga sakrardi.
      else { try { sessionStorage.removeItem(kalit); } catch { /* */ } }
    }, 0);
    return () => clearTimeout(t);
  }, [maqsad, kalit]);
  const tugadi = useRef(false);
  const shownRef = useRef(shown);
  useEffect(() => { shownRef.current = shown; }, [shown]);

  // Joriy joyni saqlash (SAQLASH_MS da ko'pi bilan bir marta).
  // Faqat shu sahifa manzilida: detailga o'tilganda Next yangi sahifani tepaga skroll qiladi — o'sha hodisa
  // (eski sahifa effekti hali olib tashlanmagan paytda keladi) saqlangan joyni 0 bilan bosib ketmasin.
  useEffect(() => {
    const yol = window.location.pathname;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const saqla = () => {
      timer = null;
      if (window.location.pathname !== yol) return;
      try { sessionStorage.setItem(kalit, JSON.stringify({ y: Math.round(window.scrollY), shown: shownRef.current })); } catch { /* */ }
    };
    const onScroll = () => { if (!timer) timer = setTimeout(saqla, SAQLASH_MS); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (timer) clearTimeout(timer); };
  }, [kalit]);

  // Orqaga qaytilganda tiklash
  useEffect(() => {
    const t = maqsad;
    if (!tayyor || !orqaga || !t || tugadi.current) return;
    if (setShown && t.shown && t.shown > (shownRef.current ?? 0)) setShown(t.shown);

    const boshlandi = Date.now();
    const hodisalar = ["wheel", "touchstart", "keydown", "mousedown"] as const;
    let timer: ReturnType<typeof setTimeout> | null = null, toxtadi = false;
    const bekor = () => {
      toxtadi = true;
      if (timer) clearTimeout(timer);
      hodisalar.forEach(h => window.removeEventListener(h, tugat));
    };
    // Tugadi (yetib keldi / vaqt o'tdi / foydalanuvchi o'zi harakat qildi) — boshqa tiklanmaydi
    function tugat() { tugadi.current = true; bekor(); }
    // Maqsadga yetgach ham BARQAROR_MS davomida kuzatiladi: shu orada yangi kartalar/ma'lumot chizilib
    // joy siljisa — qayta to'g'rilanadi.
    let yetdi = 0;
    const qadam = () => {
      timer = null;
      if (toxtadi) return;
      const maxY = document.documentElement.scrollHeight - window.innerHeight;
      if (Math.abs(window.scrollY - t.y) >= 2) window.scrollTo(0, Math.min(t.y, Math.max(0, maxY)));
      const joyida = maxY >= t.y && Math.abs(window.scrollY - t.y) < 2;
      if (!joyida) yetdi = 0; else if (!yetdi) yetdi = Date.now();
      if ((yetdi && Date.now() - yetdi >= BARQAROR_MS) || Date.now() - boshlandi > TIKLASH_MAX_MS) { tugat(); return; }
      timer = setTimeout(qadam, QADAM_MS);
    };
    hodisalar.forEach(h => window.addEventListener(h, tugat, { passive: true }));
    timer = setTimeout(qadam, 0);
    return bekor; // unmount (yoki dev StrictMode qayta ishga tushirishi) — tugadi belgilanmaydi
  }, [tayyor, orqaga, setShown, maqsad]);
}
