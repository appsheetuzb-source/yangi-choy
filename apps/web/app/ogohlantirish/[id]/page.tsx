"use client";
import { fetchSheets, afterWrite } from "@/lib/sheet-cache";
import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Mijoz { Mijoz_ID: string; Ism: string; Telefon?: string; Boshlangich_Balans_som?: string; Boshlangich_Balans_dollar?: string; }
interface Sotuv { Sotuv_ID: string; Mijoz_ID: string; Chek?: string; }
interface SavatSom { Sotuv_ID: string; Summa_som: string; }
interface SavatDollar { Sotuv_ID: string; Summa: string; }
interface STolov { Mijoz_ID: string; Valyuta: string; Summa: string; Summa_dollar: string; }
interface Ogoh { Ogoh_ID: string; Mijoz_ID: string; Sana?: string; Vaqt?: string; Status?: string; Izoh?: string; }

const STATUSES = ["Jarayonda", "Kechiktirildi", "Yakunlandi"];
const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  "Jarayonda": { bg: "#dbeafe", fg: "#1d4ed8" },
  "Kechiktirildi": { bg: "#fef3c7", fg: "#b45309" },
  "Yakunlandi": { bg: "#dcfce7", fg: "#15803d" },
};

function num(v: unknown) { return parseFloat(String(v ?? "0").replace(/\s/g, "").replace(",", ".")) || 0; }
function parseIds(v?: string) { return String(v || "").split(/\s*,\s*/).map(s => s.trim()).filter(Boolean); }
function joinIds(ids: string[]) { return ids.join(" , "); }
function isDollarV(v?: string) { const lv = String(v || "").toLowerCase().trim(); return lv.includes("dollar") || lv === "$"; }
function fmtSom(v: number) { return v.toLocaleString("ru-RU") + " so'm"; }
function fmtUsd(v: number) { return "$" + v.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function sanaToInput(s?: string) { const m = String(s || "").match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/); return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : ""; }
function inputToSana(v: string) { const m = v.match(/(\d{4})-(\d{2})-(\d{2})/); return m ? `${parseInt(m[3])}.${parseInt(m[2])}.${m[1]}` : v; }
function balColor(v: number) { return v > 0 ? "#ef4444" : v < 0 ? "#2563eb" : "#16a34a"; }
function balRGB(v: number): [number, number, number] { return v > 0 ? [239, 68, 68] : v < 0 ? [37, 99, 235] : [22, 163, 74]; }

type PdfRow = { mijoz: { Ism: string; Telefon?: string }; bal: { som: number; usd: number } };
function buildOgohPDF(sana: string, vaqt: string, status: string, rows: PdfRow[], totals: { som: number; usd: number }): jsPDF {
  const W = 210, margin = 12;
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // Header band (navy)
  doc.setFillColor(26, 39, 68);
  doc.rect(0, 0, W, 24, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(19);
  doc.text("MUSAFFO TEA", W / 2, 11.5, { align: "center" });
  doc.setFontSize(9); doc.setTextColor(245, 200, 66);
  doc.text("OGOHLANTIRISH  ·  MIJOZLAR OSTATKASI", W / 2, 18.5, { align: "center" });

  // Info strip
  let y = 24;
  doc.setFillColor(247, 248, 252); doc.rect(0, y, W, 11, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(45, 51, 72);
  doc.text(`Sana: ${sana || "—"}      Vaqt: ${vaqt || "—"}      Status: ${status || "—"}      Mijozlar: ${rows.length}`, margin, y + 7);
  y += 16;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["№", "Mijoz", "Telefon", "Ostatka (so'm)", "Ostatka ($)"]],
    body: rows.map((r, i) => [i + 1, r.mijoz.Ism, r.mijoz.Telefon || "", fmtSom(r.bal.som), fmtUsd(r.bal.usd)]),
    foot: [["", "JAMI", "", fmtSom(totals.som), fmtUsd(totals.usd)]],
    theme: "grid",
    styles: { fontStyle: "bold", lineColor: [150, 158, 185], lineWidth: 0.2, fontSize: 9.5, cellPadding: 2.2 },
    headStyles: { fillColor: [26, 39, 68], textColor: 255, fontStyle: "bold", fontSize: 9, lineColor: [26, 39, 68], lineWidth: 0.2, halign: "center" },
    bodyStyles: { fontSize: 9.5, textColor: [45, 51, 72] },
    footStyles: { fillColor: [238, 240, 248], textColor: [26, 39, 68], fontStyle: "bold", fontSize: 10 },
    alternateRowStyles: { fillColor: [247, 248, 252] },
    columnStyles: { 0: { halign: "center", cellWidth: 12 }, 2: { cellWidth: 38 }, 3: { halign: "right", cellWidth: 44 }, 4: { halign: "right", cellWidth: 34 } },
    didParseCell: (data) => {
      if (data.section === "body" && (data.column.index === 3 || data.column.index === 4)) {
        const r = rows[data.row.index];
        if (r) data.cell.styles.textColor = balRGB(data.column.index === 3 ? r.bal.som : r.bal.usd);
      }
    },
  });
  const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY || y;

  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(176, 184, 208);
  doc.text(`MUSAFFO TEA  ·  ${sana}`, W / 2, Math.min(finalY + 10, 290), { align: "center" });
  return doc;
}

export default function OgohDetailPage() {
  const router = useRouter();
  const params = useParams();
  const ogohId = String(params?.id || "");

  const [mijozlar, setMijozlar] = useState<Mijoz[]>([]);
  const [somMap, setSomMap] = useState<Record<string, number>>({});
  const [usdMap, setUsdMap] = useState<Record<string, number>>({});
  const [tSomMap, setTSomMap] = useState<Record<string, number>>({});
  const [tUsdMap, setTUsdMap] = useState<Record<string, number>>({});
  const [entry, setEntry] = useState<Ogoh | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [showPick, setShowPick] = useState(false);
  const [pick, setPick] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);

  useEffect(() => { const c = () => setIsMobile(window.innerWidth < 768); c(); window.addEventListener("resize", c); return () => window.removeEventListener("resize", c); }, []);

  function loadData() {
    setLoading(true);
    fetchSheets(["Mijozlar", "Sotuv", "Sotuv_Savat", "Sotuv_savat_dollar", "S_tolov", "Ogohlantirish"]).then(rr => {
      setMijozlar(((rr["Mijozlar"].data || []) as Mijoz[]).filter(m => m.Mijoz_ID && (m.Ism || "").trim()));
      const sotuvMijoz: Record<string, string> = {};
      ((rr["Sotuv"].data || []) as Sotuv[]).forEach(s => { if (String(s.Chek || "").toUpperCase() === "TRUE") { const id = String(s.Sotuv_ID || "").trim(); if (id) sotuvMijoz[id] = s.Mijoz_ID; } });
      const sSom: Record<string, number> = {};
      ((rr["Sotuv_Savat"].data || []) as SavatSom[]).forEach(r => { const mid = sotuvMijoz[String(r.Sotuv_ID || "").trim()]; if (mid) sSom[mid] = (sSom[mid] || 0) + num(r.Summa_som); });
      const sUsd: Record<string, number> = {};
      ((rr["Sotuv_savat_dollar"].data || []) as SavatDollar[]).forEach(r => { const mid = sotuvMijoz[String(r.Sotuv_ID || "").trim()]; if (mid) sUsd[mid] = (sUsd[mid] || 0) + num(r.Summa); });
      const tSom: Record<string, number> = {}, tUsd: Record<string, number> = {};
      ((rr["S_tolov"].data || []) as STolov[]).forEach(t => { const id = String(t.Mijoz_ID || "").trim(); if (!id) return; if (isDollarV(t.Valyuta)) tUsd[id] = (tUsd[id] || 0) + num(t.Summa_dollar); else tSom[id] = (tSom[id] || 0) + num(t.Summa); });
      setSomMap(sSom); setUsdMap(sUsd); setTSomMap(tSom); setTUsdMap(tUsd);
      const e = ((rr["Ogohlantirish"].data || []) as Ogoh[]).find(o => o.Ogoh_ID === ogohId);
      if (e) setEntry(e); else setNotFound(true);
    }).finally(() => setLoading(false));
  }
  useEffect(() => { if (ogohId) loadData(); }, [ogohId]);

  const mMap = useMemo(() => { const m: Record<string, Mijoz> = {}; mijozlar.forEach(x => m[x.Mijoz_ID] = x); return m; }, [mijozlar]);
  const balanceOf = useMemo(() => (mid: string) => {
    const m = mMap[mid];
    return {
      som: num(m?.Boshlangich_Balans_som) + (somMap[mid] || 0) - (tSomMap[mid] || 0),
      usd: num(m?.Boshlangich_Balans_dollar) + (usdMap[mid] || 0) - (tUsdMap[mid] || 0),
    };
  }, [mMap, somMap, usdMap, tSomMap, tUsdMap]);

  const selectedIds = useMemo(() => parseIds(entry?.Mijoz_ID), [entry]);
  const rows = useMemo(() => selectedIds.map(id => ({ id, mijoz: mMap[id], bal: balanceOf(id) }))
    .filter((x): x is { id: string; mijoz: Mijoz; bal: { som: number; usd: number } } => !!x.mijoz)
    .sort((a, b) => (a.mijoz.Ism || "").localeCompare(b.mijoz.Ism || "", "uz")), [selectedIds, mMap, balanceOf]);
  const totals = useMemo(() => rows.reduce((a, r) => ({ som: a.som + r.bal.som, usd: a.usd + r.bal.usd }), { som: 0, usd: 0 }), [rows]);

  async function patch(updates: Partial<Ogoh>) {
    if (!entry) return;
    setEntry({ ...entry, ...updates });
    try {
      await fetch("/api/sheets", { method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet: "Ogohlantirish", idColumn: "Ogoh_ID", idValue: ogohId, updates }) });
      afterWrite("Ogohlantirish");
    } catch {}
  }
  async function saveClients(ids: string[]) {
    setSaving(true);
    await patch({ Mijoz_ID: joinIds(ids) });
    setSaving(false);
  }
  function removeClient(id: string) { saveClients(selectedIds.filter(x => x !== id)); }
  function openPick() { setPick(selectedIds); setSearch(""); setShowPick(true); }
  function togglePick(id: string) { setPick(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]); }
  async function commitPick() { setShowPick(false); await saveClients(pick); }

  async function handlePrintPDF() {
    if (!entry || rows.length === 0) return;
    setPrinting(true);
    try {
      const doc = buildOgohPDF(entry.Sana || "", entry.Vaqt || "", entry.Status || "", rows, totals);
      const blob = doc.output("blob");
      const fileName = `ogohlantirish-${ogohId}.pdf`;
      const isMob = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const file = new File([blob], fileName, { type: "application/pdf" });
      if (isMob && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Ogohlantirish — Musaffo Tea" });
      } else {
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
    } catch {} finally { setPrinting(false); }
  }

  async function removeEntry() {
    if (!confirm("Bu ogohlantirishni o'chirasizmi?")) return;
    try {
      await fetch("/api/sheets", { method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet: "Ogohlantirish", idColumn: "Ogoh_ID", idValue: ogohId }) });
      afterWrite("Ogohlantirish");
    } catch {}
    router.push("/ogohlantirish");
  }

  const pickList = useMemo(() => mijozlar.filter(m =>
    (m.Ism || "").toLowerCase().includes(search.toLowerCase()) || (m.Telefon || "").includes(search))
    .sort((a, b) => (a.Ism || "").localeCompare(b.Ism || "", "uz")), [mijozlar, search]);

  return (
    <>
      <header className="header">
        <div className="header__inner">
          <button onClick={() => router.push("/ogohlantirish")} style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid var(--border)", background: "var(--white)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          </button>
          <h1 className="header__title" style={{ paddingLeft: 4 }}>Ogohlantirish tafsilotlari</h1>
          <div className="header__spacer" />
          <button className="btn btn--outline" onClick={handlePrintPDF} style={{ flexShrink: 0 }} disabled={rows.length === 0 || printing}>
            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
            {!isMobile && (printing ? "Tayyorlanmoqda..." : "Chop etish (PDF)")}
          </button>
          <button className="btn btn--outline" onClick={removeEntry} style={{ flexShrink: 0, color: "#ef4444", borderColor: "#fecaca" }}>
            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      </header>

      <div className="page-content" style={{ maxWidth: 820 }}>
        {loading && <div className="spinner--page" />}
        {!loading && notFound && (
          <div className="empty" style={{ padding: 40, textAlign: "center" }}>
            <p className="empty__title">Ogohlantirish topilmadi</p>
            <button className="btn btn--primary no-print" onClick={() => router.push("/ogohlantirish")}>Orqaga</button>
          </div>
        )}

        {!loading && entry && (
          <>
            {/* Meta — tahrirlash (chop etishda yashirin) */}
            <div className="no-print" style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", padding: isMobile ? 16 : 20, marginBottom: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 16 }}>
                <label style={{ display: "block" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-3)" }}>So&apos;ralgan muddat</span>
                  <input type="date" value={sanaToInput(entry.Sana)} onChange={e => patch({ Sana: inputToSana(e.target.value) })}
                    style={{ width: "100%", marginTop: 5, padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 10, fontSize: 14, background: "var(--bg)", outline: "none" }} />
                </label>
                <label style={{ display: "block" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-3)" }}>Berish vaqti</span>
                  <input type="time" step={1} value={(entry.Vaqt || "").slice(0, 8)} onChange={e => patch({ Vaqt: e.target.value })}
                    style={{ width: "100%", marginTop: 5, padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 10, fontSize: 14, background: "var(--bg)", outline: "none" }} />
                </label>
              </div>

              <div style={{ marginBottom: 16 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-3)" }}>Status</span>
                <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                  {STATUSES.map(s => {
                    const active = entry.Status === s; const c = STATUS_COLOR[s];
                    return (
                      <button key={s} onClick={() => patch({ Status: s })}
                        style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", border: active ? "none" : "1px solid var(--border)", background: active ? c.fg : "var(--white)", color: active ? "#fff" : "var(--text-2)" }}>
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label style={{ display: "block" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-3)" }}>Qo&apos;shimcha izoh</span>
                <input value={entry.Izoh || ""} onChange={e => setEntry({ ...entry, Izoh: e.target.value })} onBlur={e => patch({ Izoh: e.target.value })}
                  placeholder="Izoh..." style={{ width: "100%", marginTop: 5, padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 10, fontSize: 14, background: "var(--bg)", outline: "none" }} />
              </label>
            </div>

            {/* Mijozlarni tahrirlash tugmasi */}
            <div className="no-print" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>Tanlangan mijozlar ({rows.length})</span>
              <button className="btn btn--primary" onClick={openPick} disabled={saving} style={{ flexShrink: 0 }}>
                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                Mijozlarni tanlash
              </button>
            </div>

            {/* Mijozlar jadvali (ostatka bilan) */}
            <div style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
              {rows.length === 0 ? (
                <div className="empty" style={{ padding: 32, textAlign: "center" }}>
                  <p className="empty__title">Mijoz tanlanmagan</p>
                  <button className="btn btn--primary no-print" onClick={openPick}>+ Mijozlarni tanlash</button>
                </div>
              ) : (
                <>
                  {/* Sarlavha */}
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "24px 1fr 40px" : "32px 1fr 150px 140px 40px", gap: 8, alignItems: "center", padding: "10px 16px", background: "var(--bg)", fontSize: 11, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".04em", borderBottom: "1px solid var(--border)" }}>
                    <span>#</span><span>MIJOZ</span>
                    {!isMobile && <span style={{ textAlign: "right" }}>OSTATKA (SO&apos;M)</span>}
                    {!isMobile && <span style={{ textAlign: "right" }}>OSTATKA ($)</span>}
                    <span className="no-print" />
                  </div>
                  {rows.map((r, i) => (
                    <div key={r.id} style={{ display: "grid", gridTemplateColumns: isMobile ? "24px 1fr 40px" : "32px 1fr 150px 140px 40px", gap: 8, alignItems: "center", padding: "11px 16px", borderBottom: "1px solid var(--border)" }}>
                      <span style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 700 }}>{i + 1}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.mijoz.Ism}</div>
                        {r.mijoz.Telefon ? <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>{r.mijoz.Telefon}</div> : null}
                        {isMobile && (
                          <div style={{ display: "flex", gap: 12, marginTop: 3, fontSize: 12.5, fontWeight: 800 }}>
                            <span style={{ color: balColor(r.bal.som) }}>{fmtSom(r.bal.som)}</span>
                            <span style={{ color: balColor(r.bal.usd) }}>{fmtUsd(r.bal.usd)}</span>
                          </div>
                        )}
                      </div>
                      {!isMobile && <span style={{ textAlign: "right", fontSize: 13, fontWeight: 800, color: balColor(r.bal.som) }}>{fmtSom(r.bal.som)}</span>}
                      {!isMobile && <span style={{ textAlign: "right", fontSize: 13, fontWeight: 800, color: balColor(r.bal.usd) }}>{fmtUsd(r.bal.usd)}</span>}
                      <button className="no-print" onClick={() => removeClient(r.id)} title="Olib tashlash"
                        style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", justifySelf: "end" }}>
                        <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>
                    </div>
                  ))}
                  {/* Jami */}
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr auto" : "32px 1fr 150px 140px 40px", gap: 8, alignItems: "center", padding: "12px 16px", background: "var(--bg)", fontWeight: 800 }}>
                    {!isMobile && <span />}
                    <span style={{ fontSize: 13 }}>JAMI</span>
                    {isMobile ? (
                      <span style={{ display: "flex", gap: 12, justifyContent: "flex-end", fontSize: 13 }}>
                        <span style={{ color: balColor(totals.som) }}>{fmtSom(totals.som)}</span>
                        <span style={{ color: balColor(totals.usd) }}>{fmtUsd(totals.usd)}</span>
                      </span>
                    ) : (
                      <>
                        <span style={{ textAlign: "right", fontSize: 13, color: balColor(totals.som) }}>{fmtSom(totals.som)}</span>
                        <span style={{ textAlign: "right", fontSize: 13, color: balColor(totals.usd) }}>{fmtUsd(totals.usd)}</span>
                        <span className="no-print" />
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Mijoz tanlash (multi-select) */}
      {showPick && (
        <div className="no-print" onClick={commitPick}
          style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(15,42,76,.42)", backdropFilter: "blur(4px)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", padding: isMobile ? 0 : 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "var(--white)", width: "100%", maxWidth: isMobile ? "100%" : 460, borderRadius: isMobile ? "20px 20px 0 0" : 16, display: "flex", flexDirection: "column", maxHeight: isMobile ? "88dvh" : "82vh" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
              <h2 style={{ fontSize: 16, fontWeight: 800 }}>Mijozlarni tanlash <span style={{ color: "var(--primary)" }}>({pick.length})</span></h2>
              <button onClick={commitPick} className="btn btn--primary" style={{ padding: "6px 16px" }}>Tayyor</button>
            </div>
            <div style={{ padding: "12px 20px 8px" }}>
              <input placeholder="Ism yoki telefon..." value={search} onChange={e => setSearch(e.target.value)} autoFocus
                style={{ width: "100%", padding: "10px 14px", background: "var(--bg-2)", border: "1px solid var(--border-2)", borderRadius: 10, fontSize: 14, outline: "none" }} />
            </div>
            {pickList.length > 0 && (() => {
              const filteredIds = pickList.map(m => m.Mijoz_ID);
              const allSelected = filteredIds.every(id => pick.includes(id));
              return (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px 10px", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-3)" }}>
                    {pickList.length} mijoz{search ? " (filtr)" : ""} · belgilangan {pick.length}
                  </span>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => {
                      if (allSelected) setPick(prev => prev.filter(id => !filteredIds.includes(id)));
                      else setPick(prev => Array.from(new Set([...prev, ...filteredIds])));
                    }} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--white)", cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "var(--primary)" }}>
                      {allSelected ? "Belgilashni olib tashlash" : "Hammasini tanlash"}
                    </button>
                    {pick.length > 0 && (
                      <button onClick={() => setPick([])}
                        style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #fecaca", background: "var(--white)", cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "#ef4444" }}>
                        Tozalash
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
            <div style={{ flex: 1, overflowY: "auto", padding: "0 12px 12px" }}>
              {pickList.length === 0 ? <p style={{ textAlign: "center", color: "var(--text-3)", padding: 20, fontSize: 13 }}>Mijoz topilmadi</p>
                : pickList.slice(0, 200).map(m => {
                  const on = pick.includes(m.Mijoz_ID);
                  const b = balanceOf(m.Mijoz_ID);
                  return (
                    <button key={m.Mijoz_ID} onClick={() => togglePick(m.Mijoz_ID)}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "none", borderRadius: 10, background: on ? "var(--primary-soft, #eef2ff)" : "transparent", cursor: "pointer", textAlign: "left" }}>
                      <span style={{ width: 20, height: 20, borderRadius: 6, border: on ? "none" : "2px solid var(--border-2)", background: on ? "var(--primary)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {on && <svg width="13" height="13" fill="none" stroke="#fff" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                      </span>
                      <span style={{ minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{m.Ism}</span>
                        {m.Telefon ? <span style={{ fontSize: 12, color: "var(--text-3)" }}> · {m.Telefon}</span> : null}
                      </span>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: (b.som > 0 || b.usd > 0) ? "#ef4444" : "var(--text-3)", whiteSpace: "nowrap", flexShrink: 0 }}>
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
