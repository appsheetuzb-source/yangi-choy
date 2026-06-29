"use client";
import { fetchSheet, afterWrite } from "@/lib/sheet-cache";
import { useScrollLock } from "@/lib/use-scroll-lock";
import FabAdd from "@/components/FabAdd";
import { useAuth } from "@/lib/AuthContext";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";

interface Mijoz {
  Mijoz_ID: string; Ism: string; Telefon: string; Valyuta: string; Agent: string;
  Boshlangich_Balans_som?: string; Boshlangich_Balans_dollar?: string;
}
interface Foydalanuvchi {
  Foydalanuvchi_ID: string; Nomi: string;
}
interface MijozBalans {
  Mijoz_ID: string; Oldi_som: string; Oldi_dollar: string;
  Berdi_som: string; Berdi_dollar: string; Qoldi_som: string; Qoldi_dollar: string;
}
interface SotuvRow {
  Sotuv_ID: string; Mijoz_ID: string; Chek?: string;
}
interface SavatSomRow {
  Sotuv_ID: string; Summa_som: string;
}
interface SavatDollarRow {
  Sotuv_ID: string; Summa: string;
}
interface STolovRow {
  Mijoz_ID: string; Valyuta: string; Som: string; Dollar: string; Summa: string; Summa_dollar: string;
}

const VALYUTALAR = ["So'm", "Dollar", "Dollar , So'm"];
const EMPTY: Mijoz = { Mijoz_ID: "", Ism: "", Telefon: "", Valyuta: "So'm", Agent: "", Boshlangich_Balans_som: "", Boshlangich_Balans_dollar: "" };

function isDollarValyuta(v: string) {
  const lv = String(v || "").toLowerCase().trim();
  return lv.includes("dollar") || lv === "$" || lv.includes("usd");
}
function hasSomValyuta(v: string) {
  return !isDollarValyuta(v) || /so.?m/i.test(String(v || ""));
}

function uid() { return Math.random().toString(36).slice(2, 10); }
function num(v: string | number | undefined) {
  return parseFloat(String(v || "0").replace(/\s/g, "").replace(",", ".")) || 0;
}
function fmtSom(v: number) { return v.toLocaleString("ru-RU") + " so'm"; }
function fmtUsd(v: number) {
  return "$" + v.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function initials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0] || "").join("").toUpperCase() || "?";
}

function ValyutaBadge({ valyuta }: { valyuta: string }) {
  const v = valyuta.toLowerCase();
  const both   = v.includes("dollar") && (v.includes("so'm") || v.includes("som"));
  const dollar = v.includes("dollar");
  const color  = both ? "#9333ea" : dollar ? "#2563eb" : "#16a34a";
  const bg     = both ? "#fdf4ff" : dollar ? "#eff6ff" : "#f0fdf4";
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: bg, color }}>
      {valyuta || "—"}
    </span>
  );
}

function BalansCell({ som, usd, label }: { som: number; usd: number; label?: string }) {
  const isBalans = label === "balans";
  const showSom = som !== 0;
  const showUsd = usd !== 0;
  if (!showSom && !showUsd) {
    return <span style={{ color: "var(--text-3)", fontSize: 13 }}>{isBalans ? "0" : "—"}</span>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {showSom && (
        <span style={{ fontSize: 13, fontWeight: 700, color: isBalans ? (som > 0 ? "#ef4444" : "#16a34a") : "var(--text)" }}>
          {fmtSom(som)}
        </span>
      )}
      {showUsd && (
        <span style={{ fontSize: 13, fontWeight: 700, color: isBalans ? (usd > 0 ? "#ef4444" : "#16a34a") : "#2563eb" }}>
          {fmtUsd(usd)}
        </span>
      )}
    </div>
  );
}

export default function MijozlarPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isSotuvchi = user?.lavozim === "Sotuvchi";
  const [mijozlar, setMijozlar]         = useState<Mijoz[]>([]);
  const [balansMap, setBalansMap]       = useState<Record<string, MijozBalans>>({});
  const [sotuvSomMap, setSotuvSomMap]   = useState<Record<string, number>>({});
  const [sotuvUsdMap, setSotuvUsdMap]   = useState<Record<string, number>>({});
  const [tolovSomMap, setTolovSomMap]   = useState<Record<string, number>>({});
  const [tolovUsdMap, setTolovUsdMap]   = useState<Record<string, number>>({});
  const [agentlar, setAgentlar]         = useState<Foydalanuvchi[]>([]);
  const [agentMap, setAgentMap]         = useState<Record<string, string>>({});
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [search, setSearch]             = useState("");
  const [activeAgent, setActiveAgent]   = useState<string>("all");
  const [curFilter, setCurFilter]       = useState<"all" | "som" | "dollar">("all");
  const [isMobile, setIsMobile]         = useState(false);

  const [drawerOpen, setDrawerOpen]     = useState(false);
  const [editTarget, setEditTarget]     = useState<Mijoz | null>(null);
  const [form, setForm]                 = useState<Mijoz>(EMPTY);
  const [saving, setSaving]             = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Mijoz | null>(null);
  useScrollLock(drawerOpen || !!deleteTarget);
  const [deleting, setDeleting]         = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const loadData = useCallback((delay = 0) => {
    setLoading(true);
    setTimeout(() => {
      Promise.all([
        fetchSheet("Mijozlar"),
        fetchSheet("MijozBalans").catch(() => ({ data: [] })),
        fetchSheet("Foydalanuvchi").catch(() => ({ data: [] })),
        fetchSheet("Sotuv").catch(() => ({ data: [] })),
        fetchSheet("Sotuv_Savat").catch(() => ({ data: [] })),
        fetchSheet("Sotuv_savat_dollar").catch(() => ({ data: [] })),
        fetchSheet("S_tolov").catch(() => ({ data: [] })),
      ]).then(([mR, bR, fR, sR, ssR, sdR, tR]) => {
        if (mR.error) throw new Error(mR.error);
        setMijozlar(mR.data as Mijoz[]);

        const bMap: Record<string, MijozBalans> = {};
        ((bR.data || []) as MijozBalans[]).forEach(b => { bMap[String(b.Mijoz_ID).trim()] = b; });
        setBalansMap(bMap);

        const agents = (fR.data || []) as Foydalanuvchi[];
        setAgentlar(agents);
        const aMap: Record<string, string> = {};
        agents.forEach(f => { aMap[f.Foydalanuvchi_ID] = f.Nomi; });
        setAgentMap(aMap);

        // Sotuv_ID → Mijoz_ID mapping (qarzga tasdiqlangan sotuvlar: Chek bo'sh emas — TRUE yoki FALSE)
        const sotuvMijozMap: Record<string, string> = {};
        ((sR.data || []) as SotuvRow[]).forEach(s => {
          if (String(s.Chek || "").trim() === "") return;
          const sid = String(s.Sotuv_ID || "").trim();
          const mid = String(s.Mijoz_ID || "").trim();
          if (sid && mid) sotuvMijozMap[sid] = mid;
        });

        // Sum Sotuv_Savat (so'm) per Mijoz_ID
        const sSom: Record<string, number> = {};
        ((ssR.data || []) as SavatSomRow[]).forEach(r => {
          const mid = sotuvMijozMap[String(r.Sotuv_ID || "").trim()];
          if (!mid) return;
          sSom[mid] = (sSom[mid] || 0) + num(r.Summa_som);
        });

        // Sum Sotuv_savat_dollar per Mijoz_ID
        const sUsd: Record<string, number> = {};
        ((sdR.data || []) as SavatDollarRow[]).forEach(r => {
          const mid = sotuvMijozMap[String(r.Sotuv_ID || "").trim()];
          if (!mid) return;
          sUsd[mid] = (sUsd[mid] || 0) + num(r.Summa);
        });

        setSotuvSomMap(sSom);
        setSotuvUsdMap(sUsd);

        const tSom: Record<string, number> = {};
        const tUsd: Record<string, number> = {};
        ((tR.data || []) as STolovRow[]).forEach(t => {
          const id = String(t.Mijoz_ID || "").trim();
          if (!id) return;
          if (isDollarValyuta(t.Valyuta)) {
            tUsd[id] = (tUsd[id] || 0) + num(t.Summa_dollar);
          } else {
            tSom[id] = (tSom[id] || 0) + num(t.Summa);
          }
        });
        setTolovSomMap(tSom);
        setTolovUsdMap(tUsd);
      })
      .catch(e => setError(e instanceof Error ? e.message : "Xatolik"))
      .finally(() => setLoading(false));
    }, delay);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const baseList = useMemo(()=>mijozlar.filter(m => {
    // Sotuvchi faqat o'z mijozlarini ko'radi
    if (isSotuvchi && user?.id && (m.Agent || "").trim() !== user.id) return false;
    return String(m.Ism || "").toLowerCase().includes(search.toLowerCase()) ||
      String(m.Telefon || "").includes(search);
  }),[mijozlar,isSotuvchi,user,search]);
  const somCount    = useMemo(()=>baseList.filter(m => hasSomValyuta(m.Valyuta)).length,[baseList]);
  const dollarCount = useMemo(()=>baseList.filter(m => isDollarValyuta(m.Valyuta)).length,[baseList]);
  const filtered = useMemo(()=> curFilter === "all" ? baseList
    : baseList.filter(m => curFilter === "som" ? hasSomValyuta(m.Valyuta) : isDollarValyuta(m.Valyuta)),[baseList,curFilter]);

  // Group by Agent (bitta o'tishda — har agent uchun qayta filter o'rniga)
  const agentGroups = useMemo(()=>{
    const byAgent: Record<string, Mijoz[]> = {};
    const order: string[] = [];
    for (const m of filtered) {
      const a = m.Agent || "";
      if (!byAgent[a]) { byAgent[a] = []; order.push(a); }
      byAgent[a].push(m);
    }
    return order.map(agentId => ({
      agentId,
      agentNomi: agentMap[agentId] || agentId || "Agent ko'rsatilmagan",
      members: byAgent[agentId],
    }));
  },[filtered,agentMap]);

  const visibleGroups = useMemo(()=>activeAgent === "all" ? agentGroups : agentGroups.filter(g => g.agentId === activeAgent),[agentGroups,activeAgent]);
  const totalCount = useMemo(()=>agentGroups.reduce((s, g) => s + g.members.length, 0),[agentGroups]);

  function openAdd() {
    setEditTarget(null);
    setForm({ ...EMPTY, Mijoz_ID: uid() });
    setDrawerOpen(true);
  }
  function openEdit(m: Mijoz, e: React.MouseEvent) {
    e.stopPropagation();
    setEditTarget(m); setForm({ ...m }); setDrawerOpen(true);
  }

  async function handleSave() {
    if (!form.Ism.trim()) return;
    setSaving(true);
    try {
      if (editTarget) {
        await fetch("/api/sheets", { method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sheet: "Mijozlar", idColumn: "Mijoz_ID", idValue: editTarget.Mijoz_ID, row: form }) });
      } else {
        await fetch("/api/sheets", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sheet: "Mijozlar", row: form }) });
      }
      setDrawerOpen(false); afterWrite("Mijozlar"); loadData(800);
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch("/api/sheets", { method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet: "Mijozlar", idColumn: "Mijoz_ID", idValue: deleteTarget.Mijoz_ID }) });
      afterWrite("Mijozlar"); setDeleteTarget(null); loadData(800);
    } finally { setDeleting(false); }
  }

  const modalOverlay: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 50, background: "rgba(15,42,76,.42)", backdropFilter: "blur(4px)",
    display: "flex", alignItems: isMobile ? "flex-end" : "center",
    justifyContent: "center", padding: isMobile ? 0 : 20,
  };
  const modalBox: React.CSSProperties = {
    background: "var(--white)", width: "100%",
    maxWidth: isMobile ? "100%" : 480,
    borderRadius: isMobile ? "20px 20px 0 0" : 16,
    display: "flex", flexDirection: "column",
    maxHeight: isMobile ? "90dvh" : "85vh",
  };

  return (
    <>
      <header className="header">
        <div className="header__inner">
          <h1 className="header__title" style={{ paddingLeft: 4 }}>Klientlar</h1>
          {!isMobile && (
            <div className="search" style={{ maxWidth: 300 }}>
              <span className="search__icon">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
              </span>
              <input className="search__input" placeholder="Ism yoki telefon..." value={search} onChange={e => setSearch(e.target.value)}/>
              {search && <button className="search__clear" onClick={() => setSearch("")}><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>}
            </div>
          )}
          <div className="header__spacer"/>
          {!isMobile && (
            <button className="btn btn--primary" onClick={openAdd}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              Qo&apos;shish
            </button>
          )}
        </div>
      </header>

      {isMobile && <FabAdd onClick={openAdd} />}

      <div className="page-content">
        {loading && <div className="spinner--page"/>}
        {error && (
          <div className="error-box">
            <div className="error-box__icon">
              <svg width="24" height="24" fill="none" stroke="#ef4444" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
            </div>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && (() => {
          const allMijozlar = mijozlar;
          const totSotuvSom = Object.values(sotuvSomMap).reduce((s, v) => s + v, 0);
          const totSotuvUsd = Object.values(sotuvUsdMap).reduce((s, v) => s + v, 0);
          const totTolovSom = Object.values(tolovSomMap).reduce((s, v) => s + v, 0);
          const totTolovUsd = Object.values(tolovUsdMap).reduce((s, v) => s + v, 0);
          const totBoshSom  = allMijozlar.reduce((s, m) => s + num(m.Boshlangich_Balans_som), 0);
          const totBoshUsd  = allMijozlar.reduce((s, m) => s + num(m.Boshlangich_Balans_dollar), 0);
          const totQarzSom  = totBoshSom + totSotuvSom - totTolovSom;
          const totQarzUsd  = totBoshUsd + totSotuvUsd - totTolovUsd;

          const sc: React.CSSProperties = {
            background: "var(--white)", borderRadius: "var(--radius-xl)",
            boxShadow: "var(--shadow-sm)", padding: isMobile ? "14px 16px" : "18px 22px",
          };
          const slabel: React.CSSProperties = {
            fontSize: 10, fontWeight: 700, color: "var(--text-3)",
            letterSpacing: ".06em", marginBottom: 8,
          };

          return (
            <>
              {/* ── Summary cards ── */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: isMobile ? 10 : 16, marginBottom: isMobile ? 16 : 20 }}>

                {/* 1. Mijozlar */}
                <div style={sc}>
                  <p style={slabel}>MIJOZLAR</p>
                  <p style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, lineHeight: 1 }}>{allMijozlar.length}</p>
                  <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>ta mijoz</p>
                </div>

                {/* 2. Jami sotuv */}
                <div style={sc}>
                  <p style={slabel}>JAMI SOTUV</p>
                  {totSotuvSom > 0 && (
                    <p style={{ fontSize: isMobile ? 13 : 15, fontWeight: 800, color: "var(--text)" }}>{fmtSom(totSotuvSom)}</p>
                  )}
                  {totSotuvUsd > 0 && (
                    <p style={{ fontSize: isMobile ? 13 : 15, fontWeight: 800, color: "#2563eb", marginTop: totSotuvSom > 0 ? 4 : 0 }}>{fmtUsd(totSotuvUsd)}</p>
                  )}
                  {totSotuvSom === 0 && totSotuvUsd === 0 && (
                    <p style={{ fontSize: 15, fontWeight: 800, color: "var(--text-3)" }}>0</p>
                  )}
                </div>

                {/* 3. Jami to'lov */}
                <div style={sc}>
                  <p style={slabel}>JAMI TO&apos;LOV</p>
                  {totTolovSom > 0 && (
                    <p style={{ fontSize: isMobile ? 13 : 15, fontWeight: 800, color: "#16a34a" }}>{fmtSom(totTolovSom)}</p>
                  )}
                  {totTolovUsd > 0 && (
                    <p style={{ fontSize: isMobile ? 13 : 15, fontWeight: 800, color: "#2563eb", marginTop: totTolovSom > 0 ? 4 : 0 }}>{fmtUsd(totTolovUsd)}</p>
                  )}
                  {totTolovSom === 0 && totTolovUsd === 0 && (
                    <p style={{ fontSize: 15, fontWeight: 800, color: "var(--text-3)" }}>0</p>
                  )}
                </div>

                {/* 4. Umumiy qarz */}
                <div style={{ ...sc, background: (totQarzSom > 0 || totQarzUsd > 0) ? "#fff1f2" : totSotuvSom === 0 && totSotuvUsd === 0 ? "var(--white)" : "#f0fdf4" }}>
                  <p style={slabel}>UMUMIY QARZ</p>
                  {totQarzSom !== 0 && (
                    <p style={{ fontSize: isMobile ? 13 : 15, fontWeight: 800, color: totQarzSom > 0 ? "#ef4444" : "#16a34a" }}>{fmtSom(Math.abs(totQarzSom))}{totQarzSom < 0 ? " (+)" : ""}</p>
                  )}
                  {totQarzUsd !== 0 && (
                    <p style={{ fontSize: isMobile ? 13 : 15, fontWeight: 800, color: totQarzUsd > 0 ? "#ef4444" : "#16a34a", marginTop: totQarzSom !== 0 ? 4 : 0 }}>{fmtUsd(Math.abs(totQarzUsd))}{totQarzUsd < 0 ? " (+)" : ""}</p>
                  )}
                  {totQarzSom === 0 && totQarzUsd === 0 && (
                    <p style={{ fontSize: 15, fontWeight: 800, color: "#16a34a" }}>0</p>
                  )}
                </div>
              </div>

              {/* ── Valyuta bo'yicha ajratish ── */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: isMobile ? 14 : 16 }}>
                {([
                  { k: "all" as const, label: "Hammasi", count: baseList.length, color: "var(--primary)" },
                  { k: "som" as const, label: "So'm mijozlar", count: somCount, color: "#16a34a" },
                  { k: "dollar" as const, label: "Dollar mijozlar", count: dollarCount, color: "#2563eb" },
                ]).map(t => {
                  const active = curFilter === t.k;
                  return (
                    <button key={t.k} onClick={() => setCurFilter(t.k)}
                      style={{ padding: "8px 18px", borderRadius: 20, border: "1.5px solid " + (active ? t.color : "var(--border)"),
                        background: active ? t.color : "var(--white)", color: active ? "#fff" : "var(--text-2)",
                        fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                      {t.label}
                      <span style={{ fontSize: 11, fontWeight: 700, background: active ? "rgba(255,255,255,.25)" : "var(--bg)", padding: "1px 7px", borderRadius: 10 }}>{t.count}</span>
                    </button>
                  );
                })}
              </div>

              {/* Mobile search */}
              {isMobile && (
              <div className="search" style={{ marginBottom: 14 }}>
                <span className="search__icon">
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                </span>
                <input className="search__input" placeholder="Ism yoki telefon..." value={search} onChange={e => setSearch(e.target.value)}/>
                {search && <button className="search__clear" onClick={() => setSearch("")}><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>}
              </div>
            )}

            {/* Agent tabs */}
            {agentGroups.length > 1 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
                <button onClick={() => setActiveAgent("all")}
                  style={{ padding: "7px 16px", borderRadius: 20,
                    border: "1.5px solid " + (activeAgent === "all" ? "var(--primary)" : "var(--border)"),
                    background: activeAgent === "all" ? "var(--primary)" : "var(--white)",
                    color: activeAgent === "all" ? "#fff" : "var(--text-2)",
                    fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Barchasi
                  <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700,
                    background: activeAgent === "all" ? "rgba(255,255,255,.25)" : "var(--bg)",
                    padding: "1px 7px", borderRadius: 10 }}>
                    {totalCount}
                  </span>
                </button>
                {agentGroups.map(g => (
                  <button key={g.agentId} onClick={() => setActiveAgent(g.agentId)}
                    style={{ padding: "7px 16px", borderRadius: 20,
                      border: "1.5px solid " + (activeAgent === g.agentId ? "var(--primary)" : "var(--border)"),
                      background: activeAgent === g.agentId ? "var(--primary)" : "var(--white)",
                      color: activeAgent === g.agentId ? "#fff" : "var(--text-2)",
                      fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    {g.agentNomi}
                    <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700,
                      background: activeAgent === g.agentId ? "rgba(255,255,255,.25)" : "var(--bg)",
                      padding: "1px 7px", borderRadius: 10 }}>
                      {g.members.length}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <p className="count-label">{totalCount} ta mijoz</p>

            {visibleGroups.length === 0 ? (
              <div className="empty">
                <div className="empty__icon">👤</div>
                <p className="empty__title">Mijoz topilmadi</p>
                <button className="btn btn--primary" onClick={openAdd}>+ Yangi mijoz</button>
              </div>
            ) : (
              visibleGroups.map((g, gi) => (
                <div key={g.agentId} style={{ marginBottom: gi < visibleGroups.length - 1 ? 36 : 0 }}>
                  {/* Agent header — only shown when "Barchasi" tab is active */}
                  {activeAgent === "all" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, paddingBottom: 10, borderBottom: "2px solid var(--primary)" }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <svg width="16" height="16" fill="none" stroke="#fff" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                        </svg>
                      </div>
                      <h2 style={{ fontSize: 16, fontWeight: 800 }}>{g.agentNomi}</h2>
                      <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "var(--primary)", color: "#fff" }}>
                        {g.members.length} ta
                      </span>
                    </div>
                  )}

                  {isMobile ? (
                    /* ── MOBILE cards ── */
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {g.members.map(m => {
                        const stSom  = sotuvSomMap[m.Mijoz_ID] || 0;
                        const stUsd  = sotuvUsdMap[m.Mijoz_ID] || 0;
                        const tlSom  = tolovSomMap[m.Mijoz_ID] || 0;
                        const tlUsd  = tolovUsdMap[m.Mijoz_ID] || 0;
                        const qSom   = num(m.Boshlangich_Balans_som)    + stSom - tlSom;
                        const qUsd   = num(m.Boshlangich_Balans_dollar) + stUsd - tlUsd;
                        return (
                          <div key={m.Mijoz_ID}
                            onClick={() => router.push(`/mijozlar/${m.Mijoz_ID}`)}
                            style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", padding: 16, cursor: "pointer" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                              <div style={{ width: 42, height: 42, borderRadius: "50%", background: "var(--primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                                {initials(m.Ism)}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: 15, fontWeight: 800 }}>{m.Ism}</p>
                                {m.Telefon && <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{m.Telefon}</p>}
                              </div>
                              <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                                <button onClick={e => openEdit(m, e)}
                                  style={{ width: 32, height: 32, borderRadius: 10, border: "1px solid #dbeafe", background: "#eff6ff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563eb" }}>
                                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                                </button>
                                <button onClick={e => { e.stopPropagation(); setDeleteTarget(m); }}
                                  style={{ width: 32, height: 32, borderRadius: 10, border: "1px solid #fee2e2", background: "#fff1f2", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444" }}>
                                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                </button>
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: (stSom || stUsd || tlSom || tlUsd) ? 8 : 0 }}>
                              <ValyutaBadge valyuta={m.Valyuta}/>
                              {agentMap[m.Agent] && (
                                <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>{agentMap[m.Agent]}</span>
                              )}
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                              <div style={{ background: "var(--bg)", borderRadius: 8, padding: "6px 10px" }}>
                                <p style={{ fontSize: 10, fontWeight: 600, color: "var(--text-3)", marginBottom: 3 }}>SOTUV</p>
                                {(stSom || stUsd) ? (
                                  <>
                                    {stSom > 0 && <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text)" }}>{fmtSom(stSom)}</p>}
                                    {stUsd > 0 && <p style={{ fontSize: 11, fontWeight: 700, color: "#2563eb" }}>{fmtUsd(stUsd)}</p>}
                                  </>
                                ) : <p style={{ fontSize: 11, color: "var(--text-3)" }}>—</p>}
                              </div>
                              <div style={{ background: "var(--bg)", borderRadius: 8, padding: "6px 10px" }}>
                                <p style={{ fontSize: 10, fontWeight: 600, color: "var(--text-3)", marginBottom: 3 }}>TO&apos;LOV</p>
                                {(tlSom || tlUsd) ? (
                                  <>
                                    {tlSom > 0 && <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text)" }}>{fmtSom(tlSom)}</p>}
                                    {tlUsd > 0 && <p style={{ fontSize: 11, fontWeight: 700, color: "#2563eb" }}>{fmtUsd(tlUsd)}</p>}
                                  </>
                                ) : <p style={{ fontSize: 11, color: "var(--text-3)" }}>—</p>}
                              </div>
                              <div style={{ background: (qSom > 0 || qUsd > 0) ? "#fff1f2" : "#f0fdf4", borderRadius: 8, padding: "6px 10px" }}>
                                <p style={{ fontSize: 10, fontWeight: 600, color: "var(--text-3)", marginBottom: 3 }}>QARZ</p>
                                {(qSom !== 0 || qUsd !== 0) ? (
                                  <>
                                    {qSom !== 0 && <p style={{ fontSize: 11, fontWeight: 700, color: qSom > 0 ? "#ef4444" : "#16a34a" }}>{fmtSom(qSom)}</p>}
                                    {qUsd !== 0 && <p style={{ fontSize: 11, fontWeight: 700, color: qUsd > 0 ? "#ef4444" : "#16a34a" }}>{fmtUsd(qUsd)}</p>}
                                  </>
                                ) : <p style={{ fontSize: 11, fontWeight: 700, color: "#16a34a" }}>0</p>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* ── DESKTOP table ── */
                    <div style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "56px 1fr 160px 160px 160px 160px 80px", padding: "10px 20px", background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
                        {["", "ISM / TELEFON", "VALYUTA + AGENT", "SOTUV", "TO'LOV", "JORIY QARZ", ""].map((h, i) => (
                          <span key={i} style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".05em" }}>{h}</span>
                        ))}
                      </div>
                      {g.members.map((m, idx) => {
                        const sotuvSom = sotuvSomMap[m.Mijoz_ID] || 0;
                        const sotuvUsd = sotuvUsdMap[m.Mijoz_ID] || 0;
                        const tolovSom = tolovSomMap[m.Mijoz_ID] || 0;
                        const tolovUsd = tolovUsdMap[m.Mijoz_ID] || 0;
                        const qSom     = num(m.Boshlangich_Balans_som)    + sotuvSom - tolovSom;
                        const qUsd     = num(m.Boshlangich_Balans_dollar) + sotuvUsd - tolovUsd;
                        return (
                          <div key={m.Mijoz_ID || idx}
                            onClick={() => router.push(`/mijozlar/${m.Mijoz_ID}`)}
                            style={{ display: "grid", gridTemplateColumns: "56px 1fr 160px 160px 160px 160px 80px", padding: "14px 20px", alignItems: "center", borderBottom: idx < g.members.length - 1 ? "1px solid var(--border)" : "none", cursor: "pointer" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
                                {initials(m.Ism)}
                              </div>
                            </div>
                            <div>
                              <p style={{ fontSize: 14, fontWeight: 700 }}>{m.Ism || "—"}</p>
                              {m.Telefon && <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{m.Telefon}</p>}
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              <ValyutaBadge valyuta={m.Valyuta}/>
                              {agentMap[m.Agent] && (
                                <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>{agentMap[m.Agent]}</span>
                              )}
                            </div>
                            <BalansCell som={sotuvSom} usd={sotuvUsd}/>
                            <BalansCell som={tolovSom} usd={tolovUsd}/>
                            <BalansCell som={qSom} usd={qUsd} label="balans"/>
                            <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }} onClick={e => e.stopPropagation()}>
                              <button className="icon-btn icon-btn--blue" onClick={e => openEdit(m, e)}>
                                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                              </button>
                              <button className="icon-btn icon-btn--red" onClick={e => { e.stopPropagation(); setDeleteTarget(m); }}>
                                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))
            )}
          </>
          );
        })()}
      </div>

      {/* ── Add/Edit (mobile: bottom sheet, desktop: drawer) ── */}
      {drawerOpen && (
        isMobile ? (
          <div style={modalOverlay} onClick={() => setDrawerOpen(false)}>
            <div style={modalBox} onClick={e => e.stopPropagation()}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--border)", margin: "12px auto 0" }}/>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
                <h2 style={{ fontSize: 16, fontWeight: 800 }}>{editTarget ? "Tahrirlash" : "Yangi mijoz"}</h2>
                <button onClick={() => setDrawerOpen(false)} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border)", background: "var(--white)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
              <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 6 }}>Ism *</label>
                  <input value={form.Ism} onChange={e => setForm(p => ({ ...p, Ism: e.target.value }))} placeholder="Mijoz nomi" autoFocus
                    style={{ width: "100%", padding: "10px 14px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 14, outline: "none", boxSizing: "border-box" }}/>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 6 }}>Telefon</label>
                  <input value={form.Telefon} onChange={e => setForm(p => ({ ...p, Telefon: e.target.value }))} placeholder="+998 __ ___ __ __" inputMode="tel"
                    style={{ width: "100%", padding: "10px 14px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 14, outline: "none", boxSizing: "border-box" }}/>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 8 }}>Valyuta</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {VALYUTALAR.map(v => (
                      <button key={v} onClick={() => setForm(p => ({ ...p, Valyuta: v }))}
                        style={{ flex: 1, padding: "9px 4px", borderRadius: "var(--radius)", border: `1.5px solid ${form.Valyuta === v ? "var(--primary)" : "var(--border)"}`, background: form.Valyuta === v ? "#f0fdf4" : "var(--white)", fontSize: 11, fontWeight: 700, cursor: "pointer", color: form.Valyuta === v ? "var(--primary)" : "var(--text-2)" }}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 6 }}>Agent</label>
                  <select value={form.Agent} onChange={e => setForm(p => ({ ...p, Agent: e.target.value }))}
                    style={{ width: "100%", padding: "10px 14px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 14, outline: "none", background: "var(--white)", boxSizing: "border-box" }}>
                    <option value="">— Agent tanlanmagan —</option>
                    {agentlar.map(a => <option key={a.Foydalanuvchi_ID} value={a.Foydalanuvchi_ID}>{a.Nomi}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 6 }}>Boshlang&apos;ich qoldiq (so&apos;m)</label>
                  <input value={form.Boshlangich_Balans_som || ""} onChange={e => setForm(p => ({ ...p, Boshlangich_Balans_som: e.target.value }))} placeholder="0" inputMode="decimal"
                    style={{ width: "100%", padding: "10px 14px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 14, outline: "none", boxSizing: "border-box" }}/>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 6 }}>Boshlang&apos;ich qoldiq ($)</label>
                  <input value={form.Boshlangich_Balans_dollar || ""} onChange={e => setForm(p => ({ ...p, Boshlangich_Balans_dollar: e.target.value }))} placeholder="0" inputMode="decimal"
                    style={{ width: "100%", padding: "10px 14px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 14, outline: "none", boxSizing: "border-box" }}/>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, padding: "16px 20px", borderTop: "1px solid var(--border)", paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
                <button className="btn btn--outline" style={{ flex: 1 }} onClick={() => setDrawerOpen(false)}>Bekor</button>
                <button className="btn btn--primary" style={{ flex: 2 }} onClick={handleSave} disabled={saving || !form.Ism.trim()}>
                  {saving && <span className="spinner"/>} {editTarget ? "Saqlash" : "Qo'shish"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="drawer-overlay" onClick={() => setDrawerOpen(false)}/>
            <div className="drawer">
              <div className="drawer__head">
                <button className="drawer__back" onClick={() => setDrawerOpen(false)}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
                <span className="drawer__title">{editTarget ? "Mijozni tahrirlash" : "Yangi mijoz"}</span>
              </div>
              <div className="drawer__body">
                <div className="drawer__section">
                  <p className="drawer__section-label">Asosiy ma&apos;lumot</p>
                  <Field label="Ism *" value={form.Ism} placeholder="Mijoz nomi" onChange={v => setForm(p => ({ ...p, Ism: v }))} autoFocus/>
                  <Field label="Telefon" value={form.Telefon} placeholder="+998 __ ___ __ __" onChange={v => setForm(p => ({ ...p, Telefon: v }))}/>
                </div>
                <div className="drawer__section">
                  <p className="drawer__section-label">Valyuta</p>
                  <div className="pill-group">
                    {VALYUTALAR.map(v => (
                      <button key={v} type="button" className={`pill ${form.Valyuta === v ? "pill--active" : ""}`} onClick={() => setForm(p => ({ ...p, Valyuta: v }))}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="drawer__section">
                  <p className="drawer__section-label">Agent</p>
                  <select value={form.Agent} onChange={e => setForm(p => ({ ...p, Agent: e.target.value }))}
                    style={{ width: "100%", padding: "10px 14px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 14, outline: "none", background: "var(--bg)" }}>
                    <option value="">— Agent tanlanmagan —</option>
                    {agentlar.map(a => <option key={a.Foydalanuvchi_ID} value={a.Foydalanuvchi_ID}>{a.Nomi}</option>)}
                  </select>
                </div>
                <div className="drawer__section">
                  <p className="drawer__section-label">Boshlang&apos;ich qoldiq</p>
                  <Field label="So'm" value={form.Boshlangich_Balans_som || ""} placeholder="0" onChange={v => setForm(p => ({ ...p, Boshlangich_Balans_som: v }))}/>
                  <Field label="Dollar ($)" value={form.Boshlangich_Balans_dollar || ""} placeholder="0" onChange={v => setForm(p => ({ ...p, Boshlangich_Balans_dollar: v }))}/>
                </div>
              </div>
              <div className="drawer__footer">
                <button className="btn btn--outline" style={{ flex: 1 }} onClick={() => setDrawerOpen(false)}>Bekor qilish</button>
                <button className="btn btn--primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving || !form.Ism.trim()}>
                  {saving && <span className="spinner"/>}
                  {editTarget ? "Saqlash" : "Qo'shish"}
                </button>
              </div>
            </div>
          </>
        )
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="confirm" onClick={e => e.stopPropagation()}>
            <div className="confirm__icon">
              <svg width="24" height="24" fill="none" stroke="#ef4444" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </div>
            <h3 className="confirm__title">O&apos;chirishni tasdiqlang</h3>
            <p className="confirm__text"><strong>{deleteTarget.Ism}</strong> o&apos;chiriladi.</p>
            <div className="confirm__actions">
              <button className="btn btn--outline" style={{ flex: 1 }} onClick={() => setDeleteTarget(null)}>Bekor</button>
              <button className="btn btn--red" style={{ flex: 1 }} onClick={handleDelete} disabled={deleting}>
                {deleting && <span className="spinner"/>} O&apos;chirish
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, value, onChange, placeholder, autoFocus }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus}/>
    </div>
  );
}
