import { google } from "googleapis";

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID;

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

function getSheetsClient() {
  return google.sheets({ version: "v4", auth: getAuthClient() });
}

// ── READ ──────────────────────────────────────────────

export async function getSheetData(range?: string) {
  const sheets = getSheetsClient();
  const sheetName = process.env.GOOGLE_SHEET_NAME || "Sheet1";
  const fullRange = range || sheetName;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: fullRange,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) return { headers: [], data: [] };

  const headers = rows[0] as string[];
  const data = rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((header, i) => {
      obj[header] = row[i] || "";
    });
    return obj;
  });

  return { headers, data };
}

export async function getSheetNames() {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  return response.data.sheets?.map((s) => s.properties?.title || "") || [];
}

// ── WRITE ─────────────────────────────────────────────

export async function appendRow(sheetName: string, row: Record<string, string>) {
  const sheets = getSheetsClient();

  // Headerlarni olish
  const headersRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!1:1`,
  });
  const headers = headersRes.data.values?.[0] as string[] || [];
  const values = headers.map((h) => row[h] ?? "");

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName,
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
  const sheets = getSheetsClient();

  // Sheet ID ni topish
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = spreadsheet.data.sheets?.find(
    (s) => s.properties?.title === sheetName
  );
  if (!sheet?.properties?.sheetId === undefined) throw new Error("Sheet topilmadi");
  const sheetId = sheet!.properties!.sheetId!;

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
