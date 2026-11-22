// Savat qatori summasi (Soni × Narx) — saqlash va ko'rsatishdan oldin yaxlitlanadi.
//
// Soni kasr bo'lishi mumkin (kg; blok o'lchami kasr: 1 blok = 12,5 / 13,3 dona). Suzuvchi nuqtada
// 132,3 × 1500 = 198450.00000000003 — shunday saqlansa mijoz qarzida "0 so'm" qoldiq qolardi
// (to'liq to'lagan mijoz qarzdor bo'lib ko'rinardi).
//  • so'm — butun so'mga (sotuvni tahrirlash oynasi avvaldan shunday: Math.round);
//  • dollar — 4 xonagacha (yangi sotuv formasi avvaldan shunday: toFixed(4)).
// Yaxlitlash SIMMETRIK (noldan uzoqqa): sotuv va uning qaytarilishi (manfiy Soni) bir-birini aniq yopadi.
const simmetrik = (x: number, k: number) => (Math.sign(x) * Math.round(Math.abs(x) * k)) / k || 0;

/** So'm summasi: butun so'm. 132.3 × 1500 → 198450; 12.5 × 3333 → 41663; -12.5 × 3333 → -41663 */
export function somSumma(soni: number, narx: number): number {
  return simmetrik(soni * narx, 1);
}

/** Dollar summasi: 4 xonagacha. 3 × 0.1 → 0.3 (0.30000000000000004 emas) */
export function usdSumma(soni: number, narx: number): number {
  return simmetrik(soni * narx, 1e4);
}
