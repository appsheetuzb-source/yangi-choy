// Global client-side cache — sahifalar o'rtasida ma'lumot saqlanadi
// Module-level singleton: sahifa navigate bo'lganda ham saqlanadi

export interface SheetData {
  headers: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  error?: string;
}

interface CacheEntry {
  data: SheetData;
  ts: number;
}

const STORE: Record<string, CacheEntry> = {};
const TTL = 5 * 60_000; // 5 daqiqa

function isValid(entry: CacheEntry) {
  return Date.now() - entry.ts < TTL;
}

export function getCachedSheet(range: string) {
  const e = STORE[range];
  if (e && isValid(e)) return e.data;
  return null;
}

function setCachedSheet(range: string, data: CacheEntry["data"]) {
  STORE[range] = { data, ts: Date.now() };
}

export function invalidateSheet(range?: string) {
  if (range) {
    delete STORE[range];
  } else {
    Object.keys(STORE).forEach(k => delete STORE[k]);
  }
}

export async function fetchSheet(range: string): Promise<CacheEntry["data"]> {
  const cached = getCachedSheet(range);
  if (cached) return cached;

  const res = await fetch(`/api/sheets?range=${encodeURIComponent(range)}`, {
    cache: "no-store",
  });
  const json = await res.json();
  if (json.headers?.length > 0) {
    setCachedSheet(range, json);
  }
  return json;
}

// Bir nechta jadvalni BITTA so'rovda olish — keshda yo'qlarini batch qiladi
export async function fetchSheets(ranges: string[]): Promise<Record<string, SheetData>> {
  const out: Record<string, SheetData> = {};
  const missing: string[] = [];
  for (const r of ranges) {
    const c = getCachedSheet(r);
    if (c) out[r] = c; else missing.push(r);
  }
  if (missing.length > 0) {
    const res = await fetch(`/api/sheets?ranges=${encodeURIComponent(missing.join(","))}`, { cache: "no-store" });
    const json = await res.json();
    const results = (json.results || {}) as Record<string, SheetData>;
    for (const r of missing) {
      const data = results[r] || { headers: [], data: [] };
      out[r] = data;
      if (data.headers?.length > 0) setCachedSheet(r, data);
    }
  }
  return out;
}

// Yozish operatsiyalaridan keyin chaqiriladi — keshni tozalaydi
export function afterWrite(sheetName: string) {
  delete STORE[sheetName];
}
