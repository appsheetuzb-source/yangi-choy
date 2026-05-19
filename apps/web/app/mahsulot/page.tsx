"use client";

import { useEffect, useState, useCallback } from "react";

interface Mahsulot {
  Mahsulot_ID: string;
  Ombor_ID: string;
  Nomi: string;
  Rasm: string;
  Tan_som: string;
  Sotuv_som: string;
  Tan_dollar: string;
  Sotuv_dollar: string;
  Qoshilgan_sana: string;
  Kg: string;
  Check: string;
}

type ViewType = "grid" | "list";
type CurrencyType = "som" | "dollar";

const EMPTY: Mahsulot = {
  Mahsulot_ID: "", Ombor_ID: "", Nomi: "", Rasm: "",
  Tan_som: "", Sotuv_som: "", Tan_dollar: "", Sotuv_dollar: "",
  Qoshilgan_sana: "", Kg: "", Check: "TRUE",
};

function uid() { return Math.random().toString(36).slice(2, 10); }

export default function MahsulotPage() {
  const [mahsulotlar, setMahsulotlar] = useState<Mahsulot[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [search, setSearch]     = useState("");
  const [view, setView]         = useState<ViewType>("list");
  const [currency, setCurrency] = useState<CurrencyType>("som");

  const [modalOpen, setModalOpen]     = useState(false);
  const [editTarget, setEditTarget]   = useState<Mahsulot | null>(null);
  const [formData, setFormData]       = useState<Mahsulot>(EMPTY);
  const [formSom, setFormSom]         = useState(true);
  const [formDollar, setFormDollar]   = useState(false);
  const [saving, setSaving]           = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Mahsulot | null>(null);
  const [deleting, setDeleting]       = useState(false);

  const loadData = useCallback(() => {
    setLoading(true);
    fetch("/api/sheets?range=Mahsulot")
      .then(r => r.json())
      .then(json => {
        if (json.error) throw new Error(json.error);
        setMahsulotlar(json.data as Mahsulot[]);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = mahsulotlar.filter(m =>
    m.Nomi.toLowerCase().includes(search.toLowerCase())
  );

  function openAdd() {
    setEditTarget(null);
    setFormData({ ...EMPTY, Mahsulot_ID: uid(), Qoshilgan_sana: new Date().toLocaleDateString("ru-RU") });
    setFormSom(true);
    setFormDollar(false);
    setModalOpen(true);
  }

  function openEdit(m: Mahsulot) {
    setEditTarget(m);
    setFormData({ ...m });
    const hasSom = m.Sotuv_som && String(m.Sotuv_som).trim() !== "" && String(m.Sotuv_som).trim() !== "0";
    const hasDollar = m.Sotuv_dollar && String(m.Sotuv_dollar).trim() !== "" && String(m.Sotuv_dollar).trim() !== "0";
    setFormSom(hasSom || (!hasSom && !hasDollar));
    setFormDollar(hasDollar);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!formData.Nomi.trim() || (!formSom && !formDollar)) return;
    setSaving(true);
    try {
      if (editTarget) {
        await fetch("/api/sheets", { method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sheet: "Mahsulot", idColumn: "Mahsulot_ID", idValue: editTarget.Mahsulot_ID, row: formData }) });
      } else {
        await fetch("/api/sheets", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sheet: "Mahsulot", row: formData }) });
      }
      setModalOpen(false);
      loadData();
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch("/api/sheets", { method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet: "Mahsulot", idColumn: "Mahsulot_ID", idValue: deleteTarget.Mahsulot_ID }) });
      setDeleteTarget(null);
      loadData();
    } finally { setDeleting(false); }
  }

  function fmt(val: string | number, cur: CurrencyType): string {
    const v = val === "" || val === undefined || val === null ? null : val;
    if (v === null) return cur === "som" ? "0 so'm" : "$0";
    return cur === "som" ? `${v} so'm` : `$${v}`;
  }

  const sotuvOf = (m: Mahsulot) => currency === "som"
    ? fmt(m.Sotuv_som, "som") : fmt(m.Sotuv_dollar, "dollar");
  const tanOf = (m: Mahsulot) => currency === "som"
    ? fmt(m.Tan_som, "som") : fmt(m.Tan_dollar, "dollar");

  function valyuta(m: Mahsulot): string {
    const hasSom    = m.Sotuv_som    && String(m.Sotuv_som).trim()    !== "" && String(m.Sotuv_som).trim()    !== "0";
    const hasDollar = m.Sotuv_dollar && String(m.Sotuv_dollar).trim() !== "" && String(m.Sotuv_dollar).trim() !== "0";
    if (hasSom && hasDollar) return "So'm / $";
    if (hasSom)    return "So'm";
    if (hasDollar) return "$";
    return "—";
  }

  return (
    <>
      {/* Header */}
      <header className="header">
        <div className="header__inner">
          <h1 className="header__title" style={{ paddingLeft: 4 }}>Mahsulotlar</h1>
          <div className="search" style={{ maxWidth: 320 }}>
            <span className="search__icon">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
            </span>
            <input className="search__input" placeholder="Qidirish..." value={search}
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
          <button className="btn btn--primary" onClick={openAdd}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
            </svg>
            Qo&apos;shish
          </button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar__inner">
          <button className={`btn ${currency === "som" ? "btn--active" : "btn--outline"}`}
            onClick={() => setCurrency("som")}>So&apos;m</button>
          <button className={`btn ${currency === "dollar" ? "btn--active" : "btn--outline"}`}
            onClick={() => setCurrency("dollar")}>$</button>

          <div className="toolbar__divider toolbar__divider--auto" />

          <div className="toggle-group">
            <button className={`toggle-group__btn ${view === "grid" ? "toggle-group__btn--active" : ""}`}
              onClick={() => setView("grid")}>
              <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                <path d="M1 2.5A1.5 1.5 0 012.5 1h3A1.5 1.5 0 017 2.5v3A1.5 1.5 0 015.5 7h-3A1.5 1.5 0 011 5.5v-3zm8 0A1.5 1.5 0 0110.5 1h3A1.5 1.5 0 0115 2.5v3A1.5 1.5 0 0113.5 7h-3A1.5 1.5 0 019 5.5v-3zm-8 8A1.5 1.5 0 012.5 9h3A1.5 1.5 0 017 10.5v3A1.5 1.5 0 015.5 15h-3A1.5 1.5 0 011 13.5v-3zm8 0A1.5 1.5 0 0110.5 9h3a1.5 1.5 0 011.5 1.5v3a1.5 1.5 0 01-1.5 1.5h-3A1.5 1.5 0 019 13.5v-3z"/>
              </svg>
            </button>
            <button className={`toggle-group__btn ${view === "list" ? "toggle-group__btn--active" : ""}`}
              onClick={() => setView("list")}>
              <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                <path fillRule="evenodd" d="M2.5 12a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5zm0-4a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5zm0-4a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="page-content">
        {!loading && !error && <p className="count-label">{filtered.length} ta mahsulot</p>}

        {loading && (
          view === "grid" ? (
            <div className="card-grid">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="skeleton">
                  <div className="skeleton__img" />
                  <div className="skeleton__body">
                    <div className="skeleton__line" />
                    <div className="skeleton__line skeleton__line--short" />
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="spinner--page" />
        )}

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

        {!loading && !error && filtered.length === 0 && (
          <div className="empty">
            <div className="empty__icon">📦</div>
            <p className="empty__title">Mahsulot topilmadi</p>
            <button className="btn btn--primary" onClick={openAdd}>+ Yangi mahsulot</button>
          </div>
        )}

        {/* Grid */}
        {!loading && !error && filtered.length > 0 && view === "grid" && (
          <div className="card-grid">
            {filtered.map(m => (
              <GridCard key={m.Mahsulot_ID} mahsulot={m}
                sotuvLabel={sotuvOf(m)} tanLabel={tanOf(m)} valyuta={valyuta(m)}
                onEdit={() => openEdit(m)} onDelete={() => setDeleteTarget(m)} />
            ))}
          </div>
        )}

        {/* List */}
        {!loading && !error && filtered.length > 0 && view === "list" && (
          <div className="list">
            <div className="list__head">
              <div className="list__head-img" />
              <div className="list__head-name"><span>Nomi</span></div>
              <div className="list__head-col"><span>Valyuta</span></div>
              <div className="list__head-col"><span>Tan narxi</span></div>
              <div className="list__head-col"><span>Sotuv narxi</span></div>
              <div className="list__head-actions" />
            </div>

            {filtered.map(m => (
              <ListCard key={m.Mahsulot_ID} mahsulot={m}
                sotuvLabel={sotuvOf(m)} tanLabel={tanOf(m)} valyuta={valyuta(m)}
                onEdit={() => openEdit(m)} onDelete={() => setDeleteTarget(m)} />
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal__head">
              <h2 className="modal__title">{editTarget ? "Mahsulotni tahrirlash" : "Yangi mahsulot"}</h2>
              <button className="modal__close" onClick={() => setModalOpen(false)}>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="modal__body">
              <Field label="Nomi *" value={formData.Nomi} placeholder="Mahsulot nomi"
                onChange={v => setFormData(p => ({ ...p, Nomi: v }))} />

              {/* Valyuta tanlash */}
              <div className="field">
                <label>Sotuv valyutasi</label>
                <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                  {([
                    { key: "som",    label: "So'm", active: formSom,    toggle: () => setFormSom(p => !p) },
                    { key: "dollar", label: "$",    active: formDollar, toggle: () => setFormDollar(p => !p) },
                  ]).map(({ key, label, active, toggle }) => (
                    <button key={key} type="button" onClick={toggle}
                      style={{
                        flex: 1, padding: "9px 0", borderRadius: 10, border: "1px solid",
                        fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all .15s",
                        background: active ? "var(--primary)" : "var(--bg)",
                        color: active ? "#fff" : "var(--text-2)",
                        borderColor: active ? "var(--primary)" : "var(--border)",
                      }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* So'm maydonlari */}
              {formSom && (
                <div className="grid-2">
                  <Field label="Sotuv (so'm)" value={formData.Sotuv_som} placeholder="0"
                    onChange={v => setFormData(p => ({ ...p, Sotuv_som: v }))} />
                  <Field label="Tan narx (so'm)" value={formData.Tan_som} placeholder="0"
                    onChange={v => setFormData(p => ({ ...p, Tan_som: v }))} />
                </div>
              )}

              {/* Dollar maydonlari */}
              {formDollar && (
                <div className="grid-2">
                  <Field label="Sotuv ($)" value={formData.Sotuv_dollar} placeholder="0"
                    onChange={v => setFormData(p => ({ ...p, Sotuv_dollar: v }))} />
                  <Field label="Tan narx ($)" value={formData.Tan_dollar} placeholder="0"
                    onChange={v => setFormData(p => ({ ...p, Tan_dollar: v }))} />
                </div>
              )}

              <Field label="Og'irligi (kg)" value={formData.Kg} placeholder="1"
                onChange={v => setFormData(p => ({ ...p, Kg: v }))} />
            </div>
            <div className="modal__footer">
              <button className="btn btn--outline" style={{ flex: 1 }} onClick={() => setModalOpen(false)}>Bekor</button>
              <button className="btn btn--primary" style={{ flex: 1 }} onClick={handleSave}
                disabled={saving || !formData.Nomi.trim() || (!formSom && !formDollar)}>
                {saving && <span className="spinner" />}
                {editTarget ? "Saqlash" : "Qo'shish"}
              </button>
            </div>
          </div>
        </div>
      )}

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
              <strong>{deleteTarget.Nomi}</strong> o&apos;chiriladi. Bu amalni qaytarib bo&apos;lmaydi.
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

/* ── Field ─────────────────────────────────── */
function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

/* ── Grid Card ──────────────────────────────── */
function GridCard({ mahsulot: m, sotuvLabel, tanLabel, valyuta, onEdit, onDelete }:
  { mahsulot: Mahsulot; sotuvLabel: string; tanLabel: string; valyuta: string; onEdit: () => void; onDelete: () => void }) {
  const [imgError, setImgError] = useState(false);
  return (
    <div className="card">
      <div className="card__img">
        {!imgError && m.Rasm
          ? <img src={`/api/image?path=${encodeURIComponent(m.Rasm)}`} alt={m.Nomi} onError={() => setImgError(true)} />
          : <div className="card__img-placeholder">📦</div>}
        <div className="card__actions">
          <button className="card__action-btn card__action-btn--edit" onClick={e => { e.stopPropagation(); onEdit(); }}>
            <svg width="16" height="16" fill="none" stroke="#2563eb" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
          <button className="card__action-btn card__action-btn--del" onClick={e => { e.stopPropagation(); onDelete(); }}>
            <svg width="16" height="16" fill="none" stroke="#ef4444" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      </div>
      <div className="card__body">
        <p className="card__name">{m.Nomi}</p>
        <div className="card__prices">
          <div className="card__price-box">
            <p className="card__price-label">Sotuv</p>
            <p className="card__price-val">{sotuvLabel}</p>
          </div>
          <div className="card__price-box">
            <p className="card__price-label">Tan</p>
            <p className="card__price-val card__price-val--gray">{tanLabel}</p>
          </div>
        </div>
        {m.Kg && <p className="card__kg">{m.Kg} kg</p>}
        <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
          <span style={{ fontWeight: 600, color: "var(--text-2)" }}>{valyuta}</span> bilan sotiladi
        </p>
      </div>
    </div>
  );
}

/* ── List Card ──────────────────────────────── */
function ListCard({ mahsulot: m, sotuvLabel, tanLabel, valyuta, onEdit, onDelete }:
  { mahsulot: Mahsulot; sotuvLabel: string; tanLabel: string; valyuta: string; onEdit: () => void; onDelete: () => void }) {
  const [imgError, setImgError] = useState(false);
  return (
    <div className="list-card">
      <div className="list-card__img">
        {!imgError && m.Rasm
          ? <img src={`/api/image?path=${encodeURIComponent(m.Rasm)}`} alt={m.Nomi} onError={() => setImgError(true)} />
          : <div className="list-card__img-ph">📦</div>}
      </div>
      <div className="list-card__name">
        <p>{m.Nomi}</p>
        {m.Kg && <span>{m.Kg} kg</span>}
      </div>
      <div className="list-card__col">
        <span style={{
          display: "inline-block", background: "var(--primary)", color: "#fff",
          fontSize: 13, fontWeight: 600, padding: "4px 12px", borderRadius: 8
        }}>{valyuta}</span>
      </div>
      <div className="list-card__col">
        <p className="list-card__col-val--gray">{tanLabel}</p>
      </div>
      <div className="list-card__col">
        <p className="list-card__col-val">{sotuvLabel}</p>
      </div>
      <div className="list-card__actions">
        <button className="icon-btn icon-btn--blue" onClick={onEdit}>
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
        </button>
        <button className="icon-btn icon-btn--red" onClick={onDelete}>
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
