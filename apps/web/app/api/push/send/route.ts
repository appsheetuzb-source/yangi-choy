import { NextRequest, NextResponse } from "next/server";
import { getMultipleSheets, getSheetData, deleteRow } from "@/lib/sheets";
import webpush from "web-push";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function num(v: unknown) { return parseFloat(String(v ?? "0").replace(/\s/g, "").replace(",", ".")) || 0; }
function isDollarV(v?: string) { const lv = String(v || "").toLowerCase().trim(); return lv.includes("dollar") || lv === "$"; }
function parseIds(v?: string) { return String(v || "").split(/\s*,\s*/).map((s) => s.trim()).filter(Boolean); }
function fmtSom(v: number) { return v.toLocaleString("ru-RU") + " so'm"; }
function fmtUsd(v: number) { return "$" + v.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

async function handle(req: NextRequest) {
  const url = new URL(req.url);
  const secret = process.env.PUSH_CRON_SECRET;
  const provided = req.headers.get("x-cron-secret") || url.searchParams.get("secret") || "";
  if (secret && provided !== secret) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const force = url.searchParams.get("force") === "1";
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tashkent" }));
  const hour = now.getHours();
  if (!force && (hour < 8 || hour >= 20)) {
    return NextResponse.json({ skipped: true, reason: "vaqt oynasidan tashqari (08:00-20:00)", hour });
  }

  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subj = process.env.VAPID_SUBJECT || "mailto:admin@musaffotea.uz";
  if (!pub || !priv) return NextResponse.json({ error: "VAPID kalitlar yo'q" }, { status: 500 });
  webpush.setVapidDetails(subj, pub, priv);

  // ── Ma'lumotlar ──
  const rr = await getMultipleSheets(["Mijozlar", "Sotuv", "Sotuv_Savat", "Sotuv_savat_dollar", "S_tolov", "Ogohlantirish"]);
  const ogoh = rr["Ogohlantirish"]?.data || [];

  // Barcha yozuvlardagi tanlangan mijozlar birlashmasi
  const watch = new Set<string>();
  ogoh.forEach((o) => parseIds(o.Mijoz_ID).forEach((id) => watch.add(id)));
  if (watch.size === 0) return NextResponse.json({ sent: 0, reason: "mijoz tanlanmagan" });

  // Bosilganda qaysi sahifa ochilsin: bitta yozuv bo'lsa — aynan o'sha detail; bir nechta bo'lsa — ro'yxat
  const realEntries = ogoh.filter((o) => (o.Ogoh_ID || "").trim() && parseIds(o.Mijoz_ID).length > 0);
  const targetUrl = realEntries.length === 1 ? `/ogohlantirish/${realEntries[0].Ogoh_ID}` : "/ogohlantirish";

  const mMap: Record<string, Record<string, string>> = {};
  (rr["Mijozlar"]?.data || []).forEach((m) => { if (m.Mijoz_ID) mMap[m.Mijoz_ID] = m; });

  const sotuvMijoz: Record<string, string> = {};
  (rr["Sotuv"]?.data || []).forEach((s) => {
    if (String(s.Chek || "").trim() !== "") { const id = String(s.Sotuv_ID || "").trim(); if (id) sotuvMijoz[id] = s.Mijoz_ID; }
  });
  const sSom: Record<string, number> = {}, sUsd: Record<string, number> = {};
  (rr["Sotuv_Savat"]?.data || []).forEach((r) => { const mid = sotuvMijoz[String(r.Sotuv_ID || "").trim()]; if (mid) sSom[mid] = (sSom[mid] || 0) + num(r.Summa_som); });
  (rr["Sotuv_savat_dollar"]?.data || []).forEach((r) => { const mid = sotuvMijoz[String(r.Sotuv_ID || "").trim()]; if (mid) sUsd[mid] = (sUsd[mid] || 0) + num(r.Summa); });
  const tSom: Record<string, number> = {}, tUsd: Record<string, number> = {};
  (rr["S_tolov"]?.data || []).forEach((t) => {
    const id = String(t.Mijoz_ID || "").trim(); if (!id) return;
    if (isDollarV(t.Valyuta)) tUsd[id] = (tUsd[id] || 0) + num(t.Summa_dollar); else tSom[id] = (tSom[id] || 0) + num(t.Summa);
  });

  const debtors = [...watch].map((id) => {
    const m = mMap[id];
    const som = num(m?.Boshlangich_Balans_som) + (sSom[id] || 0) - (tSom[id] || 0);
    const usd = num(m?.Boshlangich_Balans_dollar) + (sUsd[id] || 0) - (tUsd[id] || 0);
    return { ism: m?.Ism || id, som, usd };
  }).filter((d) => d.som > 0 || d.usd > 0)
    .sort((a, b) => (b.som - a.som) || (b.usd - a.usd));

  if (debtors.length === 0) return NextResponse.json({ sent: 0, reason: "qarzdor yo'q" });

  const top = debtors.slice(0, 5);
  const lines = top.map((d) => {
    const parts: string[] = [];
    if (d.som > 0) parts.push(fmtSom(d.som));
    if (d.usd > 0) parts.push(fmtUsd(d.usd));
    return `${d.ism} — ${parts.join(" · ")}`;
  });
  const body = lines.join("\n") + (debtors.length > 5 ? `\n… +${debtors.length - 5} mijoz` : "");
  const payload = JSON.stringify({
    title: `🔔 Eng katta qarzdorlar (${debtors.length})`,
    body,
    url: targetUrl,
    tag: "ogoh-debtors",
  });

  // ── Yuborish ──
  const subs = (await getSheetData("Push_Subscriptions")).data || [];
  let sent = 0, removed = 0, failed = 0;
  await Promise.all(subs.map(async (s) => {
    if (!s.Endpoint) return;
    try {
      await webpush.sendNotification({ endpoint: s.Endpoint, keys: { p256dh: s.P256dh, auth: s.Auth } }, payload);
      sent++;
    } catch (err) {
      const code = (err as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410) {
        try { if (s.Sub_ID) await deleteRow("Push_Subscriptions", "Sub_ID", s.Sub_ID); removed++; } catch {}
      } else { failed++; }
    }
  }));

  return NextResponse.json({ sent, removed, failed, debtors: debtors.length, subs: subs.length, hour });
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
