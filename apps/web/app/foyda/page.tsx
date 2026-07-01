"use client";
import { fetchSheets } from "@/lib/sheet-cache";
import { useEffect, useState, useCallback, useMemo } from "react";

interface Sotuv { Sotuv_ID: string; Mijoz_ID: string; Yil: string; Oy: string; Sana: string; Agent: string; }
interface SavatRow { Sotuv_ID: string; Mahsulot_ID: string; Soni: string; Summa_som: string; Kurs: string; }
interface SavatDollarRow { Sotuv_ID: string; Mahsulot_ID: string; Soni: string; Summa: string; Kurs: string; }
interface Mahsulot { Mahsulot_ID: string; Nomi: string; Tan_som: string; Tan_dollar: string; }
interface Mijoz { Mijoz_ID: string; Ism: string; }
interface KursRow { Kurs: string; }

function num(v: string | number | undefined) {
  return parseFloat(String(v || "0").replace(/\s/g, "").replace(",", ".")) || 0;
}
function fmtSom(v: number) { return Math.round(v).toLocaleString("ru-RU") + " so'm"; }
function fmtUsd(v: number) { return "$" + v.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

const OYLAR = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];

export default function FoydaPage() {
  const [sotuvlar, setSotuvlar]       = useState<Sotuv[]>([]);
  const [savatSom, setSavatSom]       = useState<SavatRow[]>([]);
  const [savatDollar, setSavatDollar] = useState<SavatDollarRow[]>([]);
  const [mahsulotlar, setMahsulotlar] = useState<Mahsulot[]>([]);
  const [mijozlar, setMijozlar]       = useState<Mijoz[]>([]);
  const [kurs, setKurs]               = useState(12800);
  const [loading, setLoading]         = useState(true);
  const [heavyReady, setHeavyReady]   = useState(false);
  const [isMobile, setIsMobile]       = useState(false);

  const now = new Date();
  const [yil, setYil] = useState(String(now.getFullYear()));
  const [oy, setOy]   = useState("0");   // "0" = butun yil
  const [selMijoz, setSelMijoz]   = useState<string | null>(null);
  const [qMijoz, setQMijoz]       = useState("");
  const [qMahsulot, setQMahsulot] = useState("");

  useEffect(() => {
    const c = () => setIsMobile(window.innerWidth < 768);
    c(); window.addEventListener("resize", c); return () => window.removeEventListener("resize", c);
  }, []);

  const loadData = useCallback(() => {
    setLoading(true);
    // Faza 1 — yengil
    fetchSheets(["Sotuv", "Mahsulot", "Mijozlar", "Kurs"]).then(r => {
      setSotuvlar(((r["Sotuv"]?.data) || []) as Sotuv[]);
      setMahsulotlar((((r["Mahsulot"]?.data) || []) as Mahsulot[]).filter(m => m.Nomi));
      setMijozlar(((r["Mijozlar"]?.data) || []) as Mijoz[]);
      const kA = (((r["Kurs"]?.data) || []) as KursRow[]).filter(k => num(k.Kurs) > 0);
      if (kA.length) setKurs(num(kA[kA.length - 1].Kurs));
    }).catch(() => {}).finally(() => setLoading(false));
    // Faza 2 — og'ir savat (qayta urinish bilan)
    const loadHeavy = (attempt: number) => {
      fetchSheets(["Sotuv_Savat", "Sotuv_savat_dollar"]).then(r => {
        const ss = r["Sotuv_Savat"], sd = r["Sotuv_savat_dollar"];
        if (!ss?.headers?.length || ss.error || !sd?.headers?.length || sd.error) throw new Error("heavy incomplete");
        setSavatSom((ss.data || []) as SavatRow[]);
        setSavatDollar((sd.data || []) as SavatDollarRow[]);
        setHeavyReady(true);
      }).catch(() => { if (attempt < 5) setTimeout(() => loadHeavy(attempt + 1), Math.min(1000 * Math.pow(2, attempt), 8000)); });
    };
    loadHeavy(0);
  }, []);
  useEffect(() => { loadData(); }, [loadData]);

  const mahMap = useMemo(() => { const m: Record<string, Mahsulot> = {}; mahsulotlar.forEach(x => { m[x.Mahsulot_ID] = x; }); return m; }, [mahsulotlar]);
  const mijozMap = useMemo(() => { const m: Record<string, string> = {}; mijozlar.forEach(x => { if (x.Mijoz_ID) m[x.Mijoz_ID] = x.Ism; }); return m; }, [mijozlar]);
  const sotuvMap = useMemo(() => { const m: Record<string, Sotuv> = {}; sotuvlar.forEach(s => { if (s.Sotuv_ID) m[s.Sotuv_ID] = s; }); return m; }, [sotuvlar]);

  const yillar = useMemo(() => {
    const set = new Set<string>();
    sotuvlar.forEach(s => { if (s.Yil) set.add(s.Yil); });
    return [...set].sort((a, b) => Number(b) - Number(a));
  }, [sotuvlar]);

  // ── Foyda hisobi (jonli): foyda = Summa − Tan × Soni ──
  const { clientProfit, productAll, clientProduct, jami } = useMemo(() => {
    const cp: Record<string, { som: number; usd: number }> = {};
    const pp: Record<string, { som: number; usd: number }> = {};
    const cpp: Record<string, Record<string, { som: number; usd: number }>> = {};
    const jami = { som: 0, usd: 0 };
    const inFilter = (s: Sotuv) => (!yil || s.Yil === yil) && (oy === "0" || String(parseInt(s.Oy || "0")) === oy);

    savatSom.forEach(r => {
      const s = sotuvMap[String(r.Sotuv_ID || "").trim()];
      if (!s || !inFilter(s)) return;
      const mah = mahMap[r.Mahsulot_ID];
      const rk = num(r.Kurs) || kurs;
      // Tan_som bo'sh bo'lsa — mahsulot dollarda olingan → tannarx = Tan_dollar × kurs
      const tanS = num(mah?.Tan_som) > 0 ? num(mah?.Tan_som) : num(mah?.Tan_dollar) * rk;
      const foyda = num(r.Summa_som) - tanS * num(r.Soni);
      const mid = s.Mijoz_ID || "—", pid = r.Mahsulot_ID || "—";
      (cp[mid] ||= { som: 0, usd: 0 }).som += foyda;
      (pp[pid] ||= { som: 0, usd: 0 }).som += foyda;
      ((cpp[mid] ||= {})[pid] ||= { som: 0, usd: 0 }).som += foyda;
      jami.som += foyda;
    });
    savatDollar.forEach(r => {
      const s = sotuvMap[String(r.Sotuv_ID || "").trim()];
      if (!s || !inFilter(s)) return;
      const mah = mahMap[r.Mahsulot_ID];
      const rk = num(r.Kurs) || kurs;
      // Tan_dollar bo'sh bo'lsa — mahsulot so'mda olingan → tannarx = Tan_som / kurs
      const tanD = num(mah?.Tan_dollar) > 0 ? num(mah?.Tan_dollar) : (rk > 0 ? num(mah?.Tan_som) / rk : 0);
      const foyda = num(r.Summa) - tanD * num(r.Soni);
      const mid = s.Mijoz_ID || "—", pid = r.Mahsulot_ID || "—";
      (cp[mid] ||= { som: 0, usd: 0 }).usd += foyda;
      (pp[pid] ||= { som: 0, usd: 0 }).usd += foyda;
      ((cpp[mid] ||= {})[pid] ||= { som: 0, usd: 0 }).usd += foyda;
      jami.usd += foyda;
    });
    return { clientProfit: cp, productAll: pp, clientProduct: cpp, jami };
  }, [savatSom, savatDollar, sotuvMap, mahMap, yil, oy, kurs]);

  const combined = (v: { som: number; usd: number }) => v.som + v.usd * kurs;

  const clientRows = useMemo(() => {
    return Object.entries(clientProfit)
      .map(([mid, v]) => ({ id: mid, name: mijozMap[mid] || (mid === "—" ? "—" : mid), ...v }))
      .filter(r => !qMijoz || r.name.toLowerCase().includes(qMijoz.toLowerCase()))
      .sort((a, b) => combined(b) - combined(a));
  }, [clientProfit, mijozMap, qMijoz, kurs]);

  // Tanlangan klient: bosilgan (selMijoz) YOKI qidiruv bitta klientga tushsa — o'sha
  const effMijoz = selMijoz || (qMijoz.trim() && clientRows.length === 1 ? clientRows[0].id : null);

  const productRows = useMemo(() => {
    const src = effMijoz ? (clientProduct[effMijoz] || {}) : productAll;
    return Object.entries(src)
      .map(([pid, v]) => ({ id: pid, name: mahMap[pid]?.Nomi || (pid === "—" ? "—" : pid), ...v }))
      .filter(r => !qMahsulot || r.name.toLowerCase().includes(qMahsulot.toLowerCase()))
      .sort((a, b) => combined(b) - combined(a));
  }, [effMijoz, clientProduct, productAll, mahMap, qMahsulot, kurs]);

  const selName = effMijoz ? (mijozMap[effMijoz] || effMijoz) : null;
  // JAMI kartalari: klient tanlangan bo'lsa o'sha klient foydasi, aks holda umumiy jami
  const displayJami = effMijoz ? (clientProfit[effMijoz] || { som: 0, usd: 0 }) : jami;

  // ── UI qismlari ──
  const ProfitCell = ({ som, usd }: { som: number; usd: number }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-end" }}>
      {som !== 0 && <span style={{ fontSize: 13, fontWeight: 800, color: som > 0 ? "#16a34a" : "#ef4444" }}>{fmtSom(som)}</span>}
      {usd !== 0 && <span style={{ fontSize: 13, fontWeight: 800, color: usd > 0 ? "#16a34a" : "#ef4444" }}>{fmtUsd(usd)}</span>}
      {som === 0 && usd === 0 && <span style={{ fontSize: 13, color: "var(--text-3)" }}>0</span>}
    </div>
  );

  const searchBox = (val: string, set: (v: string) => void, ph: string) => (
    <div className="search" style={{ marginBottom: 12 }}>
      <span className="search__icon"><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg></span>
      <input className="search__input" placeholder={ph} value={val} onChange={e => set(e.target.value)}/>
      {val && <button className="search__clear" onClick={() => set("")}><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>}
    </div>
  );

  return (
    <>
      <header className="header">
        <div className="header__inner">
          <div>
            <h1 className="header__title" style={{ paddingLeft: 4 }}>Foyda</h1>
            <p style={{ fontSize: 12.5, color: "var(--text-3)", paddingLeft: 4, marginTop: 2 }}>Klient va mahsulot bo&apos;yicha foyda</p>
          </div>
          <div className="header__spacer"/>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <select value={oy} onChange={e => setOy(e.target.value)} style={{ padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, fontWeight: 600, background: "var(--white)", cursor: "pointer", outline: "none" }}>
              <option value="0">Butun yil</option>
              {OYLAR.map((o, i) => <option key={i} value={String(i + 1)}>{o}</option>)}
            </select>
            <select value={yil} onChange={e => setYil(e.target.value)} style={{ padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, fontWeight: 600, background: "var(--white)", cursor: "pointer", outline: "none" }}>
              <option value="">Barcha yillar</option>
              {yillar.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </header>

      <div className="page-content">
        {loading && <div className="spinner--page"/>}

        {!loading && (
          <>
            {/* KPI — jami foyda */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
              <div style={{ flex: "1 1 240px", background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", padding: "16px 20px" }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".05em", marginBottom: 6 }}>{selName ? "TANLANGAN KLIENT FOYDA · SO'M" : "JAMI FOYDA · SO'M"}</p>
                <p style={{ fontSize: isMobile ? 20 : 24, fontWeight: 800, color: displayJami.som >= 0 ? "#16a34a" : "#ef4444" }}>{heavyReady ? fmtSom(displayJami.som) : "Yuklanmoqda…"}</p>
                {selName && <p style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selName}</p>}
              </div>
              <div style={{ flex: "1 1 240px", background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", padding: "16px 20px" }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".05em", marginBottom: 6 }}>{selName ? "TANLANGAN KLIENT FOYDA · DOLLAR" : "JAMI FOYDA · DOLLAR"}</p>
                <p style={{ fontSize: isMobile ? 20 : 24, fontWeight: 800, color: displayJami.usd >= 0 ? "#16a34a" : "#ef4444" }}>{heavyReady ? fmtUsd(displayJami.usd) : "Yuklanmoqda…"}</p>
                {selName && <p style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selName}</p>}
              </div>
            </div>

            {!heavyReady && <p style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 12 }}>Foyda ma&apos;lumoti yuklanmoqda…</p>}

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, alignItems: "start" }}>
              {/* ── Klient bo'yicha foyda ── */}
              <div style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
                  <p style={{ fontSize: 14, fontWeight: 700 }}>Klient bo&apos;yicha foyda</p>
                  <p style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>Klientni bosing yoki qidiring — o&apos;sha klientning mahsulotlari o&apos;ngda ko&apos;rinadi</p>
                </div>
                <div style={{ padding: "12px 18px 0" }}>{searchBox(qMijoz, setQMijoz, "Klient qidirish...")}</div>
                <div style={{ maxHeight: 520, overflowY: "auto" }}>
                  {clientRows.length === 0 ? (
                    <p style={{ padding: "20px 18px", fontSize: 13, color: "var(--text-3)", textAlign: "center" }}>{heavyReady ? "Ma'lumot yo'q" : "Yuklanmoqda…"}</p>
                  ) : clientRows.map((r, i) => {
                    const on = effMijoz === r.id;
                    return (
                    <div key={r.id} onClick={() => setSelMijoz(selMijoz === r.id ? null : r.id)}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 18px", borderBottom: i < clientRows.length - 1 ? "1px solid var(--border)" : "none", cursor: "pointer", background: on ? "var(--primary-glow)" : "transparent" }}
                      onMouseEnter={e => { if (!on) e.currentTarget.style.background = "#f8fafc"; }}
                      onMouseLeave={e => { if (!on) e.currentTarget.style.background = "transparent"; }}>
                      <span style={{ fontSize: 12, color: "var(--text-3)", width: 20, flexShrink: 0 }}>{i + 1}</span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: on ? 800 : 600, color: on ? "var(--primary)" : "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                      <ProfitCell som={r.som} usd={r.usd}/>
                    </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Mahsulot bo'yicha foyda ── */}
              <div style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 700 }}>Mahsulot bo&apos;yicha foyda</p>
                    <p style={{ fontSize: 11.5, color: selName ? "var(--primary)" : "var(--text-3)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selName ? `Klient: ${selName}` : "Barcha klientlar"}</p>
                  </div>
                  {selName && <button onClick={() => { setSelMijoz(null); setQMijoz(""); }} style={{ flexShrink: 0, padding: "6px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--white)", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>Barchasi</button>}
                </div>
                <div style={{ padding: "12px 18px 0" }}>{searchBox(qMahsulot, setQMahsulot, "Mahsulot qidirish...")}</div>
                <div style={{ maxHeight: 520, overflowY: "auto" }}>
                  {productRows.length === 0 ? (
                    <p style={{ padding: "20px 18px", fontSize: 13, color: "var(--text-3)", textAlign: "center" }}>{heavyReady ? "Ma'lumot yo'q" : "Yuklanmoqda…"}</p>
                  ) : productRows.map((r, i) => (
                    <div key={r.id}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 18px", borderBottom: i < productRows.length - 1 ? "1px solid var(--border)" : "none" }}>
                      <span style={{ fontSize: 12, color: "var(--text-3)", width: 20, flexShrink: 0 }}>{i + 1}</span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                      <ProfitCell som={r.som} usd={r.usd}/>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
