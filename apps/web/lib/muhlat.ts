// Muhlat (mijozning to'lov va'dasi / firmaga to'lov muddati) — sahifa va server eslatmasi uchun umumiy.
//
// Jadvallar (birinchi yozuvda avtomat yaratiladi):
//   Muhlat            — bitta muhlat = bitta qator; Tugash = JORIY va'da sanasi
//   Muhlat_Uzaytirish — har bir uzaytirish tarixi (eski sana → yangi sana, sabab)
//
// ⚠️ Postgres jadvali BIRINCHI yozuvdagi kalitlardan yaratiladi va keyin unga ustun QO'SHILMAYDI
// (lib/sheets.ts pgEnsureTable; noma'lum ustunlar jimgina tashlab yuboriladi). Shuning uchun
// yangi qatorlar har doim yangiMuhlat()/yangiUzaytirish() orqali — BARCHA ustunlar bilan yoziladi.

export const MUHLAT = "Muhlat";
export const MUHLAT_UZAYTIRISH = "Muhlat_Uzaytirish";
export const TURI_MIJOZ = "Mijoz";
export const TURI_FIRMA = "Firma";
export const BAJARILDI = "Bajarildi";
/** Telegram eslatmasi shu soatdan (Toshkent) keyingi birinchi cron'da, kuniga bir marta yuboriladi */
export const ESLATMA_SOATI = 9;

export interface Muhlat {
  Muhlat_ID: string;
  Turi: string;              // "Mijoz" | "Firma"
  Mijoz_ID: string;
  Taminotchi_ID: string;
  Nomi: string;              // nom snapshot'i (o'chirilsa ham ko'rinsin)
  Boshlanish: string;        // muhlat belgilangan sana, DD.MM.YYYY
  Tugash: string;            // joriy va'da sanasi, DD.MM.YYYY
  Asl_Tugash: string;        // birinchi va'da sanasi (uzaytirilganda o'zgarmaydi)
  Uzaytirildi: string;       // necha marta uzaytirilgan
  Izoh: string;
  Status: string;            // "" = faol, "Bajarildi" = yopilgan
  Yopilgan_Sana: string;     // "Bajarildi" belgilangan kun
  Eslatildi: string;         // Telegramga eslatilgan oxirgi kun (DD.MM.YYYY)
  Yil: string;
  Oy: string;
  Qoshdi: string;
  Qoshilgan_Vaqt: string;
  Oxirgi_ozgartirdi: string;
  Oxirgi_Ozgarish: string;
}

export interface MuhlatUzaytirish {
  Uzaytirish_ID: string;
  Muhlat_ID: string;
  Mijoz_ID: string;
  Taminotchi_ID: string;
  Eski_sana: string;         // DD.MM.YYYY
  Yangi_sana: string;        // DD.MM.YYYY
  Izoh: string;              // sabab
  Sana: string;              // uzaytirilgan kun
  Qoshdi: string;
  Qoshilgan_Vaqt: string;
}

export function yangiMuhlat(p: Partial<Muhlat>): Muhlat {
  return {
    Muhlat_ID: "", Turi: "", Mijoz_ID: "", Taminotchi_ID: "", Nomi: "",
    Boshlanish: "", Tugash: "", Asl_Tugash: "", Uzaytirildi: "0", Izoh: "", Status: "",
    Yopilgan_Sana: "", Eslatildi: "", Yil: "", Oy: "", Qoshdi: "", Qoshilgan_Vaqt: "",
    Oxirgi_ozgartirdi: "", Oxirgi_Ozgarish: "",
    ...p,
  };
}
export function yangiUzaytirish(p: Partial<MuhlatUzaytirish>): MuhlatUzaytirish {
  return {
    Uzaytirish_ID: "", Muhlat_ID: "", Mijoz_ID: "", Taminotchi_ID: "", Eski_sana: "", Yangi_sana: "",
    Izoh: "", Sana: "", Qoshdi: "", Qoshilgan_Vaqt: "",
    ...p,
  };
}

const tr = (v: unknown) => String(v ?? "").trim();
const p2 = (n: number) => String(n).padStart(2, "0");

/** "DD.MM.YYYY" -> "YYYY-MM-DD" ("" agar buzuq) */
export function sanaIso(sana: string | undefined): string {
  const m = tr(sana).match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
}
/** "YYYY-MM-DD" -> "DD.MM.YYYY" ("" agar buzuq) */
export function isoSana(iso: string | undefined): string {
  const m = tr(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
}
/** Ikki ISO sana orasidagi kun (b − a) */
export function kunFarqi(isoA: string, isoB: string): number {
  const a = Date.UTC(+isoA.slice(0, 4), +isoA.slice(5, 7) - 1, +isoA.slice(8, 10));
  const b = Date.UTC(+isoB.slice(0, 4), +isoB.slice(5, 7) - 1, +isoB.slice(8, 10));
  return Math.round((b - a) / 86400000);
}
/** ISO sanaga kun qo'shish */
export function isoQosh(iso: string, kun: number): string {
  const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + kun));
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
}

/** Toshkent vaqti bo'yicha hozir (server TZ'idan va brauzer soatidan qat'i nazar) */
export function toshkentHozir(): { iso: string; sana: string; vaqt: string; soat: number } {
  const qism = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const ol = (t: string) => qism.find(x => x.type === t)?.value || "00";
  const iso = `${ol("year")}-${ol("month")}-${ol("day")}`;
  const soat = parseInt(ol("hour"), 10) % 24;
  return { iso, sana: isoSana(iso), vaqt: `${p2(soat)}:${ol("minute")}:${ol("second")}`, soat };
}

export function uzaytirishSoni(m: { Uzaytirildi?: string }): number {
  return Math.max(0, parseInt(tr(m.Uzaytirildi), 10) || 0);
}
