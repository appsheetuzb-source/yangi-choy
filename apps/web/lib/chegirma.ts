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

export interface XaridBoshi {
  Xarid_ID?: string;
  Taminotchi_ID?: string;
  Sana?: string;
  Sotuv_Raqami?: string;
}

export interface ChegirmaManbasi {
  foiz: number;
  xaridId: string;
  /** Xarid raqami (Sotuv_Raqami) */
  raqam: string;
  sana: string;
}

/**
 * Ta'minotchiga berilgan chegirma — uning ENG OXIRGI chegirmali xarididan olinadi.
 * Chegirma Taminotchi jadvalida saqlanmaydi (u yerda bunday ustun yo'q), shuning uchun
 * har doim xaridlar orqali topiladi. Qaysi xaridda berilgani ham qaytariladi.
 */
export function taminotchiChegirmasi(
  taminotchiId: string,
  xaridlar: XaridBoshi[],
  savatMap: Record<string, ChegirmaQator[]>,
): ChegirmaManbasi | null {
  const key = String(taminotchiId || "").trim();
  if (!key) return null;
  const kalit = (sn?: string) => {
    const [d, m, y] = String(sn || "").split(".");
    return (y || "") + (m || "").padStart(2, "0") + (d || "").padStart(2, "0");
  };
  const royxat = (xaridlar || [])
    .filter(x => String(x.Taminotchi_ID || "").trim() === key)
    .sort((a, b) => kalit(b.Sana).localeCompare(kalit(a.Sana)));
  for (const x of royxat) {
    const xid = String(x.Xarid_ID || "").trim();
    const foiz = xaridFoizi(savatMap[xid] || []);
    if (foiz > 0) {
      return { foiz, xaridId: xid, raqam: String(x.Sotuv_Raqami || ""), sana: String(x.Sana || "") };
    }
  }
  return null;
}

/** "−13% · №685 · 07.08.2026" ko'rinishidagi to'liq matn */
export function chegirmaMatn(ch: ChegirmaManbasi | null): string {
  if (!ch) return "";
  const bolaklar = ["−" + foizMatn(ch.foiz)];
  if (ch.raqam) bolaklar.push("№" + ch.raqam);
  if (ch.sana) bolaklar.push(ch.sana);
  return bolaklar.join(" · ");
}
