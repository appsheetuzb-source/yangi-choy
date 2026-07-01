"use client";

import { fetchSheet, afterWrite } from "@/lib/sheet-cache";
import { useScrollLock } from "@/lib/use-scroll-lock";
import FabAdd from "@/components/FabAdd";
import { useAuth } from "@/lib/AuthContext";
import { gaznaForUser } from "@/lib/auth";
import { usePersistedState } from "@/lib/usePersistedState";
import { useEffect, useState, useCallback } from "react";

interface Xarajat {
  Xarajat_ID: string; Yil: string; Oy: string; Sana: string;
  Kategoriya: string; Agent: string; Nomi: string; Soni: string;
  Som: string; Dollar_kursi: string; Dollar: string; Summa: string;
  Turi: string; Gazna_ID: string; Gazna_dollar_ID: string;
  Izoh: string; Qoshdi: string; Qoshilgan_Vaqt: string;
}
interface Gazna { Gazna_ID: string; Nomi: string; Turi: string; }
interface Foydalanuvchi { Foydalanuvchi_ID: string; Nomi: string; }

const OY_NOMLARI = ["Yanvar","Fevral","Mart","Aprel","May","Iyun","Iyul","Avgust","Sentabr","Oktabr","Noyabr","Dekabr"];
const KATEGORIYALAR = ["Maosh","Ijara","Kommunal","Transport","Soliq","Ta'mirlash","Reklama","Boshqa"];

function uid() { return Math.random().toString(36).slice(2, 10); }
function num(v: string|number|undefined) {
  return parseFloat(String(v||"0").replace(/\s/g,"").replace(",",".")) || 0;
}
function fmtSom(v: number) { return v ? v.toLocaleString("ru-RU") + " so'm" : "—"; }
function fmtUsd(v: number) { return v ? "$" + v.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"; }
function nowStr() {
  const d = new Date();
  const t = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Tashkent" }));
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    sana: `${pad(t.getDate())}.${pad(t.getMonth()+1)}.${t.getFullYear()}`,
    oy: String(t.getMonth()+1), yil: String(t.getFullYear()),
    vaqt: `${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`,
  };
}

const EMPTY = {
  Xarajat_ID: "", Yil: "", Oy: "", Sana: "", Kategoriya: "", Agent: "",
  Nomi: "", Soni: "1", Som: "", Dollar_kursi: "12100", Dollar: "", Summa: "",
  Turi: "Naqd", Gazna_ID: "", Gazna_dollar_ID: "", Izoh: "", Qoshdi: "", Qoshilgan_Vaqt: "",
};

export default function XarajatPage() {
  const { user } = useAuth();
  const isSotuvchi = user?.lavozim === "Sotuvchi";
  const isAdmin = user?.lavozim === "Admin";

  const [xarajatlar, setXarajatlar] = useState<Xarajat[]>([]);
  const [gaznalar, setGaznalar]     = useState<Gazna[]>([]);
  const [agentMap, setAgentMap]     = useState<Record<string, string>>({});
  const [loading, setLoading]       = useState(true);
  const [filterOy, setFilterOy]     = usePersistedState("flt:xarajat:filterOy", nowStr().oy);
  const [filterYil, setFilterYil]   = usePersistedState("flt:xarajat:filterYil", "");
  const [search, setSearch]         = usePersistedState("flt:xarajat:search", "");

  const [open, setOpen]       = useState(false);
  const [editItem, setEditItem] = useState<Xarajat | null>(null);
  const [form, setForm]       = useState({ ...EMPTY });
  const [saving, setSaving]   = useState(false);
  const [delTarget, setDelTarget] = useState<Xarajat | null>(null);
  const [deleting, setDeleting]   = useState(false);
  const [isMobile, setIsMobile]   = useState(false);
  useEffect(() => { const c = () => setIsMobile(window.innerWidth < 768); c(); window.addEventListener("resize", c); return () => window.removeEventListener("resize", c); }, []);
  useScrollLock(open || !!delTarget);

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetchSheet("Xarajat"),
      fetchSheet("Gazna"),
      fetchSheet("Foydalanuvchi"),
    ]).then(([xR, gR, fR]) => {
      const list = (xR.data as Xarajat[]) || [];
      list.sort((a, b) => (b.Sana?.split(".").reverse().join("") || "").localeCompare(a.Sana?.split(".").reverse().join("") || ""));
      setXarajatlar(list);
      setGaznalar((gR.data as Gazna[]) || []);
      const fArr = (fR.data as (Foydalanuvchi & { Gazna_ID?: string })[]) || [];
      const am: Record<string, string> = {};
      fArr.forEach(f => { am[f.Foydalanuvchi_ID] = f.Nomi; });
      setAgentMap(am);
      const yillar = [...new Set(list.map(x => x.Yil).filter(Boolean))].sort((a,b) => Number(b)-Number(a));
      setFilterYil(prev => prev || yillar[0] || nowStr().yil);
    }).finally(() => setLoading(false));
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  function openAdd() {
    const now = nowStr();
    setEditItem(null);
    setForm({ ...EMPTY, Xarajat_ID: uid(), Sana: now.sana, Yil: now.yil, Oy: now.oy });
    setOpen(true);
  }
  function openEdit(x: Xarajat) {
    setEditItem(x);
    setForm({ ...EMPTY, ...x });
    setOpen(true);
  }

  async function handleSave() {
    const som = num(form.Som), dollar = num(form.Dollar);
    if ((!som && !dollar) || !form.Nomi.trim()) return;
    if (som > 0 && !form.Gazna_ID) return;
    if (dollar > 0 && !form.Gazna_dollar_ID) return;
    setSaving(true);
    try {
      const sana = form.Sana || nowStr().sana;
      const [, m, y] = sana.split(".");
      const now = nowStr();
      const row = {
        Xarajat_ID: form.Xarajat_ID, Yil: y, Oy: String(Number(m)), Sana: sana,
        Kategoriya: form.Kategoriya,
        Agent: editItem ? (form.Agent || user?.id || "") : (user?.id || ""),
        Nomi: form.Nomi, Soni: form.Soni || "1",
        Som: som ? String(som) : "",
        Dollar_kursi: form.Dollar_kursi,
        Dollar: dollar ? String(dollar) : "",
        Summa: String(som || dollar),
        Turi: form.Turi,
        Gazna_ID: som ? form.Gazna_ID : "",
        Gazna_dollar_ID: dollar ? form.Gazna_dollar_ID : "",
        Izoh: form.Izoh,
        Qoshdi: editItem ? form.Qoshdi : (user?.nomi || ""),
        Qoshilgan_Vaqt: editItem ? form.Qoshilgan_Vaqt : `${now.sana} ${now.vaqt}`,
      };
      if (editItem) {
        await fetch("/api/sheets", { method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sheet: "Xarajat", idColumn: "Xarajat_ID", idValue: editItem.Xarajat_ID, row }) });
      } else {
        await fetch("/api/sheets", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sheet: "Xarajat", row }) });
      }
      afterWrite("Xarajat");
      setOpen(false);
      loadData();
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!delTarget) return;
    setDeleting(true);
    try {
      await fetch("/api/sheets", { method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet: "Xarajat", idColumn: "Xarajat_ID", idValue: delTarget.Xarajat_ID }) });
      afterWrite("Xarajat");
      setDelTarget(null);
      loadData();
    } finally { setDeleting(false); }
  }

  const yillar = [...new Set(xarajatlar.map(x => x.Yil).filter(Boolean))].sort((a,b) => Number(b)-Number(a));
  const filtered = xarajatlar.filter(x => {
    if (!x.Xarajat_ID) return false;
    // Sotuvchi faqat o'z xarajatlarini ko'radi
    if (isSotuvchi && user?.id && x.Agent !== user.id) return false;
    if (filterYil && x.Yil !== filterYil) return false;
    if (filterOy !== "0" && String(Number(x.Oy)) !== filterOy) return false;
    if (search && !(`${x.Kategoriya} ${x.Nomi} ${x.Izoh}`).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const jamiSom = filtered.reduce((s, x) => s + num(x.Som), 0);
  const jamiUsd = filtered.reduce((s, x) => s + num(x.Dollar), 0);
  // To'langan (gazna tanlangan) va qarz (gazna yo'q)
  const tolovSom = filtered.reduce((s, x) => s + (x.Gazna_ID ? num(x.Som) : 0), 0);
  const tolovUsd = filtered.reduce((s, x) => s + (x.Gazna_dollar_ID ? num(x.Dollar) : 0), 0);
  const qarzSom  = jamiSom - tolovSom;
  const qarzUsd  = jamiUsd - tolovUsd;
  const gaznaNomi = (x: Xarajat) => gaznalar.find(g => g.Gazna_ID === (x.Gazna_ID || x.Gazna_dollar_ID))?.Nomi || "—";

  // Ko'rinadigan gaznalar — Admin barchasini, boshqalar faqat biriktirilganini
  const visibleGaznalar = gaznaForUser(user, gaznalar);
  const somGaznalar    = visibleGaznalar.filter(g => g.Turi !== "Dollar");
  const dollarGaznalar = visibleGaznalar.filter(g => g.Turi === "Dollar");

  // Admin emas — so'm/dollar > 0 bo'lsa biriktirilgan gazna avtomatik tanlanadi (qo'lda tanlash shart emas)
  useEffect(() => {
    if (isAdmin || !open) return;
    setForm(f => {
      let nf = f;
      if (num(f.Som) > 0 && somGaznalar.length > 0 && !somGaznalar.some(g => g.Gazna_ID === f.Gazna_ID))
        nf = { ...nf, Gazna_ID: somGaznalar[0].Gazna_ID };
      if (num(f.Dollar) > 0 && dollarGaznalar.length > 0 && !dollarGaznalar.some(g => g.Gazna_ID === f.Gazna_dollar_ID))
        nf = { ...nf, Gazna_dollar_ID: dollarGaznalar[0].Gazna_ID };
      return nf;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.Som, form.Dollar, gaznalar, isAdmin, open, user]);

  return (
    <>
      <header className="header">
        <div className="header__inner">
          <h1 className="header__title">Xarajatlar</h1>
          <div className="search" style={{ maxWidth: 260 }}>
            <span className="search__icon"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg></span>
            <input className="search__input" placeholder="Qidirish..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select value={filterOy} onChange={e => setFilterOy(e.target.value)} style={{ padding: "7px 10px", borderRadius: 8, fontSize: 13, border: "1px solid var(--border-2)", background: "var(--white)", color: "var(--text)", width: "auto" }}>
            <option value="0">Barcha oylar</option>
            {OY_NOMLARI.map((o, i) => <option key={i} value={String(i+1)}>{o}</option>)}
          </select>
          <select value={filterYil} onChange={e => setFilterYil(e.target.value)} style={{ padding: "7px 10px", borderRadius: 8, fontSize: 13, border: "1px solid var(--border-2)", background: "var(--white)", color: "var(--text)", width: "auto" }}>
            {yillar.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <div className="header__spacer" />
          {!isMobile && (
            <button className="btn btn--primary" onClick={openAdd}>
              <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              Qo&apos;shish
            </button>
          )}
        </div>
      </header>

      {isMobile && <FabAdd onClick={openAdd} />}

      <div className="page-content">
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14, marginBottom: 20 }}>
          {[
            { label: "JAMI XARAJAT", value: fmtSom(jamiSom), sub: jamiUsd?fmtUsd(jamiUsd):undefined, color: "#f85149", bg:"var(--red-bg)" },
            { label: "XARAJATGA TO'LOV", value: fmtSom(tolovSom), sub: tolovUsd?fmtUsd(tolovUsd):undefined, color: "#3fb950", bg:"var(--green-bg)" },
            { label: "XARAJATDAN QARZ", value: fmtSom(qarzSom), sub: qarzUsd?fmtUsd(qarzUsd):undefined, color: qarzSom>0?"#d97706":"var(--text-3)", bg:"var(--orange-bg)" },
          ].map(c => (
            <div key={c.label} style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", padding: "16px 20px", boxShadow: "var(--shadow-sm)" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".06em" }}>{c.label}</span>
                <span style={{ width:8, height:8, borderRadius:"50%", background:c.color }}/>
              </div>
              <p style={{ fontSize: 18, fontWeight: 800, color: c.color }}>{c.value}</p>
              {c.sub && <p style={{ fontSize: 12, fontWeight: 700, color: "#58a6ff", marginTop: 4 }}>{c.sub}</p>}
            </div>
          ))}
        </div>

        {/* Table */}
        {loading ? <div className="spinner--page" /> : (
          <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
            {filtered.length === 0 ? (
              <div className="empty"><div className="empty__icon">💸</div><p className="empty__title">Xarajat topilmadi</p></div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--bg-2)" }}>
                      {["SANA","KATEGORIYA","NOMI","TURI","AGENT","SUMMA","GAZNA",""].map(h => (
                        <th key={h} style={{ padding: "10px 16px", fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".06em", textAlign: "left", borderBottom: "1px solid var(--border)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((x, i) => {
                      const isDollar = num(x.Dollar) > 0;
                      return (
                        <tr key={x.Xarajat_ID || i} style={{ borderBottom: "1px solid var(--border)" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-2)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                          <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600 }}>{x.Sana || "—"}</td>
                          <td style={{ padding: "12px 16px" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "var(--red-bg)", color: "var(--red)" }}>{x.Kategoriya || "—"}</span>
                          </td>
                          <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text-2)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.Nomi || "—"}</td>
                          <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>{x.Turi || "—"}</td>
                          <td style={{ padding: "12px 16px", fontSize: 12, color: "#7c3aed", fontWeight: 600 }}>{agentMap[x.Agent] || "—"}</td>
                          <td style={{ padding: "12px 16px", fontSize: 14, fontWeight: 800, color: isDollar ? "#58a6ff" : "var(--red)" }}>
                            {isDollar ? fmtUsd(num(x.Dollar)) : fmtSom(num(x.Som))}
                          </td>
                          <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-3)" }}>{gaznaNomi(x)}</td>
                          <td style={{ padding: "12px 16px" }}>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button className="icon-btn icon-btn--blue" onClick={() => openEdit(x)}>
                                <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                              </button>
                              <button className="icon-btn icon-btn--red" onClick={() => setDelTarget(x)}>
                                <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal (markazda) */}
      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal__head">
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:38, height:38, borderRadius:11, background:"var(--red-bg)", color:"var(--red)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z"/></svg>
                </div>
                <div>
                  <h2 className="modal__title">{editItem ? "Xarajatni tahrirlash" : "Yangi xarajat"}</h2>
                  <input value={form.Sana} onChange={e => setForm(f => ({ ...f, Sana: e.target.value }))} placeholder="13.06.2026"
                    style={{ marginTop:4, padding:"3px 8px", fontSize:12, fontWeight:700, color:"var(--text-2)", background:"var(--bg-2)", border:"1px solid var(--border)", borderRadius:8, outline:"none", width:120 }} />
                </div>
              </div>
              <button className="modal__close" onClick={() => setOpen(false)}>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="modal__body">
              <p className="drawer__section-label">📋 Asosiy ma&apos;lumotlar</p>

              <div className="grid-2">
                <div className="field">
                  <label>Kategoriya</label>
                  <select value={form.Kategoriya} onChange={e => setForm(f => ({ ...f, Kategoriya: e.target.value }))}>
                    <option value="">Tanlang...</option>
                    {KATEGORIYALAR.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Soni</label>
                  <input type="number" value={form.Soni} onChange={e => setForm(f => ({ ...f, Soni: e.target.value }))} placeholder="1" />
                </div>
              </div>

              <div className="field">
                <label>Nomi <span style={{ color:"var(--red)" }}>*</span></label>
                <input value={form.Nomi} onChange={e => setForm(f => ({ ...f, Nomi: e.target.value }))} placeholder="Xarajat nomi..." />
              </div>

              <p className="drawer__section-label" style={{ marginTop:8 }}>💵 Xarajat to&apos;lov</p>

              {/* So'm */}
              <div className="grid-2">
                <div className="field">
                  <label>So&apos;m</label>
                  <input type="number" value={form.Som} onChange={e => setForm(f => ({ ...f, Som: e.target.value }))} placeholder="0" />
                </div>
                {num(form.Som) > 0 && (
                  <div className="field">
                    <label>Hisob (so&apos;m) <span style={{ color:"var(--red)" }}>*</span></label>
                    <select value={form.Gazna_ID} onChange={e => setForm(f => ({ ...f, Gazna_ID: e.target.value }))} disabled={!isAdmin}
                      style={!form.Gazna_ID ? { borderColor: "var(--red)" } : undefined}>
                      <option value="">Tanlang</option>
                      {somGaznalar.map(g => <option key={g.Gazna_ID} value={g.Gazna_ID}>{g.Nomi}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* Dollar */}
              <div className="grid-2">
                <div className="field">
                  <label>Dollar ($)</label>
                  <input type="number" value={form.Dollar} onChange={e => setForm(f => ({ ...f, Dollar: e.target.value }))} placeholder="0" />
                </div>
                {num(form.Dollar) > 0 && (
                  <div className="field">
                    <label>Hisob (dollar) <span style={{ color:"var(--red)" }}>*</span></label>
                    <select value={form.Gazna_dollar_ID} onChange={e => setForm(f => ({ ...f, Gazna_dollar_ID: e.target.value }))} disabled={!isAdmin}
                      style={!form.Gazna_dollar_ID ? { borderColor: "var(--red)" } : undefined}>
                      <option value="">Tanlang</option>
                      {dollarGaznalar.map(g => <option key={g.Gazna_ID} value={g.Gazna_ID}>{g.Nomi}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {num(form.Dollar) > 0 && (
                <div className="field">
                  <label>Dollar kursi</label>
                  <input type="number" value={form.Dollar_kursi} onChange={e => setForm(f => ({ ...f, Dollar_kursi: e.target.value }))} placeholder="12100" />
                </div>
              )}

              <div className="field">
                <label>Izoh</label>
                <input value={form.Izoh} onChange={e => setForm(f => ({ ...f, Izoh: e.target.value }))} placeholder="Qo'shimcha izoh..." />
              </div>
            </div>
            <div className="modal__footer">
              <button className="btn btn--outline" style={{ flex:1 }} onClick={() => setOpen(false)} disabled={saving}>Bekor</button>
              <button className="btn btn--primary" style={{ flex:1 }} onClick={handleSave} disabled={saving || !(num(form.Som) || num(form.Dollar)) || !form.Nomi.trim() || (num(form.Som) > 0 && !form.Gazna_ID) || (num(form.Dollar) > 0 && !form.Gazna_dollar_ID)}>
                {saving ? "Saqlanmoqda..." : "Saqlash"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {delTarget && (
        <div className="modal-overlay" onClick={() => setDelTarget(null)}>
          <div className="confirm" onClick={e => e.stopPropagation()}>
            <div className="confirm__icon">
              <svg width="22" height="22" fill="none" stroke="var(--red)" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </div>
            <p className="confirm__title">Xarajatni o&apos;chirish</p>
            <p className="confirm__text"><strong>{delTarget.Kategoriya}</strong> — {num(delTarget.Dollar) > 0 ? fmtUsd(num(delTarget.Dollar)) : fmtSom(num(delTarget.Som))}</p>
            <div className="confirm__actions">
              <button className="btn btn--outline" style={{ flex: 1 }} onClick={() => setDelTarget(null)} disabled={deleting}>Bekor</button>
              <button className="btn btn--red" style={{ flex: 1 }} onClick={handleDelete} disabled={deleting}>{deleting ? "O'chirilmoqda..." : "O'chirish"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
