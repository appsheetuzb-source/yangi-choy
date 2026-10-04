// Muhlat (to'lov va'dasi) bo'yicha Telegram xabarlari (SERVER). Soatlik cron (/api/push/send)
// har soat muhlatCron() ni chaqiradi; /api/muhlat/eslatma — qo'lda/test.
//
// 1) ERTALAB (ESLATMA_SOATI = 08:00 .. 20:00): "Bugun muhlati kelgan mijozlar"
//   • faqat Turi="Mijoz", Status != "Bajarildi", Tugash (joriy va'da) == bugun (Toshkent);
//   • har bir muhlat kuniga BIR marta — yuborilganiga Eslatildi = bugun yoziladi. Ertalabki xabardan
//     keyin "bugun"ga qo'yilgan muhlat keyingi soatda "(qo'shimcha)" xabar bo'lib keladi;
//   • xabar mijoz bloklari chegarasida bo'linadi; faqat YETKAZILGAN qismdagi muhlatlar belgilanadi.
//
// 2) KECHQURUN (KECH_SOATI = 20:00 dan keyin, kuniga bir marta): "Bugun va'dasini bajarmagan mijozlar"
//   • bugungi va'dalar = Tugash == bugun YOKI bugun "bugun"dan boshqa kunga uzaytirilganlar;
//   • bajarmagan = bugun uzaytirilganlar + ochiq va VA'DA BERILGANDAN BERI to'lov qilmaganlar
//     (qarzi qolmagan mijoz "bajarmagan" bo'lmaydi);
//   • to'lov qilgan, lekin "Bajarildi" bosilmaganlar — alohida bo'limda (qolgan qarz bilan);
//   • jurnal (Muhlat_Eslatma): yakunlansa "kechqurun", bir qismi yetkazilsa "kechqurun-qisman" + IDlar —
//     keyingi soatda faqat qolganlari "davomi" bo'lib ketadi. Kirish ma'lumoti o'qilmasa — yuborilmaydi
//     va jurnal yozilmaydi (keyingi soatda qayta urinadi).
//
// Umumiy: bir mijozning bir nechta muhlati — bitta blokda; qarz o'qishlaridan biri muvaffaqiyatsiz
// bo'lsa qarz qatori chiqmaydi; xabarlar faqat asosiy guruhga (TELEGRAM_BOT_TOKEN/CHAT_ID).
import { getSheetData, getSheetDataWhere, getSheetNames, updateRow, appendRow } from "./sheets";
import { qoldiqlarHisobla, ayirboshlashmi, dollarmi, opKalit, type Qoldiq, type Qator } from "./mijoz-ledger";
import { telegramYuborServer, MAX_UZUNLIK } from "./telegram-server";
import {
  MUHLAT, MUHLAT_UZAYTIRISH, MUHLAT_ESLATMA, TURI_MIJOZ, BAJARILDI, ESLATMA_SOATI, KECH_SOATI,
  sanaIso, kunFarqi, toshkentHozir, uzaytirishSoni, yangiEslatmaLog,
} from "./muhlat";

const tr = (v: unknown) => String(v ?? "").trim();
const num = (v: unknown) => parseFloat(String(v ?? "0").replace(/\s/g, "").replace(",", ".")) || 0;
const soatMatn = (s: number) => `${String(s).padStart(2, "0")}:00`;
const guruhla = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
function somMatn(v: number) { return guruhla(String(Math.round(v))) + " so'm"; }
function usdMatn(v: number) {
  const [a, b] = (Math.round(Math.abs(v) * 100) / 100).toFixed(2).split(".");
  return (v < 0 ? "-" : "") + "$" + guruhla(a) + "," + b;
}
function ikkiValyuta(q: Qoldiq, bosh = "yo'q ✅"): string {
  const qism: string[] = [];
  if (Math.round(q.som) !== 0) qism.push(somMatn(q.som));
  if (Math.round(q.usd * 100) !== 0) qism.push(usdMatn(q.usd));
  return qism.length ? qism.join(" · ") : bosh;
}
/** "DD.MM.YYYY HH:MM:SS" -> tartib kaliti */
function vaqtKaliti(v: string): number { const [s, t] = tr(v).split(" "); return opKalit(s, t); }

export interface EslatmaNatija {
  ok: boolean;
  holat: string;
  yuborildi?: number;      // shu chaqiruvda xabarga kirgan muhlatlar soni
  otgan?: number;          // ertalab: muddati o'tgan, uzaytirilmagan
  matn?: string;           // dry rejimda
  xato?: string;
}

type Sheet = { headers?: string[]; data?: Qator[] };

/** Jadval bazada bormi (o'qish natijasi bo'sh bo'lsa: yaratilmaganmi yoki o'qilmadimi?). Xato — "bor" deb olinadi */
async function jadvalBormi(nomi: string): Promise<boolean> {
  try { return (await getSheetNames()).some(n => tr(n).toLowerCase() === nomi.toLowerCase()); }
  catch { return true; }
}

/** Mijozlar (joriy nom/telefon/agent), `qarzIds` uchun JORIY qarz va ularning to'lovlari */
async function mijozMalumoti(barchaIds: string[], qarzIds: string[]) {
  const mijozMap: Record<string, Qator> = {};
  let qoldiq: Record<string, Qoldiq> = {};
  let tolovlar: Qator[] | null = null;     // null = o'qilmadi
  let qarzOqildi = false;                   // qarz uchun barcha o'qishlar muvaffaqiyatlimi
  try {
    const [mj, sot, tol] = (await Promise.all([
      getSheetDataWhere("Mijozlar", "Mijoz_ID", barchaIds),
      getSheetDataWhere("Sotuv", "Mijoz_ID", qarzIds),
      getSheetDataWhere("S_tolov", "Mijoz_ID", qarzIds),
    ])) as Sheet[];
    const sids = (sot.data || []).map(s => tr(s.Sotuv_ID)).filter(Boolean);
    const [ss, sd] = (sids.length
      ? await Promise.all([
          getSheetDataWhere("Sotuv_Savat", "Sotuv_ID", sids),
          getSheetDataWhere("Sotuv_savat_dollar", "Sotuv_ID", sids),
        ])
      : [{ headers: ["Sotuv_ID"], data: [] }, { headers: ["Sotuv_ID"], data: [] }]) as Sheet[];
    (mj.data || []).forEach(m => { mijozMap[tr(m.Mijoz_ID)] = m; });
    if ((tol.headers || []).length > 0) tolovlar = tol.data || [];
    // Postgres filtrli o'qish xatoni yutib {headers:[]} qaytaradi; muvaffaqiyatli bo'sh natijada
    // sarlavhalar bo'ladi. Birortasi o'qilmagan bo'lsa — noto'g'ri qarz yubormaymiz.
    const hammasiOqildi = [mj, sot, tol, ss, sd].every(r => (r.headers || []).length > 0);
    qarzOqildi = hammasiOqildi;
    if (hammasiOqildi && (mj.data || []).length > 0) {
      qoldiq = qoldiqlarHisobla(qarzIds.filter(id => mijozMap[id]), mj.data || [], sot.data || [], ss.data || [], sd.data || [], tol.data || []);
    }
  } catch { /* qarzsiz yuboriladi */ }
  return { mijozMap, qoldiq, tolovlar, qarzOqildi };
}

async function agentNomlari(): Promise<Record<string, string>> {
  const m: Record<string, string> = {};
  try {
    ((await getSheetData("Foydalanuvchi")).data || []).forEach((f: Qator) => {
      if (tr(f.Foydalanuvchi_ID)) m[tr(f.Foydalanuvchi_ID)] = tr(f.Nomi);
    });
  } catch { /* agent nomisiz */ }
  return m;
}

/** Muhlatlarni mijoz bo'yicha guruhlaydi (bir mijozning bir nechta muhlati — bitta blok), nom bo'yicha tartib */
function mijozBoyicha(rows: Qator[], nomiOf: (m: Qator) => string): Qator[][] {
  const g = new Map<string, Qator[]>();
  rows.forEach(r => {
    const k = tr(r.Mijoz_ID) || "#" + tr(r.Muhlat_ID);
    const arr = g.get(k);
    if (arr) arr.push(r); else g.set(k, [r]);
  });
  return [...g.values()].sort((a, b) => nomiOf(a[0]).localeCompare(nomiOf(b[0])));
}

type Blok = { matn: string; ids: string[] };
/** Bloklarni ≤ MAX_UZUNLIK qismlarga teradi; `oxiri` (va uning idlari) BIRINCHI qismga qo'shiladi */
function qismlarga(sarlavha: (davomi: boolean) => string, bloklar: Blok[], oxiri: string, oxiriIds: string[] = []) {
  const qismlar: { matn: string; ids: string[] }[] = [];
  let joriy = { matn: sarlavha(false), ids: [] as string[] };
  const zaxira = () => (qismlar.length === 0 && oxiri ? oxiri.length + 2 : 0);
  const oxiriniQosh = () => { if (qismlar.length === 0 && oxiri) { joriy.matn += "\n\n" + oxiri; joriy.ids.push(...oxiriIds); } };
  for (const b of bloklar) {
    if (joriy.ids.length && joriy.matn.length + 2 + b.matn.length + zaxira() > MAX_UZUNLIK) {
      oxiriniQosh();
      qismlar.push(joriy);
      joriy = { matn: sarlavha(true), ids: [] };
    }
    joriy.matn += "\n\n" + b.matn;
    joriy.ids.push(...b.ids);
  }
  oxiriniQosh();
  qismlar.push(joriy);
  return qismlar;
}

// ═══════════════════════════ 1) ERTALAB ═══════════════════════════
/**
 * @param force  soat chegarasini chetlab o'tadi (test)
 * @param dry    yubormaydi va belgilamaydi — faqat matnni qaytaradi
 * @param qayta  bugun eslatilganlarni ham qayta yuboradi
 */
export async function muhlatEslatmasi(o: { force?: boolean; dry?: boolean; qayta?: boolean } = {}): Promise<EslatmaNatija> {
  const h = toshkentHozir();
  if (!o.force && !o.dry && (h.soat < ESLATMA_SOATI || h.soat >= KECH_SOATI)) {
    return { ok: true, holat: `${soatMatn(ESLATMA_SOATI)}–${soatMatn(KECH_SOATI)} oralig'ida yuboriladi` };
  }

  const barcha = ((await getSheetData(MUHLAT)).data || []) as Qator[];
  const mijozRows = barcha.filter(m => tr(m.Muhlat_ID) && tr(m.Turi) === TURI_MIJOZ);
  const faol = mijozRows.filter(m => tr(m.Status) !== BAJARILDI);
  const bugunHammasi = faol.filter(m => sanaIso(m.Tugash) === h.iso);
  // Har bir muhlat kuniga bir marta: bugun eslatilganlar qayta yuborilmaydi
  const yuboriladi = (o.qayta || o.dry) ? bugunHammasi : bugunHammasi.filter(m => tr(m.Eslatildi) !== h.sana);
  if (yuboriladi.length === 0) {
    return { ok: true, holat: bugunHammasi.length ? "bugun allaqachon yuborilgan" : "bugun muhlati kelgan mijoz yo'q", yuborildi: 0 };
  }
  // Bugun xabar allaqachon ketgan bo'lsa (ertalab), bu — qo'shimcha xabar: o'tganlar qayta takrorlanmaydi
  const qoshimcha = !o.qayta && !o.dry && mijozRows.some(m => tr(m.Eslatildi) === h.sana);
  const otgan = qoshimcha ? [] : faol
    .filter(m => { const i = sanaIso(m.Tugash); return !!i && i < h.iso; })
    .sort((a, b) => sanaIso(a.Tugash).localeCompare(sanaIso(b.Tugash)));

  const qarzIds = [...new Set(yuboriladi.map(m => tr(m.Mijoz_ID)).filter(Boolean))];
  const barchaIds = [...new Set([...yuboriladi, ...otgan].map(m => tr(m.Mijoz_ID)).filter(Boolean))];
  const { mijozMap, qoldiq } = await mijozMalumoti(barchaIds, qarzIds);
  const agentNomi = await agentNomlari();

  const nomiOf = (m: Qator) => tr(mijozMap[tr(m.Mijoz_ID)]?.Ism) || tr(m.Nomi) || "—";
  const guruhlar = mijozBoyicha(yuboriladi, nomiOf);

  const bloklar: Blok[] = guruhlar.map((rows, i) => {
    const id = tr(rows[0].Mijoz_ID);
    const mj = mijozMap[id];
    const q: string[] = [`${i + 1}) ${nomiOf(rows[0])}`];
    if (tr(mj?.Telefon)) q.push(`   📞 ${tr(mj?.Telefon)}`);
    if (qoldiq[id]) q.push(`   💰 Qarz: ${ikkiValyuta(qoldiq[id])}`);
    rows.forEach(m => {
      const n = uzaytirishSoni(m);
      q.push(`   🗓 Va'da: ${tr(m.Tugash)}${n > 0 ? ` (${n} marta uzaytirilgan, birinchi va'da ${tr(m.Asl_Tugash) || "—"})` : ""}`);
      if (tr(m.Boshlanish)) q.push(`   🕓 Belgilangan: ${tr(m.Boshlanish)}`);
      if (tr(m.Izoh)) q.push(`   📌 ${tr(m.Izoh)}`);
    });
    const ag = agentNomi[tr(mj?.Agent)];
    if (ag) q.push(`   👤 Agent: ${ag}`);
    return { matn: q.join("\n"), ids: rows.map(m => tr(m.Muhlat_ID)) };
  });
  let oxiri = "";
  if (otgan.length) {
    const q = [`⏰ Muddati o'tgan, uzaytirilmagan: ${otgan.length} ta`];
    otgan.slice(0, 10).forEach(m => q.push(`   • ${nomiOf(m)} — ${tr(m.Tugash)} (${kunFarqi(sanaIso(m.Tugash), h.iso)} kun o'tdi)`));
    if (otgan.length > 10) q.push(`   … yana ${otgan.length - 10} ta`);
    oxiri = q.join("\n");
  }

  const qismlar = qismlarga(davomi => [
    `🔔 Bugun muhlati kelgan mijozlar${qoshimcha ? " (qo'shimcha)" : ""}${davomi ? " — davomi" : ""}`,
    `📅 ${h.sana} · ${guruhlar.length} ta`,
  ].join("\n"), bloklar, oxiri);

  if (o.dry) return { ok: true, holat: "dry", matn: qismlar.map(x => x.matn).join("\n\n— — —\n\n"), yuborildi: yuboriladi.length, otgan: otgan.length };

  // Qismma-qism: yetkazilgan qismdagi muhlatlarga darhol Eslatildi yoziladi
  let belgilandi = 0, belgilanmadi = 0;
  for (const qism of qismlar) {
    const r = await telegramYuborServer(qism.matn);
    if (!r.ok) {
      return {
        ok: false, holat: belgilandi ? `qisman yuborildi (${belgilandi} ta)` : "yuborilmadi",
        yuborildi: belgilandi, otgan: otgan.length, xato: r.error,
      };
    }
    for (const id of qism.ids) {
      try { await updateRow(MUHLAT, "Muhlat_ID", id, { Eslatildi: h.sana }); belgilandi++; }
      catch { belgilanmadi++; }
    }
  }
  return {
    ok: true, holat: belgilanmadi ? `yuborildi (${belgilanmadi} tasi belgilanmadi)` : qoshimcha ? "qo'shimcha yuborildi" : "yuborildi",
    yuborildi: yuboriladi.length, otgan: otgan.length,
  };
}

// ═══════════════════════════ 2) KECHQURUN ═══════════════════════════
/**
 * "Bugun va'dasini bajarmagan mijozlar" — KECH_SOATI dan keyin, kuniga bir marta.
 * @param force  soat chegarasini chetlab o'tadi (test; 20:00 dan oldin yuborilsa jurnalga YOZILMAYDI —
 *               haqiqiy kechki hisobot baribir ketadi)
 * @param dry    yubormaydi va jurnalga yozmaydi — faqat matnni qaytaradi
 * @param qayta  bugun yuborilgan bo'lsa ham qayta (to'liq) yuboradi
 */
export async function kechkiHisobot(o: { force?: boolean; dry?: boolean; qayta?: boolean } = {}): Promise<EslatmaNatija> {
  const h = toshkentHozir();
  if (!o.force && !o.dry && h.soat < KECH_SOATI) return { ok: true, holat: `${soatMatn(KECH_SOATI)} dan keyin yuboriladi` };
  const jurnalYoz = !o.dry && h.soat >= KECH_SOATI;

  // Jurnal: bugun yakunlanganmi / qaysilari allaqachon yetkazilgan
  const oldinYetkazilgan = new Set<string>();
  if (!o.dry && !o.qayta) {
    const j = await getSheetData(MUHLAT_ESLATMA);
    if (!(j.headers || []).length && await jadvalBormi(MUHLAT_ESLATMA)) return { ok: false, holat: "jurnal o'qilmadi", yuborildi: 0 };
    const bugungi = ((j.data || []) as Qator[]).filter(r => tr(r.Sana) === h.sana);
    if (bugungi.some(r => tr(r.Turi) === "kechqurun")) return { ok: true, holat: "bugun allaqachon yuborilgan" };
    bugungi.filter(r => tr(r.Turi) === "kechqurun-qisman")
      .forEach(r => tr(r.IDlar).split(",").map(tr).filter(Boolean).forEach(id => oldinYetkazilgan.add(id)));
  }

  // Kirish ma'lumoti: o'qilmasa (jadval bor-u, sarlavha yo'q) — yubormaymiz, keyingi soatda qayta
  const mR = await getSheetData(MUHLAT);
  if (!(mR.headers || []).length && await jadvalBormi(MUHLAT)) return { ok: false, holat: "muhlatlar o'qilmadi", yuborildi: 0 };
  const uR = await getSheetData(MUHLAT_UZAYTIRISH);
  if (!(uR.headers || []).length && await jadvalBormi(MUHLAT_UZAYTIRISH)) return { ok: false, holat: "uzaytirish tarixi o'qilmadi", yuborildi: 0 };
  const barcha = (mR.data || []) as Qator[];
  const tarix = (uR.data || []) as Qator[];

  // Har muhlatning oxirgi uzaytirilishi va bugun "bugun"dan boshqa kunga uzaytirilganlari
  const oxirgiUzaytirish: Record<string, Qator> = {};
  const bugunUzaytirilgan: Record<string, Qator> = {};
  tarix.forEach(u => {
    const id = tr(u.Muhlat_ID);
    if (!id) return;
    if (!oxirgiUzaytirish[id] || vaqtKaliti(u.Qoshilgan_Vaqt) >= vaqtKaliti(oxirgiUzaytirish[id].Qoshilgan_Vaqt)) oxirgiUzaytirish[id] = u;
    if (tr(u.Eski_sana) === h.sana && tr(u.Sana) === h.sana) bugunUzaytirilgan[id] = u;
  });
  const bugungiVadalar = barcha.filter(m => tr(m.Muhlat_ID) && tr(m.Turi) === TURI_MIJOZ &&
    (sanaIso(m.Tugash) === h.iso || bugunUzaytirilgan[tr(m.Muhlat_ID)]));
  if (bugungiVadalar.length === 0) return { ok: true, holat: "bugun va'da qilgan mijoz yo'q", yuborildi: 0 };

  const bajardi = bugungiVadalar.filter(m => tr(m.Status) === BAJARILDI);
  const ochiq = bugungiVadalar.filter(m => tr(m.Status) !== BAJARILDI);
  if (ochiq.length === 0) return { ok: true, holat: "bugun va'da qilganlarning hammasi bajardi", yuborildi: 0 };

  const ids = [...new Set(ochiq.map(m => tr(m.Mijoz_ID)).filter(Boolean))];
  const { mijozMap, qoldiq, tolovlar, qarzOqildi } = await mijozMalumoti(ids, ids);
  // To'lov yoki qarz ma'lumoti o'qilmasa noto'g'ri "bajarmadi" yubormaymiz — keyingi soatda qayta
  if (ids.length && (tolovlar === null || !qarzOqildi)) return { ok: false, holat: "to'lov/qarz ma'lumoti o'qilmadi — keyingi soatda qayta", yuborildi: 0 };
  const agentNomi = await agentNomlari();

  const nomiOf = (m: Qator) => tr(mijozMap[tr(m.Mijoz_ID)]?.Ism) || tr(m.Nomi) || "—";
  const uzaytirildi = (m: Qator) => sanaIso(m.Tugash) !== h.iso && !!bugunUzaytirilgan[tr(m.Muhlat_ID)];
  // Va'da berilgan KUN: oxirgi uzaytirilgan kun, aks holda muhlat belgilangan sana. To'lovlar SANA bo'yicha
  // (soati emas — to'lov o'tgan sana bilan, keyinroq kiritilishi mumkin) shu kundan bugungacha hisoblanadi.
  const vadaKuni = (m: Qator): string => {
    const u = oxirgiUzaytirish[tr(m.Muhlat_ID)];
    return sanaIso(u?.Sana) || sanaIso(m.Boshlanish) || sanaIso(tr(m.Qoshilgan_Vaqt).split(" ")[0]) || h.iso;
  };
  const tolovlarDan = (mijozId: string, danIso: string): Qoldiq => {
    const q = { som: 0, usd: 0 };
    (tolovlar || []).forEach(t => {
      if (tr(t.Mijoz_ID) !== mijozId || ayirboshlashmi(t)) return;
      const k = sanaIso(t.Sana);
      if (!k || k < danIso || k > h.iso) return;
      if (dollarmi(t.Valyuta)) q.usd += num(t.Summa_dollar || t.Dollar); else q.som += num(t.Summa || t.Som);
    });
    return q;
  };
  // Ekrandagi yaxlitlash bilan bir xil (float qoldig'i "qarz bor/to'lov bor" bo'lib qolmasin)
  const musbat = (q: Qoldiq) => Math.round(q.som) > 0 || Math.round(q.usd * 100) > 0;
  const tolovQildi = (m: Qator) => musbat(tolovlarDan(tr(m.Mijoz_ID), vadaKuni(m)));
  const qarziYoq = (m: Qator) => { const q = qoldiq[tr(m.Mijoz_ID)]; return !!q && !musbat(q); };

  // Bajarmagan: qarzi bor va (bugun uzaytirgan yoki va'da kunidan beri to'lov qilmagan)
  const bajarmadiRows = ochiq.filter(m => !qarziYoq(m) && (uzaytirildi(m) || !tolovQildi(m)))
    .filter(m => !oldinYetkazilgan.has(tr(m.Muhlat_ID)));
  // To'lov qilgan yoki qarzi qolmagan, lekin muhlati yopilmagan (to'liq to'lagan bo'lsa yopish kerak)
  const yopilmagan = ochiq.filter(m => qarziYoq(m) || (!uzaytirildi(m) && tolovQildi(m)))
    .filter(m => !oldinYetkazilgan.has(tr(m.Muhlat_ID)));
  if (bajarmadiRows.length === 0 && yopilmagan.length === 0) return { ok: true, holat: "bugun allaqachon yuborilgan" };

  const guruhlar = mijozBoyicha(bajarmadiRows, nomiOf);
  const bloklar: Blok[] = guruhlar.map((rows, i) => {
    const id = tr(rows[0].Mijoz_ID);
    const mj = mijozMap[id];
    const q: string[] = [`${i + 1}) ${nomiOf(rows[0])}`];
    if (tr(mj?.Telefon)) q.push(`   📞 ${tr(mj?.Telefon)}`);
    if (qoldiq[id]) q.push(`   💰 Qarz: ${ikkiValyuta(qoldiq[id])}`);
    rows.forEach(m => {
      if (uzaytirildi(m)) {
        const u = bugunUzaytirilgan[tr(m.Muhlat_ID)];
        q.push(`   🗓 Va'da: ${h.sana} → ⟳ ${tr(m.Tugash)} ga uzaytirildi${tr(u?.Izoh) ? ` («${tr(u?.Izoh)}»)` : ""}`);
      } else {
        const n = uzaytirishSoni(m);
        q.push(`   🗓 Va'da: ${tr(m.Tugash)} — to'lov qilinmadi${n > 0 ? ` (${n} marta uzaytirilgan)` : ""}`);
      }
      if (tr(m.Izoh)) q.push(`   📌 ${tr(m.Izoh)}`);
    });
    const ag = agentNomi[tr(mj?.Agent)];
    if (ag) q.push(`   👤 Agent: ${ag}`);
    return { matn: q.join("\n"), ids: rows.map(m => tr(m.Muhlat_ID)) };
  });
  let oxiri = "";
  if (yopilmagan.length) {
    const yGuruhlar = mijozBoyicha(yopilmagan, nomiOf);
    const q = [`⚠️ To'lov qilgan, lekin muhlati yopilmagan: ${yGuruhlar.length} ta (to'liq to'lagan bo'lsa Muhlat oynasida «✓ Bajarildi» bosing)`];
    yGuruhlar.slice(0, 15).forEach(rows => {
      const id = tr(rows[0].Mijoz_ID);
      const dan = rows.map(vadaKuni).sort()[0];
      const tl = tolovlarDan(id, dan);
      const qz = qoldiq[id];
      const tolMatn = musbat(tl) ? `💵 to'ladi: ${ikkiValyuta(tl, "0")}` : "💵 to'lov yo'q";
      const uz = rows.some(uzaytirildi) ? " · ⟳ bugun uzaytirilgan" : "";
      q.push(`   • ${nomiOf(rows[0])} — ${tolMatn}${qz ? ` · qarz: ${ikkiValyuta(qz)}` : ""}${uz}`);
    });
    if (yGuruhlar.length > 15) q.push(`   … yana ${yGuruhlar.length - 15} ta (Muhlat oynasida ko'ring)`);
    oxiri = q.join("\n");
  }

  const davomi = oldinYetkazilgan.size > 0;
  const statistika = `📊 Bugungi va'dalar: ${bugungiVadalar.length} ta · bajarilgan: ${bajardi.length} ta`;
  const qismlar = qismlarga(dv => {
    const d = davomi || dv ? " — davomi" : "";
    const q = guruhlar.length
      ? [`🌙 Bugun va'dasini bajarmagan mijozlar${d}`, `📅 ${h.sana} · ${guruhlar.length} ta`]
      : [`🌙 Bugungi va'dalar — kechki hisobot${d}`, `📅 ${h.sana}`];
    if (!davomi && !dv) q.push(statistika);
    return q.join("\n");
  }, bloklar, oxiri, yopilmagan.map(m => tr(m.Muhlat_ID)));

  const soni = bajarmadiRows.length + yopilmagan.length;
  if (o.dry) return { ok: true, holat: "dry", matn: qismlar.map(x => x.matn).join("\n\n— — —\n\n"), yuborildi: soni };

  const jurnalga = async (turi: string, idlar: string[]) => {
    if (!jurnalYoz) return;
    try {
      await appendRow(MUHLAT_ESLATMA, { ...yangiEslatmaLog({
        Eslatma_ID: Math.random().toString(36).slice(2, 10), Sana: h.sana, Turi: turi,
        Soni: String(idlar.length), IDlar: idlar.join(","), Vaqt: `${h.sana} ${h.vaqt}`,
      }) });
    } catch { /* jurnal yozilmasa keyingi soatda qayta yuborilishi mumkin */ }
  };
  const yetkazildi: string[] = [];
  for (const qism of qismlar) {
    const r = await telegramYuborServer(qism.matn);
    if (!r.ok) {
      // Yetkazilgan qismlar jurnalga — keyingi soatda faqat qolganlari "davomi" bo'lib ketadi
      if (yetkazildi.length) await jurnalga("kechqurun-qisman", yetkazildi);
      return { ok: false, holat: yetkazildi.length ? "qisman yuborildi" : "yuborilmadi", yuborildi: yetkazildi.length, xato: r.error };
    }
    yetkazildi.push(...qism.ids);
  }
  await jurnalga("kechqurun", [...oldinYetkazilgan, ...yetkazildi]);
  return { ok: true, holat: davomi ? "davomi yuborildi" : "yuborildi", yuborildi: yetkazildi.length };
}

/** Soatlik cron: ikkala xabar o'z soatini o'zi tekshiradi (biri ikkinchisiga xalaqit bermaydi) */
export async function muhlatCron(): Promise<{ ertalab: EslatmaNatija; kechqurun: EslatmaNatija }> {
  const xato = (e: unknown): EslatmaNatija => ({ ok: false, holat: "xato", xato: e instanceof Error ? e.message : "xato" });
  const ertalab = await muhlatEslatmasi().catch(xato);
  const kechqurun = await kechkiHisobot().catch(xato);
  return { ertalab, kechqurun };
}
