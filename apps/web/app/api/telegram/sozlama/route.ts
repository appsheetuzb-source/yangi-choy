import { NextRequest, NextResponse } from "next/server";
import { sessiyaTalab, adminmi, foydalanuvchilar } from "@/lib/sessiya-server";
import { TOKEN_RE, CHAT_RE, tgApi, tgXatoMatni } from "@/lib/telegram-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Foydalanuvchiga Telegram bot ulash (Foydalanuvchilar oynasi) — FAQAT Admin.
//  GET  → har foydalanuvchida shaxsiy bot token saqlanganmi (tokenning o'zi HECH QACHON qaytmaydi)
//  POST { amal: "chatlar" } → botga yozgan chatlar ro'yxati (getUpdates) — Chat ID'ni topish uchun
//  POST { amal: "sinov" }   → tanlangan chatga sinov xabari
// Token tanlash: formaga kiritilgan yangi token → foydalanuvchining saqlangan tokeni → asosiy bot (.env.local).

const tr = (v: unknown) => String(v ?? "").trim();
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(req: NextRequest) {
  const s = await sessiyaTalab(req);
  if ("javob" in s) return s.javob;
  if (!adminmi(s.u)) return json({ error: "Faqat Admin" }, 403);
  const royxat = await foydalanuvchilar();
  if (!royxat) return json({ error: "Server bilan bog'lanib bo'lmadi" }, 503);
  const holat: Record<string, { token: boolean }> = {};
  for (const u of royxat) {
    const id = tr(u.Foydalanuvchi_ID);
    if (id) holat[id] = { token: TOKEN_RE.test(tr(u.Telegram_Token)) };
  }
  return json({ holat, asosiyBot: TOKEN_RE.test(tr(process.env.TELEGRAM_BOT_TOKEN)) });
}

type Chat = { id: string; nomi: string; turi: string };

export async function POST(req: NextRequest) {
  const s = await sessiyaTalab(req);
  if ("javob" in s) return s.javob;
  if (!adminmi(s.u)) return json({ error: "Faqat Admin" }, 403);

  let body: { amal?: unknown; foydalanuvchiId?: unknown; token?: unknown; chat?: unknown; nomi?: unknown };
  try { body = await req.json(); } catch { return json({ error: "Noto'g'ri so'rov" }, 400); }
  const amal = tr(body.amal);
  const yangiToken = tr(body.token);
  if (yangiToken && !TOKEN_RE.test(yangiToken)) return json({ error: "Bot token formati noto'g'ri (masalan: 123456789:AAH...)" }, 400);

  // Token manbai
  let token = yangiToken, manba: "yangi" | "saqlangan" | "asosiy" = "yangi";
  if (!token) {
    const id = tr(body.foydalanuvchiId);
    const royxat = id ? await foydalanuvchilar() : null;
    const saqlangan = tr(royxat?.find(u => tr(u.Foydalanuvchi_ID) === id)?.Telegram_Token);
    if (TOKEN_RE.test(saqlangan)) { token = saqlangan; manba = "saqlangan"; }
    else { token = tr(process.env.TELEGRAM_BOT_TOKEN); manba = "asosiy"; }
  }
  if (!TOKEN_RE.test(token)) return json({ error: "Bot token kiritilmagan va asosiy bot sozlanmagan" }, 400);

  const me = await tgApi(token, "getMe");
  if (!me?.ok) return json({ error: tgXatoMatni(me) }, 400);
  const botNomi = "@" + tr((me.result as { username?: string } | undefined)?.username);

  if (amal === "chatlar") {
    const j = await tgApi(token, "getUpdates", { limit: 100, allowed_updates: ["message", "channel_post", "my_chat_member"] });
    if (!j?.ok) return json({ error: tgXatoMatni(j), bot: botNomi, manba }, 400);
    const chatlar = new Map<string, Chat>();
    const updates = (Array.isArray(j.result) ? j.result : []) as Record<string, { chat?: Record<string, unknown> } | undefined>[];
    for (const up of [...updates].reverse()) {   // eng yangisi birinchi
      const c = (up.message || up.edited_message || up.channel_post || up.my_chat_member)?.chat;
      if (!c || c.id === undefined) continue;
      const id = String(c.id);
      if (chatlar.has(id)) continue;
      const ism = [c.first_name, c.last_name].map(tr).filter(Boolean).join(" ");
      chatlar.set(id, {
        id,
        nomi: tr(c.title) || ism || (c.username ? "@" + tr(c.username) : id),
        turi: tr(c.type) === "private" ? "Shaxsiy" : tr(c.type) === "channel" ? "Kanal" : "Guruh",
      });
    }
    return json({ ok: true, bot: botNomi, manba, chatlar: [...chatlar.values()] });
  }

  if (amal === "sinov") {
    const chat = tr(body.chat);
    if (!CHAT_RE.test(chat)) return json({ error: "Chat ID noto'g'ri (masalan: 123456789 yoki -1001234567890)" }, 400);
    const nomi = tr(body.nomi).slice(0, 80) || "foydalanuvchi";
    const j = await tgApi(token, "sendMessage", {
      chat_id: chat,
      text: `✅ Sinov xabari\n\nBu chat «${nomi}» uchun ulandi. Endi uning mijozlari bo'yicha to'lov, sotuv tasdig'i va ayirboshlash xabarlari shu yerga keladi.`,
      disable_web_page_preview: true,
    });
    if (!j?.ok) return json({ error: tgXatoMatni(j), bot: botNomi, manba }, 400);
    return json({ ok: true, bot: botNomi, manba });
  }

  return json({ error: "Noma'lum amal" }, 400);
}
