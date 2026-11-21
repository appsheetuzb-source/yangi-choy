// Sessiya + foydalanuvchi (server). API yo'llari ishlatadi; proxy.ts EMAS (u faqat lib/sessiya.ts imzosini tekshiradi).
import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getSheetData } from "./sheets";
import { parseGaznaIds } from "./auth";
import { SESSIYA_COOKIE, sessiyaOqi, parolIzi } from "./sessiya";

type Qator = Record<string, string>;
const tr = (v: unknown) => String(v ?? "").trim();

/** Maxfiy ustunlar — API javoblarida HECH QACHON yuborilmaydi va ular bo'yicha filtrlab bo'lmaydi */
export const MAXFIY_USTUNLAR = ["Parol", "Telegram_Token"];
const MAXFIY_KICHIK = MAXFIY_USTUNLAR.map(c => c.toLowerCase());
export function maxfiyUstunmi(ustun: unknown): boolean {
  return MAXFIY_KICHIK.includes(tr(ustun).toLowerCase());
}

export const FOYDALANUVCHI = "Foydalanuvchi";

/**
 * API'ga keladigan jadval nomi faqat oddiy identifikator bo'lishi kerak (ilovadagi barcha jadvallar shunday:
 * Sotuv_Savat, S_tolov, Muhlat_Uzaytirish ...). "!", ":", bo'sh joy, qo'shtirnoq — rad etiladi:
 *  - PG'da "!Foydalanuvchi" ham foydalanuvchi jadvaliga tushardi (Admin tekshiruvini aylanib o'tish);
 *  - Sheets rejimida "Foydalanuvchi!A2:Z" sarlavhasiz o'qilib, parollar ustun nomi sifatida chiqib ketardi.
 */
export function jadvalNomiTogrimi(sheet: unknown): boolean {
  return typeof sheet === "string" && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(sheet);
}
const pgNomi = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
/** lib/sheets.ts qaysi jadvalga olib borishi mumkin bo'lsa — PG qoidasi ham, Sheets varaq qismi ham tekshiriladi */
export function foydalanuvchiJadvalimi(sheet: unknown): boolean {
  const t = String(sheet ?? "");
  return pgNomi(t) === "foydalanuvchi" || pgNomi(t.split("!")[0].replace(/['"]/g, "")) === "foydalanuvchi";
}

/** Brauzerga beriladigan foydalanuvchi ko'rinishi (parolsiz) — lib/auth.ts AuthUser bilan bir xil */
export interface OchiqFoydalanuvchi {
  id: string; nomi: string; lavozim: string; pochta: string; omborId: string; gaznaIds: string[];
}
export function ochiqKorinish(u: Qator, kiritilganLogin = ""): OchiqFoydalanuvchi {
  return {
    id: tr(u.Foydalanuvchi_ID),
    nomi: tr(u.Nomi),
    lavozim: tr(u.Lavozim) || "Sotuvchi",
    pochta: tr(u.Pochta) || tr(u.Telefon) || kiritilganLogin,
    omborId: tr(u.Ombor_ID),
    gaznaIds: parseGaznaIds(u.Gazna_ID),
  };
}

/** Barcha foydalanuvchilar; o'qib bo'lmasa (DB xatosi) — null */
export async function foydalanuvchilar(): Promise<Qator[] | null> {
  try {
    const r = await getSheetData(FOYDALANUVCHI);
    const data = (r.data || []) as Qator[];
    return (r.headers || []).length > 0 && data.length > 0 ? data : null;
  } catch { return null; }
}

export type SessiyaNatija =
  | { holat: "ok"; u: Qator }
  | { holat: "yoq" }       // sessiya yo'q / yaroqsiz / foydalanuvchi nofaol / parol almashgan → 401
  | { holat: "xato" };     // foydalanuvchilarni o'qib bo'lmadi → 503 (tizimdan CHIQARILMAYDI)

/** So'rovdagi sessiya cookie → faol foydalanuvchi */
export async function sessiyaFoydalanuvchisi(req: NextRequest): Promise<SessiyaNatija> {
  const s = sessiyaOqi(req.cookies.get(SESSIYA_COOKIE)?.value);
  if (!s) return { holat: "yoq" };
  const royxat = await foydalanuvchilar();
  if (!royxat) return { holat: "xato" };
  const u = royxat.find(x => tr(x.Foydalanuvchi_ID) === s.id);
  if (!u || tr(u.Status) === "Nofaol") return { holat: "yoq" };
  if (parolIzi(u.Foydalanuvchi_ID, u.Parol) !== s.p) return { holat: "yoq" };   // parol almashtirilgan — eski sessiya bekor
  return { holat: "ok", u };
}

export function adminmi(u: Qator): boolean { return tr(u.Lavozim) === "Admin"; }

/**
 * API yo'li boshida: sessiya egasini qaytaradi yoki tayyor xato javobini (401 / 503).
 *   const s = await sessiyaTalab(req); if ("javob" in s) return s.javob;
 */
export async function sessiyaTalab(req: NextRequest): Promise<{ u: Qator } | { javob: NextResponse }> {
  const s = await sessiyaFoydalanuvchisi(req);
  if (s.holat === "ok") return { u: s.u };
  const xato = s.holat === "xato"
    ? { matn: "Server bilan bog'lanib bo'lmadi. Qayta urinib ko'ring.", status: 503 }
    : { matn: "Avtorizatsiya kerak. Qaytadan kiring.", status: 401 };
  return { javob: NextResponse.json({ error: xato.matn }, { status: xato.status, headers: { "Cache-Control": "no-store" } }) };
}

/**
 * Javobdan maxfiy ustunlarni olib tashlaydi. Keshdagi obyektlarni O'ZGARTIRMAYDI (nusxa qaytaradi).
 * Maxfiy ustuni yo'q jadvallar (deyarli hammasi) o'zgarishsiz, nusxalanmay qaytadi.
 */
export function maxfiyniOlibTashla<T extends { headers?: string[]; data?: Record<string, unknown>[] }>(res: T): T {
  if (!res || typeof res !== "object") return res;
  const rows = Array.isArray(res.data) ? res.data : [];
  const sarlavhadaBor = (res.headers || []).some(maxfiyUstunmi);
  const qatordaBor = !sarlavhadaBor && rows.length > 0 && Object.keys(rows[0] || {}).some(maxfiyUstunmi);
  if (!sarlavhadaBor && !qatordaBor) return res;
  const headers = (res.headers || []).filter(h => !maxfiyUstunmi(h));
  const data = rows.map(row => {
    const nusxa: Record<string, unknown> = {};
    for (const k of Object.keys(row || {})) if (!maxfiyUstunmi(k)) nusxa[k] = row[k];
    return nusxa;
  });
  return { ...res, headers, data };
}

// ── Noto'g'ri urinishlarni cheklash (login va parol almashtirish) ──
// Bitta PM2 jarayoni — xotiradagi hisoblagich yetarli. Kalitlar xeshlanadi (uzun matn xotirani to'ldirmaydi),
// eskirganlari har chaqiriqda tozalanadi, xarita hajmi chegaralangan.
//  - ip+login: 10 ta xato / 15 daqiqa — asosiy to'siq (shu qurilmadan parol tanlash);
//  - ip: 100 ta — bitta tarmoqdan ko'p loginlarni sinash (ofisdagi ommaviy qayta kirish bunga yetmaydi);
//  - login: 200 ta — turli IP'lardan bitta akkauntga hujum. Past qo'yilmagan: aks holda begona odam
//    ataylab xato urinib, haqiqiy egani (masalan Admin'ni) bloklab qo'yishi mumkin edi.
const URINISH_OYNA_MS = 15 * 60 * 1000;
const XARITA_MAX = 20_000;
export interface UrinishKalit { k: string; max: number }
const urinishlar = new Map<string, { soni: number; boshi: number }>();
const iz = (s: string) => createHash("sha256").update(s).digest("base64url").slice(0, 22);
function tozala(hozir: number) {
  for (const [k, v] of urinishlar) if (hozir - v.boshi > URINISH_OYNA_MS) urinishlar.delete(k);
  if (urinishlar.size > XARITA_MAX) {
    let ortiqcha = urinishlar.size - XARITA_MAX;
    for (const k of urinishlar.keys()) { if (ortiqcha-- <= 0) break; urinishlar.delete(k); }
  }
}
function haqiqiyIp(req: NextRequest): string {
  return tr(req.headers.get("x-real-ip")) || "local";
}
export function loginKalitlari(req: NextRequest, login: string): UrinishKalit[] {
  const ip = haqiqiyIp(req), l = tr(login).toLowerCase();
  return [
    { k: "il:" + iz(ip + "|" + l), max: 10 },
    { k: "ip:" + iz(ip), max: 100 },
    { k: "l:" + iz(l), max: 200 },
  ];
}
/** /api/auth/parol: joriy parolni tanlab topishga qarshi — foydalanuvchi bo'yicha 10 ta xato */
export function parolKalitlari(req: NextRequest, userId: string): UrinishKalit[] {
  return [
    { k: "pu:" + iz(tr(userId)), max: 10 },
    { k: "ip:" + iz(haqiqiyIp(req)), max: 100 },
  ];
}
export function loginBloklanganmi(kalitlar: UrinishKalit[]): boolean {
  const hozir = Date.now();
  return kalitlar.some(({ k, max }) => { const v = urinishlar.get(k); return !!v && hozir - v.boshi <= URINISH_OYNA_MS && v.soni >= max; });
}
export function loginXato(kalitlar: UrinishKalit[]): void {
  const hozir = Date.now();
  tozala(hozir);
  for (const { k } of kalitlar) {
    const v = urinishlar.get(k);
    if (!v || hozir - v.boshi > URINISH_OYNA_MS) urinishlar.set(k, { soni: 1, boshi: hozir });
    else v.soni++;
  }
}
/** Muvaffaqiyatli kirishda shu qurilma+login (va parol) hisoblagichi tozalanadi; umumiy IP/login emas */
export function loginMuvaffaq(kalitlar: UrinishKalit[]): void {
  for (const { k } of kalitlar) if (k.startsWith("il:") || k.startsWith("pu:")) urinishlar.delete(k);
}
