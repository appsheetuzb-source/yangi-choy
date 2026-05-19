export interface Mahsulot {
  Mahsulot_ID: string;
  Ombor_ID: string;
  Nomi: string;
  Rasm: string;
  Tan_som: string;
  Sotuv_som: string;
  Tan_dollar: string;
  Sotuv_dollar: string;
  Qoshilgan_sana: string;
  Kg: string;
  Check: string;
}

export interface SheetData {
  headers: string[];
  data: Record<string, string>[];
}

export interface Mijoz {
  Mijoz_ID: string;
  Nomi: string;
  Telefon: string;
  Manzil: string;
}

export interface Sotuv {
  Sotuv_ID: string;
  Mijoz_ID: string;
  Sana: string;
  Jami_som: string;
  Jami_dollar: string;
  Agent_ID: string;
}
