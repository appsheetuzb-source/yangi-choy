"use client";

import { fetchSheetWhere, afterWrite } from "@/lib/sheet-cache";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface Mahsulot {
  Mahsulot_ID: string; Nomi: string; Rasm: string;
  Sotuv_som: string; Sotuv_dollar: string;
  Tan_som: string; Tan_dollar: string;
  Kg: string; Ombor_ID: string;
}
interface XaridSavat {
  X_Savat: string; Sana: string; Mahsulot_ID: string; Xarid_ID: string;
  Soni: string; Narxi: string; Narx_som: string; Summa_Som: string;
}
interface Xarid { Xarid_ID: string; Taminotchi_ID: string; Sana: string; }
interface Taminotchi { Taminotchi_ID: string; Ism: string; }
interface SotuvSavatRow {
  Savat_ID: string; Sotuv_ID: string; Mahsulot_ID: string;
  Soni: string; Som_Narx: string; Summa_som: string;
}
interface SotuvSavatDollarRow {
  Savat_ID: string; Sotuv_ID: string; Mahsulot_ID: string;
  Soni: string; Narx: string; Summa: string;
}
interface Sotuv { Sotuv_ID: string; Sana: string; Mijoz_ID: string; }
interface Mijoz { Mijoz_ID: string; Ism: string; }

type PriceField = "Sotuv_som" | "Sotuv_dollar" | "Tan_som" | "Tan_dollar";

interface TxRow {
  id: string;
  sana: string;
  vaqt: string;
  manba: string;
  manbaType: "taminotchi" | "mijoz";
  izoh: string;
  kirim: number;
  chiqim: number;
  sortKey: string;
  valyuta: "som" | "dollar";
  linkId: string;
  linkType: "xarid" | "sotuv";
  narxSom: number;
  narxDollar: number;
  summaSom: number;
  summaDollar: number;
}

function num(v: string | number | undefined) {
  return parseFloat(String(v || "0").replace(/\s/g, "").replace(",", ".")) || 0;
}
function fmtNum(v: number) {
  return v.toLocaleString("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}
function fmtSom(v: number) { return v ? v.toLocaleString("ru-RU") + " so'm" : "—"; }
function fmtUsd(v: number) {
  return v ? "$" + v.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
}
function parseSana(s: string) {
  if (!s || !s.includes(".")) return null;
  const [dd, mm, yyyy] = s.split(".");
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function inRange(sana: string, from: string, to: string) {
  const d = parseSana(sana);
  if (!d) return false;
  if (from) { const f = new Date(from); f.setHours(0,0,0,0); if (d < f) return false; }
  if (to)   { const t = new Date(to);   t.setHours(23,59,59,999); if (d > t) return false; }
  return true;
}
function uniq(values: Array<string | undefined>) {
  return Array.from(new Set(values.map(v => String(v || "").trim()).filter(Boolean)));
}
// ID lar bo'yicha fetch — ko'p ID bo'lsa URL juda uzun bo'lib xato bermasligi uchun
// parallel bo'laklarga bo'lib yuboramiz (tez qoladi, ishonchli bo'ladi).
async function fetchWhereChunked(range: string, column: string, ids: string[], chunk = 150): Promise<{ data: unknown[] }> {
  if (!ids.length) return { data: [] };
  const parts: string[][] = [];
  for (let i = 0; i < ids.length; i += chunk) parts.push(ids.slice(i, i + chunk));
  const results = await Promise.all(parts.map(p => fetchSheetWhere(range, column, p)));
  return { data: results.flatMap(r => (r.data || []) as unknown[]) };
}

export default function MahsulotDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [mahsulot, setMahsulot]       = useState<Mahsulot | null>(null);
  const [txAll, setTxAll]             = useState<TxRow[]>([]);
  const [avgSotuvSom, setAvgSotuvSom] = useState(0);
  const [avgSotuvUsd, setAvgSotuvUsd] = useState(0);
  const [loading, setLoading]         = useState(true);
  const [imgErr, setImgErr]     = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [prices, setPrices]     = useState<Record<PriceField, string>>({
    Sotuv_som: "", Sotuv_dollar: "", Tan_som: "", Tan_dollar: "",
  });
  const [saving, setSaving] = useState<PriceField | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState(todayISO());
  const [activeTur, setActiveTur] = useState("Barchasi");
  const [q, setQ] = useState("");

  useEffect(() => { const c = () => setIsMobile(window.innerWidth < 768); c(); window.addEventListener("resize", c); return () => window.removeEventListener("resize", c); }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      fetchSheetWhere("Mahsulot", "Mahsulot_ID", id),
      fetchSheetWhere("Xarid_Savat", "Mahsulot_ID", id),
      fetchSheetWhere("Sotuv_Savat", "Mahsulot_ID", id),
      fetchSheetWhere("Sotuv_savat_dollar", "Mahsulot_ID", id),
    ]).then(async ([mRes, xsRes, ssRes, ssdRes]) => {
      const m = (mRes.data as Mahsulot[])[0] || null;
      setMahsulot(m);
      if (m) setPrices({
        Sotuv_som: m.Sotuv_som || "", Sotuv_dollar: m.Sotuv_dollar || "",
        Tan_som: m.Tan_som || "", Tan_dollar: m.Tan_dollar || "",
      });

      const xaridIds = uniq((xsRes.data as XaridSavat[]).map(r => r.Xarid_ID));
      const sotuvIds = uniq([
        ...(ssRes.data as SotuvSavatRow[]).map(r => r.Sotuv_ID),
        ...(ssdRes.data as SotuvSavatDollarRow[]).map(r => r.Sotuv_ID),
      ]);
      const [xRes, sotRes] = await Promise.all([
        fetchWhereChunked("Xarid", "Xarid_ID", xaridIds),
        fetchWhereChunked("Sotuv", "Sotuv_ID", sotuvIds),
      ]);
      const taminotchiIds = uniq((xRes.data as Xarid[]).map(x => x.Taminotchi_ID));
      const mijozIds = uniq((sotRes.data as Sotuv[]).flatMap(s => {
        const raw = s.Mijoz_ID || "";
        return raw.includes(".") ? [raw, raw.split(".")[1]] : [raw];
      }));
      const [tRes, mijRes] = await Promise.all([
        fetchWhereChunked("Taminotchi", "Taminotchi_ID", taminotchiIds),
        fetchWhereChunked("Mijozlar", "Mijoz_ID", mijozIds),
      ]);

      const xaridMap: Record<string, Xarid> = {};
      (xRes.data as Xarid[]).forEach(x => { xaridMap[x.Xarid_ID] = x; });
      const taminotchiMap: Record<string, string> = {};
      (tRes.data as Taminotchi[]).forEach(t => { taminotchiMap[t.Taminotchi_ID] = t.Ism; });
      const sotuvMap: Record<string, Sotuv> = {};
      (sotRes.data as Sotuv[]).forEach(s => { sotuvMap[s.Sotuv_ID] = s; });
      const mijozMap: Record<string, string> = {};
      (mijRes.data as Mijoz[]).forEach(m => { mijozMap[m.Mijoz_ID] = m.Ism; });

      function getMijozNomi(s: Sotuv) {
        // Mijoz_ID "Sotuv_ID.Mijoz_ID" formatida keladi
        const rawId = s.Mijoz_ID || "";
        const mijozId = rawId.includes(".") ? rawId.split(".")[1] : rawId;
        return mijozMap[mijozId] || mijozMap[rawId] || "";
      }

      const kirimTx: TxRow[] = (xsRes.data as XaridSavat[])
        .filter(r => r.Mahsulot_ID === id && r.Sana)
        .map(r => {
          const xarid = xaridMap[r.Xarid_ID];
          const tNomi = xarid ? (taminotchiMap[xarid.Taminotchi_ID] || "Ta'minotchi") : "Ta'minotchi";
          return {
            id: r.X_Savat || Math.random().toString(),
            sana: r.Sana,
            vaqt: "",
            manba: tNomi,
            manbaType: "taminotchi" as const,
            izoh: "Xarid",
            kirim: num(r.Soni),
            chiqim: 0,
            sortKey: r.Sana.split(".").reverse().join(""),
            valyuta: "som" as const,
            linkId: r.Xarid_ID,
            linkType: "xarid" as const,
            narxSom: num(r.Narx_som),
            narxDollar: num(r.Narxi),
            summaSom: num(r.Summa_Som),
            summaDollar: num(r.Soni) * num(r.Narxi),
          };
        });

      const chiqimSom: TxRow[] = (ssRes.data as SotuvSavatRow[])
        .filter(r => r.Mahsulot_ID === id)
        .map(r => {
          const s = sotuvMap[r.Sotuv_ID];
          if (!s?.Sana) return null;
          return {
            id: r.Savat_ID || Math.random().toString(),
            sana: s.Sana,
            vaqt: "",
            manba: getMijozNomi(s) || "Mijoz",
            manbaType: "mijoz" as const,
            izoh: "Sotuv (so'm)",
            kirim: 0,
            chiqim: num(r.Soni),
            sortKey: s.Sana.split(".").reverse().join(""),
            valyuta: "som" as const,
            linkId: r.Sotuv_ID,
            linkType: "sotuv" as const,
            narxSom: num(r.Som_Narx),
            narxDollar: 0,
            summaSom: num(r.Summa_som),
            summaDollar: 0,
          };
        })
        .filter(Boolean) as TxRow[];

      const chiqimDollar: TxRow[] = (ssdRes.data as SotuvSavatDollarRow[])
        .filter(r => r.Mahsulot_ID === id)
        .map(r => {
          const s = sotuvMap[r.Sotuv_ID];
          if (!s?.Sana) return null;
          return {
            id: r.Savat_ID || Math.random().toString(),
            sana: s.Sana,
            vaqt: "",
            manba: getMijozNomi(s) || "Mijoz",
            manbaType: "mijoz" as const,
            izoh: "Sotuv ($)",
            kirim: 0,
            chiqim: num(r.Soni),
            sortKey: s.Sana.split(".").reverse().join(""),
            valyuta: "dollar" as const,
            linkId: r.Sotuv_ID,
            linkType: "sotuv" as const,
            narxSom: 0,
            narxDollar: num(r.Narx),
            summaSom: 0,
            summaDollar: num(r.Summa),
          };
        })
        .filter(Boolean) as TxRow[];

      const all = [...kirimTx, ...chiqimSom, ...chiqimDollar]
        .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
      setTxAll(all);

      // O'rtacha sotuv narxi
      const somRows = (ssRes.data as SotuvSavatRow[]).filter(r => r.Mahsulot_ID === id && num(r.Soni) > 0 && num(r.Som_Narx) > 0);
      const usdRows = (ssdRes.data as SotuvSavatDollarRow[]).filter(r => r.Mahsulot_ID === id && num(r.Soni) > 0 && num(r.Narx) > 0);
      const totalSomKg  = somRows.reduce((s, r) => s + num(r.Soni), 0);
      const totalSomSum = somRows.reduce((s, r) => s + num(r.Soni) * num(r.Som_Narx), 0);
      const totalUsdKg  = usdRows.reduce((s, r) => s + num(r.Soni), 0);
      const totalUsdSum = usdRows.reduce((s, r) => s + num(r.Soni) * num(r.Narx), 0);
      setAvgSotuvSom(totalSomKg > 0 ? totalSomSum / totalSomKg : 0);
      setAvgSotuvUsd(totalUsdKg > 0 ? totalUsdSum / totalUsdKg : 0);
      setLoading(false);
    }).catch(() => {
      // Xato bo'lsa ham sahifa abadiy "loading"da qolmasin (kirib bo'lmay qolmasin)
      setLoading(false);
    });
  }, [id]);

  async function saveField(field: PriceField) {
    if (!mahsulot) return;
    setSaving(field);
    const updated = { ...mahsulot, [field]: prices[field] };
    try {
      await fetch("/api/sheets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet: "Mahsulot", idColumn: "Mahsulot_ID", idValue: mahsulot.Mahsulot_ID, row: updated }),
      });
      afterWrite("Mahsulot");
      setMahsulot(updated);
    } finally { setSaving(null); }
  }

  if (loading) return (
    <div className="page-content" style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
      <div className="spinner--page"/>
    </div>
  );
  if (!mahsulot) return (
    <div className="page-content">
      <div className="empty">
        <div className="empty__icon">📦</div>
        <p className="empty__title">Mahsulot topilmadi</p>
        <button className="btn btn--outline" onClick={() => router.back()}>← Orqaga</button>
      </div>
    </div>
  );

  const turTabs = ["Barchasi", "Kirim", "Chiqim"];

  const inRangeTx = txAll.filter(t => inRange(t.sana, dateFrom, dateTo));
  const filtered = activeTur === "Barchasi" ? inRangeTx
    : activeTur === "Kirim"  ? inRangeTx.filter(t => t.kirim > 0)
    : inRangeTx.filter(t => t.chiqim > 0);

  const davrKirim  = inRangeTx.reduce((s, t) => s + t.kirim, 0);
  const davrChiqim = inRangeTx.reduce((s, t) => s + t.chiqim, 0);
  const davrSof    = davrKirim - davrChiqim;
  const joriyBalans = txAll.reduce((s, t) => s + t.kirim - t.chiqim, 0);

  // Running balance (oldest→newest, then display newest on top)
  let running = 0;
  const withBalance = [...txAll]
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map(t => {
      running += t.kirim - t.chiqim;
      return { ...t, balans: running };
    })
    .reverse();

  const qLower = q.trim().toLowerCase();
  const filteredWithBalance = withBalance.filter(t => {
    if (!inRange(t.sana, dateFrom, dateTo)) return false;
    if (activeTur === "Kirim"  && t.kirim  === 0) return false;
    if (activeTur === "Chiqim" && t.chiqim === 0) return false;
    if (qLower) {
      // Matn (mijoz nomi, izoh, sana) yoki raqam (summa, narx — bo'shliqlarsiz) bo'yicha
      const textHay = `${t.manba} ${t.izoh} ${t.sana}`.toLowerCase();
      const qDigits = qLower.replace(/\D/g, "");
      const nums = [t.summaSom, t.summaDollar, t.narxSom, t.narxDollar, t.kirim, t.chiqim].map(n => String(Math.round(n)));
      const textOk = textHay.includes(qLower);
      const numOk = qDigits.length > 0 && nums.some(n => n.includes(qDigits));
      if (!textOk && !numOk) return false;
    }
    return true;
  });

  const sofColor = davrSof >= 0 ? "var(--primary)" : "#ef4444";

  return (
    <>
      <header className="header">
        <div className="header__inner" style={{ gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => router.back()} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
            border: "1px solid var(--border)", borderRadius: "var(--radius)",
            background: "var(--white)", cursor: "pointer", fontSize: 13,
            fontWeight: 600, color: "var(--text-2)", flexShrink: 0,
          }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
            Orqaga
          </button>

          <h1 style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", whiteSpace: "nowrap", flexShrink: 0 }}>
            {mahsulot.Nomi}
          </h1>

          <div style={{ display: "flex", alignItems: "center", background: "var(--bg)", borderRadius: "var(--radius)", padding: 3, gap: 2, flexShrink: 0 }}>
            {turTabs.map(t => (
              <button key={t} onClick={() => setActiveTur(t)} style={{
                padding: "5px 12px", borderRadius: "calc(var(--radius) - 2px)",
                border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                background: activeTur === t ? "var(--white)" : "transparent",
                color: activeTur === t ? "var(--primary)" : "var(--text-3)",
                boxShadow: activeTur === t ? "var(--shadow-sm)" : "none",
                transition: "all .15s", whiteSpace: "nowrap",
              }}>
                {t}
              </button>
            ))}
          </div>

          <div style={{ flex: 1 }}/>

          <div style={{ position: "relative", flexShrink: 0 }}>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Qidirish (mijoz, izoh, narx)..."
              style={{ fontSize: 12, border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "6px 26px 6px 28px", background: "var(--white)", color: "var(--text)", width: 200, maxWidth: "42vw", outline: "none" }}/>
            <svg width="13" height="13" fill="none" stroke="var(--text-3)" viewBox="0 0 24 24" style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)" }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            {q && <button onClick={() => setQ("")} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", color: "var(--text-3)", display: "flex", padding: 0 }}>
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              style={{ fontSize: 12, border: "1px solid var(--border)", borderRadius: "var(--radius)",
                padding: "5px 8px", background: "var(--white)", color: "var(--text)", cursor: "pointer" }}/>
            <span style={{ color: "var(--text-3)", fontSize: 13 }}>—</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              style={{ fontSize: 12, border: "1px solid var(--border)", borderRadius: "var(--radius)",
                padding: "5px 8px", background: "var(--white)", color: "var(--text)", cursor: "pointer" }}/>
          </div>
        </div>
      </header>

      <div className="page-content">

        {/* Mahsulot kartasi */}
        <div style={{
          background: "var(--white)", borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-sm)", overflow: "hidden",
          display: "flex", gap: 0, marginBottom: 20,
        }}>
          <div style={{
            width: 120, minHeight: 120, flexShrink: 0, background: "var(--bg)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {!imgErr && mahsulot.Rasm
              ? <img src={`/api/image?path=${encodeURIComponent(mahsulot.Rasm)}`}
                  alt={mahsulot.Nomi} onError={() => setImgErr(true)}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontSize: 40 }}>📦</span>}
          </div>
          <div style={{ flex: 1, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{mahsulot.Nomi}</h2>
            {([
              { field: "Sotuv_som"    as PriceField, label: "Sotuv (so'm)", blue: false, show: true },
              { field: "Tan_som"      as PriceField, label: "Tan (so'm)",   blue: false, show: num(mahsulot.Tan_som) > 0 },
              { field: "Sotuv_dollar" as PriceField, label: "Sotuv ($)",    blue: true,  show: true },
              { field: "Tan_dollar"   as PriceField, label: "Tan ($)",      blue: true,  show: num(mahsulot.Tan_dollar) > 0 },
            ].filter(r => r.show)).map(({ field, label, blue }) => (
              <div key={field} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", flexShrink: 0 }}>{label}</span>
                <div style={{ position: "relative" }}>
                  <input
                    value={prices[field]}
                    onChange={e => setPrices(p => ({ ...p, [field]: e.target.value }))}
                    onKeyDown={e => { if (e.key === "Enter") saveField(field); }}
                    onBlur={() => saveField(field)}
                    style={{
                      width: 130, padding: "5px 10px", borderRadius: 8,
                      border: "1.5px solid var(--border)", outline: "none",
                      fontSize: 13, fontWeight: 700, textAlign: "right",
                      background: "var(--bg)", color: blue ? "#2563eb" : "var(--text)",
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = blue ? "#2563eb" : "var(--primary)"; e.currentTarget.style.background = "var(--white)"; }}
                    onBlurCapture={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--bg)"; }}
                  />
                  {saving === field && (
                    <span style={{ position: "absolute", right: -22, top: "50%", transform: "translateY(-50%)" }}>
                      <span className="spinner" style={{ width: 13, height: 13, borderColor: "rgba(0,0,0,.1)", borderTopColor: "var(--primary)" }} />
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Moliyaviy natijalar + Summary cards */}
        {(() => {
          const olindiDollar  = txAll.filter(t => t.linkType === "xarid").reduce((s, t) => s + t.summaDollar, 0);
          const sotildiDollar = txAll.filter(t => t.linkType === "sotuv").reduce((s, t) => s + t.summaDollar, 0);
          const farqDollar    = sotildiDollar - olindiDollar;
          const olindiSom     = txAll.filter(t => t.linkType === "xarid").reduce((s, t) => s + t.summaSom, 0);
          const sotildiSom    = txAll.filter(t => t.linkType === "sotuv").reduce((s, t) => s + t.summaSom, 0);
          const farqSom       = sotildiSom - olindiSom;
          const fc = (v: number) => v.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          const fs = (v: number) => v.toLocaleString("ru-RU", { maximumFractionDigits: 0 });

          const kirimCount  = txAll.filter(t => t.linkType === "xarid").length;
          const chiqimCount = txAll.filter(t => t.linkType === "sotuv").length;

          const Card = ({ label, value, sub, color, bg, border }: { label: string; value: string; sub?: string; color: string; bg: string; border?: string }) => (
            <div style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", border: border || "1px solid var(--border)", padding: isMobile ? "11px 12px" : "16px 20px", minWidth: 0 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".06em", marginBottom: 8 }}>{label}</p>
              <p style={{ fontSize: isMobile ? 14 : 17, fontWeight: 800, color, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis" }}>{value}</p>
              {sub && <p style={{ fontSize: isMobile ? 10 : 11, color: "var(--text-3)", marginTop: 4, fontWeight: 600 }}>{sub}</p>}
            </div>
          );

          return (
            <>
              {/* Dollar + So'm olindi/sotildi — 2 ustunli */}
              {(olindiDollar > 0 || sotildiDollar > 0 || olindiSom > 0 || sotildiSom > 0) && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: isMobile ? 8 : 12, marginBottom: 12 }}>
                  {olindiDollar > 0  && <Card label="OLINDI ($)"    value={`$${fc(olindiDollar)}`}   color="#16a34a" bg="#dcfce7" />}
                  {sotildiDollar > 0 && <Card label="SOTILDI ($)"   value={`$${fc(sotildiDollar)}`}  color="#2563eb" bg="#dbeafe" />}
                  {olindiSom > 0     && <Card label="OLINDI (SO'M)" value={`${fs(olindiSom)} so'm`}  color="#16a34a" bg="#dcfce7" />}
                  {sotildiSom > 0    && <Card label="SOTILDI (SO'M)"value={`${fs(sotildiSom)} so'm`} color="#2563eb" bg="#dbeafe" />}
                </div>
              )}
              {/* KG cards — 3 ustunli */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: isMobile ? 8 : 12, marginBottom: isMobile ? 16 : 24 }}>
                <Card label="KIRIM"       value={`+${fmtNum(davrKirim)} kg`}  sub={`${kirimCount} ta operatsiya`}  color="#16a34a" bg="#dcfce7" />
                <Card label="CHIQIM"      value={`-${fmtNum(davrChiqim)} kg`} sub={`${chiqimCount} ta operatsiya`} color="#ef4444" bg="#fee2e2" />
                <Card label="HOZIRDA BOR" value={`${fmtNum(joriyBalans)} kg`} color={joriyBalans >= 0 ? "var(--primary)" : "#ef4444"} bg={joriyBalans >= 0 ? "#dcfce7" : "#fee2e2"} border={`2px solid ${joriyBalans >= 0 ? "var(--primary)" : "#ef4444"}`} />
              </div>

              {/* Narx jadvali */}
              <div style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)", overflow: "hidden", marginBottom: 24 }}>
                <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
                  <p style={{ fontSize: 14, fontWeight: 700 }}>Narxlar tarixi</p>
                </div>
                {isMobile ? (
                  <div>
                    {filteredWithBalance.map((tx, i) => {
                      const isDollar = tx.narxDollar > 0 && tx.narxSom === 0;
                      const narx = isDollar ? `$${tx.narxDollar.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2})}` : tx.narxSom > 0 ? tx.narxSom.toLocaleString("ru-RU") + " so'm" : "—";
                      return (
                        <div key={tx.id + i} onClick={() => router.push(`/${tx.linkType}/${tx.linkId}`)}
                          style={{ padding: "12px 16px", borderBottom: i < withBalance.length - 1 ? "1px solid var(--border)" : "none", cursor: "pointer" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 700 }}>{tx.sana}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: tx.linkType === "xarid" ? "#dcfce7" : "#fee2e2", color: tx.linkType === "xarid" ? "#16a34a" : "#ef4444" }}>{tx.linkType === "xarid" ? "Kirim" : "Chiqim"}</span>
                          </div>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: tx.manbaType === "taminotchi" ? "#2563eb" : "#7c3aed", marginBottom: 8 }}>{tx.manba}</div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: tx.linkType === "xarid" ? "#16a34a" : "#ef4444" }}>{tx.linkType === "xarid" ? "+" : "-"}{fmtNum(tx.kirim || tx.chiqim)} kg</span>
                            <span style={{ fontSize: 12.5, fontWeight: 600, color: isDollar ? "#2563eb" : "var(--text)" }}>{narx}</span>
                            <span style={{ fontSize: 12.5, fontWeight: 800, color: tx.balans >= 0 ? "var(--text)" : "#ef4444" }}>Qoldiq: {fmtNum(tx.balans)} kg</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "var(--bg)" }}>
                        {["SANA","MIJOZ","TURI","MIQDOR","NARXI","HOZIRDA BOR"].map(h => (
                          <th key={h} style={{ padding: "9px 14px", fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".05em", textAlign: "left", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredWithBalance.map((tx, i) => {
                        const isDollar  = tx.narxDollar > 0 && tx.narxSom === 0;
                        const narx      = isDollar ? `$${tx.narxDollar.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2})}` : tx.narxSom > 0 ? tx.narxSom.toLocaleString("ru-RU") + " so'm" : "—";
                        const narxColor = isDollar ? "#2563eb" : "var(--text)";
                        const balColor  = tx.balans >= 0 ? "var(--text)" : "#ef4444";
                        return (
                          <tr key={tx.id + i} style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                            onClick={() => router.push(`/${tx.linkType}/${tx.linkId}`)}
                            onMouseEnter={e => (e.currentTarget.style.background = "var(--bg)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                            <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{tx.sana}</td>
                            <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: tx.manbaType === "taminotchi" ? "#2563eb" : "#7c3aed" }}>{tx.manba}</td>
                            <td style={{ padding: "10px 14px" }}>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: tx.linkType === "xarid" ? "#dcfce7" : "#fee2e2", color: tx.linkType === "xarid" ? "#16a34a" : "#ef4444" }}>
                                {tx.linkType === "xarid" ? "Kirim" : "Chiqim"}
                              </span>
                            </td>
                            <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 700, color: tx.linkType === "xarid" ? "#16a34a" : "#ef4444" }}>
                              {tx.linkType === "xarid" ? "+" : "-"}{fmtNum(tx.kirim || tx.chiqim)} kg
                            </td>
                            <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: narxColor }}>{narx}</td>
                            <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 800, color: balColor }}>{fmtNum(tx.balans)} kg</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                )}
              </div>
            </>
          );
        })()}

        {/* Table */}
        <div style={{
          background: "var(--white)", borderRadius: "var(--radius-xl)",
          border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)", overflow: "hidden",
        }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
              Harakatlar ({filteredWithBalance.length} ta)
            </p>
          </div>

          {filteredWithBalance.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center" }}>
              <p style={{ fontSize: 14, color: "var(--text-3)" }}>Ma&apos;lumot topilmadi</p>
            </div>
          ) : isMobile ? (
            <div>
              {filteredWithBalance.map((tx, i) => (
                <div key={tx.id + i} onClick={() => router.push(`/${tx.linkType}/${tx.linkId}`)}
                  style={{ padding: "12px 16px", borderBottom: i < filteredWithBalance.length - 1 ? "1px solid var(--border)" : "none", cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 5 }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700 }}>{tx.sana}</p>
                      {tx.vaqt && <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 1 }}>{tx.vaqt}</p>}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: tx.kirim > 0 ? "#16a34a" : "#ef4444", whiteSpace: "nowrap" }}>{tx.kirim > 0 ? `+${fmtNum(tx.kirim)}` : `-${fmtNum(tx.chiqim)}`} kg</span>
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: tx.manbaType === "taminotchi" ? "#2563eb" : "#7c3aed" }}>{tx.manba}</div>
                  {tx.izoh && <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 3 }}>{tx.izoh}</div>}
                  <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 5 }}>Balans: <b style={{ color: tx.balans >= 0 ? "var(--text)" : "#ef4444" }}>{fmtNum(tx.balans)} kg</b></div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--bg)" }}>
                    {["SANA", "MIJOZ", "IZOH"].map(h => (
                      <th key={h} style={{
                        padding: "10px 16px", fontSize: 10, fontWeight: 700,
                        color: "var(--text-3)", letterSpacing: ".06em", textAlign: "left",
                        borderBottom: "1px solid var(--border)", whiteSpace: "nowrap",
                      }}>{h}</th>
                    ))}
                    <th style={{ padding: "10px 16px", fontSize: 10, fontWeight: 700,
                      color: "#16a34a", letterSpacing: ".06em", textAlign: "right",
                      borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>
                      KIRIM
                      <span style={{ marginLeft: 5, background: "#dcfce7", color: "#16a34a", borderRadius: 20, padding: "1px 7px", fontSize: 10, fontWeight: 800 }}>
                        {filteredWithBalance.filter(t => t.kirim > 0).length}
                      </span>
                    </th>
                    <th style={{ padding: "10px 16px", fontSize: 10, fontWeight: 700,
                      color: "#ef4444", letterSpacing: ".06em", textAlign: "right",
                      borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>
                      CHIQIM
                      <span style={{ marginLeft: 5, background: "#fee2e2", color: "#ef4444", borderRadius: 20, padding: "1px 7px", fontSize: 10, fontWeight: 800 }}>
                        {filteredWithBalance.filter(t => t.chiqim > 0).length}
                      </span>
                    </th>
                    <th style={{ padding: "10px 16px", fontSize: 10, fontWeight: 700,
                      color: "var(--text-3)", letterSpacing: ".06em", textAlign: "right",
                      borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>BALANS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWithBalance.map((tx, i) => (
                    <tr key={tx.id + i}
                      onClick={() => router.push(`/${tx.linkType}/${tx.linkId}`)}
                      style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--bg)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                      <td style={{ padding: "10px 16px", whiteSpace: "nowrap" }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{tx.sana}</p>
                        {tx.vaqt && <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{tx.vaqt}</p>}
                      </td>
                      <td style={{ padding: "10px 16px" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: tx.manbaType === "taminotchi" ? "#2563eb" : "#7c3aed" }}>
                          {tx.manba}
                        </span>
                      </td>
                      <td style={{ padding: "10px 16px", fontSize: 13, color: "var(--text-2)" }}>
                        {tx.izoh || "—"}
                      </td>
                      <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 700,
                        color: "#16a34a", textAlign: "right", whiteSpace: "nowrap" }}>
                        {tx.kirim > 0 ? `+${fmtNum(tx.kirim)} kg` : "—"}
                      </td>
                      <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 700,
                        color: "#ef4444", textAlign: "right", whiteSpace: "nowrap" }}>
                        {tx.chiqim > 0 ? `-${fmtNum(tx.chiqim)} kg` : "—"}
                      </td>
                      <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 800,
                        color: tx.balans >= 0 ? "var(--text)" : "#ef4444", textAlign: "right", whiteSpace: "nowrap" }}>
                        {fmtNum(tx.balans)} kg
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>


    </>
  );
}
