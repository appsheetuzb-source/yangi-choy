import { NextResponse } from "next/server";
import { sessiyaOchir } from "@/lib/sessiya";

export const dynamic = "force-dynamic";

// Chiqish: sessiya cookie o'chiriladi
export async function POST() {
  const res = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  res.cookies.set(sessiyaOchir());
  return res;
}
