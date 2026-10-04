import { NextRequest, NextResponse } from "next/server";
import { telegramYuborServer } from "@/lib/telegram-server";

export const dynamic = "force-dynamic";

// Telegram botga xabar yuborish — AGENT bo'yicha yo'naltirish bilan (lib/telegram-server.ts).
// - Default: .env.local dagi TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (MASHRABJON/asosiy guruh).
// - Agar `agent` (Foydalanuvchi_ID) berilsa va o'sha foydalanuvchida Telegram_Token + Telegram_Chat
//   bo'lsa — xabar o'sha agentning boti/guruhiga boradi (masalan 27/41 DOKON o'z guruhiga).
export async function POST(request: NextRequest) {
  try {
    const { text, agent } = (await request.json()) as { text?: string; agent?: string };
    if (!text) return NextResponse.json({ ok: false, error: "text yo'q" });
    return NextResponse.json(await telegramYuborServer(text, agent));
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message });
  }
}
