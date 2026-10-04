// "Bugun muhlati kelgan mijozlar" — Telegram eslatmasi (SERVER).
// Soatlik cron (/api/push/send) va /api/muhlat/eslatma chaqiradi.
//
// Qoidalar:
//   • faqat Turi="Mijoz", Status != "Bajarildi", Tugash (joriy va'da) == bugun (Toshkent);
//   • ESLATMA_SOATI (09:00) dan keyingi birinchi cron'da yuboriladi; har bir muhlat kuniga BIR marta —
//     yuborilganiga Eslatildi = bugun yoziladi. Ertalabki xabardan keyin "bugun"ga qo'yilgan muhlat
//     (yangi yoki uzaytirilgan) keyingi soatda "(qo'shimcha)" xabar bo'lib keladi;
//   • xabar mijoz bloklari chegarasida bo'linadi; faqat YETKAZILGAN qismdagi muhlatlar belgilanadi,
//     qolganlari keyingi soatda yuboriladi (takror ham, yo'qolish ham bo'lmaydi);
//   • qarz o'qishlaridan biri muvaffaqiyatsiz bo'lsa, noto'g'ri raqam o'rniga qarz qatori chiqmaydi;
//   • asosiy guruhga (TELEGRAM_BOT_TOKEN/CHAT_ID) yuboriladi — ro'yxatda boshqa mijozlarning
//     qarzi bor, shuning uchun agent/mijoz guruhlariga emas.
import { getSheetData, getSheetDataWhere, updateRow } from "./sheets";
import { qoldiqlarHisobla, type Qoldiq, type Qator } from "./mijoz-ledger";
import { telegramYuborServer, MAX_UZUNLIK } from "./telegram-server";
import { MUHLAT, TURI_MIJOZ, BAJARILDI, ESLATMA_SOATI, sanaIso, kunFarqi, toshkentHozir, uzaytirishSoni } from "./muhlat";

const tr = (v: unknown) => String(v ?? "").trim();
const guruhla = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
function somMatn(v: number) { return guruhla(String(Math.round(v))) + " so'm"; }
function usdMatn(v: number) {
  const [a, b] = (Math.round(Math.abs(v) * 100) / 100).toFixed(2).split(".");
  return (v < 0 ? "-" : "") + "$" + guruhla(a) + "," + b;
}
function qarzMatni(q: Qoldiq): string {
  const qism: string[] = [];
  if (Math.round(q.som) !== 0) qism.push(somMatn(q.som));
  if (Math.round(q.usd * 100) !== 0) qism.push(usdMatn(q.usd));
  return qism.length ? qism.join(" · ") : "yo'q ✅";
}

export interface EslatmaNatija {
  ok: boolean;
  holat: string;
  yuborildi?: number;      // shu chaqiruvda eslatilgan muhlatlar soni
  otgan?: number;          // muddati o'tgan, uzaytirilmagan
  matn?: string;           // dry rejimda
  xato?: string;
}

type Sheet = { headers?: string[]; data?: Qator[] };

/** Mijozlar (joriy nom/telefon/agent) va `qarzIds` uchun JORIY qarz — ledger bilan bir xil hisob */
async function mijozMalumoti(barchaIds: string[], qarzIds: string[]) {
  const mijozMap: Record<string, Qator> = {};
  let qoldiq: Record<string, Qoldiq> = {};
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
    // Postgres filtrli o'qish xatoni yutib {headers:[]} qaytaradi; muvaffaqiyatli bo'sh natijada
    // sarlavhalar bo'ladi. Birortasi o'qilmagan bo'lsa — noto'g'ri qarz yubormaymiz.
    const hammasiOqildi = [mj, sot, tol, ss, sd].every(r => (r.headers || []).length > 0);
    if (hammasiOqildi && (mj.data || []).length > 0) {
      qoldiq = qoldiqlarHisobla(qarzIds.filter(id => mijozMap[id]), mj.data || [], sot.data || [], ss.data || [], sd.data || [], tol.data || []);
    }
  } catch { /* qarzsiz yuboriladi */ }
  return { mijozMap, qoldiq };
}

/**
 * @param force  soat chegarasini chetlab o'tadi (test)
 * @param dry    yubormaydi va belgilamaydi — faqat matnni qaytaradi
 * @param qayta  bugun eslatilganlarni ham qayta yuboradi
 */
export async function muhlatEslatmasi(o: { force?: boolean; dry?: boolean; qayta?: boolean } = {}): Promise<EslatmaNatija> {
  const h = toshkentHozir();
  if (!o.force && !o.dry && h.soat < ESLATMA_SOATI) {
    return { ok: true, holat: `${String(ESLATMA_SOATI).padStart(2, "0")}:00 dan keyin yuboriladi` };
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

  const agentNomi: Record<string, string> = {};
  try {
    ((await getSheetData("Foydalanuvchi")).data || []).forEach((f: Qator) => {
      if (tr(f.Foydalanuvchi_ID)) agentNomi[tr(f.Foydalanuvchi_ID)] = tr(f.Nomi);
    });
  } catch { /* agent nomisiz */ }

  const nomiOf = (m: Qator) => tr(mijozMap[tr(m.Mijoz_ID)]?.Ism) || tr(m.Nomi) || "—";
  const tartib = [...yuboriladi].sort((a, b) => nomiOf(a).localeCompare(nomiOf(b)));

  // Har bir mijoz — alohida blok (xabar faqat bloklar chegarasida bo'linadi)
  const bloklar = tartib.map((m, i) => {
    const id = tr(m.Mijoz_ID);
    const mj = mijozMap[id];
    const q: string[] = [`${i + 1}) ${nomiOf(m)}`];
    if (tr(mj?.Telefon)) q.push(`   📞 ${tr(mj?.Telefon)}`);
    if (qoldiq[id]) q.push(`   💰 Qarz: ${qarzMatni(qoldiq[id])}`);
    const n = uzaytirishSoni(m);
    q.push(`   🗓 Va'da: ${tr(m.Tugash)}${n > 0 ? ` (${n} marta uzaytirilgan, birinchi va'da ${tr(m.Asl_Tugash) || "—"})` : ""}`);
    if (tr(m.Boshlanish)) q.push(`   🕓 Belgilangan: ${tr(m.Boshlanish)}`);
    const ag = agentNomi[tr(mj?.Agent)];
    if (ag) q.push(`   👤 Agent: ${ag}`);
    if (tr(m.Izoh)) q.push(`   📌 ${tr(m.Izoh)}`);
    return { matn: q.join("\n"), id: tr(m.Muhlat_ID) };
  });
  let oxiri = "";
  if (otgan.length) {
    const q = [`⏰ Muddati o'tgan, uzaytirilmagan: ${otgan.length} ta`];
    otgan.slice(0, 10).forEach(m => q.push(`   • ${nomiOf(m)} — ${tr(m.Tugash)} (${kunFarqi(sanaIso(m.Tugash), h.iso)} kun o'tdi)`));
    if (otgan.length > 10) q.push(`   … yana ${otgan.length - 10} ta`);
    oxiri = q.join("\n");
  }

  const sarlavha = (davomi: boolean) => [
    `🔔 Bugun muhlati kelgan mijozlar${qoshimcha ? " (qo'shimcha)" : ""}${davomi ? " — davomi" : ""}`,
    `📅 ${h.sana} · ${tartib.length} ta`,
  ].join("\n");
  // "O'tganlar" bo'limi BIRINCHI qismga qo'shiladi (joyi oldindan ajratiladi): bugun biror muhlat
  // belgilangan bo'lsa — demak bu bo'lim ham yetkazilgan; qisman xatoda yo'qolib qolmaydi.
  const qismlar: { matn: string; ids: string[] }[] = [];
  let joriy = { matn: sarlavha(false), ids: [] as string[] };
  const zaxira = () => (qismlar.length === 0 && oxiri ? oxiri.length + 2 : 0);
  for (const b of bloklar) {
    if (joriy.ids.length && joriy.matn.length + 2 + b.matn.length + zaxira() > MAX_UZUNLIK) {
      if (qismlar.length === 0 && oxiri) joriy.matn += "\n\n" + oxiri;
      qismlar.push(joriy);
      joriy = { matn: sarlavha(true), ids: [] };
    }
    joriy.matn += "\n\n" + b.matn;
    joriy.ids.push(b.id);
  }
  if (qismlar.length === 0 && oxiri) joriy.matn += "\n\n" + oxiri;
  qismlar.push(joriy);

  if (o.dry) return { ok: true, holat: "dry", matn: qismlar.map(x => x.matn).join("\n\n— — —\n\n"), yuborildi: tartib.length, otgan: otgan.length };

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
    yuborildi: tartib.length, otgan: otgan.length,
  };
}
