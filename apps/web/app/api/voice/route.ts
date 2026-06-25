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
  const biasPrompt = ("Choy mahsulotlari buyurtmasi. Nomlar: " + brands.join(", ")).slice(0, 880);

  let transcription = "";
  try {
    const wf = new FormData();
    wf.append("file", audio, (audio as File).name || "audio.webm");
    wf.append("model", "whisper-1");
    wf.append("language", "uz");
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
  const catalog = products.map((p) => `${p.id} | ${p.n}`).join("\n");
  const systemText =
`Sen ovozli buyurtmani mahsulot katalogiga moslaydigan yordamchisan.
Foydalanuvchi mahsulot nomi, grami va sonini ovozda aytadi. Ovoz matnga aylantirilgan, lekin XATO bo'lishi mumkin (masalan "200 gramm" -> "22 gondoni", "kg" -> "ka"). Shuni hisobga olib eng mos mahsulotni tanla.

QOIDALAR:
- Faqat quyidagi KATALOGdagi mahsulotlardan BIRINI tanla. Mos kelmasa Mahsulot_ID="".
- Brend/nom va gramm/og'irlik bo'yicha mos kel; eshitilgan raqam grammni anglatishi mumkin (200, 250, 1kg...).
- soni: dona/ta/tup/blok/quti/qop kabi so'zlardan olinadi. Aniq ko'rsatilmasa soni=1.
- ishonch: aniq mos kelsa "yuqori", shubhali bo'lsa "past".
- nomzodlar: eng mos 1-3 ta Mahsulot_ID (birinchisi eng mosi).
- Javobni FAQAT JSON ko'rinishida qaytar: {"Mahsulot_ID":"...","soni":N,"ishonch":"yuqori","nomzodlar":["..."]}

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
        model: process.env.OPENAI_MATCH_MODEL || "gpt-4o-mini",
        temperature: 0,
        max_tokens: 300,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemText },
          { role: "user", content: `Eshitildi: "${transcription}". Shu buyurtmadagi mahsulot va sonini aniqla. Faqat JSON qaytar.` },
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
    const mid = String(parsed.Mahsulot_ID || "");
    return NextResponse.json({
      Mahsulot_ID: ids.has(mid) ? mid : "",
      soni: num(parsed.soni) || 1,
      ishonch: parsed.ishonch === "past" ? "past" : "yuqori",
      nomzodlar: Array.isArray(parsed.nomzodlar) ? parsed.nomzodlar : [],
      transcription,
    });
  } catch {
    // Matching xato bo'lsa ham, transkripsiya bo'lsa frontend lokal moslashga uradi
    return NextResponse.json({ error: "GPT bilan bog'lanib bo'lmadi", transcription }, { status: 502 });
  }
}
