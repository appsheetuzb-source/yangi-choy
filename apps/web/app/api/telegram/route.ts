import { NextRequest, NextResponse } from "next/server";
import { getSheetData } from "@/lib/sheets";

export const dynamic = "force-dynamic";

// Telegram botga xabar yuborish — AGENT bo'yicha yo'naltirish bilan.
// - Default: .env.local dagi TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (MASHRABJON/asosiy guruh).
// - Agar `agent` (Foydalanuvchi_ID) berilsa va o'sha foydalanuvchida Telegram_Token + Telegram_Chat
//   bo'lsa — xabar o'sha agentning boti/guruhiga boradi (masalan 27/41 DOKON o'z guruhiga).
export async function POST(request: NextRequest) {
  try {
    let token = process.env.TELEGRAM_BOT_TOKEN || "";
    let chatId = process.env.TELEGRAM_CHAT_ID || "";

    const { text, agent } = (await request.json()) as { text?: string; agent?: string };
    if (!text) return NextResponse.json({ ok: false, error: "text yo'q" });

    const agentId = String(agent || "").trim();
    if (agentId) {
      try {
        const fRes = await getSheetData("Foydalanuvchi");
        const u = (fRes.data as Record<string, string>[]).find(
          (x) => String(x.Foydalanuvchi_ID || "").trim() === agentId,
        );
        const t = String(u?.Telegram_Token || "").trim();
        const c = String(u?.Telegram_Chat || "").trim();
        if (t && c) { token = t; chatId = c; } // agent boti/guruhi
      } catch { /* sozlanmagan bo'lsa default'ga tushamiz */ }
    }

    if (!token || !chatId) {
      // Sozlanmagan bo'lsa jim qaytamiz — to'lov saqlashni buzmaslik uchun
      return NextResponse.json({ ok: false, error: "Telegram sozlanmagan" });
    }

    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
    const data = await r.json();
    return NextResponse.json({ ok: data?.ok === true, data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message });
  }
}
