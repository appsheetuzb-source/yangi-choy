"use client";
import { fetchSheet, fetchSheetWhere, afterWrite } from "@/lib/sheet-cache";
import { useAuth } from "@/lib/AuthContext";
import { gaznaForUser } from "@/lib/auth";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";

interface Gazna { Gazna_ID: string; Nomi: string; Turi: string; }
interface STolov {
  Tolov_ID: string; Sotuv_ID: string; Mijoz_ID: string; Agent: string;
  Yil: string; Oy: string; Sana: string; Valyuta: string; Turi: string;
  Som: string; Dollar: string; Summa: string; Summa_dollar: string;
  Izoh: string; Dollar_Kursi: string; Vaqt: string; Check?: string;
  Gazna_ID?: string; Gazna_dollar_ID?: string;
}
interface Mijoz { Mijoz_ID: string; Ism: string; }
interface Foydalanuvchi { Foydalanuvchi_ID: string; Nomi: string; }
interface Sotuv { Sotuv_ID: string; Sotuv_Raqami: string; }

const TURI_LIST = ["Naqd","Bank","Karta"];

function num(v: string|number|undefined) {
  return parseFloat(String(v||"0").replace(/\s/g,"").replace(",",".")) || 0;
}
function fmtUsd(v: number) {
  return "$" + v.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function isoToParts(iso: string) {
  const [y, m, d] = (iso || "").split("-");
  return { sana: d + "." + m + "." + y, oy: String(parseInt(m || "1")), yil: y || "" };
}
function sanaToIso(sana: string) {
  const mm = (sana || "").match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  return mm ? (mm[3] + "-" + mm[2].padStart(2, "0") + "-" + mm[1].padStart(2, "0")) : "";
}

export default function SotuvTolovDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.lavozim === "Admin";

  const [tolov, setTolov]             = useState<STolov|null>(null);
  const [mijozlar, setMijozlar]       = useState<Mijoz[]>([]);
  const [agentlar, setAgentlar]       = useState<Foydalanuvchi[]>([]);
  const [sotuvlar, setSotuvlar]       = useState<Sotuv[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string|null>(null);

  const [gaznalar, setGaznalar]       = useState<Gazna[]>([]);
  const [editing, setEditing]         = useState(false);
  const [editValyuta, setEditValyuta] = useState<"Som"|"Dollar">("Som");
  const [editSana, setEditSana]       = useState("");
  const [editSom, setEditSom]         = useState("");
  const [editDollar, setEditDollar]   = useState("");
  const [editKurs, setEditKurs]       = useState("");
  const [editTuri, setEditTuri]       = useState("Naqd");
  const [editIzoh, setEditIzoh]       = useState("");
  const [editGazna, setEditGazna]     = useState("");
  const [editGaznaDollar, setEditGaznaDollar] = useState("");
  const [saving, setSaving]           = useState(false);
  const [kursShake, setKursShake]     = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting]       = useState(false);
  const [toggling, setToggling]       = useState(false);
  const [isMobile, setIsMobile]       = useState(false);

  const [liveTime,setLiveTime]=useState("");  useEffect(()=>{ const p=(n:number)=>String(n).padStart(2,"0"); const tick=()=>{const t=new Date(); setLiveTime(p(t.getHours())+":"+p(t.getMinutes())+":"+p(t.getSeconds()));}; tick(); const iv=setInterval(tick,1000); return ()=>clearInterval(iv); },[]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const loadData = useCallback(() => {
    setLoading(true);
    fetchSheetWhere("S_tolov", "Tolov_ID", id)
    .then(async (tR) => {
      const found = (tR.data as STolov[])[0];
      if (!found) { setError("To'lov topilmadi"); return; }
      const [mR, fR, sR, gzR] = await Promise.all([
        found.Mijoz_ID ? fetchSheetWhere("Mijozlar", "Mijoz_ID", found.Mijoz_ID) : Promise.resolve({ headers: [], data: [] }),
        found.Agent ? fetchSheetWhere("Foydalanuvchi", "Foydalanuvchi_ID", found.Agent) : Promise.resolve({ headers: [], data: [] }),
        found.Sotuv_ID ? fetchSheetWhere("Sotuv", "Sotuv_ID", found.Sotuv_ID) : Promise.resolve({ headers: [], data: [] }),
        fetchSheet("Gazna"),
      ]);
      setTolov(found);
      setMijozlar((mR.data || []) as Mijoz[]);
      setAgentlar((fR.data || []) as Foydalanuvchi[]);
      setSotuvlar((sR.data || []) as Sotuv[]);
      setGaznalar(((gzR.data || []) as Gazna[]).filter(g => g.Gazna_ID));
      if (!found.Dollar_Kursi || parseFloat(found.Dollar_Kursi) < 11000) {
        setEditValyuta(found.Valyuta === "Dollar" ? "Dollar" : "Som");
        setEditSom(found.Som || "");
        setEditDollar(found.Dollar || "");
        setEditKurs("");
        setEditTuri(found.Turi || "Naqd");
        setEditIzoh(found.Izoh || "");
        setEditing(true);
      }
    }).catch(e => setError(e instanceof Error ? e.message : "Xatolik"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  // Admin emas — so'm/dollar > 0 bo'lsa biriktirilgan gazna avtomatik tanlanadi
  useEffect(() => {
    if (isAdmin) return;
    const som = gaznaForUser(user, gaznalar).filter(g => g.Turi !== "Dollar");
    const dol = gaznaForUser(user, gaznalar).filter(g => g.Turi === "Dollar");
    if (num(editSom) > 0 && som.length > 0 && !som.some(g => g.Gazna_ID === editGazna)) setEditGazna(som[0].Gazna_ID);
    if (num(editDollar) > 0 && dol.length > 0 && !dol.some(g => g.Gazna_ID === editGaznaDollar)) setEditGaznaDollar(dol[0].Gazna_ID);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editSom, editDollar, gaznalar, isAdmin, user]);

  function openEdit() {
    if (!tolov) return;
    setEditValyuta(tolov.Valyuta === "Dollar" ? "Dollar" : "Som");
    setEditSana(sanaToIso(tolov.Sana));
    setEditSom(tolov.Som || "");
    setEditDollar(tolov.Dollar || "");
    setEditKurs(tolov.Dollar_Kursi || "");
    setEditTuri(tolov.Turi || "Naqd");
    setEditIzoh(tolov.Izoh || "");
    setEditGazna(tolov.Gazna_ID || "");
    setEditGaznaDollar(tolov.Gazna_dollar_ID || "");
    setEditing(true);
  }

  function tryCloseEdit() {
    if (num(editKurs) < 11000) {
      setKursShake(true);
      setTimeout(() => setKursShake(false), 600);
    } else {
      setEditing(false);
    }
  }

  async function handleSave() {
    if (!tolov) return;
    if (num(editKurs) < 11000) return;
    setSaving(true);
    const somVal = num(editSom), usdVal = num(editDollar), kurs = num(editKurs);
    const isSom = editValyuta === "Som";
    const summa       = isSom ? String(somVal + usdVal * kurs) : "";
    const summaDollar = !isSom ? String(usdVal + (kurs > 0 ? somVal / kurs : 0)) : "";
    const _sp = editSana ? isoToParts(editSana) : { sana: tolov.Sana, oy: tolov.Oy, yil: tolov.Yil };
    try {
      await fetch("/api/sheets", { method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet: "S_tolov", idColumn: "Tolov_ID", idValue: tolov.Tolov_ID,
          row: { ...tolov, Valyuta: isSom ? "So'm" : "Dollar", Turi: editTuri,
            Sana: _sp.sana, Yil: _sp.yil, Oy: _sp.oy,
            Som: String(somVal), Dollar: String(usdVal),
            Summa: summa, Summa_dollar: summaDollar,
            Dollar_Kursi: editKurs, Izoh: editIzoh,
            Gazna_ID: editGazna, Gazna_dollar_ID: editGaznaDollar,
          }
        })
      });
      afterWrite("S_tolov");
      setEditing(false);
      setTimeout(() => loadData(), 600);
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!tolov) return;
    setDeleting(true);
    try {
      await fetch("/api/sheets", { method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet: "S_tolov", idColumn: "Tolov_ID", idValue: tolov.Tolov_ID })
      });
      afterWrite("S_tolov");
      router.back();
    } finally { setDeleting(false); }
  }

  async function toggleAkt() {
    if (!tolov) return;
    setToggling(true);
    const isHa = tolov.Check === "True" || tolov.Check === "true" || tolov.Check === "TRUE";
    const newVal = isHa ? "False" : "True";
    await fetch("/api/sheets", { method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sheet: "S_tolov", idColumn: "Tolov_ID", idValue: tolov.Tolov_ID,
        row: { ...tolov, Check: newVal }
      })
    });
    afterWrite("S_tolov");
    setTolov(p => p ? { ...p, Check: newVal } : p);
    setToggling(false);
  }

  if (loading) return (
    <div className="page-content" style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
      <div className="spinner--page"/>
    </div>
  );

  if (error || !tolov) return (
    <div className="page-content">
      <div className="empty">
        <div className="empty__icon">💳</div>
        <p className="empty__title">{error || "Topilmadi"}</p>
        <button className="btn btn--outline" onClick={() => router.back()}>← Orqaga</button>
      </div>
    </div>
  );

  const mijozRec = mijozlar.find(m => m.Mijoz_ID === tolov.Mijoz_ID);
  const mNomi    = mijozRec?.Ism || "—";
  const agentNomi = agentlar.find(f => f.Foydalanuvchi_ID === tolov.Agent)?.Nomi || tolov.Agent || "";
  const sRaqam   = tolov.Sotuv_ID ? sotuvlar.find(s => s.Sotuv_ID === tolov.Sotuv_ID)?.Sotuv_Raqami : null;
  const gaznaNomi = tolov.Gazna_ID ? (gaznalar.find(g => g.Gazna_ID === tolov.Gazna_ID)?.Nomi || tolov.Gazna_ID) : null;
  const gaznaDollarNomi = tolov.Gazna_dollar_ID ? (gaznalar.find(g => g.Gazna_ID === tolov.Gazna_dollar_ID)?.Nomi || tolov.Gazna_dollar_ID) : null;
  const somVal   = num(tolov.Som);
  const dollarVal = num(tolov.Dollar);
  const jamiSom  = num(tolov.Summa);
  const jamiUsd  = num(tolov.Summa_dollar);
  const kurs     = num(tolov.Dollar_Kursi);
  const isHa     = tolov.Check === "True" || tolov.Check === "true" || tolov.Check === "TRUE";

  const editPreview = editValyuta === "Som"
    ? num(editSom) + num(editDollar) * num(editKurs)
    : num(editDollar) + (num(editKurs) > 0 ? num(editSom) / num(editKurs) : 0);

  const modalOverlay: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 50, background: "rgba(15,42,76,.42)", backdropFilter: "blur(4px)",
    display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center",
    padding: isMobile ? 0 : 20,
  };
  const modalBox: React.CSSProperties = {
    background: "var(--white)", width: "100%", maxWidth: isMobile ? "100%" : 520,
    borderRadius: isMobile ? "20px 20px 0 0" : 16,
    display: "flex", flexDirection: "column", maxHeight: isMobile ? "92dvh" : "90vh",
  };

  return (
    <>
      <header className="header" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="header__inner" style={{ gap: isMobile ? 8 : 14, flexWrap: "nowrap" }}>
          <button onClick={() => router.back()}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: isMobile ? "6px 10px" : "6px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--white)", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text-2)", flexShrink: 0 }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
            Orqaga
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: isMobile ? 16 : 20, fontWeight: 800, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Pul ayirish</h1>
          </div>
          <button onClick={openEdit} title="Tahrirlash"
            style={{ display: "flex", alignItems: "center", gap: 6, padding: isMobile ? "8px 10px" : "8px 16px", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--white)", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text-2)", flexShrink: 0 }}>
            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            {!isMobile && "Tahrirlash"}
          </button>
          <button onClick={() => setConfirmDelete(true)} title="O'chirish"
            style={{ display: "flex", alignItems: "center", gap: 6, padding: isMobile ? "8px 10px" : "8px 16px", border: "1px solid #fecaca", borderRadius: "var(--radius)", background: "var(--white)", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#ef4444", flexShrink: 0 }}>
            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            {!isMobile && "O’chirish"}
          </button>
        </div>
      </header>

      <div className="page-content" style={{ maxWidth: 900 }}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: isMobile ? 10 : 16, marginBottom: 24 }}>
          <div onClick={() => mijozRec && router.push(`/mijozlar/${mijozRec.Mijoz_ID}`)}
            style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", padding: isMobile ? "14px 16px" : "20px 24px", cursor: "pointer" }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = "var(--shadow)")}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = "var(--shadow-sm)")}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".06em", marginBottom: 10 }}>MIJOZ</p>
            <p style={{ fontSize: isMobile ? 15 : 18, fontWeight: 800, color: "var(--primary)" }}>{mNomi}</p>
            <p style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 6, fontWeight: 600 }}>{tolov.Sana}{tolov.Vaqt ? ` · ${tolov.Vaqt}` : ""}</p>
          </div>
          <div style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", padding: isMobile ? "14px 16px" : "20px 24px" }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".06em", marginBottom: 10 }}>SO&apos;M</p>
            <p style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800 }}>{somVal !== 0 ? somVal.toLocaleString("ru-RU") : "0"}</p>
          </div>
          <div style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", padding: isMobile ? "14px 16px" : "20px 24px" }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".06em", marginBottom: 10 }}>DOLLAR</p>
            <p style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: "#2563eb" }}>{dollarVal !== 0 ? fmtUsd(dollarVal) : "$0,00"}</p>
          </div>
          <div style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", padding: isMobile ? "14px 16px" : "20px 24px" }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".06em", marginBottom: 10 }}>JAMI</p>
            {jamiSom !== 0 && <p style={{ fontSize: isMobile ? 15 : 18, fontWeight: 800 }}>{jamiSom.toLocaleString("ru-RU")} <span style={{ fontSize: 11, fontWeight: 600 }}>so&apos;m</span></p>}
            {jamiUsd !== 0 && <p style={{ fontSize: isMobile ? 15 : 18, fontWeight: 800, color: "#2563eb", marginTop: jamiSom !== 0 ? 4 : 0 }}>{fmtUsd(jamiUsd)}</p>}
            {jamiSom === 0 && jamiUsd === 0 && <p style={{ fontSize: isMobile ? 15 : 18, fontWeight: 800 }}>0</p>}
          </div>
        </div>

        {/* Info card */}
        <div style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)", flexWrap: "wrap", gap: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#2563eb" }}>To&apos;lov ma&apos;lumotlari</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#2563eb", background: "#eff6ff", padding: "4px 12px", borderRadius: "var(--radius)", border: "1px solid #bfdbfe" }}>
              Kurs: {kurs > 0 ? kurs.toLocaleString("ru-RU") : "0"}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#2563eb" }}>Akt sverka qilindimi?</span>
              <div style={{ display: "inline-flex", borderRadius: 20, overflow: "hidden", border: "1.5px solid var(--border)", opacity: toggling ? 0.5 : 1, pointerEvents: toggling ? "none" : "auto" }}>
                <button onClick={() => !isHa && toggleAkt()}
                  style={{ padding: "5px 14px", fontSize: 12, fontWeight: 700, border: "none", borderRight: "1.5px solid var(--border)", cursor: isHa ? "default" : "pointer", background: isHa ? "#16a34a" : "var(--white)", color: isHa ? "#fff" : "var(--text-3)" }}>Ha</button>
                <button onClick={() => isHa && toggleAkt()}
                  style={{ padding: "5px 14px", fontSize: 12, fontWeight: 700, border: "none", cursor: isHa ? "pointer" : "default", background: !isHa ? "#ef4444" : "var(--white)", color: !isHa ? "#fff" : "var(--text-3)" }}>Yo&apos;q</button>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr auto" : "48px 1fr 1fr 1fr 72px", padding: "10px 20px", background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
            {(isMobile ? ["MAYDON","QIYMAT"] : ["#","MAYDON","QIYMAT","JAMI",""]).map((h, hi) => (
              <span key={h || hi} style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".05em", textAlign: isMobile && hi === 1 ? "right" : "left" }}>{h}</span>
            ))}
          </div>

          {[
            { label: "Sana",           value: tolov.Sana || "—",                                              extra: tolov.Vaqt || "" },
            { label: "Valyuta",        value: tolov.Valyuta || "—",                                           extra: tolov.Turi || "" },
            { label: "So'm",           value: somVal !== 0 ? somVal.toLocaleString("ru-RU") : "0",             extra: "",  jami: jamiSom > 0 ? jamiSom.toLocaleString("ru-RU") + " so'm" : "0 so'm" },
            { label: "Dollar",         value: dollarVal !== 0 ? fmtUsd(dollarVal) : "$0,00",                   extra: "",  jami: jamiUsd > 0 ? fmtUsd(jamiUsd) : "$0,00", color: "#2563eb" as const },
            ...(agentNomi ? [{ label: "Agent", value: agentNomi, extra: "" }] : []),
            ...(sRaqam    ? [{ label: "Sotuv raqami", value: `#${sRaqam}`, extra: "", link: `/sotuv/${tolov.Sotuv_ID}` }] : []),
            ...(somVal > 0 ? [{ label: "Hisob (So'm)", value: gaznaNomi || "—", extra: "" }] : []),
            ...(dollarVal > 0 ? [{ label: "Hisob (Dollar)", value: gaznaDollarNomi || "—", extra: "", color: "#2563eb" as const }] : []),
            ...(tolov.Izoh ? [{ label: "Izoh", value: tolov.Izoh, extra: "" }] : []),
          ].map((row, i, arr) => (
            <div key={row.label} style={{
              display: "grid", gridTemplateColumns: isMobile ? "1fr auto" : "48px 1fr 1fr 1fr 72px",
              gap: isMobile ? 10 : 0,
              padding: "13px 20px", alignItems: "center",
              borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none",
            }}>
              {!isMobile && <span style={{ fontSize: 13, color: "var(--text-3)" }}>{i + 1}</span>}
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>{row.label}</span>
              <div
                onClick={(row as { link?: string }).link ? () => router.push((row as { link?: string }).link!) : undefined}
                style={{ minWidth: 0, ...((row as { link?: string }).link ? { cursor: "pointer" } : {}), ...(isMobile ? { textAlign: "right" } : {}) }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: (row as { link?: string }).link ? "var(--primary)" : (row.color || "var(--text)"), wordBreak: isMobile ? "break-word" : undefined }}>{row.value}</span>
                {row.extra && <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{row.extra}</p>}
                {isMobile && (row as { jami?: string }).jami && <p style={{ fontSize: 12, fontWeight: 800, color: row.color || "var(--text)", marginTop: 2 }}>{(row as { jami?: string }).jami}</p>}
              </div>
              {!isMobile && <span style={{ fontSize: 14, fontWeight: 800, color: row.color || "var(--text)" }}>{(row as { jami?: string }).jami || ""}</span>}
              {!isMobile && <span/>}
            </div>
          ))}
        </div>
      </div>

      {/* Edit Modal */}
      {editing && (
        <div style={modalOverlay} onClick={tryCloseEdit}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            {isMobile && <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--border)", margin: "12px auto 0" }}/>}
            <div style={{ display: "flex", alignItems: "center", padding: "18px 20px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ width: 32, flexShrink: 0 }}/>
              <h2 style={{ fontSize: 16, fontWeight: 800, flex: 1, textAlign: "center" }}>To&apos;lovni tahrirlash</h2>
              <button onClick={tryCloseEdit} style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 8, border: "1px solid var(--border)", background: "var(--white)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 6, textAlign: "center" }}>Sana</label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="date" value={editSana} onChange={e => setEditSana(e.target.value)}
                    style={{ flex: 1, width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 14, outline: "none", boxSizing: "border-box", textAlign: "center" }}/>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-3)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{liveTime}</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 8 }}>Valyuta</label>
                <div style={{ display: "flex", borderRadius: "var(--radius)", overflow: "hidden", border: "1.5px solid var(--border)" }}>
                  {(["Som","Dollar"] as const).map(v => (
                    <button key={v} onClick={() => setEditValyuta(v)}
                      style={{ flex: 1, padding: "10px", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", background: editValyuta === v ? (v === "Som" ? "var(--primary)" : "#2563eb") : "var(--white)", color: editValyuta === v ? "#fff" : "var(--text-3)", borderRight: v === "Som" ? "1.5px solid var(--border)" : "none" }}>
                      {v === "Som" ? "So'm" : "Dollar"}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 6 }}>So&apos;m</label>
                  <input value={editSom} onChange={e => setEditSom(e.target.value)} placeholder="0" inputMode="numeric"
                    style={{ width: "100%", padding: "10px 12px", border: "1.5px solid var(--primary)", borderRadius: "var(--radius)", fontSize: 14, fontWeight: 700, outline: "none", boxSizing: "border-box" }}/>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#2563eb", display: "block", marginBottom: 6 }}>Dollar</label>
                  <input value={editDollar} onChange={e => setEditDollar(e.target.value)} placeholder="0.00" inputMode="decimal"
                    style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #2563eb", borderRadius: "var(--radius)", fontSize: 14, fontWeight: 700, outline: "none", color: "#2563eb", boxSizing: "border-box" }}/>
                </div>
                <div style={{ gridColumn: isMobile ? "1 / -1" : undefined }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: num(editKurs) < 11000 ? "#ef4444" : "var(--text-2)", display: "block", marginBottom: 6 }}>
                    Dollar kursi <span style={{ color: "#ef4444" }}>*</span>
                    {num(editKurs) > 0 && num(editKurs) < 11000 && <span style={{ fontWeight: 400, marginLeft: 6 }}>min: 11 000</span>}
                  </label>
                  <input value={editKurs} onChange={e => setEditKurs(e.target.value)} placeholder="Masalan: 12800" inputMode="numeric"
                    style={{ width: "100%", padding: "10px 12px", border: `1.5px solid ${num(editKurs) < 11000 ? "#ef4444" : "var(--border)"}`, borderRadius: "var(--radius)", fontSize: 14, fontWeight: 600, outline: "none", boxSizing: "border-box", animation: kursShake ? "shake .4s ease" : "none" }}/>
                </div>
              </div>
              {editPreview > 0 && (
                <div style={{ padding: "10px 14px", background: editValyuta === "Som" ? "#f0fdf4" : "#eff6ff", borderRadius: "var(--radius)", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)" }}>Jami {editValyuta === "Som" ? "so'm" : "dollar"}:</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: editValyuta === "Som" ? "#16a34a" : "#2563eb" }}>
                    {editValyuta === "Som" ? editPreview.toLocaleString("ru-RU") + " so'm" : fmtUsd(editPreview)}
                  </span>
                </div>
              )}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 8 }}>To&apos;lov turi</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {TURI_LIST.map(t => (
                    <button key={t} onClick={() => setEditTuri(t)}
                      style={{ flex: 1, padding: "10px 8px", borderRadius: "var(--radius)", border: `1.5px solid ${editTuri === t ? "var(--primary)" : "var(--border)"}`, background: editTuri === t ? "#f0fdf4" : "var(--white)", fontSize: 13, fontWeight: 700, cursor: "pointer", color: editTuri === t ? "var(--primary)" : "var(--text-2)" }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 6 }}>Izoh</label>
                <input value={editIzoh} onChange={e => setEditIzoh(e.target.value)} placeholder="Ixtiyoriy..."
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 14, outline: "none", boxSizing: "border-box" }}/>
              </div>
              {num(editSom) > 0 && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 6 }}>Hisob (So&apos;m)</label>
                  <select value={editGazna} onChange={e => setEditGazna(e.target.value)} disabled={!isAdmin}
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 14, outline: "none", background: "var(--white)" }}>
                    <option value="">— Tanlang —</option>
                    {gaznaForUser(user, gaznalar).filter(g => g.Turi !== "Dollar").map(g => <option key={g.Gazna_ID} value={g.Gazna_ID}>{g.Nomi}</option>)}
                  </select>
                </div>
              )}
              {num(editDollar) > 0 && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#2563eb", display: "block", marginBottom: 6 }}>Hisob (Dollar)</label>
                  <select value={editGaznaDollar} onChange={e => setEditGaznaDollar(e.target.value)} disabled={!isAdmin}
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid #bfdbfe", borderRadius: "var(--radius)", fontSize: 14, outline: "none", background: "var(--white)" }}>
                    <option value="">— Tanlang —</option>
                    {gaznaForUser(user, gaznalar).filter(g => g.Turi === "Dollar").map(g => <option key={g.Gazna_ID} value={g.Gazna_ID}>{g.Nomi}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, padding: "16px 20px", borderTop: "1px solid var(--border)", paddingBottom: isMobile ? "max(16px, env(safe-area-inset-bottom))" : 16 }}>
              <button className="btn btn--outline" style={{ flex: 1 }} onClick={tryCloseEdit}>Bekor</button>
              <button className="btn btn--primary" style={{ flex: 2 }} onClick={handleSave} disabled={saving || num(editKurs) < 11000}>
                {saving && <span className="spinner"/>} Saqlash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(false)}>
          <div className="confirm" onClick={e => e.stopPropagation()}>
            <div className="confirm__icon">
              <svg width="24" height="24" fill="none" stroke="#ef4444" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </div>
            <h3 className="confirm__title">To&apos;lovni o&apos;chirish</h3>
            <p className="confirm__text"><strong>{mNomi} — {tolov.Sana}</strong> to&apos;lovi o&apos;chiriladi.</p>
            <div className="confirm__actions">
              <button className="btn btn--outline" style={{ flex: 1 }} onClick={() => setConfirmDelete(false)}>Bekor</button>
              <button className="btn btn--red" style={{ flex: 1 }} onClick={handleDelete} disabled={deleting}>
                {deleting && <span className="spinner"/>} O&apos;chirish
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
