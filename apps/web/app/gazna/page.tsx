"use client";
import { fetchSheet, afterWrite } from "@/lib/sheet-cache";
import { useAuth } from "@/lib/AuthContext";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Gazna {
  Gazna_ID: string; Nomi: string; Boshlangich_balans: string;
  Turi: string; Shakli: string; Boshlanish_Sana: string;
  Tugash_Sana: string; Masul: string; Status: string;
}
interface STolov {
  Tolov_ID: string; Sana: string; Valyuta: string;
  Summa: string; Summa_dollar: string;
  Gazna_ID: string; Gazna_dollar_ID: string;
}
interface XTolov {
  X_Tolov_ID: string; Sana: string; Valyuta: string;
  Summa: string; Summa_dollar: string;
  Gazna_ID: string; Gazna_dollar_ID: string;
}

function num(v: string | number | undefined) {
  return parseFloat(String(v || "0").replace(/\s/g, "").replace(",", ".")) || 0;
}
function fmt(v: number, isDollar = false) {
  const s = Math.abs(v).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return isDollar ? s : s;
}
function uid() { return Math.random().toString(36).slice(2, 10); }

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
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

function getStats(gaz: Gazna, st: STolov[], xt: XTolov[], from: string, to: string) {
  const isDollar = gaz.Turi === "Dollar";
  const id = gaz.Gazna_ID;

  const allKirdi = isDollar
    ? st.filter(t => t.Gazna_dollar_ID === id).reduce((s, t) => s + num(t.Summa_dollar), 0)
    : st.filter(t => t.Gazna_ID === id).reduce((s, t) => s + num(t.Summa), 0);
  const allChiqdi = isDollar
    ? xt.filter(t => t.Gazna_dollar_ID === id).reduce((s, t) => s + num(t.Summa_dollar), 0)
    : xt.filter(t => t.Gazna_ID === id).reduce((s, t) => s + num(t.Summa), 0);

  const davrKirdi = isDollar
    ? st.filter(t => t.Gazna_dollar_ID === id && inRange(t.Sana, from, to)).reduce((s, t) => s + num(t.Summa_dollar), 0)
    : st.filter(t => t.Gazna_ID === id && inRange(t.Sana, from, to)).reduce((s, t) => s + num(t.Summa), 0);
  const davrChiqdi = isDollar
    ? xt.filter(t => t.Gazna_dollar_ID === id && inRange(t.Sana, from, to)).reduce((s, t) => s + num(t.Summa_dollar), 0)
    : xt.filter(t => t.Gazna_ID === id && inRange(t.Sana, from, to)).reduce((s, t) => s + num(t.Summa), 0);

  const joriy = num(gaz.Boshlangich_balans) + allKirdi - allChiqdi;
  return { allKirdi, allChiqdi, joriy, davrKirdi, davrChiqdi };
}

const BLANK_FORM = { Nomi: "", Turi: "So'm", Shakli: "Barchasi", Boshlangich_balans: "", Boshlanish_Sana: "" };

export default function GaznaPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isSotuvchi = user?.lavozim === "Sotuvchi";
  const [userGaznaId, setUserGaznaId] = useState<string>("");
  const [gaznalar, setGaznalar] = useState<Gazna[]>([]);
  const [stolov, setStolov]     = useState<STolov[]>([]);
  const [xtolov, setXtolov]     = useState<XTolov[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState(todayISO());

  const [showForm, setShowForm]   = useState(false);
  const [editItem, setEditItem]   = useState<Gazna | null>(null);
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [form, setForm]           = useState({ ...BLANK_FORM });

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check(); window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const loadData = useCallback(() => {
    setLoading(true); setError(null);
    Promise.all([
      fetchSheet("Gazna"),
      fetchSheet("S_tolov"),
      fetchSheet("X_tolov"),
      fetchSheet("Foydalanuvchi"),
    ]).then(([gR, sR, xR, fR]) => {
      if (gR.error) throw new Error(gR.error);
      if (sR.error) throw new Error(sR.error);
      if (xR.error) throw new Error(xR.error);
      // Sotuvchining Gazna_ID si — vergul bilan bir nechta bo'lishi mumkin: "id1 , id2"
      const me = (fR.data as Record<string,string>[]).find(f => f.Foydalanuvchi_ID === user?.id);
      const myGaznaIds = (me?.Gazna_ID || "").split(",").map(s => s.trim()).filter(Boolean);
      setUserGaznaId(myGaznaIds.join(","));
      const allGaznalar = ((gR.data as Gazna[]) || []).filter(g => g.Gazna_ID);
      // Sotuvchi faqat o'ziga belgilangan gaznalarni ko'radi
      const visibleGaznalar = isSotuvchi && myGaznaIds.length > 0
        ? allGaznalar.filter(g => myGaznaIds.includes(g.Gazna_ID))
        : allGaznalar;
      setGaznalar(visibleGaznalar);
      setStolov((sR.data as STolov[]) || []);
      setXtolov((xR.data as XTolov[]) || []);
    })
    .catch((e: unknown) => setError(e instanceof Error ? e.message : "Xatolik"))
    .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const somGaznalar    = gaznalar.filter(g => g.Turi !== "Dollar");
  const dollarGaznalar = gaznalar.filter(g => g.Turi === "Dollar");

  const allStats = gaznalar.map(g => ({ g, s: getStats(g, stolov, xtolov, dateFrom, dateTo) }));
  const somStats    = allStats.filter(x => x.g.Turi !== "Dollar");
  const dollarStats = allStats.filter(x => x.g.Turi === "Dollar");

  const jamiSom         = somStats.reduce((s, x) => s + x.s.joriy, 0);
  const jamiDollar      = dollarStats.reduce((s, x) => s + x.s.joriy, 0);
  const davrKirdi       = somStats.reduce((s, x) => s + x.s.davrKirdi, 0);
  const davrChiqdi      = somStats.reduce((s, x) => s + x.s.davrChiqdi, 0);
  const davrChiqdiDollar = dollarStats.reduce((s, x) => s + x.s.davrChiqdi, 0);
  const davrKirdiDollar  = dollarStats.reduce((s, x) => s + x.s.davrKirdi,  0);

  function openCreate() {
    setEditItem(null);
    setForm({ ...BLANK_FORM, Boshlanish_Sana: todayISO() });
    setShowForm(true);
  }
  function openEdit(g: Gazna) {
    setEditItem(g);
    setForm({
      Nomi: g.Nomi, Turi: g.Turi, Shakli: g.Shakli,
      Boshlangich_balans: g.Boshlangich_balans,
      Boshlanish_Sana: dmyToISO(g.Boshlanish_Sana) || todayISO(),
    });
    setShowForm(true);
  }
  function closeForm() { setShowForm(false); setEditItem(null); }

  async function handleSave() {
    if (!form.Nomi.trim()) return;
    setSaving(true);
    try {
      const sana = isoToDMY(form.Boshlanish_Sana);
      if (editItem) {
        const row: Partial<Gazna> = {
          Nomi: form.Nomi, Turi: form.Turi, Shakli: form.Shakli,
          Boshlangich_balans: form.Boshlangich_balans,
          Boshlanish_Sana: sana, Tugash_Sana: sana,
        };
        await fetch("/api/sheets", { method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sheet: "Gazna", idColumn: "Gazna_ID", idValue: editItem.Gazna_ID, row }) });
      } else {
        const row: Partial<Gazna> = {
          Gazna_ID: uid(), Nomi: form.Nomi, Turi: form.Turi, Shakli: form.Shakli,
          Boshlangich_balans: form.Boshlangich_balans,
          Boshlanish_Sana: sana, Tugash_Sana: sana,
          Masul: "", Status: "Faol",
        };
        await fetch("/api/sheets", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sheet: "Gazna", row }) });
      }
      afterWrite("Gazna"); closeForm(); loadData();
    } finally { setSaving(false); }
  }

  async function handleDelete(g: Gazna) {
    if (!confirm(`"${g.Nomi}" hisobni o'chirmoqchimisiz?`)) return;
    setDeleting(g.Gazna_ID);
    try {
      await fetch("/api/sheets", { method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet: "Gazna", idColumn: "Gazna_ID", idValue: g.Gazna_ID }) });
      afterWrite("Gazna"); loadData();
    } finally { setDeleting(null); }
  }

  const summaryCards = [
    { label: "JAMI SO'M (JORIY)", value: fmt(jamiSom), unit: "so'm",
      color: "#16a34a", bg: "var(--white)", icon: (
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
        </svg>
      ), iconBg: "#dcfce7" },
    { label: "DAVR KIRDI (SO'M)", value: fmt(davrKirdi), unit: "so'm",
      color: "#16a34a", bg: "var(--white)", icon: (
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
        </svg>
      ), iconBg: "#dcfce7" },
    { label: "DAVR CHIQDI (SO'M)", value: fmt(davrChiqdi), unit: "so'm",
      color: "#ef4444", bg: "var(--white)", icon: (
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 17H5m0 0V9m0 8l8-8 4 4 6-6"/>
        </svg>
      ), iconBg: "#fee2e2" },
  ];

  return (
    <>
      <header className="header">
        <div className="header__inner" style={{ gap: 10, flexWrap: isMobile ? "wrap" : "nowrap" }}>
          <h1 className="header__title">Gazna</h1>
          <span style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600, whiteSpace: "nowrap" }}>
            Davr:
          </span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{ fontSize: 12, border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "5px 8px",
              background: "var(--white)", color: "var(--text)", cursor: "pointer" }}/>
          <span style={{ color: "var(--text-3)", fontSize: 14 }}>—</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{ fontSize: 12, border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "5px 8px",
              background: "var(--white)", color: "var(--text)", cursor: "pointer" }}/>
          <button onClick={loadData} title="Yangilash" style={{
            width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
            border: "1px solid var(--border)", borderRadius: "var(--radius)",
            background: "var(--white)", cursor: "pointer", color: "var(--text-2)", flexShrink: 0,
          }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
          </button>
          <div className="header__spacer"/>
          <button className="btn btn--primary" onClick={openCreate} style={{ flexShrink: 0 }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
            </svg>
            Hisob
          </button>
        </div>
      </header>

      <div className="page-content">
        {loading && <div className="spinner--page"/>}
        {error && <div className="error-box"><p>{error}</p></div>}

        {!loading && !error && (
          <>
            {/* Summary cards */}
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)",
              gap: isMobile ? 10 : 14, marginBottom: isMobile ? 20 : 28,
            }}>
              {summaryCards.map((c, i) => (
                <div key={i} style={{
                  background: c.bg, borderRadius: "var(--radius-xl)",
                  boxShadow: "var(--shadow-sm)", padding: isMobile ? "14px" : "18px 20px",
                  border: "1px solid var(--border)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".06em" }}>
                      {c.label}
                    </span>
                    <span style={{
                      width: 30, height: 30, borderRadius: 8, background: c.iconBg,
                      display: "flex", alignItems: "center", justifyContent: "center", color: c.color,
                    }}>
                      {c.icon}
                    </span>
                  </div>
                  <p style={{ fontSize: isMobile ? 14 : 18, fontWeight: 800, color: c.color, lineHeight: 1.1 }}>
                    {c.unit === "$" ? `${c.value} $` : `${c.value}`}
                  </p>
                  {c.unit !== "$" && (
                    <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 3 }}>so'm</p>
                  )}
                </div>
              ))}
            </div>

            {/* Som hisoblar */}
            {somGaznalar.length > 0 && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <svg width="14" height="14" fill="none" stroke="var(--primary)" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
                  </svg>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)", letterSpacing: ".05em" }}>
                    SO'M HISOBLAR
                  </span>
                </div>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: 16, marginBottom: 28,
                }}>
                  {somStats.map(({ g, s }) => (
                    <GaznaCard key={g.Gazna_ID} gazna={g} stats={s} isDollar={false}
                      onPress={() => router.push(`/gazna/${g.Gazna_ID}`)}
                      onEdit={() => openEdit(g)} onDelete={() => handleDelete(g)}
                      deleting={deleting === g.Gazna_ID}/>
                  ))}
                </div>
              </>
            )}

            {/* Dollar hisoblar */}
            {dollarGaznalar.length > 0 && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <svg width="14" height="14" fill="none" stroke="#d97706" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)", letterSpacing: ".05em" }}>
                    DOLLAR HISOBLAR
                  </span>
                </div>

                {/* Dollar kartalar */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)",
                  gap: isMobile ? 10 : 14, marginBottom: isMobile ? 20 : 28,
                }}>
                  {[
                    { label: "JAMI DOLLAR (JORIY)", value: `${fmt(jamiDollar)} $`,       color: "#16a34a", iconBg: "#dcfce7",
                      icon: <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg> },
                    { label: "DAVR KIRDI ($)",       value: `${fmt(davrKirdiDollar)} $`,  color: "#16a34a", iconBg: "#dcfce7",
                      icon: <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg> },
                    { label: "DAVR CHIQDI ($)",      value: `${fmt(davrChiqdiDollar)} $`, color: "#ef4444", iconBg: "#fee2e2",
                      icon: <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 17H5m0 0V9m0 8l8-8 4 4 6-6"/></svg> },
                  ].map((c, i) => (
                    <div key={i} style={{
                      background: "var(--white)", borderRadius: "var(--radius-xl)",
                      boxShadow: "var(--shadow-sm)", padding: isMobile ? "14px" : "18px 20px",
                      border: "1px solid var(--border)",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".06em" }}>{c.label}</span>
                        <span style={{ width: 30, height: 30, borderRadius: 8, background: c.iconBg, display: "flex", alignItems: "center", justifyContent: "center", color: c.color }}>
                          {c.icon}
                        </span>
                      </div>
                      <p style={{ fontSize: isMobile ? 14 : 18, fontWeight: 800, color: c.color, lineHeight: 1.1 }}>{c.value}</p>
                    </div>
                  ))}
                </div>

                <div style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: 16,
                }}>
                  {dollarStats.map(({ g, s }) => (
                    <GaznaCard key={g.Gazna_ID} gazna={g} stats={s} isDollar
                      onPress={() => router.push(`/gazna/${g.Gazna_ID}`)}
                      onEdit={() => openEdit(g)} onDelete={() => handleDelete(g)}
                      deleting={deleting === g.Gazna_ID}/>
                  ))}
                </div>
              </>
            )}

            {gaznalar.length === 0 && (
              <div className="empty">
                <p className="empty__title">Hisob topilmadi</p>
                <button className="btn btn--primary" onClick={openCreate}>+ Hisob qo'shish</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Drawer */}
      {showForm && (
        <div className="drawer-overlay" onClick={closeForm}>
          <div className="drawer" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="drawer__head">
              <h2 className="drawer__title">{editItem ? "Hisobni tahrirlash" : "Yangi hisob"}</h2>
              <button className="drawer__back" onClick={closeForm}>
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="drawer__body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              <div className="field">
                <label className="field__label">Hisob nomi *</label>
                <input className="field__input" placeholder="Masalan: Asosiy kassa"
                  value={form.Nomi} onChange={e => setForm(f => ({ ...f, Nomi: e.target.value }))}/>
              </div>

              <div className="field">
                <label className="field__label">Valyuta turi</label>
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
                <label className="field__label">Shakli</label>
                <select className="field__input" value={form.Shakli}
                  onChange={e => setForm(f => ({ ...f, Shakli: e.target.value }))}>
                  {["Barchasi","Naqd","Bank","Karta"].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label className="field__label">Boshlang'ich balans</label>
                <input className="field__input" type="number" placeholder="0"
                  value={form.Boshlangich_balans}
                  onChange={e => setForm(f => ({ ...f, Boshlangich_balans: e.target.value }))}/>
              </div>

              <div className="field">
                <label className="field__label">Boshlanish sanasi</label>
                <input className="field__input" type="date" value={form.Boshlanish_Sana}
                  onChange={e => setForm(f => ({ ...f, Boshlanish_Sana: e.target.value }))}/>
              </div>
            </div>
            <div className="drawer__footer">
              <button className="btn btn--outline" onClick={closeForm} disabled={saving}>Bekor</button>
              <button className="btn btn--primary" onClick={handleSave} disabled={saving || !form.Nomi.trim()}>
                {saving ? "Saqlanmoqda..." : editItem ? "Saqlash" : "Qo'shish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Gazna Card ─────────────────────────────────────────── */
function GaznaCard({ gazna: g, stats: s, isDollar, onPress, onEdit, onDelete, deleting }: {
  gazna: Gazna;
  stats: { allKirdi: number; allChiqdi: number; joriy: number; davrKirdi: number; davrChiqdi: number };
  isDollar: boolean;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const isActive = g.Status === "Faol";
  const sof      = s.allKirdi - s.allChiqdi;

  const fmtVal = (v: number) =>
    isDollar
      ? "$ " + Math.abs(v).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : Math.abs(v).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " so'm";

  return (
    <div onClick={onPress} style={{
      background: "var(--white)", borderRadius: "var(--radius-xl)",
      boxShadow: "var(--shadow-sm)", border: "1px solid var(--border)",
      borderLeft: `4px solid ${isActive ? "var(--primary)" : "var(--border)"}`,
      padding: "18px 20px", position: "relative", cursor: "pointer",
    }}>
      {/* Head */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 800, color: "var(--text)", marginBottom: 6 }}>{g.Nomi}</p>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
              background: "var(--bg)", color: "var(--text-3)", border: "1px solid var(--border)",
            }}>
              {g.Shakli}
            </span>
            {isDollar && (
              <span style={{
                fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
                background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a",
              }}>
                Dollar
              </span>
            )}
          </div>
        </div>
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: isDollar ? "#fef3c7" : "#dcfce7",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: isDollar ? "#d97706" : "var(--primary)",
        }}>
          {isDollar ? (
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          ) : (
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
            </svg>
          )}
        </div>
      </div>

      {/* Balance */}
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600, marginBottom: 4 }}>Joriy balans</p>
        <p style={{
          fontSize: 20, fontWeight: 800,
          color: isDollar ? "#d97706" : "var(--primary)",
          lineHeight: 1.1,
        }}>
          {fmtVal(s.joriy)}
        </p>
      </div>

      {/* Kirdi / Chiqdi / Sof */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
        gap: 6, padding: "12px 0",
        borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)",
        marginBottom: 14,
      }}>
        <div>
          <p style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 600, marginBottom: 3 }}>Kirdi</p>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#16a34a" }}>
            +{s.allKirdi.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}
          </p>
        </div>
        <div>
          <p style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 600, marginBottom: 3 }}>Chiqdi</p>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#ef4444" }}>
            -{s.allChiqdi.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}
          </p>
        </div>
        <div>
          <p style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 600, marginBottom: 3 }}>Sof</p>
          <p style={{ fontSize: 11, fontWeight: 700, color: sof >= 0 ? "var(--primary)" : "#ef4444" }}>
            {sof >= 0 ? "+" : ""}{sof.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button onClick={e => { e.stopPropagation(); onEdit(); }} title="Tahrirlash" style={{
          width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
          border: "1px solid var(--border)", borderRadius: "var(--radius)",
          background: "var(--white)", cursor: "pointer", color: "var(--text-3)",
        }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
        </button>
        <button onClick={e => { e.stopPropagation(); onDelete(); }} disabled={deleting} title="O'chirish" style={{
          width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
          border: "1px solid #fecaca", borderRadius: "var(--radius)",
          background: "var(--white)", cursor: "pointer", color: "#ef4444",
          opacity: deleting ? .5 : 1,
        }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
