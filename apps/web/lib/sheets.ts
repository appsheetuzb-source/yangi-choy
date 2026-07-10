import { google } from "googleapis";
import type { Pool, QueryResult } from "pg"; // FAQAT tip — runtime'da pg lazy yuklanadi (pastdagi getPool)

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID;
const USE_POSTGRES = process.env.USE_POSTGRES === "true";

function postgresTableName(sheetName: string): string {
  return sheetName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function sheetCacheKey(sheetName?: string): string {
  const resolved = sheetName || process.env.GOOGLE_SHEET_NAME || "Sheet1";
  return USE_POSTGRES ? postgresTableName(resolved) : resolved;
}

// ── In-memory cache (5 daqiqa TTL) ────────────────────
const _cache: Record<string, { data: unknown; ts: number }> = {};
const CACHE_TTL = 5 * 60_000; // 5 minutes

function cacheGet(sheetName: string) {
  const entry = _cache[sheetCacheKey(sheetName)];
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}
function cacheSet(sheetName: string, data: unknown) {
  _cache[sheetCacheKey(sheetName)] = { data, ts: Date.now() };
}
export function invalidateCache(sheetName?: string) {
  if (sheetName) { delete _cache[sheetCacheKey(sheetName)]; }
  else { for (const k of Object.keys(_cache)) delete _cache[k]; }
}
// ─────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════
// PostgreSQL backend — USE_POSTGRES=true bo'lganda ishlaydi.
// Sheets bilan AYNAN bir xil { headers, data } shaklini qaytaradi
// (ustun nomlari case-sensitive saqlangan, NULL -> "").
// ══════════════════════════════════════════════════════
let _pool: Pool | null = null;
// pg LAZY yuklanadi — statik import bo'lsa, pg topilmasa BUTUN sayt qulardi.
// Bu yo'l faqat USE_POSTGRES yo'llarida chaqiriladi; Sheets rejimида pg umuman yuklanmaydi.
async function getPool(): Promise<Pool> {
  if (!_pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL yo'q — PostgreSQL sozlanmagan (USE_POSTGRES=true)");
    }
    const { Pool: PoolCtor } = await import("pg");
    _pool = new PoolCtor({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
    });
  }
  return _pool;
}
// Sheet nomi -> jadval nomi (migratsiya bilan AYNAN bir xil qoida)
function pgTable(sheetName: string): string {
  return postgresTableName(sheetName);
}
function pgQ(name: string): string { return '"' + String(name).replace(/"/g, '""') + '"'; }
// "true"/"false" -> "TRUE"/"FALSE" (Sheets checkbox bilan bir xil; migratsiya shunday saqlagan)
function boolNorm(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (s === "true") return "TRUE";
  if (s === "false") return "FALSE";
  return s;
}
// Jadval ustunlari (yaratilish tartibida = original sarlavha tartibi) — keshlanadi
const _pgCols: Record<string, string[]> = {};
async function pgColumns(table: string): Promise<string[]> {
  if (_pgCols[table]) return _pgCols[table];
  const r = await (await getPool()).query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name <> '_ord'
     ORDER BY ordinal_position`,
    [table]
  );
  const cols = r.rows.map((x) => x.column_name as string);
  if (cols.length) _pgCols[table] = cols;
  return cols;
}

// PG ustun-keshini tozalash — migratsiyadan (ALTER TABLE ADD/RENAME COLUMN) keyin CHAQIRILADI,
// aks holda yangi ustun keshda ko'rinmay, yozuvlar jimgina tushib qoladi.
export function resetPgColumnCache() {
  for (const k of Object.keys(_pgCols)) delete _pgCols[k];
}

function pgResultToSheet(r: QueryResult<Record<string, unknown>>): { headers: string[]; data: Record<string, string>[] } {
  const headers = r.fields.map((f) => f.name).filter((n) => n !== "_ord");
  const data = r.rows.map((row) => {
    const obj: Record<string, string> = {};
    for (const h of headers) {
      const v = row[h];
      obj[h] = v === null || v === undefined ? "" : String(v);
    }
    return obj;
  });
  return { headers, data };
}

async function pgGetSheet(range: string): Promise<{ headers: string[]; data: Record<string, string>[] }> {
  const table = pgTable(range);
  try {
    // _ord = varaq tartibi (BIGSERIAL PK). ORDER BY _ord -> Sheets bilan aynan bir xil tartib.
    const r = await (await getPool()).query<Record<string, unknown>>(`SELECT * FROM ${pgQ(table)} ORDER BY _ord`);
    return pgResultToSheet(r);
  } catch {
    return { headers: [], data: [] };
  }
}

async function pgGetSheetWhere(
  range: string,
  filterColumn: string,
  filterValues: string[],
): Promise<{ headers: string[]; data: Record<string, string>[] }> {
  const table = pgTable(range);
  const values = filterValues.map((v) => String(v || "").trim()).filter(Boolean);
  if (!filterColumn || values.length === 0) return { headers: [], data: [] };
  try {
    const cols = await pgColumns(table);
    if (!cols.includes(filterColumn)) return { headers: [], data: [] };
    const where = values.length === 1
      ? `btrim(${pgQ(filterColumn)}) = $1`
      : `btrim(${pgQ(filterColumn)}) = ANY($1::text[])`;
    const params = values.length === 1 ? [values[0]] : [values];
    const r = await (await getPool()).query<Record<string, unknown>>(
      `SELECT * FROM ${pgQ(table)} WHERE ${where} ORDER BY _ord`,
      params,
    );
    return pgResultToSheet(r);
  } catch {
    return { headers: [], data: [] };
  }
}

async function pgGetMultiple(ranges: string[]) {
  const result: Record<string, { headers: string[]; data: Record<string, string>[] }> = {};
  const missing: string[] = [];
  for (const r of ranges) {
    const cached = cacheGet(r);
    if (cached) result[r] = cached as { headers: string[]; data: Record<string, string>[] };
    else missing.push(r);
  }
  if (missing.length) {
    const parsed = await Promise.all(missing.map((r) => pgGetSheet(r)));
    missing.forEach((r, i) => {
      result[r] = parsed[i];
      if (parsed[i].headers.length) cacheSet(r, parsed[i]);
    });
  }
  return result;
}

async function pgGetSheetNames(): Promise<string[]> {
  const r = await (await getPool()).query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' ORDER BY table_name`
  );
  return r.rows.map((x) => x.table_name as string);
}

// Jadval mavjud bo'lmasa, qator kalitlaridan yaratadi (Sheets ensureSheetExists kabi)
async function pgEnsureTable(table: string, keys: string[]): Promise<string[]> {
  let cols = await pgColumns(table);
  if (cols.length === 0 && keys.length) {
    const defs = keys.map((k) => `${pgQ(k)} TEXT`).join(", ");
    await (await getPool()).query(`CREATE TABLE IF NOT EXISTS ${pgQ(table)} (_ord BIGSERIAL PRIMARY KEY, ${defs})`);
    delete _pgCols[table];
    cols = keys;
  }
  return cols;
}

async function pgAppendRow(sheetName: string, row: Record<string, string | number>) {
  invalidateCache(sheetName);
  const table = pgTable(sheetName);
  const cols = await pgEnsureTable(table, Object.keys(row));
  const useCols = cols.filter((c) => c in row);
  if (useCols.length === 0) return;
  const vals = useCols.map((c) => boolNorm(row[c]));
  const ph = useCols.map((_, i) => "$" + (i + 1));
  await (await getPool()).query(
    `INSERT INTO ${pgQ(table)} (${useCols.map(pgQ).join(", ")}) VALUES (${ph.join(", ")})`,
    vals
  );
}

async function pgAppendRows(sheetName: string, rowsData: Record<string, string | number>[]) {
  if (!rowsData || rowsData.length === 0) return;
  invalidateCache(sheetName);
  const table = pgTable(sheetName);
  const cols = await pgEnsureTable(table, Object.keys(rowsData[0]));
  const useCols = cols.filter((c) => rowsData.some((r) => c in r));
  if (useCols.length === 0) return;
  const colList = useCols.map(pgQ).join(", ");
  const BATCH = 500;
  for (let i = 0; i < rowsData.length; i += BATCH) {
    const slice = rowsData.slice(i, i + BATCH);
    const values: string[] = [];
    const params: string[] = [];
    let p = 1;
    for (const row of slice) {
      const ph = useCols.map(() => "$" + p++);
      values.push("(" + ph.join(",") + ")");
      for (const c of useCols) params.push(boolNorm(row[c]));
    }
    await (await getPool()).query(`INSERT INTO ${pgQ(table)} (${colList}) VALUES ${values.join(",")}`, params);
  }
}

async function pgUpdateRow(sheetName: string, idColumn: string, idValue: string, updatedRow: Record<string, string>) {
  invalidateCache(sheetName);
  const table = pgTable(sheetName);
  const cols = await pgColumns(table);
  if (!cols.includes(idColumn)) throw new Error("ID ustun topilmadi");
  const setCols = cols.filter((c) => c in updatedRow && updatedRow[c] !== undefined);
  if (setCols.length === 0) return;
  const set = setCols.map((c, i) => `${pgQ(c)} = $${i + 1}`).join(", ");
  const params = setCols.map((c) => boolNorm(updatedRow[c]));
  params.push(idValue);
  const res = await (await getPool()).query(
    `UPDATE ${pgQ(table)} SET ${set}
     WHERE ctid = (SELECT ctid FROM ${pgQ(table)} WHERE trim(${pgQ(idColumn)}) = trim($${params.length}) LIMIT 1)`,
    params
  );
  if (res.rowCount === 0) throw new Error("Qator topilmadi");
}

async function pgUpdateCell(sheetName: string, idColumn: string, idValue: string, targetColumn: string, newValue: string) {
  invalidateCache(sheetName);
  const table = pgTable(sheetName);
  const cols = await pgColumns(table);
  if (!cols.includes(idColumn) || !cols.includes(targetColumn)) throw new Error("Ustun topilmadi");
  const res = await (await getPool()).query(
    `UPDATE ${pgQ(table)} SET ${pgQ(targetColumn)} = $1
     WHERE ctid = (SELECT ctid FROM ${pgQ(table)} WHERE trim(${pgQ(idColumn)}) = trim($2) LIMIT 1)`,
    [boolNorm(newValue), idValue]
  );
  if (res.rowCount === 0) throw new Error(`Qator topilmadi: ${idValue}`);
}

async function pgDeleteRow(sheetName: string, idColumn: string, idValue: string) {
  invalidateCache(sheetName);
  const table = pgTable(sheetName);
  const cols = await pgColumns(table);
  if (!cols.includes(idColumn)) throw new Error("ID ustun topilmadi");
  const res = await (await getPool()).query(
    `DELETE FROM ${pgQ(table)} WHERE ctid = (SELECT ctid FROM ${pgQ(table)} WHERE trim(${pgQ(idColumn)}) = trim($1) LIMIT 1)`,
    [idValue]
  );
  if (res.rowCount === 0) throw new Error("Qator topilmadi");
}
// ══════════════════════════════════════════════════════

function getAuthClient(scopes?: string[]) {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: privateKey,
    },
    scopes: scopes || [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.readonly",
    ],
  });
}

// ── Singleton sheets client — har so'rovda qayta auth qilmaslik uchun ──
let _sheetsClient: ReturnType<typeof google.sheets> | null = null;
function getSheetsClient() {
  if (!_sheetsClient) {
    _sheetsClient = google.sheets({ version: "v4", auth: getAuthClient() });
  }
  return _sheetsClient;
}

// ── Qatorlarni { headers, data } ga aylantirish ──
function parseRows(rows: unknown[][] | null | undefined) {
  if (!rows || rows.length === 0) return { headers: [] as string[], data: [] as Record<string, string>[] };
  const rawHeaders = rows[0] as unknown[];
  const validCols = rawHeaders
    .map((h, i) => ({ h: String(h), i }))
    .filter(({ h }) => h && h !== "false" && h !== "null");
  const headers = validCols.map(({ h }) => h);
  const data = rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    validCols.forEach(({ h, i }) => {
      const val = row[i];
      if (val === true) obj[h] = "TRUE";
      else if (val === false) obj[h] = "FALSE";
      else obj[h] = val === null || val === undefined ? "" : String(val);
    });
    return obj;
  });
  return { headers, data };
}

// ── BATCH READ — bir nechta jadvalni BITTA Google so'rovida olish ──
export async function getMultipleSheets(ranges: string[]) {
  if (USE_POSTGRES) return pgGetMultiple(ranges);
  const result: Record<string, { headers: string[]; data: Record<string, string>[] }> = {};
  const missing: string[] = [];

  // Avval keshdan
  for (const r of ranges) {
    const cached = cacheGet(r);
    if (cached) result[r] = cached as { headers: string[]; data: Record<string, string>[] };
    else missing.push(r);
  }
  if (missing.length === 0) return result;

  const sheets = getSheetsClient();
  try {
    const resp = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_ID,
      ranges: missing,
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    });
    const valueRanges = resp.data.valueRanges || [];
    missing.forEach((range, idx) => {
      const parsed = parseRows(valueRanges[idx]?.values as unknown[][]);
      result[range] = parsed;
      if (parsed.headers.length > 0) cacheSet(range, parsed);
    });
  } catch {
    missing.forEach(range => { if (!result[range]) result[range] = { headers: [], data: [] }; });
  }
  return result;
}

// ── READ ──────────────────────────────────────────────

export async function getSheetData(range?: string) {
  const sheetName = process.env.GOOGLE_SHEET_NAME || "Sheet1";
  const fullRange = range || sheetName;

  const cached = cacheGet(fullRange);
  if (cached) return cached as { headers: string[]; data: Record<string, string>[] };

  if (USE_POSTGRES) {
    const result = await pgGetSheet(fullRange);
    if (result.headers.length > 0) cacheSet(fullRange, result);
    return result;
  }

  const sheets = getSheetsClient();
  let response;
  try {
    response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: fullRange,
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    });
  } catch {
    return { headers: [], data: [] };
  }

  const result = parseRows(response.data.values as unknown[][]);
  if (result.headers.length > 0) cacheSet(fullRange, result);
  return result;
}

export async function getSheetDataWhere(range: string, filterColumn: string, filterValues: string[]) {
  if (USE_POSTGRES) return pgGetSheetWhere(range, filterColumn, filterValues);
  const result = await getSheetData(range);
  const wanted = new Set(filterValues.map((v) => String(v || "").trim()).filter(Boolean));
  if (!filterColumn || wanted.size === 0) return { headers: result.headers, data: [] };
  return {
    headers: result.headers,
    data: result.data.filter((row) => wanted.has(String(row[filterColumn] || "").trim())),
  };
}

export async function getSheetNames() {
  if (USE_POSTGRES) return pgGetSheetNames();
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  return response.data.sheets?.map((s) => s.properties?.title || "") || [];
}

// ── WRITE ─────────────────────────────────────────────

async function ensureSheetExists(sheetName: string, headers: string[]) {
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const exists = meta.data.sheets?.some(s => s.properties?.title === sheetName);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: sheetName } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [headers] },
    });
  }
}

export async function appendRow(sheetName: string, row: Record<string, string | number>) {
  if (USE_POSTGRES) return pgAppendRow(sheetName, row);
  invalidateCache(sheetName);
  const sheets = getSheetsClient();

  let res;
  try {
    res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: sheetName,
      valueRenderOption: "UNFORMATTED_VALUE",
    });
  } catch {
    // Sheet mavjud emas — yaratib, qayta urinib ko'ramiz
    await ensureSheetExists(sheetName, Object.keys(row));
    res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: sheetName,
      valueRenderOption: "UNFORMATTED_VALUE",
    });
  }

  const rows = res.data.values ?? [];
  const rawHeaders = (rows[0] ?? []) as unknown[];

  const validCols = rawHeaders
    .map((h, i) => ({ h: String(h), i }))
    .filter(({ h }) => h && h !== "false" && h !== "null" && h !== "true");

  const values = validCols.map(({ h }) => {
    const v = row[h];
    if (v === undefined || v === null || v === "") return "";
    return v;
  });
  const nextRow = rows.length + 1;
  const endColLetter = colToLetter(validCols.length - 1);

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A${nextRow}:${endColLetter}${nextRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] },
  });
}

// ── BATCH APPEND — bir nechta qatorni BITTA Google so'rovida qo'shish ──
export async function appendRows(sheetName: string, rowsData: Record<string, string | number>[]) {
  if (!rowsData || rowsData.length === 0) return;
  if (USE_POSTGRES) return pgAppendRows(sheetName, rowsData);
  invalidateCache(sheetName);
  const sheets = getSheetsClient();

  let res;
  try {
    res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: sheetName, valueRenderOption: "UNFORMATTED_VALUE",
    });
  } catch {
    await ensureSheetExists(sheetName, Object.keys(rowsData[0]));
    res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: sheetName, valueRenderOption: "UNFORMATTED_VALUE",
    });
  }

  const rows = res.data.values ?? [];
  const rawHeaders = (rows[0] ?? []) as unknown[];
  const validCols = rawHeaders
    .map((h, i) => ({ h: String(h), i }))
    .filter(({ h }) => h && h !== "false" && h !== "null" && h !== "true");

  const values = rowsData.map((row) =>
    validCols.map(({ h }) => {
      const v = row[h];
      if (v === undefined || v === null || v === "") return "";
      return v;
    })
  );

  const startRow = rows.length + 1;
  const endRow = rows.length + values.length;
  const endColLetter = colToLetter(validCols.length - 1);

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A${startRow}:${endColLetter}${endRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

export async function updateCell(
  sheetName: string,
  idColumn: string,
  idValue: string,
  targetColumn: string,
  newValue: string
) {
  if (USE_POSTGRES) return pgUpdateCell(sheetName, idColumn, idValue, targetColumn, newValue);
  invalidateCache(sheetName);
  const sheets = getSheetsClient();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName,
  });
  const rows = res.data.values;
  if (!rows) throw new Error("Ma'lumot topilmadi");

  const headers = rows[0] as string[];
  const idColIndex = headers.indexOf(idColumn);
  const targetColIndex = headers.indexOf(targetColumn);
  if (idColIndex === -1 || targetColIndex === -1) throw new Error("Ustun topilmadi");

  // trim() bilan solishtirish — bo'sh joy muammosini hal qiladi
  const rowIndex = rows.findIndex((r, i) => i > 0 && (r[idColIndex] ?? "").trim() === idValue.trim());
  if (rowIndex === -1) throw new Error(`Qator topilmadi: ${idValue}`);

  const colLetter = colToLetter(targetColIndex);
  const sheetRowNumber = rowIndex + 1;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!${colLetter}${sheetRowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[newValue]] },
  });
}

function colToLetter(index: number): string {
  let letter = "";
  let n = index;
  while (n >= 0) {
    letter = String.fromCharCode(65 + (n % 26)) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

export async function updateRow(
  sheetName: string,
  idColumn: string,
  idValue: string,
  updatedRow: Record<string, string>
) {
  if (USE_POSTGRES) return pgUpdateRow(sheetName, idColumn, idValue, updatedRow);
  invalidateCache(sheetName);
  const sheets = getSheetsClient();

  // Barcha qatorlarni olish
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName,
  });
  const rows = res.data.values;
  if (!rows) throw new Error("Ma'lumot topilmadi");

  const headers = rows[0] as string[];
  const idColIndex = headers.indexOf(idColumn);
  if (idColIndex === -1) throw new Error("ID ustun topilmadi");

  const rowIndex = rows.findIndex((r, i) => i > 0 && r[idColIndex] === idValue);
  if (rowIndex === -1) throw new Error("Qator topilmadi");

  const sheetRowNumber = rowIndex + 1; // 1-based
  const values = headers.map((h) => {
    const val = updatedRow[h] ?? rows[rowIndex][headers.indexOf(h)] ?? "";
    // Sheets checkbox uchun katta harf TRUE/FALSE kerak
    if (val === "true") return "TRUE";
    if (val === "false") return "FALSE";
    return val;
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A${sheetRowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] },
  });
}

export async function deleteRow(
  sheetName: string,
  idColumn: string,
  idValue: string
) {
  if (USE_POSTGRES) return pgDeleteRow(sheetName, idColumn, idValue);
  invalidateCache(sheetName);
  const sheets = getSheetsClient();

  // Sheet ID ni topish
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = spreadsheet.data.sheets?.find(
    (s) => s.properties?.title?.toLowerCase() === sheetName.toLowerCase()
  );
  if (!sheet?.properties?.sheetId) throw new Error("Sheet topilmadi: " + sheetName);
  const sheetId = sheet.properties.sheetId;

  // Qator indeksini topish
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName,
  });
  const rows = res.data.values;
  if (!rows) throw new Error("Ma'lumot topilmadi");

  const headers = rows[0] as string[];
  const idColIndex = headers.indexOf(idColumn);
  const rowIndex = rows.findIndex((r, i) => i > 0 && r[idColIndex] === idValue);
  if (rowIndex === -1) throw new Error("Qator topilmadi");

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId,
            dimension: "ROWS",
            startIndex: rowIndex,
            endIndex: rowIndex + 1,
          },
        },
      }],
    },
  });
}

// ── DRIVE IMAGES ──────────────────────────────────────

export async function getDriveImage(
  imagePath: string
): Promise<{ stream: NodeJS.ReadableStream; mimeType: string } | null> {
  const auth = getAuthClient(["https://www.googleapis.com/auth/drive.readonly"]);
  const drive = google.drive({ version: "v3", auth });

  const fileName = imagePath.split("/").pop();
  if (!fileName) return null;

  const searchRes = await drive.files.list({
    q: `name='${fileName}' and trashed=false`,
    fields: "files(id, name, mimeType)",
    pageSize: 1,
  });

  const file = searchRes.data.files?.[0];
  if (!file?.id) return null;

  const fileRes = await drive.files.get(
    { fileId: file.id, alt: "media" },
    { responseType: "stream" }
  );

  return {
    stream: fileRes.data as unknown as NodeJS.ReadableStream,
    mimeType: file.mimeType || "image/jpeg",
  };
}

export async function uploadDriveImage(
  fileName: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const auth = getAuthClient([
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive",
  ]);
  const drive = google.drive({ version: "v3", auth });
  const { Readable } = await import("stream");

  await drive.files.create({
    requestBody: { name: fileName, mimeType },
    media: { mimeType, body: Readable.from(buffer) },
    fields: "id",
  });

  return `Mahsulot_Images/${fileName}`;
}
