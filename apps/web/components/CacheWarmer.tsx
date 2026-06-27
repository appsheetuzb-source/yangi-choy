"use client";
// Ilova ochilganda (login bo'lgach) eng ko'p ishlatiladigan sheet'larni FONDA oldindan keshlaydi.
// SWR kesh bilan birga — foydalanuvchi birinchi marta navigatsiya qilganda ma'lumot allaqachon tayyor.

import { useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { fetchSheets } from "@/lib/sheet-cache";

export default function CacheWarmer() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    // Yengil, ko'p ishlatiladigan sheet'lar — darrov
    fetchSheets(["Mahsulot", "Mijozlar", "Foydalanuvchi", "Gazna", "Kurs", "Sotuv"]).catch(() => {});
    // Og'irlari — joriy sahifa yuklanishiga xalal bermasligi uchun biroz keyin
    const t = setTimeout(() => {
      if (cancelled) return;
      fetchSheets(["Sotuv_Savat", "Sotuv_savat_dollar", "S_tolov"]).catch(() => {});
    }, 1800);
    return () => { cancelled = true; clearTimeout(t); };
  }, [user]);
  return null;
}
