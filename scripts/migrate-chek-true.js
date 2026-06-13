// Bir martalik migratsiya: Sotuv sheetidagi BARCHA mavjud qatorlarni Chek=TRUE qiladi.
// Bitta batch values.update (rate-limit xavfsiz). apps/web/.env.local creds ishlatadi.
// Ishga tushirish: node scripts/migrate-chek-true.js
const fs = require("fs");
const path = require("path");
const { google } = require(path.join(__dirname, "..", "apps", "web", "node_modules", "googleapis"));

// ── .env.local ni o'qish ──
function loadEnv() {
  const p = path.join(__dirname, "..", "apps", "web", ".env.local");
  const txt = fs.readFileSync(p, "utf8");
  const env = {};
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[m[1]] = v;
  }
  return env;
}

async function main() {
  const env = loadEnv();
  const SPREADSHEET_ID = env.GOOGLE_SHEETS_ID;
  const privateKey = (env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL, private_key: privateKey },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  // 1) Sarlavha + Chek ustunini topish
  const head = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: "Sotuv!1:1" });
  const headers = head.data.values ? head.data.values[0] : [];
  const chekIdx = headers.indexOf("Chek");
  if (chekIdx === -1) { console.error("XATO: 'Chek' ustuni topilmadi. Sarlavhalar:", headers); process.exit(1); }
  const colLetter = String.fromCharCode(65 + chekIdx); // 12 -> 'M'

  // 2) Sotuv_ID ustuni bo'yicha qatorlar sonini aniqlash
  const idCol = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: "Sotuv!A2:A" });
  const ids = (idCol.data.values || []).map(r => r[0]);
  let lastNonEmpty = 0;
  ids.forEach((v, i) => { if (String(v || "").trim()) lastNonEmpty = i + 1; });
  if (lastNonEmpty === 0) { console.log("Qator yo'q."); return; }

  // 3) Joriy Chek qiymatlari (statistika uchun)
  const chekRange = `Sotuv!${colLetter}2:${colLetter}${lastNonEmpty + 1}`;
  const cur = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: chekRange });
  const curVals = cur.data.values || [];
  const already = curVals.filter(r => String(r[0] || "").toUpperCase() === "TRUE").length;

  console.log(`Sotuv qatorlari: ${lastNonEmpty} | hozir Chek=TRUE: ${already} | TRUE qilinadi: ${lastNonEmpty - already}`);

  // 4) Hammasini TRUE qilib bitta batch yozuv
  const values = Array.from({ length: lastNonEmpty }, () => ["TRUE"]);
  const res = await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: chekRange,
    valueInputOption: "RAW",
    requestBody: { values },
  });
  console.log(`TAYYOR ✅ Yangilandi: ${res.data.updatedCells} katak (${chekRange})`);
}

main().catch(e => { console.error("XATO:", e.message); process.exit(1); });
