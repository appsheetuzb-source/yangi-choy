import { fetchSheet } from "@/lib/sheet-cache";

function n(v: unknown) { return parseFloat(String(v ?? "0").replace(/\s/g, "").replace(",", ".")) || 0; }

interface KursRow { Kurs?: string }

/** Markaziy dollar kursi — Kurs sheetdagi oxirgi yaroqli qator */
export async function getCurrentKurs(): Promise<string> {
  try {
    const r = await fetchSheet("Kurs");
    const arr = ((r.data || []) as KursRow[]).filter((k) => k.Kurs && n(k.Kurs) > 0);
    return arr.length ? String(arr[arr.length - 1].Kurs) : "";
  } catch {
    return "";
  }
}
