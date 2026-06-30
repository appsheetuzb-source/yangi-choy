"use client";
import { fetchSheets } from "@/lib/sheet-cache";
import { useAuth } from "@/lib/AuthContext";
import { exportPDF, exportExcel, type ExportSection } from "@/lib/export";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const SAVE_KEY = "aktMijoz_sel";

interface Mijoz { Mijoz_ID: string; Ism: string; Telefon: string; Agent: string; Boshlangich_Balans_som?: string; Boshlangich_Balans_dollar?: string; }
interface Sotuv { Sotuv_ID: string; Mijoz_ID: string; Sana: string; Vaqt?: string; Chek?: string; Sotuv_Raqami?: string; }
interface SavatSom { Sotuv_ID: string; Summa_som: string; }
interface SavatDol { Sotuv_ID: string; Sotuv_ID2?: string; Summa: string; }
interface STolov { Tolov_ID: string; Mijoz_ID: string; Sana: string; Vaqt?: string; Valyuta: string; Turi?: string; Som: string; Summa: string; Summa_dollar: string; Check?: string; }

function num(v: string | number | undefined) { return parseFloat(String(v || "0").replace(/\s/g, "").replace(",", ".")) || 0; }
function isDollar(v: string) { const s = String(v || "").toLowerCase(); return s.includes("dollar") || s === "$"; }
function mid(raw: string) { const v = String(raw || "").trim(); return v.includes(".") ? v.split(".")[1] : v; }
function fmtSom(v: number) { return v.toLocaleString("ru-RU"); }
function fmtUsd(v: number) { return v.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function dkey(sana: string) { const [d, m, y] = String(sana || "").split("."); return `${y || "0000"}${(m || "00").padStart(2, "0")}${(d || "00").padStart(2, "0")}`; }
function isoKey(iso: string) { return iso ? iso.replace(/-/g, "") : ""; }

export default function AktSverkaPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isSotuvchi = user?.lavozim === "Sotuvchi";

  const [mijozlar, setMijozlar] = useState<Mijoz[]>([]);
  const [sotuvlar, setSotuvlar] = useState<Sotuv[]>([]);
  const [savatSom, setSavatSom] = useState<SavatSom[]>([]);
  const [savatDol, setSavatDol] = useState<SavatDol[]>([]);
  const [tolovlar, setTolovlar] = useState<STolov[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  const [selMijoz, setSelMijoz] = useState("");
  const [fromISO, setFromISO] = useState("2025-09-01");
  const now = new Date();
  const [toISO, setToISO] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`);

  useEffect(() => {
    const c = () => setIsMobile(window.innerWidth < 900);
    c(); window.addEventListener("resize", c); return () => window.removeEventListener("resize", c);
  }, []);

  // Tanlovni FAQAT drill-in (sotuv/to'lov ochish) orqali saqlaymiz va qaytishda bir marta tiklaymiz.
  // Menyudan kelinса — bo'sh bo'ladi (saqlangan tanlov bo'lmaydi).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SAVE_KEY);
      if (raw) {
        sessionStorage.removeItem(SAVE_KEY); // bir martalik: faqat drill-indan qaytishda ishlaydi
        const o = JSON.parse(raw);
        if (o.sel) setSelMijoz(o.sel);
        if (o.from) setFromISO(o.from);
        if (o.to) setToISO(o.to);
      }
    } catch {}
  }, []);
  // Sotuv/to'lov detaliga o'tishdan oldin joriy tanlovni saqlaydi
  function goDetail(path: string) {
    try { sessionStorage.setItem(SAVE_KEY, JSON.stringify({ sel: selMijoz, from: fromISO, to: toISO })); } catch {}
    router.push(path);
  }

  useEffect(() => {
    fetchSheets(["Mijozlar", "Sotuv", "Sotuv_Savat", "Sotuv_savat_dollar", "S_tolov"]).then(r => {
      setMijozlar((r["Mijozlar"]?.data || []) as Mijoz[]);
      setSotuvlar((r["Sotuv"]?.data || []) as Sotuv[]);
      setSavatSom((r["Sotuv_Savat"]?.data || []) as SavatSom[]);
      setSavatDol((r["Sotuv_savat_dollar"]?.data || []) as SavatDol[]);
      setTolovlar((r["S_tolov"]?.data || []) as STolov[]);
    }).finally(() => setLoading(false));
  }, []);

  // Sotuv_ID -> savat som/dollar summasi
  const somByS = useMemo(() => { const m: Record<string, number> = {}; savatSom.forEach(r => { const k = String(r.Sotuv_ID || "").trim(); if (k) m[k] = (m[k] || 0) + num(r.Summa_som); }); return m; }, [savatSom]);
  const dolByS = useMemo(() => { const m: Record<string, number> = {}; savatDol.forEach(r => { const k = String(r.Sotuv_ID || "").trim(); if (k) m[k] = (m[k] || 0) + num(r.Summa); }); return m; }, [savatDol]);

  const mijItems = useMemo(() => {
    let list = mijozlar.filter(m => m.Mijoz_ID);
    if (isSotuvchi && user?.id) list = list.filter(m => (m.Agent || "").trim() === user.id);
    return list.sort((a, b) => (a.Ism || "").localeCompare(b.Ism || "", "uz"));
  }, [mijozlar, isSotuvchi, user]);

  const selected = useMemo(() => mijozlar.find(m => m.Mijoz_ID === selMijoz), [mijozlar, selMijoz]);

  const data = useMemo(() => {
    if (!selected) return null;
    const fromK = isoKey(fromISO), toK = isoKey(toISO);
    const bSom = num(selected.Boshlangich_Balans_som), bUsd = num(selected.Boshlangich_Balans_dollar);

    // sotuvlar — barchasi ko'rinadi; qarzga/summaga faqat Chek=TRUE qo'shiladi (eski dasturga mos)
    const mySot = sotuvlar.filter(s => mid(s.Mijoz_ID) === selMijoz);
    let eskiSom = bSom, eskiUsd = bUsd, sotuvSom = 0, sotuvUsd = 0;
    const salesList: { id: string; raqam: string; sana: string; som: number; usd: number; chek: boolean; k: string }[] = [];
    mySot.forEach(s => {
      const sid = String(s.Sotuv_ID || "").trim();
      const som = somByS[sid] || 0, usd = dolByS[sid] || 0;
      const chek = String(s.Chek || "").trim() !== "";
      const k = dkey(s.Sana);
      if (fromK && k < fromK) { if (chek) { eskiSom += som; eskiUsd += usd; } return; }
      if (toK && k > toK) return;
      if (chek) { sotuvSom += som; sotuvUsd += usd; }
      salesList.push({ id: sid, raqam: s.Sotuv_Raqami || "", sana: s.Sana, som, usd, chek, k: k + (s.Vaqt || "") });
    });

    // to'lovlar
    const myTol = tolovlar.filter(t => mid(t.Mijoz_ID) === selMijoz);
    let tolovSom = 0, tolovUsd = 0;
    const payRows: { id: string; sana: string; valyuta: string; turi: string; som: number; usd: number; chk: boolean; k: string }[] = [];
    myTol.forEach(t => {
      const dD = isDollar(t.Valyuta);
      const som = dD ? 0 : num(t.Summa), usd = dD ? num(t.Summa_dollar) : 0;
      const chk = String(t.Check || "").toUpperCase() === "TRUE";
      const k = dkey(t.Sana);
      if (fromK && k < fromK) { eskiSom -= som; eskiUsd -= usd; return; }
      if (toK && k > toK) return;
      tolovSom += som; tolovUsd += usd;
      payRows.push({ id: String(t.Tolov_ID || "").trim(), sana: t.Sana, valyuta: dD ? "Dollar" : "So'm", turi: t.Turi || "", som, usd, chk, k: k + (t.Vaqt || "") });
    });

    salesList.sort((a, b) => b.k.localeCompare(a.k));
    payRows.sort((a, b) => b.k.localeCompare(a.k));

    return {
      eskiSom, eskiUsd, sotuvSom, sotuvUsd, tolovSom, tolovUsd,
      qoldiqSom: eskiSom + sotuvSom - tolovSom,
      qoldiqUsd: eskiUsd + sotuvUsd - tolovUsd,
      salesList, payRows, salesCount: salesList.length, payCount: payRows.length,
    };
  }, [selected, selMijoz, sotuvlar, somByS, dolByS, tolovlar, fromISO, toISO]);

  function doExport(kind: "pdf" | "excel") {
    if (!data || !selected) return;
    const ds = (iso: string) => iso ? iso.split("-").reverse().join(".") : "";
    const secs: ExportSection[] = [];
    if (data.eskiSom || data.sotuvSom || data.tolovSom || data.qoldiqSom)
      secs.push({ heading: "SO'M", headers: ["Ko'rsatkich", "Summa"], rows: [
        ["Eski qarzdorlik", fmtSom(data.eskiSom) + " so'm"],
        ["Sotuv summasi", fmtSom(data.sotuvSom) + " so'm"],
        ["To'lov summasi", fmtSom(data.tolovSom) + " so'm"],
      ], foot: ["Tugash qoldiq", fmtSom(data.qoldiqSom) + " so'm"] });
    if (data.eskiUsd || data.sotuvUsd || data.tolovUsd || data.qoldiqUsd)
      secs.push({ heading: "DOLLAR ($)", headers: ["Ko'rsatkich", "Summa"], rows: [
        ["Eski qarzdorlik", fmtUsd(data.eskiUsd) + " $"],
        ["Sotuv summasi", fmtUsd(data.sotuvUsd) + " $"],
        ["To'lov summasi", fmtUsd(data.tolovUsd) + " $"],
      ], foot: ["Tugash qoldiq", fmtUsd(data.qoldiqUsd) + " $"] });
    const opts = {
      title: `Akt-sverka — ${selected.Ism || ""}`,
      subtitle: `Davr: ${ds(fromISO)} — ${ds(toISO)}${selected.Telefon ? "  ·  Tel: " + selected.Telefon : ""}`,
      filename: `akt-sverka-${(selected.Ism || "klient").replace(/\s+/g, "_")}-${ds(toISO).replace(/\./g, "-")}`,
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
          <h1 className="header__title" style={{ paddingLeft: 4 }}>Akt-sverka — Klient</h1>
          <div className="header__spacer" />
          {selected && (
            <>
              <button className="btn btn--outline" onClick={() => doExport("excel")}>Excel</button>
              <button className="btn btn--primary" onClick={() => doExport("pdf")}>PDF</button>
            </>
          )}
        </div>
      </header>

      <div className="page-content" style={{ maxWidth: 1360 }}>
        {loading ? <div className="spinner--page" /> : (
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(300px,360px) 1fr 1fr", gap: 16, alignItems: "start" }}>

            {/* Chap panel — sozlash + xulosa */}
            <div style={panel}>
              <div style={panelHead}>Akt Sverka</div>
              <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="field">
                  <label>Klient *</label>
                  <select value={selMijoz} onChange={e => setSelMijoz(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", border: `1px solid ${selMijoz ? "var(--primary)" : "var(--border-2)"}`, borderRadius: "var(--radius)", fontSize: 14, fontWeight: 600, background: "var(--bg-2)", color: "var(--text)", outline: "none" }}>
                    <option value="">Klient tanlang…</option>
                    {mijItems.map(m => <option key={m.Mijoz_ID} value={m.Mijoz_ID}>{m.Ism}{m.Telefon ? " | " + m.Telefon : ""}</option>)}
                  </select>
                </div>
                <div className="grid-2">
                  <div className="field"><label>Boshlanish sana</label><input type="date" value={fromISO} onChange={e => setFromISO(e.target.value)} /></div>
                  <div className="field"><label>Tugash sana</label><input type="date" value={toISO} onChange={e => setToISO(e.target.value)} /></div>
                </div>

                {!selected ? (
                  <p style={{ fontSize: 13, color: "var(--text-3)", padding: "8px 0" }}>Klient tanlang — akt-sverka hisoblanadi.</p>
                ) : data && (
                  <div style={{ marginTop: 4 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", letterSpacing: ".05em", margin: "6px 0 2px" }}>SO&apos;M</p>
                    <div style={sumRow}><span style={{ fontSize: 13, color: "var(--text-2)" }}>Eski qarzdorlik</span><span style={{ fontSize: 14, fontWeight: 700 }}>{fmtSom(data.eskiSom)}</span></div>
                    <div style={sumRow}><span style={{ fontSize: 13, color: "var(--text-2)" }}>Sotuv summasi</span><span style={{ fontSize: 14, fontWeight: 700 }}>{fmtSom(data.sotuvSom)}</span></div>
                    <div style={sumRow}><span style={{ fontSize: 13, color: "var(--text-2)" }}>To&apos;lov summasi</span><span style={{ fontSize: 14, fontWeight: 700, color: "#16a34a" }}>{fmtSom(data.tolovSom)}</span></div>
                    <div style={{ ...sumRow, borderBottom: "none", paddingTop: 12 }}><span style={{ fontSize: 13, fontWeight: 700 }}>Tugash qoldiq</span><span style={{ fontSize: 17, fontWeight: 800, color: data.qoldiqSom > 0 ? "#ef4444" : "#16a34a" }}>{fmtSom(data.qoldiqSom)}</span></div>

                    <p style={{ fontSize: 11, fontWeight: 700, color: "#2563eb", letterSpacing: ".05em", margin: "14px 0 2px" }}>DOLLAR ($)</p>
                    <div style={sumRow}><span style={{ fontSize: 13, color: "var(--text-2)" }}>Eski qarzdorlik</span><span style={{ fontSize: 14, fontWeight: 700 }}>$ {fmtUsd(data.eskiUsd)}</span></div>
                    <div style={sumRow}><span style={{ fontSize: 13, color: "var(--text-2)" }}>Sotuv summasi</span><span style={{ fontSize: 14, fontWeight: 700 }}>$ {fmtUsd(data.sotuvUsd)}</span></div>
                    <div style={sumRow}><span style={{ fontSize: 13, color: "var(--text-2)" }}>To&apos;lov summasi</span><span style={{ fontSize: 14, fontWeight: 700, color: "#2563eb" }}>$ {fmtUsd(data.tolovUsd)}</span></div>
                    <div style={{ ...sumRow, borderBottom: "none", paddingTop: 12 }}><span style={{ fontSize: 13, fontWeight: 700 }}>Tugash qoldiq</span><span style={{ fontSize: 17, fontWeight: 800, color: data.qoldiqUsd > 0 ? "#ef4444" : "#2563eb" }}>$ {fmtUsd(data.qoldiqUsd)}</span></div>
                  </div>
                )}
              </div>
            </div>

            {/* O'rta panel — sotuvlar */}
            <div style={{ ...panel, maxHeight: isMobile ? undefined : "calc(100vh - 120px)" }}>
              <div style={panelHead}>Sotuvlar <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: "var(--bg)", color: "var(--text-2)" }}>{data?.salesCount ?? 0}</span></div>
              <div style={{ overflowY: "auto", flex: 1 }}>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 96px 70px 14px" : "1fr 120px 120px 18px", padding: "8px 18px", background: "var(--bg)", borderBottom: "1px solid var(--border)", position: "sticky", top: 0 }}>
                  {["SANA", "SO'M", "$"].map(h => <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".04em", textAlign: h === "SANA" ? "left" : "right" }}>{h}</span>)}
                  <span />
                </div>
                {!data || data.salesList.length === 0 ? <div style={{ padding: 24, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>Sotuv yo&apos;q</div> :
                  data.salesList.map((s, i) => {
                    const col = s.chek ? "#16a34a" : "#ef4444";
                    return (
                    <div key={s.id || i} onClick={() => s.id && goDetail(`/sotuv/${s.id}`)}
                      title={s.chek ? "Tasdiqlandi" : "Tasdiqlanmagan — summaga qo'shilmaydi"}
                      style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 96px 70px 14px" : "1fr 120px 120px 18px", padding: "10px 18px", borderBottom: "1px solid var(--border)", alignItems: "center", cursor: "pointer" }}
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

            {/* O'ng panel — to'lovlar */}
            <div style={{ ...panel, maxHeight: isMobile ? undefined : "calc(100vh - 120px)" }}>
              <div style={panelHead}>Sotuv to&apos;lovlari <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: "var(--bg)", color: "var(--text-2)" }}>{data?.payCount ?? 0}</span></div>
              <div style={{ overflowY: "auto", flex: 1 }}>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "76px 1fr 96px 14px" : "100px 1fr 130px 18px", padding: "8px 18px", background: "var(--bg)", borderBottom: "1px solid var(--border)", position: "sticky", top: 0 }}>
                  {["SANA", "VALYUTA", "SUMMA"].map(h => <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".04em", textAlign: h === "SUMMA" ? "right" : "left" }}>{h}</span>)}
                  <span />
                </div>
                {!data || data.payRows.length === 0 ? <div style={{ padding: 24, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>To&apos;lov yo&apos;q</div> :
                  data.payRows.map((p, i) => {
                    const col = p.chk ? "#16a34a" : "#ef4444";
                    return (
                    <div key={p.id || i} onClick={() => p.id && goDetail(`/sotuv/tolov/${p.id}`)}
                      title={p.chk ? "Tasdiqlandi" : "Tasdiqlanmagan"}
                      style={{ display: "grid", gridTemplateColumns: isMobile ? "76px 1fr 96px 14px" : "100px 1fr 130px 18px", padding: "10px 18px", borderBottom: "1px solid var(--border)", alignItems: "center", cursor: "pointer" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--bg)")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: col }}>{p.sana}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>{p.valyuta}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, textAlign: "right", color: col }}>{p.valyuta === "Dollar" ? "$" + fmtUsd(p.usd) : fmtSom(p.som)}</span>
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
