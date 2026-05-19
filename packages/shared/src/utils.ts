import type { Mahsulot } from "./types";

export function filterMahsulot(
  mahsulotlar: Mahsulot[],
  search: string,
  onlyActive?: boolean
): Mahsulot[] {
  return mahsulotlar.filter((m) => {
    const matchSearch = m.Nomi.toLowerCase().includes(search.toLowerCase());
    const matchActive = onlyActive === undefined ? true : m.Check === "TRUE" === onlyActive;
    return matchSearch && matchActive;
  });
}

export function formatPrice(value: string, currency: "som" | "dollar"): string {
  if (!value) return "";
  const symbol = currency === "dollar" ? "$" : " so'm";
  const prefix = currency === "dollar" ? "$" : "";
  return currency === "dollar" ? `${prefix}${value}` : `${value}${symbol}`;
}

export function isActive(mahsulot: Mahsulot): boolean {
  return mahsulot.Check === "TRUE";
}
