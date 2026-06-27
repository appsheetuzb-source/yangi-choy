import { NextRequest, NextResponse } from "next/server";
import { getSheetData, getSheetNames, getMultipleSheets, getSheetDataWhere, appendRow, appendRows, updateRow, deleteRow } from "@/lib/sheets";

export const dynamic = "force-dynamic";

function json(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return NextResponse.json(data, { ...init, headers });
}

export async function GET(request: NextRequest) {
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

    // Batch: bir nechta jadval bitta so'rovda — ?ranges=A,B,C
    const rangesParam = searchParams.get("ranges");
    if (rangesParam) {
      const ranges = rangesParam.split(",").map(s => s.trim()).filter(Boolean);
      const results = await getMultipleSheets(ranges);
      return json({ results });
    }

    if (range && filterColumn && (filterValue !== null || filterValues)) {
      const values = filterValues
        ? filterValues.split(",").map(s => s.trim()).filter(Boolean)
        : [String(filterValue || "")];
      const result = await getSheetDataWhere(range, filterColumn, values);
      return json(result);
    }

    const result = await getSheetData(range);
    return json(result);
  } catch (error) {
    console.error("Sheets GET xatosi:", error);
    return json({ error: "Ma'lumotlarni yuklashda xatolik" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { sheet, row, rows } = await request.json();
    if (!sheet || (!row && !Array.isArray(rows))) return json({ error: "sheet va row/rows kerak" }, { status: 400 });
    if (Array.isArray(rows)) await appendRows(sheet, rows);
    else await appendRow(sheet, row);
    return json({ success: true });
  } catch (error) {
    console.error("Sheets POST xatosi:", error);
    return json({ error: "Qo'shishda xatolik" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { sheet, idColumn, idValue, row, updates } = await request.json();
    if (!sheet || !idColumn || !idValue) {
      return json({ error: "sheet, idColumn, idValue kerak" }, { status: 400 });
    }
    await updateRow(sheet, idColumn, idValue, row || updates);
    return json({ success: true });
  } catch (error) {
    console.error("Sheets PUT xatosi:", error);
    return json({ error: "Tahrirlashda xatolik" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { sheet, idColumn, idValue } = await request.json();
    if (!sheet || !idColumn || !idValue) {
      return json({ error: "sheet, idColumn, idValue kerak" }, { status: 400 });
    }
    await deleteRow(sheet, idColumn, idValue);
    return json({ success: true });
  } catch (error) {
    console.error("Sheets DELETE xatosi:", error);
    return json({ error: "O'chirishda xatolik" }, { status: 500 });
  }
}
