"use client";
import { fetchSheet, afterWrite } from "@/lib/sheet-cache";
import { getCurrentKurs } from "@/lib/kurs";
import { useScrollLock } from "@/lib/use-scroll-lock";
import { usePersistedState } from "@/lib/usePersistedState";
import FabAdd from "@/components/FabAdd";
import LiveClock from "@/components/LiveClock";
import IzohSelect from "@/components/IzohSelect";
import { useIzohOptions } from "@/lib/useIzohOptions";
import { useAuth } from "@/lib/AuthContext";
import { gaznaForUser } from "@/lib/auth";
import { useEffect, useState, useCallback, useRef, useMemo, memo } from "react";
import { useRouter } from "next/navigation";

interface Gazna { Gazna_ID: string; Nomi: string; Turi: string; Shakli?: string; }

function GaznaButtons({ turi, shakli, value, onChange, disabled }: {
  turi: "Som" | "Dollar"; shakli?: string; value: string; onChange: (id: string) => void; disabled?: boolean;
}) {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Gazna[]>([]);
  const [fetching, setFetching] = useState(true);
  useEffect(() => {
    fetchSheet("Gazna")
      .then(res => { if (Array.isArray(res.data)) setAccounts(res.data.filter((g: Gazna) => g.Gazna_ID)); })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, []);
  const visible = gaznaForUser(user, accounts);
  const byTuri = turi === "Dollar" ? visible.filter(g => g.Turi === "Dollar") : visible.filter(g => g.Turi !== "Dollar");
  // Admin emas — faqat tanlangan gazna ko'rinadi (o'zgartirib bo'lmaydi)
  const shown = disabled ? byTuri.filter(g => g.Gazna_ID === value) : byTuri;
  const filtered = shakli ? shown.filter(g => !g.Shakli || g.Shakli === "Barchasi" || g.Shakli.toLowerCase() === shakli.toLowerCase()) : shown;
  const color = turi === "Dollar" ? "#2563eb" : "var(--primary)";
  const bg    = turi === "Dollar" ? "#eff6ff"  : "#f0fdf4";
  if (fetching) return <span style={{ fontSize: 13, color: "var(--text-3)" }}>Yuklanmoqda...</span>;
  if (filtered.length === 0) return null;
  return (
    <>
      {filtered.map(g => (
        <button key={g.Gazna_ID} type="button"
          onClick={disabled ? undefined : () => onChange(value === g.Gazna_ID ? "" : g.Gazna_ID)}
          style={{ flex: "1 1 auto", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px 8px", borderRadius: "var(--radius)",
            border: `1.5px solid ${value === g.Gazna_ID ? color : "var(--border)"}`,
            background: value === g.Gazna_ID ? bg : "var(--white)",
            fontSize: 13, fontWeight: 700, cursor: disabled ? "default" : "pointer",
            color: value === g.Gazna_ID ? "var(--text)" : "var(--text-2)" }}>
          <span style={{ display: "flex", color }}>{turiIcon(g.Shakli || g.Nomi)}</span>
          {g.Nomi}
          {value === g.Gazna_ID && <span style={{ position: "absolute", top: 7, right: 7, display: "flex" }}>{CHECK_ICON}</span>}
        </button>
      ))}
    </>
  );
}
interface STolov {
  Tolov_ID: string; Sotuv_ID: string; Mijoz_ID: string; Agent: string;
  Yil: string; Oy: string; Sana: string; Valyuta: string; Turi: string;
  Som: string; Dollar: string; Summa: string; Summa_dollar: string;
  Izoh: string; Dollar_Kursi: string; Vaqt: string; Check?: string;
  Gazna_ID?: string; Gazna_dollar_ID?: string;
}
interface Mijoz { Mijoz_ID: string; Ism: string; Telefon: string; Agent?: string; Boshlangich_Balans_som?: string; Boshlangich_Balans_dollar?: string; }
interface MijozBalans { Mijoz_ID: string; Qoldi_som: string; Qoldi_dollar: string; }
interface Foydalanuvchi { Foydalanuvchi_ID: string; Nomi: string; }
interface Sotuv { Sotuv_ID: string; Sotuv_Raqami: string; Mijoz_ID: string; Sana: string; Balans: string; Balans_dollar: string; Chek?: string; }

const OY_NOMLARI = ["Yanvar","Fevral","Mart","Aprel","May","Iyun","Iyul","Avgust","Sentabr","Oktabr","Noyabr","Dekabr"];
const TURI_LIST  = ["Naqd","Bank","Karta"];
const PAGE_SIZE  = 100;

function uid() { return Math.random().toString(36).slice(2, 10); }
function num(v: string|number|undefined) {
  return parseFloat(String(v||"0").replace(/\s/g,"").replace(",",".")) || 0;
}
function fmtUsd(v: number) {
  return "$" + v.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
// Valyuta inputlari uchun ichki ikonkalar
const SOM_ICON = (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/></svg>);
const USD_ICON = (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5.5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>);
const KURS_ICON = (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>);
function CurInput({ icon, iconColor, ...rest }: { icon: React.ReactNode; iconColor: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <span style={{ position: "absolute", left: 11, display: "flex", alignItems: "center", pointerEvents: "none", color: iconColor }}>{icon}</span>
      <input {...rest} style={{ ...(rest.style || {}), paddingLeft: 34 }} />
    </div>
  );
}
// To'lov turi / hisob ikonkalari
const NAQD_ICON  = (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/></svg>);
const BANK_ICON  = (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="21" x2="21" y2="21"/><path d="M3 10l9-6 9 6"/><line x1="5" y1="21" x2="5" y2="10"/><line x1="19" y1="21" x2="19" y2="10"/><line x1="10" y1="21" x2="10" y2="10"/><line x1="14" y1="21" x2="14" y2="10"/></svg>);
const KARTA_ICON = (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>);
const KASSA_ICON = (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>);
const CALC_ICON  = (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="8" y2="10"/><line x1="12" y1="10" x2="12" y2="10"/><line x1="16" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="16" y1="14" x2="16" y2="18"/><line x1="8" y1="18" x2="12" y2="18"/></svg>);
const SAVE_ICON  = (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>);
const CHECK_ICON = (<svg width="16" height="16" viewBox="0 0 24 24" fill="#2563eb" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" stroke="none"/><polyline points="8 12 11 15 16 9"/></svg>);
function turiIcon(t: string) {
  const s = (t || "").toLowerCase();
  if (s.includes("bank")) return BANK_ICON;
  if (s.includes("karta") || s.includes("card")) return KARTA_ICON;
  if (s.includes("kassa")) return KASSA_ICON;
  return NAQD_ICON;
}
function nowStr() {
  const d=new Date();
  const t=new Date(d.toLocaleString("en-US",{timeZone:"Asia/Tashkent"}));
  const pad=(n:number)=>String(n).padStart(2,"0");
  const dd=pad(t.getDate()),mm=pad(t.getMonth()+1),yy=String(t.getFullYear());
  const hh=pad(t.getHours()),mi=pad(t.getMinutes()),ss=pad(t.getSeconds());
  return { sana: `${dd}.${mm}.${yy}`, oy: String(t.getMonth()+1), yil: yy, vaqt: `${hh}:${mi}:${ss}` };
}
function isoToParts(iso:string){ const [y,m,d]=(iso||"").split("-"); return { sana: d+"."+m+"."+y, oy:String(parseInt(m||"1")), yil:y||"" }; }
function sanaToIso(sana:string){ const mm=(sana||"").match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/); return mm ? (mm[3]+"-"+mm[2].padStart(2,"0")+"-"+mm[1].padStart(2,"0")) : ""; }

function MultiSelect({ items, value, onChange, placeholder, fullWidth }: {
  items:{id:string;label:string}[]; value:string[]; onChange:(ids:string[])=>void; placeholder?:string; fullWidth?: boolean;
}) {
  const [open,setOpen] = useState(false); const [q,setQ] = useState(""); const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);
  const list = items.filter(i => i.label.toLowerCase().includes(q.toLowerCase()));
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id]);
  const label = value.length === 0 ? (placeholder || "Tanlang...") : value.length === 1 ? (items.find(i => i.id === value[0])?.label || "") : `${value.length} ta tanlangan`;
  return (
    <div ref={ref} style={{ position: "relative", minWidth: fullWidth ? undefined : 180, flex: fullWidth ? 1 : undefined }}>
      <div onClick={() => { setOpen(o => !o); setQ(""); }}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "var(--white)", border: "1px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", fontSize: 13, fontWeight: 600, color: value.length ? "var(--text)" : "var(--text-3)", gap: 8, whiteSpace: "nowrap" }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
        {value.length > 0 && (
          <span onClick={e => { e.stopPropagation(); onChange([]); }} style={{ display: "flex", alignItems: "center", color: "var(--text-3)", flexShrink: 0 }}>
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </span>
        )}
        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "var(--text-3)", transform: open ? "rotate(180deg)" : "none", transition: "transform .15s", flexShrink: 0 }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </div>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 200, minWidth: "100%", background: "var(--white)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", overflow: "hidden" }}>
          <div style={{ padding: "8px", borderBottom: "1px solid var(--border)" }}>
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Qidirish..."
              style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }}/>
          </div>
          <div style={{ maxHeight: 240, overflowY: "auto", overscrollBehavior: "contain" }} onTouchMove={e => e.stopPropagation()}>
            {list.length === 0 && <div style={{ padding: "12px 14px", fontSize: 13, color: "var(--text-3)" }}>Topilmadi</div>}
            {list.map(i => {
              const checked = value.includes(i.id);
              return (
                <div key={i.id} onClick={() => toggle(i.id)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", fontSize: 13, cursor: "pointer", background: checked ? "var(--bg)" : "transparent", fontWeight: checked ? 700 : 400 }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--bg)")}
                  onMouseLeave={e => (e.currentTarget.style.background = checked ? "var(--bg)" : "transparent")}>
                  <div style={{ width: 16, height: 16, borderRadius: 4, border: checked ? "none" : "1.5px solid var(--border)", background: checked ? "var(--primary)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {checked && <svg width="10" height="10" fill="none" stroke="#fff" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                  </div>
                  {i.label}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SearchSelect({ items, value, onChange, placeholder }: {
  items:{id:string;label:string}[]; value:string; onChange:(id:string)=>void; placeholder?:string;
}) {
  const [q,setQ] = useState(""); const [open,setOpen] = useState(false); const ref = useRef<HTMLDivElement>(null);
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
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "var(--text-3)", transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </div>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 300, background: "var(--white)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", overflow: "hidden" }}>
          <div style={{ padding: "8px", borderBottom: "1px solid var(--border)" }}>
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Qidirish..."
              style={{ width: "100%", padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, outline: "none" }}/>
          </div>
          <div style={{ maxHeight: 220, overflowY: "auto", overscrollBehavior: "contain" }} onTouchMove={e => e.stopPropagation()}>
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

interface TolovListProps {
  filtered: STolov[]; isMobile: boolean;
  mijozNameMap: Record<string,string>; sotuvRaqamMap: Record<string,string>;
  togglingId: string|null;
  onRowClick: (id: string) => void; onSotuvClick: (id: string) => void;
  onEdit: (t: STolov) => void; onDelete: (t: STolov) => void; onToggle: (t: STolov) => void;
}
const TolovList = memo(function TolovList({
  filtered, isMobile, mijozNameMap, sotuvRaqamMap, togglingId,
  onRowClick, onSotuvClick, onEdit, onDelete, onToggle,
}: TolovListProps) {
  if (isMobile) return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {filtered.map((t, idx) => {
        const mNomi = mijozNameMap[t.Mijoz_ID] || "—";
        const somVal = num(t.Som), dollarVal = num(t.Dollar);
        const jamiSom = num(t.Summa), jamiUsd = num(t.Summa_dollar);
        const sRaqam = t.Sotuv_ID ? sotuvRaqamMap[t.Sotuv_ID] : null;
        const isHa = t.Check === "True" || t.Check === "true";
        const showDate = idx === 0 || (!!filtered[idx-1] && filtered[idx-1].Sana !== t.Sana);
        return (
          <div key={t.Tolov_ID || idx}>
            {showDate && (
              <div style={{ padding: "7px 14px", background: "#eef2fb", borderTop: idx > 0 ? "1px solid var(--border)" : "none", borderBottom: "1px solid var(--border)", fontSize: 12, fontWeight: 800, color: "var(--primary)" }}>
                {t.Sana || "—"}
              </div>
            )}
            <div onClick={() => onRowClick(t.Tolov_ID)}
              style={{ padding: "14px", borderBottom: "1px solid var(--border)", background: isHa ? "#dcfce7" : "#fee2e2", cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 800, color: "#ef4444" }}>{mNomi}</p>
                {sRaqam && <p onClick={e=>{e.stopPropagation();onSotuvClick(t.Sotuv_ID);}} style={{ fontSize: 11, color: "var(--primary)", marginTop: 1, cursor: "pointer", fontWeight: 700 }}>Sotuv #{sRaqam} →</p>}
                <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{t.Sana || "—"} {t.Vaqt ? `· ${t.Vaqt}` : ""}</p>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0, marginLeft: 8 }}>
                <button onClick={e => { e.stopPropagation(); onEdit(t); }}
                  style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid #dbeafe", background: "#eff6ff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563eb" }}>
                  <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                </button>
                <button onClick={e => { e.stopPropagation(); onDelete(t); }}
                  style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid #fee2e2", background: "#fff1f2", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444" }}>
                  <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "#f1f5f9", color: "var(--text-2)" }}>{t.Turi || "—"}</span>
              {somVal !== 0 && <span style={{ fontSize: 13, fontWeight: 800, color: "#16a34a" }}>{somVal.toLocaleString("ru-RU")} so&apos;m</span>}
              {dollarVal !== 0 && <span style={{ fontSize: 13, fontWeight: 800, color: "#2563eb" }}>{fmtUsd(dollarVal)}</span>}
            </div>
            {(jamiSom !== 0 || jamiUsd !== 0) && (
              <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>Jami:</span>
                {jamiSom !== 0 && <span style={{ fontSize: 12, fontWeight: 700 }}>{jamiSom.toLocaleString("ru-RU")} so&apos;m</span>}
                {jamiUsd !== 0 && <span style={{ fontSize: 12, fontWeight: 700, color: "#2563eb" }}>{fmtUsd(jamiUsd)}</span>}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, gap: 8 }}>
              {t.Izoh ? <p style={{ fontSize: 12, color: "var(--text-2)", fontStyle: "italic", flex: 1 }}>{t.Izoh}</p> : <span/>}
              <div style={{ display: "inline-flex", borderRadius: 20, overflow: "hidden", border: "1.5px solid var(--border)", flexShrink: 0, opacity: togglingId === t.Tolov_ID ? 0.5 : 1, pointerEvents: togglingId === t.Tolov_ID ? "none" : "auto" }}>
                <button onClick={e => { e.stopPropagation(); if (!isHa) onToggle(t); }}
                  style={{ padding: "5px 12px", fontSize: 12, fontWeight: 700, border: "none", borderRight: "1.5px solid var(--border)", cursor: isHa ? "default" : "pointer", background: isHa ? "#16a34a" : "var(--white)", color: isHa ? "#fff" : "var(--text-3)" }}>Ha</button>
                <button onClick={e => { e.stopPropagation(); if (isHa) onToggle(t); }}
                  style={{ padding: "5px 12px", fontSize: 12, fontWeight: 700, border: "none", cursor: isHa ? "pointer" : "default", background: !isHa ? "#ef4444" : "var(--white)", color: !isHa ? "#fff" : "var(--text-3)" }}>Yo&apos;q</button>
              </div>
            </div>
            </div>
          </div>
        );
      })}
    </div>
  );
  return (
    <>
      {filtered.map((t, idx) => {
        const mNomi = mijozNameMap[t.Mijoz_ID] || "—";
        const somVal = num(t.Som), dollarVal = num(t.Dollar);
        const jamiUsd = num(t.Summa_dollar), jamiSom = num(t.Summa);
        const kurs = num(t.Dollar_Kursi);
        const sRaqam = t.Sotuv_ID ? sotuvRaqamMap[t.Sotuv_ID] : null;
        const isHa = t.Check === "True" || t.Check === "true";
        const rowBg = isHa ? "#dcfce7" : "#fee2e2";
        const rowHover = isHa ? "#bbf7d0" : "#fecaca";
        const showDate = idx === 0 || (!!filtered[idx-1] && filtered[idx-1].Sana !== t.Sana);
        return (
          <div key={t.Tolov_ID || idx}>
            {showDate && (
              <div style={{ padding: "7px 16px", background: "#eef2fb", borderTop: idx > 0 ? "1px solid var(--border)" : "none", borderBottom: "1px solid var(--border)", fontSize: 12, fontWeight: 800, color: "var(--primary)", letterSpacing: ".02em" }}>
                {t.Sana || "—"}
              </div>
            )}
            <div onClick={() => onRowClick(t.Tolov_ID)}
              style={{ display: "grid", gridTemplateColumns: "minmax(130px,1.3fr) 90px 110px 100px 90px 115px 115px minmax(70px,.8fr) 110px 64px", padding: "10px 16px", alignItems: "center", borderBottom: "1px solid var(--border)", background: rowBg, cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget.style.background = rowHover)}
              onMouseLeave={e => (e.currentTarget.style.background = rowBg)}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 800, color: "#ef4444", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{mNomi}</p>
              <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", marginTop: 1 }}>{t.Sana || "—"}{t.Vaqt ? ` · ${t.Vaqt}` : ""}</p>
            </div>
            <div onClick={e => { e.stopPropagation(); if (t.Sotuv_ID) onSotuvClick(t.Sotuv_ID); }}>
              {t.Sotuv_ID && sRaqam
                ? <span style={{ fontSize: 12, fontWeight: 700, color: "var(--primary)", cursor: "pointer", padding: "3px 8px", borderRadius: 6, background: "rgba(var(--primary-rgb),.08)", whiteSpace: "nowrap" }}>#{sRaqam}</span>
                : <span style={{ fontSize: 12, color: "var(--text-3)" }}>—</span>}
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: somVal ? "var(--text)" : "var(--text-3)" }}>{somVal ? somVal.toLocaleString("ru-RU") : "—"}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: dollarVal ? "#2563eb" : "var(--text-3)" }}>{dollarVal ? fmtUsd(dollarVal) : "—"}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: kurs ? "var(--text-2)" : "var(--text-3)" }}>{kurs ? kurs.toLocaleString("ru-RU") : "0"}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: jamiUsd ? "#2563eb" : "var(--text-3)" }}>{jamiUsd ? fmtUsd(jamiUsd) : "—"}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: jamiSom ? "var(--text)" : "var(--text-3)" }}>{jamiSom ? jamiSom.toLocaleString("ru-RU") : "—"}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.Izoh || "—"}</span>
            <div onClick={e => e.stopPropagation()} style={{ display: "inline-flex", borderRadius: 20, overflow: "hidden", border: "1.5px solid var(--border)", opacity: togglingId === t.Tolov_ID ? 0.5 : 1, pointerEvents: togglingId === t.Tolov_ID ? "none" : "auto" }}>
              <button onClick={() => !isHa && onToggle(t)}
                style={{ padding: "4px 10px", fontSize: 11, fontWeight: 700, border: "none", borderRight: "1.5px solid var(--border)", cursor: isHa ? "default" : "pointer", background: isHa ? "#16a34a" : "var(--white)", color: isHa ? "#fff" : "var(--text-3)" }}>Ha</button>
              <button onClick={() => isHa && onToggle(t)}
                style={{ padding: "4px 10px", fontSize: 11, fontWeight: 700, border: "none", cursor: isHa ? "pointer" : "default", background: !isHa ? "#ef4444" : "var(--white)", color: !isHa ? "#fff" : "var(--text-3)" }}>Yo&apos;q</button>
            </div>
            <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
              <button onClick={() => onEdit(t)}
                style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563eb" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#dbeafe")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              </button>
              <button onClick={() => onDelete(t)}
                style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#fee2e2")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
            </div>
            </div>
          </div>
        );
      })}
    </>
  );
});

export default function SotuvTolovPage() {
  const router = useRouter();
  const { user } = useAuth();
  // Admin emas (Sotuvchi/Omborchi/...) — faqat o'z agentiga tegishli ma'lumotni ko'radi
  const isSotuvchi = !!user && user.lavozim !== "Admin";
  const isAdmin = user?.lavozim === "Admin";
  const [tolovlar, setTolovlar]       = useState<STolov[]>([]);
  const [mijozlar, setMijozlar]       = useState<Mijoz[]>([]);
  const [balansMap, setBalansMap]     = useState<Record<string,MijozBalans>>({});
  const [savatSomTot, setSavatSomTot] = useState<Record<string,number>>({});
  const [savatDolTot, setSavatDolTot] = useState<Record<string,number>>({});
  const [agentMap, setAgentMap]       = useState<Record<string,string>>({});
  const [sotuvlar, setSotuvlar]       = useState<Sotuv[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string|null>(null);
  const [search, setSearch]           = usePersistedState("flt:sotuv-tolov:search", "");
  const [isMobile, setIsMobile]       = useState(false);

  const now = new Date();
  const [filterOy, setFilterOy]   = usePersistedState("flt:sotuv-tolov:filterOy", "");
  const [filterYil, setFilterYil] = usePersistedState("flt:sotuv-tolov:filterYil", String(now.getFullYear()));
  const [filterM, setFilterM]     = usePersistedState<string[]>("flt:sotuv-tolov:filterM", []);
  const [filterAgent, setFilterAgent] = usePersistedState<string[]>("flt:sotuv-tolov:filterAgent", []);
  const [filterTuri, setFilterTuri] = usePersistedState("flt:sotuv-tolov:filterTuri", "");
  const [filterSana, setFilterSana] = usePersistedState("flt:sotuv-tolov:filterSana", ""); // DD.MM.YYYY
  const [page, setPage]           = useState(0);

  const [togglingId, setTogglingId]     = useState<string|null>(null);
  const [deleteTarget, setDeleteTarget] = useState<STolov|null>(null);
  const [deleting, setDeleting]         = useState(false);
  const [editTarget, setEditTarget]     = useState<STolov|null>(null);
  const [editSaving, setEditSaving]     = useState(false);
  const [editSumma, setEditSumma]       = useState("");
  const [editDollar, setEditDollar]     = useState("");
  const [editKurs, setEditKurs]         = useState("");
  const [editTuri, setEditTuri]         = useState("Naqd");
  const [editSana, setEditSana]         = useState("");
  const [editVaqt, setEditVaqt]         = useState("");
  const [editValyuta, setEditValyuta]   = useState<"Som"|"Dollar">("Som");
  const [editIzohV, setEditIzohV]       = useState("");

  const [addOpen, setAddOpen]       = useState(false);
  useScrollLock(addOpen || !!editTarget || !!deleteTarget);
  const [saving, setSaving]         = useState(false);
  const [addMijoz, setAddMijoz]     = useState("");
  const [addSana, setAddSana]       = useState(()=>sanaToIso(nowStr().sana));  // default bugun YYYY-MM-DD
  const [addSotuvId, setAddSotuvId] = useState("");
  const [addValyuta, setAddValyuta] = useState<"Som"|"Dollar">("Som");
  const [addTuri, setAddTuri]       = useState("Naqd");
  const [addSumma, setAddSumma]     = useState("");
  const [addDollar, setAddDollar]   = useState("");
  const [addKurs, setAddKurs]       = useState("");
  const [centralKurs, setCentralKurs] = useState("");
  const [addIzoh, setAddIzoh]       = useState("");
  const [addGazna, setAddGazna]           = useState("");
  const [addGaznaDollar, setAddGaznaDollar] = useState("");
  const [editSotuvId, setEditSotuvId] = useState("");
  const [editGazna, setEditGazna]           = useState("");
  const [editGaznaDollar, setEditGaznaDollar] = useState("");
  const [gaznalar, setGaznalar]       = useState<Gazna[]>([]);
  const izohOpts = useIzohOptions("S_tolov");

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  useEffect(() => { getCurrentKurs().then(setCentralKurs).catch(() => {}); }, []);

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetchSheet("S_tolov"),
      fetchSheet("Mijozlar"),
      fetchSheet("MijozBalans"),
      fetchSheet("Foydalanuvchi"),
      fetchSheet("Sotuv"),
      fetchSheet("Gazna"),
      fetchSheet("Sotuv_Savat"),
      fetchSheet("Sotuv_Savat_Dollar"),
    ]).then(([tR, mR, bR, fR, sR, gzR, ssR, sdR]) => {
      if (tR.error) throw new Error(tR.error);
      const ssm: Record<string, number> = {};
      ((ssR.data||[]) as Record<string,string>[]).forEach(r=>{ const k=String(r.Sotuv_ID||"").trim(); if(k) ssm[k]=(ssm[k]||0)+num(r.Summa_som); });
      setSavatSomTot(ssm);
      const sdm: Record<string, number> = {};
      ((sdR.data||[]) as Record<string,string>[]).forEach(r=>{ const k=String(r.Sotuv_ID||"").trim(); if(k) sdm[k]=(sdm[k]||0)+num(r.Summa); });
      setSavatDolTot(sdm);
      const sorted = [...(tR.data as STolov[])].sort((a, b) => {
        const p = (s: string) => { const [d,mo,y] = (s||"").split(".").map(Number); return (y||0)*10000+(mo||0)*100+(d||0); };
        const t2s = (v: string) => { const [h,m,s] = (v||"").split(":").map(Number); return (h||0)*3600+(m||0)*60+(s||0); };
        const dd = p(b.Sana) - p(a.Sana);
        return dd !== 0 ? dd : t2s(b.Vaqt) - t2s(a.Vaqt);
      });
      setTolovlar(sorted);
      setMijozlar((mR.data || []) as Mijoz[]);
      const bm: Record<string,MijozBalans> = {};
      ((bR.data || []) as MijozBalans[]).forEach(b => { bm[b.Mijoz_ID] = b; });
      setBalansMap(bm);
      const am: Record<string,string> = {};
      ((fR.data || []) as Foydalanuvchi[]).forEach(f => { am[f.Foydalanuvchi_ID] = f.Nomi; });
      setAgentMap(am);
      setSotuvlar((sR.data || []) as Sotuv[]);
      setGaznalar(((gzR.data||[]) as Gazna[]).filter(g=>g.Gazna_ID));
    }).catch(e => setError(e instanceof Error ? e.message : "Xatolik"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  // Foydalanuvchi kirganda agent filtri o'ziga tanlanib qoladi (o'z to'lovlari darhol ko'rinadi)
  useEffect(() => { if (user?.id) setFilterAgent([user.id]); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchSheet("Gazna")
      .then(gzR => {
        if (Array.isArray(gzR.data)) {
          setGaznalar((gzR.data as Gazna[]).filter(g => g.Gazna_ID));
        }
      });
  }, []);

  const toggleAkt = useCallback(async (t: STolov) => {
    setTogglingId(t.Tolov_ID);
    const newVal = (t.Check === "True" || t.Check === "true") ? "False" : "True";
    await fetch("/api/sheets", { method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sheet: "S_tolov", idColumn: "Tolov_ID", idValue: t.Tolov_ID, row: { ...t, Check: newVal } }) });
    afterWrite("S_tolov");
    setTolovlar(p => p.map(r => r.Tolov_ID === t.Tolov_ID ? { ...r, Check: newVal } : r));
    setTogglingId(null);
  }, []);

  function autoSelectGazna(turi: string, gz: Gazna[], setSom: (id: string) => void, setDol: (id: string) => void) {
    // Admin emas — birinchi biriktirilgan gazna avtomatik; Admin — faqat bitta bo'lsa
    const somAccs = gz.filter(g => g.Turi !== "Dollar" && (!g.Shakli || g.Shakli === "Barchasi" || g.Shakli === turi));
    if (somAccs.length === 1 || (!isAdmin && somAccs.length > 0)) setSom(somAccs[0].Gazna_ID);
    const dolAccs = gz.filter(g => g.Turi === "Dollar" && (!g.Shakli || g.Shakli === "Barchasi" || g.Shakli === turi));
    if (dolAccs.length === 1 || (!isAdmin && dolAccs.length > 0)) setDol(dolAccs[0].Gazna_ID);
  }
  function selectAddTuri(turi: string) {
    setAddTuri(turi);
    setAddGazna(""); setAddGaznaDollar(""); // eski tanlovni tozalab, yangi turiga mosini avtomatik tanlaymiz
    if (gaznalar.length) autoSelectGazna(turi, gaznaForUser(user, gaznalar), setAddGazna, setAddGaznaDollar);
  }
  function selectEditTuri(turi: string) {
    setEditTuri(turi);
    if (gaznalar.length) autoSelectGazna(turi, gaznaForUser(user, gaznalar), setEditGazna, setEditGaznaDollar);
  }

  async function openAdd() {
    setAddMijoz(""); setAddSana(sanaToIso(nowStr().sana)); setAddSotuvId(""); setAddValyuta("Som"); setAddTuri("Naqd");
    setAddSumma(""); setAddDollar(""); setAddKurs(centralKurs || localStorage.getItem("dollar_kurs") || ""); setAddIzoh("");
    setAddGazna(""); setAddGaznaDollar("");
    setAddOpen(true);
    try {
      const gzR = await fetchSheet("Gazna");
      if (Array.isArray(gzR.data) && gzR.data.length > 0) {
        const gz = (gzR.data as Gazna[]).filter(g => g.Gazna_ID);
        setGaznalar(gz);
        autoSelectGazna("Naqd", gaznaForUser(user, gz), setAddGazna, setAddGaznaDollar);
      }
    } catch {}
  }

  async function handleSave() {
    if (!addMijoz) return;
    const somVal = num(addSumma), usdVal = num(addDollar);
    if (somVal === 0 && usdVal === 0) return;
    if (usdVal > 0 && num(addKurs) < 11000) return;      // Dollar bo'lsa kurs majburiy
    if (!addTuri) return;                                  // To'lov turi majburiy
    if (addValyuta === "Som" ? !addGazna : !addGaznaDollar) return; // Hisob majburiy
    setSaving(true);
    const { vaqt } = nowStr();
    const { sana, oy, yil } = addSana ? isoToParts(addSana) : nowStr();
    const kurs = num(addKurs);
    const isSom = addValyuta === "Som";
    const summa       = isSom ? String(somVal + usdVal * kurs) : "";
    const summaDollar = !isSom ? String(usdVal + (kurs > 0 ? somVal / kurs : 0)) : "";
    const valyuta     = isSom ? "So'm" : "Dollar";
    // Ostatka = to'lovdan oldingi qarz (MijozBalans)
    // Ostatka = to'lovdan oldingi qarz (formadagi QOLDIQ — xom ma'lumotdan hisoblangan, balansMap emas)
    const ostatkaSom = mijozQoldi ? mijozQoldi.som : 0;
    const ostatkaDollar = mijozQoldi ? mijozQoldi.usd : 0;
    try {
      const saveRes = await fetch("/api/sheets", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet: "S_tolov", row: {
          Tolov_ID: uid(), Sotuv_ID: addSotuvId, Mijoz_ID: addMijoz, Agent: user?.id || "",
          Yil: yil, Oy: oy, Sana: sana, Valyuta: valyuta, Turi: addTuri,
          Qarz_som: String(ostatkaSom), Qarz_dollar: String(ostatkaDollar),
          Som: String(somVal), Dollar: String(usdVal),
          Summa: summa, Summa_dollar: summaDollar,
          Dollar_Kursi: addKurs, Izoh: addIzoh, Vaqt: vaqt, Check: "False",
          Gazna_ID: addGazna, Gazna_dollar_ID: addGaznaDollar,
        } }) });
      // MUHIM: saqlanganini tasdiqlaymiz — aks holda xato bo'lsa to'lov jimgina yo'qoladi
      if (!saveRes.ok) { const je = await saveRes.json().catch(() => ({})); throw new Error(je.error || "Server bilan bog'lanishda xatolik"); }
      localStorage.setItem("dollar_kurs", addKurs);

      // Telegram bot xabari — sotuvga to'lov qilindi (ma'lumotlar S_tolov qatoridan)
      const nS = (v: number) => String(Math.round(v));
      const nU = (v: number) => String(Math.round(v * 100) / 100);
      const msg =
        `💲✅ Sotuvga to'lov qilindi\n\n` +
        `📅 Sana: ${sana}\n` +
        `👤 Mijoz: ${mijozNameMap[addMijoz] || "—"}\n` +
        `📅 Ostatka(So'm): ${nS(ostatkaSom)}\n` +
        `📅 Ostatka(Dollar): ${nU(ostatkaDollar)}\n` +
        `💵 So'm: ${somVal > 0 ? nS(somVal) : "null"}\n` +
        `💵 Dollar: ${usdVal > 0 ? nU(usdVal) : "null"}\n` +
        `💵 Jami so'm: ${nS(num(summa))}\n` +
        `💵 Jami dollar: ${nU(num(summaDollar))}\n` +
        `💵 Qoldiq (so'm): ${nS(ostatkaSom - num(summa))}\n` +
        `💵 Qoldiq ($): ${nU(ostatkaDollar - num(summaDollar))}\n` +
        `📌 Izoh: ${addIzoh && addIzoh.trim() ? addIzoh : "null"}`;
      // Klientning agenti bo'yicha yo'naltirish (o'z do'kon guruhiga)
      const tgAgent = mijozlar.find(m => String(m.Mijoz_ID || "").trim() === String(addMijoz).trim())?.Agent || "";
      fetch("/api/telegram", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: msg, agent: tgAgent }) }).catch(() => {});

      const qoldiA = balansMap[addMijoz];
      if (qoldiA) {
        try {
          await fetch("/api/sheets", { method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sheet: "MijozBalans", idColumn: "Mijoz_ID", idValue: addMijoz,
              row: { Qoldi_som: String(num(qoldiA.Qoldi_som) - somVal), Qoldi_dollar: String(num(qoldiA.Qoldi_dollar) - usdVal) } }) });
        } catch {}
      }
      afterWrite("S_tolov");
      afterWrite("MijozBalans");
      setAddOpen(false);
      setTimeout(() => loadData(), 800);
    } catch (e) {
      alert("To'lov saqlanmadi: " + (e instanceof Error ? e.message : "noma'lum") + ".\nInternet aloqasini tekshirib, qayta urinib ko'ring.");
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch("/api/sheets", { method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet: "S_tolov", idColumn: "Tolov_ID", idValue: deleteTarget.Tolov_ID }) });
      const qoldiD = balansMap[deleteTarget.Mijoz_ID];
      if (qoldiD) {
        try {
          await fetch("/api/sheets", { method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sheet: "MijozBalans", idColumn: "Mijoz_ID", idValue: deleteTarget.Mijoz_ID,
              row: { Qoldi_som: String(num(qoldiD.Qoldi_som) + num(deleteTarget.Som)), Qoldi_dollar: String(num(qoldiD.Qoldi_dollar) + num(deleteTarget.Dollar)) } }) });
        } catch {}
      }
      afterWrite("S_tolov");
      afterWrite("MijozBalans");
      setDeleteTarget(null);
      setTimeout(() => loadData(), 800);
    } finally { setDeleting(false); }
  }

  const openEdit = useCallback((t: STolov) => {
    setEditTarget(t);
    setEditSana(sanaToIso(t.Sana));
    setEditVaqt(t.Vaqt || "");
    setEditSotuvId(t.Sotuv_ID || "");
    setEditValyuta(t.Valyuta === "Dollar" ? "Dollar" : "Som");
    setEditSumma(t.Som || "");
    setEditDollar(t.Dollar || "");
    setEditKurs(t.Dollar_Kursi || "");
    setEditTuri(t.Turi || "Naqd");
    setEditIzohV(t.Izoh || "");
    setEditGazna(t.Gazna_ID || "");
    setEditGaznaDollar(t.Gazna_dollar_ID || "");
    setGaznalar(gz => {
      if (gz.length === 0) {
        fetchSheet("Gazna")
          .then(gzR => {
            if (Array.isArray(gzR.data) && gzR.data.length > 0)
              setGaznalar((gzR.data as Gazna[]).filter(g => g.Gazna_ID));
          }).catch(() => {});
      }
      return gz;
    });
  }, []);

  const handleRowClick   = useCallback((id: string) => router.push(`/sotuv/tolov/${id}`), [router]);
  const handleSotuvClick = useCallback((id: string) => router.push(`/sotuv/${id}`), [router]);

  async function handleEditSave() {
    if (!editTarget) return;
    if (num(editKurs) < 11000) return;
    setEditSaving(true);
    const somVal = num(editSumma), usdVal = num(editDollar), kurs = num(editKurs);
    const isSom = editValyuta === "Som";
    const summa       = isSom ? String(somVal + usdVal * kurs) : "";
    const summaDollar = !isSom ? String(usdVal + (kurs > 0 ? somVal / kurs : 0)) : "";
    const _sp = editSana ? isoToParts(editSana) : { sana: editTarget.Sana, oy: editTarget.Oy, yil: editTarget.Yil };
    try {
      await fetch("/api/sheets", { method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet: "S_tolov", idColumn: "Tolov_ID", idValue: editTarget.Tolov_ID,
          row: { ...editTarget, Sana: _sp.sana, Yil: _sp.yil, Oy: _sp.oy, Sotuv_ID: editSotuvId, Valyuta: isSom ? "So'm" : "Dollar", Turi: editTuri,
            Som: String(somVal), Dollar: String(usdVal),
            Summa: summa, Summa_dollar: summaDollar,
            Dollar_Kursi: editKurs, Izoh: editIzohV,
            Gazna_ID: editGazna, Gazna_dollar_ID: editGaznaDollar,
            Vaqt: editVaqt || editTarget.Vaqt,
          } }) });
      localStorage.setItem("dollar_kurs", editKurs);

      // Telegram bot xabari — sotuvga to'lov TAHRIRLANDI (o'zgargan summa)
      {
        const nS = (v: number) => String(Math.round(v));
        const nU = (v: number) => String(Math.round(v * 100) / 100);
        // Ostatka = tahrirlashdan oldingi REAL qarz (xom ma'lumotdan: boshlang'ich + jami sotuv
        // − shu to'lovdan boshqa barcha to'lovlar) — Qo'shish xabaridagi mijozQoldi bilan bir xil
        const em = mijozlar.find(m => m.Mijoz_ID === editTarget.Mijoz_ID);
        const eBSom = num(em?.Boshlangich_Balans_som);
        const eBUsd = num(em?.Boshlangich_Balans_dollar);
        let eXSom = 0, eXUsd = 0;
        sotuvlar.filter(s => s.Mijoz_ID === editTarget.Mijoz_ID && String(s.Chek || "").trim() !== "").forEach(s => {
          eXSom += savatSomTot[s.Sotuv_ID] || 0;
          eXUsd += savatDolTot[s.Sotuv_ID] || 0;
        });
        const eTSom = tolovlar.filter(t => t.Mijoz_ID === editTarget.Mijoz_ID && t.Tolov_ID !== editTarget.Tolov_ID).reduce((a, t) => a + (t.Valyuta !== "Dollar" ? num(t.Summa || t.Som) : 0), 0);
        const eTUsd = tolovlar.filter(t => t.Mijoz_ID === editTarget.Mijoz_ID && t.Tolov_ID !== editTarget.Tolov_ID).reduce((a, t) => a + (t.Valyuta === "Dollar" ? num(t.Summa_dollar || t.Dollar) : 0), 0);
        const ostatkaSom    = eBSom + eXSom - eTSom;
        const ostatkaDollar = eBUsd + eXUsd - eTUsd;
        const yangiQoldiSom = ostatkaSom - somVal;
        const yangiQoldiUsd = ostatkaDollar - usdVal;
        const msg =
          `✏️ Sotuvga to'lov tahrirlandi\n\n` +
          `📅 Sana: ${editTarget.Sana || ""}\n` +
          `👤 Mijoz: ${mijozNameMap[editTarget.Mijoz_ID] || "—"}\n` +
          `📅 Ostatka(So'm): ${nS(ostatkaSom)}\n` +
          `📅 Ostatka(Dollar): ${nU(ostatkaDollar)}\n` +
          `💵 So'm: ${somVal > 0 ? nS(somVal) : "null"}\n` +
          `💵 Dollar: ${usdVal > 0 ? nU(usdVal) : "null"}\n` +
          `💵 Jami so'm: ${nS(num(summa))}\n` +
          `💵 Jami dollar: ${nU(num(summaDollar))}\n` +
          `💵 Qoldiq (so'm): ${nS(yangiQoldiSom)}\n` +
          `💵 Qoldiq ($): ${nU(yangiQoldiUsd)}\n` +
          `📌 Izoh: ${editIzohV && editIzohV.trim() ? editIzohV : "null"}`;
        const tgAgentE = mijozlar.find(m => String(m.Mijoz_ID || "").trim() === String(editTarget.Mijoz_ID).trim())?.Agent || "";
        fetch("/api/telegram", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: msg, agent: tgAgentE }) }).catch(() => {});
      }

      const qoldiE = balansMap[editTarget.Mijoz_ID];
      if (qoldiE) {
        try {
          await fetch("/api/sheets", { method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sheet: "MijozBalans", idColumn: "Mijoz_ID", idValue: editTarget.Mijoz_ID,
              row: { Qoldi_som: String(num(qoldiE.Qoldi_som) + num(editTarget.Som) - somVal), Qoldi_dollar: String(num(qoldiE.Qoldi_dollar) + num(editTarget.Dollar) - usdVal) } }) });
        } catch {}
      }
      afterWrite("S_tolov");
      afterWrite("MijozBalans");
      setEditTarget(null);
      setTimeout(() => loadData(), 800);
    } finally { setEditSaving(false); }
  }

  // Sotuvchi faqat o'z mijozlarini ko'radi
  const mItems = useMemo(() => {
    const list = (isSotuvchi && user?.id)
      ? mijozlar.filter(m => (m.Agent||"").trim() === user.id)
      : mijozlar;
    return list.map(m => ({ id: m.Mijoz_ID, label: m.Ism }));
  }, [mijozlar, isSotuvchi, user]);
  // Admin uchun agent filtri variantlari
  const aItems = useMemo(() => Object.entries(agentMap).map(([id, label]) => ({ id, label })).filter(a => a.id && a.label), [agentMap]);

  function num2(v: string|number|undefined) { return parseFloat(String(v||"0").replace(/\s/g,"").replace(",",".")) || 0; }
  const editSotuvItems = useMemo(() => {
    if (!editTarget) return [];
    return sotuvlar.filter(s => s.Mijoz_ID === editTarget.Mijoz_ID).map(s => ({
      id: s.Sotuv_ID,
      label: `#${s.Sotuv_Raqami} — ${s.Sana}${num2(s.Balans)>0 ? " | "+num2(s.Balans).toLocaleString("ru-RU")+" so'm" : ""}${num2(s.Balans_dollar)>0 ? " | $"+num2(s.Balans_dollar).toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2}) : ""}`,
    }));
  }, [editTarget, sotuvlar]);

  const mijozNameMap  = useMemo(() => Object.fromEntries(mijozlar.map(m => [m.Mijoz_ID, m.Ism])), [mijozlar]);
  const sotuvRaqamMap = useMemo(() => Object.fromEntries(sotuvlar.map(s => [s.Sotuv_ID, s.Sotuv_Raqami])), [sotuvlar]);

  const filtered = useMemo(() => tolovlar.filter(t => {
    if (!t.Tolov_ID) return false;
    // Non-admin faqat o'z to'lovlarini ko'radi
    if (isSotuvchi && user?.id && t.Agent !== user.id) return false;
    // Sotuvchi FAQAT o'ziga biriktirilgan kassa(lar) to'lovlarini ko'radi (Gazna_ID / Gazna_dollar_ID)
    if (isSotuvchi && user?.gaznaIds && user.gaznaIds.length > 0
        && !user.gaznaIds.includes(String(t.Gazna_ID || "").trim())
        && !user.gaznaIds.includes(String(t.Gazna_dollar_ID || "").trim())) return false;
    // Admin: agent tanlanmaguncha to'lov ko'rsatilmaydi (agent tanlansa — o'shaniki)
    if (isAdmin && filterAgent.length === 0) return false;
    const matchAgent = filterAgent.length === 0 || filterAgent.includes(t.Agent);
    const matchOy  = !filterOy  || String(parseInt(t.Oy || "0")) === filterOy;
    const matchYil = !filterYil || t.Yil === filterYil;
    const matchM   = filterM.length === 0 || filterM.includes(t.Mijoz_ID);
    const matchTuri = !filterTuri || (t.Turi || "") === filterTuri;
    const matchSana = !filterSana || (t.Sana || "") === filterSana;
    const mNomi = mijozNameMap[t.Mijoz_ID] || "";
    const matchSearch = !search ||
      mNomi.toLowerCase().includes(search.toLowerCase()) ||
      (t.Sana || "").includes(search) ||
      (t.Turi || "").toLowerCase().includes(search.toLowerCase());
    return matchAgent && matchOy && matchYil && matchM && matchTuri && matchSana && matchSearch;
  }), [tolovlar, filterOy, filterYil, filterM, filterAgent, filterTuri, filterSana, mijozNameMap, search, isSotuvchi, isAdmin, user]);

  // Filtr uchun mavjud to'lov turlari
  const turilar = useMemo(() => Array.from(new Set(tolovlar.map(t => (t.Turi || "").trim()).filter(Boolean))).sort(), [tolovlar]);

  useEffect(() => setPage(0), [filterOy, filterYil, filterM, filterAgent, filterTuri, filterSana, search]);
  const paged = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page]);

  const totalSom     = useMemo(() => filtered.reduce((s, t) => s + (t.Valyuta !== "Dollar" ? num(t.Som) : 0), 0), [filtered]);
  const totalDollar  = useMemo(() => filtered.reduce((s, t) => s + num(t.Dollar), 0), [filtered]);
  const totalJamiUsd = useMemo(() => filtered.reduce((s, t) => s + num(t.Summa_dollar), 0), [filtered]);
  const totalJamiSom = useMemo(() => filtered.reduce((s, t) => s + num(t.Summa), 0), [filtered]);

  const years = useMemo(() => {
    const y = [...new Set(tolovlar.map(t => t.Yil).filter(Boolean))].sort((a, b) => Number(b) - Number(a));
    if (!y.includes(String(now.getFullYear()))) y.unshift(String(now.getFullYear()));
    return y;
  }, [tolovlar]);

  const selectedMijoz = useMemo(() => mijozlar.find(m => m.Mijoz_ID === addMijoz), [mijozlar, addMijoz]);
  const mijozQoldi = useMemo(() => {
    if (!selectedMijoz) return null;
    // Xom ma'lumotdan: boshlang'ich + jami sotuv - jami to'lov
    const bSom = num(selectedMijoz.Boshlangich_Balans_som);
    const bUsd = num(selectedMijoz.Boshlangich_Balans_dollar);
    let xSom = 0, xUsd = 0;
    sotuvlar.filter(s => s.Mijoz_ID === addMijoz && String(s.Chek||"").trim()!=="").forEach(s => {
      xSom += savatSomTot[s.Sotuv_ID] || 0;
      xUsd += savatDolTot[s.Sotuv_ID] || 0;
    });
    const tSom = tolovlar.filter(t => t.Mijoz_ID === addMijoz).reduce((a,t)=>a+(t.Valyuta!=="Dollar"?num(t.Summa||t.Som):0),0);
    const tUsd = tolovlar.filter(t => t.Mijoz_ID === addMijoz).reduce((a,t)=>a+(t.Valyuta==="Dollar"?num(t.Summa_dollar||t.Dollar):0),0);
    return { som: bSom + xSom - tSom, usd: bUsd + xUsd - tUsd };
  }, [selectedMijoz, addMijoz, sotuvlar, savatSomTot, savatDolTot, tolovlar]);

  const modalOverlay: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 50, background: "rgba(15,42,76,.42)", backdropFilter: "blur(4px)",
    display: "flex", alignItems: isMobile ? "flex-end" : "stretch", justifyContent: "center",
    padding: 0,
  };
  // Web'da to'liq ekran; mobilda pastki varaq
  const modalBox: React.CSSProperties = {
    background: "var(--white)", width: "100%", maxWidth: isMobile ? "100%" : "none",
    borderRadius: isMobile ? "20px 20px 0 0" : 0,
    display: "flex", flexDirection: "column",
    height: isMobile ? "auto" : "100dvh",
    maxHeight: isMobile ? "92dvh" : "100dvh",
  };
  // To'liq ekranda content markazda (kiritishlar cho'zilmasin) — body/footer'ga qo'shiladi
  const modalCenter: React.CSSProperties = isMobile ? {} : { width: "100%", maxWidth: 760, alignSelf: "center" };

  return (
    <>
      <header className="header">
        <div className="header__inner">
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <h1 className="header__title" style={{ paddingLeft: 4 }}>Pul ayirish</h1>
            <span style={{ fontSize: 11, color: "var(--text-3)", paddingLeft: 4 }}>Barcha to&apos;lovlar ro&apos;yxati</span>
          </div>
          <div className="header__spacer"/>
        </div>
      </header>

      {isMobile && <FabAdd onClick={openAdd} />}

      <div className="page-content">
        {loading && <div className="spinner--page"/>}
        {error && <div className="error-box"><p>{error}</p></div>}

        {!loading && !error && (
          <>
            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: isMobile ? 10 : 14, marginBottom: isMobile ? 16 : 24 }}>
              {[
                { label: "SO'M",       val: totalSom     ? totalSom.toLocaleString("ru-RU")  : "0",          color: "var(--text)" },
                { label: "DOLLAR",     val: totalDollar  ? fmtUsd(totalDollar)                : "$0.00",       color: "#2563eb" },
                { label: "JAMI ($)",   val: totalJamiUsd ? fmtUsd(totalJamiUsd)               : "$0.00",       color: "#2563eb" },
                { label: "JAMI (SO'M)",val: totalJamiSom ? totalJamiSom.toLocaleString("ru-RU"): "0",         color: "var(--text)" },
              ].map(s => (
                <div key={s.label} style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", padding: isMobile ? "14px 16px" : "20px 24px" }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".06em", marginBottom: 8 }}>{s.label}</p>
                  <p style={{ fontSize: isMobile ? 17 : 22, fontWeight: 800, lineHeight: 1, color: s.color }}>{s.val}</p>
                </div>
              ))}
            </div>

            <div style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)" }}>
              {isMobile ? (
                <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div className="search">
                    <span className="search__icon"><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg></span>
                    <input className="search__input" placeholder="Qidirish..." value={search} onChange={e => setSearch(e.target.value)}/>
                    {search && <button className="search__clear" onClick={() => setSearch("")}><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>}
                  </div>
                  <MultiSelect items={mItems} value={filterM} onChange={setFilterM} placeholder="Mijoz..." fullWidth/>
                  {isAdmin && <MultiSelect items={aItems} value={filterAgent} onChange={setFilterAgent} placeholder="Agent..." fullWidth/>}
                  <div style={{ display: "flex", gap: 8 }}>
                    <select value={filterOy} onChange={e => setFilterOy(e.target.value)}
                      style={{ flex: 1, padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, fontWeight: 600, background: "var(--white)", cursor: "pointer", outline: "none" }}>
                      <option value="">Barcha oylar</option>
                      {OY_NOMLARI.map((n, i) => <option key={i+1} value={String(i+1)}>{n}</option>)}
                    </select>
                    <select value={filterYil} onChange={e => setFilterYil(e.target.value)}
                      style={{ flex: 1, padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, fontWeight: 600, background: "var(--white)", cursor: "pointer", outline: "none" }}>
                      <option value="">Barcha yillar</option>
                      {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <select value={filterTuri} onChange={e => setFilterTuri(e.target.value)}
                      style={{ flex: 1, padding: "8px 10px", border: `1px solid ${filterTuri?"var(--primary)":"var(--border)"}`, borderRadius: "var(--radius)", fontSize: 13, fontWeight: 600, background: "var(--white)", cursor: "pointer", outline: "none" }}>
                      <option value="">Barcha turlar</option>
                      {turilar.map(tr => <option key={tr} value={tr}>{tr}</option>)}
                    </select>
                    <input type="date" value={filterSana ? filterSana.split(".").reverse().join("-") : ""} onChange={e => setFilterSana(e.target.value ? e.target.value.split("-").reverse().join(".") : "")}
                      style={{ flex: 1, padding: "7px 10px", border: `1px solid ${filterSana?"var(--primary)":"var(--border)"}`, borderRadius: "var(--radius)", fontSize: 13, fontWeight: 600, background: "var(--white)", outline: "none" }}/>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>Jami: {filtered.length} ta to&apos;lov</div>
                </div>
              ) : (
                <div style={{ position: "sticky", top: 56, zIndex: 10, background: "var(--white)", borderRadius: "var(--radius-xl) var(--radius-xl) 0 0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", padding: "0 14px", height: 36, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap" }}>
                      Jami to&apos;lovlar: {filtered.length} ta
                    </div>
                    <select value={filterYil} onChange={e => setFilterYil(e.target.value)}
                      style={{ width: "auto", padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, fontWeight: 600, background: "var(--white)", cursor: "pointer", outline: "none" }}>
                      <option value="">Barcha yillar</option>
                      {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select value={filterOy} onChange={e => setFilterOy(e.target.value)}
                      style={{ width: "auto", padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, fontWeight: 600, background: "var(--white)", cursor: "pointer", outline: "none" }}>
                      <option value="">Barcha oylar</option>
                      {OY_NOMLARI.map((n, i) => <option key={i+1} value={String(i+1)}>{n}</option>)}
                    </select>
                    <div className="search" style={{ maxWidth: 220 }}>
                      <span className="search__icon"><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg></span>
                      <input className="search__input" placeholder="Qidirish..." value={search} onChange={e => setSearch(e.target.value)}/>
                      {search && <button className="search__clear" onClick={() => setSearch("")}><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>}
                    </div>
                    <MultiSelect items={mItems} value={filterM} onChange={setFilterM} placeholder="Mijoz..."/>
                    {isAdmin && <MultiSelect items={aItems} value={filterAgent} onChange={setFilterAgent} placeholder="Agent..."/>}
                    <select value={filterTuri} onChange={e => setFilterTuri(e.target.value)}
                      style={{ width: "auto", padding: "8px 12px", border: `1px solid ${filterTuri?"var(--primary)":"var(--border)"}`, borderRadius: "var(--radius)", fontSize: 13, fontWeight: 600, background: "var(--white)", cursor: "pointer", outline: "none" }}>
                      <option value="">Barcha turlar</option>
                      {turilar.map(tr => <option key={tr} value={tr}>{tr}</option>)}
                    </select>
                    <input type="date" value={filterSana ? filterSana.split(".").reverse().join("-") : ""} onChange={e => setFilterSana(e.target.value ? e.target.value.split("-").reverse().join(".") : "")}
                      style={{ padding: "7px 10px", border: `1px solid ${filterSana?"var(--primary)":"var(--border)"}`, borderRadius: "var(--radius)", fontSize: 13, fontWeight: 600, background: "var(--white)", cursor: "pointer", outline: "none" }}/>
                    {filterSana && <button onClick={() => setFilterSana("")} style={{ padding: "7px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--white)", cursor: "pointer", fontSize: 12, color: "var(--text-3)" }}>Sana ✕</button>}
                    <span style={{ flex: 1 }}/>
                    <button className="btn btn--primary" onClick={openAdd}>
                      <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                      Yangi to&apos;lov
                    </button>
                  </div>
                  {/* Totals row */}
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(130px,1.3fr) 90px 110px 100px 90px 115px 115px minmax(70px,.8fr) 110px 64px", padding: "10px 16px", borderBottom: "1px solid var(--border)", background: "#f8fafc" }}>
                    <span/><span/>
                    <span style={{ fontSize: 16, fontWeight: 800, color: "#16a34a" }}>{totalSom ? totalSom.toLocaleString("ru-RU") : "—"}</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: "#2563eb" }}>{totalDollar ? fmtUsd(totalDollar) : "—"}</span>
                    <span/>
                    <span style={{ fontSize: 16, fontWeight: 800, color: "#2563eb" }}>{totalJamiUsd ? fmtUsd(totalJamiUsd) : "—"}</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: "#16a34a" }}>{totalJamiSom ? totalJamiSom.toLocaleString("ru-RU") : "—"}</span>
                    <span/><span/><span/>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(130px,1.3fr) 90px 110px 100px 90px 115px 115px minmax(70px,.8fr) 110px 64px", padding: "8px 16px", background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
                    {["MIJOZ","SOTUV","SO'M","DOLLAR","DOLLAR KURSI","JAMI ($)","JAMI (SO'M)","IZOH","AKT SVERKA",""].map(h => (
                      <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "var(--text)", letterSpacing: ".05em" }}>{h}</span>
                    ))}
                  </div>
                </div>
              )}

              {filtered.length === 0 && (
                <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
                  To&apos;lov topilmadi
                </div>
              )}

              <TolovList
                filtered={paged}
                isMobile={isMobile}
                mijozNameMap={mijozNameMap}
                sotuvRaqamMap={sotuvRaqamMap}
                togglingId={togglingId}
                onRowClick={handleRowClick}
                onSotuvClick={handleSotuvClick}
                onEdit={openEdit}
                onDelete={setDeleteTarget}
                onToggle={toggleAkt}
              />
              {filtered.length > PAGE_SIZE && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "14px 20px", borderTop: "1px solid var(--border)" }}>
                  <button onClick={() => setPage(p => p - 1)} disabled={page === 0}
                    style={{ padding: "7px 16px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: page === 0 ? "var(--bg)" : "var(--white)", cursor: page === 0 ? "default" : "pointer", fontSize: 13, fontWeight: 700, color: page === 0 ? "var(--text-3)" : "var(--text)" }}>← Oldingi</button>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>{page + 1} / {Math.ceil(filtered.length / PAGE_SIZE)}</span>
                  <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * PAGE_SIZE >= filtered.length}
                    style={{ padding: "7px 16px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: (page + 1) * PAGE_SIZE >= filtered.length ? "var(--bg)" : "var(--white)", cursor: (page + 1) * PAGE_SIZE >= filtered.length ? "default" : "pointer", fontSize: 13, fontWeight: 700, color: (page + 1) * PAGE_SIZE >= filtered.length ? "var(--text-3)" : "var(--text)" }}>Keyingi →</button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Edit Modal */}
      {editTarget && (
        <div style={modalOverlay} onClick={() => setEditTarget(null)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            {isMobile && <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--border)", margin: "12px auto 0" }}/>}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 20px", borderBottom: "1px solid var(--border)" }}>
              <h2 style={{ fontSize: 16, fontWeight: 800 }}>To&apos;lovni tahrirlash</h2>
              <span style={{ flex: 1 }}/>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textAlign: "center" }}>Sana</span>
                <input type="date" value={editSana} onChange={e => setEditSana(e.target.value)} style={{ fontSize: 12, fontWeight: 600, padding: "6px 8px", border: "1px solid var(--border)", borderRadius: "var(--radius)", outline: "none", textAlign: "center" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textAlign: "center" }}>Vaqt</span>
                <input type="time" step="1" value={editVaqt} onChange={e => setEditVaqt(e.target.value)} style={{ fontSize: 12, fontWeight: 600, padding: "6px 8px", border: "1px solid var(--border)", borderRadius: "var(--radius)", outline: "none", textAlign: "center", color: "var(--text-3)" }} />
              </div>
              <button onClick={() => setEditTarget(null)} style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 8, border: "1px solid var(--border)", background: "var(--white)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 14, overflowY: "auto", flex: isMobile ? undefined : 1, ...modalCenter }}>
              {/* Sotuv bog'lash */}
              {editSotuvItems.length > 0 && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>Sotuv (ixtiyoriy)</label>
                    {editSotuvId && <button onClick={()=>setEditSotuvId("")} style={{ fontSize: 11, color: "#ef4444", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Tozalash</button>}
                  </div>
                  <SearchSelect items={editSotuvItems} value={editSotuvId} onChange={setEditSotuvId} placeholder="Sotuv tanlang..."/>
                </div>
              )}
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
                  <CurInput icon={SOM_ICON} iconColor="var(--primary)" value={editSumma} onChange={e => setEditSumma((e.target.value.includes("-")?"-":"")+e.target.value.replace(/\D/g,""))} placeholder="0" type="number"
                    style={{ width: "100%", padding: "10px 12px", border: "1.5px solid var(--primary)", borderRadius: "var(--radius)", fontSize: 14, fontWeight: 700, outline: "none", boxSizing: "border-box" }}/>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#2563eb", display: "block", marginBottom: 6 }}>Dollar</label>
                  <CurInput icon={USD_ICON} iconColor="#2563eb" value={editDollar} onChange={e => setEditDollar((e.target.value.includes("-")?"-":"")+e.target.value.replace(/[^\d.]/g,"").replace(/(\..*)\./g,"$1"))} placeholder="0.00" type="number"
                    style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #2563eb", borderRadius: "var(--radius)", fontSize: 14, fontWeight: 700, outline: "none", color: "#2563eb", boxSizing: "border-box" }}/>
                </div>
                <div style={{ gridColumn: isMobile ? "1 / -1" : undefined }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: num(editKurs) < 11000 ? "#ef4444" : "var(--text-2)", display: "block", marginBottom: 6 }}>Dollar kursi <span style={{ color: "#ef4444" }}>*</span></label>
                  <CurInput icon={KURS_ICON} iconColor="#16a34a" value={editKurs} onChange={e => setEditKurs(e.target.value.replace(/\D/g,""))} placeholder="Min: 11 000" inputMode="numeric"
                    style={{ width: "100%", padding: "10px 12px", border: `1.5px solid ${num(editKurs) < 11000 ? "#ef4444" : "var(--border)"}`, borderRadius: "var(--radius)", fontSize: 14, fontWeight: 600, outline: "none", boxSizing: "border-box" }}/>
                </div>
              </div>
              {(() => {
                const s = num(editSumma), d = num(editDollar), k = num(editKurs);
                const res = editValyuta === "Som" ? s + d * k : d + (k > 0 ? s / k : 0);
                return res !== 0 ? (
                  <div style={{ padding: "10px 14px", background: editValyuta === "Som" ? "#f0fdf4" : "#eff6ff", borderRadius: "var(--radius)", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)" }}>Jami {editValyuta === "Som" ? "so'm" : "dollar"}:</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: editValyuta === "Som" ? "#16a34a" : "#2563eb" }}>
                      {editValyuta === "Som" ? res.toLocaleString("ru-RU") + " so'm" : fmtUsd(res)}
                    </span>
                  </div>
                ) : null;
              })()}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 6 }}>To&apos;lov turi</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {TURI_LIST.map(t => (
                    <button key={t} onClick={() => selectEditTuri(t)}
                      style={{ flex: 1, padding: "10px 8px", borderRadius: "var(--radius)", border: `1.5px solid ${editTuri === t ? "var(--primary)" : "var(--border)"}`, background: editTuri === t ? "#f0fdf4" : "var(--white)", fontSize: 13, fontWeight: 700, cursor: "pointer", color: editTuri === t ? "var(--primary)" : "var(--text-2)" }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              {editValyuta !== "Dollar" && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 8 }}>Hisob (So&apos;m)</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <GaznaButtons turi="Som" shakli={editTuri} value={editGazna} onChange={setEditGazna} disabled={!isAdmin} />
                </div>
              </div>
              )}
              {editValyuta !== "Som" && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#2563eb", display: "block", marginBottom: 8 }}>Hisob (Dollar)</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <GaznaButtons turi="Dollar" shakli={editTuri} value={editGaznaDollar} onChange={setEditGaznaDollar} disabled={!isAdmin} />
                </div>
              </div>
              )}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 6 }}>Izoh</label>
                <IzohSelect value={editIzohV} onChange={v => setEditIzohV(v)} options={izohOpts} placeholder="Ixtiyoriy..."
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 14, outline: "none", boxSizing: "border-box" }}/>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, padding: "16px 20px", borderTop: "1px solid var(--border)", paddingBottom: isMobile ? "max(16px, env(safe-area-inset-bottom))" : 16, ...modalCenter, boxSizing: "border-box" }}>
              <button className="btn btn--outline" style={{ flex: 1 }} onClick={() => setEditTarget(null)}>Bekor</button>
              <button className="btn btn--primary" style={{ flex: 2 }} onClick={handleEditSave} disabled={editSaving || num(editKurs) < 11000}>
                {editSaving && <span className="spinner"/>} Saqlash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="confirm" onClick={e => e.stopPropagation()}>
            <div className="confirm__icon"><svg width="24" height="24" fill="none" stroke="#ef4444" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></div>
            <h3 className="confirm__title">To&apos;lovni o&apos;chirish</h3>
            <p className="confirm__text"><strong>{deleteTarget.Sana} — {deleteTarget.Turi}</strong> to&apos;lovi o&apos;chiriladi.</p>
            <div className="confirm__actions">
              <button className="btn btn--outline" style={{ flex: 1 }} onClick={() => setDeleteTarget(null)}>Bekor</button>
              <button className="btn btn--red" style={{ flex: 1 }} onClick={handleDelete} disabled={deleting}>
                {deleting && <span className="spinner"/>} O&apos;chirish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {addOpen && (
        <div style={modalOverlay} onClick={() => setAddOpen(false)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            {isMobile && <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--border)", margin: "12px auto 0" }}/>}
            <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="18" height="18" fill="none" stroke="#16a34a" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z"/></svg>
              </div>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 800 }}>Yangi to&apos;lov</h2>
                <p style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500, marginTop: 1 }}>To&apos;lov ma&apos;lumotlarini kiriting va saqlang</p>
              </div>
              <span style={{ flex: 1 }}/>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textAlign: "center" }}>Sana</span>
                <input type="date" value={addSana} onChange={e => setAddSana(e.target.value)} style={{ fontSize: 12, fontWeight: 600, padding: "6px 8px", border: "1px solid var(--border)", borderRadius: "var(--radius)", outline: "none", textAlign: "center" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textAlign: "center" }}>Vaqt</span>
                <LiveClock style={{ color: "var(--text-3)" }} />
              </div>
              <button onClick={() => setAddOpen(false)} style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid var(--border)", background: "var(--white)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14, overflowY: "auto", flex: isMobile ? undefined : 1, ...modalCenter }}>
              {/* Mijoz + QOLDIQ (yonma-yon) */}
              <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 6 }}>Mijoz *</label>
                  <SearchSelect items={mItems} value={addMijoz} onChange={v=>{setAddMijoz(v);setAddSotuvId("");}} placeholder="Mijoz tanlang..."/>
                </div>
                {mijozQoldi && (
                  <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "8px 14px", background: "var(--bg)", minWidth: 170, display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".04em" }}>Qoldiq</span>
                      <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                        {mijozQoldi.som === 0 && mijozQoldi.usd === 0
                          ? <span style={{ fontSize: 15, fontWeight: 800, color: "#16a34a" }}>0</span>
                          : <>
                              {mijozQoldi.som !== 0 && <span style={{ fontSize: 15, fontWeight: 800, color: mijozQoldi.som > 0 ? "#ef4444" : "#16a34a" }}>{mijozQoldi.som.toLocaleString("ru-RU")} so&apos;m</span>}
                              {mijozQoldi.usd !== 0 && <span style={{ fontSize: 13, fontWeight: 700, color: mijozQoldi.usd > 0 ? "#ef4444" : "#16a34a" }}>≈ {fmtUsd(mijozQoldi.usd)}</span>}
                            </>}
                      </div>
                    </div>
                    <span style={{ width: 34, height: 34, borderRadius: 9, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563eb", flexShrink: 0 }}>{KARTA_ICON}</span>
                  </div>
                )}
              </div>
              {/* Valyuta */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 8 }}>Valyuta</label>
                <div style={{ display: "flex", borderRadius: "var(--radius)", overflow: "hidden", border: "1.5px solid var(--border)" }}>
                  {(["Som","Dollar"] as const).map(v => (
                    <button key={v} onClick={() => {
                      setAddValyuta(v);
                      if (v === "Som") {
                        const acc = gaznaForUser(user, gaznalar).filter(g => g.Turi !== "Dollar");
                        if (acc.length === 1 || (!isAdmin && acc.length > 0)) setAddGazna(acc[0].Gazna_ID);
                        setAddGaznaDollar("");
                      } else {
                        const acc = gaznaForUser(user, gaznalar).filter(g => g.Turi === "Dollar");
                        if (acc.length === 1 || (!isAdmin && acc.length > 0)) setAddGaznaDollar(acc[0].Gazna_ID);
                        setAddGazna("");
                      }
                    }}
                      style={{ flex: 1, padding: "10px", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", background: addValyuta === v ? (v === "Som" ? "var(--primary)" : "#2563eb") : "var(--white)", color: addValyuta === v ? "#fff" : "var(--text-3)", borderRight: v === "Som" ? "1.5px solid var(--border)" : "none" }}>
                      {v === "Som" ? "So'm" : "Dollar"}
                    </button>
                  ))}
                </div>
              </div>
              {/* Inputs */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 6 }}>So&apos;m</label>
                  <CurInput icon={SOM_ICON} iconColor="var(--primary)" value={addSumma} onChange={e => setAddSumma((e.target.value.includes("-")?"-":"")+e.target.value.replace(/\D/g,""))} placeholder="0" type="number"
                    style={{ width: "100%", padding: "10px 12px", border: "1.5px solid var(--primary)", borderRadius: "var(--radius)", fontSize: 14, fontWeight: 700, outline: "none", boxSizing: "border-box" }}/>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#2563eb", display: "block", marginBottom: 6 }}>Dollar</label>
                  <CurInput icon={USD_ICON} iconColor="#2563eb" value={addDollar} onChange={e => setAddDollar((e.target.value.includes("-")?"-":"")+e.target.value.replace(/[^\d.]/g,"").replace(/(\..*)\./g,"$1"))} placeholder="0.00" type="number"
                    style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #2563eb", borderRadius: "var(--radius)", fontSize: 14, fontWeight: 700, outline: "none", color: "#2563eb", boxSizing: "border-box" }}/>
                </div>
                <div style={{ gridColumn: isMobile ? "1 / -1" : undefined }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: (num(addDollar) > 0 && num(addKurs) < 11000) ? "#ef4444" : "var(--text-2)", display: "block", marginBottom: 6 }}>Dollar kursi {num(addDollar) > 0 && <span style={{ color: "#ef4444" }}>*</span>}{num(addDollar) > 0 && num(addKurs) > 0 && num(addKurs) < 11000 && <span style={{ fontWeight: 400, marginLeft: 6 }}>min: 11 000</span>}</label>
                  <CurInput icon={KURS_ICON} iconColor="#16a34a" value={addKurs} onChange={e => setAddKurs(e.target.value.replace(/\D/g,""))} placeholder="Min: 11 000" inputMode="numeric"
                    style={{ width: "100%", padding: "10px 12px", border: `1.5px solid ${(num(addDollar) > 0 && num(addKurs) < 11000) ? "#ef4444" : "var(--border)"}`, borderRadius: "var(--radius)", fontSize: 14, fontWeight: 600, outline: "none", boxSizing: "border-box" }}/>
                </div>
              </div>
              {/* Jami to'lov + To'lovdan keyingi qoldiq (yonma-yon) */}
              {(() => {
                const s = num(addSumma), d = num(addDollar), k = num(addKurs);
                const isSom = addValyuta === "Som";
                const res = isSom ? s + d * k : d + (k > 0 ? s / k : 0);
                if (res === 0) return null;   // manfiy (ayirish/tuzatish) to'lovda ham ko'rsatamiz
                const paidSom = isSom ? s + d * k : 0;
                const paidUsd = !isSom ? d + (k > 0 ? s / k : 0) : 0;
                return (
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ flex: "1 1 200px", display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: isSom ? "#f0fdf4" : "#eff6ff", borderRadius: "var(--radius)" }}>
                      <span style={{ width: 34, height: 34, borderRadius: 9, background: "var(--white)", display: "flex", alignItems: "center", justifyContent: "center", color: isSom ? "#16a34a" : "#2563eb", flexShrink: 0 }}>{KASSA_ICON}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)" }}>Jami to&apos;lov</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: isSom ? "#16a34a" : "#2563eb" }}>{isSom ? res.toLocaleString("ru-RU") + " so'm" : fmtUsd(res)}</div>
                      </div>
                    </div>
                    {mijozQoldi && (() => {
                      const afterSom = mijozQoldi.som - paidSom;
                      const afterUsd = mijozQoldi.usd - paidUsd;
                      return (
                        <div style={{ flex: "1 1 200px", display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "#f8fafc", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
                          <span style={{ width: 34, height: 34, borderRadius: 9, background: "var(--white)", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563eb", flexShrink: 0 }}>{CALC_ICON}</span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)" }}>To&apos;lovdan keyingi qoldiq</div>
                            <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                              {(afterSom !== 0 || afterUsd === 0) && <span style={{ fontSize: 15, fontWeight: 800, color: afterSom > 0 ? "#ef4444" : "#16a34a" }}>{afterSom.toLocaleString("ru-RU")} so&apos;m</span>}
                              {afterUsd !== 0 && <span style={{ fontSize: 13, fontWeight: 700, color: afterUsd > 0 ? "#ef4444" : "#16a34a" }}>≈ {fmtUsd(afterUsd)}</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}
              {/* Turi */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 8 }}>To&apos;lov turi</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {TURI_LIST.map(t => {
                    const active = addTuri === t;
                    return (
                    <button key={t} onClick={() => selectAddTuri(t)}
                      style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px 8px", borderRadius: "var(--radius)", border: `1.5px solid ${active ? "#2563eb" : "var(--border)"}`, background: active ? "#eff6ff" : "var(--white)", fontSize: 13, fontWeight: 700, cursor: "pointer", color: active ? "var(--text)" : "var(--text-2)" }}>
                      <span style={{ display: "flex", color: t === "Naqd" ? "#16a34a" : t === "Bank" ? "#64748b" : "#7c3aed" }}>{turiIcon(t)}</span>
                      {t}
                      {active && <span style={{ position: "absolute", top: 7, right: 7, display: "flex" }}>{CHECK_ICON}</span>}
                    </button>
                  );})}
                </div>
              </div>
              {addValyuta !== "Dollar" && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: !addGazna ? "#ef4444" : "var(--text-2)", display: "block", marginBottom: 8 }}>Hisob (So&apos;m) <span style={{ color: "#ef4444" }}>*</span></label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <GaznaButtons turi="Som" shakli={addTuri} value={addGazna} onChange={setAddGazna} disabled={!isAdmin} />
                </div>
                {!addGazna && <p style={{ fontSize: 11, fontWeight: 600, color: "#ef4444", marginTop: 6 }}>Hisob tanlang</p>}
              </div>
              )}
              {addValyuta !== "Som" && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: !addGaznaDollar ? "#ef4444" : "#2563eb", display: "block", marginBottom: 8 }}>Hisob (Dollar) <span style={{ color: "#ef4444" }}>*</span></label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <GaznaButtons turi="Dollar" shakli={addTuri} value={addGaznaDollar} onChange={setAddGaznaDollar} disabled={!isAdmin} />
                </div>
                {!addGaznaDollar && <p style={{ fontSize: 11, fontWeight: 600, color: "#ef4444", marginTop: 6 }}>Hisob tanlang</p>}
              </div>
              )}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 6 }}>Izoh</label>
                <div style={{ position: "relative" }}>
                  <IzohSelect value={addIzoh} onChange={v => setAddIzoh(v)} options={izohOpts} placeholder="Izoh yozing (ixtiyoriy)..." textarea rows={2} maxLength={255}
                    style={{ width: "100%", padding: "10px 12px 22px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 14, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", minHeight: 64 }}/>
                  <span style={{ position: "absolute", right: 10, bottom: 7, fontSize: 10, color: "var(--text-3)", pointerEvents: "none" }}>{addIzoh.length} / 255</span>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, padding: "16px 20px", borderTop: "1px solid var(--border)", paddingBottom: isMobile ? "max(16px, env(safe-area-inset-bottom))" : 16, ...modalCenter, boxSizing: "border-box" }}>
              <button className="btn btn--outline" style={{ flex: 1 }} onClick={() => setAddOpen(false)}>Bekor</button>
              <button className="btn btn--primary" style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={handleSave}
                disabled={saving || !addMijoz || (!num(addSumma) && !num(addDollar)) || (num(addDollar) > 0 && num(addKurs) < 11000) || !addTuri || (addValyuta === "Som" ? !addGazna : !addGaznaDollar)}>
                {saving ? <span className="spinner"/> : <span style={{ display: "flex" }}>{SAVE_ICON}</span>} Saqlash
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
