"use client";
import { useEffect } from "react";

/**
 * <input type="number"> ustida sichqoncha rolikini aylantirganda brauzer QIYMATNI
 * o'zgartiradi — bu sotuv/xarid formalarida sonlar tasodifan almashib ketishiga olib
 * kelardi (foydalanuvchi sahifani skroll qilmoqchi bo'lganda soni o'zgarib qolardi).
 *
 * Yechim: rolik aylantirilganda fokusdagi raqamli input fokusdan chiqariladi —
 * shunda brauzer qiymatni o'zgartirmaydi, lekin sahifa odatdagidek skroll bo'ladi.
 * (preventDefault qilsak sahifa ham skroll bo'lmay qolardi.)
 *
 * Bitta joyda — AppShell da — ulanadi va butun ilovaga amal qiladi, shuning uchun
 * har bir inputga alohida onWheel yozish kerak emas (ilovada 50 dan ortiq shunday input bor).
 */
export function useNoWheelNumber() {
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el || !(el instanceof HTMLInputElement)) return;
      if (el.type !== "number") return;
      // Faqat fokusdagi input qiymatini o'zgartiradi — shuni bekor qilamiz
      if (document.activeElement !== el) return;
      el.blur();
    };
    // passive: rolik hodisasini to'xtatmaymiz, faqat fokusni olib tashlaymiz
    document.addEventListener("wheel", onWheel, { passive: true });
    return () => document.removeEventListener("wheel", onWheel);
  }, []);
}
