import { NextRequest, NextResponse } from "next/server";
import { sessiyaOchir, sessiyaCookie, sessiyaYarat, parolIzi } from "@/lib/sessiya";
import { sessiyaFoydalanuvchisi, ochiqKorinish, chiqishMatni } from "@/lib/sessiya-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Joriy sessiya egasi (parolsiz). Ilova ochilganda, har 30 soniyada va ilovaga qaytilganda chaqiriladi
// (lib/AuthContext.tsx): rol/ombor o'zgargan bo'lsa yangilanadi, foydalanuvchi nofaol qilingan yoki paroli
// almashtirilgan bo'lsa — 401 + sabab (tizimdan chiqariladi, login sahifasida sababi ko'rsatiladi).
export async function GET(req: NextRequest) {
  const s = await sessiyaFoydalanuvchisi(req);
  if (s.holat === "xato") {
    return NextResponse.json({ error: "Server bilan bog'lanib bo'lmadi" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (s.holat === "yoq") {
    const res = NextResponse.json({ error: chiqishMatni(s.sabab), sabab: s.sabab }, { status: 401, headers: { "Cache-Control": "no-store" } });
    res.cookies.set(sessiyaOchir());
    return res;
  }
  const res = NextResponse.json({ user: ochiqKorinish(s.u) }, { headers: { "Cache-Control": "no-store" } });
  // Sirpanuvchi muddat: ilova har ochilganda sessiya yana 30 kunga uzayadi — faol foydalanuvchi chiqarib yuborilmaydi
  const id = String(s.u.Foydalanuvchi_ID ?? "").trim();
  res.cookies.set(sessiyaCookie(sessiyaYarat(id, parolIzi(id, s.u.Parol))));
  return res;
}
