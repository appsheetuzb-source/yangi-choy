"use client";
import { fetchSheet } from "@/lib/sheet-cache";
import { exportPDF, exportExcel, type ExportOpts, type ExportSection } from "@/lib/export";

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
  Sotuv_Raqami: string; Agent: string; Izoh: string; Vaqt: string; Chek?: string;
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
  const [aktOpen, setAktOpen]       = useState(false);
  const [tgOpen, setTgOpen]         = useState(false);
  const _y = new Date().getFullYear();
  const _todayISO = `${_y}-${String(new Date().getMonth()+1).padStart(2,"0")}-${String(new Date().getDate()).padStart(2,"0")}`;
  const [aktFrom, setAktFrom]       = useState(`${_y}-01-01`);
  const [aktTo, setAktTo]           = useState(_todayISO);

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

  // Stats — faqat tasdiqlangan (Chek=TRUE) sotuvlar qarzga qo'shiladi
  const tasdiqSotuv = (sv: Sotuv) => String(sv.Chek||"").toUpperCase()==="TRUE";
  const jamiSotuvSom = useMemo(() =>
    sotuvlar.filter(tasdiqSotuv).reduce((s, sv) =>
      s + (savatMap[sv.Sotuv_ID] || []).reduce((ss, r) => ss + num(r.Summa_som), 0), 0),
    [sotuvlar, savatMap]);

  const jamiSotuvDollar = useMemo(() =>
    sotuvlar.filter(tasdiqSotuv).reduce((s, sv) =>
      s + (savatDolMap[sv.Sotuv_ID] || []).reduce((ss, r) => ss + num(r.Summa), 0), 0),
    [sotuvlar, savatDolMap]);

  const tolovSom = useMemo(() =>
    tolovlar.filter(t => !isDollarValyuta(t.Valyuta)).reduce((s, t) => s + num(t.Summa), 0),
    [tolovlar]);
  const tolovDollar = useMemo(() =>
    tolovlar.filter(t => isDollarValyuta(t.Valyuta)).reduce((s, t) => s + num(t.Summa_dollar), 0),
    [tolovlar]);

  const boshlangichSom    = num(mijoz?.Boshlangich_Balans_som);
  const boshlangichDollar = num(mijoz?.Boshlangich_Balans_dollar);
  const qarzSom    = boshlangichSom    + jamiSotuvSom    - tolovSom;
  const qarzDollar = boshlangichDollar + jamiSotuvDollar - tolovDollar;

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
    sotuvlar.filter(s => String(s.Chek || "").toUpperCase() === "TRUE").forEach(s => {
      const amt = cur === "som"
        ? (savatMap[s.Sotuv_ID] || []).reduce((a, r) => a + num(r.Summa_som), 0)
        : (savatDolMap[s.Sotuv_ID] || []).reduce((a, r) => a + num(r.Summa), 0);
      if (amt > 0) events.push({ sana: s.Sana, vaqt: s.Vaqt || "", debit: amt, credit: 0, tavsif: `Sotuv${s.Sotuv_Raqami ? " #" + s.Sotuv_Raqami : ""}` });
    });
    tolovlar.forEach(t => {
      const isD = isDollarValyuta(t.Valyuta);
      const amt = cur === "som" ? (!isD ? num(t.Summa) : 0) : (isD ? num(t.Summa_dollar) : 0);
      if (amt > 0) events.push({ sana: t.Sana, vaqt: t.Vaqt || "", debit: 0, credit: amt, tavsif: `To'lov${t.Turi ? " (" + t.Turi + ")" : ""}` });
    });
    events.sort((a, b) => (dkey(a.sana) + a.vaqt).localeCompare(dkey(b.sana) + b.vaqt));
    const boshlangich = cur === "som" ? boshlangichSom : boshlangichDollar;
    const opening = boshlangich + events.filter(e => fromKey && dkey(e.sana) < fromKey).reduce((a, e) => a + e.debit - e.credit, 0);
    const inRange = events.filter(e => { const k = dkey(e.sana); return (!fromKey || k >= fromKey) && (!toKey || k <= toKey); });
    if (opening === 0 && inRange.length === 0) return null;
    let run = opening;
    const rows: (string | number)[][] = [["—", "Boshlang'ich qoldiq", "", "", fmtA(opening)]];
    inRange.forEach(e => { run += e.debit - e.credit; rows.push([e.sana, e.tavsif, e.debit ? fmtA(e.debit) : "", e.credit ? fmtA(e.credit) : "", fmtA(run)]); });
    return {
      heading: cur === "som" ? "SO'M HISOBVARAQA" : "DOLLAR ($) HISOBVARAQA",
      headers: ["Sana", "Amaliyot", "Sotuv (qarz)", "To'lov", "Qoldiq"],
      rows,
      foot: ["", "YAKUNIY QOLDIQ", "", "", fmtA(run)],
    };
  }
  function buildAkt(): ExportOpts {
    const ds = (iso: string) => iso ? iso.split("-").reverse().join(".") : "";
    const secs = [aktSection("som", aktFrom, aktTo), aktSection("dollar", aktFrom, aktTo)].filter(Boolean) as ExportSection[];
    return {
      title: `Akt-sverka — ${mijoz?.Ism || ""}`,
      subtitle: `Davr: ${ds(aktFrom) || "boshidan"} — ${ds(aktTo) || "hozirgача"}${mijoz?.Telefon ? "  ·  Tel: " + mijoz.Telefon : ""}`,
      filename: `akt-sverka-${(mijoz?.Ism || "klient").replace(/\s+/g, "_")}-${ds(aktTo).replace(/\./g, "-")}`,
      sections: secs.length ? secs : [{ headers: ["Sana", "Amaliyot", "Sotuv", "To'lov", "Qoldiq"], rows: [["", "Ma'lumot yo'q", "", "", ""]] }],
    };
  }

  // ── Telegramga qarzdorlik ulashish ──────────────────────
  function tgSana() { const d = new Date(); return `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${d.getFullYear()}`; }
  function tgMessage() {
    const lines = ["📋 QARZDORLIK", `Sana: ${tgSana()}`, `Mijoz: ${mijoz?.Ism || ""}`];
    if (qarzSom !== 0)    lines.push(`So'm: ${fmtSom(qarzSom)}`);
    if (qarzDollar !== 0) lines.push(`Dollar: ${fmtUsd(qarzDollar)}`);
    if (qarzSom === 0 && qarzDollar === 0) lines.push("Qarzdorlik yo'q ✅");
    return lines.join("\n");
  }
  function shareTgText() {
    window.open(`https://t.me/share/url?url=${encodeURIComponent("https://musaffotea.uz")}&text=${encodeURIComponent(tgMessage())}`, "_blank");
    setTgOpen(false);
  }
  function buildDebtImage(): Promise<Blob | null> {
    return new Promise(resolve => {
      const W = 680, H = 420;
      const c = document.createElement("canvas"); c.width = W; c.height = H;
      const ctx = c.getContext("2d"); if (!ctx) { resolve(null); return; }
      ctx.fillStyle = "#f0f4ff"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#ffffff"; ctx.fillRect(24, 24, W - 48, H - 48);
      ctx.fillStyle = "#1a2744"; ctx.fillRect(24, 24, W - 48, 70);
      ctx.fillStyle = "#ffffff"; ctx.font = "bold 30px Arial"; ctx.textAlign = "center";
      ctx.fillText("MUSAFFO TEA", W / 2, 68);
      ctx.fillStyle = "#1a2744"; ctx.font = "bold 22px Arial"; ctx.textAlign = "left";
      ctx.fillText("QARZDORLIK", 48, 140);
      ctx.strokeStyle = "#e0e3ef"; ctx.beginPath(); ctx.moveTo(48, 155); ctx.lineTo(W - 48, 155); ctx.stroke();
      let y = 200;
      const row = (label: string, val: string, color: string) => {
        ctx.fillStyle = "#5a6080"; ctx.font = "18px Arial"; ctx.fillText(label, 48, y);
        ctx.fillStyle = color; ctx.font = "bold 24px Arial"; ctx.fillText(val, 230, y); y += 52;
      };
      row("Sana:", tgSana(), "#1a2744");
      row("Mijoz:", mijoz?.Ism || "—", "#2f6bf7");
      if (qarzSom !== 0) row("So'm:", fmtSom(qarzSom), qarzSom > 0 ? "#ef4444" : "#16a34a");
      if (qarzDollar !== 0) row("Dollar:", fmtUsd(qarzDollar), qarzDollar > 0 ? "#ef4444" : "#2563eb");
      if (qarzSom === 0 && qarzDollar === 0) row("Holat:", "Qarzdorlik yo'q", "#16a34a");
      ctx.fillStyle = "#b0b8d0"; ctx.font = "14px Arial"; ctx.textAlign = "center";
      ctx.fillText("musaffotea.uz", W / 2, H - 44);
      c.toBlob(b => resolve(b), "image/png");
    });
  }
  async function shareTgImage() {
    const blob = await buildDebtImage();
    if (!blob) return;
    const file = new File([blob], `qarzdorlik-${(mijoz?.Ism || "klient").replace(/\s+/g,"_")}.png`, { type: "image/png" });
    try {
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: tgMessage() });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = file.name; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch { /* foydalanuvchi bekor qildi */ }
    setTgOpen(false);
  }

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
          <button onClick={() => setTgOpen(true)} title="Telegramga qarzdorlik yuborish"
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", border: "1.5px solid #229ED9", borderRadius: "var(--radius)", background: "#e9f6fc", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#229ED9", flexShrink: 0 }}>
            <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/></svg>
            {!isMobile && "Telegram"}
          </button>
          <button onClick={() => setAktOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", border: "1.5px solid var(--primary)", borderRadius: "var(--radius)", background: "var(--primary-glow)", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "var(--primary)", flexShrink: 0 }}>
            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            {!isMobile && "Akt-sverka"}
          </button>
          <button onClick={() => { setForm({ ...mijoz }); setEditOpen(true); }}
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
              <h2 className="modal__title">Akt-sverka — {mijoz?.Ism || ""}</h2>
              <button className="modal__close" onClick={() => setAktOpen(false)}>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="modal__body">
              <p style={{ fontSize: 13, color: "var(--text-2)" }}>Sana oralig'ini tanlang. So&apos;m va $ alohida hisobvaraqada chiqariladi.</p>
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

      {tgOpen && (
        <div className="modal-overlay" onClick={() => setTgOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal__head">
              <h2 className="modal__title">Telegramga yuborish</h2>
              <button className="modal__close" onClick={() => setTgOpen(false)}>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="modal__body">
              <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".05em", marginBottom: 8 }}>QARZDORLIK</p>
                <p style={{ fontSize: 13, color: "var(--text-2)" }}>Sana: <b style={{ color: "var(--text)" }}>{tgSana()}</b></p>
                <p style={{ fontSize: 13, color: "var(--text-2)" }}>Mijoz: <b style={{ color: "var(--primary)" }}>{mijoz?.Ism || "—"}</b></p>
                {qarzSom !== 0 && <p style={{ fontSize: 14, fontWeight: 800, color: qarzSom > 0 ? "#ef4444" : "#16a34a", marginTop: 4 }}>So&apos;m: {fmtSom(qarzSom)}</p>}
                {qarzDollar !== 0 && <p style={{ fontSize: 14, fontWeight: 800, color: qarzDollar > 0 ? "#ef4444" : "#2563eb", marginTop: 2 }}>Dollar: {fmtUsd(qarzDollar)}</p>}
                {qarzSom === 0 && qarzDollar === 0 && <p style={{ fontSize: 14, fontWeight: 800, color: "#16a34a", marginTop: 4 }}>Qarzdorlik yo&apos;q ✅</p>}
              </div>
            </div>
            <div className="modal__footer">
              <button className="btn btn--outline" style={{ flex: 1 }} onClick={shareTgText}>
                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 4v-4z"/></svg> Matn
              </button>
              <button className="btn btn--primary" style={{ flex: 1 }} onClick={shareTgImage}>
                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg> Surat
              </button>
            </div>
          </div>
        </div>
      )}

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
                const isTasdiqlandi = String(s.Chek||"").toUpperCase()==="TRUE";
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
                const isTasdiqlandi = String(s.Chek||"").toUpperCase()==="TRUE";
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
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,42,76,.42)", backdropFilter: "blur(4px)", zIndex: 999 }} onClick={() => setEditOpen(false)}/>
          <div style={{
            position: "fixed",
            ...(isMobile
              ? { bottom: 0, left: 0, right: 0, borderRadius: "20px 20px 0 0", maxHeight: "85vh", overflowY: "auto" }
              : { top: 0, right: 0, width: 380, height: "100%", overflowY: "auto" }),
            background: "var(--white)", zIndex: 1000, padding: "24px 20px",
            display: "flex", flexDirection: "column", gap: 16,
            boxShadow: "-16px 0 48px rgba(30,64,124,.18)"
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
