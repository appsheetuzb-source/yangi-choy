// API himoyasi: /api/* ga faqat imzolangan sessiya cookie'si bor so'rov o'tadi.
// Bu — birinchi to'siq (tezkor, DB'siz: faqat imzo va muddat). Har bir API yo'li o'zi ham
// sessiya egasining faolligini tekshiradi (lib/sessiya-server.ts → sessiyaTalab), shuning uchun
// matcher o'zgarib qolsa ham ma'lumot ochilib qolmaydi.
import { NextResponse, type NextRequest } from "next/server";
import { SESSIYA_COOKIE, sessiyaOqi } from "./lib/sessiya";

// Sessiyasiz ochiq yo'llar — har biri o'zini o'zi himoyalaydi:
//  - auth/login, auth/logout, auth/me — kirish/chiqish (me o'zi 401 qaytaradi va cookie'ni tozalaydi)
//  - push/send, muhlat/eslatma — server cron'i (PUSH_CRON_SECRET bilan)
//  - admin/ombor-migrate — MIGRATE_TOKEN bilan
//  - health — deploy smoke test: faqat {ok}, ma'lumot yo'q
const OCHIQ = new Set([
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/me",
  "/api/push/send",
  "/api/muhlat/eslatma",
  "/api/admin/ombor-migrate",
  "/api/health",
]);

export function proxy(req: NextRequest) {
  const yol = req.nextUrl.pathname.replace(/\/+$/, "");
  if (OCHIQ.has(yol)) return NextResponse.next();
  if (sessiyaOqi(req.cookies.get(SESSIYA_COOKIE)?.value)) return NextResponse.next();
  return NextResponse.json(
    { error: "Avtorizatsiya kerak. Qaytadan kiring." },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}

export const config = {
  matcher: "/api/:path*",
};
