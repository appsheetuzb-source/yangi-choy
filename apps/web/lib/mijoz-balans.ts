// Mijozning MA'LUM BIR SOTUVDAN OLDINGI qarzi (Sotuv.Balans / Balans_dollar snapshot'i).
//
// Snapshot sotuv YARATILGANDA yoziladi va keyin muzlatiladi — shuning uchun keyingi
// sotuvlar qo'shilsa ham eski cheklarning "Mijoz balansi" va "Yakuniy qoldiq" i o'zgarmaydi.
//
// LEKIN sotuv TAHRIRLANIB MIJOZI ALMASHTIRILSA, muzlatilgan snapshot ESKI mijozniki bo'lib
// qoladi va yangi mijozning chekida uning qarzi ko'rinadi. Shu holatda snapshot yangi mijoz
// uchun QAYTA hisoblanishi kerak — shu modul aynan shuning uchun.
//
// Formula (sotuv qo'shish formasidagi "eski qarz" bilan bir xil):
//   qarz = Boshlangich_Balans
//        + Σ (mijozning Chek'i to'ldirilgan boshqa sotuvlari savat summalari)
//        − Σ (mijozning barcha to'lovlari)

function num(v: string | number | undefined | null): number {
  return parseFloat(String(v ?? "0").replace(/\s/g, "").replace(",", ".")) || 0;
}

export interface BalansKirish {
  /** Mijozning boshlang'ich (ochilish) qarzi */
  boshSom: number;
  boshDollar: number;
  /** Shu mijozga tegishli sotuvlar (Chek bo'sh bo'lganlari qarzga kirmaydi) */
  sotuvlar: { Sotuv_ID?: string; Chek?: string }[];
  /** Shu sotuvlarning savat qatorlari */
  savatSom: { Sotuv_ID?: string; Summa_som?: string }[];
  savatDollar: { Sotuv_ID?: string; Summa?: string }[];
  /** Mijozning jami to'lovlari (Sotuv_ID'siz umumiy to'lovlar ham) */
  tolovSom: number;
  tolovDollar: number;
  /** Hisobdan CHIQARILADIGAN sotuv — snapshot "shu sotuvdan oldingi" holatni bildiradi */
  excludeSotuvId?: string;
}

export function mijozEskiQarz(k: BalansKirish): { som: number; dollar: number } {
  const exclude = String(k.excludeSotuvId || "").trim();
  const hisobga = new Set(
    k.sotuvlar
      .filter(s => String(s.Chek || "").trim() !== "")
      .map(s => String(s.Sotuv_ID || "").trim())
      .filter(sid => sid && sid !== exclude)
  );
  let som = k.boshSom, dollar = k.boshDollar;
  k.savatSom.forEach(r => { if (hisobga.has(String(r.Sotuv_ID || "").trim())) som += num(r.Summa_som); });
  k.savatDollar.forEach(r => { if (hisobga.has(String(r.Sotuv_ID || "").trim())) dollar += num(r.Summa); });
  return { som: som - k.tolovSom, dollar: dollar - k.tolovDollar };
}

/** Snapshot ustunlariga yoziladigan ko'rinish (sotuv yaratishdagi format bilan bir xil) */
export function balansSnapshot(q: { som: number; dollar: number }) {
  return { Balans: String(Math.round(q.som)), Balans_dollar: String(q.dollar) };
}
