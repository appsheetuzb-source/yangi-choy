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
    // Kichik reference sheet'lar — darrov. Transaction sheet'lar sahifa kerak qilganda olinadi.
    fetchSheets(["Mahsulot", "Foydalanuvchi", "Gazna", "Kurs"]).catch(() => {});
    // Mijozlar ko'p ishlatiladi, lekin katta bo'lishi mumkin; biroz keyinroq iliqlatamiz.
    const t = setTimeout(() => {
      if (cancelled) return;
      fetchSheets(["Mijozlar"]).catch(() => {});
    }, 2200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [user]);
  return null;
}
