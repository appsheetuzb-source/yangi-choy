"use client";
import { fetchSheets } from "@/lib/sheet-cache";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";

/* ── Interfaces ────────────────────────────────── */
interface Sotuv { Sotuv_ID: string; Yil: string; Oy: string; Sana: string; Mijoz_ID: string; Status: string; }
interface SotuvSavat { Savat_ID: string; Sotuv_ID: string; Mahsulot_ID: string; Soni: string; Som_Narx: string; Summa_som: string; }
interface SotuvSavatDollar { Savat_ID: string; Sotuv_ID: string; Mahsulot_ID: string; Soni: string; Narx: string; Summa: string; }
interface STolov { Tolov_ID: string; Sotuv_ID: string; Mijoz_ID: string; Yil: string; Oy: string; Sana: string; Valyuta: string; Summa: string; Summa_dollar: string; }
interface Xarid { Xarid_ID: string; Yil: string; Oy: string; Sana: string; Taminotchi_ID: string; }
interface XaridSavat { X_Savat: string; Xarid_ID: string; Mahsulot_ID: string; Soni: string; Narx_som: string; Narxi: string; Summa_Som: string; }
interface Mahsulot { Mahsulot_ID: string; Nomi: string; Tan_som: string; Tan_dollar: string; }
interface Mijoz { Mijoz_ID: string; Ism: string; }
interface Taminotchi { Taminotchi_ID: string; Ism: string; }

type Tab = "dashboard" | "tolovlar" | "xaridlar" | "sotuvlar" | "mijozlar" | "mahsulotlar";

const OY = ["Yan","Fev","Mar","Apr","May","Iyn","Iyl","Avg","Sen","Okt","Noy","Dek"];
const OY_FULL = ["Yanvar","Fevral","Mart","Aprel","May","Iyun","Iyul","Avgust","Sentabr","Oktabr","Noyabr","Dekabr"];
const COLORS = ["#16a34a","#2563eb","#7c3aed","#d97706","#ef4444","#0891b2","#c026d3","#65a30d","#ea580c","#475569"];

function num(v: string | number | undefined) {
  return parseFloat(String(v || "0").replace(/\s/g, "").replace(",", ".")) || 0;
}
function fmtS(v: number) { return v ? v.toLocaleString("ru-RU") : "0"; }
function fmtU(v: number) { return v ? "$" + v.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "$0,00"; }
function pct(a: number, b: number) {
  if (!b) return null;
  const p = ((a - b) / b) * 100;
  return p;
}

/* ── Custom Tooltip ─────────────────────────────── */
interface TipPayload { color?: string; name?: string | number; value?: string | number; }
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: TipPayload[]; label?: string | number }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", boxShadow: "0 4px 20px rgba(0,0,0,.12)" }}>
      <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: "var(--text)" }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ fontSize: 12, color: p.color, fontWeight: 600 }}>
          {p.name}: {typeof p.value === "number" && p.value > 1000 ? fmtS(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

/* ── KPI Card ────────────────────────────────────── */
function KpiCard({ label, value, sub, color, icon, onClick }: { label: string; value: string; sub?: string; color: string; icon: React.ReactNode; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{
      background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)",
      border: "1px solid var(--border)", padding: "18px 20px",
      cursor: onClick ? "pointer" : "default",
      transition: "box-shadow .15s",
    }}
    onMouseEnter={e => { if (onClick) e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,.1)"; }}
    onMouseLeave={e => { e.currentTarget.style.boxShadow = "var(--shadow-sm)"; }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".06em" }}>{label}</span>
        <span style={{ width: 32, height: 32, borderRadius: 8, background: color + "20", display: "flex", alignItems: "center", justifyContent: "center", color }}>{icon}</span>
      </div>
      <p style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4, fontWeight: 600 }}>{sub}</p>}
    </div>
  );
}

/* ── Section wrapper ─────────────────────────────── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border)", overflow: "hidden", marginBottom: 20 }}>
      <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{title}</p>
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

/* ── Change badge ────────────────────────────────── */
function ChangeBadge({ value }: { value: number | null }) {
  if (value === null) return <span style={{ color: "var(--text-3)", fontSize: 11 }}>—</span>;
  const pos = value >= 0;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
      background: pos ? "#dcfce7" : "#fee2e2", color: pos ? "#16a34a" : "#ef4444" }}>
      {pos ? "+" : ""}{value.toFixed(1)}%
    </span>
  );
}

/* ════════════════════════════════════════════════ */
export default function StatistikaPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [loading, setLoading] = useState(true);

  // Raw data
  const [sotuvlar, setSotuvlar]       = useState<Sotuv[]>([]);
  const [savat, setSavat]             = useState<SotuvSavat[]>([]);
  const [savatD, setSavatD]           = useState<SotuvSavatDollar[]>([]);
  const [tolovlar, setTolovlar]       = useState<STolov[]>([]);
  const [xaridlar, setXaridlar]       = useState<Xarid[]>([]);
  const [xSavat, setXSavat]           = useState<XaridSavat[]>([]);
  const [mahsulotlar, setMahsulotlar] = useState<Mahsulot[]>([]);
  const [mijozlar, setMijozlar]       = useState<Mijoz[]>([]);
  const [taminotchilar, setTaminotchilar] = useState<Taminotchi[]>([]);

  // Filters
  const [yil, setYil]   = useState<string>("");
  const [oy, setOy]     = useState<string>("0"); // "0" = barchasi
  const [currency, setCurrency] = useState<"som" | "dollar">("som");

  useEffect(() => {
    fetchSheets(["Sotuv","Sotuv_Savat","Sotuv_Savat_Dollar","S_tolov","Xarid","Xarid_Savat","Mahsulot","Mijozlar","Taminotchi"])
    .then(r => {
      setSotuvlar(r["Sotuv"]?.data || []);
      setSavat(r["Sotuv_Savat"]?.data || []);
      setSavatD(r["Sotuv_Savat_Dollar"]?.data || []);
      setTolovlar(r["S_tolov"]?.data || []);
      setXaridlar(r["Xarid"]?.data || []);
      setXSavat(r["Xarid_Savat"]?.data || []);
      setMahsulotlar(r["Mahsulot"]?.data || []);
      setMijozlar(r["Mijozlar"]?.data || []);
      setTaminotchilar(r["Taminotchi"]?.data || []);
    }).finally(() => setLoading(false));
  }, []);

  // Available years
  const yillar = useMemo(() => {
    const set = new Set<string>();
    sotuvlar.forEach(s => { if (s.Yil) set.add(s.Yil); });
    xaridlar.forEach(x => { if (x.Yil) set.add(x.Yil); });
    return [...set].sort((a, b) => Number(b) - Number(a));
  }, [sotuvlar, xaridlar]);

  useEffect(() => {
    if (!yil && yillar.length > 0) setYil(yillar[0]);
  }, [yillar, yil]);

  // Lookups
  const mahsulotMap = useMemo(() => {
    const m: Record<string, Mahsulot> = {};
    mahsulotlar.forEach(x => { m[x.Mahsulot_ID] = x; });
    return m;
  }, [mahsulotlar]);

  const mijozMap = useMemo(() => {
    const m: Record<string, string> = {};
    mijozlar.forEach(x => { m[x.Mijoz_ID] = x.Ism; });
    return m;
  }, [mijozlar]);

  const taminotchiMap = useMemo(() => {
    const m: Record<string, string> = {};
    taminotchilar.forEach(x => { m[x.Taminotchi_ID] = x.Ism; });
    return m;
  }, [taminotchilar]);

  // Filter helpers
  function filterByYilOy<T extends { Yil?: string; Oy?: string; Sana?: string }>(list: T[]): T[] {
    return list.filter(r => {
      if (yil && r.Yil && r.Yil !== yil) return false;
      if (oy !== "0" && r.Oy && r.Oy !== oy) return false;
      return true;
    });
  }

  // Sotuv map: Sotuv_ID → Sotuv
  const sotuvMap = useMemo(() => {
    const m: Record<string, Sotuv> = {};
    sotuvlar.forEach(s => { m[s.Sotuv_ID] = s; });
    return m;
  }, [sotuvlar]);

  // Xarid map
  const xaridMap = useMemo(() => {
    const m: Record<string, Xarid> = {};
    xaridlar.forEach(x => { m[x.Xarid_ID] = x; });
    return m;
  }, [xaridlar]);

  /* ── Monthly aggregation ─────────────────────── */
  const monthlyData = useMemo(() => {
    const data: Record<string, {
      oy: string; oyNomi: string;
      sotuvSom: number; sotuvDollar: number;
      xaridSom: number; xaridDollar: number;
      tolovSom: number; tolovDollar: number;
      foydaSom: number; foydaDollar: number;
      sotuvSoni: number; xaridSoni: number;
    }> = {};

    for (let i = 1; i <= 12; i++) {
      const key = String(i);
      data[key] = { oy: key, oyNomi: OY[i - 1], sotuvSom: 0, sotuvDollar: 0, xaridSom: 0, xaridDollar: 0, tolovSom: 0, tolovDollar: 0, foydaSom: 0, foydaDollar: 0, sotuvSoni: 0, xaridSoni: 0 };
    }

    // Sotuv savat (som)
    savat.forEach(r => {
      const s = sotuvMap[r.Sotuv_ID];
      if (!s || (yil && s.Yil !== yil)) return;
      if (oy !== "0" && s.Oy !== oy) return;
      const o = s.Oy || "0";
      if (!data[o]) return;
      const summa = num(r.Summa_som);
      const mah = mahsulotMap[r.Mahsulot_ID];
      const tanSom = mah ? num(mah.Tan_som) * num(r.Soni) : 0;
      data[o].sotuvSom += summa;
      data[o].foydaSom += summa - tanSom;
      data[o].sotuvSoni++;
    });

    // Sotuv savat (dollar)
    savatD.forEach(r => {
      const s = sotuvMap[r.Sotuv_ID];
      if (!s || (yil && s.Yil !== yil)) return;
      if (oy !== "0" && s.Oy !== oy) return;
      const o = s.Oy || "0";
      if (!data[o]) return;
      const summa = num(r.Summa);
      const mah = mahsulotMap[r.Mahsulot_ID];
      const tanD = mah ? num(mah.Tan_dollar) * num(r.Soni) : 0;
      data[o].sotuvDollar += summa;
      data[o].foydaDollar += summa - tanD;
    });

    // Xarid savat
    xSavat.forEach(r => {
      const x = xaridMap[r.Xarid_ID];
      if (!x || (yil && x.Yil !== yil)) return;
      if (oy !== "0" && x.Oy !== oy) return;
      const o = x.Oy || "0";
      if (!data[o]) return;
      data[o].xaridSom += num(r.Summa_Som);
      data[o].xaridDollar += num(r.Narxi) * num(r.Soni);
      data[o].xaridSoni++;
    });

    // To'lov
    filterByYilOy(tolovlar).forEach(t => {
      const o = t.Oy || "0";
      if (!data[o]) return;
      data[o].tolovSom += num(t.Summa);
      data[o].tolovDollar += num(t.Summa_dollar);
    });

    return Object.values(data).filter(d => d.oy !== "0");
  }, [savat, savatD, xSavat, tolovlar, sotuvMap, xaridMap, mahsulotMap, yil, oy]);

  // Active month data (when single month selected)
  const activeMonth = oy !== "0" ? monthlyData.find(d => d.oy === oy) : null;

  // Totals
  const totals = useMemo(() => {
    const filtered = oy !== "0" ? monthlyData.filter(d => d.oy === oy) : monthlyData;
    return filtered.reduce((acc, d) => ({
      sotuvSom:    acc.sotuvSom    + d.sotuvSom,
      sotuvDollar: acc.sotuvDollar + d.sotuvDollar,
      xaridSom:    acc.xaridSom    + d.xaridSom,
      xaridDollar: acc.xaridDollar + d.xaridDollar,
      tolovSom:    acc.tolovSom    + d.tolovSom,
      tolovDollar: acc.tolovDollar + d.tolovDollar,
      foydaSom:    acc.foydaSom    + d.foydaSom,
      foydaDollar: acc.foydaDollar + d.foydaDollar,
      sotuvSoni:   acc.sotuvSoni   + d.sotuvSoni,
      xaridSoni:   acc.xaridSoni   + d.xaridSoni,
    }), { sotuvSom: 0, sotuvDollar: 0, xaridSom: 0, xaridDollar: 0, tolovSom: 0, tolovDollar: 0, foydaSom: 0, foydaDollar: 0, sotuvSoni: 0, xaridSoni: 0 });
  }, [monthlyData, oy]);

  // Top mahsulotlar
  const topMahsulotlar = useMemo(() => {
    const map: Record<string, { id: string; nomi: string; kg: number; somSumma: number; dollarSumma: number }> = {};
    savat.forEach(r => {
      const s = sotuvMap[r.Sotuv_ID];
      if (!s || (yil && s.Yil !== yil)) return;
      if (oy !== "0" && s.Oy !== oy) return;
      if (!map[r.Mahsulot_ID]) map[r.Mahsulot_ID] = { id: r.Mahsulot_ID, nomi: mahsulotMap[r.Mahsulot_ID]?.Nomi || r.Mahsulot_ID, kg: 0, somSumma: 0, dollarSumma: 0 };
      map[r.Mahsulot_ID].kg += num(r.Soni);
      map[r.Mahsulot_ID].somSumma += num(r.Summa_som);
    });
    savatD.forEach(r => {
      const s = sotuvMap[r.Sotuv_ID];
      if (!s || (yil && s.Yil !== yil)) return;
      if (oy !== "0" && s.Oy !== oy) return;
      if (!map[r.Mahsulot_ID]) map[r.Mahsulot_ID] = { id: r.Mahsulot_ID, nomi: mahsulotMap[r.Mahsulot_ID]?.Nomi || r.Mahsulot_ID, kg: 0, somSumma: 0, dollarSumma: 0 };
      map[r.Mahsulot_ID].kg += num(r.Soni);
      map[r.Mahsulot_ID].dollarSumma += num(r.Summa);
    });
    return Object.values(map).sort((a, b) => b.kg - a.kg).slice(0, 10);
  }, [savat, savatD, sotuvMap, mahsulotMap, yil, oy]);

  // Top mijozlar
  const topMijozlar = useMemo(() => {
    const map: Record<string, { id: string; ism: string; sotuvSoni: number; somSumma: number; dollarSumma: number }> = {};
    const filteredSotuvlar = filterByYilOy(sotuvlar);
    filteredSotuvlar.forEach(s => {
      const mId = s.Mijoz_ID;
      if (!mId) return;
      if (!map[mId]) map[mId] = { id: mId, ism: mijozMap[mId] || mId, sotuvSoni: 0, somSumma: 0, dollarSumma: 0 };
      map[mId].sotuvSoni++;
    });
    savat.forEach(r => {
      const s = sotuvMap[r.Sotuv_ID];
      if (!s || (yil && s.Yil !== yil)) return;
      if (oy !== "0" && s.Oy !== oy) return;
      const mId = s.Mijoz_ID; if (!mId || !map[mId]) return;
      map[mId].somSumma += num(r.Summa_som);
    });
    savatD.forEach(r => {
      const s = sotuvMap[r.Sotuv_ID];
      if (!s || (yil && s.Yil !== yil)) return;
      if (oy !== "0" && s.Oy !== oy) return;
      const mId = s.Mijoz_ID; if (!mId || !map[mId]) return;
      map[mId].dollarSumma += num(r.Summa);
    });
    return Object.values(map).sort((a, b) => (b.somSumma + b.dollarSumma * 12000) - (a.somSumma + a.dollarSumma * 12000)).slice(0, 10);
  }, [savat, savatD, sotuvlar, sotuvMap, mijozMap, yil, oy]);

  // Ta'minotchi bo'yicha xarid
  const taminotchiXarid = useMemo(() => {
    const map: Record<string, { id: string; ism: string; xaridSoni: number; somSumma: number }> = {};
    filterByYilOy(xaridlar).forEach(x => {
      const tId = x.Taminotchi_ID; if (!tId) return;
      if (!map[tId]) map[tId] = { id: tId, ism: taminotchiMap[tId] || tId, xaridSoni: 0, somSumma: 0 };
      map[tId].xaridSoni++;
    });
    xSavat.forEach(r => {
      const x = xaridMap[r.Xarid_ID];
      if (!x || (yil && x.Yil !== yil)) return;
      if (oy !== "0" && x.Oy !== oy) return;
      const tId = x.Taminotchi_ID; if (!tId || !map[tId]) return;
      map[tId].somSumma += num(r.Summa_Som);
    });
    return Object.values(map).sort((a, b) => b.somSumma - a.somSumma).slice(0, 8);
  }, [xaridlar, xSavat, xaridMap, taminotchiMap, yil, oy]);

  /* ── Monthly table with change % ───────────────── */
  const monthlyTableData = useMemo(() => {
    return monthlyData.map((d, i) => {
      const prev = i > 0 ? monthlyData[i - 1] : null;
      return {
        ...d,
        sotuvOsish:   prev ? pct(d.sotuvSom,    prev.sotuvSom)    : null,
        xaridOsish:   prev ? pct(d.xaridSom,    prev.xaridSom)    : null,
        foydaOsish:   prev ? pct(d.foydaSom,    prev.foydaSom)    : null,
        tolovOsish:   prev ? pct(d.tolovSom,    prev.tolovSom)    : null,
        sotuvDOsish:  prev ? pct(d.sotuvDollar, prev.sotuvDollar) : null,
        foydaDOsish:  prev ? pct(d.foydaDollar, prev.foydaDollar) : null,
      };
    }).filter(d => d.sotuvSom > 0 || d.xaridSom > 0 || d.tolovSom > 0 || d.sotuvDollar > 0);
  }, [monthlyData]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "dashboard",   label: "Dashboard" },
    { key: "tolovlar",    label: "To'lovlar" },
    { key: "xaridlar",   label: "Xaridlar" },
    { key: "sotuvlar",   label: "Sotuvlar" },
    { key: "mijozlar",   label: "Mijozlar" },
    { key: "mahsulotlar", label: "Mahsulotlar" },
  ];

  const chartData = oy !== "0"
    ? monthlyData.filter(d => d.oy === oy)
    : monthlyData.filter(d => d.sotuvSom > 0 || d.xaridSom > 0 || d.sotuvDollar > 0);

  if (loading) return (
    <div className="page-content" style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
      <div className="spinner--page" />
    </div>
  );

  return (
    <>
      {/* Header */}
      <header className="header">
        <div className="header__inner" style={{ gap: 10, flexWrap: "wrap" }}>
          <h1 className="header__title">Statistika</h1>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 2, background: "var(--bg)", borderRadius: 10, padding: 3, border: "1px solid var(--border)" }}>
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                padding: "5px 12px", borderRadius: 7, border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
                background: tab === t.key ? "var(--white)" : "transparent",
                color: tab === t.key ? "var(--primary)" : "var(--text-3)",
                boxShadow: tab === t.key ? "var(--shadow-sm)" : "none",
                transition: "all .15s",
              }}>{t.label}</button>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          {/* Currency */}
          <div style={{ display: "flex", gap: 2, background: "var(--bg)", borderRadius: 10, padding: 3, border: "1px solid var(--border)" }}>
            {(["som", "dollar"] as const).map(c => (
              <button key={c} onClick={() => setCurrency(c)} style={{
                padding: "5px 12px", borderRadius: 7, border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 600,
                background: currency === c ? "var(--white)" : "transparent",
                color: currency === c ? "var(--primary)" : "var(--text-3)",
                boxShadow: currency === c ? "var(--shadow-sm)" : "none",
              }}>{c === "som" ? "So'm" : "$"}</button>
            ))}
          </div>

          {/* Yil */}
          <select value={yil} onChange={e => setYil(e.target.value)} style={{
            fontSize: 12, fontWeight: 700, border: "1px solid var(--border)", borderRadius: 8,
            padding: "6px 10px", background: "var(--white)", color: "var(--text)", cursor: "pointer",
          }}>
            {yillar.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </header>

      {/* Oy filter */}
      <div style={{ background: "var(--white)", borderBottom: "1px solid var(--border)", padding: "10px 20px" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[{ v: "0", l: "Barchasi" }, ...OY.map((o, i) => ({ v: String(i + 1), l: o }))].map(item => (
            <button key={item.v} onClick={() => setOy(item.v)} style={{
              padding: "4px 12px", borderRadius: 20, border: "1.5px solid",
              fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "all .12s",
              background: oy === item.v ? "var(--primary)" : "transparent",
              color:      oy === item.v ? "#fff"           : "var(--text-3)",
              borderColor: oy === item.v ? "var(--primary)" : "var(--border)",
            }}>{item.l}</button>
          ))}
        </div>
      </div>

      <div className="page-content">

        {/* ═══ DASHBOARD ════════════════════════════ */}
        {tab === "dashboard" && (
          <>
            {/* KPI */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, marginBottom: 20 }}>
              <KpiCard label="SOTUV (SO'M)" value={fmtS(totals.sotuvSom) + " so'm"} color="#16a34a"
                icon={<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>}
                onClick={() => router.push("/sotuv")} />
              <KpiCard label="SOTUV ($)" value={fmtU(totals.sotuvDollar)} color="#2563eb"
                icon={<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
                onClick={() => router.push("/sotuv")} />
              <KpiCard label="XARID (SO'M)" value={fmtS(totals.xaridSom) + " so'm"} color="#7c3aed"
                icon={<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>}
                onClick={() => router.push("/xarid")} />
              <KpiCard label="TO'LOV (SO'M)" value={fmtS(totals.tolovSom) + " so'm"} color="#d97706"
                icon={<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>}
                onClick={() => router.push("/sotuv/tolov")} />
              <KpiCard label="FOYDA (SO'M)" value={fmtS(totals.foydaSom) + " so'm"} color={totals.foydaSom >= 0 ? "#16a34a" : "#ef4444"}
                sub={`Dollar: ${fmtU(totals.foydaDollar)}`}
                icon={<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>} />
              <KpiCard label="TO'LOV ($)" value={fmtU(totals.tolovDollar)} color="#0891b2"
                icon={<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>}
                onClick={() => router.push("/sotuv/tolov")} />
            </div>

            {/* Sotuv vs Xarid chart */}
            <Section title={`Oylik sotuv & xarid — ${currency === "som" ? "So'm" : "Dollar"}`}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="oyNomi" tick={{ fontSize: 11, fill: "var(--text-3)" }} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--text-3)" }} tickFormatter={v => v >= 1e6 ? (v/1e6).toFixed(1)+"M" : v >= 1e3 ? (v/1e3).toFixed(0)+"K" : v} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {currency === "som" ? (
                    <>
                      <Bar dataKey="sotuvSom"  name="Sotuv (so'm)"  fill="#16a34a" radius={[4,4,0,0]} />
                      <Bar dataKey="xaridSom"  name="Xarid (so'm)"  fill="#7c3aed" radius={[4,4,0,0]} />
                    </>
                  ) : (
                    <>
                      <Bar dataKey="sotuvDollar" name="Sotuv ($)"  fill="#2563eb" radius={[4,4,0,0]} />
                      <Bar dataKey="xaridDollar" name="Xarid ($)"  fill="#7c3aed" radius={[4,4,0,0]} />
                    </>
                  )}
                </BarChart>
              </ResponsiveContainer>
            </Section>

            {/* Foyda trendi */}
            <Section title="Foyda trendi">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="oyNomi" tick={{ fontSize: 11, fill: "var(--text-3)" }} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--text-3)" }} tickFormatter={v => v >= 1e6 ? (v/1e6).toFixed(1)+"M" : v >= 1e3 ? (v/1e3).toFixed(0)+"K" : v} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {currency === "som"
                    ? <Line dataKey="foydaSom"    name="Foyda (so'm)" stroke="#16a34a" strokeWidth={2.5} dot={{ r: 4, fill: "#16a34a" }} />
                    : <Line dataKey="foydaDollar" name="Foyda ($)"    stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4, fill: "#2563eb" }} />
                  }
                </LineChart>
              </ResponsiveContainer>
            </Section>

            {/* Top 5 lists */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <Section title="Top 5 mahsulot (kg)">
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {topMahsulotlar.slice(0, 5).map((m, i) => (
                    <div key={m.id} onClick={() => router.push(`/mahsulot/${m.id}`)}
                      style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "6px 0" }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = ".8")}
                      onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
                      <span style={{ width: 22, height: 22, borderRadius: "50%", background: COLORS[i], color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{i+1}</span>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.nomi}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#16a34a" }}>{fmtS(m.kg)} kg</span>
                    </div>
                  ))}
                </div>
              </Section>
              <Section title="Top 5 mijoz (sotuv)">
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {topMijozlar.slice(0, 5).map((m, i) => (
                    <div key={m.id} onClick={() => router.push(`/mijozlar/${m.id}`)}
                      style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "6px 0" }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = ".8")}
                      onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
                      <span style={{ width: 22, height: 22, borderRadius: "50%", background: COLORS[i], color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{i+1}</span>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.ism}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#2563eb" }}>{m.sotuvSoni} ta</span>
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          </>
        )}

        {/* ═══ TO'LOVLAR ════════════════════════════ */}
        {tab === "tolovlar" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14, marginBottom: 20 }}>
              <KpiCard label="JAMI TO'LOV (SO'M)" value={fmtS(totals.tolovSom) + " so'm"} color="#d97706"
                icon={<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>}
                onClick={() => router.push("/sotuv/tolov")} />
              <KpiCard label="JAMI TO'LOV ($)" value={fmtU(totals.tolovDollar)} color="#0891b2"
                icon={<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>}
                onClick={() => router.push("/sotuv/tolov")} />
            </div>
            <Section title="Oylik to'lovlar">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="oyNomi" tick={{ fontSize: 11, fill: "var(--text-3)" }} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--text-3)" }} tickFormatter={v => v >= 1e6 ? (v/1e6).toFixed(1)+"M" : v >= 1e3 ? (v/1e3).toFixed(0)+"K" : v} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="tolovSom"    name="To'lov (so'm)" fill="#d97706" radius={[4,4,0,0]} />
                  <Bar dataKey="tolovDollar" name="To'lov ($)"    fill="#0891b2" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Section>
            <Section title="Oyma-oy to'lov jadvali">
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--bg)" }}>
                      {["OY","JAMI SO'M","O'SISH","JAMI $","O'SISH"].map(h => (
                        <th key={h} style={{ padding: "9px 14px", fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".05em", textAlign: "left", borderBottom: "1px solid var(--border)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyTableData.map((d, i) => (
                      <tr key={d.oy} onClick={() => router.push("/sotuv/tolov")}
                        style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--bg)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                        <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700 }}>{OY_FULL[Number(d.oy) - 1]}</td>
                        <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: "#d97706" }}>{fmtS(d.tolovSom)} so'm</td>
                        <td style={{ padding: "10px 14px" }}><ChangeBadge value={d.tolovOsish} /></td>
                        <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: "#0891b2" }}>{fmtU(d.tolovDollar)}</td>
                        <td style={{ padding: "10px 14px" }}><ChangeBadge value={d.sotuvDOsish} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          </>
        )}

        {/* ═══ XARIDLAR ════════════════════════════ */}
        {tab === "xaridlar" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14, marginBottom: 20 }}>
              <KpiCard label="JAMI XARID (SO'M)" value={fmtS(totals.xaridSom) + " so'm"} color="#7c3aed"
                icon={<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>}
                onClick={() => router.push("/xarid")} />
              <KpiCard label="XARID SONI" value={String(totals.xaridSoni) + " ta"} color="#7c3aed"
                icon={<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>}
                onClick={() => router.push("/xarid")} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 20 }}>
              <Section title="Oylik xaridlar">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="oyNomi" tick={{ fontSize: 11, fill: "var(--text-3)" }} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--text-3)" }} tickFormatter={v => v >= 1e6 ? (v/1e6).toFixed(1)+"M" : v >= 1e3 ? (v/1e3).toFixed(0)+"K" : v} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="xaridSom" name="Xarid (so'm)" fill="#7c3aed" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Section>
              <Section title="Ta'minotchi bo'yicha">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={taminotchiXarid} dataKey="somSumma" nameKey="ism" cx="50%" cy="50%" outerRadius={80} label={(p: { ism?: string; percent?: number }) => `${(p.ism||"").slice(0,8)} ${((p.percent||0) * 100).toFixed(0)}%`} labelLine={false}>
                      {taminotchiXarid.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmtS(Number(v)) + " so'm"} />
                  </PieChart>
                </ResponsiveContainer>
              </Section>
            </div>
            <Section title="Oyma-oy xarid jadvali">
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--bg)" }}>
                      {["OY","XARID SONI","JAMI SO'M","O'SISH"].map(h => (
                        <th key={h} style={{ padding: "9px 14px", fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".05em", textAlign: "left", borderBottom: "1px solid var(--border)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyTableData.map(d => (
                      <tr key={d.oy} onClick={() => router.push("/xarid")}
                        style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--bg)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                        <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700 }}>{OY_FULL[Number(d.oy) - 1]}</td>
                        <td style={{ padding: "10px 14px", fontSize: 13 }}>{d.xaridSoni} ta</td>
                        <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: "#7c3aed" }}>{fmtS(d.xaridSom)} so'm</td>
                        <td style={{ padding: "10px 14px" }}><ChangeBadge value={d.xaridOsish} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          </>
        )}

        {/* ═══ SOTUVLAR ════════════════════════════ */}
        {tab === "sotuvlar" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14, marginBottom: 20 }}>
              <KpiCard label="SOTUV (SO'M)" value={fmtS(totals.sotuvSom) + " so'm"} color="#16a34a"
                icon={<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>}
                onClick={() => router.push("/sotuv")} />
              <KpiCard label="SOTUV ($)" value={fmtU(totals.sotuvDollar)} color="#2563eb"
                icon={<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
                onClick={() => router.push("/sotuv")} />
              <KpiCard label="FOYDA (SO'M)" value={fmtS(totals.foydaSom) + " so'm"} color={totals.foydaSom >= 0 ? "#16a34a" : "#ef4444"}
                icon={<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>} />
              <KpiCard label="FOYDA ($)" value={fmtU(totals.foydaDollar)} color={totals.foydaDollar >= 0 ? "#16a34a" : "#ef4444"}
                icon={<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>} />
            </div>
            <Section title="Sotuv & Foyda trendi">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="oyNomi" tick={{ fontSize: 11, fill: "var(--text-3)" }} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--text-3)" }} tickFormatter={v => v >= 1e6 ? (v/1e6).toFixed(1)+"M" : v >= 1e3 ? (v/1e3).toFixed(0)+"K" : v} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {currency === "som" ? (
                    <>
                      <Bar dataKey="sotuvSom" name="Sotuv (so'm)" fill="#16a34a" radius={[4,4,0,0]} />
                      <Bar dataKey="foydaSom" name="Foyda (so'm)" fill="#86efac" radius={[4,4,0,0]} />
                    </>
                  ) : (
                    <>
                      <Bar dataKey="sotuvDollar" name="Sotuv ($)" fill="#2563eb" radius={[4,4,0,0]} />
                      <Bar dataKey="foydaDollar" name="Foyda ($)" fill="#93c5fd" radius={[4,4,0,0]} />
                    </>
                  )}
                </BarChart>
              </ResponsiveContainer>
            </Section>
            <Section title="Oyma-oy sotuv jadvali">
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--bg)" }}>
                      {["OY","SOTUV SO'M","O'SISH","FOYDA SO'M","O'SISH","SOTUV $","FOYDA $"].map(h => (
                        <th key={h} style={{ padding: "9px 14px", fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".05em", textAlign: "left", borderBottom: "1px solid var(--border)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyTableData.map(d => (
                      <tr key={d.oy} onClick={() => router.push("/sotuv")}
                        style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--bg)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                        <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700 }}>{OY_FULL[Number(d.oy) - 1]}</td>
                        <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: "#16a34a" }}>{fmtS(d.sotuvSom)} so'm</td>
                        <td style={{ padding: "10px 14px" }}><ChangeBadge value={d.sotuvOsish} /></td>
                        <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: d.foydaSom >= 0 ? "#16a34a" : "#ef4444" }}>{fmtS(d.foydaSom)} so'm</td>
                        <td style={{ padding: "10px 14px" }}><ChangeBadge value={d.foydaOsish} /></td>
                        <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: "#2563eb" }}>{fmtU(d.sotuvDollar)}</td>
                        <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: d.foydaDollar >= 0 ? "#16a34a" : "#ef4444" }}>{fmtU(d.foydaDollar)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          </>
        )}

        {/* ═══ MIJOZLAR ════════════════════════════ */}
        {tab === "mijozlar" && (
          <>
            <Section title={`Top ${topMijozlar.length} mijoz — sotuv bo'yicha`}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--bg)" }}>
                      {["#","MIJOZ","SOTUV SONI","JAMI SO'M","JAMI $"].map(h => (
                        <th key={h} style={{ padding: "9px 14px", fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".05em", textAlign: "left", borderBottom: "1px solid var(--border)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {topMijozlar.map((m, i) => (
                      <tr key={m.id} onClick={() => router.push(`/mijozlar/${m.id}`)}
                        style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--bg)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                        <td style={{ padding: "10px 14px" }}>
                          <span style={{ width: 24, height: 24, borderRadius: "50%", background: COLORS[i % COLORS.length], color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>{i+1}</span>
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: "#7c3aed" }}>{m.ism}</td>
                        <td style={{ padding: "10px 14px", fontSize: 13 }}>{m.sotuvSoni} ta</td>
                        <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: "#16a34a" }}>{fmtS(m.somSumma)} so'm</td>
                        <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: "#2563eb" }}>{fmtU(m.dollarSumma)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
            <Section title="Sotuv taqsimoti (top mijozlar)">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topMijozlar.slice(0, 8).map(m => ({ name: m.ism?.slice(0, 12) || "", som: m.somSumma, dollar: m.dollarSumma }))}
                  layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "var(--text-3)" }} tickFormatter={v => v >= 1e6 ? (v/1e6).toFixed(1)+"M" : v >= 1e3 ? (v/1e3).toFixed(0)+"K" : v} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "var(--text-2)" }} width={80} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="som" name="So'm" fill="#7c3aed" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Section>
          </>
        )}

        {/* ═══ MAHSULOTLAR ════════════════════════ */}
        {tab === "mahsulotlar" && (
          <>
            <Section title={`Top ${topMahsulotlar.length} sotilgan mahsulot (kg)`}>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={topMahsulotlar.map(m => ({ name: m.nomi?.slice(0, 14) || "", kg: m.kg, som: m.somSumma, dollar: m.dollarSumma }))}
                  layout="vertical" margin={{ top: 5, right: 20, left: 120, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "var(--text-3)" }} tickFormatter={v => fmtS(v)} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "var(--text-2)" }} width={120} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="kg" name="Kg" fill="#16a34a" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Section>
            <Section title="Mahsulotlar jadvali">
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--bg)" }}>
                      {["#","MAHSULOT","SOTILGAN (KG)","SOTUV SO'M","SOTUV $"].map(h => (
                        <th key={h} style={{ padding: "9px 14px", fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".05em", textAlign: "left", borderBottom: "1px solid var(--border)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {topMahsulotlar.map((m, i) => (
                      <tr key={m.id} onClick={() => router.push(`/mahsulot/${m.id}`)}
                        style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--bg)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                        <td style={{ padding: "10px 14px" }}>
                          <span style={{ width: 24, height: 24, borderRadius: "50%", background: COLORS[i % COLORS.length], color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>{i+1}</span>
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: "var(--primary)" }}>{m.nomi}</td>
                        <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: "#16a34a" }}>{fmtS(m.kg)} kg</td>
                        <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700 }}>{fmtS(m.somSumma)} so'm</td>
                        <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: "#2563eb" }}>{fmtU(m.dollarSumma)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          </>
        )}

      </div>
    </>
  );
}
