// Global client-side cache — sahifalar o'rtasida ma'lumot saqlanadi (module-level singleton).
// Stale-While-Revalidate: keshlangan ma'lumot DARHOL qaytariladi, kerak bo'lsa fonda jim yangilanadi.
// In-flight dedup: bir xil range'ga bir vaqtdagi so'rovlar bitta tarmoq so'rovini bo'lishadi.

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
const FRESH = 90_000;        // 90s — bu vaqt ichida umuman qayta yuklamaymiz
const STALE = 30 * 60_000;   // 30min — bu vaqt ichida keshdan qaytarib, fonda yangilaymiz

// Hozir ketayotgan so'rovlar (range bo'yicha) — takroriy fetch'ni oldini oladi
const pending: Record<string, Promise<SheetData>> = {};

function ageOf(range: string) {
  const e = STORE[range];
  return e ? Date.now() - e.ts : Infinity;
}

export function getCachedSheet(range: string): SheetData | null {
  const e = STORE[range];
  if (e && Date.now() - e.ts < STALE) return e.data;
  return null;
}

function setCachedSheet(range: string, data: SheetData) {
  STORE[range] = { data, ts: Date.now() };
}

export function invalidateSheet(range?: string) {
  if (range) delete STORE[range];
  else Object.keys(STORE).forEach((k) => delete STORE[k]);
}

// Berilgan range'larni serverdan oladi (kerakli yangi so'rovlarni bitta batch qiladi,
// allaqachon ketayotganlarini esa qayta so'ramaydi). Har range uchun Promise qaytaradi.
function fetchRangesNow(ranges: string[]): Record<string, Promise<SheetData>> {
  const result: Record<string, Promise<SheetData>> = {};
  const toFetch: string[] = [];
  for (const r of ranges) {
    if (r in pending) result[r] = pending[r];
    else toFetch.push(r);
  }
  if (toFetch.length > 0) {
    const batchP = (async (): Promise<Record<string, SheetData>> => {
      const url = toFetch.length === 1
        ? `/api/sheets?range=${encodeURIComponent(toFetch[0])}`
        : `/api/sheets?ranges=${encodeURIComponent(toFetch.join(","))}`;
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      const results: Record<string, SheetData> = toFetch.length === 1
        ? { [toFetch[0]]: json as SheetData }
        : ((json.results || {}) as Record<string, SheetData>);
      for (const r of toFetch) {
        const data = results[r] || { headers: [], data: [] };
        if (data.headers?.length > 0) setCachedSheet(r, data);
      }
      return results;
    })();
    for (const r of toFetch) {
      const p = batchP
        .then((results) => results[r] || { headers: [], data: [] })
        .finally(() => { delete pending[r]; });
      pending[r] = p;
      result[r] = p;
    }
  }
  return result;
}

export async function fetchSheet(range: string): Promise<SheetData> {
  const a = ageOf(range);
  if (a < FRESH) return STORE[range].data;                 // yangi — darhol
  const ps = fetchRangesNow([range]);
  if (a < STALE) return STORE[range].data;                 // eskirgan — keshdan + fonda yangilanadi
  return ps[range];                                         // umuman yo'q / juda eski — kutamiz
}

// Bir nechta jadval — yangi/eskirganlarini keshdan, faqat kerak bo'lganini kutamiz
export async function fetchSheets(ranges: string[]): Promise<Record<string, SheetData>> {
  const out: Record<string, SheetData> = {};
  const need: string[] = [];       // age >= FRESH — fetch kerak (eskirgan yoki yo'q)
  const awaitList: string[] = [];  // age >= STALE — natijani kutamiz
  for (const r of ranges) {
    const a = ageOf(r);
    if (a < FRESH) { out[r] = STORE[r].data; }
    else {
      need.push(r);
      if (a >= STALE) awaitList.push(r);
      else out[r] = STORE[r].data;  // eskirgan — keshdan darhol (fonda yangilanadi)
    }
  }
  if (need.length > 0) {
    const ps = fetchRangesNow(need);
    for (const r of awaitList) out[r] = await ps[r];
  }
  return out;
}

// Yozish operatsiyalaridan keyin chaqiriladi — keshni tozalaydi (keyingi fetch fresh bo'ladi)
export function afterWrite(sheetName: string) {
  delete STORE[sheetName];
}
