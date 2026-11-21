// Server sessiyasi — imzolangan, httpOnly cookie (proxy.ts va API yo'llari uchun umumiy).
//
// Avval login BRAUZERDA tekshirilardi: /api/sheets?range=Foydalanuvchi barcha foydalanuvchilarni
// PAROLLARI bilan qaytarardi va bu manzil login qilmasdan ham ochilardi. Endi parol faqat serverda
// tekshiriladi (/api/auth/login), brauzer esa JavaScript o'qiy olmaydigan sessiya cookie oladi.
//
// Token: base64url(JSON {i: Foydalanuvchi_ID, p: parol izi, e: muddat}) + "." + HMAC-SHA256 imzo.
// "p" — joriy parolning qisqa xeshi: parol almashtirilsa eski sessiyalar o'z-o'zidan bekor bo'ladi.
// Bu fayl lib/sheets'ga bog'liq EMAS — proxy.ts uni yengil import qiladi (faqat imzo tekshiriladi).
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const SESSIYA_COOKIE = "yc_sess";
export const SESSIYA_MUDDAT_S = 30 * 24 * 60 * 60;   // 30 kun

let _kalit: Buffer | null = null;
function kalit(): Buffer {
  if (_kalit) return _kalit;
  // Alohida AUTH_SECRET bo'lmasa — serverdagi mavjud maxfiy qiymatlardan biridan hosil qilinadi
  // (yangi env o'zgaruvchisini qo'lda qo'shish shart emas). Hech biri bo'lmasa — sessiya ishlamaydi.
  const manba = process.env.AUTH_SECRET || process.env.VAPID_PRIVATE_KEY || process.env.PUSH_CRON_SECRET
    || process.env.DATABASE_URL || process.env.GOOGLE_PRIVATE_KEY || "";
  if (!manba) throw new Error("Sessiya kaliti uchun maxfiy qiymat topilmadi (AUTH_SECRET)");
  _kalit = createHash("sha256").update("yc-sessiya|" + manba).digest();
  return _kalit;
}

/**
 * Parolning qisqa izi (parolning o'zi emas) — sessiyani joriy parolga bog'lash uchun.
 * Server kaliti bilan HMAC: cookie qo'lga tushsa ham undan parolni oflayn tanlab topib bo'lmaydi.
 */
export function parolIzi(id: unknown, parol: unknown): string {
  return createHmac("sha256", kalit())
    .update("yc-parol|" + String(id ?? "").trim() + "|" + String(parol ?? "").trim())
    .digest("base64url").slice(0, 22);
}

/** Ikki matnni vaqtga bog'liq bo'lmagan usulda solishtirish (parol tekshiruvi uchun) */
export function tengmi(a: unknown, b: unknown): boolean {
  const x = createHash("sha256").update(String(a ?? "")).digest();
  const y = createHash("sha256").update(String(b ?? "")).digest();
  return timingSafeEqual(x, y);
}

export function sessiyaYarat(id: string, pIzi: string): string {
  const e = Math.floor(Date.now() / 1000) + SESSIYA_MUDDAT_S;
  const payload = Buffer.from(JSON.stringify({ i: id, p: pIzi, e })).toString("base64url");
  const imzo = createHmac("sha256", kalit()).update(payload).digest("base64url");
  return payload + "." + imzo;
}

/** Imzo va muddatni tekshiradi; yaroqsiz bo'lsa null */
export function sessiyaOqi(token: string | undefined | null): { id: string; p: string } | null {
  if (!token || token.length > 2048) return null;
  const nuqta = token.indexOf(".");
  if (nuqta < 1) return null;
  const payload = token.slice(0, nuqta), imzo = token.slice(nuqta + 1);
  let kutilgan: Buffer;
  try { kutilgan = createHmac("sha256", kalit()).update(payload).digest(); } catch { return null; }
  const berilgan = Buffer.from(imzo, "base64url");
  if (berilgan.length !== kutilgan.length || !timingSafeEqual(berilgan, kutilgan)) return null;
  try {
    const d = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { i?: unknown; p?: unknown; e?: unknown };
    if (typeof d.i !== "string" || !d.i || typeof d.e !== "number" || d.e < Math.floor(Date.now() / 1000)) return null;
    return { id: d.i, p: String(d.p ?? "") };
  } catch { return null; }
}

/** NextResponse.cookies.set uchun parametrlar */
export function sessiyaCookie(token: string) {
  return {
    name: SESSIYA_COOKIE, value: token, httpOnly: true, sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSIYA_MUDDAT_S,
  };
}
export function sessiyaOchir() {
  return { name: SESSIYA_COOKIE, value: "", httpOnly: true, sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 };
}
