"use client";

import { fetchSheet, afterWrite } from "@/lib/sheet-cache";
import { useAuth } from "@/lib/AuthContext";
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
const TURLAR = ["Naqd","Bank","Karta"];

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
  Xarajat_ID: "", Yil: "", Oy: "", Sana: "", Kategoriya: "Maosh", Agent: "",
  Nomi: "", Soni: "", Som: "", Dollar_kursi: "", Dollar: "", Summa: "",
  Turi: "Naqd", Gazna_ID: "", Gazna_dollar_ID: "", Izoh: "", Qoshdi: "", Qoshilgan_Vaqt: "",
  valyuta: "Som" as "Som" | "Dollar",
};

export default function XarajatPage() {
  const { user } = useAuth();
  const isSotuvchi = user?.lavozim === "Sotuvchi";

  const [xarajatlar, setXarajatlar] = useState<Xarajat[]>([]);
  const [gaznalar, setGaznalar]     = useState<Gazna[]>([]);
  const [agentMap, setAgentMap]     = useState<Record<string, string>>({});
  const [loading, setLoading]       = useState(true);
  const [filterOy, setFilterOy]     = useState("0");
  const [filterYil, setFilterYil]   = useState("");
  const [search, setSearch]         = useState("");

  const [open, setOpen]       = useState(false);
  const [editItem, setEditItem] = useState<Xarajat | null>(null);
  const [form, setForm]       = useState({ ...EMPTY });
  const [saving, setSaving]   = useState(false);
  const [delTarget, setDelTarget] = useState<Xarajat | null>(null);
  const [deleting, setDeleting]   = useState(false);

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
      const am: Record<string, string> = {};
      ((fR.data as Foydalanuvchi[]) || []).forEach(f => { am[f.Foydalanuvchi_ID] = f.Nomi; });
      setAgentMap(am);
      const yillar = [...new Set(list.map(x => x.Yil).filter(Boolean))].sort((a,b) => Number(b)-Number(a));
      setFilterYil(prev => prev || yillar[0] || nowStr().yil);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  function openAdd() {
    const now = nowStr();
    setEditItem(null);
    setForm({ ...EMPTY, Xarajat_ID: uid(), Sana: now.sana, Yil: now.yil, Oy: now.oy });
    setOpen(true);
  }
  function openEdit(x: Xarajat) {
    setEditItem(x);
    setForm({ ...EMPTY, ...x, valyuta: num(x.Dollar) > 0 ? "Dollar" : "Som" });
    setOpen(true);
  }

  async function handleSave() {
    const summaVal = num(form.Som) || num(form.Dollar);
    if (!summaVal || !form.Kategoriya) return;
    setSaving(true);
    try {
      const [, m, y] = (form.Sana || "01.01.2026").split(".");
      const now = nowStr();
      const isDollar = form.valyuta === "Dollar";
      const som    = isDollar ? "" : String(num(form.Som));
      const dollar = isDollar ? String(num(form.Dollar)) : "";
      const summa  = isDollar ? String(num(form.Dollar)) : String(num(form.Som));
      const row = {
        Xarajat_ID: form.Xarajat_ID, Yil: y, Oy: String(Number(m)), Sana: form.Sana,
        Kategoriya: form.Kategoriya,
        Agent: editItem ? (form.Agent || user?.id || "") : (user?.id || ""),
        Nomi: form.Nomi, Soni: form.Soni || "1",
        Som: som, Dollar_kursi: form.Dollar_kursi, Dollar: dollar, Summa: summa,
        Turi: form.Turi,
        Gazna_ID: isDollar ? "" : form.Gazna_ID,
        Gazna_dollar_ID: isDollar ? form.Gazna_ID : "",
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
  const gaznaNomi = (x: Xarajat) => gaznalar.find(g => g.Gazna_ID === (x.Gazna_ID || x.Gazna_dollar_ID))?.Nomi || "—";

  return (
    <>
      <header className="header">
        <div className="header__inner">
          <h1 className="header__title">Xarajatlar</h1>
          <div className="search" style={{ maxWidth: 280 }}>
            <span className="search__icon"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg></span>
            <input className="search__input" placeholder="Qidirish..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select value={filterYil} onChange={e => setFilterYil(e.target.value)} style={{ padding: "7px 10px", borderRadius: 8, fontSize: 13, border: "1px solid var(--border-2)", background: "var(--white)", color: "var(--text)", width: "auto" }}>
            {yillar.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <div className="header__spacer" />
          <button className="btn btn--primary" onClick={openAdd}>
            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Xarajat qo&apos;shish
          </button>
        </div>
      </header>

      {/* Oy filter */}
      <div style={{ background: "var(--bg-2)", borderBottom: "1px solid var(--border)", padding: "10px 24px" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", maxWidth: 1360, margin: "0 auto" }}>
          {[{ v: "0", l: "Barchasi" }, ...OY_NOMLARI.map((o, i) => ({ v: String(i+1), l: o.slice(0,3) }))].map(item => (
            <button key={item.v} onClick={() => setFilterOy(item.v)} style={{
              padding: "4px 12px", borderRadius: 20, border: "1.5px solid",
              fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "all .12s",
              background: filterOy === item.v ? "var(--primary)" : "transparent",
              color: filterOy === item.v ? "#fff" : "var(--text-3)",
              borderColor: filterOy === item.v ? "var(--primary)" : "var(--border)",
            }}>{item.l}</button>
          ))}
        </div>
      </div>

      <div className="page-content">
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, marginBottom: 20 }}>
          {[
            { label: "JAMI XARAJAT (SO'M)", value: fmtSom(jamiSom), color: "#f85149" },
            { label: "JAMI XARAJAT ($)",   value: fmtUsd(jamiUsd), color: "#2f81f7" },
            { label: "XARAJATLAR SONI",    value: `${filtered.length} ta`, color: "var(--text)" },
          ].map(c => (
            <div key={c.label} style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", padding: "16px 20px", boxShadow: "var(--shadow-sm)" }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".06em", marginBottom: 8 }}>{c.label}</p>
              <p style={{ fontSize: 18, fontWeight: 800, color: c.color }}>{c.value}</p>
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

      {/* Drawer */}
      {open && (
        <div className="drawer-overlay" onClick={() => setOpen(false)}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer__head">
              <button className="drawer__back" onClick={() => setOpen(false)}>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
              <span className="drawer__title">{editItem ? "Xarajatni tahrirlash" : "Yangi xarajat"}</span>
            </div>
            <div className="drawer__body">
              <div className="field">
                <label>Sana *</label>
                <input type="text" placeholder="DD.MM.YYYY" value={form.Sana} onChange={e => setForm(f => ({ ...f, Sana: e.target.value }))} />
              </div>
              <div className="field">
                <label>Kategoriya *</label>
                <select value={form.Kategoriya} onChange={e => setForm(f => ({ ...f, Kategoriya: e.target.value }))}>
                  {KATEGORIYALAR.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Nomi / Tavsif</label>
                <input value={form.Nomi} onChange={e => setForm(f => ({ ...f, Nomi: e.target.value }))} placeholder="Masalan: Gaz to'lovi" />
              </div>
              <div className="field">
                <label>Valyuta</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["Som","Dollar"] as const).map(v => (
                    <button key={v} type="button" onClick={() => setForm(f => ({ ...f, valyuta: v, Gazna_ID: "" }))} style={{
                      flex: 1, padding: "9px 0", borderRadius: "var(--radius)", fontSize: 13, fontWeight: 700, cursor: "pointer",
                      border: `1.5px solid ${form.valyuta === v ? "var(--primary)" : "var(--border-2)"}`,
                      background: form.valyuta === v ? "var(--primary-glow)" : "var(--bg-2)",
                      color: form.valyuta === v ? "var(--primary)" : "var(--text-2)",
                    }}>{v === "Som" ? "So'm" : "Dollar"}</button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>Summa *</label>
                {form.valyuta === "Som"
                  ? <input type="number" value={form.Som} onChange={e => setForm(f => ({ ...f, Som: e.target.value }))} placeholder="0" />
                  : <input type="number" value={form.Dollar} onChange={e => setForm(f => ({ ...f, Dollar: e.target.value }))} placeholder="0" />
                }
              </div>
              <div className="field">
                <label>To&apos;lov turi</label>
                <select value={form.Turi} onChange={e => setForm(f => ({ ...f, Turi: e.target.value }))}>
                  {TURLAR.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Gazna</label>
                <select value={form.Gazna_ID} onChange={e => setForm(f => ({ ...f, Gazna_ID: e.target.value }))}>
                  <option value="">Tanlang</option>
                  {gaznalar.filter(g => form.valyuta === "Dollar" ? g.Turi === "Dollar" : g.Turi !== "Dollar").map(g => (
                    <option key={g.Gazna_ID} value={g.Gazna_ID}>{g.Nomi}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Izoh</label>
                <input value={form.Izoh} onChange={e => setForm(f => ({ ...f, Izoh: e.target.value }))} placeholder="Ixtiyoriy" />
              </div>
            </div>
            <div className="drawer__footer">
              <button className="btn btn--outline" onClick={() => setOpen(false)} disabled={saving}>Bekor</button>
              <button className="btn btn--primary" onClick={handleSave} disabled={saving || !(num(form.Som) || num(form.Dollar))}>
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
