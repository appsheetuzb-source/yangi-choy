// Ta'minotchi nomi — o'chirilgan ta'minotchini "—" emas, aniq belgilab ko'rsatish uchun.
//
// Taminotchi jadvalidan o'chirilgan ta'minotchining NOMI hech qayerda saqlanmaydi
// (Xarid/X_Tolov faqat Taminotchi_ID ni saqlaydi), shuning uchun asl nomni tiklab
// bo'lmaydi. Lekin ID mavjud bo'la turib jadvalda topilmasa — bu aniq o'chirilgan
// ta'minotchi, va uni bo'sh "—" dan farqlab ko'rsatish kerak.

export const OCHIRILGAN = "O'chirilgan ta'minotchi";
export const OCHIRILGAN_STATUS = "O'chirilgan";

/** Ta'minotchi yumshoq o'chirilganmi (Status ustuni bo'yicha) */
export function statusOchirilgan(status: string | undefined): boolean {
  return String(status || "").trim().toLowerCase() === OCHIRILGAN_STATUS.toLowerCase();
}

/**
 * @param id    Xarid/X_Tolov dagi Taminotchi_ID
 * @param nom   Taminotchi jadvalidan topilgan nom (topilmasa bo'sh/undefined)
 * @param bosh  ID ham bo'lmasa ko'rsatiladigan matn
 */
export function taminotchiNomi(id: string | undefined, nom: string | undefined, bosh = "—", status?: string): string {
  const n = String(nom || "").trim();
  // Yumshoq o'chirilgan — nomi saqlanib qolgan, qavs ichida ko'rsatiladi
  if (n && statusOchirilgan(status)) return `${OCHIRILGAN} (${n})`;
  if (n) return n;
  // Qattiq o'chirilgan (eski holat) — nom yo'q, faqat ID bor
  return String(id || "").trim() ? OCHIRILGAN : bosh;
}

/** Nom o'chirilgan ta'minotchinikimi (uslub berish uchun) */
export function ochirilganmi(id: string | undefined, nom: string | undefined, status?: string): boolean {
  if (statusOchirilgan(status)) return true;
  return !String(nom || "").trim() && !!String(id || "").trim();
}

/** Nomi butunlay yo'qolganmi (qattiq o'chirilgan) — qaytarish formasi shunda kerak */
export function nomiYoqolgan(id: string | undefined, nom: string | undefined): boolean {
  return !String(nom || "").trim() && !!String(id || "").trim();
}
