import { NextRequest, NextResponse } from "next/server";
import { getSheetData, appendRow } from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function uid() { return Math.random().toString(36).slice(2, 10); }
function nowStr() {
  const t = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tashkent" }));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(t.getDate())}.${pad(t.getMonth() + 1)}.${t.getFullYear()} ${pad(t.getHours())}:${pad(t.getMinutes())}`;
}

export async function POST(req: NextRequest) {
  try {
    const { endpoint, p256dh, auth, user } = await req.json();
    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: "endpoint, p256dh, auth kerak" }, { status: 400 });
    }
    const existing = await getSheetData("Push_Subscriptions");
    const dup = (existing.data || []).some((r) => r.Endpoint === endpoint);
    if (!dup) {
      await appendRow("Push_Subscriptions", {
        Sub_ID: uid(), Endpoint: endpoint, P256dh: p256dh, Auth: auth, User: user || "", Sana: nowStr(),
      });
    }
    return NextResponse.json({ success: true, duplicate: dup });
  } catch (e) {
    console.error("push subscribe xato:", e);
    return NextResponse.json({ error: "Obuna xatosi" }, { status: 500 });
  }
}
