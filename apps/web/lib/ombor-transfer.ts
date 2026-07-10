// Ombor ko'p-skladli (multi-warehouse) inventar uchun umumiy yordamchilar.
//
// SEMANTIKA:
//   Ombor_ID  = MANBA ombor  (mahsulot qayerdan CHIQADI — chiqim, minus)
//   Ombor_2   = QABUL ombor  (transfer qayerga TUSHADI — kirim, plus; faqat do'konga sotuvda to'ladi)
//
// Qoldiq (har ombor w, mahsulot p):
//   INV[w][p] = Σ Xarid[Ombor_ID=w] + Σ Sotuv[Ombor_2=w] − Σ Sotuv[Ombor_ID=w]
// Global qoldiq: G[p] = Σ_w INV[w][p] = Σ Xarid − Σ(Ombor_2 BO'SH) Sotuv
// (Transfer qatorlari — Ombor_2 to'la — global hisobda o'zaro qisqaradi, double-count bo'lmaydi.)

export interface MijozLike { Dokon_Ombor_ID?: string }
export interface FoydalanuvchiLike { Foydalanuvchi_ID: string; Ombor_ID?: string; Lavozim?: string }

const t = (v: unknown) => String(v ?? "").trim();

/**
 * Mijoz do'konmi? Do'kon bo'lsa — uning ombori (Dokon_Ombor_ID), aks holda "".
 * Do'kon aniqlash DETERMINISTIK: Mijozlar jadvalidagi aniq Dokon_Ombor_ID ustuni bo'yicha
 * (evristikaga tayanmaydi — oddiy mijozlar noto'g'ri "transfer" bo'lib qolmasligi uchun).
 */
export function dokonOmbor(mijoz: MijozLike | undefined | null): string {
  return t(mijoz?.Dokon_Ombor_ID);
}

/** Foydalanuvchi_ID → Ombor_ID xaritasi (agentning biriktirilgan ombori). */
export function omborByAgent(users: FoydalanuvchiLike[]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const u of users) { const id = t(u.Foydalanuvchi_ID); if (id) m[id] = t(u.Ombor_ID); }
  return m;
}

/**
 * Do'kon (shop) omborlari to'plami — Sotuvchi (non-Admin) foydalanuvchilarga biriktirilgan omborlar,
 * Admin omborlaridan (asosiy) TASHQARI. FOYDALANUVCHI ma'lumotidan quriladi (Ombor_ID + Lavozim):
 *  - BARQAROR — mijoz Dokon_Ombor_ID keshiga bog'liq emas (do'kon o'z omboridan sotishi kafolatlanadi)
 *  - Legacy " Ombor_2"=Asosiy ni transferdan ajratish uchun ham ishlatiladi (Asosiy do'kon ombori emas)
 */
export function shopWarehouseSet(foydalanuvchilar: FoydalanuvchiLike[]): Set<string> {
  const adminOmbor = new Set<string>();
  for (const u of foydalanuvchilar) if (t(u.Lavozim) === "Admin" && t(u.Ombor_ID)) adminOmbor.add(t(u.Ombor_ID));
  const s = new Set<string>();
  for (const u of foydalanuvchilar) {
    const o = t(u.Ombor_ID);
    if (o && t(u.Lavozim) && t(u.Lavozim) !== "Admin" && !adminOmbor.has(o)) s.add(o);
  }
  return s;
}

/**
 * Sotuv qatori qaysi ombordan AYIRILADI (Ombor_ID = manba ombor).
 * Sotuvchi-AGENT (login user emas) bo'yicha aniqlanadi — admin do'kon nomidan sotsa ham to'g'ri.
 * - Agar agent DO'KON omboriga biriktirilgan bo'lsa (agentOmbor ∈ shopWarehouses) → o'sha do'kon ombori
 * - Aks holda → mahsulotning uy-ombori (o'zgarmaydi — mavjud sotuvlar uchun regressiya yo'q)
 */
export function manbaOmbor(agentOmbor: string | undefined, shopWarehouses: Set<string>, mahsulotOmborId: string): string {
  const a = t(agentOmbor);
  if (a && shopWarehouses.has(a)) return a;
  return t(mahsulotOmborId);
}

/**
 * Sotuv_Savat qatorlarida "Ombor_2" ustunining HAQIQIY kaliti.
 * Eski Google Sheets sarlavhasida boshida bo'shliq bo'lishi mumkin (" Ombor_2") —
 * yozish/o'qishda aynan mos kalit kerak, aks holda jimgina tushib qoladi.
 * Namuna qatordan topadi; topilmasa toza "Ombor_2" (migratsiyadan keyingi PG holati).
 */
export function ombor2Key(sampleRow?: Record<string, unknown> | null): string {
  if (sampleRow) {
    const k = Object.keys(sampleRow).find((x) => x.trim() === "Ombor_2");
    if (k) return k;
  }
  return "Ombor_2";
}

function numv(v: unknown) { return parseFloat(String(v ?? "0").replace(/\s/g, "").replace(",", ".")) || 0; }

/**
 * Per-ombor inventar hisobi (mahsulot va omborlar sahifalari uchun YAGONA manba).
 *   Xarid_Savat  → +Soni  Ombor_ID ga (kirim)
 *   Sotuv_*      → −Soni  Ombor_ID dan (chiqim/manba); Ombor_2 to'la bo'lsa +Soni Ombor_2 ga (transfer qabul)
 * Qaytadi: inv[ombor][mahsulot] va global[mahsulot] (barcha omborlar yig'indisi — transferlar qisqaradi).
 */
export function computeInvByOmbor(
  xarid: Record<string, string>[],
  sotuvSom: Record<string, string>[],
  sotuvDollar: Record<string, string>[],
  shopWarehouses: Set<string>,
): { inv: Record<string, Record<string, number>>; global: Record<string, number> } {
  const inv: Record<string, Record<string, number>> = {};
  const bump = (ombor: string | undefined, mid: string, d: number) => {
    const o = t(ombor) || "__none__";
    if (!inv[o]) inv[o] = {};
    inv[o][mid] = (inv[o][mid] || 0) + d;
  };
  (xarid || []).forEach((r) => { if (r.Mahsulot_ID) bump(r.Ombor_ID, r.Mahsulot_ID, numv(r.Soni)); });
  const sale = (r: Record<string, string>) => {
    if (!r.Mahsulot_ID) return;
    bump(r.Ombor_ID, r.Mahsulot_ID, -numv(r.Soni));
    const dest = readOmbor2(r);
    // Ombor_2 ni FAQAT haqiqiy do'kon ombori bo'lsa transfer deb hisoblaymiz.
    // Eski " Ombor_2"=Asosiy (legacy) do'kon ombori emas → e'tiborsiz (oddiy sotuv Asosiy'ni kamaytiradi).
    if (dest && shopWarehouses.has(dest)) bump(dest, r.Mahsulot_ID, numv(r.Soni));
  };
  (sotuvSom || []).forEach(sale);
  (sotuvDollar || []).forEach(sale);
  const global: Record<string, number> = {};
  for (const o of Object.keys(inv)) for (const mid of Object.keys(inv[o])) global[mid] = (global[mid] || 0) + inv[o][mid];
  return { inv, global };
}

/** Qator obyektidan Ombor_2 qiymatini bo'shliqli/toza kalitdan qat'i nazar o'qish.
 *  || ishlatiladi (?? emas): bo'sh toza "Ombor_2" ("") to'la " Ombor_2" ni yashirmasligi uchun
 *  (PG/Sheets bo'sh katakni "" qilib beradi, shuning uchun ikkala ustun birga bo'lsa muhim). */
export function readOmbor2(row: Record<string, unknown>): string {
  return t(row["Ombor_2"] || row[" Ombor_2"] || "");
}
