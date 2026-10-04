// Mijozning YAGONA ledgeri — chek, Telegram va sotuv detali shu bitta manbadan o'qiydi.
//
// MUAMMO (production'da o'lchangan): "ostatka"ning 3 xil ta'rifi bor edi —
//   1) Telegram / mijoz sahifasi: jonli hisob (hamma amallar, sanaga qaramay);
//   2) sotuv detalidan ochilgan chek: sotuv yaratilganda MUZLATILGAN Sotuv.Balans + "vaqt oynasi";
//   3) Sotuvlar ro'yxatidan ochilgan chek: Sotuv_ID bog'lamali boshqa jonli hisob.
// Bitta chek qaysi tugmadan ochilganiga qarab turli raqam chop etardi. Muzlatilgan snapshot
// esa to'lov/sotuv sanasi tahrirlanganda yangilanmasdi: so'nggi 60 kunda 1 421 sotuvdan
// 69 tasida chekdagi "eski qarz" noto'g'ri edi (masalan 41 DOKON: 800 000 so'mlik to'lov
// sanasi 08.09 ga ko'chirilgan, 12–16 avgust cheklari qarzni 800 000 kam ko'rsatardi).
//
// YECHIM: barcha amallar akt-sverkadagidek SANA + VAQT tartibida bitta ro'yxatga teriladi
// va har biri uchun "oldingi qoldiq → yangi qoldiq" hisoblanadi. Hech narsa muzlatilmaydi —
// sana tahrirlansa ledger o'zi to'g'ri joyga ko'chadi.

export type LedgerTur = "sotuv" | "tolov" | "ayirboshlash";

export interface LedgerOp {
  tur: LedgerTur;
  id: string;              // Sotuv_ID / Tolov_ID / ayirboshlash guruhi
  raqam: string;           // Sotuv_Raqami (sotuv uchun)
  sana: string;            // DD.MM.YYYY
  vaqt: string;            // HH:MM:SS
  k: number;               // tartib kaliti
  som: number;             // qarzga ta'sir: + ortadi, − kamayadi
  usd: number;
  tasdiq: boolean;         // sotuv: Chek to'ldirilgan (qarzga kiradi)
  kurs: number;            // ayirboshlash kursi
  oldSom: number; oldUsd: number;     // shu amaldan OLDINGI qoldiq
  yangiSom: number; yangiUsd: number; // shu amaldan KEYINGI qoldiq
}

export interface SotuvLike { Sotuv_ID?: string; Sotuv_Raqami?: string; Sana?: string; Vaqt?: string; Chek?: string }
export interface SavatSomLike { Sotuv_ID?: string; Summa_som?: string }
export interface SavatUsdLike { Sotuv_ID?: string; Summa?: string }
export interface TolovLike {
  Tolov_ID?: string; Sana?: string; Vaqt?: string; Valyuta?: string; Turi?: string;
  Summa?: string; Som?: string; Summa_dollar?: string; Dollar?: string; Dollar_Kursi?: string;
}

export interface LedgerKirish {
  boshSom: number;
  boshUsd: number;
  sotuvlar: SotuvLike[];
  savatSom: SavatSomLike[];
  savatDollar: SavatUsdLike[];
  tolovlar: TolovLike[];
  /** Tasdiqlanmagan bo'lsa ham ledgerga kiritiladigan sotuv (o'z cheki uchun) */
  majburiySotuvId?: string;
}

export const AYIRBOSHLASH = "Ayirboshlash";
/** Ayirboshlash qatorlarining Tolov_ID shakli: ab-<guruh>-s (so'm oyog'i) / ab-<guruh>-d (dollar oyog'i) */
export function ayirboshlashGuruhi(tolovId: string | undefined): string {
  const m = String(tolovId || "").trim().match(/^ab-([a-z0-9]+)-[sd]$/i);
  return m ? m[1] : "";
}
export function ayirboshlashmi(t: { Turi?: string }): boolean {
  return String(t.Turi || "").trim() === AYIRBOSHLASH;
}

function num(v: unknown): number {
  return parseFloat(String(v ?? "0").replace(/\s/g, "").replace(",", ".")) || 0;
}
function tr(v: unknown): string { return String(v ?? "").trim(); }
export function dollarmi(valyuta: string | undefined): boolean {
  const s = tr(valyuta).toLowerCase();
  return s.includes("dollar") || s === "$" || s.includes("usd");
}
/** Sana+Vaqt -> tartib kaliti (akt-sverka bilan bir xil tartib) */
export function opKalit(sana: string | undefined, vaqt: string | undefined): number {
  const [d, m, y] = tr(sana).split(".").map(Number);
  const [h, mi, se] = tr(vaqt).split(":").map(Number);
  return (y || 0) * 1e10 + (m || 0) * 1e8 + (d || 0) * 1e6 + (h || 0) * 1e4 + (mi || 0) * 100 + (se || 0);
}

export function mijozLedger(k: LedgerKirish): LedgerOp[] {
  const sumSom: Record<string, number> = {};
  const sumUsd: Record<string, number> = {};
  k.savatSom.forEach(r => { const id = tr(r.Sotuv_ID); if (id) sumSom[id] = (sumSom[id] || 0) + num(r.Summa_som); });
  k.savatDollar.forEach(r => { const id = tr(r.Sotuv_ID); if (id) sumUsd[id] = (sumUsd[id] || 0) + num(r.Summa); });

  const majburiy = tr(k.majburiySotuvId);
  const ops: Omit<LedgerOp, "oldSom" | "oldUsd" | "yangiSom" | "yangiUsd">[] = [];

  k.sotuvlar.forEach(s => {
    const id = tr(s.Sotuv_ID); if (!id) return;
    const tasdiq = tr(s.Chek) !== "";
    if (!tasdiq && id !== majburiy) return;      // tasdiqlanmagan sotuv qarzga kirmaydi
    ops.push({ tur: "sotuv", id, raqam: tr(s.Sotuv_Raqami), sana: tr(s.Sana), vaqt: tr(s.Vaqt),
      k: opKalit(s.Sana, s.Vaqt), som: sumSom[id] || 0, usd: sumUsd[id] || 0, tasdiq, kurs: 0 });
  });

  // To'lovlar; ayirboshlashning ikki oyog'i bitta amalga birlashtiriladi
  const guruhlar: Record<string, (typeof ops)[number]> = {};
  k.tolovlar.forEach(p => {
    const d = dollarmi(p.Valyuta);
    const som = d ? 0 : -num(p.Summa || p.Som);
    const usd = d ? -num(p.Summa_dollar || p.Dollar) : 0;
    const g = ayirboshlashmi(p) ? ayirboshlashGuruhi(p.Tolov_ID) : "";
    if (g) {
      const mavjud = guruhlar[g];
      if (mavjud) { mavjud.som += som; mavjud.usd += usd; return; }
      const op = { tur: "ayirboshlash" as const, id: g, raqam: "", sana: tr(p.Sana), vaqt: tr(p.Vaqt),
        k: opKalit(p.Sana, p.Vaqt), som, usd, tasdiq: true, kurs: num(p.Dollar_Kursi) };
      guruhlar[g] = op; ops.push(op);
      return;
    }
    ops.push({ tur: ayirboshlashmi(p) ? "ayirboshlash" : "tolov", id: tr(p.Tolov_ID), raqam: "",
      sana: tr(p.Sana), vaqt: tr(p.Vaqt), k: opKalit(p.Sana, p.Vaqt), som, usd, tasdiq: true, kurs: num(p.Dollar_Kursi) });
  });

  // Barqaror tartib: sana+vaqt, teng bo'lsa kiritilgan tartib saqlanadi
  const tartib = ops.map((o, i) => ({ o, i })).sort((a, b) => a.o.k - b.o.k || a.i - b.i).map(x => x.o);

  let som = k.boshSom, usd = k.boshUsd;
  return tartib.map(o => {
    const oldSom = som, oldUsd = usd;
    som += o.som; usd += o.usd;
    return { ...o, oldSom, oldUsd, yangiSom: som, yangiUsd: usd };
  });
}

/** "Sotuv №6832" / "To'lov" / "Ayirboshlash" */
export function opNomi(o: Pick<LedgerOp, "tur" | "raqam">): string {
  if (o.tur === "sotuv") return o.raqam ? `Sotuv №${o.raqam}` : "Sotuv";
  if (o.tur === "ayirboshlash") return "Ayirboshlash";
  return "To'lov";
}
/** "18.09.2026 16:07" */
export function opVaqti(o: Pick<LedgerOp, "sana" | "vaqt">): string {
  const v = tr(o.vaqt).split(":").slice(0, 2).join(":");
  return v ? `${o.sana} ${v}` : o.sana;
}
/** "18.09.2026 16:07 · Sotuv №6832" — oldingi qoldiq qaysi amaldan keyingi holat ekani */
export function holatMatni(oldingi: LedgerOp | null | undefined): string {
  return oldingi ? `${opVaqti(oldingi)} · ${opNomi(oldingi)}` : "boshlang'ich qoldiq";
}

/** Ledgerdagi amal, undan oldingisi va eng oxirgisi */
export function ledgerNuqta(L: LedgerOp[], tur: LedgerTur, id: string) {
  const i = L.findIndex(o => o.tur === tur && o.id === id);
  if (i < 0) return null;
  const oxirgi = L[L.length - 1];
  return {
    op: L[i],
    oldingi: i > 0 ? L[i - 1] : null,
    oxirgi,
    keyinAmalBor: i < L.length - 1,
  };
}

// ── Ma'lumot olish: keshni AYLANIB o'tadi (Telegram/chek doim yangi holatdan chiqsin) ──

export type Qator = Record<string, string>;
async function olish(range: string, column: string, values: string[]): Promise<Qator[]> {
  const vals = values.map(v => tr(v)).filter(Boolean);
  if (!vals.length) return [];
  // URL uzunligi chegarasidan oshmaslik uchun bo'laklab so'raymiz
  const BOLAK = 120;
  const natija: Qator[] = [];
  for (let i = 0; i < vals.length; i += BOLAK) {
    const qism = vals.slice(i, i + BOLAK);
    const p = new URLSearchParams({ range, filterColumn: column });
    if (qism.length === 1) p.set("filterValue", qism[0]);
    else p.set("filterValues", qism.join(","));
    const res = await fetch(`/api/sheets?${p.toString()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`${range} yuklanmadi (${res.status})`);
    const d = await res.json() as { data?: Qator[] };
    natija.push(...(d.data || []));
  }
  return natija;
}

export interface MijozLedgerMalumot extends LedgerKirish {
  mijoz: Qator | null;
  sotuvQatorlari: Qator[];
}

/** Bitta mijozning ledger uchun barcha ma'lumoti — har doim serverdan yangi */
export async function mijozLedgerMalumoti(mijozId: string, majburiySotuvId?: string): Promise<MijozLedgerMalumot> {
  const id = tr(mijozId);
  const [mj, sot, tol] = await Promise.all([
    olish("Mijozlar", "Mijoz_ID", [id]),
    olish("Sotuv", "Mijoz_ID", [id]),
    olish("S_tolov", "Mijoz_ID", [id]),
  ]);
  const ids = sot.map(s => tr(s.Sotuv_ID)).filter(Boolean);
  const [ss, sd] = await Promise.all([
    olish("Sotuv_Savat", "Sotuv_ID", ids),
    olish("Sotuv_savat_dollar", "Sotuv_ID", ids),
  ]);
  const mijoz = mj[0] || null;
  return {
    mijoz,
    sotuvQatorlari: sot,
    boshSom: num(mijoz?.Boshlangich_Balans_som),
    boshUsd: num(mijoz?.Boshlangich_Balans_dollar),
    sotuvlar: sot, savatSom: ss, savatDollar: sd, tolovlar: tol,
    majburiySotuvId,
  };
}

// ── Bir nechta mijozning JORIY qoldig'i (muhlat oynasi, muhlat eslatmasi) ──

export interface Qoldiq { som: number; usd: number }

/** Sof hisob (server va brauzer uchun umumiy): har bir mijozning yakuniy ledger qoldig'i */
export function qoldiqlarHisobla(
  ids: string[], mijozlar: Qator[], sotuvlar: Qator[], savatSom: Qator[], savatDollar: Qator[], tolovlar: Qator[],
): Record<string, Qoldiq> {
  const guruh = (rows: Qator[]) => {
    const m: Record<string, Qator[]> = {};
    rows.forEach(r => { const id = tr(r.Mijoz_ID); if (id) (m[id] = m[id] || []).push(r); });
    return m;
  };
  const mj: Record<string, Qator> = {};
  mijozlar.forEach(m => { const id = tr(m.Mijoz_ID); if (id) mj[id] = m; });
  const sot = guruh(sotuvlar), tol = guruh(tolovlar);
  const natija: Record<string, Qoldiq> = {};
  ids.map(tr).filter(Boolean).forEach(id => {
    const boshSom = num(mj[id]?.Boshlangich_Balans_som), boshUsd = num(mj[id]?.Boshlangich_Balans_dollar);
    const L = mijozLedger({ boshSom, boshUsd, sotuvlar: sot[id] || [], savatSom, savatDollar, tolovlar: tol[id] || [] });
    const o = L[L.length - 1];
    natija[id] = o ? { som: o.yangiSom, usd: o.yangiUsd } : { som: boshSom, usd: boshUsd };
  });
  return natija;
}

/** Brauzerda: berilgan mijozlarning joriy qoldig'i (keshsiz, bo'laklab) */
export async function mijozlarQoldigi(ids: string[]): Promise<Record<string, Qoldiq>> {
  const uniq = [...new Set(ids.map(tr).filter(Boolean))];
  if (!uniq.length) return {};
  const [mj, sot, tol] = await Promise.all([
    olish("Mijozlar", "Mijoz_ID", uniq),
    olish("Sotuv", "Mijoz_ID", uniq),
    olish("S_tolov", "Mijoz_ID", uniq),
  ]);
  const sids = sot.map(s => tr(s.Sotuv_ID)).filter(Boolean);
  const [ss, sd] = await Promise.all([
    olish("Sotuv_Savat", "Sotuv_ID", sids),
    olish("Sotuv_savat_dollar", "Sotuv_ID", sids),
  ]);
  return qoldiqlarHisobla(uniq, mj, sot, ss, sd, tol);
}
