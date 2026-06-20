"use client";
import { fetchSheets, afterWrite } from "@/lib/sheet-cache";
import { useEffect, useState, useMemo } from "react";

interface Mijoz { Mijoz_ID: string; Ism: string; Telefon?: string; Boshlangich_Balans_som?: string; Boshlangich_Balans_dollar?: string; }
interface Sotuv { Sotuv_ID: string; Mijoz_ID: string; Chek?: string; }
interface SavatSom { Sotuv_ID: string; Summa_som: string; }
interface SavatDollar { Sotuv_ID: string; Summa: string; }
interface STolov { Mijoz_ID: string; Valyuta: string; Summa: string; Summa_dollar: string; }
interface Ogoh { Ogoh_ID: string; Mijoz_ID: string; Sana?: string; Vaqt?: string; }

function num(v: unknown) { return parseFloat(String(v ?? "0").replace(/\s/g, "").replace(",", ".")) || 0; }
function uid() { return Math.random().toString(36).slice(2, 10); }
function isDollarV(v?: string) { const lv = String(v || "").toLowerCase().trim(); return lv.includes("dollar") || lv === "$"; }
function fmtSom(v: number) { return v.toLocaleString("ru-RU") + " so'm"; }
function fmtUsd(v: number) { return "$" + v.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function nowStr() {
  const t = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tashkent" }));
  const pad = (n: number) => String(n).padStart(2, "0");
  const sana = `${pad(t.getDate())}.${pad(t.getMonth() + 1)}.${t.getFullYear()}`;
  const vaqt = `${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`;
  return { sana, vaqt };
}

export default function OgohlantirishPage() {
  const [mijozlar, setMijozlar] = useState<Mijoz[]>([]);
  const [somMap, setSomMap] = useState<Record<string, number>>({});
  const [usdMap, setUsdMap] = useState<Record<string, number>>({});
  const [tSomMap, setTSomMap] = useState<Record<string, number>>({});
  const [tUsdMap, setTUsdMap] = useState<Record<string, number>>({});
  const [ogoh, setOgoh] = useState<Ogoh[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => { const c = () => setIsMobile(window.innerWidth < 768); c(); window.addEventListener("resize", c); return () => window.removeEventListener("resize", c); }, []);

  function loadData() {
    setLoading(true);
    fetchSheets(["Mijozlar", "Sotuv", "Sotuv_Savat", "Sotuv_savat_dollar", "S_tolov", "Ogohlantirish"]).then(rr => {
      const mz = ((rr["Mijozlar"].data || []) as Mijoz[]).filter(m => m.Mijoz_ID && (m.Ism || "").trim());
      setMijozlar(mz);
      const sotuvMijoz: Record<string, string> = {};
      ((rr["Sotuv"].data || []) as Sotuv[]).forEach(s => { if (String(s.Chek || "").toUpperCase() === "TRUE") { const id = String(s.Sotuv_ID || "").trim(); if (id) sotuvMijoz[id] = s.Mijoz_ID; } });
      const sSom: Record<string, number> = {};
      ((rr["Sotuv_Savat"].data || []) as SavatSom[]).forEach(r => { const mid = sotuvMijoz[String(r.Sotuv_ID || "").trim()]; if (mid) sSom[mid] = (sSom[mid] || 0) + num(r.Summa_som); });
      const sUsd: Record<string, number> = {};
      ((rr["Sotuv_savat_dollar"].data || []) as SavatDollar[]).forEach(r => { const mid = sotuvMijoz[String(r.Sotuv_ID || "").trim()]; if (mid) sUsd[mid] = (sUsd[mid] || 0) + num(r.Summa); });
      const tSom: Record<string, number> = {}, tUsd: Record<string, number> = {};
      ((rr["S_tolov"].data || []) as STolov[]).forEach(t => { const id = String(t.Mijoz_ID || "").trim(); if (!id) return; if (isDollarV(t.Valyuta)) tUsd[id] = (tUsd[id] || 0) + num(t.Summa_dollar); else tSom[id] = (tSom[id] || 0) + num(t.Summa); });
      setSomMap(sSom); setUsdMap(sUsd); setTSomMap(tSom); setTUsdMap(tUsd);
      setOgoh(((rr["Ogohlantirish"].data || []) as Ogoh[]).filter(o => o.Ogoh_ID && o.Mijoz_ID));
    }).finally(() => setLoading(false));
  }
  useEffect(() => { loadData(); }, []);

  const mMap = useMemo(() => { const m: Record<string, Mijoz> = {}; mijozlar.forEach(x => m[x.Mijoz_ID] = x); return m; }, [mijozlar]);
  const balanceOf = useMemo(() => (mid: string) => {
    const m = mMap[mid];
    return {
      som: num(m?.Boshlangich_Balans_som) + (somMap[mid] || 0) - (tSomMap[mid] || 0),
      usd: num(m?.Boshlangich_Balans_dollar) + (usdMap[mid] || 0) - (tUsdMap[mid] || 0),
    };
  }, [mMap, somMap, usdMap, tSomMap, tUsdMap]);

  const watchedIds = useMemo(() => new Set(ogoh.map(o => o.Mijoz_ID)), [ogoh]);
  const watched = useMemo(() => ogoh.map(o => ({ ogohId: o.Ogoh_ID, mijoz: mMap[o.Mijoz_ID], bal: balanceOf(o.Mijoz_ID) }))
    .filter((x): x is { ogohId: string; mijoz: Mijoz; bal: { som: number; usd: number } } => !!x.mijoz)
    .sort((a, b) => (a.mijoz.Ism || "").localeCompare(b.mijoz.Ism || "", "uz")), [ogoh, mMap, balanceOf]);

  const addable = useMemo(() => mijozlar.filter(m => !watchedIds.has(m.Mijoz_ID) &&
    ((m.Ism || "").toLowerCase().includes(search.toLowerCase()) || (m.Telefon || "").includes(search)))
    .sort((a, b) => (a.Ism || "").localeCompare(b.Ism || "", "uz")), [mijozlar, watchedIds, search]);

  async function addMijoz(mid: string) {
    setAdding(mid);
    const { sana, vaqt } = nowStr();
    try {
      await fetch("/api/sheets", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet: "Ogohlantirish", row: { Ogoh_ID: uid(), Mijoz_ID: mid, Sana: sana, Vaqt: vaqt, Status: "", Izoh: "", Qoshilgan_vaqt: `${sana} ${vaqt}`, Chek_file: "", Chek: "", Change: "" } }) });
      afterWrite("Ogohlantirish");
      setTimeout(loadData, 600);
    } finally { setAdding(""); }
  }
  async function removeOgoh(ogohId: string) {
    setOgoh(prev => prev.filter(o => o.Ogoh_ID !== ogohId));
    try {
      await fetch("/api/sheets", { method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet: "Ogohlantirish", idColumn: "Ogoh_ID", idValue: ogohId }) });
      afterWrite("Ogohlantirish");
    } catch {}
  }

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .ogoh-print-only { display: block !important; }
          body { background: #fff !important; }
        }
        .ogoh-print-only { display: none; }
        .ogoh-row { display: grid; grid-template-columns: 32px 1fr 160px 160px 40px; gap: 8px; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--border); }
        @media (max-width: 767px) { .ogoh-row { grid-template-columns: 24px 1fr 40px; row-gap: 4px; } .ogoh-row .ogoh-bal { grid-column: 2 / 4; } }
      `}</style>

      <header className="header">
        <div className="header__inner">
          <h1 className="header__title" style={{ paddingLeft: 4 }}>Ogohlantirish</h1>
          <span style={{ fontSize: 11, color: "var(--text-3)", paddingLeft: 4 }}>Kuzatiladigan mijozlar ostatkasi</span>
          <div className="header__spacer" />
          <button className="btn btn--outline no-print" onClick={() => window.print()} style={{ flexShrink: 0 }}>
            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
            Chop etish
          </button>
          <button className="btn btn--primary no-print" onClick={() => setShowAdd(true)} style={{ flexShrink: 0 }}>
            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Mijoz qo&apos;shish
          </button>
        </div>
      </header>

      <div className="page-content" style={{ maxWidth: 880 }}>
        {loading && <div className="spinner--page" />}

        {!loading && (
          <>
            {/* Print sarlavhasi */}
            <div className="ogoh-print-only" style={{ marginBottom: 12 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800 }}>Ogohlantirish — mijozlar ostatkasi</h2>
              <p style={{ fontSize: 12, color: "#555" }}>{nowStr().sana} {nowStr().vaqt}</p>
            </div>

            <div style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
              <p className="count-label no-print" style={{ padding: "12px 16px 0" }}>{watched.length} ta kuzatiladigan mijoz</p>
              {/* Sarlavha (desktop) */}
              {!isMobile && watched.length > 0 && (
                <div className="ogoh-row" style={{ background: "var(--bg)", fontSize: 11, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".05em", borderTop: "1px solid var(--border)" }}>
                  <span>#</span><span>MIJOZ</span><span style={{ textAlign: "right" }}>OSTATKA (SO&apos;M)</span><span style={{ textAlign: "right" }}>OSTATKA ($)</span><span />
                </div>
              )}
              {watched.length === 0 ? (
                <div className="empty" style={{ padding: 32 }}>
                  <p className="empty__title">Hech qanday mijoz tanlanmagan</p>
                  <button className="btn btn--primary no-print" onClick={() => setShowAdd(true)}>+ Mijoz qo&apos;shish</button>
                </div>
              ) : watched.map((w, i) => (
                <div key={w.ogohId} className="ogoh-row">
                  <span style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 700 }}>{i + 1}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {w.mijoz.Ism}{w.mijoz.Telefon ? <span style={{ color: "var(--text-3)", fontWeight: 500, fontSize: 12 }}> · {w.mijoz.Telefon}</span> : null}
                  </span>
                  <span className="ogoh-bal" style={{ textAlign: isMobile ? "left" : "right", fontSize: 13, fontWeight: 800, color: w.bal.som > 0 ? "#ef4444" : w.bal.som < 0 ? "#2563eb" : "#16a34a", display: "flex", gap: 12, justifyContent: isMobile ? "flex-start" : "flex-end" }}>
                    <span>{fmtSom(w.bal.som)}</span>
                    {isMobile && <span style={{ color: w.bal.usd > 0 ? "#ef4444" : w.bal.usd < 0 ? "#2563eb" : "#16a34a" }}>{fmtUsd(w.bal.usd)}</span>}
                  </span>
                  {!isMobile && <span style={{ textAlign: "right", fontSize: 13, fontWeight: 800, color: w.bal.usd > 0 ? "#ef4444" : w.bal.usd < 0 ? "#2563eb" : "#16a34a" }}>{fmtUsd(w.bal.usd)}</span>}
                  <button className="no-print" onClick={() => removeOgoh(w.ogohId)} title="O'chirish"
                    style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Mijoz qo'shish oynasi */}
      {showAdd && (
        <div className="no-print" onClick={() => setShowAdd(false)}
          style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(15,42,76,.42)", backdropFilter: "blur(4px)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", padding: isMobile ? 0 : 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "var(--white)", width: "100%", maxWidth: isMobile ? "100%" : 440, borderRadius: isMobile ? "20px 20px 0 0" : 16, display: "flex", flexDirection: "column", maxHeight: isMobile ? "85dvh" : "80vh" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
              <h2 style={{ fontSize: 16, fontWeight: 800 }}>Mijoz qo&apos;shish</h2>
              <button onClick={() => setShowAdd(false)} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border)", background: "var(--white)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div style={{ padding: "12px 20px" }}>
              <input className="search__input" placeholder="Ism yoki telefon..." value={search} onChange={e => setSearch(e.target.value)} autoFocus
                style={{ width: "100%", padding: "10px 14px", background: "var(--bg-2)", border: "1px solid var(--border-2)", borderRadius: 10, fontSize: 14, outline: "none" }} />
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "0 12px 12px" }}>
              {addable.length === 0 ? <p style={{ textAlign: "center", color: "var(--text-3)", padding: 20, fontSize: 13 }}>Mijoz topilmadi</p>
                : addable.slice(0, 100).map(m => {
                  const b = balanceOf(m.Mijoz_ID);
                  return (
                    <button key={m.Mijoz_ID} disabled={adding === m.Mijoz_ID} onClick={() => addMijoz(m.Mijoz_ID)}
                      style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 12px", border: "none", borderRadius: 10, background: "transparent", cursor: "pointer", textAlign: "left", opacity: adding === m.Mijoz_ID ? .5 : 1 }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--bg)")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{m.Ism}</span>
                        {m.Telefon ? <span style={{ fontSize: 12, color: "var(--text-3)" }}> · {m.Telefon}</span> : null}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: (b.som > 0 || b.usd > 0) ? "#ef4444" : "var(--text-3)", whiteSpace: "nowrap", flexShrink: 0 }}>
                        {b.som !== 0 ? fmtSom(b.som) : ""}{b.som !== 0 && b.usd !== 0 ? " · " : ""}{b.usd !== 0 ? fmtUsd(b.usd) : (b.som === 0 ? "0" : "")}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
