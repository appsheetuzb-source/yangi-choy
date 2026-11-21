import { NextResponse } from "next/server";
import { getSheetData } from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Deploy smoke test (GitHub Actions) uchun OCHIQ tekshiruv: server va baza ishlayaptimi.
// Hech qanday ma'lumot qaytarmaydi — faqat {ok}. Kurs jadvali 5 daqiqa keshlanadi, shuning uchun
// ko'p so'rov bazaga yuk bermaydi (deploydan keyingi birinchi so'rov esa haqiqatan bazadan o'qiydi).
export async function GET() {
  let ok = false;
  try { ok = ((await getSheetData("Kurs")).headers || []).length > 0; } catch { ok = false; }
  return NextResponse.json({ ok }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
