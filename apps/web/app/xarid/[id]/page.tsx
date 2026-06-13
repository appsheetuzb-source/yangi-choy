"use client";
import { fetchSheet } from "@/lib/sheet-cache";

import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";

interface Xarid {
  Xarid_ID: string; Sana: string; Sotuv_Raqami: string;
  Taminotchi_ID: string; Vaqt: string; Izoh: string; Yil: string; Oy: string;
  Akt_sverka?: string;
}
interface XaridSavat {
  X_Savat: string; Xarid_ID: string; Mahsulot_ID: string; Ombor_ID: string;
  Soni: string; Narxi: string; Narx_som: string;
  Summa_Som: string; Jami_Summa: string;
}
interface Taminotchi { Taminotchi_ID: string; Ism: string; }
interface Mahsulot {
  Mahsulot_ID: string; Nomi: string; Ombor_ID: string;
  Tan_dollar: string; Tan_som: string;
}
interface SavatItem {
  id: string; Mahsulot_ID: string; Soni: string; Narxi: string; Narx_som: string;
}

function uid() { return Math.random().toString(36).slice(2, 10); }
function num(v: string | number | undefined) {
  return parseFloat(String(v || "0").replace(/\s/g, "").replace(",", ".")) || 0;
}
function fmt(v: string | number | undefined) {
  const n = num(v); return n ? n.toLocaleString("ru-RU") : "0";
}
function fmtSom(v: string | number | undefined) {
  const n = num(v); return n ? n.toLocaleString("ru-RU") + " so'm" : "—";
}
function fmtUsd(v: string | number | undefined) {
  const n = num(v);
  return n ? "$" + n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
}

function SearchSelect({ items, value, onChange, placeholder }: {
  items: { id: string; label: string }[]; value: string;
  onChange: (id: string) => void; placeholder?: string;
}) {
  const [q, setQ] = useState(""); const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = items.find(i => i.id === value);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);
  const list = items.filter(i => i.label.toLowerCase().includes(q.toLowerCase())).slice(0, 60);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div onClick={() => { setOpen(o => !o); setQ(""); }}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", fontSize: 14, color: selected ? "var(--text)" : "var(--text-3)" }}>
        <span>{selected ? selected.label : placeholder || "Tanlang..."}</span>
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </div>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 200, background: "var(--white)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", overflow: "hidden" }}>
          <div style={{ padding: "8px", borderBottom: "1px solid var(--border)" }}>
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Qidirish..."
              style={{ width: "100%", padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, outline: "none" }}/>
          </div>
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            {list.length === 0
              ? <div style={{ padding: "12px 14px", fontSize: 13, color: "var(--text-3)" }}>Topilmadi</div>
              : list.map(i => (
                <div key={i.id} onClick={() => { onChange(i.id); setOpen(false); setQ(""); }}
                  style={{ padding: "10px 14px", fontSize: 13, cursor: "pointer", fontWeight: i.id === value ? 700 : 400, background: i.id === value ? "var(--bg)" : "transparent", color: i.id === value ? "var(--primary)" : "var(--text)" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--bg)")}
                  onMouseLeave={e => (e.currentTarget.style.background = i.id === value ? "var(--bg)" : "transparent")}>
                  {i.label}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function XaridDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [xarid, setXarid]             = useState<Xarid | null>(null);
  const [savat, setSavat]             = useState<XaridSavat[]>([]);
  const [taminotchilar, setTaminotchilar] = useState<Taminotchi[]>([]);
  const [tMap, setTMap]               = useState<Record<string, string>>({});
  const [mahsulotlar, setMahsulotlar] = useState<Mahsulot[]>([]);
  const [mMap, setMMap]               = useState<Record<string, Mahsulot>>({});
  const [loading, setLoading]         = useState(true);

  // Edit drawer
  const [editOpen, setEditOpen]             = useState(false);
  const [editTaminotchi, setEditTaminotchi] = useState("");
  const [editIzoh, setEditIzoh]             = useState("");
  const [editSavat, setEditSavat]           = useState<SavatItem[]>([]);
  const [editSaving, setEditSaving]         = useState(false);

  const [isAddMode, setIsAddMode] = useState(false);

  // Edit single savat item
  const [editRowItem, setEditRowItem]     = useState<XaridSavat | null>(null);
  const [editRowSoni, setEditRowSoni]     = useState("");
  const [editRowNarxi, setEditRowNarxi]   = useState("");
  const [editRowNarxSom, setEditRowNarxSom] = useState("");
  const [editRowSaving, setEditRowSaving] = useState(false);

  // Delete confirm
  const [deleteOpen, setDeleteOpen]   = useState(false);
  const [deleting, setDeleting]       = useState(false);
  const [deleteSavat, setDeleteSavat] = useState<XaridSavat | null>(null);

  function loadData() {
    setLoading(true);
    Promise.all([
      fetchSheet("Xarid"),
      fetchSheet("Xarid_Savat"),
      fetchSheet("Taminotchi"),
      fetchSheet("Mahsulot"),
    ]).then(([xR, xsR, tR, mR]) => {
      const x = (xR.data as Xarid[]).find(x => x.Xarid_ID === id) || null;
      setXarid(x);
      setSavat((xsR.data as XaridSavat[]).filter(s => s.Xarid_ID === id));
      const t = tR.data as Taminotchi[];
      setTaminotchilar(t);
      const tm: Record<string, string> = {};
      t.forEach(i => { tm[i.Taminotchi_ID] = i.Ism; });
      setTMap(tm);
      const mArr = (mR.data as Mahsulot[]).filter(m => m.Nomi);
      setMahsulotlar(mArr);
      const mm: Record<string, Mahsulot> = {};
      mArr.forEach(m => { mm[m.Mahsulot_ID] = m; });
      setMMap(mm);
    }).finally(() => setLoading(false));
  }

  useEffect(() => { if (id) loadData(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  function openEdit() {
    if (!xarid) return;
    setIsAddMode(false);
    setEditTaminotchi(xarid.Taminotchi_ID);
    setEditIzoh(xarid.Izoh || "");
    setEditSavat(savat.map(s => ({ id: uid(), Mahsulot_ID: s.Mahsulot_ID, Soni: s.Soni, Narxi: s.Narxi, Narx_som: s.Narx_som })));
    setEditOpen(true);
  }

  function updateEditItem(itemId: string, field: keyof SavatItem, val: string) {
    setEditSavat(p => p.map(s => {
      if (s.id !== itemId) return s;
      const u = { ...s, [field]: val };
      if (field === "Mahsulot_ID") { const m = mMap[val]; if (m) { u.Narxi = m.Tan_dollar || ""; u.Narx_som = m.Tan_som || ""; } }
      return u;
    }));
  }

  async function handleUpdate() {
    if (!xarid || !editTaminotchi) return;
    setEditSaving(true);
    try {
      const [, mo, y] = xarid.Sana.split(".");
      if (isAddMode) {
        // Faqat yangi qatorlarni qo'shish — eskilarni o'chirmaslik
        for (let i = 0; i < editSavat.length; i++) {
          const r = editSavat[i]; if (!r.Mahsulot_ID || !r.Soni) continue;
          const m = mMap[r.Mahsulot_ID];
          await fetch("/api/sheets", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sheet: "Xarid_Savat", row: {
              X_Savat: uid(), Yil: y, Oy: mo.replace(/^0/, ""), Sana: xarid.Sana,
              Raqam: String(savat.length + i + 1), Xarid_ID: xarid.Xarid_ID, Ombor_ID: m?.Ombor_ID || "",
              Mahsulot_ID: r.Mahsulot_ID, Soni: r.Soni, Narxi: r.Narxi, Narx_som: r.Narx_som,
              Foiz: "", Foizli_narx: "0", Foizli_narx_dollar: r.Narxi,
              Jami_Summa: String(num(r.Soni) * num(r.Narxi)),
              Summa_Som: String(num(r.Soni) * num(r.Narx_som)), Vaqt: xarid.Sana,
            } }) });
        }
      } else {
        // Tahrirlash — xarid ma'lumotlarini yangilash + savatni to'liq almashtirish
        await fetch("/api/sheets", { method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sheet: "Xarid", idColumn: "Xarid_ID", idValue: xarid.Xarid_ID,
            row: { ...xarid, Taminotchi_ID: editTaminotchi, Izoh: editIzoh } }) });
        for (const s of savat) {
          await fetch("/api/sheets", { method: "DELETE", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sheet: "Xarid_Savat", idColumn: "X_Savat", idValue: s.X_Savat }) });
        }
        for (let i = 0; i < editSavat.length; i++) {
          const r = editSavat[i]; if (!r.Mahsulot_ID || !r.Soni) continue;
          const m = mMap[r.Mahsulot_ID];
          await fetch("/api/sheets", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sheet: "Xarid_Savat", row: {
              X_Savat: uid(), Yil: y, Oy: mo.replace(/^0/, ""), Sana: xarid.Sana,
              Raqam: String(i + 1), Xarid_ID: xarid.Xarid_ID, Ombor_ID: m?.Ombor_ID || "",
              Mahsulot_ID: r.Mahsulot_ID, Soni: r.Soni, Narxi: r.Narxi, Narx_som: r.Narx_som,
              Foiz: "", Foizli_narx: "0", Foizli_narx_dollar: r.Narxi,
              Jami_Summa: String(num(r.Soni) * num(r.Narxi)),
              Summa_Som: String(num(r.Soni) * num(r.Narx_som)), Vaqt: xarid.Sana,
            } }) });
        }
      }
      setEditOpen(false);
      setIsAddMode(false);
      setTimeout(() => loadData(), 800);
    } finally { setEditSaving(false); }
  }

  function openAddItem() {
    if (!xarid) return;
    const first = mahsulotlar[0];
    setIsAddMode(true);
    setEditTaminotchi(xarid.Taminotchi_ID);
    setEditIzoh(xarid.Izoh || "");
    setEditSavat([{ id: uid(), Mahsulot_ID: first?.Mahsulot_ID || "", Soni: "", Narxi: first?.Tan_dollar || "", Narx_som: first?.Tan_som || "" }]);
    setEditOpen(true);
  }

  async function handleEditRowSave() {
    if (!editRowItem || !xarid) return;
    setEditRowSaving(true);
    try {
      const [, mo, y] = xarid.Sana.split(".");
      await fetch("/api/sheets", { method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet: "Xarid_Savat", idColumn: "X_Savat", idValue: editRowItem.X_Savat }) });
      await fetch("/api/sheets", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet: "Xarid_Savat", row: {
          X_Savat: uid(), Yil: y, Oy: mo.replace(/^0/, ""), Sana: xarid.Sana,
          Xarid_ID: xarid.Xarid_ID,
          Ombor_ID: editRowItem.Ombor_ID || mMap[editRowItem.Mahsulot_ID]?.Ombor_ID || "",
          Mahsulot_ID: editRowItem.Mahsulot_ID,
          Soni: editRowSoni, Narxi: editRowNarxi, Narx_som: editRowNarxSom,
          Foiz: "", Foizli_narx: "0", Foizli_narx_dollar: editRowNarxi,
          Jami_Summa: String(num(editRowSoni) * num(editRowNarxi)),
          Summa_Som: String(num(editRowSoni) * num(editRowNarxSom)), Vaqt: xarid.Sana,
        } }) });
      setEditRowItem(null);
      setTimeout(() => loadData(), 600);
    } finally { setEditRowSaving(false); }
  }

  async function handleDeleteSavatItem(s: XaridSavat) {
    await fetch("/api/sheets", { method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sheet: "Xarid_Savat", idColumn: "X_Savat", idValue: s.X_Savat }) });
    setDeleteSavat(null);
    setTimeout(() => loadData(), 600);
  }

  async function handleDeleteXarid() {
    if (!xarid) return;
    setDeleting(true);
    try {
      for (const s of savat) {
        await fetch("/api/sheets", { method: "DELETE", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sheet: "Xarid_Savat", idColumn: "X_Savat", idValue: s.X_Savat }) });
      }
      await fetch("/api/sheets", { method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet: "Xarid", idColumn: "Xarid_ID", idValue: xarid.Xarid_ID }) });
      router.push("/xarid");
    } finally { setDeleting(false); }
  }

  const [togglingAkt, setTogglingAkt] = useState(false);

  async function toggleAkt() {
    if (!xarid) return;
    setTogglingAkt(true);
    const newVal = isHa ? "False" : "True";
    await fetch("/api/sheets", { method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sheet: "Xarid", idColumn: "Xarid_ID", idValue: xarid.Xarid_ID,
        row: { ...xarid, Akt_sverka: newVal } }) });
    setXarid(prev => prev ? { ...prev, Akt_sverka: newVal } : prev);
    setTogglingAkt(false);
  }

  const tItems = useMemo(() => taminotchilar.map(t => ({ id: t.Taminotchi_ID, label: t.Ism })), [taminotchilar]);
  const mItems = useMemo(() => mahsulotlar.map(m => ({ id: m.Mahsulot_ID, label: m.Nomi })), [mahsulotlar]);

  const jamiSumma    = useMemo(() => savat.reduce((s, r) => s + num(r.Summa_Som), 0), [savat]);
  const jamiSummaUsd = useMemo(() => savat.reduce((s, r) => s + Math.abs(num(r.Jami_Summa)), 0), [savat]);
  const editJamiSom  = useMemo(() => editSavat.reduce((s, r) => s + num(r.Soni) * num(r.Narx_som), 0), [editSavat]);
  const editJamiUsd  = useMemo(() => editSavat.reduce((s, r) => s + num(r.Soni) * num(r.Narxi), 0), [editSavat]);

  if (loading) return (
    <div className="page-content" style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
      <div className="spinner--page"/>
    </div>
  );

  if (!xarid) return (
    <div className="page-content">
      <div className="empty">
        <div className="empty__icon">🛒</div>
        <p className="empty__title">Xarid topilmadi</p>
        <button className="btn btn--outline" onClick={() => router.back()}>← Orqaga</button>
      </div>
    </div>
  );

  const tNomi = tMap[xarid.Taminotchi_ID] || "—";
  const isHa  = xarid.Akt_sverka === "True" || xarid.Akt_sverka === "true";
  const raqam = xarid.Sotuv_Raqami || "—";

  return (
    <>
      {/* ── Header ── */}
      <header className="header" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="header__inner" style={{ gap: 14 }}>
          <button onClick={() => router.back()}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--white)", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text-2)", flexShrink: 0 }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
            Orqaga
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2 }}>Xarid #{raqam}</h1>
            <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{xarid.Sana} — {tNomi}</p>
          </div>
          <button onClick={openEdit}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--white)", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            Tahrirlash
          </button>
          <button onClick={() => setDeleteOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", border: "1px solid #fecaca", borderRadius: "var(--radius)", background: "var(--white)", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#ef4444" }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            O&apos;chirish
          </button>
        </div>
      </header>

      <div className="page-content" style={{ maxWidth: 1000 }}>

        {/* ── Stats ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 24 }}>
          <div onClick={() => router.push(`/taminotchi/${xarid.Taminotchi_ID}`)}
            style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", padding: "20px 24px", cursor: "pointer", transition: "box-shadow .15s" }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = "var(--shadow)")}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = "var(--shadow-sm)")}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".06em", marginBottom: 10 }}>TA&apos;MINOTCHI</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: "var(--primary)" }}>{tNomi}</p>
            <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>{xarid.Sana}</p>
          </div>
          <div style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", padding: "20px 24px" }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".06em", marginBottom: 10 }}>JAMI MAHSULOT</p>
            <p style={{ fontSize: 26, fontWeight: 800, color: "var(--text)" }}>
              {savat.length} <span style={{ fontSize: 14, fontWeight: 600 }}>ta</span>
            </p>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-2)", marginTop: 4 }}>
              {fmt(savat.reduce((s, r) => s + num(r.Soni), 0))} <span style={{ fontSize: 11, fontWeight: 600 }}>kg</span>
            </p>
          </div>
          <div style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", padding: "20px 24px" }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".06em", marginBottom: 10 }}>JAMI SUMMA</p>
            {jamiSumma !== 0 && <p style={{ fontSize: 22, fontWeight: 800, color: "var(--text)" }}>{jamiSumma.toLocaleString("ru-RU")} <span style={{fontSize:12,fontWeight:600}}>so&apos;m</span></p>}
            {jamiSummaUsd !== 0 && <p style={{ fontSize: 22, fontWeight: 800, color: "#2563eb", marginTop: jamiSumma!==0?4:0 }}>${jamiSummaUsd.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2})}</p>}
            {jamiSumma === 0 && jamiSummaUsd === 0 && <p style={{ fontSize: 22, fontWeight: 800 }}>0</p>}
          </div>
        </div>

        {/* ── Mahsulotlar ── */}
        <div style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>Mahsulotlar</span>
            <button onClick={openAddItem}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--white)", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              Yangi mahsulot
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "48px 1fr 120px 140px 160px 72px", padding: "10px 20px", background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
            {["#", "MAHSULOT", "SONI", "NARX", "JAMI", ""].map(h => (
              <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".05em" }}>{h}</span>
            ))}
          </div>
          {savat.length === 0 && (
            <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>Mahsulot topilmadi</div>
          )}
          {savat.map((s, i) => {
            const m = mMap[s.Mahsulot_ID];
            const isEditing = editRowItem?.X_Savat === s.X_Savat;
            const jami = isEditing
              ? num(editRowSoni) * (num(editRowNarxSom) || num(editRowNarxi))
              : num(s.Soni) * (num(s.Narx_som) || num(s.Narxi));
            const narx = num(s.Narx_som) > 0 ? num(s.Narx_som) : num(s.Narxi);
            return (
              <div key={s.X_Savat || i} style={{
                display: "grid", gridTemplateColumns: "48px 1fr 120px 140px 160px 72px",
                padding: isEditing ? "8px 20px" : "13px 20px", alignItems: "center",
                borderBottom: i < savat.length - 1 ? "1px solid var(--border)" : "none",
                background: isEditing ? "#f0f9ff" : "transparent",
              }}>
                <span style={{ fontSize: 13, color: "var(--text-3)" }}>{i + 1}</span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{m?.Nomi || "—"}</span>

                {isEditing ? (
                  <input autoFocus value={editRowSoni} onChange={e => setEditRowSoni(e.target.value)}
                    style={{ width: "100%", padding: "6px 10px", border: "1.5px solid var(--primary)", borderRadius: "var(--radius)", fontSize: 13, fontWeight: 700, outline: "none", textAlign: "center" }}/>
                ) : (
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{fmt(s.Soni)}</span>
                )}

                {isEditing ? (
                  <input value={num(editRowNarxSom) > 0 ? editRowNarxSom : editRowNarxi}
                    onChange={e => num(editRowNarxSom) > 0 ? setEditRowNarxSom(e.target.value) : setEditRowNarxi(e.target.value)}
                    style={{ width: "100%", padding: "6px 10px", border: "1.5px solid var(--primary)", borderRadius: "var(--radius)", fontSize: 13, fontWeight: 700, outline: "none", textAlign: "center" }}/>
                ) : (
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{fmt(narx)}</span>
                )}

                <span style={{ fontSize: 14, fontWeight: 800, color: isEditing ? "var(--primary)" : "var(--text)" }}>{fmt(jami)}</span>

                <div style={{ display: "flex", gap: 4 }}>
                  {isEditing ? (
                    <>
                      <button onClick={handleEditRowSave} disabled={editRowSaving}
                        style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "#dcfce7", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#16a34a" }}>
                        {editRowSaving ? <span className="spinner" style={{ width: 12, height: 12 }}/> : <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>}
                      </button>
                      <button onClick={() => setEditRowItem(null)}
                        style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "#fee2e2", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444" }}>
                        <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>
                    </>
                  ) : (
                  <>
                  <button onClick={() => { setEditRowItem(s); setEditRowSoni(s.Soni); setEditRowNarxi(s.Narxi); setEditRowNarxSom(s.Narx_som); }}
                    style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563eb" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#dbeafe")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  </button>
                  <button onClick={() => setDeleteSavat(s)}
                    style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#fee2e2")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                  </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      </div>

      {/* ── Yangi mahsulot Modal (add mode) ── */}
      {editOpen && isAddMode && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(15,42,76,.42)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={() => setEditOpen(false)}>
          <div style={{ background: "var(--white)", borderRadius: 16, width: "100%", maxWidth: 900, maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "20px 24px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "#fff7ed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="20" height="20" fill="none" stroke="#f97316" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 2 }}>Yangi mahsulot qo&apos;shish</h2>
                <p style={{ fontSize: 12, color: "var(--text-3)" }}>Xarid #{raqam} — {tNomi}</p>
              </div>
              <button onClick={() => setEditOpen(false)} style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid var(--border)", background: "var(--white)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
              <div style={{ marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".06em" }}>MAHSULOTLAR</span>
              </div>
              {editSavat.map(s => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ flex: 3, minWidth: 0 }}>
                    <SearchSelect items={mItems} value={s.Mahsulot_ID} onChange={v => updateEditItem(s.id, "Mahsulot_ID", v)} placeholder="Mahsulot..."/>
                  </div>
                  <input value={s.Soni} onChange={e => updateEditItem(s.id, "Soni", e.target.value)} placeholder="Miqdor"
                    style={{ width: 90, padding: "10px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, fontWeight: 600, outline: "none", textAlign: "center" }}/>
                  <input value={s.Narxi} onChange={e => updateEditItem(s.id, "Narxi", e.target.value)} placeholder="Narx ($)"
                    style={{ width: 100, padding: "10px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, fontWeight: 600, outline: "none", color: "#2563eb", textAlign: "center" }}/>
                  <input value={s.Narx_som} onChange={e => updateEditItem(s.id, "Narx_som", e.target.value)} placeholder="Narx (so'm)"
                    style={{ width: 120, padding: "10px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, fontWeight: 600, outline: "none", textAlign: "center" }}/>
                  <div style={{ minWidth: 110, padding: "10px 10px", background: "var(--bg)", borderRadius: "var(--radius)", fontSize: 13, fontWeight: 700, textAlign: "right", color: num(s.Narx_som) > 0 ? "var(--text)" : "#2563eb" }}>
                    {num(s.Soni) > 0
                      ? num(s.Narx_som) > 0
                        ? (num(s.Soni) * num(s.Narx_som)).toLocaleString("ru-RU")
                        : num(s.Narxi) > 0
                          ? "$" + (num(s.Soni) * num(s.Narxi)).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : "—"
                      : "—"}
                  </div>
                  <button onClick={() => setEditSavat(p => p.filter(r => r.id !== s.id))}
                    style={{ width: 36, height: 40, borderRadius: 8, border: "none", background: "#dbeafe", color: "#2563eb", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 20, fontWeight: 700, lineHeight: 1 }}>
                    −
                  </button>
                </div>
              ))}
              <button onClick={() => { const first = mahsulotlar[0]; setEditSavat(p => [...p, { id: uid(), Mahsulot_ID: first?.Mahsulot_ID || "", Soni: "", Narxi: first?.Tan_dollar || "", Narx_som: first?.Tan_som || "" }]); }}
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "7px 14px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "var(--white)", cursor: "pointer", color: "var(--text-2)", marginTop: 4 }}>
                <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                Qo&apos;shish
              </button>
              {editSavat.length > 0 && (
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 16, padding: "10px 14px", background: "var(--bg)", borderRadius: "var(--radius)", marginTop: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-3)" }}>Jami:</span>
                  {editJamiSom > 0 && <span style={{ fontSize: 14, fontWeight: 700 }}>{fmtSom(editJamiSom)}</span>}
                  {editJamiUsd > 0 && <span style={{ fontSize: 14, fontWeight: 700, color: "#2563eb" }}>{fmtUsd(editJamiUsd)}</span>}
                </div>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "16px 24px", borderTop: "1px solid var(--border)" }}>
              <button className="btn btn--outline" onClick={() => setEditOpen(false)}>Bekor</button>
              <button className="btn btn--primary" onClick={handleUpdate}
                disabled={editSaving || editSavat.filter(s => s.Mahsulot_ID && s.Soni).length === 0}>
                {editSaving && <span className="spinner"/>} Saqlash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Drawer (tahrirlash mode) ── */}
      {editOpen && !isAddMode && (
        <>
          <div className="drawer-overlay" onClick={() => setEditOpen(false)}/>
          <div className="drawer" style={{ width: 520 }}>
            <div className="drawer__head">
              <button className="drawer__back" onClick={() => setEditOpen(false)}>
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
              </button>
              <span className="drawer__title">Xarid #{raqam} tahrirlash</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn--outline btn--sm" onClick={() => setEditOpen(false)}>Bekor</button>
                <button className="btn btn--primary btn--sm" onClick={handleUpdate}
                  disabled={editSaving || !editTaminotchi || editSavat.filter(s => s.Mahsulot_ID && s.Soni).length === 0}>
                  {editSaving && <span className="spinner"/>} Saqlash
                </button>
              </div>
            </div>
            <div className="drawer__body">
              <div className="drawer__section">
                <p className="drawer__section-label">Ta&apos;minotchi *</p>
                <SearchSelect items={tItems} value={editTaminotchi} onChange={setEditTaminotchi} placeholder="Ta'minotchi tanlang..."/>
              </div>
              <div className="drawer__section">
                <p className="drawer__section-label">Izoh</p>
                <div className="field"><input value={editIzoh} onChange={e => setEditIzoh(e.target.value)} placeholder="Ixtiyoriy..."/></div>
              </div>
              <div className="drawer__section">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <p className="drawer__section-label" style={{ margin: 0 }}>Mahsulotlar</p>
                  <button className="btn btn--primary btn--sm" onClick={() => {
                    const first = mahsulotlar[0];
                    setEditSavat(p => [...p, { id: uid(), Mahsulot_ID: first?.Mahsulot_ID || "", Soni: "", Narxi: first?.Tan_dollar || "", Narx_som: first?.Tan_som || "" }]);
                  }}>
                    <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg> Yangi
                  </button>
                </div>
                {editSavat.map((s, i) => (
                  <div key={s.id} style={{ background: "var(--bg)", borderRadius: "var(--radius-lg)", padding: "12px", marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)" }}>#{i + 1}</span>
                      <button className="icon-btn icon-btn--red" style={{ width: 26, height: 26 }} onClick={() => setEditSavat(p => p.filter(r => r.id !== s.id))}>
                        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>
                    </div>
                    <div className="field" style={{ marginBottom: 8 }}>
                      <SearchSelect items={mItems} value={s.Mahsulot_ID} onChange={v => updateEditItem(s.id, "Mahsulot_ID", v)} placeholder="Mahsulot tanlang..."/>
                    </div>
                    <div className="grid-2">
                      <div className="field"><label>Miqdor (kg)</label><input value={s.Soni} onChange={e => updateEditItem(s.id, "Soni", e.target.value)} placeholder="0"/></div>
                      <div className="field"><label>Narxi ($)</label><input value={s.Narxi} onChange={e => updateEditItem(s.id, "Narxi", e.target.value)} placeholder="0.00" style={{ color: "#2563eb", fontWeight: 700 }}/></div>
                      <div className="field"><label>Narxi (so&apos;m)</label><input value={s.Narx_som} onChange={e => updateEditItem(s.id, "Narx_som", e.target.value)} placeholder="0"/></div>
                      <div className="field"><label>Jami</label>
                        <div style={{ padding: "10px 14px", background: "var(--white)", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, fontWeight: 700 }}>
                          {num(s.Soni) && num(s.Narx_som) ? fmtSom(num(s.Soni) * num(s.Narx_som))
                            : num(s.Soni) && num(s.Narxi) ? <span style={{ color: "#2563eb" }}>{fmtUsd(num(s.Soni) * num(s.Narxi))}</span> : "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {editSavat.length > 0 && (
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 16, padding: "10px 14px", background: "var(--bg)", borderRadius: "var(--radius)" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-3)" }}>Jami:</span>
                    {editJamiSom > 0 && <span style={{ fontSize: 14, fontWeight: 700 }}>{fmtSom(editJamiSom)}</span>}
                    {editJamiUsd > 0 && <span style={{ fontSize: 14, fontWeight: 700, color: "#2563eb" }}>{fmtUsd(editJamiUsd)}</span>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Delete savat item confirm ── */}
      {deleteSavat && (
        <div className="modal-overlay" onClick={() => setDeleteSavat(null)}>
          <div className="confirm" onClick={e => e.stopPropagation()}>
            <div className="confirm__icon"><svg width="24" height="24" fill="none" stroke="#ef4444" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></div>
            <h3 className="confirm__title">Mahsulotni o&apos;chirish</h3>
            <p className="confirm__text"><strong>{mMap[deleteSavat.Mahsulot_ID]?.Nomi || "Mahsulot"}</strong> savatdan o&apos;chiriladi.</p>
            <div className="confirm__actions">
              <button className="btn btn--outline" style={{ flex: 1 }} onClick={() => setDeleteSavat(null)}>Bekor</button>
              <button className="btn btn--red" style={{ flex: 1 }} onClick={() => handleDeleteSavatItem(deleteSavat)}>O&apos;chirish</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete xarid confirm ── */}
      {deleteOpen && (
        <div className="modal-overlay" onClick={() => setDeleteOpen(false)}>
          <div className="confirm" onClick={e => e.stopPropagation()}>
            <div className="confirm__icon"><svg width="24" height="24" fill="none" stroke="#ef4444" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></div>
            <h3 className="confirm__title">Xaridni o&apos;chirish</h3>
            <p className="confirm__text"><strong>Xarid #{raqam}</strong> va barcha savat elementlari o&apos;chiriladi.</p>
            <div className="confirm__actions">
              <button className="btn btn--outline" style={{ flex: 1 }} onClick={() => setDeleteOpen(false)}>Bekor</button>
              <button className="btn btn--red" style={{ flex: 1 }} onClick={handleDeleteXarid} disabled={deleting}>
                {deleting && <span className="spinner"/>} O&apos;chirish
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
