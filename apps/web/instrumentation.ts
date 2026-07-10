// Server boot'da BIR MARTA ishlaydi (Next.js instrumentation).
// Ombor ko'p-skladli inventar uchun ZARUR PG ustunlarini avtomatik qo'shadi —
// deploy (PM2 restart) → shu funksiya → migratsiya. Qo'lda qadam/token/SSH kerak emas.
// Idempotent va xatoga bardoshli: xato bo'lsa ham server ishga tushaveradi (faqat log yoziladi).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return; // faqat Node runtime'da (Edge'da pg yo'q)
  if (process.env.USE_POSTGRES !== "true") return;   // faqat Postgres production'da
  try {
    const { ensureOmborColumns } = await import("./lib/ombor-migrate");
    const res = await ensureOmborColumns();
    console.log("[ombor-migrate]", res.ok ? "OK" : "XATO", JSON.stringify(res.log), res.error ? `error=${res.error}` : "");
  } catch (e) {
    console.error("[ombor-migrate] instrumentation xatosi:", e);
  }
}
