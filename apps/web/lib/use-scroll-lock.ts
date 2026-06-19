import { useEffect } from "react";

/**
 * Modal/forma ochilganda orqa fon (body) scroll'ini qulflaydi —
 * shunda faqat forma ichidagi view scroll bo'ladi, orqa sahifa qimirlamaydi.
 * Ishlatish: useScrollLock(addOpen || editOpen || !!deleteTarget)
 */
export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevOverscroll = body.style.overscrollBehavior;
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    return () => {
      body.style.overflow = prevOverflow;
      body.style.overscrollBehavior = prevOverscroll;
    };
  }, [locked]);
}
