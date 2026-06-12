"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { AuthUser, getUser, setUser, clearUser } from "./auth";
import { fetchSheet } from "./sheet-cache";

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = getUser();
    setUserState(stored);
    setLoading(false);

    // Saqlangan sessiyani sheetdan yangilash — rol/ma'lumot o'zgargan bo'lsa
    if (stored?.id) {
      fetch("/api/sheets?range=Foydalanuvchi", { cache: "no-store" })
        .then(r => r.json())
        .then(json => {
          const fresh = (json.data as Record<string,string>[] || []).find(u => u.Foydalanuvchi_ID === stored.id);
          if (!fresh) return;
          if (fresh.Status === "Nofaol") { clearUser(); setUserState(null); return; }
          const updated: AuthUser = {
            id: fresh.Foydalanuvchi_ID,
            nomi: fresh.Nomi,
            lavozim: fresh.Lavozim || "Sotuvchi",
            pochta: fresh.Pochta || fresh.Telefon || stored.pochta,
          };
          if (updated.lavozim !== stored.lavozim || updated.nomi !== stored.nomi) {
            setUser(updated);
            setUserState(updated);
          }
        })
        .catch(() => {});
    }
  }, []);

  const login = useCallback(async (pochta: string, parol: string): Promise<string | null> => {
    try {
      // Cache bypass — har doim fresh data
      const res = await fetch("/api/sheets?range=Foydalanuvchi", { cache: "no-store" });
      const json = await res.json();
      const list = (json.data || []) as Record<string, string>[];

      if (list.length === 0) return "Foydalanuvchilar topilmadi";

      const input = pochta.trim().toLowerCase();
      const found = list.find(u => {
        const pochtaMatch  = (u.Pochta  || "").trim().toLowerCase() === input;
        const telefonMatch = (u.Telefon || "").trim() === pochta.trim();
        const loginMatch   = (u.Login   || "").trim().toLowerCase() === input;
        const parolMatch   = (u.Parol   || "").trim() === parol.trim();
        const active       = u.Status !== "Nofaol";
        return (pochtaMatch || telefonMatch || loginMatch) && parolMatch && active;
      });

      if (!found) return "Login yoki parol noto'g'ri";

      const u: AuthUser = {
        id:      found.Foydalanuvchi_ID,
        nomi:    found.Nomi,
        lavozim: found.Lavozim || "Sotuvchi",
        pochta:  found.Pochta || found.Telefon || pochta,
      };
      setUser(u);
      setUserState(u);
      return null;
    } catch (e) {
      console.error("Login xato:", e);
      return "Tarmoq xatosi. Qayta urinib ko'ring.";
    }
  }, []);

  const logout = useCallback(() => {
    clearUser();
    setUserState(null);
  }, []);

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() { return useContext(Ctx); }
