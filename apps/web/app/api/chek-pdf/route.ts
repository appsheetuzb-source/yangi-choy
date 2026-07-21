import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, PDFFont } from "pdf-lib";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// 80mm termal chek PDF'ini SERVER tomonda pdf-lib bilan yasaydi (standart, toza PDF —
// Print Label ko'rsatishi uchun). Ma'lumot client'dan POST bilan keladi (formatlangan).

interface Item { nomi: string; soni: string; narx: string; summa: string; }
interface Bal { eski: string; olingan: string; tolov: string | null; yakuniy: string; }
interface Payload {
  sana: string; agent: string; mijoz: string; tel: string;
  items: Item[]; jami: string; bal: Bal | null;
}

const W = 226.772;          // 80mm nuqtada
const M = 6;                // chekka
const innerW = W - 2 * M;
const BLACK = rgb(0, 0, 0);

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

function build(d0: Payload, font: PDFFont, bold: PDFFont): { ops: Op[]; height: number } {
  const d: Payload = {
    sana: safe(d0.sana), agent: safe(d0.agent), mijoz: safe(d0.mijoz), tel: safe(d0.tel),
    items: (d0.items || []).map(it => ({ nomi: safe(it.nomi), soni: safe(it.soni), narx: safe(it.narx), summa: safe(it.summa) })),
    jami: safe(d0.jami),
    bal: d0.bal ? { eski: safe(d0.bal.eski), olingan: safe(d0.bal.olingan), tolov: d0.bal.tolov ? safe(d0.bal.tolov) : null, yakuniy: safe(d0.bal.yakuniy) } : null,
  };
  const ops: Op[] = [];
  let y = M;   // yuqoridan pastga — matn "pastki chegara"si (baseline) sifatida ishlatamiz

  const txt = (text: string, x: number, size: number, f: PDFFont, align: "left"|"center"|"right" = "left", rightX?: number) => {
    y += size;
    ops.push({ t: "text", x, base: y, text, size, font: f, align, rightX });
  };
  const gap = (n: number) => { y += n; };
  const hline = (x1: number, x2: number) => { ops.push({ t: "line", x1, y1: y, x2, y2: y }); };
  const vlines = (xs: number[], top: number, bot: number) => { xs.forEach(x => ops.push({ t: "line", x1: x, y1: top, x2: x, y2: bot })); };

  // Sarlavha
  txt("MUSAFFO TEA", M + innerW / 2, 13, bold, "center");
  gap(2);
  txt("Sotuv cheki", M + innerW / 2, 8, font, "center");
  gap(5);

  // Info
  const info = (label: string, val: string) => { if (!val) return; txt(label, M, 8.5, bold); const b = y; ops.push({ t: "text", x: M + 32, base: b, text: val, size: 8.5, font: bold }); gap(3); };
  info("Sana:", d.sana || "—");
  info("Agent:", d.agent || "");
  info("Mijoz:", d.mijoz || "—");
  info("Telefon:", d.tel || "");
  gap(3);
  hline(M, XR); gap(3);

  // Jadval sarlavhasi
  const rowTop0 = y;
  const th = (t: string, cx: number, align: "center"|"left") => ops.push({ t: "text", x: align === "left" ? cx : cx, base: y + 8, text: t, size: 7.5, font: bold, align });
  th("#", X0 + COL.no / 2, "center");
  th("Mahsulot nomi", X1 + 2, "left");
  th("Soni", X2 + COL.soni / 2, "center");
  th("Narxi", X3 + COL.narx / 2, "center");
  th("Summa", X4 + COL.summa / 2, "center");
  y += 11;
  hline(M, XR);
  const headBot = y;

  // Jadval qatorlari
  d.items.forEach((it, i) => {
    const nameLines = wrap(it.nomi, COL_NOMI - 4, bold, 9);
    const rowH = Math.max(15, nameLines.length * 11 + 4);
    const top = y;
    const cy = top + 10;
    ops.push({ t: "text", x: X0 + COL.no / 2, base: cy, text: String(i + 1), size: 9, font: bold, align: "center" });
    nameLines.forEach((ln, li) => ops.push({ t: "text", x: X1 + 2, base: top + 10 + li * 11, text: ln, size: 9, font: bold }));
    ops.push({ t: "text", x: X2 + COL.soni / 2, base: cy, text: it.soni, size: 9, font: bold, align: "center" });
    ops.push({ t: "text", x: 0, base: cy, text: it.narx, size: 9, font: bold, align: "right", rightX: X4 - 2 });
    ops.push({ t: "text", x: 0, base: cy, text: it.summa, size: 9, font: bold, align: "right", rightX: XR - 2 });
    y = top + rowH;
    hline(M, XR);
  });
  // Jami qatori
  const jamiTop = y;
  ops.push({ t: "text", x: 0, base: jamiTop + 10, text: "Jami:", size: 9, font: bold, align: "right", rightX: X4 - 2 });
  ops.push({ t: "text", x: 0, base: jamiTop + 10, text: d.jami, size: 9, font: bold, align: "right", rightX: XR - 2 });
  y = jamiTop + 15;
  hline(M, XR);
  const tableBot = y;
  // Vertikal chiziqlar (butun jadval bo'yicha)
  vlines([X0, X1, X2, X3, X4, XR], rowTop0, tableBot);
  // headBot ni ishlatamiz (lint uchun) — sarlavha ostidagi chiziq allaqachon chizilgan
  void headBot;

  gap(5);

  // Balans
  if (d.bal) {
    const bTop = y;
    ops.push({ t: "text", x: M + innerW / 2, base: y + 10, text: "BALANS", size: 10, font: bold, align: "center" });
    y += 15; hline(M, XR);
    const balRow = (label: string, val: string) => {
      const top = y;
      ops.push({ t: "text", x: M + 3, base: top + 10, text: label, size: 9.5, font: bold });
      ops.push({ t: "text", x: 0, base: top + 10, text: val, size: 9.5, font: bold, align: "right", rightX: XR - 3 });
      y = top + 15; hline(M, XR);
    };
    balRow("Eski qarz", d.bal.eski);
    balRow("Olingan tovar", d.bal.olingan);
    if (d.bal.tolov) balRow("To'lov", "- " + d.bal.tolov);
    balRow("Yakuniy balans", d.bal.yakuniy);
    vlines([M, XR], bTop, y);
  }

  gap(6);
  return { ops, height: y };
}

export async function POST(req: NextRequest) {
  try {
    const d = (await req.json()) as Payload;
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const { ops, height } = build(d, font, bold);
    const H = Math.max(60, height);
    const page = pdf.addPage([W, H]);

    for (const op of ops) {
      if (op.t === "line") {
        page.drawLine({ start: { x: op.x1, y: H - op.y1 }, end: { x: op.x2, y: H - op.y2 }, thickness: 1.0, color: BLACK });
      } else {
        let x = op.x;
        const tw = op.font.widthOfTextAtSize(op.text, op.size);
        if (op.align === "center") x = op.x - tw / 2;
        else if (op.align === "right") x = (op.rightX ?? op.x) - tw;
        page.drawText(op.text, { x, y: H - op.base, size: op.size, font: op.font, color: BLACK });
      }
    }

    // useObjectStreams:false -> an'anaviy PDF tuzilishi (eski/oddiy renderlar,
    // jumladan Print Label, uni o'qiy oladi; object stream'li PDF'ni oppoq ko'rsatgan edi)
    const bytes = await pdf.save({ useObjectStreams: false });
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="chek.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "xato" }, { status: 500 });
  }
}
