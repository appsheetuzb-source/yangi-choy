// Mahsulotning o'lchov birligi — "dona" yoki "kg".
//
// Eski bazada (AppSheet) o'lchov birligi ustuni BO'LMAGAN: Mahsulot varag'ida
// faqat Mahsulot_ID, Ombor_ID, Nomi, Rasm, Tan_som, Sotuv_som, Tan_dollar,
// Sotuv_dollar, Qoshilgan_sana, Kg ustunlari bor. Shuning uchun birligi
// belgilanmagan mahsulot DONA hisoblanadi — bu ilovaning avvalgi xatti-harakati
// bilan aynan bir xil (Sotuv_Savat.Soni hamma joyda dona sifatida sanalgan).
//
// DIQQAT: Mahsulot.Kg — bu o'lchov birligi EMAS, bitta donaning OG'IRLIGI
// (masalan "Rizq 71 400GR" uchun Kg = 0.4). Ikkisini aralashtirmaslik kerak.

export type Birlik = "dona" | "kg";

/** Mahsulot yozuvidan birligini o'qish. Belgilanmagan bo'lsa — "dona". */
export function birlikOf(m?: { Birlik?: string } | null): Birlik {
  return String(m?.Birlik || "").trim().toLowerCase() === "kg" ? "kg" : "dona";
}

/** Miqdorni o'z birligi bilan formatlash: (12,"dona") -> "12 dona"; (5.5,"kg") -> "5,5 kg" */
export function fmtMiqdor(v: number, b: Birlik): string {
  const n = b === "kg"
    ? v.toLocaleString("ru-RU", { maximumFractionDigits: 3 })
    : Math.round(v).toLocaleString("ru-RU");
  return n + " " + b;
}

/** Aralash ro'yxat jamisi: dona va kg alohida sanaladi, chunki ularni qo'shib bo'lmaydi. */
export interface MiqdorJami { dona: number; kg: number }

export function boshJami(): MiqdorJami { return { dona: 0, kg: 0 }; }

export function qoshJami(j: MiqdorJami, v: number, b: Birlik): void {
  if (b === "kg") j.kg += v; else j.dona += v;
}

/** "120 dona · 85,5 kg" — faqat nolga teng bo'lmagan qismlar ko'rsatiladi. */
export function fmtJami(j: MiqdorJami): string {
  const qismlar: string[] = [];
  if (j.dona !== 0) qismlar.push(fmtMiqdor(j.dona, "dona"));
  if (j.kg   !== 0) qismlar.push(fmtMiqdor(j.kg, "kg"));
  return qismlar.length ? qismlar.join(" · ") : "0 dona";
}
