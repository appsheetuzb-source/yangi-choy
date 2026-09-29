"use client";
import { useEffect } from "react";

/**
 * Brauzerning "stepper" xatti-harakati foydalanuvchi XOHLAMAGAN holda qiymatni
 * o'zgartirishini to'xtatadi. Ilovada shunday maydonlar ko'p:
 *   type=number — 51 ta (soni, miqdor, kurs, summa...)
 *   type=date   — 41 ta
 *   type=time   —  6 ta
 *
 * Nima bloklanadi va NEGA:
 *
 *  • ROLIK (wheel) — BARCHA stepper maydonlarda bloklanadi.
 *    Maydon fokusda turганда ustidan rolik aylantirilsa brauzer qiymatni
 *    o'zgartiradi. Foydalanuvchi esa sahifani skroll qilmoqchi bo'ladi —
 *    shu sababli soni/sana tasodifan almashib ketardi. Har doim xato.
 *
 *  • STRELKALAR (ArrowUp/ArrowDown) va PageUp/PageDown — FAQAT type=number da.
 *    Sanada strelka bilan kun/oy/yilni o'zgartirish — odatiy va foydali
 *    xatti-harakat, uni bloklamaymiz. Raqamli maydonda esa u tasodifiy.
 *
 * Rolikda preventDefault + blur birga ishlatiladi: preventDefault qiymat
 * o'zgarishini qat'iy to'xtatadi, blur esa keyingi aylantirishda sahifa
 * odatdagidek skroll bo'lishini ta'minlaydi (aks holda fokus turganda skroll
 * butunlay bloklanardi).
 *
 * CAPTURE fazasida ulanadi — shunda oradagi komponent stopPropagation qilsa ham
 * ishlaydi. Bitta joyda, AppShell da chaqiriladi va butun ilovaga amal qiladi
 * (ilovada portal ishlatilmaydi, ya'ni hamma hodisa document gacha yetadi).
 */

const STEPPER = new Set(["number", "date", "time", "datetime-local", "month", "week"]);

function stepperInput(t: EventTarget | null): HTMLInputElement | null {
  if (!t || !(t instanceof HTMLInputElement)) return null;
  return STEPPER.has(t.type) ? t : null;
}

export function useNoStepperScroll() {
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const el = stepperInput(e.target);
      if (!el || document.activeElement !== el) return;
      e.preventDefault();
      el.blur();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const el = stepperInput(e.target);
      if (!el || el.type !== "number") return;   // sanada strelka qolsin
      if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "PageUp" || e.key === "PageDown") {
        e.preventDefault();
      }
    };

    // passive:false — preventDefault ishlashi uchun; capture:true — stopPropagation'dan oldin
    document.addEventListener("wheel", onWheel, { passive: false, capture: true });
    document.addEventListener("keydown", onKeyDown, { capture: true });
    return () => {
      document.removeEventListener("wheel", onWheel, { capture: true });
      document.removeEventListener("keydown", onKeyDown, { capture: true });
    };
  }, []);
}
