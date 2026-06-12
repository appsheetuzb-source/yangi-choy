"use client";
import { fetchSheet } from "@/lib/sheet-cache";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";

interface Mijoz {
  Mijoz_ID: string; Ism: string; Telefon: string; Valyuta: string; Agent: string;
  Boshlangich_Balans_som?: string; Boshlangich_Balans_dollar?: string;
}
interface Foydalanuvchi {
  Foydalanuvchi_ID: string; Nomi: string;
}
interface Sotuv {
  Sotuv_ID: string; Mijoz_ID: string; Sana: string; Status: string;
  Sotuv_Raqami: string; Agent: string; Izoh: string; Vaqt: string;
}
interface SotuvSavatRow {
  Savat_ID: string; Sotuv_ID: string; Mahsulot_ID: string;
  Soni: string; Som_Narx: string; Summa_som: string; Kurs: string;
}
interface SotuvSavatDollarRow {
  Savat_ID: string; Sotuv_ID: string; Mahsulot_ID: string;
  Soni: string; Narx: string; Summa: string; Kurs: string;
}
interface STolov {
  Tolov_ID: string; Sotuv_ID: string; Mijoz_ID: string; Agent: string;
  Yil: string; Oy: string; Sana: string; Valyuta: string; Turi: string;
  Som: string; Dollar: string; Summa: string; Summa_dollar: string;
  Izoh: string; Dollar_Kursi: string; Vaqt: string; Check: string;
}

const VALYUTALAR = ["So'm", "Dollar", "Dollar , So'm"];

function num(v: string | number | undefined) {
  return parseFloat(String(v || "0").replace(/\s/g, "").replace(",", ".")) || 0;
}
function isDollarValyuta(v: string) {
  const lv = String(v || "").toLowerCase().trim();
  return lv.includes("dollar") || lv === "$" || lv.includes("usd");
}
function fmtSom(v: number) { return v.toLocaleString("ru-RU") + " so'm"; }
function fmtUsd(v: number) {
  return "$" + v.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function parseDate(s: string) {
  const [d, mo, y] = (s || "").split(".").map(Number);
  return (y || 0) * 10000 + (mo || 0) * 100 + (d || 0);
}

export default function MijozDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [mijoz, setMijoz]           = useState<Mijoz | null>(null);
  const [sotuvlar, setSotuvlar]     = useState<Sotuv[]>([]);
  const [savatMap, setSavatMap]     = useState<Record<string, SotuvSavatRow[]>>({});
  const [savatDolMap, setSavatDolMap] = useState<Record<string, SotuvSavatDollarRow[]>>({});
  const [tolovlar, setTolovlar]     = useState<STolov[]>([]);
  const [agentMap, setAgentMap]     = useState<Record<string, string>>({});
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [isMobile, setIsMobile]     = useState(false);
  const [tick, setTick]             = useState(0);

  const [editOpen, setEditOpen]     = useState(false);
  const [form, setForm]             = useState<Partial<Mijoz>>({});
  const [agentlar, setAgentlar]     = useState<Foydalanuvchi[]>([]);
  const [saving, setSaving]         = useState(false);
  const [toggling, setToggling]     = useState<Record<string, boolean>>({});

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      fetchSheet("Mijozlar"),
      fetchSheet("Sotuv"),
      fetchSheet("Sotuv_Savat"),
      fetchSheet("Sotuv_savat_dollar").catch(() => ({ data: [] })),
      fetchSheet("S_tolov").catch(() => ({ data: [] })),
      fetchSheet("Foydalanuvchi").catch(() => ({ data: [] })),
    ]).then(([mR, sR, svR, sdR, tR, fR]) => {
      // Mijoz
      const m = (mR.data as Mijoz[]).find(x => x.Mijoz_ID === id) || null;
      setMijoz(m);

      // Sotuvlar for this mijoz, sorted by date desc
      const mySotuv = ((sR.data || []) as Sotuv[]).filter(s => s.Mijoz_ID === id);
      mySotuv.sort((a, b) => parseDate(b.Sana) - parseDate(a.Sana));
      setSotuvlar(mySotuv);

      // Sotuv_Savat map by Sotuv_ID
      const sm: Record<string, SotuvSavatRow[]> = {};
      ((svR.data || []) as SotuvSavatRow[]).forEach(r => {
        const key = String(r.Sotuv_ID || "").trim();
        if (!key) return;
        if (!sm[key]) sm[key] = [];
        sm[key].push(r);
      });
      setSavatMap(sm);

      // Sotuv_savat_dollar map by Sotuv_ID
      const sdm: Record<string, SotuvSavatDollarRow[]> = {};
      ((sdR.data || []) as SotuvSavatDollarRow[]).forEach(r => {
        const key = String(r.Sotuv_ID || "").trim();
        if (!key) return;
        if (!sdm[key]) sdm[key] = [];
        sdm[key].push(r);
      });
      setSavatDolMap(sdm);

      // S_tolov for this mijoz, sorted desc
      const myTolov = ((tR.data || []) as STolov[]).filter(t => t.Mijoz_ID === id);
      myTolov.sort((a, b) => parseDate(b.Sana) - parseDate(a.Sana));
      setTolovlar(myTolov);

      // Agent map
      const agents = (fR.data || []) as Foydalanuvchi[];
      setAgentlar(agents);
      const aMap: Record<string, string> = {};
      agents.forEach(f => { aMap[f.Foydalanuvchi_ID] = f.Nomi; });
      setAgentMap(aMap);
    })
    .catch(e => setError(e instanceof Error ? e.message : "Xatolik"))
    .finally(() => setLoading(false));
  }, [id, tick]);

  // Stats
  const jamiSotuvSom = useMemo(() =>
    sotuvlar.reduce((s, sv) =>
      s + (savatMap[sv.Sotuv_ID] || []).reduce((ss, r) => ss + num(r.Summa_som), 0), 0),
    [sotuvlar, savatMap]);

  const jamiSotuvDollar = useMemo(() =>
    sotuvlar.reduce((s, sv) =>
      s + (savatDolMap[sv.Sotuv_ID] || []).reduce((ss, r) => ss + num(r.Summa), 0), 0),
    [sotuvlar, savatDolMap]);

  const tolovSom = useMemo(() =>
    tolovlar.filter(t => !isDollarValyuta(t.Valyuta)).reduce((s, t) => s + num(t.Som), 0),
    [tolovlar]);
  const tolovDollar = useMemo(() =>
    tolovlar.filter(t => isDollarValyuta(t.Valyuta)).reduce((s, t) => s + num(t.Summa_dollar), 0),
    [tolovlar]);

  const boshlangichSom    = num(mijoz?.Boshlangich_Balans_som);
  const boshlangichDollar = num(mijoz?.Boshlangich_Balans_dollar);
  const qarzSom    = boshlangichSom    + jamiSotuvSom    - tolovSom;
  const qarzDollar = boshlangichDollar + jamiSotuvDollar - tolovDollar;

  async function handleToggleCheck(t: STolov, val: string) {
    setToggling(p => ({ ...p, [t.Tolov_ID]: true }));
    setTolovlar(prev => prev.map(item => item.Tolov_ID === t.Tolov_ID ? { ...item, Check: val } : item));
    try {
      await fetch("/api/sheets", { method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet: "S_tolov", idColumn: "Tolov_ID", idValue: t.Tolov_ID, row: { ...t, Check: val } }) });
    } finally {
      setToggling(p => ({ ...p, [t.Tolov_ID]: false }));
    }
  }

  async function handleSave() {
    if (!mijoz || !form.Ism?.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/sheets", { method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet: "Mijozlar", idColumn: "Mijoz_ID", idValue: mijoz.Mijoz_ID, row: { ...mijoz, ...form } }) });
      setEditOpen(false);
      setTimeout(() => setTick(t => t + 1), 800);
    } finally { setSaving(false); }
  }

  if (loading) return (
    <div className="page-content" style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
      <div className="spinner--page"/>
    </div>
  );

  if (error || !mijoz) return (
    <div className="page-content">
      <div className="empty">
        <p className="empty__title">Mijoz topilmadi</p>
        <button className="btn btn--outline" onClick={() => router.back()}>← Orqaga</button>
      </div>
    </div>
  );

  const COLS_S  = "40px 100px 80px 1fr 1fr 120px";
  const COLS_T  = "40px 100px 80px 100px 1fr 1fr 1fr 110px 1fr";

  const statPad: React.CSSProperties = isMobile ? { padding: "14px 16px" } : { padding: "20px 24px" };
  const statCard: React.CSSProperties = { background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", ...statPad };
  const statLabel: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".06em", marginBottom: 8 };
  const statVal: React.CSSProperties   = { fontSize: isMobile ? 14 : 17, fontWeight: 800 };

  return (
    <>
      <header className="header">
        <div className="header__inner" style={{ gap: 14 }}>
          <button onClick={() => router.back()}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--white)", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text-2)", flexShrink: 0 }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
            Orqaga
          </button>
          <div style={{ flex: 1 }}/>
          <button onClick={() => { setForm({ ...mijoz }); setEditOpen(true); }}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--white)", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text-2)", flexShrink: 0 }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            {!isMobile && "Tahrirlash"}
          </button>
        </div>
      </header>

      <div className="page-content" style={{ maxWidth: 1100 }}>

        {/* ── Stats ── */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5,1fr)", gap: isMobile ? 10 : 16, marginBottom: isMobile ? 16 : 24 }}>

          {/* 1. Mijoz */}
          <div style={statCard}>
            <p style={statLabel}>MIJOZ</p>
            <p style={{ ...statVal, wordBreak: "break-word", lineHeight: 1.3 }}>{mijoz.Ism}</p>
            {mijoz.Telefon && <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginTop: 4 }}>{mijoz.Telefon}</p>}
            {agentMap[mijoz.Agent] && <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>{agentMap[mijoz.Agent]}</p>}
          </div>

          {/* 2. Jami sotuv som */}
          <div style={statCard}>
            <p style={statLabel}>JAMI SOTUV SOM</p>
            {jamiSotuvSom !== 0
              ? <p style={statVal}>{jamiSotuvSom.toLocaleString("ru-RU")} <span style={{ fontSize: 10 }}>so&apos;m</span></p>
              : <p style={{ ...statVal, color: "var(--text-3)" }}>0</p>}
          </div>

          {/* 3. Jami sotuv dollar */}
          <div style={statCard}>
            <p style={statLabel}>JAMI SOTUV DOLLAR</p>
            {jamiSotuvDollar !== 0
              ? <p style={{ ...statVal, color: "#2563eb" }}>{fmtUsd(jamiSotuvDollar)}</p>
              : <p style={{ ...statVal, color: "var(--text-3)" }}>$0,00</p>}
          </div>

          {/* 4. To'langan */}
          <div style={statCard}>
            <p style={statLabel}>TO&apos;LANGAN</p>
            {tolovSom !== 0 && <p style={{ ...statVal, color: "#16a34a" }}>{tolovSom.toLocaleString("ru-RU")} <span style={{ fontSize: 10 }}>so&apos;m</span></p>}
            {tolovDollar !== 0 && <p style={{ fontSize: isMobile ? 13 : 15, fontWeight: 800, color: "#2563eb", marginTop: 4 }}>{fmtUsd(tolovDollar)}</p>}
            {tolovSom === 0 && tolovDollar === 0 && <p style={{ ...statVal, color: "var(--text-3)" }}>0</p>}
          </div>

          {/* 5. Joriy qarz */}
          <div style={statCard}>
            <p style={statLabel}>JORIY QARZ</p>
            {qarzSom !== 0 && <p style={{ ...statVal, color: qarzSom > 0 ? "#ef4444" : "#16a34a" }}>{qarzSom.toLocaleString("ru-RU")} <span style={{ fontSize: 10 }}>so&apos;m</span></p>}
            {qarzDollar !== 0 && <p style={{ fontSize: isMobile ? 13 : 15, fontWeight: 800, color: qarzDollar > 0 ? "#ef4444" : "#16a34a", marginTop: 4 }}>{fmtUsd(qarzDollar)}</p>}
            {qarzSom === 0 && qarzDollar === 0 && <p style={{ ...statVal, color: "#16a34a" }}>0</p>}
          </div>
        </div>

        {/* ── Sotuvlar ── */}
        <div style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", overflow: "hidden", marginBottom: 20 }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>Sotuvlar soni: {sotuvlar.length} ta</span>
          </div>

          {sotuvlar.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>Sotuv topilmadi</div>
          ) : isMobile ? (
            <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
              {sotuvlar.map((s, i) => {
                const svRows  = savatMap[s.Sotuv_ID]    || [];
                const sdRows  = savatDolMap[s.Sotuv_ID] || [];
                const somAmt  = svRows.reduce((acc, r) => acc + num(r.Summa_som), 0);
                const usdAmt  = sdRows.reduce((acc, r) => acc + num(r.Summa), 0);
                const isTasdiqlandi = s.Status === "Tasdiqlandi";
                return (
                  <div key={s.Sotuv_ID} onClick={() => router.push(`/sotuv/${s.Sotuv_ID}`)}
                    style={{ background: isTasdiqlandi ? "#dcfce7" : "#fef9c3", borderRadius: "var(--radius)", padding: "12px 14px", cursor: "pointer", border: `1px solid ${isTasdiqlandi ? "#86efac" : "#fde68a"}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700 }}>#{i + 1}</span>
                        {s.Sotuv_Raqami && (
                          <span style={{ fontSize: 12, fontWeight: 800, color: "var(--primary)", background: "#f0fdf4", padding: "2px 8px", borderRadius: 6 }}>#{s.Sotuv_Raqami}</span>
                        )}
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{s.Sana || "—"}</span>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
                        background: isTasdiqlandi ? "#16a34a" : "#ca8a04", color: "#fff" }}>
                        {isTasdiqlandi ? "Ha" : "Yo'q"}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{somAmt !== 0 ? fmtSom(somAmt) : "0 so'm"}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#2563eb" }}>{usdAmt !== 0 ? fmtUsd(usdAmt) : "$0,00"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: COLS_S, padding: "10px 20px", background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
                {["#", "SANA", "RAQAM", "SUMMA (SO'M)", "SUMMA ($)", "AKT"].map(h => (
                  <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".04em" }}>{h}</span>
                ))}
              </div>
              {sotuvlar.map((s, i) => {
                const svRows  = savatMap[s.Sotuv_ID]    || [];
                const sdRows  = savatDolMap[s.Sotuv_ID] || [];
                const somAmt  = svRows.reduce((acc, r) => acc + num(r.Summa_som), 0);
                const usdAmt  = sdRows.reduce((acc, r) => acc + num(r.Summa), 0);
                const isTasdiqlandi = s.Status === "Tasdiqlandi";
                return (
                  <div key={s.Sotuv_ID} onClick={() => router.push(`/sotuv/${s.Sotuv_ID}`)}
                    style={{ display: "grid", gridTemplateColumns: COLS_S, padding: "12px 20px", alignItems: "center", borderBottom: i < sotuvlar.length - 1 ? "1px solid var(--border)" : "none", cursor: "pointer", background: isTasdiqlandi ? "#dcfce7" : "#fef9c3" }}
                    onMouseEnter={e => (e.currentTarget.style.background = isTasdiqlandi ? "#bbf7d0" : "#fde68a")}
                    onMouseLeave={e => (e.currentTarget.style.background = isTasdiqlandi ? "#dcfce7" : "#fef9c3")}>
                    <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700 }}>{i + 1}</span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{s.Sana || "—"}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "var(--primary)", background: "#f0fdf4", padding: "2px 8px", borderRadius: 6, display: "inline-block" }}>
                      {s.Sotuv_Raqami ? `#${s.Sotuv_Raqami}` : "—"}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{somAmt !== 0 ? somAmt.toLocaleString("ru-RU") : "0"}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#2563eb" }}>{usdAmt !== 0 ? fmtUsd(usdAmt) : "$0,00"}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6, display: "inline-block",
                      background: isTasdiqlandi ? "#16a34a" : "#ca8a04", color: "#fff" }}>
                      {isTasdiqlandi ? "Ha" : "Yo'q"}
                    </span>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* ── S_tolov tarixi ── */}
        <div style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>To&apos;lovlar tarixi</span>
          </div>

          {tolovlar.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>To&apos;lov topilmadi</div>
          ) : isMobile ? (
            <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
              {tolovlar.map((t, i) => {
                const somVal  = num(t.Som);
                const usdVal  = num(t.Dollar);
                const jamiSom = num(t.Summa);
                const isHa    = t.Check === "True" || t.Check === "true";
                // Find matching sotuv raqam
                const matchSotuv = t.Sotuv_ID ? sotuvlar.find(s => s.Sotuv_ID === t.Sotuv_ID) : null;
                return (
                  <div key={t.Tolov_ID || i} onClick={() => router.push(`/sotuv/tolov/${t.Tolov_ID}`)}
                    style={{ background: isHa ? "#dcfce7" : "#fee2e2", borderRadius: "var(--radius)", padding: "12px 14px", border: `1px solid ${isHa ? "#86efac" : "#fca5a5"}`, cursor: "pointer" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700 }}>#{i + 1}</span>
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{t.Sana || "—"}</span>
                        {t.Turi && <span style={{ fontSize: 11, background: "#f1f5f9", padding: "1px 7px", borderRadius: 10, color: "var(--text-2)", fontWeight: 600 }}>{t.Turi}</span>}
                        {matchSotuv && (
                          <span style={{ fontSize: 11, color: "var(--primary)", fontWeight: 800, background: "#f0fdf4", padding: "1px 7px", borderRadius: 6 }}>
                            #{matchSotuv.Sotuv_Raqami}
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
                        {(["True", "False"] as const).map(val => {
                          const isActive = val === "True" ? isHa : !isHa;
                          return (
                            <button key={val} disabled={toggling[t.Tolov_ID]}
                              onClick={() => handleToggleCheck(t, val)}
                              style={{ padding: "2px 9px", fontSize: 11, fontWeight: 700, borderRadius: 6, border: "none", cursor: "pointer",
                                background: isActive ? (val === "True" ? "#16a34a" : "#ef4444") : "#f1f5f9",
                                color: isActive ? "#fff" : "var(--text-3)", opacity: toggling[t.Tolov_ID] ? 0.6 : 1 }}>
                              {val === "True" ? "Ha" : "Yo'q"}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{somVal !== 0 ? fmtSom(somVal) : "0 so'm"}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#2563eb" }}>{usdVal !== 0 ? fmtUsd(usdVal) : "$0,00"}</span>
                      {jamiSom !== 0 && <span style={{ fontSize: 12, fontWeight: 700, color: "#16a34a" }}>{fmtSom(jamiSom)}</span>}
                    </div>
                    {t.Izoh && <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>{t.Izoh}</p>}
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: COLS_T, padding: "10px 20px", background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
                {["#", "SANA", "TURI", "SOTUV", "SO'M", "DOLLAR", "JAMI (SO'M)", "AKT", "IZOH"].map(h => (
                  <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".04em" }}>{h}</span>
                ))}
              </div>
              {tolovlar.map((t, i) => {
                const somVal  = num(t.Som);
                const usdVal  = num(t.Dollar);
                const jamiSom = num(t.Summa);
                const isHa    = t.Check === "True" || t.Check === "true";
                const matchSotuv = t.Sotuv_ID ? sotuvlar.find(s => s.Sotuv_ID === t.Sotuv_ID) : null;
                return (
                  <div key={t.Tolov_ID || i} onClick={() => router.push(`/sotuv/tolov/${t.Tolov_ID}`)}
                    style={{ display: "grid", gridTemplateColumns: COLS_T, padding: "12px 20px", alignItems: "center", borderBottom: i < tolovlar.length - 1 ? "1px solid var(--border)" : "none", background: isHa ? "#dcfce7" : "#fee2e2", cursor: "pointer" }}
                    onMouseEnter={e => (e.currentTarget.style.background = isHa ? "#bbf7d0" : "#fecaca")}
                    onMouseLeave={e => (e.currentTarget.style.background = isHa ? "#dcfce7" : "#fee2e2")}>
                    <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700 }}>{i + 1}</span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{t.Sana || "—"}</span>
                    <span style={{ fontSize: 11, background: t.Turi ? "#f1f5f9" : "transparent", padding: t.Turi ? "2px 8px" : 0, borderRadius: 10, fontWeight: 600, color: "var(--text-2)", display: "inline-block" }}>
                      {t.Turi || "—"}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: matchSotuv ? "var(--primary)" : "var(--text-3)" }}>
                      {matchSotuv ? (
                        <span style={{ background: "#f0fdf4", padding: "2px 8px", borderRadius: 6, display: "inline-block" }}>
                          #{matchSotuv.Sotuv_Raqami}
                        </span>
                      ) : "—"}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{somVal !== 0 ? somVal.toLocaleString("ru-RU") : "0"}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#2563eb" }}>{usdVal !== 0 ? fmtUsd(usdVal) : "$0,00"}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#16a34a" }}>{jamiSom !== 0 ? jamiSom.toLocaleString("ru-RU") : "0"}</span>
                    <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
                      {(["True", "False"] as const).map(val => {
                        const isActive = val === "True" ? isHa : !isHa;
                        return (
                          <button key={val} disabled={toggling[t.Tolov_ID]}
                            onClick={() => handleToggleCheck(t, val)}
                            style={{ padding: "3px 10px", fontSize: 11, fontWeight: 700, borderRadius: 6, border: "none", cursor: "pointer",
                              background: isActive ? (val === "True" ? "#16a34a" : "#ef4444") : "#f1f5f9",
                              color: isActive ? "#fff" : "var(--text-3)", opacity: toggling[t.Tolov_ID] ? 0.6 : 1 }}>
                            {val === "True" ? "Ha" : "Yo'q"}
                          </button>
                        );
                      })}
                    </div>
                    <span style={{ fontSize: 12, color: "var(--text-3)" }}>{t.Izoh || "—"}</span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* ── Edit drawer ── */}
      {editOpen && (
        <>
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 999 }} onClick={() => setEditOpen(false)}/>
          <div style={{
            position: "fixed",
            ...(isMobile
              ? { bottom: 0, left: 0, right: 0, borderRadius: "20px 20px 0 0", maxHeight: "85vh", overflowY: "auto" }
              : { top: 0, right: 0, width: 380, height: "100%", overflowY: "auto" }),
            background: "var(--white)", zIndex: 1000, padding: "24px 20px",
            display: "flex", flexDirection: "column", gap: 16,
            boxShadow: "-4px 0 32px rgba(0,0,0,0.1)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 16, fontWeight: 800 }}>Tahrirlash</span>
              <button onClick={() => setEditOpen(false)}
                style={{ border: "none", background: "none", cursor: "pointer", padding: 4, fontSize: 18, color: "var(--text-3)" }}>✕</button>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 6 }}>Ism</label>
              <input value={String(form.Ism || "")} onChange={e => setForm(p => ({ ...p, Ism: e.target.value }))} autoFocus
                style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 14, background: "var(--bg)", boxSizing: "border-box" }}/>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 6 }}>Telefon</label>
              <input value={String(form.Telefon || "")} onChange={e => setForm(p => ({ ...p, Telefon: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 14, background: "var(--bg)", boxSizing: "border-box" }}/>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 6 }}>Valyuta</label>
              <select value={String(form.Valyuta || "So'm")} onChange={e => setForm(p => ({ ...p, Valyuta: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 14, background: "var(--bg)" }}>
                {VALYUTALAR.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 6 }}>Agent</label>
              <select value={String(form.Agent || "")} onChange={e => setForm(p => ({ ...p, Agent: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 14, background: "var(--bg)" }}>
                <option value="">— Agent tanlanmagan —</option>
                {agentlar.map(a => <option key={a.Foydalanuvchi_ID} value={a.Foydalanuvchi_ID}>{a.Nomi}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 6 }}>Boshlang&apos;ich qoldiq (so&apos;m)</label>
              <input value={String(form.Boshlangich_Balans_som || "")} onChange={e => setForm(p => ({ ...p, Boshlangich_Balans_som: e.target.value }))} placeholder="0" inputMode="decimal"
                style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 14, background: "var(--bg)", boxSizing: "border-box" }}/>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 6 }}>Boshlang&apos;ich qoldiq ($)</label>
              <input value={String(form.Boshlangich_Balans_dollar || "")} onChange={e => setForm(p => ({ ...p, Boshlangich_Balans_dollar: e.target.value }))} placeholder="0" inputMode="decimal"
                style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 14, background: "var(--bg)", boxSizing: "border-box" }}/>
            </div>
            <button onClick={handleSave} disabled={saving || !form.Ism?.trim()}
              style={{ marginTop: 8, padding: 11, background: "var(--primary)", color: "#fff", border: "none", borderRadius: "var(--radius)", fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {saving && <span className="spinner"/>}
              {saving ? "Saqlanmoqda..." : "Saqlash"}
            </button>
          </div>
        </>
      )}
    </>
  );
}
