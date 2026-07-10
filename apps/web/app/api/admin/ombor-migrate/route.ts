import { NextRequest, NextResponse } from "next/server";
import { ensureOmborColumns, checkOmborColumns } from "@/lib/ombor-migrate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Migratsiya server boot'da instrumentation.ts orqali AVTOMATIK ishlaydi.
// Bu endpoint — qo'lda ishlatish (token bilan) va read-only tekshiruv (?check=1) uchun.
async function run(req: NextRequest) {
  const url = new URL(req.url);

  // Read-only holat tekshiruvi — DDL yo'q, token shart emas (faqat ustun nomlari qaytadi)
  if (url.searchParams.get("check") === "1") {
    return NextResponse.json(await checkOmborColumns());
  }

  const token = req.headers.get("x-migrate-token") || url.searchParams.get("token") || "";
  const expected = process.env.MIGRATE_TOKEN || "";
  if (!expected || token !== expected) {
    return NextResponse.json({ error: "Ruxsat yo'q (MIGRATE_TOKEN). Read-only tekshiruv: ?check=1" }, { status: 401 });
  }
  const res = await ensureOmborColumns();
  return NextResponse.json(res, { status: res.ok ? 200 : 500 });
}

export async function POST(req: NextRequest) { return run(req); }
export async function GET(req: NextRequest) { return run(req); }
