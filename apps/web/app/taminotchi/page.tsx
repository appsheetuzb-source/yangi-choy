"use client";
import { fetchSheet, afterWrite } from "@/lib/sheet-cache";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Taminotchi {
  Taminotchi_ID: string; Ism: string; Telefon: string; Valyuta: string;
  Boshlangich_Balans: string; Boshlangich_som: string;
  Qoshilgan_Vaqt: string; Qoshdi: string;
}
interface Xarid { Xarid_ID: string; Taminotchi_ID: string; }
interface XaridSavat { Xarid_ID: string; Summa_Som: string; Jami_Summa: string; }
interface XTolov { X_Tolov_ID: string; Taminotchi_ID: string; Summa: string; Summa_dollar: string; }

const VALYUTALAR = ["So'm", "Dollar", "Dollar , So'm"];
const EMPTY: Taminotchi = {
  Taminotchi_ID: "", Ism: "", Telefon: "", Valyuta: "So'm",
  Boshlangich_Balans: "", Boshlangich_som: "", Qoshilgan_Vaqt: "", Qoshdi: "",
};

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

export default function TaminotchiPage() {
  const router = useRouter();
  const [taminotchilar, setTaminotchilar] = useState<Taminotchi[]>([]);
  const [xaridSavatByT, setXaridSavatByT] = useState<Record<string, { som: number; usd: number }>>({});
  const [tolovByT, setTolovByT]           = useState<Record<string, { som: number; usd: number }>>({});
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [search, setSearch]               = useState("");
  const [isMobile, setIsMobile]           = useState(false);

  const [drawerOpen, setDrawerOpen]       = useState(false);
  const [editTarget, setEditTarget]       = useState<Taminotchi | null>(null);
  const [form, setForm]                   = useState<Taminotchi>(EMPTY);
  const [saving, setSaving]               = useState(false);
  const [deleteTarget, setDeleteTarget]   = useState<Taminotchi | null>(null);
  const [deleting, setDeleting]           = useState(false);

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
        fetchSheet("Taminotchi"),
        fetchSheet("Xarid"),
        fetchSheet("Xarid_Savat"),
        fetchSheet("X_Tolov").catch(() => ({ data: [] })),
      ]).then(([tR, xR, xsR, tolvR]) => {
        if (tR.error) throw new Error(tR.error);
        setTaminotchilar(tR.data as Taminotchi[]);
        const xToT: Record<string, string> = {};
        (xR.data as Xarid[]).forEach(x => { xToT[String(x.Xarid_ID).trim()] = x.Taminotchi_ID; });
        const xByT: Record<string, { som: number; usd: number }> = {};
        (xsR.data as XaridSavat[]).forEach(s => {
          const tid = xToT[String(s.Xarid_ID).trim()];
          if (!tid) return;
          if (!xByT[tid]) xByT[tid] = { som: 0, usd: 0 };
          xByT[tid].som += num(s.Summa_Som);
          xByT[tid].usd += num(s.Jami_Summa);
        });
        setXaridSavatByT(xByT);
        const tlByT: Record<string, { som: number; usd: number }> = {};
        ((tolvR.data || []) as XTolov[]).forEach(t => {
          const tid = String(t.Taminotchi_ID || "").trim();
          if (!tid) return;
          if (!tlByT[tid]) tlByT[tid] = { som: 0, usd: 0 };
          tlByT[tid].som += num(t.Summa);
          tlByT[tid].usd += num(t.Summa_dollar);
        });
        setTolovByT(tlByT);
      })
      .catch(e => setError(e instanceof Error ? e.message : "Xatolik"))
      .finally(() => setLoading(false));
    }, delay);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = taminotchilar.filter(t =>
    String(t.Ism || "").toLowerCase().includes(search.toLowerCase()) ||
    String(t.Telefon || "").includes(search)
  );

  function openAdd() { setEditTarget(null); setForm({ ...EMPTY, Taminotchi_ID: uid() }); setDrawerOpen(true); }
  function openEdit(t: Taminotchi, e: React.MouseEvent) {
    e.stopPropagation();
    setEditTarget(t); setForm({ ...t }); setDrawerOpen(true);
  }

  async function handleSave() {
    if (!form.Ism.trim()) return;
    setSaving(true);
    try {
      if (editTarget) {
        await fetch("/api/sheets", { method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sheet: "Taminotchi", idColumn: "Taminotchi_ID", idValue: editTarget.Taminotchi_ID, row: form }) });
      } else {
        await fetch("/api/sheets", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sheet: "Taminotchi", row: form }) });
      }
      setDrawerOpen(false); afterWrite("Taminotchi"); loadData(800);
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch("/api/sheets", { method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet: "Taminotchi", idColumn: "Taminotchi_ID", idValue: deleteTarget.Taminotchi_ID }) });
      setDeleteTarget(null); loadData(800);
    } finally { setDeleting(false); }
  }

  const modalOverlay: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,.45)",
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
          <h1 className="header__title" style={{ paddingLeft: 4 }}>Ta&apos;minotchilar</h1>
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
          {isMobile ? (
            <button className="btn btn--primary" style={{ flexShrink: 0 }} onClick={openAdd}>
              <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            </button>
          ) : (
            <button className="btn btn--primary" onClick={openAdd}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              Qo&apos;shish
            </button>
          )}
        </div>
      </header>

      <div className="page-content">
        {loading && <div className="spinner--page"/>}
        {error && <div className="error-box"><p>{error}</p></div>}

        {!loading && !error && (
          <>
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

            <p className="count-label">{filtered.length} ta ta&apos;minotchi</p>

            {filtered.length === 0 ? (
              <div className="empty">
                <div className="empty__icon">🏭</div>
                <p className="empty__title">Ta&apos;minotchi topilmadi</p>
                <button className="btn btn--primary" onClick={openAdd}>+ Yangi ta&apos;minotchi</button>
              </div>
            ) : isMobile ? (
              /* ── MOBILE cards ── */
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {filtered.map((t) => {
                  const bSom = num(t.Boshlangich_som);
                  const bUsd = num(t.Boshlangich_Balans);
                  const xarid = xaridSavatByT[t.Taminotchi_ID] || { som: 0, usd: 0 };
                  const tolov = tolovByT[t.Taminotchi_ID]       || { som: 0, usd: 0 };
                  const qarzSom = bSom + xarid.som - tolov.som;
                  const qarzUsd = bUsd + xarid.usd - tolov.usd;
                  return (
                    <div key={t.Taminotchi_ID}
                      onClick={() => router.push(`/taminotchi/${t.Taminotchi_ID}`)}
                      style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", padding: "16px", cursor: "pointer" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                        <div style={{ width: 42, height: 42, borderRadius: "50%", background: "var(--primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                          {initials(t.Ism)}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 15, fontWeight: 800 }}>{t.Ism}</p>
                          {t.Telefon && <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{t.Telefon}</p>}
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={e => openEdit(t, e)}
                            style={{ width: 32, height: 32, borderRadius: 10, border: "1px solid #dbeafe", background: "#eff6ff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563eb" }}>
                            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                          </button>
                          <button onClick={e => { e.stopPropagation(); setDeleteTarget(t); }}
                            style={{ width: 32, height: 32, borderRadius: 10, border: "1px solid #fee2e2", background: "#fff1f2", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444" }}>
                            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          </button>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <ValyutaBadge valyuta={t.Valyuta}/>
                        <span style={{ fontSize: 12, color: "var(--text-3)" }}>Qarz:</span>
                        {(qarzSom !== 0 || qarzUsd !== 0) ? (
                          <>
                            {qarzSom !== 0 && <span style={{ fontSize: 13, fontWeight: 800, color: qarzSom > 0 ? "#ef4444" : "#16a34a" }}>{fmtSom(qarzSom)}</span>}
                            {qarzUsd !== 0 && <span style={{ fontSize: 13, fontWeight: 800, color: qarzUsd > 0 ? "#ef4444" : "#16a34a" }}>{fmtUsd(qarzUsd)}</span>}
                          </>
                        ) : <span style={{ fontSize: 13, fontWeight: 700, color: "#16a34a" }}>0</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* ── DESKTOP table ── */
              <div style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "56px 1fr 110px 160px 160px 160px 160px 80px", padding: "10px 20px", background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
                  {["", "ISM", "VALYUTA", "BOSHLANG'ICH", "XARID SUMMASI", "TO'LOV", "JORIY QARZ", ""].map(h => (
                    <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".05em" }}>{h}</span>
                  ))}
                </div>
                {filtered.map((t, i) => {
                  const bSom = num(t.Boshlangich_som);
                  const bUsd = num(t.Boshlangich_Balans);
                  const xarid = xaridSavatByT[t.Taminotchi_ID] || { som: 0, usd: 0 };
                  const tolov = tolovByT[t.Taminotchi_ID]       || { som: 0, usd: 0 };
                  const qarzSom = bSom + xarid.som - tolov.som;
                  const qarzUsd = bUsd + xarid.usd - tolov.usd;
                  return (
                    <div key={t.Taminotchi_ID || i}
                      onClick={() => router.push(`/taminotchi/${t.Taminotchi_ID}`)}
                      style={{ display: "grid", gridTemplateColumns: "56px 1fr 110px 160px 160px 160px 160px 80px", padding: "14px 20px", alignItems: "center", borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none", cursor: "pointer" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
                          {initials(t.Ism)}
                        </div>
                      </div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700 }}>{t.Ism || "—"}</p>
                        {t.Telefon && <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{t.Telefon}</p>}
                      </div>
                      <div><ValyutaBadge valyuta={t.Valyuta}/></div>
                      <BalansCell som={bSom} usd={bUsd}/>
                      <BalansCell som={xarid.som} usd={xarid.usd}/>
                      <BalansCell som={tolov.som} usd={tolov.usd}/>
                      <BalansCell som={qarzSom} usd={qarzUsd} label="balans"/>
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }} onClick={e => e.stopPropagation()}>
                        <button className="icon-btn icon-btn--blue" onClick={e => openEdit(t, e)}>
                          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </button>
                        <button className="icon-btn icon-btn--red" onClick={e => { e.stopPropagation(); setDeleteTarget(t); }}>
                          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Add/Edit Modal (mobile: bottom sheet, desktop: drawer) ── */}
      {drawerOpen && (
        isMobile ? (
          <div style={modalOverlay} onClick={() => setDrawerOpen(false)}>
            <div style={modalBox} onClick={e => e.stopPropagation()}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--border)", margin: "12px auto 0" }}/>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
                <h2 style={{ fontSize: 16, fontWeight: 800 }}>{editTarget ? "Tahrirlash" : "Yangi ta'minotchi"}</h2>
                <button onClick={() => setDrawerOpen(false)} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border)", background: "var(--white)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
              <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 6 }}>Ism *</label>
                  <input value={form.Ism} onChange={e => setForm(p => ({ ...p, Ism: e.target.value }))} placeholder="Ta'minotchi nomi" autoFocus
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
                {(form.Valyuta.toLowerCase().includes("so'm") || form.Valyuta.toLowerCase().includes("som")) && (
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 6 }}>Boshlang'ich balans (so'm)</label>
                    <input value={form.Boshlangich_som} onChange={e => setForm(p => ({ ...p, Boshlangich_som: e.target.value }))} placeholder="0" inputMode="numeric"
                      style={{ width: "100%", padding: "10px 14px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 14, outline: "none", boxSizing: "border-box" }}/>
                  </div>
                )}
                {form.Valyuta.toLowerCase().includes("dollar") && (
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#2563eb", display: "block", marginBottom: 6 }}>Boshlang'ich balans ($)</label>
                    <input value={form.Boshlangich_Balans} onChange={e => setForm(p => ({ ...p, Boshlangich_Balans: e.target.value }))} placeholder="0" inputMode="decimal"
                      style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #bfdbfe", borderRadius: "var(--radius)", fontSize: 14, outline: "none", color: "#2563eb", boxSizing: "border-box" }}/>
                  </div>
                )}
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
                <span className="drawer__title">{editTarget ? "Ta'minotchini tahrirlash" : "Yangi ta'minotchi"}</span>
              </div>
              <div className="drawer__body">
                <div className="drawer__section">
                  <p className="drawer__section-label">Asosiy ma&apos;lumot</p>
                  <Field label="Ism *" value={form.Ism} placeholder="Ta'minotchi nomi" onChange={v => setForm(p => ({ ...p, Ism: v }))} autoFocus/>
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
                  <p className="drawer__section-label">Boshlang&apos;ich balans</p>
                  {(form.Valyuta.toLowerCase().includes("so'm") || form.Valyuta.toLowerCase().includes("som")) && (
                    <Field label="Balans (so'm)" value={form.Boshlangich_som} placeholder="0" onChange={v => setForm(p => ({ ...p, Boshlangich_som: v }))}/>
                  )}
                  {form.Valyuta.toLowerCase().includes("dollar") && (
                    <Field label="Balans ($)" value={form.Boshlangich_Balans} placeholder="0" onChange={v => setForm(p => ({ ...p, Boshlangich_Balans: v }))}/>
                  )}
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
            <div className="confirm__icon"><svg width="24" height="24" fill="none" stroke="#ef4444" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></div>
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
