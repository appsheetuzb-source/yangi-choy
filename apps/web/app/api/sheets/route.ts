import { NextRequest, NextResponse } from "next/server";
import { getSheetData, getSheetNames, getMultipleSheets, getSheetDataWhere, appendRow, appendRows, updateRow, deleteRow } from "@/lib/sheets";
import { sessiyaYarat, sessiyaCookie, parolIzi } from "@/lib/sessiya";
import {
  sessiyaTalab, adminmi, foydalanuvchiJadvalimi, foydalanuvchilar, maxfiyniOlibTashla, maxfiyUstunmi, jadvalNomiTogrimi,
} from "@/lib/sessiya-server";
import { TOKEN_RE, CHAT_RE } from "@/lib/telegram-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Har bir so'rov — faqat tizimga kirgan (imzolangan sessiya cookie'si bor, faol) foydalanuvchidan.
// Javoblarda maxfiy ustunlar (Parol, Telegram_Token) HECH QACHON bo'lmaydi.
// Foydalanuvchi jadvaliga yozish (qo'shish/tahrirlash/o'chirish) — faqat Admin.

function json(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return NextResponse.json(data, { ...init, headers });
}

const tr = (v: unknown) => String(v ?? "").trim();
type Qator = Record<string, string>;

const ADMIN_KERAK = "Foydalanuvchilarni faqat Admin o'zgartira oladi";
const MAXFIY_USTUN_TAQIQ = "Bu ustun bo'yicha so'rov ruxsat etilmaydi";
// Jadval nomi faqat oddiy identifikator (lib/sessiya-server.ts jadvalNomiTogrimi) — "!", ":" va h.k. rad etiladi
const NOM_XATO = "Jadval nomi noto'g'ri";

// Tahrirlashda bo'sh maxfiy maydon = "o'zgartirilmasin" (forma endi joriy parolni bilmaydi)
function boshMaxfiyniOlibTashla(row: Record<string, unknown>): Record<string, unknown> {
  const nusxa: Record<string, unknown> = {};
  for (const k of Object.keys(row || {})) {
    if (maxfiyUstunmi(k) && tr(row[k]) === "") continue;
    nusxa[k] = row[k];
  }
  return nusxa;
}

// Foydalanuvchi Telegram boti (lib/telegram-server.ts): format tekshiruvi; Chat ID bo'shatilsa — bot uziladi
// (saqlangan token ham o'chiriladi, eskirgan maxfiy qiymat bazada qolmasin). Xato bo'lsa — matni.
function telegramMaydonlari(row: Record<string, unknown>): string | null {
  const token = tr(row.Telegram_Token), chat = tr(row.Telegram_Chat);
  if (token && !TOKEN_RE.test(token)) return "Bot token formati noto'g'ri (masalan: 123456789:AAH...)";
  if (chat && !CHAT_RE.test(chat)) return "Telegram Chat ID noto'g'ri (masalan: 123456789 yoki -1001234567890)";
  if ("Telegram_Chat" in row && chat === "") row.Telegram_Token = "";
  return null;
}

export async function GET(request: NextRequest) {
  const s = await sessiyaTalab(request);
  if ("javob" in s) return s.javob;
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || undefined;
    const action = searchParams.get("action");
    const filterColumn = searchParams.get("filterColumn") || "";
    const filterValue = searchParams.get("filterValue");
    const filterValues = searchParams.get("filterValues");

    if (action === "sheets") {
      const sheetNames = await getSheetNames();
      return json({ sheets: sheetNames });
    }

    if (range !== undefined && !jadvalNomiTogrimi(range)) return json({ error: NOM_XATO }, { status: 400 });

    // Batch: bir nechta jadval bitta so'rovda — ?ranges=A,B,C
    const rangesParam = searchParams.get("ranges");
    if (rangesParam) {
      const ranges = rangesParam.split(",").map(s => s.trim()).filter(Boolean);
      if (ranges.length > 30 || !ranges.every(jadvalNomiTogrimi)) return json({ error: NOM_XATO }, { status: 400 });
      const results = await getMultipleSheets(ranges);
      const toza: typeof results = {};
      for (const k of Object.keys(results)) toza[k] = maxfiyniOlibTashla(results[k]);
      return json({ results: toza });
    }

    if (range && filterColumn && (filterValue !== null || filterValues)) {
      // Maxfiy ustun bo'yicha filtr — parolni "taxmin qilib tekshirish" usuli bo'lardi
      if (maxfiyUstunmi(filterColumn)) return json({ error: MAXFIY_USTUN_TAQIQ }, { status: 400 });
      const values = filterValues
        ? filterValues.split(",").map(s => s.trim()).filter(Boolean)
        : [String(filterValue || "")];
      const result = await getSheetDataWhere(range, filterColumn, values);
      return json(maxfiyniOlibTashla(result));
    }

    const result = await getSheetData(range);
    return json(maxfiyniOlibTashla(result));
  } catch (error) {
    console.error("Sheets GET xatosi:", error);
    return json({ error: "Ma'lumotlarni yuklashda xatolik" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const s = await sessiyaTalab(request);
  if ("javob" in s) return s.javob;
  try {
    const { sheet, row, rows } = await request.json();
    if (!sheet || (!row && !Array.isArray(rows))) return json({ error: "sheet va row/rows kerak" }, { status: 400 });
    if (!jadvalNomiTogrimi(sheet)) return json({ error: NOM_XATO }, { status: 400 });
    if (foydalanuvchiJadvalimi(sheet)) {
      if (!adminmi(s.u)) return json({ error: ADMIN_KERAK }, { status: 403 });
      const yangilar: Record<string, unknown>[] = Array.isArray(rows) ? rows : [row];
      if (yangilar.some(r => !r || tr(r.Parol) === "")) return json({ error: "Yangi foydalanuvchiga parol kiriting" }, { status: 400 });
      for (const r of yangilar) { const xato = telegramMaydonlari(r); if (xato) return json({ error: xato }, { status: 400 }); }
    }
    if (Array.isArray(rows)) await appendRows(sheet, rows);
    else await appendRow(sheet, row);
    return json({ success: true });
  } catch (error) {
    console.error("Sheets POST xatosi:", error);
    return json({ error: "Qo'shishda xatolik" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const s = await sessiyaTalab(request);
  if ("javob" in s) return s.javob;
  try {
    const { sheet, idColumn, idValue, row, updates } = await request.json();
    if (!sheet || !idColumn || !idValue) {
      return json({ error: "sheet, idColumn, idValue kerak" }, { status: 400 });
    }
    if (!jadvalNomiTogrimi(sheet)) return json({ error: NOM_XATO }, { status: 400 });
    if (maxfiyUstunmi(idColumn)) return json({ error: MAXFIY_USTUN_TAQIQ }, { status: 400 });
    let payload = (row || updates || {}) as Record<string, unknown>;

    // Admin o'z parolini Foydalanuvchilar sahifasida almashtirsa — sessiyasi yangi parolga bog'lanadi
    let ozSessiyasi: string | null = null;
    if (foydalanuvchiJadvalimi(sheet)) {
      if (!adminmi(s.u)) return json({ error: ADMIN_KERAK }, { status: 403 });
      payload = boshMaxfiyniOlibTashla(payload);
      const tgXato = telegramMaydonlari(payload);
      if (tgXato) return json({ error: tgXato }, { status: 400 });
      const yangiParol = tr(payload.Parol);
      if (yangiParol) {
        const royxat = await foydalanuvchilar();
        const nishon = royxat?.find((x: Qator) => tr(x[idColumn]) === tr(idValue));
        if (nishon && tr(nishon.Foydalanuvchi_ID) === tr(s.u.Foydalanuvchi_ID)) {
          const id = tr(payload.Foydalanuvchi_ID) || tr(nishon.Foydalanuvchi_ID);
          ozSessiyasi = sessiyaYarat(id, parolIzi(id, yangiParol));
        }
      }
    }

    await updateRow(sheet, idColumn, idValue, payload as Record<string, string>);
    const res = json({ success: true });
    if (ozSessiyasi) res.cookies.set(sessiyaCookie(ozSessiyasi));
    return res;
  } catch (error) {
    console.error("Sheets PUT xatosi:", error);
    return json({ error: "Tahrirlashda xatolik" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const s = await sessiyaTalab(request);
  if ("javob" in s) return s.javob;
  try {
    const { sheet, idColumn, idValue } = await request.json();
    if (!sheet || !idColumn || !idValue) {
      return json({ error: "sheet, idColumn, idValue kerak" }, { status: 400 });
    }
    if (!jadvalNomiTogrimi(sheet)) return json({ error: NOM_XATO }, { status: 400 });
    if (maxfiyUstunmi(idColumn)) return json({ error: MAXFIY_USTUN_TAQIQ }, { status: 400 });
    if (foydalanuvchiJadvalimi(sheet) && !adminmi(s.u)) return json({ error: ADMIN_KERAK }, { status: 403 });
    await deleteRow(sheet, idColumn, idValue);
    return json({ success: true });
  } catch (error) {
    console.error("Sheets DELETE xatosi:", error);
    return json({ error: "O'chirishda xatolik" }, { status: 500 });
  }
}
