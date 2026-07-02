import { useState, useEffect } from "react";
import { fetchSheet } from "@/lib/sheet-cache";

/**
 * Berilgan sheet'dan oldin yozilgan barcha izohlarning takrorsiz ro'yxatini qaytaradi.
 * IzohSelect (combobox) uchun manba — "oldingi izohlar + yangi yozish".
 * fetchSheet keshlangani uchun arzon; har forma o'z sheet'ini beradi.
 */
export function useIzohOptions(sheet: string, field: string = "Izoh"): string[] {
  const [opts, setOpts] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    fetchSheet(sheet)
      .then(j => {
        if (!alive || (j as { error?: string }).error) return;
        const set = new Set<string>();
        (j.data as Record<string, string>[]).forEach(r => {
          const v = (r[field] || "").trim();
          if (v) set.add(v);
        });
        setOpts(Array.from(set).sort((a, b) => a.localeCompare(b, "uz")));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [sheet, field]);
  return opts;
}
