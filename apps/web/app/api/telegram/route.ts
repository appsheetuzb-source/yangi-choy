import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Telegram botga xabar yuborish.
// Sozlash: .env.local da TELEGRAM_BOT_TOKEN va TELEGRAM_CHAT_ID bo'lishi kerak.
export async function POST(request: NextRequest) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) {
      // Sozlanmagan bo'lsa, jim qaytamiz — to'lov saqlashni buzmaslik uchun
      return NextResponse.json({ ok: false, error: "Telegram sozlanmagan" });
    }

    const { text } = (await request.json()) as { text?: string };
    if (!text) return NextResponse.json({ ok: false, error: "text yo'q" });

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
