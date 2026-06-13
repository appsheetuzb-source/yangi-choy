import { google } from "googleapis";

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID;

// ── In-memory cache (5 daqiqa TTL) ────────────────────
const _cache: Record<string, { data: unknown; ts: number }> = {};
const CACHE_TTL = 5 * 60_000; // 5 minutes

function cacheGet(key: string) {
  const entry = _cache[key];
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}
function cacheSet(key: string, data: unknown) {
  _cache[key] = { data, ts: Date.now() };
}
export function invalidateCache(sheetName?: string) {
  if (sheetName) { delete _cache[sheetName]; }
  else { for (const k of Object.keys(_cache)) delete _cache[k]; }
}
// ─────────────────────────────────────────────────────

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

export async function getSheetNames() {
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

export async function updateCell(
  sheetName: string,
  idColumn: string,
  idValue: string,
  targetColumn: string,
  newValue: string
) {
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
