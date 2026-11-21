import { NextRequest, NextResponse } from "next/server";
import { ensureOmborColumns, checkOmborColumns } from "@/lib/ombor-migrate";
import { tengmi } from "@/lib/sessiya";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Migratsiya server boot'da instrumentation.ts orqali AVTOMATIK ishlaydi.
// Bu endpoint — qo'lda ishlatish va read-only tekshiruv (?check=1) uchun; IKKALASI HAM MIGRATE_TOKEN bilan
// (avval ?check=1 ochiq edi: har so'rov yangi PG ulanishi ochardi — tokensiz ko'p so'rov bazani bo'g'ishi mumkin edi).
async function run(req: NextRequest) {
  const url = new URL(req.url);

  const token = req.headers.get("x-migrate-token") || url.searchParams.get("token") || "";
  const expected = process.env.MIGRATE_TOKEN || "";
  if (!expected || !tengmi(token, expected)) {
    return NextResponse.json({ error: "Ruxsat yo'q (MIGRATE_TOKEN)" }, { status: 401 });
  }

  // Read-only holat tekshiruvi — DDL yo'q (faqat ustun nomlari qaytadi)
  if (url.searchParams.get("check") === "1") {
    return NextResponse.json(await checkOmborColumns());
  }
  const res = await ensureOmborColumns();
  return NextResponse.json(res, { status: res.ok ? 200 : 500 });
}

export async function POST(req: NextRequest) { return run(req); }
export async function GET(req: NextRequest) { return run(req); }
