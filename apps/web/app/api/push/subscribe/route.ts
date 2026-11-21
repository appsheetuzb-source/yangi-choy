import { NextRequest, NextResponse } from "next/server";
import { sessiyaTalab } from "@/lib/sessiya-server";
import { getSheetData, appendRow, updateRow } from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function uid() { return Math.random().toString(36).slice(2, 10); }
function nowStr() {
  const t = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tashkent" }));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(t.getDate())}.${pad(t.getMonth() + 1)}.${t.getFullYear()} ${pad(t.getHours())}:${pad(t.getMinutes())}`;
}

export async function POST(req: NextRequest) {
  // Faqat tizimga kirgan foydalanuvchi (proxy.ts imzoni tekshiradi; bu yerda — faolligi ham)
  const sessiya = await sessiyaTalab(req);
  if ("javob" in sessiya) return sessiya.javob;
  try {
    const { endpoint, p256dh, auth } = await req.json();
    // Obuna egasi — so'rov tanasidagi qiymat emas, SESSIYA egasi (push/send faqat faol egalarga yuboradi)
    const egasi = JSON.stringify({ id: String(sessiya.u.Foydalanuvchi_ID || "").trim(), nomi: String(sessiya.u.Nomi || "").trim() });
    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: "endpoint, p256dh, auth kerak" }, { status: 400 });
    }
    const existing = await getSheetData("Push_Subscriptions");
    const eski = (existing.data || []).find((r) => r.Endpoint === endpoint);
    const dup = !!eski;
    if (!eski) {
      await appendRow("Push_Subscriptions", {
        Sub_ID: uid(), Endpoint: endpoint, P256dh: p256dh, Auth: auth, User: egasi, Sana: nowStr(),
      });
    } else if (eski.Sub_ID && eski.User !== egasi) {
      // Shu qurilmada boshqa foydalanuvchi kirgan (yoki eski egasiz obuna) — egasi yangilanadi
      try { await updateRow("Push_Subscriptions", "Sub_ID", eski.Sub_ID, { User: egasi }); } catch {}
    }
    return NextResponse.json({ success: true, duplicate: dup });
  } catch (e) {
    console.error("push subscribe xato:", e);
    return NextResponse.json({ error: "Obuna xatosi" }, { status: 500 });
  }
}
