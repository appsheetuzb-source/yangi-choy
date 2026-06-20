import { NextRequest, NextResponse } from "next/server";
import { getSheetData, deleteRow } from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { endpoint } = await req.json();
    if (!endpoint) return NextResponse.json({ error: "endpoint kerak" }, { status: 400 });
    const existing = await getSheetData("Push_Subscriptions");
    const row = (existing.data || []).find((r) => r.Endpoint === endpoint);
    if (row?.Sub_ID) {
      try { await deleteRow("Push_Subscriptions", "Sub_ID", row.Sub_ID); } catch {}
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("push unsubscribe xato:", e);
    return NextResponse.json({ error: "Bekor qilish xatosi" }, { status: 500 });
  }
}
