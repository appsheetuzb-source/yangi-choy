import { NextRequest, NextResponse } from "next/server";
import { updateCell } from "@/lib/sheets";

export async function POST(request: NextRequest) {
  try {
    const { sheet, idColumn, idValue, column, value } = await request.json();

    if (!sheet || !idColumn || !idValue || !column || value === undefined) {
      return NextResponse.json({ error: "Parametrlar to'liq emas" }, { status: 400 });
    }

    await updateCell(sheet, idColumn, idValue, column, value);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Xatolik";
    console.error("Toggle xatosi:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
