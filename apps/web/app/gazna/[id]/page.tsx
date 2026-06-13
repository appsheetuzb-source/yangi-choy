"use client";
import { fetchSheet } from "@/lib/sheet-cache";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";

interface Gazna {
  Gazna_ID: string; Nomi: string; Boshlangich_balans: string;
  Turi: string; Shakli: string; Boshlanish_Sana: string;
  Tugash_Sana: string; Masul: string; Status: string;
}
interface STolov {
  Tolov_ID: string; Sana: string; Valyuta: string; Turi: string;
  Summa: string; Summa_dollar: string; Izoh: string; Vaqt: string;
  Gazna_ID: string; Gazna_dollar_ID: string;
}
interface XTolov {
  X_Tolov_ID: string; Sana: string; Valyuta: string; Turi: string;
  Summa: string; Summa_dollar: string; Izoh: string; Vaqt: string;
  Gazna_ID: string; Gazna_dollar_ID: string;
}
interface Xarajat {
  Xarajat_ID: string; Sana: string; Vaqt?: string; Nomi: string; Izoh: string;
  Som: string; Dollar: string;
  Gazna_ID: string; Gazna_dollar_ID: string;
}
type Tx = {
  id: string; sana: string; tur: string; tavsif: string;
  kirdi: number; chiqdi: number; valyuta: string; sortKey: string;
};

function num(v: string | number | undefined) {
  return parseFloat(String(v || "0").replace(/\s/g, "").replace(",", ".")) || 0;
}
function fmtNum(v: number) {
  return v.toLocaleString("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function parseSana(s: string): Date | null {
  if (!s || !s.includes(".")) return null;
  const [dd, mm, yyyy] = s.split(".");
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
}
function inRange(sana: string, from: string, to: string): boolean {
  const d = parseSana(sana);
  if (!d) return false;
  if (from) { const f = new Date(from); f.setHours(0,0,0,0); if (d < f) return false; }
  if (to)   { const t = new Date(to);   t.setHours(23,59,59,999); if (d > t) return false; }
  return true;
}
function isoToDMY(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}
function dmyToISO(dmy: string) {
  if (!dmy || !dmy.includes(".")) return "";
  const [d, m, y] = dmy.split(".");
  return `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`;
}

const BLANK_FORM = { Nomi: "", Turi: "So'm", Shakli: "Barchasi", Boshlangich_balans: "", Boshlanish_Sana: "" };

export default function GaznaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [gazna, setGazna]     = useState<Gazna | null>(null);
  const [stolov, setStolov]   = useState<STolov[]>([]);
  const [xtolov, setXtolov]   = useState<XTolov[]>([]);
  const [xarajatlar, setXarajatlar] = useState<Xarajat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [activeTur, setActiveTur] = useState("Barchasi");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState(todayISO());
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState({ ...BLANK_FORM });
  const [selectedTx, setSelectedTx] = useState<Tx | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check(); window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const loadData = useCallback(() => {
    if (!id) return;
    setLoading(true); setError(null);
    Promise.all([
      fetchSheet("Gazna"),
      fetchSheet("S_tolov"),
      fetchSheet("X_tolov"),
      fetchSheet("Xarajat"),
    ]).then(([gR, sR, xR, xrR]) => {
      if (gR.error) throw new Error(gR.error);
      if (sR.error) throw new Error(sR.error);
      if (xR.error) throw new Error(xR.error);
      setGazna(((gR.data as Gazna[]) || []).find(g => g.Gazna_ID === id) || null);
      setStolov((sR.data as STolov[]) || []);
      setXtolov((xR.data as XTolov[]) || []);
      setXarajatlar((xrR.data as Xarajat[]) || []);
    })
    .catch((e: unknown) => setError(e instanceof Error ? e.message : "Xatolik"))
    .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return (
    <div className="page-content" style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
      <div className="spinner--page"/>
    </div>
  );
  if (error) return (
    <div className="page-content"><div className="error-box"><p>{error}</p></div></div>
  );
  if (!gazna) return (
    <div className="page-content">
      <div className="empty">
        <p className="empty__title">Gazna topilmadi</p>
        <button className="btn btn--outline" onClick={() => router.back()}>← Orqaga</button>
      </div>
    </div>
  );

  const isDollar = gazna.Turi === "Dollar";
  const amt = (summa: string, summa_dollar: string) =>
    isDollar ? num(summa_dollar) : num(summa);

  const myS = stolov.filter(t =>
    isDollar ? (t.Gazna_dollar_ID === id && num(t.Summa_dollar) > 0)
             : (t.Gazna_ID === id && num(t.Summa) > 0)
  );
  const myX = xtolov.filter(t =>
    isDollar ? (t.Gazna_dollar_ID === id && num(t.Summa_dollar) > 0)
             : (t.Gazna_ID === id && num(t.Summa) > 0)
  );
  // Shu gaznaga tegishli xarajatlar (chiqim)
  const xrAmt = (x: Xarajat) => isDollar ? num(x.Dollar) : num(x.Som);
  const myXr = xarajatlar.filter(x =>
    isDollar ? (x.Gazna_dollar_ID === id && num(x.Dollar) > 0)
             : (x.Gazna_ID === id && num(x.Som) > 0)
  );

  const allKirdi  = myS.reduce((s, t) => s + amt(t.Summa, t.Summa_dollar), 0);
  const allChiqdi = myX.reduce((s, t) => s + amt(t.Summa, t.Summa_dollar), 0)
                  + myXr.reduce((s, x) => s + xrAmt(x), 0);
  const joriy     = num(gazna.Boshlangich_balans) + allKirdi - allChiqdi;

  const davrKirdi  = myS.filter(t => inRange(t.Sana, dateFrom, dateTo)).reduce((s, t) => s + amt(t.Summa, t.Summa_dollar), 0);
  const davrChiqdi = myX.filter(t => inRange(t.Sana, dateFrom, dateTo)).reduce((s, t) => s + amt(t.Summa, t.Summa_dollar), 0)
                   + myXr.filter(x => inRange(x.Sana, dateFrom, dateTo)).reduce((s, x) => s + xrAmt(x), 0);
  const davrSof    = davrKirdi - davrChiqdi;

  const txs: Tx[] = [
    ...myS.map(t => ({
      id: t.Tolov_ID,
      sana: t.Sana,
      tur: "Sotuv to'lov",
      tavsif: t.Izoh || "Sotuv to'lov",
      kirdi: amt(t.Summa, t.Summa_dollar),
      chiqdi: 0,
      valyuta: t.Valyuta,
      sortKey: t.Sana ? `${t.Sana.split(".").reverse().join("")}${t.Vaqt || ""}` : "",
    })),
    ...myX.map(t => ({
      id: t.X_Tolov_ID,
      sana: t.Sana,
      tur: "Xarid to'lov",
      tavsif: t.Izoh || "Xarid to'lov",
      kirdi: 0,
      chiqdi: amt(t.Summa, t.Summa_dollar),
      valyuta: t.Valyuta,
      sortKey: t.Sana ? `${t.Sana.split(".").reverse().join("")}${t.Vaqt || ""}` : "",
    })),
    ...myXr.map(x => ({
      id: x.Xarajat_ID,
      sana: x.Sana,
      tur: "Xarajat",
      tavsif: x.Nomi || x.Izoh || "Xarajat",
      kirdi: 0,
      chiqdi: xrAmt(x),
      valyuta: isDollar ? "Dollar" : "Som",
      sortKey: x.Sana ? `${x.Sana.split(".").reverse().join("")}${x.Vaqt || ""}` : "",
    })),
  ].sort((a, b) => b.sortKey.localeCompare(a.sortKey));

  const txsInRange = txs.filter(t => inRange(t.sana, dateFrom, dateTo));
  const turTypes = Array.from(new Set(txsInRange.map(t => t.tur)));
  const turTabs = ["Barchasi", ...turTypes];
  const filtered = activeTur === "Barchasi" ? txsInRange : txsInRange.filter(t => t.tur === activeTur);

  function openEdit() {
    setForm({
      Nomi: gazna!.Nomi, Turi: gazna!.Turi, Shakli: gazna!.Shakli,
      Boshlangich_balans: gazna!.Boshlangich_balans,
      Boshlanish_Sana: dmyToISO(gazna!.Boshlanish_Sana) || todayISO(),
    });
    setShowEdit(true);
  }

  async function handleSave() {
    if (!form.Nomi.trim() || !gazna) return;
    setSaving(true);
    try {
      const sana = isoToDMY(form.Boshlanish_Sana);
      await fetch("/api/sheets", { method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet: "Gazna", idColumn: "Gazna_ID", idValue: gazna.Gazna_ID,
          row: { Nomi: form.Nomi, Turi: form.Turi, Shakli: form.Shakli,
                 Boshlangich_balans: form.Boshlangich_balans, Boshlanish_Sana: sana, Tugash_Sana: sana } }) });
      setShowEdit(false);
      loadData();
    } finally { setSaving(false); }
  }

  const sofColor = davrSof >= 0 ? "var(--primary)" : "#ef4444";
  const cur = (v: string) => isDollar ? `${v} $` : `${v} so'm`;

  return (
    <>
      <header className="header">
        <div className="header__inner" style={{ gap: 10, flexWrap: isMobile ? "wrap" : "nowrap" }}>
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
            {gazna.Nomi}
          </h1>

          {turTabs.length > 1 && (
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
          )}

          <div style={{ flex: 1 }}/>

          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              style={{ fontSize: 12, border: "1px solid var(--border)", borderRadius: "var(--radius)",
                padding: "5px 8px", background: "var(--white)", color: "var(--text)", cursor: "pointer" }}/>
            <span style={{ color: "var(--text-3)", fontSize: 13 }}>—</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              style={{ fontSize: 12, border: "1px solid var(--border)", borderRadius: "var(--radius)",
                padding: "5px 8px", background: "var(--white)", color: "var(--text)", cursor: "pointer" }}/>
          </div>

          <button className="btn btn--outline" onClick={openEdit} style={{ flexShrink: 0 }}>
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
            Tahrirlash
          </button>
        </div>
      </header>

      <div className="page-content">
        {/* Summary cards */}
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
          gap: isMobile ? 10 : 14, marginBottom: isMobile ? 20 : 28,
        }}>
          {/* JORIY BALANS */}
          <div style={{
            background: "var(--white)", borderRadius: "var(--radius-xl)",
            boxShadow: "var(--shadow-sm)", border: "1px solid var(--border)",
            padding: isMobile ? 14 : 20,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".06em" }}>JORIY BALANS</span>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)" }}>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
                </svg>
              </span>
            </div>
            <p style={{ fontSize: isMobile ? 16 : 22, fontWeight: 800, color: "var(--primary)", lineHeight: 1.1, marginBottom: 6 }}>
              {cur(fmtNum(joriy))}
            </p>
            <p style={{ fontSize: 11, color: "var(--text-3)" }}>
              Boshlangich: {fmtNum(num(gazna.Boshlangich_balans))}
            </p>
          </div>

          {/* DAVR KIRDI */}
          <div style={{
            background: "var(--white)", borderRadius: "var(--radius-xl)",
            boxShadow: "var(--shadow-sm)", border: "1px solid var(--border)",
            padding: isMobile ? 14 : 20,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".06em" }}>DAVR KIRDI</span>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", color: "#16a34a" }}>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                </svg>
              </span>
            </div>
            <p style={{ fontSize: isMobile ? 16 : 22, fontWeight: 800, color: "#16a34a", lineHeight: 1.1 }}>
              {cur(fmtNum(davrKirdi))}
            </p>
          </div>

          {/* DAVR CHIQDI */}
          <div style={{
            background: "var(--white)", borderRadius: "var(--radius-xl)",
            boxShadow: "var(--shadow-sm)", border: "1px solid var(--border)",
            padding: isMobile ? 14 : 20,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".06em" }}>DAVR CHIQDI</span>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444" }}>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 17H5m0 0V9m0 8l8-8 4 4 6-6"/>
                </svg>
              </span>
            </div>
            <p style={{ fontSize: isMobile ? 16 : 22, fontWeight: 800, color: "#ef4444", lineHeight: 1.1 }}>
              {cur(fmtNum(davrChiqdi))}
            </p>
          </div>

          {/* DAVR SOF */}
          <div style={{
            background: "var(--white)", borderRadius: "var(--radius-xl)",
            boxShadow: "var(--shadow-sm)", border: "1px solid var(--border)",
            borderLeft: `4px solid ${sofColor}`,
            padding: isMobile ? 14 : 20,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".06em" }}>DAVR SOF</span>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: davrSof >= 0 ? "#dcfce7" : "#fee2e2",
                display: "flex", alignItems: "center", justifyContent: "center", color: sofColor }}>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
                </svg>
              </span>
            </div>
            <p style={{ fontSize: isMobile ? 16 : 22, fontWeight: 800, color: sofColor, lineHeight: 1.1 }}>
              {cur(`${davrSof >= 0 ? "+" : ""}${fmtNum(davrSof)}`)}
            </p>
          </div>
        </div>

        {/* Transactions table */}
        <div style={{
          background: "var(--white)", borderRadius: "var(--radius-xl)",
          border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)", overflow: "hidden",
        }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
              Tranzaksiyalar ({filtered.length} ta)
            </p>
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center" }}>
              <p style={{ fontSize: 14, color: "var(--text-3)" }}>Tranzaksiya topilmadi</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--bg)" }}>
                    {(["#", "SANA", "TUR", "TAVSIF"] as const).map(h => (
                      <th key={h} style={{ padding: "10px 16px", fontSize: 10, fontWeight: 700,
                        color: "var(--text-3)", letterSpacing: ".06em", textAlign: "left",
                        borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                    <th style={{ padding: "10px 16px", fontSize: 10, fontWeight: 700,
                      color: "var(--primary)", letterSpacing: ".06em", textAlign: "right",
                      borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>KIRDI</th>
                    <th style={{ padding: "10px 16px", fontSize: 10, fontWeight: 700,
                      color: "#ef4444", letterSpacing: ".06em", textAlign: "right",
                      borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>CHIQDI</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((tx, i) => (
                    <tr key={tx.id || i}
                      onClick={() => setSelectedTx(tx)}
                      style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--bg)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                      <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text-3)", fontWeight: 600 }}>
                        {i + 1}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text-2)", fontWeight: 600, whiteSpace: "nowrap" }}>
                        {tx.sana}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                          background: tx.kirdi > 0 ? "#dbeafe" : "#fef3c7",
                          color: tx.kirdi > 0 ? "#1d4ed8" : "#92400e",
                          whiteSpace: "nowrap",
                        }}>
                          {tx.tur}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text-2)",
                        maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {tx.tavsif || "—"}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700,
                        color: "var(--primary)", textAlign: "right", whiteSpace: "nowrap" }}>
                        {tx.kirdi > 0 ? cur(`+${fmtNum(tx.kirdi)}`) : "—"}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700,
                        color: "#ef4444", textAlign: "right", whiteSpace: "nowrap" }}>
                        {tx.chiqdi > 0 ? cur(`-${fmtNum(tx.chiqdi)}`) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Transaction detail modal */}
      {selectedTx && (
        <div onClick={() => setSelectedTx(null)} style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,.45)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 16,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "var(--white)", borderRadius: 16, width: "100%", maxWidth: 420,
            borderTop: `4px solid ${selectedTx.kirdi > 0 ? "var(--primary)" : "#ef4444"}`,
            boxShadow: "0 20px 60px rgba(0,0,0,.2)", overflow: "hidden",
          }}>
            {/* Head */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 20px 14px" }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                background: selectedTx.kirdi > 0 ? "#dcfce7" : "#fee2e2",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: selectedTx.kirdi > 0 ? "var(--primary)" : "#ef4444",
              }}>
                {selectedTx.kirdi > 0 ? (
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17H5m0 0V9m0 8l8-8 4 4 6-6"/>
                  </svg>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>{selectedTx.tur}</p>
                <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{selectedTx.sana}</p>
              </div>
              <button onClick={() => setSelectedTx(null)} style={{
                width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border)",
                background: "var(--bg)", display: "flex", alignItems: "center",
                justifyContent: "center", cursor: "pointer", color: "var(--text-3)", flexShrink: 0,
              }}>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Kirdi / Chiqdi amount */}
              <div style={{
                background: selectedTx.kirdi > 0 ? "#f0fdf4" : "#fef2f2",
                borderRadius: 12, padding: "14px 16px",
                border: `1px solid ${selectedTx.kirdi > 0 ? "#bbf7d0" : "#fecaca"}`,
              }}>
                <p style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600, marginBottom: 6 }}>
                  {selectedTx.kirdi > 0 ? "Kirdi" : "Chiqdi"}
                </p>
                <p style={{ fontSize: 24, fontWeight: 800, color: selectedTx.kirdi > 0 ? "var(--primary)" : "#ef4444" }}>
                  {selectedTx.kirdi > 0 ? cur(`+${fmtNum(selectedTx.kirdi)}`) : cur(`-${fmtNum(selectedTx.chiqdi)}`)}
                </p>
              </div>

              {/* Tavsif */}
              <div style={{ background: "var(--bg)", borderRadius: 12, padding: "14px 16px", border: "1px solid var(--border)" }}>
                <p style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600, marginBottom: 6 }}>Tavsif / Izoh</p>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{selectedTx.tavsif || "—"}</p>
              </div>

              {/* Sana + Tur */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={{ background: "var(--bg)", borderRadius: 12, padding: "14px 16px", border: "1px solid var(--border)" }}>
                  <p style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600, marginBottom: 6 }}>Sana</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{selectedTx.sana}</p>
                </div>
                <div style={{ background: "var(--bg)", borderRadius: 12, padding: "14px 16px", border: "1px solid var(--border)" }}>
                  <p style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600, marginBottom: 8 }}>Tur</p>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                    background: selectedTx.kirdi > 0 ? "#dbeafe" : "#fef3c7",
                    color: selectedTx.kirdi > 0 ? "#1d4ed8" : "#92400e",
                  }}>
                    {selectedTx.tur}
                  </span>
                </div>
              </div>

              {/* Currency amount */}
              <div style={{ background: "var(--bg)", borderRadius: 12, padding: "14px 16px", border: "1px solid var(--border)" }}>
                <p style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600, marginBottom: 6 }}>
                  {isDollar ? "Dollar miqdori" : "So'm miqdori"}
                </p>
                <p style={{ fontSize: 18, fontWeight: 800, color: selectedTx.kirdi > 0 ? "var(--primary)" : "#ef4444" }}>
                  {selectedTx.kirdi > 0 ? cur(`+${fmtNum(selectedTx.kirdi)}`) : cur(`-${fmtNum(selectedTx.chiqdi)}`)}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
              <button className="btn btn--outline" onClick={() => setSelectedTx(null)}>Yopish</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit drawer */}
      {showEdit && (
        <div className="drawer-overlay" onClick={() => setShowEdit(false)}>
          <div className="drawer" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="drawer__head">
              <h2 className="drawer__title">Hisobni tahrirlash</h2>
              <button className="drawer__back" onClick={() => setShowEdit(false)}>
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="drawer__body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="field">
                <label>Hisob nomi *</label>
                <input placeholder="Masalan: Asosiy kassa"
                  value={form.Nomi} onChange={e => setForm(f => ({ ...f, Nomi: e.target.value }))}/>
              </div>
              <div className="field">
                <label>Valyuta turi</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {["So'm", "Dollar"].map(t => (
                    <button key={t} onClick={() => setForm(f => ({ ...f, Turi: t }))} style={{
                      flex: 1, padding: "8px 0", borderRadius: "var(--radius)",
                      border: `2px solid ${form.Turi === t ? "var(--primary)" : "var(--border)"}`,
                      background: form.Turi === t ? "#f0fdf4" : "var(--white)",
                      color: form.Turi === t ? "var(--primary)" : "var(--text-2)",
                      fontWeight: 700, fontSize: 13, cursor: "pointer",
                    }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>Shakli</label>
                <select value={form.Shakli} onChange={e => setForm(f => ({ ...f, Shakli: e.target.value }))}>
                  {["Barchasi","Naqd","Bank","Karta"].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Boshlang'ich balans</label>
                <input type="number" placeholder="0"
                  value={form.Boshlangich_balans}
                  onChange={e => setForm(f => ({ ...f, Boshlangich_balans: e.target.value }))}/>
              </div>
              <div className="field">
                <label>Boshlanish sanasi</label>
                <input type="date" value={form.Boshlanish_Sana}
                  onChange={e => setForm(f => ({ ...f, Boshlanish_Sana: e.target.value }))}/>
              </div>
            </div>
            <div className="drawer__footer">
              <button className="btn btn--outline" onClick={() => setShowEdit(false)} disabled={saving}>Bekor</button>
              <button className="btn btn--primary" onClick={handleSave} disabled={saving || !form.Nomi.trim()}>
                {saving ? "Saqlanmoqda..." : "Saqlash"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
