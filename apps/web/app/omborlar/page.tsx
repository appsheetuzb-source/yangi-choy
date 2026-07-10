"use client";
import { fetchSheet, afterWrite } from "@/lib/sheet-cache";
import { computeInvByOmbor, shopWarehouseSet, type FoydalanuvchiLike } from "@/lib/ombor-transfer";
import { useEffect, useState, useCallback, useMemo } from "react";

interface Ombor { Ombor_ID: string; Nomi: string; Masul: string; Status: string; }
interface Foydalanuvchi { Foydalanuvchi_ID: string; Nomi: string; }
interface OmborStat { dona: number; som: number; dollar: number; }

const STATUSLAR = ["Faol", "Nofaol"];
const EMPTY: Ombor = { Ombor_ID: "", Nomi: "", Masul: "", Status: "Faol" };

function uid() { return Math.random().toString(36).slice(2, 10); }
function num(v: unknown) { return parseFloat(String(v ?? "0").replace(/\s/g, "").replace(",", ".")) || 0; }
function fmt0(v: number) { return v.toLocaleString("ru-RU", { maximumFractionDigits: 0 }); }
function fmt2(v: number) { return v.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

// "id , id , id" formatidagi Masul'ni massivga
function parseIds(raw: string): string[] {
  return (raw || "").split(",").map(s => s.trim()).filter(Boolean);
}

export default function OmborlarPage() {
  const [omborlar, setOmborlar] = useState<Ombor[]>([]);
  const [users, setUsers] = useState<Foydalanuvchi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Ombor | null>(null);
  const [form, setForm] = useState<Ombor>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Ombor | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [omborStats, setOmborStats] = useState<Record<string, OmborStat>>({});

  useEffect(() => { const c = () => setIsMobile(window.innerWidth < 768); c(); window.addEventListener("resize", c); return () => window.removeEventListener("resize", c); }, []);

  const loadData = useCallback((delay = 0) => {
    setLoading(true);
    setTimeout(() => {
      Promise.all([
        fetchSheet("Ombor"),
        fetchSheet("Foydalanuvchi").catch(() => ({ data: [], error: undefined } as { data: unknown[]; error?: string })),
      ]).then(([oR, fR]) => {
        if ((oR as { error?: string }).error) throw new Error((oR as { error: string }).error);
        setOmborlar((oR.data as Ombor[]).filter(o => o.Ombor_ID));
        setUsers((fR.data as Foydalanuvchi[]).filter(f => f.Foydalanuvchi_ID));
      }).catch(e => setError(e instanceof Error ? e.message : "Xatolik"))
        .finally(() => setLoading(false));
    }, delay);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Inventar (per-ombor qoldiq) — alohida yuklanadi, ombor ro'yxati tez chiqadi
  useEffect(() => {
    Promise.all([
      fetchSheet("Sotuv_Savat").catch(() => ({ data: [] })),
      fetchSheet("Sotuv_Savat_Dollar").catch(() => ({ data: [] })),
      fetchSheet("Xarid_Savat").catch(() => ({ data: [] })),
      fetchSheet("Mahsulot").catch(() => ({ data: [] })),
      fetchSheet("Foydalanuvchi").catch(() => ({ data: [] })),
    ]).then(([ssR, ssdR, xsR, mR, fR]) => {
      const shopWH = shopWarehouseSet((fR.data as FoydalanuvchiLike[]) || []);
      const { inv } = computeInvByOmbor(
        xsR.data as Record<string, string>[],
        ssR.data as Record<string, string>[],
        ssdR.data as Record<string, string>[],
        shopWH,
      );
      const price: Record<string, { som: number; dollar: number }> = {};
      (mR.data as Record<string, string>[]).forEach(m => { if (m.Mahsulot_ID) price[m.Mahsulot_ID] = { som: num(m.Sotuv_som), dollar: num(m.Sotuv_dollar) }; });
      const stats: Record<string, OmborStat> = {};
      for (const o of Object.keys(inv)) {
        let dona = 0, som = 0, dollar = 0;
        for (const mid of Object.keys(inv[o])) {
          const q = inv[o][mid]; const p = price[mid] || { som: 0, dollar: 0 };
          dona += q; som += q * p.som; dollar += q * p.dollar;
        }
        stats[o] = { dona, som, dollar };
      }
      setOmborStats(stats);
    }).catch(() => {});
  }, []);

  const userName = useCallback((id: string) => users.find(u => u.Foydalanuvchi_ID === id)?.Nomi || id, [users]);

  const filtered = useMemo(() => omborlar.filter(o =>
    String(o.Nomi || "").toLowerCase().includes(search.toLowerCase())
  ), [omborlar, search]);

  function openAdd() { setEditTarget(null); setForm({ ...EMPTY, Ombor_ID: uid() }); setDrawerOpen(true); }
  function openEdit(o: Ombor) { setEditTarget(o); setForm({ ...EMPTY, ...o }); setDrawerOpen(true); }

  async function handleSave() {
    if (!form.Nomi.trim()) return;
    setSaving(true);
    try {
      let res: Response;
      if (editTarget) {
        res = await fetch("/api/sheets", { method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sheet: "Ombor", idColumn: "Ombor_ID", idValue: editTarget.Ombor_ID, row: form }) });
      } else {
        res = await fetch("/api/sheets", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sheet: "Ombor", row: form }) });
      }
      if (!res.ok) { alert("Ombor saqlanmadi — qayta urinib ko'ring"); return; }
      setDrawerOpen(false); afterWrite("Ombor"); loadData(600);
    } catch { alert("Ombor saqlanmadi — tarmoq xatosi"); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/sheets", { method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet: "Ombor", idColumn: "Ombor_ID", idValue: deleteTarget.Ombor_ID }) });
      if (!res.ok) { alert("O'chirilmadi"); return; }
      afterWrite("Ombor"); setDeleteTarget(null); loadData(600);
    } finally { setDeleting(false); }
  }

  function toggleMasul(id: string) {
    setForm(p => {
      const cur = parseIds(p.Masul);
      const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id];
      return { ...p, Masul: next.join(", ") };
    });
  }

  return (
    <>
      <header className="header">
        <div className="header__inner">
          <h1 className="header__title" style={{ paddingLeft: 4 }}>Omborlar</h1>
          {!isMobile && (
            <div className="search" style={{ maxWidth: 280 }}>
              <span className="search__icon">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              </span>
              <input className="search__input" placeholder="Ombor qidirish..." value={search} onChange={e => setSearch(e.target.value)}/>
              {search && <button className="search__clear" onClick={() => setSearch("")}><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>}
            </div>
          )}
          <div className="header__spacer"/>
          <button className="btn btn--primary" onClick={openAdd} style={{ gap: 6 }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Ombor
          </button>
        </div>
      </header>

      <div className="page-content">
        {loading && <div className="spinner--page"/>}
        {error && <div className="error-box"><p>{error}</p></div>}

        {!loading && !error && (
          <>
            {isMobile && (
              <div className="search" style={{ marginBottom: 14 }}>
                <span className="search__icon"><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg></span>
                <input className="search__input" placeholder="Ombor qidirish..." value={search} onChange={e => setSearch(e.target.value)}/>
              </div>
            )}

            <p className="count-label" style={{ marginBottom: 14 }}>{filtered.length} ta ombor</p>

            {filtered.length === 0 ? (
              <div className="empty"><div className="empty__icon">🏬</div><p className="empty__title">Ombor topilmadi</p></div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                {filtered.map(o => {
                  const masullar = parseIds(o.Masul);
                  const faol = String(o.Status || "").toLowerCase() !== "nofaol";
                  return (
                    <div key={o.Ombor_ID} style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border)", padding: "16px 18px" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>{o.Nomi || "—"}</p>
                          <span style={{ fontSize: 11, fontWeight: 700, color: faol ? "#16a34a" : "var(--text-3)", background: faol ? "#dcfce7" : "var(--bg)", padding: "2px 8px", borderRadius: 20, display: "inline-block", marginTop: 4 }}>
                            {faol ? "Faol" : "Nofaol"}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button className="icon-btn icon-btn--blue" onClick={() => openEdit(o)}>
                            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                          </button>
                          <button className="icon-btn icon-btn--red" onClick={() => setDeleteTarget(o)}>
                            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          </button>
                        </div>
                      </div>
                      {(() => {
                        const st = omborStats[o.Ombor_ID];
                        return (
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12, padding: "10px 12px", background: "var(--bg)", borderRadius: 10, border: "1px solid var(--border)" }}>
                            <div><p style={{ fontSize: 9, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".04em", marginBottom: 2 }}>QOLDIQ</p><p style={{ fontSize: 14, fontWeight: 800, color: "var(--primary)" }}>{st ? fmt0(st.dona) : "…"}<span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-3)" }}> dona</span></p></div>
                            <div><p style={{ fontSize: 9, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".04em", marginBottom: 2 }}>SO&apos;M</p><p style={{ fontSize: 13, fontWeight: 700, color: "#16a34a" }}>{st ? fmt0(st.som) : "…"}</p></div>
                            <div><p style={{ fontSize: 9, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".04em", marginBottom: 2 }}>DOLLAR</p><p style={{ fontSize: 13, fontWeight: 700, color: "#2563eb" }}>{st ? "$" + fmt2(st.dollar) : "…"}</p></div>
                          </div>
                        );
                      })()}
                      <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".04em", marginBottom: 6 }}>MAS&apos;ULLAR</p>
                      {masullar.length === 0 ? (
                        <p style={{ fontSize: 13, color: "var(--text-3)" }}>—</p>
                      ) : (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {masullar.map(id => (
                            <span key={id} style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", background: "var(--bg)", border: "1px solid var(--border)", padding: "3px 9px", borderRadius: 8 }}>{userName(id)}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Add/Edit drawer */}
      {drawerOpen && (
        <>
          <div className="drawer-overlay" onClick={() => setDrawerOpen(false)}/>
          <div className="drawer">
            <div className="drawer__head">
              <button className="drawer__back" onClick={() => setDrawerOpen(false)}>
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
              <span className="drawer__title">{editTarget ? "Omborni tahrirlash" : "Yangi ombor"}</span>
            </div>
            <div className="drawer__body">
              <div className="drawer__section">
                <p className="drawer__section-label">Nomi *</p>
                <input value={form.Nomi} onChange={e => setForm(p => ({ ...p, Nomi: e.target.value }))} placeholder="Ombor nomi" autoFocus
                  style={{ width: "100%", padding: "10px 14px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 14, outline: "none", background: "var(--bg)", boxSizing: "border-box" }}/>
              </div>

              <div className="drawer__section">
                <p className="drawer__section-label">Mas&apos;ullar (bir nechta tanlash mumkin)</p>
                {users.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--text-3)" }}>Foydalanuvchi yo&apos;q</p>
                ) : (
                  <div className="pill-group" style={{ flexWrap: "wrap" }}>
                    {users.map(u => {
                      const active = parseIds(form.Masul).includes(u.Foydalanuvchi_ID);
                      return (
                        <button key={u.Foydalanuvchi_ID} type="button" className={`pill ${active ? "pill--active" : ""}`} onClick={() => toggleMasul(u.Foydalanuvchi_ID)}>
                          {u.Nomi}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="drawer__section">
                <p className="drawer__section-label">Status</p>
                <div className="pill-group">
                  {STATUSLAR.map(s => (
                    <button key={s} type="button" className={`pill ${form.Status === s ? "pill--active" : ""}`} onClick={() => setForm(p => ({ ...p, Status: s }))}>{s}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="drawer__footer">
              <button className="btn btn--outline" style={{ flex: 1 }} onClick={() => setDrawerOpen(false)}>Bekor qilish</button>
              <button className="btn btn--primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving || !form.Nomi.trim()}>
                {saving && <span className="spinner"/>}{editTarget ? "Saqlash" : "Qo'shish"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="confirm" onClick={e => e.stopPropagation()}>
            <div className="confirm__icon">
              <svg width="24" height="24" fill="none" stroke="#ef4444" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </div>
            <p className="confirm__title">Ombor o&apos;chirilsinmi?</p>
            <p className="confirm__text">{deleteTarget.Nomi}</p>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button className="btn btn--outline" style={{ flex: 1 }} onClick={() => setDeleteTarget(null)}>Bekor</button>
              <button className="btn btn--danger" style={{ flex: 1 }} onClick={handleDelete} disabled={deleting}>{deleting && <span className="spinner"/>}O&apos;chirish</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
