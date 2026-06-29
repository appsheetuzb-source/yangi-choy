"use client";
import { fetchSheetWhere, afterWrite } from "@/lib/sheet-cache";
import { exportPDF, exportExcel, type ExportOpts, type ExportSection } from "@/lib/export";

import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";

interface Taminotchi {
  Taminotchi_ID: string; Ism: string; Telefon: string; Valyuta: string;
  Boshlangich_Balans: string; Boshlangich_som: string;
  Qoshilgan_Vaqt: string; Qoshdi: string;
}
interface Xarid {
  Xarid_ID: string; Taminotchi_ID: string; Sana: string;
  Sotuv_Raqami: string; Izoh: string; Akt_sverka: string;
}
interface XaridSavat {
  Xarid_ID: string; Summa_Som: string; Jami_Summa: string; Soni: string;
}
interface XTolov {
  X_Tolov_ID: string; Taminotchi_ID: string; Sana: string; Vaqt: string;
  Valyuta: string; Turi: string; Som: string; Dollar: string;
  Summa: string; Summa_dollar: string; Dollar_Kursi: string;
  Izoh: string; Xarid_Raqami: string; Check: string;
}

const VALYUTALAR = ["So'm", "Dollar", "Dollar , So'm"];

function num(v: string | number | undefined) {
  return parseFloat(String(v || "0").replace(/\s/g, "").replace(",", ".")) || 0;
}
function fmtUsd(v: number) {
  return "$" + v.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function sanaKey(sana: string) {
  const [d, m, y] = (sana || "").split(".");
  return `${y || "0000"}${(m || "00").padStart(2, "0")}${(d || "00").padStart(2, "0")}`;
}

export default function TaminotchiDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [taminotchi, setTaminotchi] = useState<Taminotchi | null>(null);
  const [xaridlar, setXaridlar]     = useState<Xarid[]>([]);
  const [savatMap, setSavatMap]     = useState<Record<string, XaridSavat[]>>({});
  const [tolovlar, setTolovlar]     = useState<XTolov[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [isMobile, setIsMobile]     = useState(false);
  const [tick, setTick]             = useState(0);
  const [aktOpen, setAktOpen]       = useState(false);
  const _y = new Date().getFullYear();
  const _todayISO = `${_y}-${String(new Date().getMonth()+1).padStart(2,"0")}-${String(new Date().getDate()).padStart(2,"0")}`;
  const [aktFrom, setAktFrom]       = useState(`${_y}-01-01`);
  const [aktTo, setAktTo]           = useState(_todayISO);

  const [editOpen, setEditOpen]   = useState(false);
  const [form, setForm]           = useState<Partial<Taminotchi>>({});
  const [saving, setSaving]       = useState(false);
  const [toggling, setToggling]   = useState<Record<string, boolean>>({});

  const xaridRef = useRef<HTMLDivElement>(null);
  const tolovRef = useRef<HTMLDivElement>(null);
  const [flash, setFlash]         = useState<"xarid" | "tolov" | null>(null);
  const [qFrom, setQFrom]         = useState("");
  const [qTo, setQTo]             = useState("");
  const [qSum, setQSum]           = useState("");
  function goSection(target: "xarid" | "tolov") {
    const ref = target === "xarid" ? xaridRef : tolovRef;
    ref.current?.scrollIntoView({ behavior: "smooth", block: isMobile ? "start" : "center" });
    setFlash(target);
    setTimeout(() => setFlash(f => (f === target ? null : f)), 1400);
  }

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
      fetchSheetWhere("Taminotchi", "Taminotchi_ID", id),
      fetchSheetWhere("Xarid", "Taminotchi_ID", id),
      fetchSheetWhere("X_Tolov", "Taminotchi_ID", id).catch(() => ({ headers: [], data: [] })),
    ]).then(async ([tR, xR, tolvR]) => {
      const t = (tR.data as Taminotchi[])[0] || null;
      setTaminotchi(t);

      const myXarid = (xR.data as Xarid[]);
      myXarid.sort((a, b) => num(b.Sotuv_Raqami) - num(a.Sotuv_Raqami));
      setXaridlar(myXarid);
      const xaridIds = myXarid.map(x => String(x.Xarid_ID || "").trim()).filter(Boolean);
      const xsR = xaridIds.length
        ? await fetchSheetWhere("Xarid_Savat", "Xarid_ID", xaridIds).catch(() => ({ headers: [], data: [] }))
        : { data: [] };

      const sm: Record<string, XaridSavat[]> = {};
      (xsR.data as XaridSavat[]).forEach(s => {
        const key = String(s.Xarid_ID || "").trim();
        if (!key) return;
        if (!sm[key]) sm[key] = [];
        sm[key].push(s);
      });
      setSavatMap(sm);

      const myTolov = (tolvR.data as XTolov[] || []);
      myTolov.sort((a, b) => {
        const p = (s: string) => { const [d,mo,y] = (s||"").split(".").map(Number); return y*10000+mo*100+d; };
        return p(b.Sana) - p(a.Sana);
      });
      setTolovlar(myTolov);
    }).catch(e => setError(e instanceof Error ? e.message : "Xatolik"))
      .finally(() => setLoading(false));
  }, [id, tick]);

  const jamiXaridSom = useMemo(() => xaridlar.reduce((s, x) =>
    s + (savatMap[x.Xarid_ID] || []).reduce((ss, r) => ss + num(r.Summa_Som), 0), 0), [xaridlar, savatMap]);
  const jamiXaridUsd = useMemo(() => xaridlar.reduce((s, x) =>
    s + (savatMap[x.Xarid_ID] || []).reduce((ss, r) => ss + num(r.Jami_Summa), 0), 0), [xaridlar, savatMap]);
  const jamiTolovSom = useMemo(() => tolovlar.reduce((s, t) => s + num(t.Summa), 0), [tolovlar]);
  const jamiTolovUsd = useMemo(() => tolovlar.reduce((s, t) => s + num(t.Summa_dollar), 0), [tolovlar]);

  const fromKey = qFrom ? qFrom.replace(/-/g, "") : "";
  const toKey   = qTo ? qTo.replace(/-/g, "") : "";
  const sumQ    = qSum.replace(/\D/g, "");
  const qActive = !!(fromKey || toKey || sumQ);
  const fXarid = useMemo(() => {
    if (!qActive) return xaridlar;
    return xaridlar.filter(x => {
      if (fromKey || toKey) { const k = sanaKey(x.Sana); if ((fromKey && k < fromKey) || (toKey && k > toKey)) return false; }
      if (sumQ) {
        const sv = savatMap[x.Xarid_ID] || [];
        const som = sv.reduce((s, r) => s + num(r.Summa_Som), 0);
        const usd = sv.reduce((s, r) => s + num(r.Jami_Summa), 0);
        if (!`${Math.round(som)} ${Math.round(usd)}`.includes(sumQ)) return false;
      }
      return true;
    });
  }, [xaridlar, savatMap, fromKey, toKey, sumQ, qActive]);
  const fTolov = useMemo(() => {
    if (!qActive) return tolovlar;
    return tolovlar.filter(t => {
      if (fromKey || toKey) { const k = sanaKey(t.Sana); if ((fromKey && k < fromKey) || (toKey && k > toKey)) return false; }
      if (sumQ) {
        if (!`${Math.round(num(t.Som))} ${Math.round(num(t.Dollar))} ${Math.round(num(t.Summa))}`.includes(sumQ)) return false;
      }
      return true;
    });
  }, [tolovlar, fromKey, toKey, sumQ, qActive]);

  const bSom = num(taminotchi?.Boshlangich_som);
  const bUsd = num(taminotchi?.Boshlangich_Balans);
  const qarzSom = bSom + jamiXaridSom - jamiTolovSom;
  const qarzUsd = bUsd + jamiXaridUsd - jamiTolovUsd;

  // ── Akt-sverka (so'm va $ alohida) ──────────────────────
  function aktSection(cur: "som" | "dollar", fromISO: string, toISO: string): ExportSection | null {
    const fmtA = (v: number) => cur === "som"
      ? v.toLocaleString("ru-RU") + " so'm"
      : v.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $";
    const dkey = (sana: string) => { const [d, m, y] = (sana || "").split("."); return `${y || "0000"}${(m || "00").padStart(2, "0")}${(d || "00").padStart(2, "0")}`; };
    const fromKey = fromISO ? fromISO.replace(/-/g, "") : "";
    const toKey   = toISO   ? toISO.replace(/-/g, "")   : "";
    type Ev = { sana: string; vaqt: string; debit: number; credit: number; tavsif: string };
    const events: Ev[] = [];
    xaridlar.forEach(x => {
      const amt = cur === "som"
        ? (savatMap[x.Xarid_ID] || []).reduce((a, r) => a + num(r.Summa_Som), 0)
        : (savatMap[x.Xarid_ID] || []).reduce((a, r) => a + num(r.Jami_Summa), 0);
      if (amt > 0) events.push({ sana: x.Sana, vaqt: "", debit: amt, credit: 0, tavsif: `Xarid${x.Sotuv_Raqami ? " #" + x.Sotuv_Raqami : ""}` });
    });
    tolovlar.forEach(t => {
      const amt = cur === "som" ? num(t.Summa) : num(t.Summa_dollar);
      if (amt > 0) events.push({ sana: t.Sana, vaqt: t.Vaqt || "", debit: 0, credit: amt, tavsif: `To'lov${t.Turi ? " (" + t.Turi + ")" : ""}` });
    });
    events.sort((a, b) => (dkey(a.sana) + a.vaqt).localeCompare(dkey(b.sana) + b.vaqt));
    const boshlangich = cur === "som" ? bSom : bUsd;
    const opening = boshlangich + events.filter(e => fromKey && dkey(e.sana) < fromKey).reduce((a, e) => a + e.debit - e.credit, 0);
    const inRange = events.filter(e => { const k = dkey(e.sana); return (!fromKey || k >= fromKey) && (!toKey || k <= toKey); });
    if (opening === 0 && inRange.length === 0) return null;
    let run = opening;
    const rows: (string | number)[][] = [["—", "Boshlang'ich qoldiq", "", "", fmtA(opening)]];
    inRange.forEach(e => { run += e.debit - e.credit; rows.push([e.sana, e.tavsif, e.debit ? fmtA(e.debit) : "", e.credit ? fmtA(e.credit) : "", fmtA(run)]); });
    return {
      heading: cur === "som" ? "SO'M HISOBVARAQA" : "DOLLAR ($) HISOBVARAQA",
      headers: ["Sana", "Amaliyot", "Xarid (qarz)", "To'lov", "Qoldiq"],
      rows,
      foot: ["", "YAKUNIY QOLDIQ", "", "", fmtA(run)],
    };
  }
  function buildAkt(): ExportOpts {
    const ds = (iso: string) => iso ? iso.split("-").reverse().join(".") : "";
    const secs = [aktSection("som", aktFrom, aktTo), aktSection("dollar", aktFrom, aktTo)].filter(Boolean) as ExportSection[];
    return {
      title: `Akt-sverka — ${taminotchi?.Ism || ""}`,
      subtitle: `Davr: ${ds(aktFrom) || "boshidan"} — ${ds(aktTo) || "hozirgача"}`,
      filename: `akt-sverka-${(taminotchi?.Ism || "firma").replace(/\s+/g, "_")}-${ds(aktTo).replace(/\./g, "-")}`,
      sections: secs.length ? secs : [{ headers: ["Sana", "Amaliyot", "Xarid", "To'lov", "Qoldiq"], rows: [["", "Ma'lumot yo'q", "", "", ""]] }],
    };
  }

  async function handleToggleAkt(x: Xarid, val: string) {
    setToggling(p => ({ ...p, [x.Xarid_ID]: true }));
    setXaridlar(prev => prev.map(item => item.Xarid_ID === x.Xarid_ID ? { ...item, Akt_sverka: val } : item));
    try {
      await fetch("/api/sheets", { method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet: "Xarid", idColumn: "Xarid_ID", idValue: x.Xarid_ID, row: { ...x, Akt_sverka: val } }) });
      afterWrite("Xarid");
    } finally {
      setToggling(p => ({ ...p, [x.Xarid_ID]: false }));
    }
  }

  async function handleToggleCheck(t: XTolov, val: string) {
    setToggling(p => ({ ...p, [t.X_Tolov_ID]: true }));
    setTolovlar(prev => prev.map(item => item.X_Tolov_ID === t.X_Tolov_ID ? { ...item, Check: val } : item));
    try {
      await fetch("/api/sheets", { method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet: "X_Tolov", idColumn: "X_Tolov_ID", idValue: t.X_Tolov_ID, row: { ...t, Check: val } }) });
      afterWrite("X_Tolov");
    } finally {
      setToggling(p => ({ ...p, [t.X_Tolov_ID]: false }));
    }
  }

  async function handleSave() {
    if (!taminotchi || !form.Ism?.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/sheets", { method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet: "Taminotchi", idColumn: "Taminotchi_ID", idValue: taminotchi.Taminotchi_ID, row: { ...taminotchi, ...form } }) });
      afterWrite("Taminotchi");
      setEditOpen(false);
      setTimeout(() => setTick(t => t + 1), 800);
    } finally { setSaving(false); }
  }

  if (loading) return (
    <div className="page-content" style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
      <div className="spinner--page"/>
    </div>
  );

  if (error || !taminotchi) return (
    <div className="page-content">
      <div className="empty">
        <p className="empty__title">Ta&apos;minotchi topilmadi</p>
        <button className="btn btn--outline" onClick={() => router.back()}>← Orqaga</button>
      </div>
    </div>
  );

  const COLS_X = "40px 100px 80px 1fr 1fr 112px";
  const COLS_T = "26px 70px 48px 1fr 1fr 1fr 88px 96px";

  return (
    <>
      <header className="header">
        <div className="header__inner" style={{ gap: 14 }}>
          <button onClick={() => router.back()}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--white)", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text-2)", flexShrink: 0 }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
            Orqaga
          </button>
          <div style={{ flex: 1 }} />
          <button onClick={() => setAktOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", border: "1.5px solid var(--primary)", borderRadius: "var(--radius)", background: "var(--primary-glow)", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "var(--primary)", flexShrink: 0 }}>
            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            {!isMobile && "Akt-sverka"}
          </button>
          <button onClick={() => { setForm({ ...taminotchi }); setEditOpen(true); }}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--white)", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text-2)", flexShrink: 0 }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            {!isMobile && "Tahrirlash"}
          </button>
        </div>
      </header>

      {aktOpen && (
        <div className="modal-overlay" onClick={() => setAktOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal__head">
              <h2 className="modal__title">Akt-sverka — {taminotchi?.Ism || ""}</h2>
              <button className="modal__close" onClick={() => setAktOpen(false)}>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="modal__body">
              <p style={{ fontSize: 13, color: "var(--text-2)" }}>Sana oralig&apos;ini tanlang. So&apos;m va $ alohida hisobvaraqada chiqariladi.</p>
              <div className="grid-2">
                <div className="field"><label>Dan</label><input type="date" value={aktFrom} onChange={e => setAktFrom(e.target.value)} /></div>
                <div className="field"><label>Gacha</label><input type="date" value={aktTo} onChange={e => setAktTo(e.target.value)} /></div>
              </div>
            </div>
            <div className="modal__footer">
              <button className="btn btn--outline" style={{ flex: 1 }} onClick={() => { exportExcel(buildAkt()); setAktOpen(false); }}>
                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg> Excel
              </button>
              <button className="btn btn--primary" style={{ flex: 1 }} onClick={() => { exportPDF(buildAkt()); setAktOpen(false); }}>
                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M4 4h9l5 5v11H4V4z"/></svg> PDF
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page-content" style={{ maxWidth: 1320 }}>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5,1fr)", gap: isMobile ? 10 : 16, marginBottom: isMobile ? 16 : 24 }}>
          <div style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", padding: isMobile ? "14px 16px" : "20px 24px" }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".06em", marginBottom: 8 }}>TA&apos;MINOTCHI</p>
            <p style={{ fontSize: isMobile ? 14 : 16, fontWeight: 800, wordBreak: "break-word", lineHeight: 1.3 }}>{taminotchi.Ism}</p>
            {taminotchi.Telefon && <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginTop: 4 }}>{taminotchi.Telefon}</p>}
          </div>
          <div style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", padding: isMobile ? "14px 16px" : "20px 24px" }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".06em", marginBottom: 8 }}>BOSHLANG&apos;ICH BALANS</p>
            {bSom !== 0 && <p style={{ fontSize: isMobile ? 14 : 17, fontWeight: 800 }}>{bSom.toLocaleString("ru-RU")} <span style={{ fontSize: 10 }}>so&apos;m</span></p>}
            {bUsd !== 0 && <p style={{ fontSize: isMobile ? 13 : 15, fontWeight: 800, color: "#2563eb", marginTop: 4 }}>{fmtUsd(bUsd)}</p>}
            {bSom === 0 && bUsd === 0 && <p style={{ fontSize: isMobile ? 14 : 17, fontWeight: 800, color: "var(--text-3)" }}>0</p>}
          </div>
          <div onClick={() => goSection("xarid")} title="Xaridlar ro'yxatiga o'tish"
            style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", padding: isMobile ? "14px 16px" : "20px 24px", cursor: "pointer", transition: "box-shadow .15s, transform .15s" }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 20px rgba(30,64,124,.14)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = "var(--shadow-sm)"; e.currentTarget.style.transform = "none"; }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 8 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".06em", margin: 0 }}>JAMI XARID SUMMASI</p>
              <svg width="13" height="13" fill="none" stroke="var(--text-3)" viewBox="0 0 24 24" style={{ flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
            </div>
            {jamiXaridSom !== 0 && <p style={{ fontSize: isMobile ? 14 : 17, fontWeight: 800 }}>{jamiXaridSom.toLocaleString("ru-RU")}</p>}
            {jamiXaridUsd !== 0 && <p style={{ fontSize: isMobile ? 13 : 15, fontWeight: 800, color: "#2563eb", marginTop: 4 }}>{fmtUsd(jamiXaridUsd)}</p>}
            {jamiXaridSom === 0 && jamiXaridUsd === 0 && <p style={{ fontSize: isMobile ? 14 : 17, fontWeight: 800, color: "var(--text-3)" }}>0</p>}
          </div>
          <div onClick={() => goSection("tolov")} title="To'lovlar tarixiga o'tish"
            style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", padding: isMobile ? "14px 16px" : "20px 24px", cursor: "pointer", transition: "box-shadow .15s, transform .15s" }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 20px rgba(30,64,124,.14)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = "var(--shadow-sm)"; e.currentTarget.style.transform = "none"; }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 8 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".06em", margin: 0 }}>JAMI AYRILGAN PULLAR</p>
              <svg width="13" height="13" fill="none" stroke="var(--text-3)" viewBox="0 0 24 24" style={{ flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
            </div>
            {jamiTolovSom !== 0 && <p style={{ fontSize: isMobile ? 14 : 17, fontWeight: 800, color: "#16a34a" }}>{jamiTolovSom.toLocaleString("ru-RU")}</p>}
            {jamiTolovUsd !== 0 && <p style={{ fontSize: isMobile ? 13 : 15, fontWeight: 800, color: "#16a34a", marginTop: 4 }}>{fmtUsd(jamiTolovUsd)}</p>}
            {jamiTolovSom === 0 && jamiTolovUsd === 0 && <p style={{ fontSize: isMobile ? 14 : 17, fontWeight: 800, color: "var(--text-3)" }}>0</p>}
          </div>
          <div style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", padding: isMobile ? "14px 16px" : "20px 24px" }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".06em", marginBottom: 8 }}>JAMI QARZDORLIK</p>
            {qarzSom !== 0 && <p style={{ fontSize: isMobile ? 14 : 17, fontWeight: 800, color: qarzSom > 0 ? "#ef4444" : "#16a34a" }}>{qarzSom.toLocaleString("ru-RU")}</p>}
            {qarzUsd !== 0 && <p style={{ fontSize: isMobile ? 13 : 15, fontWeight: 800, color: qarzUsd > 0 ? "#ef4444" : "#16a34a", marginTop: 4 }}>{fmtUsd(qarzUsd)}</p>}
            {qarzSom === 0 && qarzUsd === 0 && <p style={{ fontSize: isMobile ? 14 : 17, fontWeight: 800, color: "#16a34a" }}>0</p>}
          </div>
        </div>

        {/* Sana va summa bo'yicha qidiruv */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", padding: isMobile ? "10px 12px" : "12px 16px", marginBottom: isMobile ? 14 : 16 }}>
          <svg width="16" height="16" fill="none" stroke="var(--text-2)" viewBox="0 0 24 24" style={{ flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3M3 11h18M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z"/></svg>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-2)" }}>Sana:</span>
          <input type="date" value={qFrom} onChange={e => setQFrom(e.target.value)} style={{ padding: "6px 8px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, background: "var(--bg)", color: "var(--text)" }} />
          <span style={{ color: "var(--text-3)" }}>–</span>
          <input type="date" value={qTo} onChange={e => setQTo(e.target.value)} style={{ padding: "6px 8px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, background: "var(--bg)", color: "var(--text)" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-2)", marginLeft: 6 }}>Summa:</span>
          <input type="text" inputMode="numeric" value={qSum} onChange={e => setQSum(e.target.value)} placeholder="masalan 20670000"
            style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, background: "var(--bg)", color: "var(--text)", width: 150 }} />
          {qActive && (
            <button onClick={() => { setQFrom(""); setQTo(""); setQSum(""); }} style={{ padding: "6px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--white)", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "flex", alignItems: "center", gap: 4 }}>
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg> Tozalash
            </button>
          )}
          {qActive && <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-3)", marginLeft: "auto" }}>{fXarid.length} xarid · {fTolov.length} to&apos;lov</span>}
        </div>

        {/* Xaridlar va To'lovlar — yonma-yon */}
        <div style={{ display: isMobile ? "block" : "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "start" }}>

        {/* Xaridlar */}
        <div ref={xaridRef} style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: flash === "xarid" ? "0 0 0 3px var(--primary)" : "var(--shadow-sm)", overflow: "hidden", marginBottom: isMobile ? 16 : 0, transition: "box-shadow .25s", scrollMarginTop: 80 }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>Xaridlar soni: {fXarid.length} ta</span>
          </div>

          {fXarid.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>{qActive ? "Mos xarid topilmadi" : "Xarid topilmadi"}</div>
          ) : isMobile ? (
            <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
              {fXarid.map((x, i) => {
                const sv = savatMap[x.Xarid_ID] || [];
                const som = sv.reduce((s, r) => s + num(r.Summa_Som), 0);
                const usd = sv.reduce((s, r) => s + num(r.Jami_Summa), 0);
                const isHa = String(x.Akt_sverka||"").toUpperCase()==="TRUE";
                return (
                  <div key={x.Xarid_ID} onClick={() => router.push(`/xarid/${x.Xarid_ID}`)}
                    style={{ background: isHa ? "#86efac" : "#fca5a5", borderRadius: "var(--radius)", padding: "12px 14px", cursor: "pointer", border: `1px solid ${isHa ? "#14532d" : "#7f1d1d"}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700 }}>#{i+1}</span>
                        <span style={{ fontSize: 12, fontWeight: 800, color: "var(--primary)", background: "#f0fdf4", padding: "2px 8px", borderRadius: 6 }}>#{x.Sotuv_Raqami}</span>
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{x.Sana}</span>
                      </div>
                      <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
                        {["True","False"].map(val => {
                          const isActive = val === "True" ? isHa : !isHa;
                          return (
                            <button key={val} disabled={toggling[x.Xarid_ID]}
                              onClick={() => handleToggleAkt(x, val)}
                              style={{ padding: "2px 9px", fontSize: 11, fontWeight: 700, borderRadius: 6, border: "none", cursor: "pointer",
                                background: isActive ? (val === "True" ? "#16a34a" : "#ef4444") : "#f1f5f9",
                                color: isActive ? "#fff" : "var(--text-3)", opacity: toggling[x.Xarid_ID] ? 0.6 : 1 }}>
                              {val === "True" ? "Ha" : "Yo'q"}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: isHa ? "#14532d" : "#7f1d1d" }}>{som !== 0 ? som.toLocaleString("ru-RU") : "0"} <span style={{ fontSize: 10 }}>so&apos;m</span></span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: isHa ? "#14532d" : "#7f1d1d" }}>{usd !== 0 ? fmtUsd(usd) : "$0,00"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}><div style={{ minWidth: 560 }}>
              <div style={{ display: "grid", gridTemplateColumns: COLS_X, padding: "10px 20px", background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
                {["#","SANA","RAQAM","SUMMA (SO'M)","SUMMA ($)","AKT"].map(h => (
                  <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".04em" }}>{h}</span>
                ))}
              </div>
              {fXarid.map((x, i) => {
                const sv = savatMap[x.Xarid_ID] || [];
                const som = sv.reduce((s, r) => s + num(r.Summa_Som), 0);
                const usd = sv.reduce((s, r) => s + num(r.Jami_Summa), 0);
                const isHa = String(x.Akt_sverka||"").toUpperCase()==="TRUE";
                return (
                  <div key={x.Xarid_ID} onClick={() => router.push(`/xarid/${x.Xarid_ID}`)}
                    style={{ display: "grid", gridTemplateColumns: COLS_X, padding: "12px 20px", alignItems: "center", borderBottom: i < fXarid.length - 1 ? "1px solid var(--border)" : "none", cursor: "pointer", background: isHa ? "#86efac" : "#fca5a5" }}
                    onMouseEnter={e => (e.currentTarget.style.background = isHa ? "#4ade80" : "#f87171")}
                    onMouseLeave={e => (e.currentTarget.style.background = isHa ? "#86efac" : "#fca5a5")}>
                    <span style={{ fontSize: 11, color: isHa ? "#14532d" : "#7f1d1d", fontWeight: 700 }}>{i + 1}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: isHa ? "#14532d" : "#7f1d1d" }}>{x.Sana}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: isHa ? "#14532d" : "#7f1d1d", background: "rgba(255,255,255,.55)", padding: "2px 8px", borderRadius: 6, display: "inline-block" }}>#{x.Sotuv_Raqami}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: isHa ? "#14532d" : "#7f1d1d" }}>{som !== 0 ? som.toLocaleString("ru-RU") : "0"}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: isHa ? "#14532d" : "#7f1d1d" }}>{usd !== 0 ? fmtUsd(usd) : "$0,00"}</span>
                    <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
                      {["True","False"].map(val => {
                        const isActive = val === "True" ? isHa : !isHa;
                        return (
                          <button key={val} disabled={toggling[x.Xarid_ID]}
                            onClick={() => handleToggleAkt(x, val)}
                            style={{ padding: "3px 10px", fontSize: 11, fontWeight: 700, borderRadius: 6, border: "none", cursor: "pointer",
                              background: isActive ? (val === "True" ? "#16a34a" : "#ef4444") : "#f1f5f9",
                              color: isActive ? "#fff" : "var(--text-3)", opacity: toggling[x.Xarid_ID] ? 0.6 : 1 }}>
                            {val === "True" ? "Ha" : "Yo'q"}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div></div>
          )}
        </div>

        {/* To'lovlar tarixi */}
        <div ref={tolovRef} style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: flash === "tolov" ? "0 0 0 3px var(--primary)" : "var(--shadow-sm)", overflow: "hidden", transition: "box-shadow .25s", scrollMarginTop: 80 }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>To&apos;lovlar tarixi</span>
          </div>

          {fTolov.length === 0 ? (
            <div style={{ padding: "32px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>{qActive ? "Mos to'lov topilmadi" : "To'lov topilmadi"}</div>
          ) : isMobile ? (
            <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
              {fTolov.map((t, i) => {
                const somVal = num(t.Som);
                const usdVal = num(t.Dollar);
                const jamiSom = num(t.Summa);
                const tIsHa = String(t.Check||"").toUpperCase()==="TRUE";
                return (
                  <div key={t.X_Tolov_ID || i} onClick={() => router.push(`/xarid/tolov/${t.X_Tolov_ID}`)}
                    style={{ background: tIsHa ? "#86efac" : "#fca5a5", borderRadius: "var(--radius)", padding: "12px 14px", border: `1px solid ${tIsHa ? "#14532d" : "#7f1d1d"}`, cursor: "pointer" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700 }}>#{i+1}</span>
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{t.Sana || "—"}</span>
                        {t.Xarid_Raqami && <span style={{ fontSize: 11, color: "var(--primary)", fontWeight: 600 }}>#{t.Xarid_Raqami}</span>}
                        {t.Turi && <span style={{ fontSize: 11, background: "#f1f5f9", padding: "1px 7px", borderRadius: 10, color: "var(--text-2)", fontWeight: 600 }}>{t.Turi}</span>}
                      </div>
                      <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
                        {["True","False"].map(val => {
                          const isHa = String(t.Check||"").toUpperCase()==="TRUE";
                          const isActive = val === "True" ? isHa : !isHa;
                          return (
                            <button key={val} disabled={toggling[t.X_Tolov_ID]}
                              onClick={() => handleToggleCheck(t, val)}
                              style={{ padding: "2px 9px", fontSize: 11, fontWeight: 700, borderRadius: 6, border: "none", cursor: "pointer",
                                background: isActive ? (val === "True" ? "#16a34a" : "#ef4444") : "#f1f5f9",
                                color: isActive ? "#fff" : "var(--text-3)", opacity: toggling[t.X_Tolov_ID] ? 0.6 : 1 }}>
                              {val === "True" ? "Ha" : "Yo'q"}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: tIsHa ? "#14532d" : "#7f1d1d" }}>{somVal !== 0 ? somVal.toLocaleString("ru-RU") : "0"} <span style={{ fontSize: 10 }}>so&apos;m</span></span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: tIsHa ? "#14532d" : "#7f1d1d" }}>{usdVal !== 0 ? fmtUsd(usdVal) : "$0,00"}</span>
                      {jamiSom !== 0 && <span style={{ fontSize: 12, fontWeight: 700, color: tIsHa ? "#14532d" : "#7f1d1d" }}>{jamiSom.toLocaleString("ru-RU")}</span>}
                    </div>
                    {t.Izoh && <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>{t.Izoh}</p>}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}><div style={{ minWidth: 520 }}>
              <div style={{ display: "grid", gridTemplateColumns: COLS_T, padding: "10px 20px", background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
                {["#","SANA","TURI","SO'M","DOLLAR","JAMI (SO'M)","AKT","IZOH"].map(h => (
                  <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".04em" }}>{h}</span>
                ))}
              </div>
              {fTolov.map((t, i) => {
                const somVal = num(t.Som);
                const usdVal = num(t.Dollar);
                const jamiSom = num(t.Summa);
                const tIsHa = String(t.Check||"").toUpperCase()==="TRUE";
                return (
                  <div key={t.X_Tolov_ID || i} onClick={() => router.push(`/xarid/tolov/${t.X_Tolov_ID}`)}
                    style={{ display: "grid", gridTemplateColumns: COLS_T, padding: "12px 20px", alignItems: "center", borderBottom: i < fTolov.length - 1 ? "1px solid var(--border)" : "none", cursor: "pointer", background: tIsHa ? "#86efac" : "#fca5a5" }}
                    onMouseEnter={e => (e.currentTarget.style.background = tIsHa ? "#4ade80" : "#f87171")}
                    onMouseLeave={e => (e.currentTarget.style.background = tIsHa ? "#86efac" : "#fca5a5")}>
                    <span style={{ fontSize: 11, color: tIsHa ? "#14532d" : "#7f1d1d", fontWeight: 700 }}>{i + 1}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: tIsHa ? "#14532d" : "#7f1d1d" }}>{t.Sana || "—"}</span>
                    <span style={{ fontSize: 11, background: t.Turi ? "rgba(255,255,255,.55)" : "transparent", padding: t.Turi ? "2px 6px" : 0, borderRadius: 10, fontWeight: 700, color: tIsHa ? "#14532d" : "#7f1d1d", display: "inline-block" }}>
                      {t.Turi || "—"}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: tIsHa ? "#14532d" : "#7f1d1d" }}>{somVal !== 0 ? somVal.toLocaleString("ru-RU") : "0"}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: tIsHa ? "#14532d" : "#7f1d1d" }}>{usdVal !== 0 ? fmtUsd(usdVal) : "$0,00"}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: tIsHa ? "#14532d" : "#7f1d1d" }}>{jamiSom !== 0 ? jamiSom.toLocaleString("ru-RU") : "0"}</span>
                    <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
                      {["True","False"].map(val => {
                        const tHa = String(t.Check||"").toUpperCase()==="TRUE"; const isActive = val === "True" ? tHa : !tHa;
                        return (
                          <button key={val} disabled={toggling[t.X_Tolov_ID]}
                            onClick={() => handleToggleCheck(t, val)}
                            style={{ padding: "3px 10px", fontSize: 11, fontWeight: 700, borderRadius: 6, border: "none", cursor: "pointer",
                              background: isActive ? (val === "True" ? "#16a34a" : "#ef4444") : "#f1f5f9",
                              color: isActive ? "#fff" : "var(--text-3)", opacity: toggling[t.X_Tolov_ID] ? 0.6 : 1 }}>
                            {val === "True" ? "Ha" : "Yo'q"}
                          </button>
                        );
                      })}
                    </div>
                    <span title={t.Izoh || ""} style={{ fontSize: 12, color: tIsHa ? "#14532d" : "#7f1d1d", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.Izoh || "—"}</span>
                  </div>
                );
              })}
            </div></div>
          )}
        </div>
        </div>
      </div>

      {/* Edit drawer */}
      {editOpen && (
        <>
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,42,76,.42)", backdropFilter: "blur(4px)", zIndex: 999 }} onClick={() => setEditOpen(false)} />
          <div style={{ position: "fixed", ...(isMobile
            ? { bottom: 0, left: 0, right: 0, borderRadius: "20px 20px 0 0", maxHeight: "85vh", overflowY: "auto" }
            : { top: 0, right: 0, width: 380, height: "100%", overflowY: "auto" }),
            background: "var(--white)", zIndex: 1000, padding: "24px 20px",
            display: "flex", flexDirection: "column", gap: 16,
            boxShadow: "-16px 0 48px rgba(30,64,124,.18)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 16, fontWeight: 800 }}>Tahrirlash</span>
              <button onClick={() => setEditOpen(false)} style={{ border: "none", background: "none", cursor: "pointer", padding: 4, fontSize: 18, color: "var(--text-3)" }}>✕</button>
            </div>
            {(["Ism","Telefon"] as const).map(f => (
              <div key={f}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 6 }}>{f}</label>
                <input value={String(form[f] || "")} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))}
                  style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 14, background: "var(--bg)", boxSizing: "border-box" }} />
              </div>
            ))}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 6 }}>Valyuta</label>
              <select value={String(form.Valyuta || "So'm")} onChange={e => setForm(p => ({ ...p, Valyuta: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 14, background: "var(--bg)" }}>
                {VALYUTALAR.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 6 }}>Boshlang&apos;ich balans (so&apos;m)</label>
              <input type="number" value={String(form.Boshlangich_som || "")} onChange={e => setForm(p => ({ ...p, Boshlangich_som: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 14, background: "var(--bg)", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 6 }}>Boshlang&apos;ich balans (dollar)</label>
              <input type="number" value={String(form.Boshlangich_Balans || "")} onChange={e => setForm(p => ({ ...p, Boshlangich_Balans: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 14, background: "var(--bg)", boxSizing: "border-box" }} />
            </div>
            <button onClick={handleSave} disabled={saving}
              style={{ marginTop: 8, padding: "11px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: "var(--radius)", fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saqlanmoqda..." : "Saqlash"}
            </button>
          </div>
        </>
      )}
    </>
  );
}
