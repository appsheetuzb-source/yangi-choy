import type { Mahsulot, SheetData } from "./types";

// Web va Mobile uchun bir xil API chaqiruvlari
// Web: /api/sheets, Mobile: to'g'ridan backend URL

export function createApiClient(baseUrl: string) {
  async function getSheets(): Promise<string[]> {
    const res = await fetch(`${baseUrl}/api/sheets?action=sheets`);
    const json = await res.json();
    return json.sheets ?? [];
  }

  async function getSheetData(sheet: string): Promise<SheetData> {
    const res = await fetch(
      `${baseUrl}/api/sheets?range=${encodeURIComponent(sheet)}`
    );
    return res.json();
  }

  async function getMahsulotlar(): Promise<Mahsulot[]> {
    const data = await getSheetData("Mahsulot");
    return data.data as Mahsulot[];
  }

  function getImageUrl(imagePath: string): string {
    return `${baseUrl}/api/image?path=${encodeURIComponent(imagePath)}`;
  }

  return { getSheets, getSheetData, getMahsulotlar, getImageUrl };
}
