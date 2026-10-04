import { NextRequest, NextResponse } from "next/server";
import { muhlatEslatmasi } from "@/lib/muhlat-eslatma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// "Bugun muhlati kelgan mijozlar" Telegram eslatmasi — qo'lda/test uchun.
// Odatda soatlik cron (/api/push/send) o'zi chaqiradi. Himoya: PUSH_CRON_SECRET
// (x-cron-secret sarlavhasi yoki ?secret=). ?dry=1 — yubormay matnni ko'rsatadi,
// ?force=1 — soat chegarasisiz, ?qayta=1 — bugun yuborilgan bo'lsa ham qayta.
async function handle(req: NextRequest) {
  const url = new URL(req.url);
  const secret = process.env.PUSH_CRON_SECRET;
  const provided = req.headers.get("x-cron-secret") || url.searchParams.get("secret") || "";
  if (secret && provided !== secret) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const r = await muhlatEslatmasi({
      force: url.searchParams.get("force") === "1",
      dry: url.searchParams.get("dry") === "1",
      qayta: url.searchParams.get("qayta") === "1",
    });
    return NextResponse.json(r, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ ok: false, holat: "xato", xato: e instanceof Error ? e.message : "xato" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
