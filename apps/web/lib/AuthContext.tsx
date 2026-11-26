"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { AuthUser, getUser, setUser, clearUser } from "./auth";
import { invalidateSheet } from "./sheet-cache";
import { taklifniQaytaOch } from "./pwa-install";

// Kirish SERVERDA tekshiriladi (/api/auth/login) — parollar brauzerga hech qachon kelmaydi.
// Server httpOnly sessiya cookie'sini o'rnatadi; localStorage'dagi "yc_user" faqat interfeys
// uchun (ism, rol, ombor). Haqiqiy ruxsatni har bir API so'rovida server cookie bo'yicha beradi.

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (pochta: string, parol: string) => Promise<string | null>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>({
  user: null, loading: true,
  login: async () => "Xato",
  logout: () => {},
});

/** Tizimdan chiqarilish sababi (login sahifasi bir marta o'qib, xabar ko'rsatadi) */
export const CHIQISH_SABABI_KEY = "yc_chiqish_sababi";
const SESSIYA_TEKSHIRUV_MS = 30_000;

const bir = (a: AuthUser, b: AuthUser) =>
  a.id === b.id && a.nomi === b.nomi && a.lavozim === b.lavozim && a.pochta === b.pochta
  && (a.omborId || "") === (b.omborId || "")
  && JSON.stringify(a.omborIds ?? null) === JSON.stringify(b.omborIds ?? null)
  && (a.gaznaIds || []).join(",") === (b.gaznaIds || []).join(",");

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  // Har muvaffaqiyatli kirishda oshadi. 401 javob faqat so'rov YUBORILGANDAN beri qayta kirilmagan bo'lsa
  // chiqaradi — aks holda kirishdan oldin ketgan (cookie'siz) so'rovning kech 401'i yangi sessiyani buzardi.
  const davr = useRef(0);

  // Sessiya tugadi (cookie yo'q/eskirgan, foydalanuvchi nofaol qilingan yoki paroli almashtirilgan).
  // Sabab login sahifasida ko'rsatiladi ("Parolingiz o'zgartirilgan — yangi parol bilan kiring").
  const sessiyaTugadi = useCallback((sabab?: string) => {
    const oldin = getUser();
    if (oldin) {
      try {
        sessionStorage.setItem(CHIQISH_SABABI_KEY, JSON.stringify({
          sabab: sabab === "parol" || sabab === "nofaol" ? sabab : "sessiya",
          pochta: oldin.pochta || "",
        }));
      } catch { /* */ }
    }
    clearUser();
    invalidateSheet();
    setUserState(null);   // AppShell → /login
  }, []);

  // Har qanday /api/ so'rovi 401 qaytarsa — tizimdan chiqariladi (kirish sahifasiga).
  // Ilovada yuzlab to'g'ridan-to'g'ri fetch() bor, shuning uchun bitta umumiy o'rash.
  useEffect(() => {
    const asl = window.fetch;
    const orama: typeof window.fetch = async (input, init) => {
      const boshDavr = davr.current;
      const res = await asl.call(window, input, init);
      let yol = "";
      try {
        const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        const u = new URL(href, window.location.href);
        if (u.origin === window.location.origin) yol = u.pathname;
      } catch { /* URL aniqlanmadi — e'tiborsiz */ }
      // O'z parolini almashtirdi — shu qurilma yangi cookie oldi. Undan OLDIN eski cookie bilan ketgan
      // so'rovlarning kech 401'i bu qurilmani chiqarib yubormasin.
      if (res.ok && yol === "/api/auth/parol") davr.current++;
      if (res.status === 401 && boshDavr === davr.current && yol.startsWith("/api/") && !yol.startsWith("/api/auth/login")) {
        res.clone().json()
          .then((j: { sabab?: string } | null) => sessiyaTugadi(j?.sabab))
          .catch(() => sessiyaTugadi());
      }
      return res;
    };
    window.fetch = orama;
    return () => { if (window.fetch === orama) window.fetch = asl; };
  }, [sessiyaTugadi]);

  useEffect(() => {
    const stored = getUser();
    setUserState(stored);
    setLoading(false);
  }, []);

  // Sessiyani serverdan tekshirish/yangilash — rol/ombor o'zgargan bo'lsa yangilanadi, sessiya yaroqsiz bo'lsa
  // (401: parol almashtirilgan, nofaol) — chiqariladi. Server vaqtincha javob bermasa (503/tarmoq) — tegilmaydi.
  // Ilova ochilganda, har 30 soniyada (ekran ko'rinib turganda) va ilovaga qaytilganda (fokus/tarmoq tiklanishi)
  // chaqiriladi: parol boshqa qurilmada o'zgartirilsa, bu qurilma ham tez orada chiqariladi — ma'lumotlar
  // keshdan ko'rsatilib, server bilan aloqa bo'lmasa ham.
  const tekshirilmoqda = useRef(false);
  const oxirgiTekshiruv = useRef(0);
  const sessiyaniTekshir = useCallback((majburiy = false) => {
    const stored = getUser();
    if (!stored?.id || tekshirilmoqda.current) return;
    if (!majburiy && Date.now() - oxirgiTekshiruv.current < 5_000) return;
    tekshirilmoqda.current = true;
    oxirgiTekshiruv.current = Date.now();
    const boshDavr = davr.current;
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async r => {
        if (boshDavr !== davr.current) return;   // shu orada qayta kirildi/parol almashtirildi — eski javob
        if (r.status === 401) return;           // fetch o'rash sessiyaTugadi'ni sabab bilan chaqiradi
        if (!r.ok) return;
        const j = await r.json().catch(() => null) as { user?: AuthUser } | null;
        const fresh = j?.user;
        const joriy = getUser();
        if (!fresh?.id || !joriy || joriy.id !== fresh.id) return;
        if (!bir(fresh, joriy)) { setUser(fresh); setUserState(fresh); }
      })
      .catch(() => {})
      .finally(() => { tekshirilmoqda.current = false; });
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    sessiyaniTekshir(true);
    const ochiq = () => document.visibilityState === "visible";
    const t = window.setInterval(() => { if (ochiq()) sessiyaniTekshir(); }, SESSIYA_TEKSHIRUV_MS);
    const qaytdi = () => { if (ochiq()) sessiyaniTekshir(); };
    document.addEventListener("visibilitychange", qaytdi);
    window.addEventListener("focus", qaytdi);
    window.addEventListener("online", qaytdi);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", qaytdi);
      window.removeEventListener("focus", qaytdi);
      window.removeEventListener("online", qaytdi);
    };
  }, [user?.id, sessiyaniTekshir]);

  const login = useCallback(async (pochta: string, parol: string): Promise<string | null> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
        body: JSON.stringify({ login: pochta, parol }),
      });
      const j = await res.json().catch(() => null) as { user?: AuthUser; error?: string } | null;
      if (!res.ok || !j?.user?.id) {
        if (j?.error) return j.error;
        return res.status >= 500 ? "Server bilan bog'lanib bo'lmadi. Qayta urinib ko'ring." : "Login yoki parol noto'g'ri";
      }
      davr.current++;
      invalidateSheet();      // oldingi foydalanuvchining keshlangan ma'lumoti qolmasin
      setUser(j.user);
      setUserState(j.user);
      taklifniQaytaOch();     // har kirishda "Ilovani o'rnatish" taklifi qayta ko'rsatiladi
      return null;
    } catch (e) {
      console.error("Login xato:", e);
      return "Tarmoq xatosi. Qayta urinib ko'ring.";
    }
  }, []);

  const logout = useCallback(() => {
    fetch("/api/auth/logout", { method: "POST", cache: "no-store", keepalive: true }).catch(() => {});
    clearUser();
    invalidateSheet();
    setUserState(null);
  }, []);

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() { return useContext(Ctx); }
