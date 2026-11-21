import { NextRequest, NextResponse } from "next/server";
import { sessiyaYarat, sessiyaCookie, parolIzi, tengmi } from "@/lib/sessiya";
import {
  foydalanuvchilar, ochiqKorinish, loginKalitlari, loginBloklanganmi, loginXato, loginMuvaffaq,
} from "@/lib/sessiya-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const tr = (v: unknown) => String(v ?? "").trim();
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

// Kirish: login (pochta / telefon / Login) + parol SERVERDA tekshiriladi.
// Muvaffaqiyatli bo'lsa httpOnly sessiya cookie o'rnatiladi va parolsiz foydalanuvchi ma'lumoti qaytadi.
export async function POST(req: NextRequest) {
  let body: { login?: unknown; parol?: unknown };
  try { body = await req.json(); } catch { return json({ error: "Noto'g'ri so'rov" }, 400); }
  const login = tr(body.login), parol = tr(body.parol);
  if (!login || !parol) return json({ error: "Login va parolni kiriting" }, 400);
  if (login.length > 200 || parol.length > 200) return json({ error: "Login yoki parol noto'g'ri" }, 400);

  const kalitlar = loginKalitlari(req, login);
  if (loginBloklanganmi(kalitlar)) {
    return json({ error: "Juda ko'p noto'g'ri urinish. 15 daqiqadan keyin qayta urinib ko'ring." }, 429);
  }

  const royxat = await foydalanuvchilar();
  if (!royxat) return json({ error: "Server bilan bog'lanib bo'lmadi. Qayta urinib ko'ring." }, 503);

  const kichik = login.toLowerCase();
  const topildi = royxat.find(u => {
    const mos = tr(u.Pochta).toLowerCase() === kichik || tr(u.Telefon) === login || tr(u.Login).toLowerCase() === kichik;
    return mos && tengmi(tr(u.Parol), parol) && tr(u.Status) !== "Nofaol";
  });
  if (!topildi) {
    loginXato(kalitlar);
    return json({ error: "Login yoki parol noto'g'ri" }, 401);
  }

  loginMuvaffaq(kalitlar);
  const res = json({ user: ochiqKorinish(topildi, login) });
  const id = tr(topildi.Foydalanuvchi_ID);
  res.cookies.set(sessiyaCookie(sessiyaYarat(id, parolIzi(id, topildi.Parol))));
  return res;
}
