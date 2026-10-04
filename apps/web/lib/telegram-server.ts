// Telegram'ga SERVER tomonidan xabar yuborish — /api/telegram va cron (muhlat eslatmasi) uchun umumiy.
// Yo'naltirish:
// - Default: .env.local dagi TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (asosiy guruh).
// - Agar `agent` (Foydalanuvchi_ID) berilsa va o'sha foydalanuvchida Telegram_Token + Telegram_Chat
//   bo'lsa — xabar o'sha agentning boti/guruhiga boradi (masalan 27/41 DOKON o'z guruhiga).
import { getSheetData } from "./sheets";

// Telegram bitta xabar chegarasi 4096 belgi — zaxira bilan
export const MAX_UZUNLIK = 3800;

type Manzil = { token: string; chatId: string };

async function manzil(agentId?: string): Promise<Manzil | null> {
  let token = process.env.TELEGRAM_BOT_TOKEN || "";
  let chatId = process.env.TELEGRAM_CHAT_ID || "";
  const id = String(agentId || "").trim();
  if (id) {
    try {
      const fRes = await getSheetData("Foydalanuvchi");
      const u = (fRes.data as Record<string, string>[]).find(
        (x) => String(x.Foydalanuvchi_ID || "").trim() === id,
      );
      const t = String(u?.Telegram_Token || "").trim();
      const c = String(u?.Telegram_Chat || "").trim();
      if (t && c) { token = t; chatId = c; } // agent boti/guruhi
    } catch { /* sozlanmagan bo'lsa default'ga tushamiz */ }
  }
  return token && chatId ? { token, chatId } : null;
}

/** Uzun matnni qator chegarasidan bo'laklarga ajratadi (har biri `max` dan oshmaydi) */
export function bolakla(text: string, max = MAX_UZUNLIK): string[] {
  if (text.length <= max) return [text];
  const out: string[] = [];
  let cur = "";
  for (const line of text.split("\n")) {
    const qism = line.length > max ? line.slice(0, max) : line;
    if (cur && cur.length + 1 + qism.length > max) { out.push(cur); cur = qism; }
    else cur = cur ? cur + "\n" + qism : qism;
  }
  if (cur) out.push(cur);
  return out;
}

type TgJavob = { ok?: boolean; error_code?: number; description?: string; parameters?: { retry_after?: number } } | null;

/** Bitta xabar. 429 (flood control) da Telegram aytgan vaqtni (≤30 s) kutib BIR marta qayta urinadi.
 *  Tarmoq xatosida qayta urinmaydi — javob yo'qolgan bo'lsa xabar ikki marta ketib qolmasin. */
async function bittaYubor(m: Manzil, text: string): Promise<{ ok: boolean; data: TgJavob; error?: string }> {
  for (let urinish = 0; urinish < 2; urinish++) {
    let data: TgJavob = null;
    try {
      const r = await fetch(`https://api.telegram.org/bot${m.token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: m.chatId, text, disable_web_page_preview: true }),
      });
      data = (await r.json().catch(() => null)) as TgJavob;
    } catch (e) {
      return { ok: false, data: null, error: e instanceof Error ? e.message : "tarmoq xatosi" };
    }
    if (data?.ok === true) return { ok: true, data };
    if (data?.error_code === 429 && urinish === 0) {
      const s = Math.min(30, Math.max(1, Number(data.parameters?.retry_after) || 1));
      await new Promise(res => setTimeout(res, s * 1000));
      continue;
    }
    return { ok: false, data, error: data?.description || "Telegram rad etdi" };
  }
  return { ok: false, data: null, error: "Telegram rad etdi" };
}

export interface TgNatija {
  ok: boolean;
  error?: string;
  data?: unknown;
  yuborildi?: number;   // nechta qism yetkazildi
  jami?: number;        // jami qismlar
}

/**
 * Oddiy matn (parse_mode yo'q). `text` massiv bo'lsa — har element alohida xabar (chaqiruvchi o'zi
 * bo'lgan); bitta uzun matn bo'lsa qator chegarasidan bo'linadi. Birinchi o'tmagan qismda to'xtaydi
 * va nechta qism yetkazilganini qaytaradi.
 */
export async function telegramYuborServer(text: string | string[], agentId?: string): Promise<TgNatija> {
  const qismlar = (Array.isArray(text) ? text : [text]).flatMap(t => (t ? bolakla(t) : []));
  if (qismlar.length === 0) return { ok: false, error: "text yo'q" };
  const m = await manzil(agentId);
  // Sozlanmagan bo'lsa jim qaytamiz — chaqiruvchi amalni buzmaslik uchun
  if (!m) return { ok: false, error: "Telegram sozlanmagan", yuborildi: 0, jami: qismlar.length };
  let oxirgi: TgJavob = null;
  for (let i = 0; i < qismlar.length; i++) {
    const r = await bittaYubor(m, qismlar[i]);
    if (!r.ok) return { ok: false, error: r.error, data: r.data, yuborildi: i, jami: qismlar.length };
    oxirgi = r.data;
  }
  return { ok: true, data: oxirgi, yuborildi: qismlar.length, jami: qismlar.length };
}
