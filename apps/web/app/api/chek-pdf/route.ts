import { NextRequest, NextResponse } from "next/server";
import { sessiyaTalab } from "@/lib/sessiya-server";
import { chekPdf, type ChekPayload } from "@/lib/chek-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// 80mm termal chek PDF'ini SERVER tomonda pdf-lib bilan yasaydi (standart, toza PDF —
// Print Label ko'rsatishi uchun). Ma'lumot client'dan POST bilan keladi (formatlangan).
// Chek Print Label qog'ozi nisbatidagi sahifalarga bo'linadi — tafsilot lib/chek-pdf.ts da.

export async function POST(req: NextRequest) {
  // Faqat tizimga kirgan foydalanuvchi (proxy.ts imzoni tekshiradi; bu yerda — faolligi ham)
  const sessiya = await sessiyaTalab(req);
  if ("javob" in sessiya) return sessiya.javob;
  try {
    const d = (await req.json()) as ChekPayload;
    const bytes = await chekPdf(d);
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="chek.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "xato" }, { status: 500 });
  }
}
