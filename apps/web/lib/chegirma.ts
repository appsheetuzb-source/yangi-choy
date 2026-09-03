// Xarid (prixod) chegirma foizi.
//
// DIQQAT: Xarid_Savat.Foiz ustuni ARALASH birlikda saqlangan —
//   • eski (AppSheet davri) qatorlarda ULUSH: 0.12 = 12%, 0.1 = 10%
//   • yangi qatorlarda FOIZ: 13 = 13%, 14 = 14%
// Hozirgi kod narxni `narx * (1 - Foiz/100)` bilan hisoblaydi, ya'ni eski qatorni
// xom holda ko'rsatsak "0.12%" chiqadi — aslida 12%.
//
// Shuning uchun eng ishonchli manba — sotib olish paytida SAQLANGAN Foizli_narx:
//   foiz = (1 - Foizli_narx / Narx) * 100
// U bo'lmasa evristika: qiymat 1 dan kichik bo'lsa ulush deb qabul qilinadi.

function num(v: string | number | undefined | null): number {
  return parseFloat(String(v ?? "0").replace(/\s/g, "").replace(",", ".")) || 0;
}

export interface ChegirmaQator {
  Foiz?: string;
  Narx_som?: string;
  Narxi?: string;
  Foizli_narx?: string;
  Foizli_narx_dollar?: string;
}

/** Bitta savat qatorining chegirma foizi (0 = chegirma yo'q). */
export function qatorFoizi(r: ChegirmaQator): number {
  const xom = num(r.Foiz);
  if (xom <= 0) return 0;

  // 1) Saqlangan chegirmali narxdan haqiqiy foizni chiqaramiz (eng ishonchli)
  const juftlar: [number, number][] = [
    [num(r.Narx_som), num(r.Foizli_narx)],
    [num(r.Narxi), num(r.Foizli_narx_dollar)],
  ];
  for (const [asos, chegirmali] of juftlar) {
    if (asos > 0 && chegirmali > 0 && chegirmali < asos) {
      return (1 - chegirmali / asos) * 100;
    }
  }

  // 2) Zaxira: 1 dan kichik bo'lsa ulush (0.12 -> 12%), aks holda foizning o'zi
  return xom < 1 ? xom * 100 : xom;
}

/** Butun xaridning chegirma foizi — qatorlaridagi eng katta qiymat (0 = yo'q). */
export function xaridFoizi(rows: ChegirmaQator[] | undefined): number {
  if (!rows || !rows.length) return 0;
  return rows.reduce((mx, r) => Math.max(mx, qatorFoizi(r)), 0);
}

/** Ko'rsatish uchun: 12 -> "12%", 12.5 -> "12,5%", 0 -> "" */
export function foizMatn(foiz: number): string {
  if (!foiz) return "";
  const yaxlit = Math.round(foiz * 10) / 10;
  return yaxlit.toLocaleString("ru-RU", { maximumFractionDigits: 1 }) + "%";
}
