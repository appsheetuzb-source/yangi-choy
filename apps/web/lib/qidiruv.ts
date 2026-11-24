// Ro'yxatlardagi qidiruv — butun dastur uchun bitta qoida:
//  • MATN bo'yicha (nom, telefon, izoh, sana, raqam): katta-kichik harfsiz, maydon ichida
//    ("23.11" → "23.11.2026" sanasi topiladi, "rizq" → "Rizq 500 GR").
//  • SUMMA bo'yicha: qidiruvdagi raqamlar summa raqamlari ichida qidiriladi — bo'shliq, vergul, nuqta
//    hisobga olinmaydi: "1 345 000" / "1345000" / "1345" → 1 345 000 so'm; "16 545,57" → $16 545,57;
//    "so'm", "$" yozilsa ham bo'ladi. Faqat qidiruvda harf bo'lmasa (raqamli qidiruv) ishlaydi.
//  • "dd.mm" / "dd.mm.yyyy" ko'rinishi — sana deb olinadi (summalar ichidan qidirilmaydi).

function sonOl(v: unknown): number {
  if (typeof v === "number") return v;
  const s = String(v ?? "").replace(/\s/g, "").replace(",", ".");
  return s === "" ? NaN : parseFloat(s);
}

/** Summaning qidiruvda solishtiriladigan raqam ko'rinishlari: butun, aniq kasr va 2 xonali ($ uchun) */
function summaRaqamlari(v: unknown): string[] {
  const n = sonOl(v);
  if (!Number.isFinite(n) || n === 0) return [];
  const a = Math.abs(n);
  return [
    String(Math.round(a)),
    String(Math.round(a * 1000) / 1000).replace(/\D/g, ""),
    a.toFixed(2).replace(/\D/g, ""),
  ];
}

/**
 * Yozuv qidiruvga mosmi. q bo'sh bo'lsa — doim true.
 * @param matnlar — matn maydonlari (nom, telefon, izoh, sana, raqam...)
 * @param summalar — summa/narx maydonlari (raqam yoki "1 345 000" kabi matn)
 */
export function qidiruvMos(q: string, matnlar: unknown[], summalar: unknown[] = []): boolean {
  const s = String(q ?? "").trim().toLowerCase();
  if (!s) return true;
  if (matnlar.some(m => String(m ?? "").toLowerCase().includes(s))) return true;
  // Raqamli qidiruv: valyuta so'zlari olib tashlangach harf qolmasa va raqam bo'lsa
  const toza = s.replace(/so['ʻ’`]?m|\$|usd|dollar/g, "").trim();
  if (!toza || /[^\d\s.,+\-]/.test(toza)) return false;
  if (/^\d{1,2}\.\d{1,2}(\.\d{2,4})?$/.test(toza)) return false;   // sana — yuqorida matn sifatida qidirildi
  const raqam = toza.replace(/\D/g, "");
  if (!raqam) return false;
  return summalar.some(v => summaRaqamlari(v).some(r => r.includes(raqam)));
}
