"use client";
import { fetchSheet, afterWrite } from "@/lib/sheet-cache";
import { useScrollLock } from "@/lib/use-scroll-lock";
import { usePersistedState } from "@/lib/usePersistedState";
import FabAdd from "@/components/FabAdd";

import { useEffect, useState, useCallback } from "react";

interface Foydalanuvchi {
  Foydalanuvchi_ID: string;
  Nomi: string;
  Lavozim: string;
  Telefon: string;
  Pochta: string;
  Ombor_ID: string;
  Gazna_ID: string;
  Status: string;
  Parol: string;
}

interface Ombor { Ombor_ID: string; Nomi: string; }
interface Gazna { Gazna_ID: string; Nomi: string; Turi: string; }

const LAVOZIMLAR = ["Admin", "Sotuvchi", "Omborchi", "Hisobchi"];
const STATUSLAR  = ["Faol", "Nofaol"];

const EMPTY: Foydalanuvchi = {
  Foydalanuvchi_ID: "", Nomi: "", Lavozim: "", Telefon: "",
  Pochta: "", Ombor_ID: "", Gazna_ID: "", Status: "Faol", Parol: "",
};

function uid() { return Math.random().toString(36).slice(2, 10); }

const LAVOZIM_COLOR: Record<string, { bg: string; color: string }> = {
  Admin:    { bg: "#eff6ff", color: "#2563eb" },
  Sotuvchi: { bg: "#f0fdf4", color: "#16a34a" },
  Omborchi: { bg: "#fefce8", color: "#ca8a04" },
  Hisobchi: { bg: "#fdf4ff", color: "#9333ea" },
};

function LavozimBadge({ lavozim }: { lavozim: string }) {
  const c = LAVOZIM_COLOR[lavozim] || { bg: "var(--bg)", color: "var(--text-2)" };
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
      background: c.bg, color: c.color,
    }}>{lavozim || "—"}</span>
  );
}

export default function FoydalanuvchiPage() {
  const [users, setUsers]       = useState<Foydalanuvchi[]>([]);
  const [omborlar, setOmborlar] = useState<Ombor[]>([]);
  const [gaznalar, setGaznalar] = useState<Gazna[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [search, setSearch]     = usePersistedState("flt:foydalanuvchi:search", "");

  const [drawerOpen, setDrawerOpen]     = useState(false);
  const [editTarget, setEditTarget]     = useState<Foydalanuvchi | null>(null);
  const [form, setForm]                 = useState<Foydalanuvchi>(EMPTY);
  const [showParol, setShowParol]       = useState(false);
  const [saving, setSaving]             = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Foydalanuvchi | null>(null);
  const [detailTarget, setDetailTarget] = useState<Foydalanuvchi | null>(null);
  const [isMobile, setIsMobile]         = useState(false);
  useEffect(() => { const c = () => setIsMobile(window.innerWidth < 768); c(); window.addEventListener("resize", c); return () => window.removeEventListener("resize", c); }, []);
  useScrollLock(drawerOpen || !!deleteTarget || !!detailTarget);
  const [deleting, setDeleting]         = useState(false);

  const loadData = useCallback((delay = 0) => {
    setLoading(true);
    setTimeout(() => {
      Promise.all([
        fetchSheet("Foydalanuvchi"),
        fetchSheet("Ombor"),
        fetchSheet("Gazna"),
      ]).then(([uRes, oRes, gRes]) => {
        if (uRes.error) throw new Error(uRes.error);
        setUsers(uRes.data as Foydalanuvchi[]);
        if (!oRes.error) setOmborlar(oRes.data as Ombor[]);
        if (!gRes.error) setGaznalar(gRes.data as Gazna[]);
      }).catch(e => setError(e instanceof Error ? e.message : "Xatolik"))
        .finally(() => setLoading(false));
    }, delay);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = users.filter(u =>
    String(u.Nomi || "").toLowerCase().includes(search.toLowerCase()) ||
    String(u.Telefon || "").includes(search) ||
    String(u.Pochta || "").toLowerCase().includes(search.toLowerCase())
  );

  const omborNomi = (id: string) => omborlar.find(o => o.Ombor_ID === id)?.Nomi || "";
  const gaznaNomlar = (ids: string) => (ids || "").split(",").map(s => s.trim()).filter(Boolean)
    .map(id => { const g = gaznalar.find(x => x.Gazna_ID === id); return g ? g.Nomi + (g.Turi === "Dollar" ? " ($)" : "") : id; }).join(", ");

  function openAdd() {
    setEditTarget(null);
    setForm({ ...EMPTY, Foydalanuvchi_ID: uid() });
    setShowParol(false);
    setDrawerOpen(true);
  }

  function openEdit(u: Foydalanuvchi) {
    setEditTarget(u);
    setForm({ ...u });
    setShowParol(false);
    setDrawerOpen(true);
  }

  function isValid() {
    return form.Nomi.trim() !== "" && form.Lavozim !== "" && form.Parol.trim() !== "";
  }

  async function handleSave() {
    if (!isValid()) return;
    setSaving(true);
    try {
      if (editTarget) {
        await fetch("/api/sheets", { method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sheet: "Foydalanuvchi", idColumn: "Foydalanuvchi_ID", idValue: editTarget.Foydalanuvchi_ID, row: form }) });
      } else {
        await fetch("/api/sheets", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sheet: "Foydalanuvchi", row: form }) });
      }
      afterWrite("Foydalanuvchi");
      setDrawerOpen(false);
      loadData(800);
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch("/api/sheets", { method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet: "Foydalanuvchi", idColumn: "Foydalanuvchi_ID", idValue: deleteTarget.Foydalanuvchi_ID }) });
      afterWrite("Foydalanuvchi");
      setDeleteTarget(null);
      loadData(800);
    } finally { setDeleting(false); }
  }

  return (
    <>
      <header className="header">
        <div className="header__inner">
          <h1 className="header__title" style={{ paddingLeft: 4 }}>Foydalanuvchilar</h1>
          <div className="search" style={{ maxWidth: 300 }}>
            <span className="search__icon">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
            </span>
            <input className="search__input" placeholder="Ism, telefon, pochta..." value={search}
              onChange={e => setSearch(e.target.value)} />
            {search && (
              <button className="search__clear" onClick={() => setSearch("")}>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>
          <div className="header__spacer" />
          {!isMobile && (
            <button className="btn btn--primary" onClick={openAdd}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
              </svg>
              Qo&apos;shish
            </button>
          )}
        </div>
      </header>

      {isMobile && <FabAdd onClick={openAdd} />}

      <div className="page-content">
        {loading && <div className="spinner--page" />}
        {error && (
          <div className="error-box">
            <div className="error-box__icon">
              <svg width="24" height="24" fill="none" stroke="#ef4444" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
            </div>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && (
          <>
            <p className="count-label">{filtered.length} ta foydalanuvchi</p>

            {filtered.length === 0 ? (
              <div className="empty">
                <div className="empty__icon">👤</div>
                <p className="empty__title">Foydalanuvchi topilmadi</p>
                <button className="btn btn--primary" onClick={openAdd}>+ Yangi foydalanuvchi</button>
              </div>
            ) : (
              <div className="list" style={isMobile ? { display: "flex", flexDirection: "column", gap: 10 } : undefined}>
                {/* Ustun sarlavhalari — faqat desktop */}
                {!isMobile && (
                  <div className="list__head">
                    <div style={{ width: 56, flexShrink: 0 }} />
                    <div className="list__head-name"><span>Ism</span></div>
                    <div className="list__head-col"><span>Lavozim</span></div>
                    <div className="list__head-col"><span>Ombor</span></div>
                    <div className="list__head-col"><span>Status</span></div>
                    <div className="list__head-actions" />
                  </div>
                )}

                {filtered.map(u => (
                  <UserRow key={u.Foydalanuvchi_ID} user={u} isMobile={isMobile}
                    omborNomi={omborNomi(u.Ombor_ID)}
                    onView={() => setDetailTarget(u)}
                    onEdit={() => openEdit(u)}
                    onDelete={() => setDeleteTarget(u)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Drawer */}
      {drawerOpen && (
        <>
          <div className="drawer-overlay" onClick={() => setDrawerOpen(false)} />
          <div className="drawer">
            <div className="drawer__head">
              <button className="drawer__back" onClick={() => setDrawerOpen(false)}>
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
              <span className="drawer__title">
                {editTarget ? "Foydalanuvchini tahrirlash" : "Yangi foydalanuvchi"}
              </span>
            </div>

            <div className="drawer__body">
              {/* Asosiy */}
              <div className="drawer__section">
                <p className="drawer__section-label">Asosiy ma&apos;lumot</p>
                <Field label="Ism *" value={form.Nomi} placeholder="To'liq ism"
                  onChange={v => setForm(p => ({ ...p, Nomi: v }))} autoFocus />
                <Field label="Telefon" value={form.Telefon} placeholder="+998 __ ___ __ __"
                  onChange={v => setForm(p => ({ ...p, Telefon: v }))} />
                <Field label="Pochta" value={form.Pochta} placeholder="email@example.com"
                  onChange={v => setForm(p => ({ ...p, Pochta: v }))} />
              </div>

              {/* Lavozim */}
              <div className="drawer__section">
                <p className="drawer__section-label">Lavozim *</p>
                <div className="pill-group">
                  {LAVOZIMLAR.map(l => (
                    <button key={l} type="button"
                      className={`pill ${form.Lavozim === l ? "pill--active" : ""}`}
                      onClick={() => setForm(p => ({ ...p, Lavozim: l }))}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ombor */}
              {omborlar.length > 0 && (
                <div className="drawer__section">
                  <p className="drawer__section-label">Ombor</p>
                  <div className="pill-group">
                    {omborlar.map(o => (
                      <button key={o.Ombor_ID} type="button"
                        className={`pill ${form.Ombor_ID === o.Ombor_ID ? "pill--active" : ""}`}
                        onClick={() => setForm(p => ({ ...p, Ombor_ID: o.Ombor_ID }))}>
                        {o.Nomi}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Gazna — ko'p tanlovli (vergul bilan saqlanadi) */}
              {gaznalar.length > 0 && (
                <div className="drawer__section">
                  <p className="drawer__section-label">Gazna</p>
                  <div className="pill-group">
                    {gaznalar.map(g => {
                      const ids = (form.Gazna_ID || "").split(",").map(s => s.trim()).filter(Boolean);
                      const active = ids.includes(g.Gazna_ID);
                      return (
                        <button key={g.Gazna_ID} type="button"
                          className={`pill ${active ? "pill--active" : ""}`}
                          onClick={() => setForm(p => {
                            const cur = (p.Gazna_ID || "").split(",").map(s => s.trim()).filter(Boolean);
                            const next = cur.includes(g.Gazna_ID) ? cur.filter(x => x !== g.Gazna_ID) : [...cur, g.Gazna_ID];
                            return { ...p, Gazna_ID: next.join(", ") };
                          })}>
                          {g.Nomi}{g.Turi === "Dollar" ? " ($)" : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Status */}
              <div className="drawer__section">
                <p className="drawer__section-label">Status</p>
                <div className="pill-group">
                  {STATUSLAR.map(s => (
                    <button key={s} type="button"
                      className={`pill ${form.Status === s ? "pill--active" : ""}`}
                      onClick={() => setForm(p => ({ ...p, Status: s }))}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Parol */}
              <div className="drawer__section">
                <p className="drawer__section-label">Kirish paroli *</p>
                <div className="field">
                  <label>Parol</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showParol ? "text" : "password"}
                      value={form.Parol}
                      onChange={e => setForm(p => ({ ...p, Parol: e.target.value }))}
                      placeholder="Kamida 4 ta belgi"
                      style={{ paddingRight: 40 }}
                    />
                    <button type="button"
                      onClick={() => setShowParol(p => !p)}
                      style={{
                        position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                        color: "var(--text-3)", padding: 2,
                      }}>
                      {showParol ? (
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                        </svg>
                      ) : (
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="drawer__footer">
              <button className="btn btn--outline" style={{ flex: 1 }} onClick={() => setDrawerOpen(false)}>
                Bekor qilish
              </button>
              <button className="btn btn--primary" style={{ flex: 1 }} onClick={handleSave}
                disabled={saving || !isValid()}>
                {saving && <span className="spinner" />}
                {editTarget ? "Saqlash" : "Qoʻshish"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Detail drawer */}
      {detailTarget && (() => {
        const u = detailTarget;
        const initials = String(u.Nomi || "?").split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
        const isActive = u.Status === "Faol";
        const rows = [
          { label: "Pochta", value: u.Pochta },
          { label: "Telefon", value: u.Telefon },
          { label: "Ombor", value: omborNomi(u.Ombor_ID) },
          { label: "Gazna", value: gaznaNomlar(u.Gazna_ID) },
        ];
        return (
          <>
            <div className="drawer-overlay" onClick={() => setDetailTarget(null)} />
            <div className="drawer">
              <div className="drawer__head">
                <button className="drawer__back" onClick={() => setDetailTarget(null)}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
                <span className="drawer__title">Foydalanuvchi</span>
              </div>

              <div className="drawer__body">
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "8px 0 20px" }}>
                  <div style={{
                    width: 68, height: 68, borderRadius: "50%", background: "var(--primary)", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800,
                  }}>{initials}</div>
                  <p style={{ fontSize: 18, fontWeight: 800, textAlign: "center", wordBreak: "break-word" }}>{u.Nomi || "—"}</p>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
                    <LavozimBadge lavozim={u.Lavozim} />
                    <span style={{
                      fontSize: 12, fontWeight: 700, padding: "3px 12px", borderRadius: 20,
                      background: isActive ? "#f0fdf4" : "#fef2f2", color: isActive ? "#16a34a" : "#dc2626",
                    }}>{u.Status || "—"}</span>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 1, background: "var(--border)", borderRadius: 14, overflow: "hidden" }}>
                  {rows.map(r => (
                    <div key={r.label} style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: "14px 16px", background: "var(--white)" }}>
                      <span style={{ fontSize: 13, color: "var(--text-3)", fontWeight: 600, flexShrink: 0 }}>{r.label}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", textAlign: "right", wordBreak: "break-word", minWidth: 0 }}>{r.value || "—"}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="drawer__footer">
                <button className="btn btn--primary" style={{ flex: 1 }} onClick={() => { const t = detailTarget; setDetailTarget(null); if (t) openEdit(t); }}>
                  <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  Tahrirlash
                </button>
                <button className="btn btn--red" style={{ flex: 1 }} onClick={() => { const t = detailTarget; setDetailTarget(null); setDeleteTarget(t); }}>
                  <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  O&apos;chirish
                </button>
              </div>
            </div>
          </>
        );
      })()}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="confirm" onClick={e => e.stopPropagation()}>
            <div className="confirm__icon">
              <svg width="24" height="24" fill="none" stroke="#ef4444" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </div>
            <h3 className="confirm__title">O&apos;chirishni tasdiqlang</h3>
            <p className="confirm__text">
              <strong>{deleteTarget.Nomi}</strong> o&apos;chiriladi.
            </p>
            <div className="confirm__actions">
              <button className="btn btn--outline" style={{ flex: 1 }} onClick={() => setDeleteTarget(null)}>Bekor</button>
              <button className="btn btn--red" style={{ flex: 1 }} onClick={handleDelete} disabled={deleting}>
                {deleting && <span className="spinner" />}
                O&apos;chirish
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Field ─────────────────────────────── */
function Field({ label, value, onChange, placeholder, autoFocus }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; autoFocus?: boolean;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} autoFocus={autoFocus} />
    </div>
  );
}

/* ── User Row ──────────────────────────── */
function UserRow({ user: u, isMobile, omborNomi, onView, onEdit, onDelete }: {
  user: Foydalanuvchi; isMobile: boolean; omborNomi: string; onView: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const initials = String(u.Nomi || "?").split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
  const isActive = u.Status === "Faol";

  // ── Mobil — toza karta (bosilganda detail ochiladi) ──
  if (isMobile) {
    return (
      <div onClick={onView} style={{
        display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
        background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", cursor: "pointer",
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: "50%", background: "var(--primary)", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, flexShrink: 0,
        }}>{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.Nomi || "—"}</p>
          {(u.Pochta || u.Telefon) && (
            <p style={{ fontSize: 12, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>{u.Pochta || u.Telefon}</p>
          )}
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 7 }}>
            <LavozimBadge lavozim={u.Lavozim} />
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
              background: isActive ? "#f0fdf4" : "#fef2f2", color: isActive ? "#16a34a" : "#dc2626",
            }}>{u.Status || "—"}</span>
            {omborNomi && (
              <span style={{
                fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
                background: "var(--bg)", color: "var(--text-2)", maxWidth: 130,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{omborNomi}</span>
            )}
          </div>
        </div>
        <svg width="18" height="18" fill="none" stroke="var(--text-3)" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
        </svg>
      </div>
    );
  }

  // ── Desktop — jadval qatori (bosilganda detail) ──
  return (
    <div className="list-card" style={{ cursor: "pointer" }} onClick={onView}>
      {/* Avatar */}
      <div style={{
        width: 56, height: 72, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          background: "var(--primary)", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700,
        }}>{initials}</div>
      </div>

      {/* Ism + pochta */}
      <div className="list-card__name">
        <p>{u.Nomi || "—"}</p>
        <span>{u.Pochta || u.Telefon || ""}</span>
      </div>

      {/* Lavozim */}
      <div className="list-card__col">
        <LavozimBadge lavozim={u.Lavozim} />
      </div>

      {/* Ombor */}
      <div className="list-card__col">
        <p style={{ fontSize: 13, color: "var(--text-2)", whiteSpace: "nowrap" }}>
          {omborNomi || "—"}
        </p>
      </div>

      {/* Status */}
      <div className="list-card__col">
        <span style={{
          fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 20,
          background: isActive ? "#f0fdf4" : "#fef2f2",
          color: isActive ? "#16a34a" : "#dc2626",
        }}>{u.Status || "—"}</span>
      </div>

      {/* Amallar */}
      <div className="list-card__actions">
        <button className="icon-btn icon-btn--blue" onClick={e => { e.stopPropagation(); onEdit(); }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
        </button>
        <button className="icon-btn icon-btn--red" onClick={e => { e.stopPropagation(); onDelete(); }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
