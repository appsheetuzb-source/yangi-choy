// Blok bilan sotish.
//
// Mahsulotda "Blokdagi_dona" (masalan 15 yoki 12,5) bo'lsa, sotuvda miqdor BLOK + DONA bilan kiritiladi:
//   1 blok + 3 dona = 1×15 + 3 = 18 dona;   2 blok (12,5 lik) = 25 dona.
// Narx doim BIR DONA uchun. Sotuv_Savat.Soni = JAMI DONA bo'lib qoladi — ombor, summa, foyda,
// qarz hisoblari O'ZGARMAYDI. Savat qatoridagi "Blok" ustuni faqat qanday kiritilganini
// ko'rsatish uchun (detal va tahrirlashda "1 blok + 3 dona" deb chiqarish). Blok soni doim BUTUN.
//
// Blok o'lchami KASR bo'lishi mumkin (12,5 / 13,3) — 3 xonagacha. Shuning uchun bo'lish/ajratish
// MINGDAN BIRLARDA butun sonlar bilan qilinadi: 39,9 / 13,3 suzuvchi nuqtada 2,9999… bo'lib, 3 blok
// o'rniga "2 blok + 13,3 dona" chiqardi.
//
// Kg bilan o'lchanadigan mahsulotda blok bo'lmaydi. Blokdagi_dona bo'sh yoki ≤ 1 bo'lsa —
// mahsulot oddiy dona bilan sotiladi (avvalgi xatti-harakat).
import { birlikOf, fmtSon, miqdor3 } from "./birlik";

export interface BlokMahsulot { Birlik?: string; Blokdagi_dona?: string }
/** Formadagi savat qatori: Blok !== undefined bo'lsa — blok rejimi (Blok/Dona kiritiladi, Soni hisoblanadi) */
export interface BlokQator { Mahsulot_ID: string; Soni: string; Blok?: string; Dona?: string }

function son(v: unknown): number {
  const s = String(v ?? "").replace(/\s/g, "").replace(",", ".");
  return s === "" ? NaN : parseFloat(s);
}
const bor = (v: unknown) => Number.isFinite(son(v));
/** Mingdan birlarda butun son: 13.3 → 13300 (aniq hisob uchun) */
const milli = (v: number) => Math.round(v * 1000);

/** Bir blokdagi dona soni (3 xonagacha kasr: 15, 12.5, 13.3); blok yo'q (kg, bo'sh, ≤ 1) bo'lsa 0 */
export function blokdagiDona(m?: BlokMahsulot | null): number {
  if (!m || birlikOf(m) === "kg") return 0;
  const n = son(m.Blokdagi_dona);
  if (!Number.isFinite(n)) return 0;
  const r = miqdor3(n);
  return r > 1 ? r : 0;
}

/** Jami donani butun bloklarga (nolga qarab) va qoldiq donaga ajratish — aniq: 39,9 ÷ 13,3 → { b: 3, d: 0 } */
function ajrat(jami: number, n: number): { b: number; d: number } {
  const J = milli(jami), N = milli(n);
  const b = Math.trunc(J / N) || 0;
  return { b, d: (J - b * N) / 1000 || 0 };
}

/** Saqlangan qatordan (Soni + Blok) formaga: { Blok, Dona }. Mahsulot bloksiz bo'lsa — undefined (oddiy rejim) */
export function blokYukla(soni: unknown, blok: unknown, m?: BlokMahsulot | null): { Blok?: string; Dona?: string } {
  const n = blokdagiDona(m);
  if (!n) return { Blok: undefined, Dona: undefined };
  const b = bor(blok) ? Math.trunc(son(blok)) || 0 : 0;
  const jami = bor(soni) ? son(soni) : 0;
  const d = (milli(jami) - b * milli(n)) / 1000 || 0;
  return { Blok: b ? String(b) : "", Dona: d ? String(d) : "" };
}

/** Blok va dona → jami dona (matn, 3 xonagacha). Ikkalasi ham bo'sh bo'lsa "" */
export function soniHisobla(blok: unknown, dona: unknown, n: number): string {
  if (!bor(blok) && !bor(dona)) return "";
  const J = Math.round((bor(blok) ? son(blok) : 0) * milli(n)) + (bor(dona) ? milli(son(dona)) : 0);
  return String(J / 1000 || 0);
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
    const { b, d } = ajrat(bor(q.Soni) ? son(q.Soni) : 0, n);
    return { ...q, Blok: b ? String(b) : "", Dona: d ? String(d) : "" };
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
  const { b } = ajrat(son(soni), n);
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

/**
 * "2 blok", "1 blok + 3 dona", "1 blok + 0,5 dona", "-1 blok − 3 dona". Blok yo'q bo'lsa "".
 * Qoldiq doim ANIQ ko'rsatiladi (Soni = blok × n ± qoldiq): "1 blok + 20 dona" ham shunday chiqadi —
 * faqat "1 blok" deb qisqartirilsa, 35 donani 1 blok deb o'qish mumkin edi.
 */
export function blokMatn(soni: unknown, blok: unknown, m?: BlokMahsulot | null): string {
  const n = blokdagiDona(m);
  if (!bor(blok) || !son(blok)) return "";
  const b = Math.trunc(son(blok));
  const asos = `${fmtSon(b)} blok`;
  if (!n || !bor(soni)) return asos;
  const d = (milli(son(soni)) - b * milli(n)) / 1000 || 0;
  if (d === 0) return asos;
  return `${asos} ${d > 0 ? "+" : "−"} ${fmtSon(Math.abs(d))} dona`;
}

/** Detalda soni ostidagi izoh: blok bilan bo'lsa "1 blok + 3 dona", aks holda birligi ("dona" / "kg") */
export function soniIzoh(soni: unknown, blok: unknown, m?: BlokMahsulot | null): string {
  return blokMatn(soni, blok, m) || birlikOf(m);
}
