"use client";
import { useState, useEffect, useRef, Dispatch, SetStateAction } from "react";

/**
 * useState kabi, lekin qiymatni localStorage'da saqlaydi.
 * Detailga o'tib qaytganda (sahifa qayta mount bo'lganda) filter/qidiruv tiklanadi.
 * key — har view+filter uchun UNIKAL bo'lishi shart (masalan "flt:mijozlar:search").
 * Doimiy saqlanadi — foydalanuvchi o'zgartirmaguncha qoladi (tab/brauzer yopilsa ham).
 *
 * SSR-xavfsiz: boshlang'ich render `initial` bilan (server bilan mos), so'ng
 * mount'da localStorage'dan tiklanadi. Birinchi yozuv o'tkazib yuboriladi —
 * shunda tiklash paytida initial qiymat saqlangan qiymatni bosib ketmaydi.
 */
export function usePersistedState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(initial);
  const skipFirstWrite = useRef(true);

  // Mount'da localStorage'dan tiklash (client-only)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) setState(JSON.parse(raw) as T);
    } catch { /* buzilgan qiymat — e'tiborsiz */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // O'zgarganda saqlash — birinchi (mount, initial) yozuv o'tkazib yuboriladi
  useEffect(() => {
    if (skipFirstWrite.current) { skipFirstWrite.current = false; return; }
    try { localStorage.setItem(key, JSON.stringify(state)); } catch { /* to'lgan/bloklangan */ }
  }, [key, state]);

  return [state, setState];
}
