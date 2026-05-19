import { NextRequest, NextResponse } from "next/server";
import { getSheetData, getSheetNames, appendRow, updateRow, deleteRow } from "@/lib/sheets";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || undefined;
    const action = searchParams.get("action");

    if (action === "sheets") {
      const sheetNames = await getSheetNames();
      return NextResponse.json({ sheets: sheetNames });
    }

    const result = await getSheetData(range);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Sheets GET xatosi:", error);
    return NextResponse.json({ error: "Ma'lumotlarni yuklashda xatolik" }, { status: 500 });
  }
}

// Yangi qator qo'shish
export async function POST(request: NextRequest) {
  try {
    const { sheet, row } = await request.json();
    if (!sheet || !row) return NextResponse.json({ error: "sheet va row kerak" }, { status: 400 });

    await appendRow(sheet, row);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Sheets POST xatosi:", error);
    return NextResponse.json({ error: "Qo'shishda xatolik" }, { status: 500 });
  }
}

// Mavjud qatorni tahrirlash
export async function PUT(request: NextRequest) {
  try {
    const { sheet, idColumn, idValue, row } = await request.json();
    if (!sheet || !idColumn || !idValue || !row) {
      return NextResponse.json({ error: "sheet, idColumn, idValue, row kerak" }, { status: 400 });
    }

    await updateRow(sheet, idColumn, idValue, row);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Sheets PUT xatosi:", error);
    return NextResponse.json({ error: "Tahrirlashda xatolik" }, { status: 500 });
  }
}

// Qatorni o'chirish
export async function DELETE(request: NextRequest) {
  try {
    const { sheet, idColumn, idValue } = await request.json();
    if (!sheet || !idColumn || !idValue) {
      return NextResponse.json({ error: "sheet, idColumn, idValue kerak" }, { status: 400 });
    }

    await deleteRow(sheet, idColumn, idValue);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Sheets DELETE xatosi:", error);
    return NextResponse.json({ error: "O'chirishda xatolik" }, { status: 500 });
  }
}
