import { useEffect } from "react";

// Bir vaqtda nechta oyna qulflab turgani. Asl qiymat faqat BIRINCHI qulfda eslab qolinadi va faqat
// OXIRGI qulf yechilganda tiklanadi — aks holda ikki oyna teskari tartibda yopilsa, body
// "hidden"da qolib, sahifa scroll bo'lmay qolardi.
let faolQulflar = 0;
let asl: { overflow: string; overscroll: string } | null = null;

/**
 * Modal/forma ochilganda orqa fon (body) scroll'ini qulflaydi —
 * shunda faqat forma ichidagi view scroll bo'ladi, orqa sahifa qimirlamaydi.
 * Ishlatish: useScrollLock(addOpen || editOpen || !!deleteTarget)
 */
export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const body = document.body;
    if (faolQulflar === 0) asl = { overflow: body.style.overflow, overscroll: body.style.overscrollBehavior };
    faolQulflar++;
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    return () => {
      faolQulflar = Math.max(0, faolQulflar - 1);
      if (faolQulflar === 0 && asl) {
        body.style.overflow = asl.overflow;
        body.style.overscrollBehavior = asl.overscroll;
        asl = null;
      }
    };
  }, [locked]);
}
