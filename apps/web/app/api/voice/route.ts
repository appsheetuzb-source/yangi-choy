import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Prod = { id: string; n: string };

function num(v: unknown) {
  return parseFloat(String(v ?? "0").replace(/\s/g, "").replace(",", ".")) || 0;
}

// AI javobidagi matndan birinchi JSON blokini ajratib oladi
function extractJson(txt: string): Record<string, unknown> {
  const a = txt.indexOf("{");
  const b = txt.lastIndexOf("}");
  if (a < 0 || b <= a) return {};
  try { return JSON.parse(txt.slice(a, b + 1)); } catch { return {}; }
}

// ── Pre-filter: transkripsiyaga qarab katalogni kichraytirish (gpt-4o narxini ~4x kamaytiradi) ──
const VOICE_STOP = new Set(["gr","gram","gramm","kg","kilo","kilogramm","dona","ta","tup","blok","quti","qop","halta","pachka","paket","soni","va","yuz","ming","li","lik","ali","tali","oq","qora"]);
function voiceNorm(s: string) { return s.toLowerCase().replace(/['’ʻ`´]/g, "").replace(/[^a-z0-9\s]/g, " "); }
function voiceTok(s: string) { return (voiceNorm(s).match(/\d+|[a-z]{2,}/g) || []).filter((t) => !VOICE_STOP.has(t)); }
function filterCatalog(trans: string, products: Prod[], cap = 90): Prod[] {
  const q = new Set(voiceTok(trans));
  const scored = products.map((p) => {
    const pt = voiceTok(p.n);
    let score = 0;
    for (const t of pt) {
      if (q.has(t)) score += /^\d+$/.test(t) ? 1.2 : 1;             // raqam (gram/model) mosligi biroz muhimroq
      else if (t.length >= 4) { for (const w of q) { if (w.length >= 4 && (w.includes(t) || t.includes(w))) { score += 0.5; break; } } }
    }
    return { p, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  if (scored.length === 0) return products;   // hech narsa mos kelmasa — xavfsizlik uchun to'liq katalog
  return scored.slice(0, cap).map((x) => x.p);
}

export async function POST(req: NextRequest) {
  const OPENAI = process.env.OPENAI_API_KEY;
  if (!OPENAI) return NextResponse.json({ error: "OPENAI_API_KEY sozlanmagan (server .env)" }, { status: 500 });

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "Audio yuborilmadi" }, { status: 400 }); }

  const audio = form.get("audio");
  if (!(audio instanceof Blob)) return NextResponse.json({ error: "Audio topilmadi" }, { status: 400 });

  let products: Prod[] = [];
  try { products = JSON.parse(String(form.get("products") || "[]")); } catch {}
  products = products.filter((p) => p && p.id && p.n);
  if (products.length === 0) return NextResponse.json({ error: "Mahsulotlar ro'yxati bo'sh" }, { status: 400 });

  // ── 1. Whisper: ovoz → matn (o'zbek tili) ──
  // Brend nomlarini "prompt" sifatida berib, Whisper aniqligini oshiramiz
  const brands: string[] = [];
  let blen = 0;
  for (const p of products) {
    const w = p.n.trim().split(/\s+/).slice(0, 2).join(" ");
    if (w) { brands.push(w); blen += w.length + 2; }
    if (blen > 650) break;
  }
  const biasPrompt = (
    "Choy mahsulotlari ovozli buyurtmasi. Tartib: nom gramm dona. " +
    "Masalan: Rizq 71 400 gramm 10 dona; Mumtoz 72 200 gramm 5 dona. " +
    "Grammlar: 100, 200, 250, 300, 400, 500 gramm yoki 1 kg. " +
    "Sonlar: bir, ikki, uch, to'rt, besh, olti, yetti, sakkiz, to'qqiz, o'n, yigirma. " +
    "Mahsulotlar: " + brands.join(", ")
  ).slice(0, 980);

  let transcription = "";
  try {
    const wf = new FormData();
    wf.append("file", audio, (audio as File).name || "audio.webm");
    wf.append("model", process.env.OPENAI_STT_MODEL || "gpt-4o-transcribe");
    // Eslatma: language="uz" Whisper API'da qabul qilinmaydi (uz rasman qo'llab-quvvatlanmaydi).
    // Tilni avto-aniqlashga qoldiramiz; o'zbekcha "prompt" (brend nomlari) aniqlashni o'zbek tomon yo'naltiradi.
    wf.append("prompt", biasPrompt);
    const wr = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI}` },
      body: wf,
    });
    if (!wr.ok) {
      const t = await wr.text();
      return NextResponse.json({ error: "Whisper xatosi: " + t.slice(0, 180) }, { status: 502 });
    }
    const wj = await wr.json();
    transcription = String(wj.text || "").trim();
  } catch {
    return NextResponse.json({ error: "Whisper bilan bog'lanib bo'lmadi" }, { status: 502 });
  }
  if (!transcription) {
    return NextResponse.json({ Mahsulot_ID: "", soni: 1, ishonch: "past", nomzodlar: [], transcription: "" });
  }

  // ── 2. GPT (OpenAI): matn → mahsulot (katalogga moslash) ──
  // Pre-filter: faqat transkripsiyaga aloqador ~150 mahsulotni GPT'ga yuboramiz (620 emas) — narx ~4x arzon, aniqlik o'sha
  const candidates = filterCatalog(transcription, products);
  const catalog = candidates.map((p) => `${p.id} | ${p.n}`).join("\n");
  const systemText =
`Sen ovozli buyurtmani mahsulot katalogiga moslaydigan yordamchisan.
Foydalanuvchi BIR yoki BIR NECHTA mahsulotni ketma-ket aytadi (vergul, "va", yoki shunchaki ketma-ket). Har biri uchun nom, gram va soni bo'ladi. Ovoz matnga aylantirilgan, lekin XATO bo'lishi mumkin (apostroflar tushadi: "o'n"->"on", "to'rt"->"tort"; yoki raqam noto'g'ri eshitiladi). Shuni hisobga ol.

O'ZBEKCHA SON-SO'ZLARNI RAQAMGA AYLANTIR (apostrofsiz ham):
bir=1, ikki=2, uch=3, tort/to'rt=4, besh=5, olti=6, yetti=7, sakkiz=8, toqqiz/to'qqiz=9, on/o'n=10, yigirma=20, ottiz/o'ttiz=30, qirq=40, ellik=50, oltmish=60, yetmish=70, sakson=80, toqson/to'qson=90, yuz=100.
Qo'shma: "on besh"=15, "yigirma besh"=25, "ikki yuz"=200, "tort yuz"=400, "besh yuz"=500.

QOIDALAR:
- HAR BIR aytilgan mahsulotni ALOHIDA element qil. Buyurtmada nechta mahsulot bo'lsa, "items" ro'yxatida shuncha element bo'lsin — CHEKLOV YO'Q (30, 50 ta bo'lsa ham HAMMASINI qaytar, birortasini tashlab ketma).
- Har element: katalogdan eng mos Mahsulot_ID, soni, ishonch.
- BREND ANIQ MOS KELISHI SHART. Mahsulot nomi boshidagi brend (Rizq, Turon, Zamin, Mumtoz, Ansor, Exc, Rusoma, Oolong, Yaxshi, Saodat...) aytilgan brend bilan AYNAN bir xil bo'lsin. Brend boshqa bo'lsa — model raqami (71, 68...) va gram bir xil bo'lsa HAM TANLAMA. Masalan "Rizq 71 200" uchun FAQAT "Rizq 71 200GR"; "TURON 71 200GR" NOTO'G'RI (brend Rizq emas). Aytilgan brend katalogda umuman yo'q bo'lsa Mahsulot_ID="".
- Gramm/og'irlik bo'yicha mos kel: raqam yoki son-so'z ("ikki yuz gramm"=200, "tort yuz"=400). Brend mos, lekin aniq gram topilmasa — eng yaqin gramli variantni tanla.
- soni: "dona/ta/tup/blok/quti/qop/halta/pachka" so'zi OLDIDAGI raqam/son-so'z. "on dona"=10, "besh dona"=5. Aniq son bo'lmasa soni=1.
- ishonch: aniq mos kelsa "yuqori", shubhali bo'lsa "past".
- MUHIM: Mahsulot_ID sifatida KATALOGning chap ustunidagi AYNAN o'sha kodni yoz (8 belgili, masalan "096a2390"). Mahsulot nomini, gramini yoki "<...>" kabi namunani YOZMA — faqat katalogdagi haqiqiy ID kodi.
- Javobni FAQAT JSON ko'rinishida qaytar: {"items":[{"Mahsulot_ID":"096a2390","soni":N,"ishonch":"yuqori"}]}

MISOLLAR (ID lar shunchaki FORMAT namunasi — har doim katalogdan haqiqiy kodni ol):
- "rizq yetmish bir tort yuz gramm on dona, mumtoz yetmish ikki tort yuz gramm on dona" -> {"items":[{"Mahsulot_ID":"0a1b2c3d","soni":10,"ishonch":"yuqori"},{"Mahsulot_ID":"4e5f6a7b","soni":10,"ishonch":"yuqori"}]}
- "zamin gold ikki yuz gramm besh dona" -> {"items":[{"Mahsulot_ID":"8c9d0e1f","soni":5,"ishonch":"yuqori"}]}

KATALOG (ID | Nomi):
${catalog}`;

  try {
    const cr = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MATCH_MODEL || "gpt-4o",
        temperature: 0,
        max_tokens: 4000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemText },
          { role: "user", content: `Eshitildi: "${transcription}". Shu buyurtmadagi HAR BIR mahsulot va sonini aniqlab, items ro'yxatini qaytar. Faqat JSON.` },
        ],
      }),
    });
    const cj = await cr.json();
    if (!cr.ok) {
      const msg = (cj?.error?.message as string) || "Matching xatosi";
      return NextResponse.json({ error: msg.slice(0, 180), transcription }, { status: 502 });
    }
    const txt = String(cj?.choices?.[0]?.message?.content || "");
    const parsed = extractJson(txt);
    const ids = new Set(products.map((p) => p.id));
    const rawItems = Array.isArray((parsed as { items?: unknown }).items) ? (parsed as { items: unknown[] }).items : [];
    const items = rawItems.map((it) => {
      const o = (it || {}) as Record<string, unknown>;
      const mid = String(o.Mahsulot_ID || "");
      return { Mahsulot_ID: ids.has(mid) ? mid : "", soni: num(o.soni) || 1, ishonch: o.ishonch === "past" ? "past" : "yuqori" };
    });
    return NextResponse.json({ items, transcription });
  } catch {
    // Matching xato bo'lsa ham, transkripsiya bo'lsa frontend lokal moslashga uradi
    return NextResponse.json({ error: "GPT bilan bog'lanib bo'lmadi", transcription }, { status: 502 });
  }
}
