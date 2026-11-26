import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

// 80mm termal chek PDF'i (pdf-lib, server tomonda) — telefonda "Print Label" ilovasi bilan chop etiladi.
//
// Printer Label (EZD/TSPL) rejimida Print Label PDF'ning HAR BIR SAHIFASINI sozlamadagi qog'oz
// o'lchamiga (eni × bo'yi, hozir 2.8 × 3.6 dyuym) moslab — rasmni o'zi shu o'lchamga keltirib — yuboradi.
// Ilgari chek bitta sahifa bo'lib, bo'yi mahsulot soniga qarab uzayardi — shuning uchun mahsulot
// ko'paygan sari butun chek kichrayib (siqilib) ketardi. Printer sozlamasi buni o'zgartira olmaydi.
// Endi: qog'ozga sig'adigan chek — avvalgidek bitta sahifa (ko'rinishi o'zgarmaydi);
// undan uzun chek — aynan qog'oz nisbatidagi sahifalarga bo'linadi: har sahifa qog'ozga to'liq
// kattalikda chiqadi, "непрерывный" qog'ozda sahifalar ketma-ket — bitta uzun chek.
// Sahifa faqat mahsulot qatorlari orasidan bo'linadi (qator, Jami va BALANS kesilmaydi).

export interface ChekItem { nomi: string; soni: string; narx: string; summa: string; }
export interface ChekBalans { eski: string; olingan: string; tolov: string | null; yakuniy: string;
  holat?: string;        // eski qarz qaysi amal holatiga (ledger)
  hozirgi?: string;      // shu sotuvdan keyin amal bo'lsa — mijozning hozirgi qoldig'i
  hozirgiVaqt?: string; }
export interface ChekPayload {
  sana: string; agent: string; mijoz: string; tel: string;
  items: ChekItem[]; jami: string; bal: ChekBalans | null;
  chop?: string;          // chek chop etilgan vaqt
}

// Print Label sozlamasidagi qog'oz o'lchami (dyuym): "ширина 2.8", "высокий 3.6".
// Telefonda boshqa o'lcham qo'yilsa — shu ikkisini ham shunga moslash kerak.
export const QOGOZ_ENI_DYUYM = 2.8;
export const QOGOZ_BOYI_DYUYM = 3.6;

const W = 226.772;          // 80mm nuqtada
const M = 4;                // chekka (yon va 1-sahifa tepasi)
const innerW = W - 2 * M;
const BLACK = rgb(0, 0, 0);

// Sahifa bo'yi — qog'oz nisbatida (≈ 291.6pt): Print Label sahifani qog'ozga to'liq eni bilan sig'diradi
export const SAHIFA_H = W * QOGOZ_BOYI_DYUYM / QOGOZ_ENI_DYUYM;
const M_TEPA = 2;           // davom sahifalari tepasidagi chekka
const M_PAST = 2;           // sahifa pastidagi chekka

// Ustunlar (kenglik, pt)
const COL = { no: 16, soni: 26, narx: 44, summa: 46 };
const COL_NOMI = innerW - (COL.no + COL.soni + COL.narx + COL.summa);
// Ustun chap-chegaralari
const X0 = M;                         // №
const X1 = X0 + COL.no;               // Nomi
const X2 = X1 + COL_NOMI;             // Soni
const X3 = X2 + COL.soni;             // Narxi
const X4 = X3 + COL.narx;             // Summa
const XR = X4 + COL.summa;            // o'ng chegara

// Helvetica (WinAnsi) qo'llab-quvvatlamaydigan belgilarni xavfsiz almashtirish
function safe(s: string): string {
  return String(s || "")
    .replace(/№/g, "#")
    .replace(/[‘’ʼ′]/g, "'")   // burama/modifikator apostroflar -> '
    .replace(/[–—−]/g, "-")          // tire/minus -> -
    .replace(/[“”]/g, '"')
    .replace(/·/g, "-")
    .replace(/[^\x20-\x7E]/g, " ");                 // qolgan non-ASCII -> bo'sh joy (xatolik bermasin)
}

function wrap(text: string, maxW: number, font: PDFFont, size: number): string[] {
  const out: string[] = [];
  for (const rawLine of String(text).split("\n")) {
    const words = rawLine.split(" ");
    let cur = "";
    for (const w of words) {
      const test = cur ? cur + " " + w : w;
      if (font.widthOfTextAtSize(test, size) <= maxW || !cur) {
        if (font.widthOfTextAtSize(test, size) <= maxW) { cur = test; continue; }
        // bitta so'z juda uzun — belgilab bo'lamiz
        let chunk = "";
        for (const ch of w) {
          if (font.widthOfTextAtSize(chunk + ch, size) <= maxW) chunk += ch;
          else { if (chunk) out.push(chunk); chunk = ch; }
        }
        cur = chunk;
      } else { out.push(cur); cur = w; }
    }
    out.push(cur);
  }
  return out.length ? out : [""];
}

type Op =
  | { t: "text"; x: number; base: number; text: string; size: number; font: PDFFont; align?: "left" | "center" | "right"; rightX?: number }
  | { t: "line"; x1: number; y1: number; x2: number; y2: number };

// Chekni bitta uzun "lenta" sifatida chizadi (y — yuqoridan pastga).
// breaks — sahifani bo'lish mumkin bo'lgan y'lar (qatorlar orasidagi chiziqlar), end — matn oxiri,
// height — avvalgi (bitta sahifali) chekning bo'yi.
function build(d0: ChekPayload, font: PDFFont, bold: PDFFont): { ops: Op[]; breaks: number[]; end: number; height: number } {
  const d: ChekPayload = {
    sana: safe(d0.sana), agent: safe(d0.agent), mijoz: safe(d0.mijoz), tel: safe(d0.tel),
    items: (d0.items || []).map(it => ({ nomi: safe(it.nomi), soni: safe(it.soni), narx: safe(it.narx), summa: safe(it.summa) })),
    jami: safe(d0.jami),
    bal: d0.bal ? { eski: safe(d0.bal.eski), olingan: safe(d0.bal.olingan), tolov: d0.bal.tolov ? safe(d0.bal.tolov) : null, yakuniy: safe(d0.bal.yakuniy),
      holat: d0.bal.holat ? safe(d0.bal.holat) : "", hozirgi: d0.bal.hozirgi ? safe(d0.bal.hozirgi) : "", hozirgiVaqt: d0.bal.hozirgiVaqt ? safe(d0.bal.hozirgiVaqt) : "" } : null,
    chop: d0.chop ? safe(d0.chop) : "",
  };
  const ops: Op[] = [];
  const breaks: number[] = [];
  let y = M;   // yuqoridan pastga — matn "pastki chegara"si (baseline) sifatida ishlatamiz

  const txt = (text: string, x: number, size: number, f: PDFFont, align: "left"|"center"|"right" = "left", rightX?: number) => {
    y += size;
    ops.push({ t: "text", x, base: y, text, size, font: f, align, rightX });
  };
  const gap = (n: number) => { y += n; };
  const hline = (x1: number, x2: number) => { ops.push({ t: "line", x1, y1: y, x2, y2: y }); };
  const vlines = (xs: number[], top: number, bot: number) => { xs.forEach(x => ops.push({ t: "line", x1: x, y1: top, x2: x, y2: bot })); };

  // Sarlavha
  txt("MUSAFFO TEA", M + innerW / 2, 11, bold, "center");
  gap(2);
  txt("Sotuv cheki", M + innerW / 2, 7, font, "center");
  gap(5);

  // Info
  const info = (label: string, val: string) => { if (!val) return; txt(label, M, 7.5, bold); const b = y; ops.push({ t: "text", x: M + 34, base: b, text: val, size: 7.5, font: bold }); gap(2); };
  info("Sana:", d.sana || "—");
  info("Agent:", d.agent || "");
  info("Mijoz:", d.mijoz || "—");
  info("Telefon:", d.tel || "");
  gap(3);
  hline(M, XR); gap(3);

  // Jadval sarlavhasi
  const rowTop0 = y;
  const th = (t: string, cx: number, align: "center"|"left") => ops.push({ t: "text", x: align === "left" ? cx : cx, base: y + 7, text: t, size: 6.5, font: bold, align });
  th("#", X0 + COL.no / 2, "center");
  th("Mahsulot nomi", X1 + 2, "left");
  th("Soni", X2 + COL.soni / 2, "center");
  th("Narxi", X3 + COL.narx / 2, "center");
  th("Summa", X4 + COL.summa / 2, "center");
  y += 9;
  hline(M, XR);

  // Jadval qatorlari
  d.items.forEach((it, i) => {
    const nameLines = wrap(it.nomi, COL_NOMI - 4, bold, 7.5);
    const rowH = Math.max(12, nameLines.length * 9 + 3);
    const top = y;
    const cy = top + 8;
    ops.push({ t: "text", x: X0 + COL.no / 2, base: cy, text: String(i + 1), size: 7.5, font: bold, align: "center" });
    nameLines.forEach((ln, li) => ops.push({ t: "text", x: X1 + 2, base: top + 8 + li * 9, text: ln, size: 7.5, font: bold }));
    ops.push({ t: "text", x: X2 + COL.soni / 2, base: cy, text: it.soni, size: 7.5, font: bold, align: "center" });
    ops.push({ t: "text", x: 0, base: cy, text: it.narx, size: 7.5, font: bold, align: "right", rightX: X4 - 2 });
    ops.push({ t: "text", x: 0, base: cy, text: it.summa, size: 7.5, font: bold, align: "right", rightX: XR - 2 });
    y = top + rowH;
    hline(M, XR);
    // Qatordan keyin bo'lish mumkin; oxirgi qator esa "Jami" bilan birga qoladi
    if (i < d.items.length - 1) breaks.push(y);
  });
  // Jami qatori
  const jamiTop = y;
  ops.push({ t: "text", x: 0, base: jamiTop + 8, text: "Jami:", size: 7.5, font: bold, align: "right", rightX: X4 - 2 });
  ops.push({ t: "text", x: 0, base: jamiTop + 8, text: d.jami, size: 7.5, font: bold, align: "right", rightX: XR - 2 });
  y = jamiTop + 12;
  hline(M, XR);
  const tableBot = y;
  // Vertikal chiziqlar (butun jadval bo'yicha; sahifalarga bo'linganda har sahifada kesib olinadi)
  vlines([X0, X1, X2, X3, X4, XR], rowTop0, tableBot);
  // BALANS alohida sahifaga o'tishi mumkin ("Chop etildi" yolg'iz o'tmasin — BALANS bo'lmasa jadval bilan qoladi)
  if (d.bal) breaks.push(tableBot);

  gap(5);

  // Balans
  if (d.bal) {
    const bTop = y;
    ops.push({ t: "text", x: M + innerW / 2, base: y + 9, text: "BALANS", size: 8, font: bold, align: "center" });
    y += 13; hline(M, XR);
    const balRow = (label: string, val: string) => {
      const top = y;
      ops.push({ t: "text", x: M + 3, base: top + 9, text: label, size: 8, font: bold });
      ops.push({ t: "text", x: 0, base: top + 9, text: val, size: 8, font: bold, align: "right", rightX: XR - 3 });
      y = top + 13; hline(M, XR);
    };
    // Kichik izoh qatori (masalan "18.09.2026 16:07 - To'lov holatiga")
    const izohRow = (text: string) => {
      const top = y;
      ops.push({ t: "text", x: M + 3, base: top + 7, text, size: 6, font });
      y = top + 9; hline(M, XR);
    };
    balRow("Eski qarz", d.bal.eski);
    if (d.bal.holat) izohRow(d.bal.holat + " holatiga");
    balRow("Olingan tovar", d.bal.olingan);
    if (d.bal.tolov) balRow("To'lov", "- " + d.bal.tolov);
    balRow("Yakuniy balans", d.bal.yakuniy);
    if (d.bal.hozirgi) {
      balRow("Hozirgi qoldiq", d.bal.hozirgi);
      if (d.bal.hozirgiVaqt) izohRow(d.bal.hozirgiVaqt + " holatiga");
    }
    vlines([M, XR], bTop, y);
  }

  if (d.chop) { gap(3); txt("Chop etildi: " + d.chop, M + innerW / 2, 6.5, font, "center"); }

  // end: +2 — oxirgi matnning pastki qismi (descender); height: +6 — avvalgi pastki chekka
  return { ops, breaks, end: y + 2, height: y + 6 };
}

const EPS = 0.01;

// Lentani qog'oz nisbatidagi sahifalarga bo'ladi. Har sahifaga iloji boricha ko'p qator joylanadi;
// bo'linish faqat `breaks` dagi chiziqlarda. O'sha chiziq yangi sahifada tepa chiziq bo'lib takrorlanadi,
// vertikal chiziqlar har sahifada kesib olinadi — jadval har sahifada yopiq ramka bo'lib chiqadi.
function sahifala(ops: Op[], breaks: number[], end: number): { ops: Op[]; height: number }[] {
  const pages: { ops: Op[]; height: number }[] = [];
  let s = 0;                                         // sahifa boshlanadigan lenta y'i
  for (let k = 0; ; k++) {
    const tepa = k === 0 ? 0 : M_TEPA;               // 1-sahifada tepa chekka (M) lentaning o'zida bor
    const limit = s + SAHIFA_H - M_PAST - tepa;      // shu sahifaga sig'adigan eng pastki lenta y'i
    let e: number;
    if (end <= limit + EPS) e = end;
    else {
      const sigadi = breaks.filter(b => b > s + EPS && b <= limit + EPS);
      // Bitta qism butun sahifadan uzun bo'lsa (amalda bo'lmaydi) — sahifa o'zi uzayadi, matn yo'qolmaydi
      e = sigadi.length ? Math.max(...sigadi) : (breaks.find(b => b > s + EPS) ?? end);
    }
    const dy = tepa - s;
    const pOps: Op[] = [];
    for (const op of ops) {
      if (op.t === "text") {
        if (op.base > s + EPS && op.base <= e + EPS) pOps.push({ ...op, base: op.base + dy });
      } else if (Math.abs(op.y1 - op.y2) < EPS) {
        // gorizontal chiziq (bo'linish chizig'i ikkala sahifaga ham tushadi)
        if (op.y1 >= s - EPS && op.y1 <= e + EPS) pOps.push({ ...op, y1: op.y1 + dy, y2: op.y2 + dy });
      } else {
        // vertikal chiziq — shu sahifa oralig'iga kesiladi
        const y1 = Math.max(Math.min(op.y1, op.y2), s), y2 = Math.min(Math.max(op.y1, op.y2), e);
        if (y2 - y1 > EPS) pOps.push({ ...op, y1: y1 + dy, y2: y2 + dy });
      }
    }
    pages.push({ ops: pOps, height: Math.max(SAHIFA_H, e - s + tepa + M_PAST) });
    if (e >= end - EPS) break;
    s = e;
  }
  return pages;
}

export async function chekPdf(d: ChekPayload): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const { ops, breaks, end, height } = build(d, font, bold);
  // Qog'ozga sig'adigan chek — avvalgidek bitta sahifa (aynan eski ko'rinish);
  // uzunrog'i — qog'oz nisbatidagi sahifalarga bo'linadi
  const sahifalar = height <= SAHIFA_H ? [{ ops, height: Math.max(60, height) }] : sahifala(ops, breaks, end);
  for (const sahifa of sahifalar) {
    const H = sahifa.height;
    const page = pdf.addPage([W, H]);
    for (const op of sahifa.ops) {
      if (op.t === "line") {
        page.drawLine({ start: { x: op.x1, y: H - op.y1 }, end: { x: op.x2, y: H - op.y2 }, thickness: 0.7, color: BLACK });
      } else {
        let x = op.x;
        const tw = op.font.widthOfTextAtSize(op.text, op.size);
        if (op.align === "center") x = op.x - tw / 2;
        else if (op.align === "right") x = (op.rightX ?? op.x) - tw;
        page.drawText(op.text, { x, y: H - op.base, size: op.size, font: op.font, color: BLACK });
      }
    }
  }

  // useObjectStreams:false -> an'anaviy PDF tuzilishi (eski/oddiy renderlar,
  // jumladan Print Label, uni o'qiy oladi; object stream'li PDF'ni oppoq ko'rsatgan edi)
  return pdf.save({ useObjectStreams: false });
}
