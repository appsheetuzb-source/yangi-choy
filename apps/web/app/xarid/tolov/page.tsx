"use client";
import { fetchSheet, afterWrite } from "@/lib/sheet-cache";
import { getCurrentKurs } from "@/lib/kurs";
import { useScrollLock } from "@/lib/use-scroll-lock";
import { usePersistedState } from "@/lib/usePersistedState";
import FabAdd from "@/components/FabAdd";
import { useAuth } from "@/lib/AuthContext";
import { gaznaForUser } from "@/lib/auth";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";

interface Gazna { Gazna_ID: string; Nomi: string; Turi: string; Shakli?: string; }

function GaznaButtons({ turi, shakli, value, onChange }: {
  turi: "Som" | "Dollar"; shakli?: string; value: string; onChange: (id: string) => void;
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
  const filtered = shakli ? byTuri.filter(g => !g.Shakli || g.Shakli === "Barchasi" || g.Shakli === shakli) : byTuri;
  const color = turi === "Dollar" ? "#2563eb" : "var(--primary)";
  const bg    = turi === "Dollar" ? "#eff6ff"  : "#f0fdf4";
  if (fetching) return <span style={{ fontSize: 13, color: "var(--text-3)" }}>Yuklanmoqda...</span>;
  if (filtered.length === 0) return null;
  return (
    <>
      {filtered.map(g => (
        <button key={g.Gazna_ID} type="button"
          onClick={() => onChange(value === g.Gazna_ID ? "" : g.Gazna_ID)}
          style={{ flex: "1 1 auto", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px 8px", borderRadius: "var(--radius)",
            border: `1.5px solid ${value === g.Gazna_ID ? color : "var(--border)"}`,
            background: value === g.Gazna_ID ? bg : "var(--white)",
            fontSize: 13, fontWeight: 700, cursor: "pointer",
            color: value === g.Gazna_ID ? "var(--text)" : "var(--text-2)" }}>
          <span style={{ display: "flex", color }}>{turiIcon(g.Shakli || g.Nomi)}</span>
          {g.Nomi}
          {value === g.Gazna_ID && <span style={{ position: "absolute", top: 7, right: 7, display: "flex" }}>{CHECK_ICON}</span>}
        </button>
      ))}
    </>
  );
}
interface XTolov {
  X_Tolov_ID: string; Taminotchi_ID: string; Xarid_ID: string;
  Yil: string; Oy: string; Sana: string; Valyuta: string; Turi: string;
  Som: string; Dollar: string; Summa: string; Summa_dollar: string;
  Izoh: string; Dollar_Kursi: string; Qoshdi: string; Vaqt: string;
  Check?: string; Gazna_ID?: string; Gazna_dollar_ID?: string;
}
interface Taminotchi { Taminotchi_ID: string; Ism: string; Telefon?: string; Boshlangich_som: string; Boshlangich_Balans: string; Qoldi_som?: string; Qoldi_dollar?: string; }
interface Xarid { Xarid_ID: string; Sotuv_Raqami: string; Taminotchi_ID: string; Sana: string; }
interface XaridSavat { Xarid_ID: string; Summa_Som: string; Jami_Summa: string; }

const OY_NOMLARI = ["Yanvar","Fevral","Mart","Aprel","May","Iyun","Iyul","Avgust","Sentabr","Oktabr","Noyabr","Dekabr"];
const TURI_LIST  = ["Naqd","Bank","Karta"];

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
function isoToParts(iso: string){ const [y,m,d]=(iso||"").split("-"); return { sana: d+"."+m+"."+y, oy:String(parseInt(m||"1")), yil:y||"" }; }
function sanaToIso(sana: string){ const mm=(sana||"").match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/); return mm ? (mm[3]+"-"+mm[2].padStart(2,"0")+"-"+mm[1].padStart(2,"0")) : ""; }

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
          <div style={{ maxHeight: 240, overflowY: "auto", overscrollBehavior: "contain" }}
            onTouchMove={e => e.stopPropagation()}>
            {list.length === 0 && <div style={{ padding: "12px 14px", fontSize: 13, color: "var(--text-3)" }}>Topilmadi</div>}
            {list.map(i => {
              const checked = value.includes(i.id);
              return (
                <div key={i.id} onClick={() => toggle(i.id)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", fontSize: 13, cursor: "pointer", background: checked ? "var(--bg)" : "transparent", fontWeight: checked ? 700 : 400 }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--bg)")}
                  onMouseLeave={e => (e.currentTarget.style.background = checked ? "var(--bg)" : "transparent")}>
                  <div style={{ width: 16, height: 16, borderRadius: 4, border: checked ? "none" : "1.5px solid var(--border)", background: checked ? "var(--primary)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all .12s" }}>
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
          <div style={{ maxHeight: 220, overflowY: "auto", overscrollBehavior: "contain" }}
            onTouchMove={e => e.stopPropagation()}>
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

export default function XaridTolovPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [tolovlar, setTolovlar]           = useState<XTolov[]>([]);
  const [tMap, setTMap]                   = useState<Record<string,string>>({});
  const [xMap, setXMap]                   = useState<Record<string,string>>({});
  const [xaridlar, setXaridlar]           = useState<Xarid[]>([]);
  const [savatMap, setSavatMap]           = useState<Record<string,XaridSavat[]>>({});
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string|null>(null);
  const [search, setSearch]               = usePersistedState("flt:xarid-tolov:search", "");
  const [taminotchilar, setTaminotchilar] = useState<Taminotchi[]>([]);
  const [isMobile, setIsMobile]           = useState(false);

  const now = new Date();
  const [filterOy, setFilterOy]   = usePersistedState("flt:xarid-tolov:filterOy", "");
  const [filterYil, setFilterYil] = usePersistedState("flt:xarid-tolov:filterYil", String(now.getFullYear()));
  const [filterT, setFilterT]     = usePersistedState<string[]>("flt:xarid-tolov:filterT", []);

  // Akt sverka
  const [togglingId, setTogglingId]     = useState<string|null>(null);

  // Delete & edit
  const [deleteTarget, setDeleteTarget] = useState<XTolov | null>(null);
  const [deleting, setDeleting]         = useState(false);
  const [editTarget, setEditTarget]     = useState<XTolov | null>(null);
  const [editSaving, setEditSaving]     = useState(false);
  const [editSana, setEditSana]         = useState("");
  const [editSumma, setEditSumma]       = useState("");
  const [editDollar, setEditDollar]     = useState("");
  const [editKurs, setEditKurs]         = useState("");
  const [editTuri, setEditTuri]         = useState("Naqd");
  const [editValyuta, setEditValyuta]   = useState<"Som"|"Dollar">("Som");
  const [editIzohV, setEditIzohV]       = useState("");

  // Add modal
  const [addOpen, setAddOpen]       = useState(false);
  useScrollLock(addOpen || !!editTarget || !!deleteTarget);
  const [saving, setSaving]         = useState(false);
  const [addT, setAddT]             = useState("");
  const [addValyuta, setAddValyuta] = useState<"Som"|"Dollar">("Som");
  const [addTuri, setAddTuri]       = useState("Naqd");
  const [addSana, setAddSana]       = useState(() => sanaToIso(nowStr().sana));  // default bugun YYYY-MM-DD
  const [addSumma, setAddSumma]     = useState("");
  const [addDollar, setAddDollar]   = useState("");
  const [addKurs, setAddKurs]       = useState("");
  const [centralKurs, setCentralKurs] = useState("");
  const [addIzoh, setAddIzoh]       = useState("");
  const [addGazna, setAddGazna]     = useState("");
  const [addGaznaDollar, setAddGaznaDollar] = useState("");
  const [editGazna, setEditGazna]   = useState("");
  const [editGaznaDollar, setEditGaznaDollar] = useState("");
  const [gaznalar, setGaznalar]     = useState<Gazna[]>([]);

  const [liveTime,setLiveTime]=useState("");  useEffect(()=>{ const p=(n:number)=>String(n).padStart(2,"0"); const tick=()=>{const t=new Date(); setLiveTime(p(t.getHours())+":"+p(t.getMinutes())+":"+p(t.getSeconds()));}; tick(); const iv=setInterval(tick,1000); return ()=>clearInterval(iv); },[]);

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
      fetchSheet("X_Tolov"),
      fetchSheet("Taminotchi"),
      fetchSheet("Xarid"),
      fetchSheet("Xarid_Savat"),
      fetchSheet("Gazna"),
    ]).then(([tolvR, tmR, xR, xsR, gzR]) => {
      if (tolvR.error) throw new Error(tolvR.error);
      const sorted = [...(tolvR.data as XTolov[])].sort((a, b) => {
        const p = (s: string) => {
          const parts = (s || "").split(".");
          if (parts.length !== 3) return 0;
          const [d, mo, y] = parts.map(Number);
          return y * 10000 + mo * 100 + d;
        };
        const t2s = (v: string) => { const [h,m,s] = (v||"").split(":").map(Number); return (h||0)*3600+(m||0)*60+(s||0); };
        const dateDiff = p(b.Sana) - p(a.Sana);
        if (dateDiff !== 0) return dateDiff;
        return t2s(b.Vaqt) - t2s(a.Vaqt);
      });
      setTolovlar(sorted);
      const tm: Record<string,string> = {};
      const tArr = tmR.data as Taminotchi[];
      tArr.forEach(t => { tm[t.Taminotchi_ID] = t.Ism; });
      setTMap(tm);
      setTaminotchilar(tArr);
      const xArr = xR.data as Xarid[];
      const xm: Record<string,string> = {};
      xArr.forEach(x => { xm[x.Xarid_ID] = x.Sotuv_Raqami; });
      setXMap(xm);
      setXaridlar(xArr);
      const sm: Record<string,XaridSavat[]> = {};
      (xsR.data as XaridSavat[]).forEach(s => {
        const key = String(s.Xarid_ID||"").trim();
        if (!key) return;
        if (!sm[key]) sm[key] = [];
        sm[key].push(s);
      });
      setSavatMap(sm);
      setGaznalar(((gzR.data || []) as Gazna[]).filter(g => g.Gazna_ID));
    }).catch(e => setError(e instanceof Error ? e.message : "Xatolik"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    fetchSheet("Gazna")
      .then(gzR => {
        if (Array.isArray(gzR.data)) {
          setGaznalar((gzR.data as Gazna[]).filter(g => g.Gazna_ID));
        }
      });
  }, []);

  async function toggleAkt(t: XTolov) {
    setTogglingId(t.X_Tolov_ID);
    const newVal = (t.Check === "True" || t.Check === "true") ? "False" : "True";
    await fetch("/api/sheets", { method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sheet: "X_Tolov", idColumn: "X_Tolov_ID", idValue: t.X_Tolov_ID,
        row: { ...t, Check: newVal } }) });
    afterWrite("X_Tolov");
    setTolovlar(p => p.map(r => r.X_Tolov_ID === t.X_Tolov_ID ? { ...r, Check: newVal } : r));
    setTogglingId(null);
  }

  function autoSelectGazna(turi: string, gz: Gazna[], setSom: (id: string) => void, setDol: (id: string) => void) {
    const somAccs = gz.filter(g => g.Turi !== "Dollar" && (!g.Shakli || g.Shakli === "Barchasi" || g.Shakli === turi));
    if (somAccs.length === 1) setSom(somAccs[0].Gazna_ID);
    const dolAccs = gz.filter(g => g.Turi === "Dollar" && (!g.Shakli || g.Shakli === "Barchasi" || g.Shakli === turi));
    if (dolAccs.length === 1) setDol(dolAccs[0].Gazna_ID);
  }
  function selectAddTuri(turi: string) {
    setAddTuri(turi);
    if (gaznalar.length) autoSelectGazna(turi, gaznaForUser(user, gaznalar), setAddGazna, setAddGaznaDollar);
  }
  function selectEditTuri(turi: string) {
    setEditTuri(turi);
    if (gaznalar.length) autoSelectGazna(turi, gaznaForUser(user, gaznalar), setEditGazna, setEditGaznaDollar);
  }

  async function openAdd() {
    setAddT(""); setAddValyuta("Som"); setAddTuri("Naqd");
    setAddSana(sanaToIso(nowStr().sana));
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
    if (!addT) return;
    const somVal = num(addSumma);
    const usdVal = num(addDollar);
    if (somVal === 0 && usdVal === 0) return;
    if (num(addKurs) < 11000) return;
    setSaving(true);
    const { vaqt } = nowStr();
    const { sana, oy, yil } = addSana ? isoToParts(addSana) : nowStr();
    const kurs = num(addKurs);
    const isSom = addValyuta === "Som";
    // So'm: Summa = Som + Dollar * Kurs
    const summa       = isSom ? String(somVal + usdVal * kurs) : "";
    // Dollar: Summa_dollar = Dollar + Som / Kurs
    const summaDollar = !isSom ? String(usdVal + (kurs > 0 ? somVal / kurs : 0)) : "";
    const valyuta     = isSom ? "So'm" : "Dollar";
    try {
      await fetch("/api/sheets", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet: "X_Tolov", row: {
          X_Tolov_ID: uid(), Taminotchi_ID: addT, Xarid_ID: "",
          Yil: yil, Oy: oy, Sana: sana, Valyuta: valyuta, Turi: addTuri,
          Som: String(somVal), Dollar: String(usdVal),
          Summa: summa, Summa_dollar: summaDollar,
          Dollar_Kursi: addKurs, Izoh: addIzoh, Vaqt: vaqt, Qoshdi: "", Check: "False",
          Gazna_ID: addGazna, Gazna_dollar_ID: addGaznaDollar,
        } }) });
      localStorage.setItem("dollar_kurs", addKurs);
      const taminotchiA = taminotchilar.find(t => t.Taminotchi_ID === addT);
      if (taminotchiA) {
        try {
          await fetch("/api/sheets", { method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sheet: "Taminotchi", idColumn: "Taminotchi_ID", idValue: addT,
              row: { Qoldi_som: String(num(taminotchiA.Qoldi_som) - somVal), Qoldi_dollar: String(num(taminotchiA.Qoldi_dollar) - usdVal) } }) });
        } catch {}
      }

      // Telegram bot xabari — firmaga (ta'minotchiga) to'lov qilindi
      const nS = (v: number) => String(Math.round(v));
      const nU = (v: number) => String(Math.round(v * 100) / 100);
      const ostatkaSom = tQoldiq ? tQoldiq.som : 0;
      const ostatkaDollar = tQoldiq ? tQoldiq.usd : 0;
      const tgMsg =
        `✅ TO'LOV UCHUN RAHMAT!\n\n` +
        `📅 Sana: ${sana}\n` +
        `👤 Taminotchi: ${taminotchiA?.Ism || "—"}${taminotchiA?.Telefon ? " | " + taminotchiA.Telefon : ""}\n` +
        `💰 Ostatka(So'm): ${nS(ostatkaSom)}\n` +
        `💰 Ostatka($): ${nU(ostatkaDollar)}\n` +
        `💵 So'm: ${somVal > 0 ? nS(somVal) : "null"}\n` +
        `💵 Dollar: ${usdVal > 0 ? nU(usdVal) : "null"}\n` +
        `💵 Jami so'm: ${nS(num(summa))}\n` +
        `💵 Jami dollar: ${nU(num(summaDollar))}\n` +
        `💵 Qoldiq (so'm): ${nS(ostatkaSom - num(summa))}\n` +
        `💵 Qoldiq ($): ${nU(ostatkaDollar - num(summaDollar))}\n` +
        `📝 Izoh: ${addIzoh && addIzoh.trim() ? addIzoh : "null"}`;
      fetch("/api/telegram", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: tgMsg }) }).catch(() => {});

      afterWrite("X_Tolov");
      afterWrite("Taminotchi");
      setAddOpen(false);
      setTimeout(() => loadData(), 800);
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch("/api/sheets", { method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet: "X_Tolov", idColumn: "X_Tolov_ID", idValue: deleteTarget.X_Tolov_ID }) });
      const taminotchiD = taminotchilar.find(t => t.Taminotchi_ID === deleteTarget.Taminotchi_ID);
      if (taminotchiD) {
        try {
          await fetch("/api/sheets", { method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sheet: "Taminotchi", idColumn: "Taminotchi_ID", idValue: deleteTarget.Taminotchi_ID,
              row: { Qoldi_som: String(num(taminotchiD.Qoldi_som) + num(deleteTarget.Som)), Qoldi_dollar: String(num(taminotchiD.Qoldi_dollar) + num(deleteTarget.Dollar)) } }) });
        } catch {}
      }
      afterWrite("X_Tolov");
      afterWrite("Taminotchi");
      setDeleteTarget(null);
      setTimeout(() => loadData(), 800);
    } finally { setDeleting(false); }
  }

  function openEdit(t: XTolov) {
    setEditTarget(t);
    setEditSana(sanaToIso(t.Sana));
    setEditValyuta(t.Valyuta === "Dollar" ? "Dollar" : "Som");
    setEditSumma(t.Som || "");
    setEditDollar(t.Dollar || "");
    setEditKurs(t.Dollar_Kursi || "");
    setEditTuri(t.Turi || "Naqd");
    setEditIzohV(t.Izoh || "");
    setEditGazna(t.Gazna_ID || "");
    setEditGaznaDollar(t.Gazna_dollar_ID || "");
    if (gaznalar.length === 0) {
      fetchSheet("Gazna")
        .then(gzR => {
          if (Array.isArray(gzR.data) && gzR.data.length > 0)
            setGaznalar((gzR.data as Gazna[]).filter(g => g.Gazna_ID));
        }).catch(() => {});
    }
  }

  async function handleEditSave() {
    if (!editTarget) return;
    if (num(editKurs) < 11000) return;
    setEditSaving(true);
    const somVal = num(editSumma);
    const usdVal = num(editDollar);
    const kurs = num(editKurs);
    const isSom = editValyuta === "Som";
    const summa       = isSom ? String(somVal + usdVal * kurs) : "";
    const summaDollar = !isSom ? String(usdVal + (kurs > 0 ? somVal / kurs : 0)) : "";
    const valyuta     = isSom ? "So'm" : "Dollar";
    const _sp = editSana ? isoToParts(editSana) : { sana: editTarget.Sana, oy: editTarget.Oy, yil: editTarget.Yil };
    try {
      await fetch("/api/sheets", { method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet: "X_Tolov", idColumn: "X_Tolov_ID", idValue: editTarget.X_Tolov_ID,
          row: { ...editTarget, Sana: _sp.sana, Yil: _sp.yil, Oy: _sp.oy, Valyuta: valyuta, Turi: editTuri,
            Som: String(somVal), Dollar: String(usdVal),
            Summa: summa, Summa_dollar: summaDollar,
            Dollar_Kursi: editKurs, Izoh: editIzohV,
            Gazna_ID: editGazna, Gazna_dollar_ID: editGaznaDollar,
          } }) });
      localStorage.setItem("dollar_kurs", editKurs);
      const taminotchiE = taminotchilar.find(t => t.Taminotchi_ID === editTarget.Taminotchi_ID);

      // Telegram bot xabari — firmaga to'lov TAHRIRLANDI (o'zgargan summa)
      {
        const nS = (v: number) => String(Math.round(v));
        const nU = (v: number) => String(Math.round(v * 100) / 100);
        const yangiQoldiSom = taminotchiE ? num(taminotchiE.Qoldi_som) + num(editTarget.Som) - somVal : 0;
        const yangiQoldiUsd = taminotchiE ? num(taminotchiE.Qoldi_dollar) + num(editTarget.Dollar) - usdVal : 0;
        const tgMsg =
          `✏️ Firmaga to'lov tahrirlandi\n\n` +
          `📅 Sana: ${editTarget.Sana || ""}\n` +
          `👤 Taminotchi: ${taminotchiE?.Ism || "—"}${taminotchiE?.Telefon ? " | " + taminotchiE.Telefon : ""}\n` +
          `💵 So'm: ${somVal > 0 ? nS(somVal) : "null"}\n` +
          `💵 Dollar: ${usdVal > 0 ? nU(usdVal) : "null"}\n` +
          `💵 Jami so'm: ${nS(num(summa))}\n` +
          `💵 Jami dollar: ${nU(num(summaDollar))}\n` +
          (taminotchiE ? `💵 Qoldiq (so'm): ${nS(yangiQoldiSom)}\n💵 Qoldiq ($): ${nU(yangiQoldiUsd)}\n` : "") +
          `📝 Izoh: ${editIzohV && editIzohV.trim() ? editIzohV : "null"}`;
        fetch("/api/telegram", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: tgMsg }) }).catch(() => {});
      }

      if (taminotchiE) {
        try {
          await fetch("/api/sheets", { method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sheet: "Taminotchi", idColumn: "Taminotchi_ID", idValue: editTarget.Taminotchi_ID,
              row: { Qoldi_som: String(num(taminotchiE.Qoldi_som) + num(editTarget.Som) - somVal), Qoldi_dollar: String(num(taminotchiE.Qoldi_dollar) + num(editTarget.Dollar) - usdVal) } }) });
        } catch {}
      }
      afterWrite("X_Tolov");
      afterWrite("Taminotchi");
      setEditTarget(null);
      setTimeout(() => loadData(), 800);
    } finally { setEditSaving(false); }
  }

  const filtered = useMemo(() => tolovlar.filter(t => {
    if (!t.X_Tolov_ID) return false;
    const matchOy  = !filterOy  || String(parseInt(t.Oy || "0")) === filterOy;
    const matchYil = !filterYil || t.Yil === filterYil;
    const matchT   = filterT.length === 0 || filterT.includes(t.Taminotchi_ID);
    const tNomi = tMap[t.Taminotchi_ID] || "";
    const matchSearch = !search ||
      tNomi.toLowerCase().includes(search.toLowerCase()) ||
      (t.Sana || "").includes(search) ||
      (t.Turi || "").toLowerCase().includes(search.toLowerCase());
    return matchOy && matchYil && matchT && matchSearch;
  }), [tolovlar, filterOy, filterYil, filterT, tMap, search]);

  const totalSom     = useMemo(() => filtered.reduce((s, t) => s + (t.Valyuta !== "Dollar" ? num(t.Som) : 0), 0), [filtered]);
  const totalDollar  = useMemo(() => filtered.reduce((s, t) => s + num(t.Dollar), 0), [filtered]);
  const totalJamiUsd = useMemo(() => filtered.reduce((s, t) => s + num(t.Summa_dollar), 0), [filtered]);
  const totalJamiSom = useMemo(() => filtered.reduce((s, t) => s + num(t.Summa), 0), [filtered]);

  // Windowing — ro'yxatni bo'lib render qilish (skroll tezligi uchun)
  const [shown, setShown] = useState(60);
  const moreRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setShown(60); }, [filterOy, filterYil, filterT, search]);
  useEffect(() => {
    const el = moreRef.current; if (!el) return;
    const io = new IntersectionObserver(es => { if (es[0].isIntersecting) setShown(n => n + 60); });
    io.observe(el); return () => io.disconnect();
  }, [filtered.length]);

  const years = useMemo(() => {
    const y = [...new Set(tolovlar.map(t => t.Yil).filter(Boolean))].sort((a, b) => Number(b) - Number(a));
    if (!y.includes(String(now.getFullYear()))) y.unshift(String(now.getFullYear()));
    return y;
  }, [tolovlar]);

  const tItems = useMemo(() => taminotchilar.map(t => ({ id: t.Taminotchi_ID, label: t.Ism })), [taminotchilar]);

  const selectedT = useMemo(() => taminotchilar.find(t => t.Taminotchi_ID === addT), [taminotchilar, addT]);
  const tQoldiq = useMemo(() => {
    if (!selectedT) return null;
    const bSom = num(selectedT.Boshlangich_som);
    const bUsd = num(selectedT.Boshlangich_Balans);
    const xSom = xaridlar.filter(x => x.Taminotchi_ID === addT)
      .reduce((s, x) => s + (savatMap[x.Xarid_ID] || []).reduce((ss, r) => ss + num(r.Summa_Som), 0), 0);
    const xUsd = xaridlar.filter(x => x.Taminotchi_ID === addT)
      .reduce((s, x) => s + (savatMap[x.Xarid_ID] || []).reduce((ss, r) => ss + num(r.Jami_Summa), 0), 0);
    const tSom = tolovlar.filter(t => t.Taminotchi_ID === addT)
      .reduce((s, t) => s + (t.Valyuta !== "Dollar" ? num(t.Summa || t.Som) : 0), 0);
    const tUsd = tolovlar.filter(t => t.Taminotchi_ID === addT)
      .reduce((s, t) => s + (t.Valyuta === "Dollar" ? num(t.Summa_dollar || t.Dollar) : 0), 0);
    return { som: bSom + xSom - tSom, usd: bUsd + xUsd - tUsd };
  }, [selectedT, addT, xaridlar, savatMap, tolovlar]);

  // Modal overlay style — bottom sheet on mobile, centered on desktop
  const modalOverlay: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 50, background: "rgba(15,42,76,.42)", backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: isMobile ? "flex-end" : "stretch",
    justifyContent: "center",
    padding: 0,
  };
  // Web'da to'liq ekran; mobilda pastki varaq
  const modalBox: React.CSSProperties = {
    background: "var(--white)", width: "100%",
    maxWidth: isMobile ? "100%" : "none",
    borderRadius: isMobile ? "20px 20px 0 0" : 0,
    display: "flex", flexDirection: "column",
    height: isMobile ? "auto" : "100dvh",
    maxHeight: isMobile ? "92dvh" : "100dvh",
  };
  // To'liq ekranda content markazda (kiritishlar cho'zilmasin) — body/footer'ga qo'shiladi
  const modalCenter: React.CSSProperties = isMobile ? {} : { width: "100%", maxWidth: 760, alignSelf: "center" };

  return (
    <>
      {/* Header */}
      <header className="header">
        <div className="header__inner">
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <h1 className="header__title" style={{ paddingLeft: 4 }}>Firmadan pul ayirish</h1>
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
              <div style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", padding: isMobile ? "14px 16px" : "20px 24px" }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".06em", marginBottom: 8 }}>SO&apos;M</p>
                <p style={{ fontSize: isMobile ? 17 : 22, fontWeight: 800, lineHeight: 1 }}>{totalSom !== 0 ? totalSom.toLocaleString("ru-RU") : "0"}</p>
              </div>
              <div style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", padding: isMobile ? "14px 16px" : "20px 24px" }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".06em", marginBottom: 8 }}>DOLLAR</p>
                <p style={{ fontSize: isMobile ? 17 : 22, fontWeight: 800, lineHeight: 1, color: "#2563eb" }}>{totalDollar !== 0 ? fmtUsd(totalDollar) : "$0.00"}</p>
              </div>
              <div style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", padding: isMobile ? "14px 16px" : "20px 24px" }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".06em", marginBottom: 8 }}>JAMI ($)</p>
                <p style={{ fontSize: isMobile ? 17 : 22, fontWeight: 800, lineHeight: 1, color: "#2563eb" }}>{totalJamiUsd !== 0 ? fmtUsd(totalJamiUsd) : "$0.00"}</p>
              </div>
              <div style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", padding: isMobile ? "14px 16px" : "20px 24px" }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".06em", marginBottom: 8 }}>JAMI (SO&apos;M)</p>
                <p style={{ fontSize: isMobile ? 17 : 22, fontWeight: 800, lineHeight: 1 }}>{totalJamiSom !== 0 ? totalJamiSom.toLocaleString("ru-RU") : "0"}</p>
              </div>
            </div>

            {/* Table card */}
            <div style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)" }}>

              {/* ── MOBILE toolbar ── */}
              {isMobile ? (
                <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 10 }}>
                  {/* Search */}
                  <div className="search">
                    <span className="search__icon">
                      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    </span>
                    <input className="search__input" placeholder="Qidirish..." value={search} onChange={e => setSearch(e.target.value)}/>
                    {search && <button className="search__clear" onClick={() => setSearch("")}><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>}
                  </div>
                  {/* Ta'minotchi filter — to'liq kenglik */}
                  <MultiSelect
                    items={taminotchilar.map(t => ({ id: t.Taminotchi_ID, label: t.Ism }))}
                    value={filterT} onChange={setFilterT} placeholder="Ta'minotchi..." fullWidth/>
                  {/* Oy + Yil */}
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
                  <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>
                    Jami: {filtered.length} ta to&apos;lov
                  </div>
                </div>
              ) : (
                /* ── DESKTOP sticky header ── */
                <div style={{ position: "sticky", top: 56, zIndex: 10, background: "var(--white)", borderRadius: "var(--radius-xl) var(--radius-xl) 0 0" }}>
                  {/* Toolbar */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", padding: "0 14px", height: 36, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap" }}>
                      Jami: {filtered.length} ta
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
                      <span className="search__icon">
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                      </span>
                      <input className="search__input" placeholder="Qidirish..." value={search} onChange={e => setSearch(e.target.value)}/>
                      {search && <button className="search__clear" onClick={() => setSearch("")}><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>}
                    </div>
                    <MultiSelect
                      items={taminotchilar.map(t => ({ id: t.Taminotchi_ID, label: t.Ism }))}
                      value={filterT} onChange={setFilterT} placeholder="Ta'minotchi..."/>
                    <span style={{ flex: 1 }}/>
                    <button className="btn btn--primary" onClick={openAdd}>
                      <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                      Yangi to&apos;lov
                    </button>
                  </div>
                  {/* Jami qatori */}
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(140px,1.5fr) 120px 110px 95px 120px 120px minmax(80px,1fr) 110px 64px", padding: "10px 16px", borderBottom: "1px solid var(--border)", background: "#f8fafc" }}>
                    <span/>
                    <span style={{ fontSize: 16, fontWeight: 800, color: "#16a34a" }}>{totalSom !== 0 ? totalSom.toLocaleString("ru-RU") : "—"}</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: "#2563eb" }}>{totalDollar !== 0 ? fmtUsd(totalDollar) : "—"}</span>
                    <span/>
                    <span style={{ fontSize: 16, fontWeight: 800, color: "#2563eb" }}>{totalJamiUsd !== 0 ? fmtUsd(totalJamiUsd) : "—"}</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: "#16a34a" }}>{totalJamiSom !== 0 ? totalJamiSom.toLocaleString("ru-RU") : "—"}</span>
                    <span/><span/><span/>
                  </div>
                  {/* Table header */}
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(140px,1.5fr) 120px 110px 95px 120px 120px minmax(80px,1fr) 110px 64px", padding: "8px 16px", background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
                    {["TA'MINOTCHI","SO'M","DOLLAR","DOLLAR KURSI","JAMI ($)","JAMI (SO'M)","IZOH","AKT SVERKA",""].map(h => (
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

              {/* ── MOBILE cards ── */}
              {isMobile ? (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {filtered.slice(0, shown).map((t, idx) => {
                    const tNomi    = tMap[t.Taminotchi_ID] || "—";
                    const somVal   = num(t.Som);
                    const dollarVal = num(t.Dollar);
                    const jamiUsd  = num(t.Summa_dollar);
                    const jamiSom  = num(t.Summa);
                    const xRaqam   = t.Xarid_ID ? xMap[t.Xarid_ID] : null;
                    const isHaMob  = t.Check === "True" || t.Check === "true";
                    return (
                      <div key={t.X_Tolov_ID || idx}
                        onClick={() => router.push(`/xarid/tolov/${t.X_Tolov_ID}`)}
                        style={{
                          padding: "14px 14px",
                          borderBottom: idx < filtered.length - 1 ? "1px solid var(--border)" : "none",
                          background: isHaMob ? "#dcfce7" : "#fee2e2",
                          cursor: "pointer",
                        }}>
                        {/* Row 1: ta'minotchi + sana + actions */}
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                          <div>
                            <p style={{ fontSize: 14, fontWeight: 800, color: "#ef4444" }}>{tNomi}</p>
                            {xRaqam && <p style={{ fontSize: 11, color: "var(--primary)", marginTop: 1 }}>Xarid #{xRaqam}</p>}
                            <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{t.Sana || "—"} {t.Vaqt ? `· ${t.Vaqt}` : ""}</p>
                          </div>
                          <div style={{ display: "flex", gap: 6, flexShrink: 0, marginLeft: 8 }}>
                            <button onClick={e => { e.stopPropagation(); openEdit(t); }}
                              style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid #dbeafe", background: "#eff6ff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563eb" }}>
                              <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                            </button>
                            <button onClick={e => { e.stopPropagation(); setDeleteTarget(t); }}
                              style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid #fee2e2", background: "#fff1f2", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444" }}>
                              <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            </button>
                          </div>
                        </div>

                        {/* Row 2: summalar */}
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                          {/* Turi badge */}
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "#f1f5f9", color: "var(--text-2)" }}>{t.Turi || "—"}</span>
                          {somVal !== 0 && (
                            <span style={{ fontSize: 13, fontWeight: 800, color: "#16a34a" }}>{somVal.toLocaleString("ru-RU")} so&apos;m</span>
                          )}
                          {dollarVal !== 0 && (
                            <span style={{ fontSize: 13, fontWeight: 800, color: "#2563eb" }}>{fmtUsd(dollarVal)}</span>
                          )}
                        </div>

                        {/* Row 3: jami */}
                        {(jamiSom !== 0 || jamiUsd !== 0) && (
                          <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>Jami:</span>
                            {jamiSom !== 0 && <span style={{ fontSize: 12, fontWeight: 700 }}>{jamiSom.toLocaleString("ru-RU")} so&apos;m</span>}
                            {jamiUsd !== 0 && <span style={{ fontSize: 12, fontWeight: 700, color: "#2563eb" }}>{fmtUsd(jamiUsd)}</span>}
                          </div>
                        )}

                        {/* Row 4: izoh + akt */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, gap: 8 }}>
                          {t.Izoh
                            ? <p style={{ fontSize: 12, color: "var(--text-2)", fontStyle: "italic", flex: 1 }}>{t.Izoh}</p>
                            : <span/>}
                          <div style={{ display: "inline-flex", borderRadius: 20, overflow: "hidden", border: "1.5px solid var(--border)", flexShrink: 0, opacity: togglingId === t.X_Tolov_ID ? 0.5 : 1, pointerEvents: togglingId === t.X_Tolov_ID ? "none" : "auto" }}>
                            <button onClick={() => !isHaMob && toggleAkt(t)}
                              style={{ padding: "5px 12px", fontSize: 12, fontWeight: 700, border: "none", borderRight: "1.5px solid var(--border)", cursor: isHaMob ? "default" : "pointer", background: isHaMob ? "#16a34a" : "var(--white)", color: isHaMob ? "#fff" : "var(--text-3)" }}>
                              Ha
                            </button>
                            <button onClick={() => isHaMob && toggleAkt(t)}
                              style={{ padding: "5px 12px", fontSize: 12, fontWeight: 700, border: "none", cursor: isHaMob ? "pointer" : "default", background: !isHaMob ? "#ef4444" : "var(--white)", color: !isHaMob ? "#fff" : "var(--text-3)" }}>
                              Yo&apos;q
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* ── DESKTOP table rows ── */
                <>
                  {filtered.slice(0, shown).map((t, idx) => {
                    const tNomi    = tMap[t.Taminotchi_ID] || "—";
                    const somVal    = num(t.Som);
                    const dollarVal = num(t.Dollar);
                    const jamiUsd   = num(t.Summa_dollar);
                    const jamiSom   = num(t.Summa);
                    const kurs      = num(t.Dollar_Kursi);
                    const xRaqam   = t.Xarid_ID ? xMap[t.Xarid_ID] : null;
                    const isHa      = t.Check === "True" || t.Check === "true";
                    const rowBg     = isHa ? "#dcfce7" : "#fee2e2";
                    const rowHover  = isHa ? "#bbf7d0" : "#fecaca";
                    return (
                      <div key={t.X_Tolov_ID || idx}
                        onClick={() => router.push(`/xarid/tolov/${t.X_Tolov_ID}`)}
                        style={{
                          display: "grid", gridTemplateColumns: "minmax(140px,1.5fr) 120px 110px 95px 120px 120px minmax(80px,1fr) 110px 64px",
                          padding: "10px 16px", alignItems: "center",
                          borderBottom: idx < filtered.length - 1 ? "1px solid var(--border)" : "none",
                          background: rowBg, cursor: "pointer",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = rowHover)}
                        onMouseLeave={e => (e.currentTarget.style.background = rowBg)}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 800, color: "#ef4444", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tNomi}</p>
                          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", marginTop: 1 }}>{t.Sana || "—"}{xRaqam ? ` · #${xRaqam}` : ""}{t.Vaqt ? ` · ${t.Vaqt}` : ""}</p>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: somVal ? "var(--text)" : "var(--text-3)" }}>
                          {somVal ? somVal.toLocaleString("ru-RU") : "—"}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: dollarVal ? "#2563eb" : "var(--text-3)" }}>
                          {dollarVal ? fmtUsd(dollarVal) : "—"}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: kurs ? "var(--text-2)" : "var(--text-3)" }}>
                          {kurs ? kurs.toLocaleString("ru-RU") : "0"}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: jamiUsd ? "#2563eb" : "var(--text-3)" }}>
                          {jamiUsd ? fmtUsd(jamiUsd) : "—"}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: jamiSom ? "var(--text)" : "var(--text-3)" }}>
                          {jamiSom ? jamiSom.toLocaleString("ru-RU") : "—"}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t.Izoh || "—"}
                        </span>
                        {/* Akt sverka */}
                        <div onClick={e => e.stopPropagation()} style={{ display: "inline-flex", borderRadius: 20, overflow: "hidden", border: "1.5px solid var(--border)", opacity: togglingId === t.X_Tolov_ID ? 0.5 : 1, pointerEvents: togglingId === t.X_Tolov_ID ? "none" : "auto" }}>
                          <button onClick={() => !isHa && toggleAkt(t)}
                            style={{ padding: "4px 10px", fontSize: 11, fontWeight: 700, border: "none", borderRight: "1.5px solid var(--border)", cursor: isHa ? "default" : "pointer", background: isHa ? "#16a34a" : "var(--white)", color: isHa ? "#fff" : "var(--text-3)" }}>
                            Ha
                          </button>
                          <button onClick={() => isHa && toggleAkt(t)}
                            style={{ padding: "4px 10px", fontSize: 11, fontWeight: 700, border: "none", cursor: isHa ? "pointer" : "default", background: !isHa ? "#ef4444" : "var(--white)", color: !isHa ? "#fff" : "var(--text-3)" }}>
                            Yo&apos;q
                          </button>
                        </div>
                        <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
                          <button onClick={() => openEdit(t)}
                            style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563eb" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "#dbeafe")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                          </button>
                          <button onClick={() => setDeleteTarget(t)}
                            style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "#fee2e2")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
              {shown < filtered.length && (
                <div ref={moreRef} style={{ padding: "14px", textAlign: "center", color: "var(--text-3)", fontSize: 12, fontWeight: 600 }}>
                  Yuklanmoqda… ({shown}/{filtered.length})
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Edit Modal ── */}
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
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-3)", fontVariantNumeric: "tabular-nums", textAlign: "center", whiteSpace: "nowrap" }}>{liveTime}</span>
              </div>
              <button onClick={() => setEditTarget(null)} style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 8, border: "1px solid var(--border)", background: "var(--white)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 14, overflowY: "auto", flex: isMobile ? undefined : 1, ...modalCenter }}>
              {/* Valyuta */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 8 }}>Valyuta</label>
                <div style={{ display: "flex", borderRadius: "var(--radius)", overflow: "hidden", border: "1.5px solid var(--border)" }}>
                  {(["Som","Dollar"] as const).map(v => (
                    <button key={v} onClick={() => setEditValyuta(v)}
                      style={{ flex: 1, padding: "10px", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer",
                        background: editValyuta === v ? (v === "Som" ? "var(--primary)" : "#2563eb") : "var(--white)",
                        color: editValyuta === v ? "#fff" : "var(--text-3)",
                        borderRight: v === "Som" ? "1.5px solid var(--border)" : "none" }}>
                      {v === "Som" ? "So'm" : "Dollar"}
                    </button>
                  ))}
                </div>
              </div>
              {/* 3 ta input */}
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
                  <label style={{ fontSize: 12, fontWeight: 600, color: num(editKurs) < 11000 ? "#ef4444" : "var(--text-2)", display: "block", marginBottom: 6 }}>Dollar kursi <span style={{ color: "#ef4444" }}>*</span>{num(editKurs) > 0 && num(editKurs) < 11000 && <span style={{ fontWeight: 400, marginLeft: 6 }}>min: 11 000</span>}</label>
                  <CurInput icon={KURS_ICON} iconColor="#16a34a" value={editKurs} onChange={e => setEditKurs(e.target.value.replace(/\D/g,""))} placeholder="Min: 11 000" inputMode="numeric"
                    style={{ width: "100%", padding: "10px 12px", border: `1.5px solid ${num(editKurs) < 11000 ? "#ef4444" : "var(--border)"}`, borderRadius: "var(--radius)", fontSize: 14, fontWeight: 600, outline: "none", boxSizing: "border-box" }}/>
                </div>
              </div>
              {/* Natija preview */}
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
              {/* To'lov turi */}
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
                  <GaznaButtons turi="Som" shakli={editTuri} value={editGazna} onChange={setEditGazna} />
                </div>
              </div>
              )}
              {editValyuta !== "Som" && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#2563eb", display: "block", marginBottom: 8 }}>Hisob (Dollar)</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <GaznaButtons turi="Dollar" shakli={editTuri} value={editGaznaDollar} onChange={setEditGaznaDollar} />
                </div>
              </div>
              )}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 6 }}>Izoh</label>
                <input value={editIzohV} onChange={e => setEditIzohV(e.target.value)} placeholder="Ixtiyoriy..."
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

      {/* ── Delete confirm ── */}
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

      {/* ── Add Modal ── */}
      {addOpen && (
        <div style={modalOverlay} onClick={() => setAddOpen(false)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            {isMobile && <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--border)", margin: "12px auto 0" }}/>}

            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "#fff7ed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="18" height="18" fill="none" stroke="#f97316" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z"/></svg>
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
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-3)", fontVariantNumeric: "tabular-nums", textAlign: "center", whiteSpace: "nowrap" }}>{liveTime}</span>
              </div>
              <button onClick={() => setAddOpen(false)} style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid var(--border)", background: "var(--white)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14, overflowY: "auto", flex: isMobile ? undefined : 1, ...modalCenter }}>
              {/* Ta'minotchi + QOLDIQ (yonma-yon) */}
              <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 6 }}>Ta&apos;minotchi *</label>
                  <SearchSelect items={tItems} value={addT} onChange={setAddT} placeholder="Ta'minotchi tanlang..."/>
                </div>
                {tQoldiq && (
                  <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "8px 14px", background: "var(--bg)", minWidth: 170, display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".04em" }}>Qoldiq</span>
                      <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                        {tQoldiq.som === 0 && tQoldiq.usd === 0
                          ? <span style={{ fontSize: 15, fontWeight: 800, color: "#16a34a" }}>0</span>
                          : <>
                              {tQoldiq.som !== 0 && <span style={{ fontSize: 15, fontWeight: 800, color: tQoldiq.som > 0 ? "#ef4444" : "#16a34a" }}>{tQoldiq.som.toLocaleString("ru-RU")} so&apos;m</span>}
                              {tQoldiq.usd !== 0 && <span style={{ fontSize: 13, fontWeight: 700, color: tQoldiq.usd > 0 ? "#ef4444" : "#16a34a" }}>≈ {fmtUsd(tQoldiq.usd)}</span>}
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
                        if (acc.length === 1) setAddGazna(acc[0].Gazna_ID);
                        setAddGaznaDollar("");
                      } else {
                        const acc = gaznaForUser(user, gaznalar).filter(g => g.Turi === "Dollar");
                        if (acc.length === 1) setAddGaznaDollar(acc[0].Gazna_ID);
                        setAddGazna("");
                      }
                    }}
                      style={{ flex: 1, padding: "10px", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer",
                        background: addValyuta === v ? (v === "Som" ? "var(--primary)" : "#2563eb") : "var(--white)",
                        color: addValyuta === v ? "#fff" : "var(--text-3)",
                        borderRight: v === "Som" ? "1.5px solid var(--border)" : "none" }}>
                      {v === "Som" ? "So'm" : "Dollar"}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3 ta input */}
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
                  <label style={{ fontSize: 12, fontWeight: 600, color: num(addKurs) < 11000 ? "#ef4444" : "var(--text-2)", display: "block", marginBottom: 6 }}>Dollar kursi <span style={{ color: "#ef4444" }}>*</span>{num(addKurs) > 0 && num(addKurs) < 11000 && <span style={{ fontWeight: 400, marginLeft: 6 }}>min: 11 000</span>}</label>
                  <CurInput icon={KURS_ICON} iconColor="#16a34a" value={addKurs} onChange={e => setAddKurs(e.target.value.replace(/\D/g,""))} placeholder="Min: 11 000" inputMode="numeric"
                    style={{ width: "100%", padding: "10px 12px", border: `1.5px solid ${num(addKurs) < 11000 ? "#ef4444" : "var(--border)"}`, borderRadius: "var(--radius)", fontSize: 14, fontWeight: 600, outline: "none", boxSizing: "border-box" }}/>
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
                    {tQoldiq && (() => {
                      const afterSom = tQoldiq.som - paidSom;
                      const afterUsd = tQoldiq.usd - paidUsd;
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

              {/* To'lov turi — tugmalar */}
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
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 8 }}>Hisob (So&apos;m)</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <GaznaButtons turi="Som" shakli={addTuri} value={addGazna} onChange={setAddGazna} />
                </div>
              </div>
              )}
              {addValyuta !== "Som" && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#2563eb", display: "block", marginBottom: 8 }}>Hisob (Dollar)</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <GaznaButtons turi="Dollar" shakli={addTuri} value={addGaznaDollar} onChange={setAddGaznaDollar} />
                </div>
              </div>
              )}
              {/* Izoh */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 6 }}>Izoh</label>
                <div style={{ position: "relative" }}>
                  <textarea value={addIzoh} onChange={e => setAddIzoh(e.target.value.slice(0, 255))} placeholder="Izoh yozing (ixtiyoriy)..." rows={2}
                    style={{ width: "100%", padding: "10px 12px 22px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 14, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", minHeight: 64 }}/>
                  <span style={{ position: "absolute", right: 10, bottom: 7, fontSize: 10, color: "var(--text-3)", pointerEvents: "none" }}>{addIzoh.length} / 255</span>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, padding: "16px 20px", borderTop: "1px solid var(--border)", paddingBottom: isMobile ? "max(16px, env(safe-area-inset-bottom))" : 16, ...modalCenter, boxSizing: "border-box" }}>
              <button className="btn btn--outline" style={{ flex: 1 }} onClick={() => setAddOpen(false)}>Bekor</button>
              <button className="btn btn--primary" style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={handleSave}
                disabled={saving || !addT || (!num(addSumma) && !num(addDollar)) || num(addKurs) < 11000}>
                {saving ? <span className="spinner"/> : <span style={{ display: "flex" }}>{SAVE_ICON}</span>} Saqlash
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
