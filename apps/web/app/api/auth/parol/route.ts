import { NextRequest, NextResponse } from "next/server";
import { updateRow, invalidateCache } from "@/lib/sheets";
import { sessiyaYarat, sessiyaCookie, parolIzi, tengmi } from "@/lib/sessiya";
import { sessiyaFoydalanuvchisi, FOYDALANUVCHI, parolKalitlari, loginBloklanganmi, loginXato, loginMuvaffaq } from "@/lib/sessiya-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const tr = (v: unknown) => String(v ?? "").trim();
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

// O'z parolini o'zgartirish: joriy parol SERVERDA tekshiriladi (avval brauzer hamma parollarni
// yuklab olib solishtirardi). Muvaffaqiyatli bo'lsa sessiya yangi parolga qayta bog'lanadi —
// shu qurilma tizimda qoladi, boshqa qurilmalardagi eski sessiyalar esa bekor bo'ladi.
export async function POST(req: NextRequest) {
  const s = await sessiyaFoydalanuvchisi(req);
  if (s.holat === "xato") return json({ error: "Server bilan bog'lanib bo'lmadi" }, 503);
  if (s.holat === "yoq") return json({ error: "Avtorizatsiya kerak" }, 401);

  let body: { eski?: unknown; yangi?: unknown };
  try { body = await req.json(); } catch { return json({ error: "Noto'g'ri so'rov" }, 400); }
  const eski = tr(body.eski), yangi = tr(body.yangi);
  // Yangi parol AVVAL tekshiriladi — javob turi joriy parol to'g'ri-noto'g'riligini oshkor qilmasin
  if (yangi.length < 4) return json({ error: "Parol kamida 4 ta belgi bo'lsin" }, 400);
  if (yangi.length > 200 || eski.length > 200) return json({ error: "Parol juda uzun" }, 400);

  const id = tr(s.u.Foydalanuvchi_ID);
  const kalitlar = parolKalitlari(req, id);
  if (loginBloklanganmi(kalitlar)) return json({ error: "Juda ko'p noto'g'ri urinish. 15 daqiqadan keyin qayta urinib ko'ring." }, 429);
  if (!tengmi(tr(s.u.Parol), eski)) { loginXato(kalitlar); return json({ error: "Joriy parol noto'g'ri" }, 400); }
  loginMuvaffaq(kalitlar);

  try {
    await updateRow(FOYDALANUVCHI, "Foydalanuvchi_ID", id, { Parol: yangi });
  } catch {
    return json({ error: "Parol saqlanmadi. Qayta urinib ko'ring." }, 500);
  }
  invalidateCache(FOYDALANUVCHI);   // yozuv paytida parallel o'qilgan eski qator keshda qolmasin
  const res = json({ ok: true });
  res.cookies.set(sessiyaCookie(sessiyaYarat(id, parolIzi(id, yangi))));
  return res;
}
