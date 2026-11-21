// Blok bilan sotish.
//
// Mahsulotda "Blokdagi_dona" (masalan 15) bo'lsa, sotuvda miqdor BLOK + DONA bilan kiritiladi:
//   1 blok + 3 dona = 1×15 + 3 = 18 dona.
// Narx doim BIR DONA uchun. Sotuv_Savat.Soni = JAMI DONA bo'lib qoladi — ombor, summa, foyda,
// qarz hisoblari O'ZGARMAYDI. Savat qatoridagi "Blok" ustuni faqat qanday kiritilganini
// ko'rsatish uchun (detal va tahrirlashda "1 blok + 3 dona" deb chiqarish).
//
// Kg bilan o'lchanadigan mahsulotda blok bo'lmaydi. Blokdagi_dona bo'sh yoki ≤ 1 bo'lsa —
// mahsulot oddiy dona bilan sotiladi (avvalgi xatti-harakat).
import { birlikOf } from "./birlik";

export interface BlokMahsulot { Birlik?: string; Blokdagi_dona?: string }
/** Formadagi savat qatori: Blok !== undefined bo'lsa — blok rejimi (Blok/Dona kiritiladi, Soni hisoblanadi) */
export interface BlokQator { Mahsulot_ID: string; Soni: string; Blok?: string; Dona?: string }

function son(v: unknown): number {
  const s = String(v ?? "").replace(/\s/g, "").replace(",", ".");
  return s === "" ? NaN : parseFloat(s);
}
const bor = (v: unknown) => Number.isFinite(son(v));

/** Bir blokdagi dona soni; blok yo'q (kg, bo'sh, ≤ 1) bo'lsa 0 */
export function blokdagiDona(m?: BlokMahsulot | null): number {
  if (!m || birlikOf(m) === "kg") return 0;
  const n = son(m.Blokdagi_dona);
  return Number.isFinite(n) && n > 1 ? Math.round(n) : 0;
}

/** Saqlangan qatordan (Soni + Blok) formaga: { Blok, Dona }. Mahsulot bloksiz bo'lsa — undefined (oddiy rejim) */
export function blokYukla(soni: unknown, blok: unknown, m?: BlokMahsulot | null): { Blok?: string; Dona?: string } {
  const n = blokdagiDona(m);
  if (!n) return { Blok: undefined, Dona: undefined };
  const b = bor(blok) ? Math.trunc(son(blok)) : 0;
  const jami = bor(soni) ? son(soni) : 0;
  const d = jami - b * n;
  return { Blok: b ? String(b) : "", Dona: d ? String(Math.round(d * 1000) / 1000) : "" };
}

/** Blok va dona → jami dona (matn). Ikkalasi ham bo'sh bo'lsa "" */
export function soniHisobla(blok: unknown, dona: unknown, n: number): string {
  if (!bor(blok) && !bor(dona)) return "";
  const jami = (bor(blok) ? son(blok) : 0) * n + (bor(dona) ? son(dona) : 0);
  return String(Math.round(jami * 1000) / 1000);
}

/**
 * Qatorda bitta maydon o'zgargandan KEYIN chaqiriladi (o'zgargan qatorning yangi nusxasi bilan).
 *  • Mahsulot_ID o'zgarsa: bloksiz mahsulot → oddiy rejim (Soni saqlanadi).
 *    Blokli mahsulot: qator oldin ham blok rejimida bo'lsa — kiritilgan blok/dona O'ZGARMAYDI, Soni yangi
 *    blok o'lchami bo'yicha qayta hisoblanadi (katakdagi raqamlar sakramaydi); oddiy rejimdan o'tsa —
 *    oldingi Soni saqlanib, to'liq bloklar va qoldiq donaga ajratiladi.
 *  • Blok yoki Dona o'zgarsa: Soni = Blok × n + Dona. Blok faqat BUTUN son (1.5 → 1).
 */
export function blokMosla<T extends BlokQator>(q: T, maydon: string, mMap: Record<string, BlokMahsulot | undefined>): T {
  const n = blokdagiDona(mMap[q.Mahsulot_ID]);
  if (maydon === "Mahsulot_ID") {
    if (!n) return { ...q, Blok: undefined, Dona: undefined };
    if (q.Blok !== undefined) return { ...q, Soni: soniHisobla(q.Blok, q.Dona, n) };
    const jami = bor(q.Soni) ? son(q.Soni) : 0;
    const b = Math.trunc(jami / n), d = jami - b * n;
    return { ...q, Blok: b ? String(b) : "", Dona: d ? String(Math.round(d * 1000) / 1000) : "" };
  }
  if ((maydon === "Blok" || maydon === "Dona") && n && q.Blok !== undefined) {
    const blok = maydon === "Blok" ? String(q.Blok).replace(/[.,].*$/, "") : q.Blok;
    return { ...q, Blok: blok, Soni: soniHisobla(blok, q.Dona, n) };
  }
  return q;
}

/** Savat qatoriga yoziladigan "Blok" qiymati: blok rejimida kiritilgan blok soni, aks holda "" */
export function blokSaqla(q: { Blok?: string }): string {
  if (q.Blok === undefined || !bor(q.Blok)) return "";
  const b = Math.trunc(son(q.Blok));
  return b ? String(b) : "";
}

/**
 * Faqat Soni o'zgartiriladigan joylar uchun (ommaviy tahrir, bitta qator tahriri):
 * qator avval blok bilan kiritilgan bo'lsa — yangi Soni'dan blok qayta hisoblanadi, aks holda "".
 */
export function blokQaytaHisob(soni: unknown, eskiBlok: unknown, m?: BlokMahsulot | null): string {
  const n = blokdagiDona(m);
  if (!n || !bor(eskiBlok) || !son(eskiBlok) || !bor(soni)) return "";
  const b = Math.trunc(son(soni) / n);
  return b ? String(b) : "";
}

/**
 * Bitta qator / ommaviy tahrir saqlanganda yoziladigan Blok. Soni ham, mahsulot ham o'zgarmagan bo'lsa
 * (masalan faqat narx yoki izoh tahrirlandi) — eski Blok o'z holicha qoladi ("1 blok + 20 dona" buzilmaydi);
 * aks holda yangi Soni'dan qayta hisoblanadi (blokQaytaHisob).
 */
export function blokTahrir(
  eski: { Soni?: unknown; Blok?: unknown; Mahsulot_ID?: unknown },
  yangiSoni: unknown, yangiMahsulotId: unknown, m?: BlokMahsulot | null,
): string {
  const ozgarmagan = String(yangiMahsulotId ?? "").trim() === String(eski.Mahsulot_ID ?? "").trim()
    && bor(yangiSoni) && bor(eski.Soni) && son(yangiSoni) === son(eski.Soni);
  if (ozgarmagan) {
    if (!bor(eski.Blok)) return "";
    const b = Math.trunc(son(eski.Blok));
    return b ? String(b) : "";
  }
  return blokQaytaHisob(yangiSoni, eski.Blok, m);
}

function fmt(v: number): string { return (Math.round(v * 1000) / 1000).toLocaleString("ru-RU"); }

/**
 * "2 blok", "1 blok + 3 dona", "-1 blok − 3 dona". Blok yo'q bo'lsa "".
 * Qoldiq doim ANIQ ko'rsatiladi (Soni = blok × n ± qoldiq): "1 blok + 20 dona" ham shunday chiqadi —
 * faqat "1 blok" deb qisqartirilsa, 35 donani 1 blok deb o'qish mumkin edi.
 */
export function blokMatn(soni: unknown, blok: unknown, m?: BlokMahsulot | null): string {
  const n = blokdagiDona(m);
  if (!bor(blok) || !son(blok)) return "";
  const b = Math.trunc(son(blok));
  const asos = `${fmt(b)} blok`;
  if (!n || !bor(soni)) return asos;
  const d = Math.round((son(soni) - b * n) * 1000) / 1000;
  if (d === 0) return asos;
  return `${asos} ${d > 0 ? "+" : "−"} ${fmt(Math.abs(d))} dona`;
}

/** Detalda soni ostidagi izoh: blok bilan bo'lsa "1 blok + 3 dona", aks holda birligi ("dona" / "kg") */
export function soniIzoh(soni: unknown, blok: unknown, m?: BlokMahsulot | null): string {
  return blokMatn(soni, blok, m) || birlikOf(m);
}
