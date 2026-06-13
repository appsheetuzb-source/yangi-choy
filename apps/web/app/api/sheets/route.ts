import { NextRequest, NextResponse } from "next/server";
import { getSheetData, getSheetNames, getMultipleSheets, appendRow, updateRow, deleteRow } from "@/lib/sheets";

export const dynamic = "force-dynamic";

// Server-side in-memory cache (5 daqiqa)
const cache: Record<string, { data: unknown; ts: number }> = {};
const TTL = 5 * 60_000;

function getCached(key: string): unknown | null {
  const e = cache[key];
  if (!e) return null;
  if (Date.now() - e.ts > TTL) { delete cache[key]; return null; }
  return e.data;
}
function setCached(key: string, data: unknown) { cache[key] = { data, ts: Date.now() }; }
function invalidate(sheet: string) { delete cache[sheet]; }

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || undefined;
    const action = searchParams.get("action");

    if (action === "sheets") {
      const sheetNames = await getSheetNames();
      return NextResponse.json({ sheets: sheetNames });
    }

    // Batch: bir nechta jadval bitta so'rovda — ?ranges=A,B,C
    const rangesParam = searchParams.get("ranges");
    if (rangesParam) {
      const ranges = rangesParam.split(",").map(s => s.trim()).filter(Boolean);
      const results = await getMultipleSheets(ranges);
      return NextResponse.json({ results }, {
        headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=60" },
      });
    }

    const key = range || "__all__";
    const cached = getCached(key);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=60" },
      });
    }

    const result = await getSheetData(range);
    if (result.headers.length > 0) setCached(key, result);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=60" },
    });
  } catch (error) {
    console.error("Sheets GET xatosi:", error);
    return NextResponse.json({ error: "Ma'lumotlarni yuklashda xatolik" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { sheet, row } = await request.json();
    if (!sheet || !row) return NextResponse.json({ error: "sheet va row kerak" }, { status: 400 });
    await appendRow(sheet, row);
    invalidate(sheet);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Sheets POST xatosi:", error);
    return NextResponse.json({ error: "Qo'shishda xatolik" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { sheet, idColumn, idValue, row, updates } = await request.json();
    if (!sheet || !idColumn || !idValue) {
      return NextResponse.json({ error: "sheet, idColumn, idValue kerak" }, { status: 400 });
    }
    await updateRow(sheet, idColumn, idValue, row || updates);
    invalidate(sheet);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Sheets PUT xatosi:", error);
    return NextResponse.json({ error: "Tahrirlashda xatolik" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { sheet, idColumn, idValue } = await request.json();
    if (!sheet || !idColumn || !idValue) {
      return NextResponse.json({ error: "sheet, idColumn, idValue kerak" }, { status: 400 });
    }
    await deleteRow(sheet, idColumn, idValue);
    invalidate(sheet);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Sheets DELETE xatosi:", error);
    return NextResponse.json({ error: "O'chirishda xatolik" }, { status: 500 });
  }
}
