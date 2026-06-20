"use client";
import { fetchSheets } from "@/lib/sheet-cache";
import { exportPDF, exportExcel, type ExportSection } from "@/lib/export";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const SAVE_KEY = "aktFirma_sel";

interface Firma { Taminotchi_ID: string; Ism: string; Telefon: string; Boshlangich_Balans?: string; Boshlangich_som?: string; }
interface Xarid { Xarid_ID: string; Taminotchi_ID: string; Sana: string; Vaqt?: string; Sotuv_Raqami?: string; Akt_sverka?: string; }
interface XaridSavat { Xarid_ID: string; Summa_Som: string; Jami_Summa: string; }
interface XTolov { X_Tolov_ID: string; Taminotchi_ID: string; Sana: string; Vaqt?: string; Valyuta?: string; Turi?: string; Summa: string; Summa_dollar: string; Check?: string; }

function num(v: string | number | undefined) { return parseFloat(String(v || "0").replace(/\s/g, "").replace(",", ".")) || 0; }
function fmtSom(v: number) { return v.toLocaleString("ru-RU"); }
function fmtUsd(v: number) { return v.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function dkey(sana: string) { const [d, m, y] = String(sana || "").split("."); return `${y || "0000"}${(m || "00").padStart(2, "0")}${(d || "00").padStart(2, "0")}`; }
function isoKey(iso: string) { return iso ? iso.replace(/-/g, "") : ""; }

export default function AktSverkaFirmaPage() {
  const router = useRouter();
  const [firmalar, setFirmalar] = useState<Firma[]>([]);
  const [xaridlar, setXaridlar] = useState<Xarid[]>([]);
  const [savat, setSavat] = useState<XaridSavat[]>([]);
  const [tolovlar, setTolovlar] = useState<XTolov[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  const [sel, setSel] = useState("");
  const [fromISO, setFromISO] = useState("2022-01-01");
  const now = new Date();
  const [toISO, setToISO] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`);

  useEffect(() => {
    const c = () => setIsMobile(window.innerWidth < 900);
    c(); window.addEventListener("resize", c); return () => window.removeEventListener("resize", c);
  }, []);

  // Tanlovni FAQAT drill-in (xarid/to'lov ochish) orqali saqlaymiz va qaytishda bir marta tiklaymiz.
  // Menyudan kelinса — bo'sh bo'ladi (saqlangan tanlov bo'lmaydi).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SAVE_KEY);
      if (raw) {
        sessionStorage.removeItem(SAVE_KEY); // bir martalik: faqat drill-indan qaytishda ishlaydi
        const o = JSON.parse(raw);
        if (o.sel) setSel(o.sel);
        if (o.from) setFromISO(o.from);
        if (o.to) setToISO(o.to);
      }
    } catch {}
  }, []);
  // Xarid/to'lov detaliga o'tishdan oldin joriy tanlovni saqlaydi
  function goDetail(path: string) {
    try { sessionStorage.setItem(SAVE_KEY, JSON.stringify({ sel, from: fromISO, to: toISO })); } catch {}
    router.push(path);
  }

  useEffect(() => {
    fetchSheets(["Taminotchi", "Xarid", "Xarid_Savat", "X_Tolov"]).then(r => {
      setFirmalar((r["Taminotchi"]?.data || []) as Firma[]);
      setXaridlar((r["Xarid"]?.data || []) as Xarid[]);
      setSavat((r["Xarid_Savat"]?.data || []) as XaridSavat[]);
      setTolovlar((r["X_Tolov"]?.data || []) as XTolov[]);
    }).finally(() => setLoading(false));
  }, []);

  const somByX = useMemo(() => { const m: Record<string, number> = {}; savat.forEach(r => { const k = String(r.Xarid_ID || "").trim(); if (k) m[k] = (m[k] || 0) + num(r.Summa_Som); }); return m; }, [savat]);
  const dolByX = useMemo(() => { const m: Record<string, number> = {}; savat.forEach(r => { const k = String(r.Xarid_ID || "").trim(); if (k) m[k] = (m[k] || 0) + num(r.Jami_Summa); }); return m; }, [savat]);

  const items = useMemo(() => firmalar.filter(f => f.Taminotchi_ID).sort((a, b) => (a.Ism || "").localeCompare(b.Ism || "", "uz")), [firmalar]);
  const selected = useMemo(() => firmalar.find(f => f.Taminotchi_ID === sel), [firmalar, sel]);

  const data = useMemo(() => {
    if (!selected) return null;
    const fromK = isoKey(fromISO), toK = isoKey(toISO);
    const bSom = num(selected.Boshlangich_som), bUsd = num(selected.Boshlangich_Balans);

    // Barcha xaridlar summaga qo'shiladi (Akt_sverka filtri YO'Q — firma xaridlari har doim qarzga kiradi, eski dasturga mos)
    const myX = xaridlar.filter(x => String(x.Taminotchi_ID || "").trim() === sel);
    let eskiSom = bSom, eskiUsd = bUsd, xaridSom = 0, xaridUsd = 0;
    const buyList: { id: string; raqam: string; sana: string; som: number; usd: number; akt: boolean; k: string }[] = [];
    myX.forEach(x => {
      const xid = String(x.Xarid_ID || "").trim();
      const som = somByX[xid] || 0, usd = dolByX[xid] || 0;
      const aktT = String(x.Akt_sverka || "").toUpperCase() === "TRUE";
      const k = dkey(x.Sana);
      if (fromK && k < fromK) { eskiSom += som; eskiUsd += usd; return; }
      if (toK && k > toK) return;
      xaridSom += som; xaridUsd += usd;
      buyList.push({ id: xid, raqam: x.Sotuv_Raqami || "", sana: x.Sana, som, usd, akt: aktT, k: k + (x.Vaqt || "") });
    });

    const myT = tolovlar.filter(t => String(t.Taminotchi_ID || "").trim() === sel);
    let tolovSom = 0, tolovUsd = 0;
    const payRows: { id: string; sana: string; turi: string; som: number; usd: number; chk: boolean; k: string }[] = [];
    myT.forEach(t => {
      const som = num(t.Summa), usd = num(t.Summa_dollar);
      const chk = String(t.Check || "").toUpperCase() === "TRUE";
      const k = dkey(t.Sana);
      if (fromK && k < fromK) { eskiSom -= som; eskiUsd -= usd; return; }
      if (toK && k > toK) return;
      tolovSom += som; tolovUsd += usd;
      payRows.push({ id: String(t.X_Tolov_ID || "").trim(), sana: t.Sana, turi: t.Turi || (usd > 0 ? "Dollar" : "So'm"), som, usd, chk, k: k + (t.Vaqt || "") });
    });

    buyList.sort((a, b) => b.k.localeCompare(a.k));
    payRows.sort((a, b) => b.k.localeCompare(a.k));
    return {
      eskiSom, eskiUsd, xaridSom, xaridUsd, tolovSom, tolovUsd,
      qoldiqSom: eskiSom + xaridSom - tolovSom, qoldiqUsd: eskiUsd + xaridUsd - tolovUsd,
      buyList, payRows, buyCount: buyList.length, payCount: payRows.length,
    };
  }, [selected, sel, xaridlar, somByX, dolByX, tolovlar, fromISO, toISO]);

  function doExport(kind: "pdf" | "excel") {
    if (!data || !selected) return;
    const ds = (iso: string) => iso ? iso.split("-").reverse().join(".") : "";
    const secs: ExportSection[] = [];
    if (data.eskiSom || data.xaridSom || data.tolovSom || data.qoldiqSom)
      secs.push({ heading: "SO'M", headers: ["Ko'rsatkich", "Summa"], rows: [
        ["Eski qarzdorlik", fmtSom(data.eskiSom) + " so'm"],
        ["Xarid summasi", fmtSom(data.xaridSom) + " so'm"],
        ["To'lov summasi", fmtSom(data.tolovSom) + " so'm"],
      ], foot: ["Tugash qoldiq", fmtSom(data.qoldiqSom) + " so'm"] });
    if (data.eskiUsd || data.xaridUsd || data.tolovUsd || data.qoldiqUsd)
      secs.push({ heading: "DOLLAR ($)", headers: ["Ko'rsatkich", "Summa"], rows: [
        ["Eski qarzdorlik", fmtUsd(data.eskiUsd) + " $"],
        ["Xarid summasi", fmtUsd(data.xaridUsd) + " $"],
        ["To'lov summasi", fmtUsd(data.tolovUsd) + " $"],
      ], foot: ["Tugash qoldiq", fmtUsd(data.qoldiqUsd) + " $"] });
    const opts = {
      title: `Akt-sverka (Firma) — ${selected.Ism || ""}`,
      subtitle: `Davr: ${ds(fromISO)} — ${ds(toISO)}${selected.Telefon ? "  ·  Tel: " + selected.Telefon : ""}`,
      filename: `akt-sverka-firma-${(selected.Ism || "firma").replace(/\s+/g, "_")}-${ds(toISO).replace(/\./g, "-")}`,
      sections: secs.length ? secs : [{ headers: ["—"], rows: [["Ma'lumot yo'q"]] }],
    };
    if (kind === "pdf") exportPDF(opts); else exportExcel(opts);
  }

  const panel: React.CSSProperties = { background: "var(--white)", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", overflow: "hidden", display: "flex", flexDirection: "column" };
  const panelHead: React.CSSProperties = { padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 700 };
  const sumRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "9px 0", borderBottom: "1px solid var(--border)", gap: 10 };

  return (
    <>
      <header className="header">
        <div className="header__inner">
          <h1 className="header__title" style={{ paddingLeft: 4 }}>Akt-sverka — Firma</h1>
          <div className="header__spacer" />
          {selected && (<><button className="btn btn--outline" onClick={() => doExport("excel")}>Excel</button><button className="btn btn--primary" onClick={() => doExport("pdf")}>PDF</button></>)}
        </div>
      </header>

      <div className="page-content" style={{ maxWidth: 1360 }}>
        {loading ? <div className="spinner--page" /> : (
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(300px,360px) 1fr 1fr", gap: 16, alignItems: "start" }}>

            <div style={panel}>
              <div style={panelHead}>Akt Sverka</div>
              <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="field">
                  <label>Firma (ta&apos;minotchi) *</label>
                  <select value={sel} onChange={e => setSel(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", border: `1px solid ${sel ? "var(--primary)" : "var(--border-2)"}`, borderRadius: "var(--radius)", fontSize: 14, fontWeight: 600, background: "var(--bg-2)", color: "var(--text)", outline: "none" }}>
                    <option value="">Firma tanlang…</option>
                    {items.map(f => <option key={f.Taminotchi_ID} value={f.Taminotchi_ID}>{f.Ism}{f.Telefon ? " | " + f.Telefon : ""}</option>)}
                  </select>
                </div>
                <div className="grid-2">
                  <div className="field"><label>Boshlanish sana</label><input type="date" value={fromISO} onChange={e => setFromISO(e.target.value)} /></div>
                  <div className="field"><label>Tugash sana</label><input type="date" value={toISO} onChange={e => setToISO(e.target.value)} /></div>
                </div>

                {!selected ? (
                  <p style={{ fontSize: 13, color: "var(--text-3)", padding: "8px 0" }}>Firma tanlang — akt-sverka hisoblanadi.</p>
                ) : data && (
                  <div style={{ marginTop: 4 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", letterSpacing: ".05em", margin: "6px 0 2px" }}>SO&apos;M</p>
                    <div style={sumRow}><span style={{ fontSize: 13, color: "var(--text-2)" }}>Eski qarzdorlik</span><span style={{ fontSize: 14, fontWeight: 700 }}>{fmtSom(data.eskiSom)}</span></div>
                    <div style={sumRow}><span style={{ fontSize: 13, color: "var(--text-2)" }}>Xarid summasi</span><span style={{ fontSize: 14, fontWeight: 700 }}>{fmtSom(data.xaridSom)}</span></div>
                    <div style={sumRow}><span style={{ fontSize: 13, color: "var(--text-2)" }}>To&apos;lov summasi</span><span style={{ fontSize: 14, fontWeight: 700, color: "#16a34a" }}>{fmtSom(data.tolovSom)}</span></div>
                    <div style={{ ...sumRow, borderBottom: "none", paddingTop: 12 }}><span style={{ fontSize: 13, fontWeight: 700 }}>Tugash qoldiq</span><span style={{ fontSize: 17, fontWeight: 800, color: data.qoldiqSom > 0 ? "#ef4444" : "#16a34a" }}>{fmtSom(data.qoldiqSom)}</span></div>

                    <p style={{ fontSize: 11, fontWeight: 700, color: "#2563eb", letterSpacing: ".05em", margin: "14px 0 2px" }}>DOLLAR ($)</p>
                    <div style={sumRow}><span style={{ fontSize: 13, color: "var(--text-2)" }}>Eski qarzdorlik</span><span style={{ fontSize: 14, fontWeight: 700 }}>$ {fmtUsd(data.eskiUsd)}</span></div>
                    <div style={sumRow}><span style={{ fontSize: 13, color: "var(--text-2)" }}>Xarid summasi</span><span style={{ fontSize: 14, fontWeight: 700 }}>$ {fmtUsd(data.xaridUsd)}</span></div>
                    <div style={sumRow}><span style={{ fontSize: 13, color: "var(--text-2)" }}>To&apos;lov summasi</span><span style={{ fontSize: 14, fontWeight: 700, color: "#2563eb" }}>$ {fmtUsd(data.tolovUsd)}</span></div>
                    <div style={{ ...sumRow, borderBottom: "none", paddingTop: 12 }}><span style={{ fontSize: 13, fontWeight: 700 }}>Tugash qoldiq</span><span style={{ fontSize: 17, fontWeight: 800, color: data.qoldiqUsd > 0 ? "#ef4444" : "#2563eb" }}>$ {fmtUsd(data.qoldiqUsd)}</span></div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ ...panel, maxHeight: isMobile ? undefined : "calc(100vh - 120px)" }}>
              <div style={panelHead}>Xaridlar <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: "var(--bg)", color: "var(--text-2)" }}>{data?.buyCount ?? 0}</span></div>
              <div style={{ overflowY: "auto", flex: 1 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 120px 18px", padding: "8px 18px", background: "var(--bg)", borderBottom: "1px solid var(--border)", position: "sticky", top: 0 }}>
                  {["SANA", "SO'M", "$"].map(h => <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".04em", textAlign: h === "SANA" ? "left" : "right" }}>{h}</span>)}
                  <span />
                </div>
                {!data || data.buyList.length === 0 ? <div style={{ padding: 24, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>Xarid yo&apos;q</div> :
                  data.buyList.map((s, i) => {
                    const col = s.akt ? "#16a34a" : "#ef4444";
                    return (
                    <div key={s.id || i} onClick={() => s.id && goDetail(`/xarid/${s.id}`)}
                      title={s.akt ? "Akt-sverka qilingan" : "Akt-sverka qilinmagan — summaga qo'shilmaydi"}
                      style={{ display: "grid", gridTemplateColumns: "1fr 120px 120px 18px", padding: "10px 18px", borderBottom: "1px solid var(--border)", alignItems: "center", cursor: "pointer" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--bg)")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: col }}>{s.sana}{s.raqam ? ` · #${s.raqam}` : ""}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, textAlign: "right", color: s.som ? col : "var(--text-3)" }}>{s.som ? fmtSom(s.som) : "—"}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, textAlign: "right", color: s.usd ? col : "var(--text-3)" }}>{s.usd ? "$" + fmtUsd(s.usd) : "—"}</span>
                      <svg width="14" height="14" fill="none" stroke="var(--text-3)" viewBox="0 0 24 24" style={{ marginLeft: 4 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </div>
                    );
                  })}
              </div>
            </div>

            <div style={{ ...panel, maxHeight: isMobile ? undefined : "calc(100vh - 120px)" }}>
              <div style={panelHead}>Xarid to&apos;lovlari <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: "var(--bg)", color: "var(--text-2)" }}>{data?.payCount ?? 0}</span></div>
              <div style={{ overflowY: "auto", flex: 1 }}>
                <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 130px 18px", padding: "8px 18px", background: "var(--bg)", borderBottom: "1px solid var(--border)", position: "sticky", top: 0 }}>
                  {["SANA", "TURI", "SUMMA"].map(h => <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".04em", textAlign: h === "SUMMA" ? "right" : "left" }}>{h}</span>)}
                  <span />
                </div>
                {!data || data.payRows.length === 0 ? <div style={{ padding: 24, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>To&apos;lov yo&apos;q</div> :
                  data.payRows.map((p, i) => {
                    const col = p.chk ? "#16a34a" : "#ef4444";
                    return (
                    <div key={p.id || i} onClick={() => p.id && goDetail(`/xarid/tolov/${p.id}`)}
                      title={p.chk ? "Akt-sverka qilingan" : "Akt-sverka qilinmagan"}
                      style={{ display: "grid", gridTemplateColumns: "100px 1fr 130px 18px", padding: "10px 18px", borderBottom: "1px solid var(--border)", alignItems: "center", cursor: "pointer" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--bg)")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: col }}>{p.sana}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>{p.turi}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, textAlign: "right", color: col }}>{p.usd > 0 ? "$" + fmtUsd(p.usd) : fmtSom(p.som)}</span>
                      <svg width="14" height="14" fill="none" stroke="var(--text-3)" viewBox="0 0 24 24" style={{ marginLeft: 4 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
