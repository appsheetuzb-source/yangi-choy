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

function cacheKey(range: string) {
  return range.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function filterKey(range: string, column: string, values: string[]) {
  const encodedValues = values.map((v) => encodeURIComponent(String(v || "").trim())).join(",");
  return `${cacheKey(range)}__where__${cacheKey(column)}__${encodedValues}`;
}

function deleteRangeCache(range: string) {
  const base = cacheKey(range);
  for (const key of Object.keys(STORE)) {
    if (key === base || key.startsWith(`${base}__where__`)) delete STORE[key];
  }
}

function ageOfKey(key: string) {
  const e = STORE[key];
  return e ? Date.now() - e.ts : Infinity;
}

function ageOf(range: string) {
  return ageOfKey(cacheKey(range));
}

function cachedDataByKey(key: string) {
  return STORE[key]?.data;
}

function cachedData(range: string) {
  return cachedDataByKey(cacheKey(range));
}

export function getCachedSheet(range: string): SheetData | null {
  const e = STORE[cacheKey(range)];
  if (e && Date.now() - e.ts < STALE) return e.data;
  return null;
}

function setCachedSheet(range: string, data: SheetData) {
  STORE[cacheKey(range)] = { data, ts: Date.now() };
}

export function invalidateSheet(range?: string) {
  if (range) deleteRangeCache(range);
  else Object.keys(STORE).forEach((k) => delete STORE[k]);
}

// Berilgan range'larni serverdan oladi (kerakli yangi so'rovlarni bitta batch qiladi,
// allaqachon ketayotganlarini esa qayta so'ramaydi). Har range uchun Promise qaytaradi.
function fetchRangesNow(ranges: string[]): Record<string, Promise<SheetData>> {
  const result: Record<string, Promise<SheetData>> = {};
  const toFetch: string[] = [];
  const queued: Record<string, string> = {};
  const queuedAliases: Record<string, string[]> = {};
  for (const r of ranges) {
    const key = cacheKey(r);
    if (key in pending) result[r] = pending[key];
    else {
      if (!(key in queued)) {
        queued[key] = r;
        toFetch.push(r);
      }
      (queuedAliases[key] ||= []).push(r);
    }
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
      const key = cacheKey(r);
      const p = batchP
        .then((results) => results[r] || { headers: [], data: [] })
        .finally(() => { delete pending[key]; });
      pending[key] = p;
      for (const alias of queuedAliases[key] || [r]) result[alias] = p;
    }
  }
  return result;
}

export async function fetchSheet(range: string): Promise<SheetData> {
  const a = ageOf(range);
  if (a < FRESH) return cachedData(range)!;                // yangi — darhol
  const ps = fetchRangesNow([range]);
  if (a < STALE) return cachedData(range)!;                // eskirgan — keshdan + fonda yangilanadi
  return ps[range];                                         // umuman yo'q / juda eski — kutamiz
}

export async function fetchSheetWhere(range: string, column: string, value: string | string[]): Promise<SheetData> {
  const values = (Array.isArray(value) ? value : [value]).map((v) => String(v || "").trim()).filter(Boolean);
  if (values.length === 0) return { headers: [], data: [] };
  const key = filterKey(range, column, values);
  const a = ageOfKey(key);
  if (a < FRESH) return cachedDataByKey(key)!;
  if (!(key in pending)) {
    pending[key] = (async () => {
      const params = new URLSearchParams({ range, filterColumn: column });
      if (values.length === 1) params.set("filterValue", values[0]);
      else params.set("filterValues", values.join(","));
      const res = await fetch(`/api/sheets?${params.toString()}`, { cache: "no-store" });
      const data = await res.json() as SheetData;
      if (data.headers?.length > 0) STORE[key] = { data, ts: Date.now() };
      return data;
    })().finally(() => { delete pending[key]; });
  }
  if (a < STALE) return cachedDataByKey(key)!;
  return pending[key];
}

// Bir nechta jadval — yangi/eskirganlarini keshdan, faqat kerak bo'lganini kutamiz
export async function fetchSheets(ranges: string[]): Promise<Record<string, SheetData>> {
  const out: Record<string, SheetData> = {};
  const need: string[] = [];       // age >= FRESH — fetch kerak (eskirgan yoki yo'q)
  const awaitList: string[] = [];  // age >= STALE — natijani kutamiz
  for (const r of ranges) {
    const a = ageOf(r);
    if (a < FRESH) { out[r] = cachedData(r)!; }
    else {
      need.push(r);
      if (a >= STALE) awaitList.push(r);
      else out[r] = cachedData(r)!;  // eskirgan — keshdan darhol (fonda yangilanadi)
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
  deleteRangeCache(sheetName);
}

function deleteFilteredKeys(range: string) {
  const base = cacheKey(range);
  for (const key of Object.keys(STORE)) {
    if (key.startsWith(`${base}__where__`)) delete STORE[key];
  }
}

// To'liq range keshini O'CHIRMASDAN yangilaydi — yangi qatorlarni qo'shadi.
// Shunda og'ir jadval (masalan Sotuv_Savat) qayta to'liq tortilmaydi va ro'yxat
// summalar bilan DARHOL ko'rinadi. Filtrlangan (__where__) keshlar tozalanadi (kichik, qayta yuklanadi).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function appendSheetRows(range: string, rows: any[]) {
  const base = cacheKey(range);
  const e = STORE[base];
  if (e && rows.length > 0) {
    STORE[base] = { data: { headers: e.data.headers, data: [...e.data.data, ...rows] }, ts: Date.now() };
  }
  deleteFilteredKeys(range);
}

// To'liq range keshidan berilgan id'lar bo'yicha qatorlarni olib tashlaydi (kesh iliq qoladi).
export function removeSheetRows(range: string, idColumn: string, ids: string[]) {
  const base = cacheKey(range);
  const e = STORE[base];
  if (e) {
    const idSet = new Set(ids.map((x) => String(x)));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const next = (e.data.data as any[]).filter((r) => !idSet.has(String(r?.[idColumn])));
    STORE[base] = { data: { headers: e.data.headers, data: next }, ts: Date.now() };
  }
  deleteFilteredKeys(range);
}

// Eski qatorlarni olib tashlab, yangilarini qo'shadi (tahrirlash uchun).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function replaceSheetRows(range: string, idColumn: string, removeIds: string[], addRows: any[]) {
  const base = cacheKey(range);
  const e = STORE[base];
  if (e) {
    const idSet = new Set(removeIds.map((x) => String(x)));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kept = (e.data.data as any[]).filter((r) => !idSet.has(String(r?.[idColumn])));
    STORE[base] = { data: { headers: e.data.headers, data: [...kept, ...addRows] }, ts: Date.now() };
  }
  deleteFilteredKeys(range);
}
