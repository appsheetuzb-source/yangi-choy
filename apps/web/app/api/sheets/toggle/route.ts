import { NextRequest, NextResponse } from "next/server";
import { updateCell } from "@/lib/sheets";
import { sessiyaTalab, adminmi, foydalanuvchiJadvalimi, maxfiyUstunmi, jadvalNomiTogrimi } from "@/lib/sessiya-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const s = await sessiyaTalab(request);
  if ("javob" in s) return s.javob;
  try {
    const { sheet, idColumn, idValue, column, value } = await request.json();

    if (!sheet || !idColumn || !idValue || !column || value === undefined) {
      return NextResponse.json({ error: "Parametrlar to'liq emas" }, { status: 400 });
    }
    if (!jadvalNomiTogrimi(sheet)) {
      return NextResponse.json({ error: "Jadval nomi noto'g'ri" }, { status: 400 });
    }
    // Maxfiy ustunlar (Parol, Telegram_Token) bu yo'l orqali o'qilmaydi/yozilmaydi
    if (maxfiyUstunmi(idColumn) || maxfiyUstunmi(column)) {
      return NextResponse.json({ error: "Bu ustunni bu yerda o'zgartirib bo'lmaydi" }, { status: 400 });
    }
    if (foydalanuvchiJadvalimi(sheet) && !adminmi(s.u)) {
      return NextResponse.json({ error: "Foydalanuvchilarni faqat Admin o'zgartira oladi" }, { status: 403 });
    }

    await updateCell(sheet, idColumn, idValue, column, value);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Toggle xatosi:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Saqlashda xatolik" }, { status: 500 });
  }
}
