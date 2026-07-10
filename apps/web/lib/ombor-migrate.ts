// Ombor ko'p-skladli inventar uchun ZARUR PG ustunlarini qo'shadi (idempotent).
// Ikki joyda ishlatiladi: (1) instrumentation.ts — server boot'da avtomatik,
// (2) /api/admin/ombor-migrate — qo'lda (token bilan) va read-only tekshiruv.
//
// Kod yangi ustun YARATMAYDI (appendRow faqat mavjud ustunga yozadi) — shuning uchun
// production PG'da ustunlar bir marta shu yerda qo'shilishi shart. Sheets rejimida (lokal)
// ustunlar qo'lda qo'shiladi; bu funksiya faqat USE_POSTGRES=true da ishlaydi.

import { resetPgColumnCache, invalidateCache } from "./sheets";

// Har biri: jadval + kerakli ustun (toza nom). Bo'shliqli eski nom (" Ombor_2") bo'lsa — RENAME.
const REQUIRED: { table: string; column: string }[] = [
  { table: "sotuv_savat", column: "Ombor_2" },
  { table: "sotuv_savat_dollar", column: "Ombor_2" },
  { table: "mijozlar", column: "Dokon_Ombor_ID" },
  // Yangi /omborlar CRUD Ombor jadvaliga Masul/Status yozadi — ustunlar bo'lmasa jimgina tushadi.
  { table: "ombor", column: "Masul" },
  { table: "ombor", column: "Status" },
  // Agent bo'yicha Telegram yo'naltirish: har agentning o'z bot tokeni + guruh chat_id si
  { table: "foydalanuvchi", column: "Telegram_Token" },
  { table: "foydalanuvchi", column: "Telegram_Chat" },
];

function q(name: string) { return '"' + String(name).replace(/"/g, '""') + '"'; }

export interface MigrateResult {
  ok: boolean;
  ran: boolean;                       // haqiqatan PG'ga ulanib ishladimi
  log: string[];
  state?: Record<string, string[]>;   // yakuniy ustunlar (tekshirish uchun)
  error?: string;
}

// pg pool'ini lazy ochish — Sheets rejimida pg umuman yuklanmaydi.
async function withPool<T>(fn: (query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>) => Promise<T>): Promise<T> {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 2,
    connectionTimeoutMillis: 8000,
    // ALTER TABLE ACCESS EXCLUSIVE lock kutib boot'ni OSIB QO'YMASLIGI uchun:
    // lock kutish 5s dan oshsa xato bo'ladi (osilish emas) → catch → server baribir ishga tushadi.
    options: "-c lock_timeout=5000 -c statement_timeout=30000",
  });
  try {
    return await fn((sql, params) => pool.query(sql, params) as Promise<{ rows: Record<string, unknown>[] }>);
  } finally {
    await pool.end();
  }
}

async function columnsOf(query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>, table: string): Promise<string[]> {
  const r = await query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
    [table],
  );
  return r.rows.map((x) => x.column_name as string);
}

/** ZARUR ustunlarni qo'shadi/normallashtiradi (idempotent). USE_POSTGRES=true talab qiladi. */
export async function ensureOmborColumns(): Promise<MigrateResult> {
  const log: string[] = [];
  if (process.env.USE_POSTGRES !== "true") { log.push("USE_POSTGRES!=true — Postgres migratsiyasi o'tkazib yuborildi (Sheets rejimi)"); return { ok: true, ran: false, log }; }
  if (!process.env.DATABASE_URL) { log.push("DATABASE_URL yo'q"); return { ok: false, ran: false, log }; }
  try {
    return await withPool(async (query) => {
      for (const { table, column } of REQUIRED) {
        const cols = await columnsOf(query, table);
        if (cols.length === 0) { log.push(`SKIP ${table}: jadval topilmadi`); continue; }
        if (cols.includes(column)) { log.push(`OK ${table}.${column}`); continue; }
        const spaced = cols.find((c) => c.trim() === column);
        if (spaced) {
          await query(`ALTER TABLE ${q(table)} RENAME COLUMN ${q(spaced)} TO ${q(column)}`);
          log.push(`RENAME ${table}: "${spaced}" -> "${column}"`);
        } else {
          await query(`ALTER TABLE ${q(table)} ADD COLUMN ${q(column)} TEXT`);
          log.push(`ADD ${table}.${column}`);
        }
      }
      const state: Record<string, string[]> = {};
      for (const { table } of REQUIRED) state[table] = await columnsOf(query, table);
      resetPgColumnCache();
      invalidateCache();
      return { ok: true, ran: true, log, state };
    });
  } catch (e) {
    return { ok: false, ran: false, log, error: e instanceof Error ? e.message : String(e) };
  }
}

/** DDL SIZ faqat holatni qaytaradi (tekshirish uchun). */
export async function checkOmborColumns(): Promise<MigrateResult> {
  const log: string[] = [];
  if (process.env.USE_POSTGRES !== "true") { log.push("USE_POSTGRES!=true"); return { ok: true, ran: false, log }; }
  if (!process.env.DATABASE_URL) { log.push("DATABASE_URL yo'q"); return { ok: false, ran: false, log }; }
  try {
    return await withPool(async (query) => {
      const state: Record<string, string[]> = {};
      for (const { table, column } of REQUIRED) {
        const cols = await columnsOf(query, table);
        state[table] = cols;
        log.push(`${table}.${column}: ${cols.includes(column) ? "BOR ✓" : (cols.find(c => c.trim() === column) ? "bo'shliqli (migratsiya kerak)" : "YO'Q ✗")}`);
      }
      return { ok: true, ran: false, log, state };
    });
  } catch (e) {
    return { ok: false, ran: false, log, error: e instanceof Error ? e.message : String(e) };
  }
}
