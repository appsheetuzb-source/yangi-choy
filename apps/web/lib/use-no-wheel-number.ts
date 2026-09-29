"use client";
import { useEffect } from "react";

/**
 * <input type="number"> qiymatini foydalanuvchi XOHLAMAGAN holda o'zgartiruvchi
 * brauzer xatti-harakatlarini to'xtatadi:
 *   1) sichqoncha ROLIKI (wheel) — input fokusda bo'lsa qiymat oshadi/kamayadi
 *   2) klaviatura STRELKALARI (ArrowUp / ArrowDown) — qiymatni 1 ga o'zgartiradi
 *   3) PageUp / PageDown — qiymatni katta qadam bilan o'zgartiradi
 *
 * Sotuv va xarid formalarida bu "soni" tasodifan almashib ketishiga olib kelardi.
 * Qiymat faqat qo'lda yozilganda o'zgarishi kerak.
 *
 * Rolik uchun: preventDefault + blur. preventDefault qiymat o'zgarishini QAT'IY
 * to'xtatadi; blur esa keyingi aylantirishlarda sahifa odatdagidek skroll bo'lishini
 * ta'minlaydi (aks holda fokus turganda skroll butunlay bloklanardi).
 *
 * Bitta joyda — AppShell da — ulanadi va butun ilovaga amal qiladi (ilovada 50 dan
 * ortiq raqamli input bor, har biriga alohida handler yozish kerak emas).
 */

function raqamliInput(t: EventTarget | null): HTMLInputElement | null {
  if (!t || !(t instanceof HTMLInputElement)) return null;
  return t.type === "number" ? t : null;
}

export function useNoWheelNumber() {
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const el = raqamliInput(e.target);
      if (!el || document.activeElement !== el) return;
      e.preventDefault();   // qiymat o'zgarmaydi
      el.blur();            // keyingi aylantirishda sahifa skroll bo'ladi
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const el = raqamliInput(e.target);
      if (!el) return;
      if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "PageUp" || e.key === "PageDown") {
        e.preventDefault();
      }
    };

    // wheel — passive: false, aks holda preventDefault ishlamaydi
    document.addEventListener("wheel", onWheel, { passive: false });
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("wheel", onWheel);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);
}
