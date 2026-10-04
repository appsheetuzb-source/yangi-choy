// Mijozga boradigan Telegram xabarlari — qoldiqlar YAGONA ledgerdan (lib/mijoz-ledger.ts).
//
// Avval har sahifa "Ostatka"ni o'zicha hisoblardi va chekdagi raqam bilan farq qilardi;
// yangi sotuvda esa Telegram umuman yuborilmasdi — mijozdagi oxirgi xabar eskirib qolardi.
// Endi:
//   • to'lov SAQLANGANDAN KEYIN xabar tuziladi — ledgerda aynan shu to'lov topiladi;
//   • sana yonida vaqt ham chiqadi (ixcham: "02.10.2026 · 🕒 14:35");
//   • "Ostatka" ostida u QAYSI AMAL HOLATIGA ekani yoziladi;
//   • to'lov/sotuvdan keyin boshqa amallar bo'lsa (masalan o'tgan sana bilan kiritilgan to'lov) —
//     mijozning HOZIRGI qoldig'i ham qo'shiladi: mijozga har doim oxirgi raqam boradi;
//   • sotuv TASDIQLANGANDA ham xabar yuboriladi (qarzga aynan shu paytda qo'shiladi).

import { mijozLedger, mijozLedgerMalumoti, ledgerNuqta, holatMatni } from "./mijoz-ledger";

function num(v: unknown): number {
  return parseFloat(String(v ?? "0").replace(/\s/g, "").replace(",", ".")) || 0;
}
// Mavjud xabarlardagi format saqlanadi (foydalanuvchilar o'rgangan)
const nS = (v: number) => String(Math.round(v));
const nU = (v: number) => String(Math.round(v * 100) / 100);
function sanaQatori(sana: string, vaqt: string | undefined): string {
  const t = String(vaqt || "").trim().split(":").slice(0, 2).join(":");
  return `📅 Sana: ${sana || "—"}${t ? ` · 🕒 ${t}` : ""}`;
}

export function telegramYubor(text: string, agent?: string): void {
  fetch("/api/telegram", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, agent: agent || "" }),
  }).catch(() => {});
}

export interface Zaxira { oldSom: number; oldUsd: number; yangiSom: number; yangiUsd: number }

/** To'lov xabari. To'lov S_tolov ga SAQLANGANDAN KEYIN chaqiriladi (await qilish shart emas). */
export async function tolovXabari(o: {
  sarlavha: string;
  mijozId: string;
  mijozNomi: string;
  tolovId: string;
  sana: string;
  vaqt: string;
  somVal: number;
  usdVal: number;
  summa: string;
  summaDollar: string;
  izoh: string;
  /** Bo'sh bo'lsa mijozning agenti olinadi */
  agent?: string;
  /** Ledger yuklanmay qolsa (tarmoq xatosi) — sahifadagi hisob; u ham bo'lmasa qoldiq qatorlari chiqmaydi */
  zaxira?: Zaxira;
}): Promise<void> {
  let old = o.zaxira ? { som: o.zaxira.oldSom, usd: o.zaxira.oldUsd } : null;
  let yangi = o.zaxira ? { som: o.zaxira.yangiSom, usd: o.zaxira.yangiUsd } : null;
  let sana = o.sana, vaqt = o.vaqt, holat = "", agent = o.agent || "";
  let keyin: null | { som: number; usd: number; holat: string } = null;
  try {
    const d = await mijozLedgerMalumoti(o.mijozId);
    if (!agent) agent = String(d.mijoz?.Agent || "").trim();
    const nq = ledgerNuqta(mijozLedger(d), "tolov", o.tolovId);
    if (nq) {
      old = { som: nq.op.oldSom, usd: nq.op.oldUsd };
      yangi = { som: nq.op.yangiSom, usd: nq.op.yangiUsd };
      sana = nq.op.sana || sana; vaqt = nq.op.vaqt || vaqt;
      holat = holatMatni(nq.oldingi);
      if (nq.keyinAmalBor) keyin = { som: nq.oxirgi.yangiSom, usd: nq.oxirgi.yangiUsd, holat: holatMatni(nq.oxirgi) };
    }
  } catch { /* zaxira bilan yuboriladi */ }

  const qatorlar = [
    o.sarlavha, "",
    sanaQatori(sana, vaqt),
    `👤 Mijoz: ${o.mijozNomi || "—"}`,
    ...(old ? [
      `📅 Ostatka(So'm): ${nS(old.som)}`,
      `📅 Ostatka(Dollar): ${nU(old.usd)}`,
    ] : []),
    ...(holat ? [`      ↳ ${holat} holatiga`] : []),
    `💵 So'm: ${o.somVal > 0 ? nS(o.somVal) : "null"}`,
    `💵 Dollar: ${o.usdVal > 0 ? nU(o.usdVal) : "null"}`,
    `💵 Jami so'm: ${nS(num(o.summa))}`,
    `💵 Jami dollar: ${nU(num(o.summaDollar))}`,
    ...(yangi ? [
      `💵 Qoldiq (so'm): ${nS(yangi.som)}`,
      `💵 Qoldiq ($): ${nU(yangi.usd)}`,
    ] : []),
    ...(keyin ? [
      `🔄 Hozirgi qoldiq (so'm): ${nS(keyin.som)}`,
      `🔄 Hozirgi qoldiq ($): ${nU(keyin.usd)}`,
      `      ↳ ${keyin.holat} holatiga`,
    ] : []),
    `📌 Izoh: ${o.izoh && o.izoh.trim() ? o.izoh : "null"}`,
  ];
  telegramYubor(qatorlar.join("\n"), agent);
}

/** Sotuv tasdiqlanganda yuboriladigan xabar (sotuv shu paytda qarzga qo'shiladi). */
export async function sotuvTasdiqXabari(o: {
  sotuvId: string;
  mijozId: string;
  mijozNomi?: string;
  /** Bo'sh bo'lsa mijozning agenti olinadi */
  agent?: string;
}): Promise<void> {
  try {
    const d = await mijozLedgerMalumoti(o.mijozId, o.sotuvId);
    const nq = ledgerNuqta(mijozLedger(d), "sotuv", o.sotuvId);
    if (!nq) return;
    const op = nq.op;
    const qatorlar = [
      "🧾✅ Sotuv tasdiqlandi", "",
      sanaQatori(op.sana, op.vaqt),
      `👤 Mijoz: ${o.mijozNomi || String(d.mijoz?.Ism || "").trim() || "—"}`,
      ...(op.raqam ? [`🔢 Sotuv №${op.raqam}`] : []),
      `📅 Ostatka(So'm): ${nS(op.oldSom)}`,
      `📅 Ostatka(Dollar): ${nU(op.oldUsd)}`,
      `      ↳ ${holatMatni(nq.oldingi)} holatiga`,
      ...(op.som !== 0 || op.usd === 0 ? [`🛒 Sotuv (so'm): ${nS(op.som)}`] : []),
      ...(op.usd !== 0 ? [`🛒 Sotuv ($): ${nU(op.usd)}`] : []),
      `💵 Qoldiq (so'm): ${nS(op.yangiSom)}`,
      `💵 Qoldiq ($): ${nU(op.yangiUsd)}`,
      ...(nq.keyinAmalBor ? [
        `🔄 Hozirgi qoldiq (so'm): ${nS(nq.oxirgi.yangiSom)}`,
        `🔄 Hozirgi qoldiq ($): ${nU(nq.oxirgi.yangiUsd)}`,
        `      ↳ ${holatMatni(nq.oxirgi)} holatiga`,
      ] : []),
    ];
    telegramYubor(qatorlar.join("\n"), o.agent || String(d.mijoz?.Agent || "").trim());
  } catch { /* Telegram ixtiyoriy — tasdiqlashni buzmasin */ }
}

/** So'm ⇄ $ ayirboshlash xabari (ikki oyoq S_tolov ga saqlangandan keyin). */
export async function ayirboshlashXabari(o: {
  guruh: string;
  mijozId: string;
  mijozNomi: string;
  izoh: string;
  /** Bo'sh bo'lsa mijozning agenti olinadi */
  agent?: string;
}): Promise<void> {
  try {
    const d = await mijozLedgerMalumoti(o.mijozId);
    const nq = ledgerNuqta(mijozLedger(d), "ayirboshlash", o.guruh);
    if (!nq) return;
    const op = nq.op;
    const ishora = (v: number, f: (x: number) => string) => (v > 0 ? "+" : "") + f(v);
    const qatorlar = [
      `🔁 Ayirboshlash (${op.som < 0 ? "so'm → $" : "$ → so'm"})`, "",
      sanaQatori(op.sana, op.vaqt),
      `👤 Mijoz: ${o.mijozNomi || String(d.mijoz?.Ism || "").trim() || "—"}`,
      `📅 Ostatka(So'm): ${nS(op.oldSom)}`,
      `📅 Ostatka(Dollar): ${nU(op.oldUsd)}`,
      `      ↳ ${holatMatni(nq.oldingi)} holatiga`,
      `🔁 So'm: ${ishora(op.som, nS)}`,
      `🔁 Dollar: ${ishora(op.usd, nU)}`,
      `💱 Kurs: ${nS(op.kurs)}`,
      `💵 Qoldiq (so'm): ${nS(op.yangiSom)}`,
      `💵 Qoldiq ($): ${nU(op.yangiUsd)}`,
      ...(nq.keyinAmalBor ? [
        `🔄 Hozirgi qoldiq (so'm): ${nS(nq.oxirgi.yangiSom)}`,
        `🔄 Hozirgi qoldiq ($): ${nU(nq.oxirgi.yangiUsd)}`,
        `      ↳ ${holatMatni(nq.oxirgi)} holatiga`,
      ] : []),
      `📌 Izoh: ${o.izoh && o.izoh.trim() ? o.izoh : "null"}`,
    ];
    telegramYubor(qatorlar.join("\n"), o.agent || String(d.mijoz?.Agent || "").trim());
  } catch { /* Telegram ixtiyoriy */ }
}
