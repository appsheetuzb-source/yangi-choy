"use client";
import { fetchSheet, fetchSheetWhere, afterWrite } from "@/lib/sheet-cache";
import { exportPDF, exportExcel, type ExportOpts, type ExportSection } from "@/lib/export";
import { getCurrentKurs } from "@/lib/kurs";
import { useScrollLock } from "@/lib/use-scroll-lock";
import LiveClock from "@/components/LiveClock";
import IzohSelect from "@/components/IzohSelect";
import { useIzohOptions } from "@/lib/useIzohOptions";
import { useAuth } from "@/lib/AuthContext";
import { gaznaForUser } from "@/lib/auth";

import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";

interface Mijoz {
  Mijoz_ID: string; Ism: string; Telefon: string; Valyuta: string; Agent: string;
  Boshlangich_Balans_som?: string; Boshlangich_Balans_dollar?: string;
}
interface Foydalanuvchi {
  Foydalanuvchi_ID: string; Nomi: string;
}
interface Sotuv {
  Sotuv_ID: string; Mijoz_ID: string; Sana: string; Status: string;
  Sotuv_Raqami: string; Agent: string; Izoh: string; Vaqt: string; Chek?: string;
}
interface SotuvSavatRow {
  Savat_ID: string; Sotuv_ID: string; Mahsulot_ID: string;
  Soni: string; Som_Narx: string; Summa_som: string; Kurs: string;
}
interface SotuvSavatDollarRow {
  Savat_ID: string; Sotuv_ID: string; Mahsulot_ID: string;
  Soni: string; Narx: string; Summa: string; Kurs: string;
}
interface STolov {
  Tolov_ID: string; Sotuv_ID: string; Mijoz_ID: string; Agent: string;
  Yil: string; Oy: string; Sana: string; Valyuta: string; Turi: string;
  Som: string; Dollar: string; Summa: string; Summa_dollar: string;
  Izoh: string; Dollar_Kursi: string; Vaqt: string; Check: string;
}

const VALYUTALAR = ["So'm", "Dollar", "Dollar , So'm"];

function num(v: string | number | undefined) {
  return parseFloat(String(v || "0").replace(/\s/g, "").replace(",", ".")) || 0;
}
function isDollarValyuta(v: string) {
  const lv = String(v || "").toLowerCase().trim();
  return lv.includes("dollar") || lv === "$" || lv.includes("usd");
}
function fmtSom(v: number) { return v.toLocaleString("ru-RU") + " so'm"; }
function fmtUsd(v: number) {
  return "$" + v.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function parseDate(s: string) {
  const [d, mo, y] = (s || "").split(".").map(Number);
  return (y || 0) * 10000 + (mo || 0) * 100 + (d || 0);
}
function sanaKey(sana: string) {
  const [d, m, y] = (sana || "").split(".");
  return `${y || "0000"}${(m || "00").padStart(2, "0")}${(d || "00").padStart(2, "0")}`;
}

// ── To'lov formasi uchun (Pul ayirish sahifasidan ko'chirilgan) ──
interface Gazna { Gazna_ID: string; Nomi: string; Turi: string; Shakli?: string; }
const TURI_LIST = ["Naqd","Bank","Karta"];
function uid() { return Math.random().toString(36).slice(2, 10); }
function nowStr() {
  const d = new Date();
  const t = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Tashkent" }));
  const pad = (n: number) => String(n).padStart(2, "0");
  const dd = pad(t.getDate()), mm = pad(t.getMonth()+1), yy = String(t.getFullYear());
  const hh = pad(t.getHours()), mi = pad(t.getMinutes()), ss = pad(t.getSeconds());
  return { sana: `${dd}.${mm}.${yy}`, oy: String(t.getMonth()+1), yil: yy, vaqt: `${hh}:${mi}:${ss}` };
}
function isoToParts(iso: string) { const [y,m,d] = (iso||"").split("-"); return { sana: d+"."+m+"."+y, oy: String(parseInt(m||"1")), yil: y||"" }; }
function sanaToIso(sana: string) { const mm = (sana||"").match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/); return mm ? (mm[3]+"-"+mm[2].padStart(2,"0")+"-"+mm[1].padStart(2,"0")) : ""; }
const SOM_ICON  = (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/></svg>);
const USD_ICON  = (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5.5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>);
const KURS_ICON = (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>);
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
function CurInput({ icon, iconColor, ...rest }: { icon: React.ReactNode; iconColor: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <span style={{ position: "absolute", left: 11, display: "flex", alignItems: "center", pointerEvents: "none", color: iconColor }}>{icon}</span>
      <input {...rest} style={{ ...(rest.style || {}), paddingLeft: 34 }} />
    </div>
  );
}
function GaznaButtons({ accounts, turi, shakli, value, onChange, disabled }: {
  accounts: Gazna[]; turi: "Som" | "Dollar"; shakli?: string; value: string; onChange: (id: string) => void; disabled?: boolean;
}) {
  const byTuri = turi === "Dollar" ? accounts.filter(g => g.Turi === "Dollar") : accounts.filter(g => g.Turi !== "Dollar");
  const shown = disabled ? byTuri.filter(g => g.Gazna_ID === value) : byTuri;
  const filtered = shakli ? shown.filter(g => !g.Shakli || g.Shakli === "Barchasi" || g.Shakli.toLowerCase() === shakli.toLowerCase()) : shown;
  const color = turi === "Dollar" ? "#2563eb" : "var(--primary)";
  const bg    = turi === "Dollar" ? "#eff6ff"  : "#f0fdf4";
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

export default function MijozDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.lavozim === "Admin";

  const [mijoz, setMijoz]           = useState<Mijoz | null>(null);
  const [sotuvlar, setSotuvlar]     = useState<Sotuv[]>([]);
  const [savatMap, setSavatMap]     = useState<Record<string, SotuvSavatRow[]>>({});
  const [savatDolMap, setSavatDolMap] = useState<Record<string, SotuvSavatDollarRow[]>>({});
  const [tolovlar, setTolovlar]     = useState<STolov[]>([]);
  const [agentMap, setAgentMap]     = useState<Record<string, string>>({});
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [isMobile, setIsMobile]     = useState(false);
  const [tick, setTick]             = useState(0);
  const [aktOpen, setAktOpen]       = useState(false);
  const [tgOpen, setTgOpen]         = useState(false);
  const _y = new Date().getFullYear();
  const _todayISO = `${_y}-${String(new Date().getMonth()+1).padStart(2,"0")}-${String(new Date().getDate()).padStart(2,"0")}`;
  const [aktFrom, setAktFrom]       = useState(`${_y}-01-01`);
  const [aktTo, setAktTo]           = useState(_todayISO);

  const [editOpen, setEditOpen]     = useState(false);
  const [form, setForm]             = useState<Partial<Mijoz>>({});
  const [agentlar, setAgentlar]     = useState<Foydalanuvchi[]>([]);
  const [saving, setSaving]         = useState(false);
  const [toggling, setToggling]     = useState<Record<string, boolean>>({});

  // ── Yangi to'lov formasi (To'lovlar tarixi oynasida) ──
  const [tAddOpen, setTAddOpen]       = useState(false);
  const [tSaving, setTSaving]         = useState(false);
  const [tSana, setTSana]             = useState(() => sanaToIso(nowStr().sana));
  const [tValyuta, setTValyuta]       = useState<"Som"|"Dollar">("Som");
  const [tTuri, setTTuri]             = useState("Naqd");
  const [tSumma, setTSumma]           = useState("");
  const [tDollar, setTDollar]         = useState("");
  const [tKurs, setTKurs]             = useState("");
  const [tIzoh, setTIzoh]             = useState("");
  const [tGazna, setTGazna]           = useState("");
  const [tGaznaDollar, setTGaznaDollar] = useState("");
  const [centralKurs, setCentralKurs] = useState("");
  const [gaznalar, setGaznalar]       = useState<Gazna[]>([]);
  const [mijozBalans, setMijozBalans] = useState<{ Qoldi_som: string; Qoldi_dollar: string } | null>(null);
  const tIzohOpts = useIzohOptions("S_tolov");
  useScrollLock(tAddOpen);

  const sotuvRef = useRef<HTMLDivElement>(null);
  const tolovRef = useRef<HTMLDivElement>(null);
  const [flash, setFlash]           = useState<"sotuv" | "tolov" | null>(null);
  const [qFrom, setQFrom]           = useState("");
  const [qTo, setQTo]               = useState("");
  const [qSum, setQSum]             = useState("");
  const [qText, setQText]           = useState("");
  function goSection(target: "sotuv" | "tolov") {
    const ref = target === "sotuv" ? sotuvRef : tolovRef;
    ref.current?.scrollIntoView({ behavior: "smooth", block: isMobile ? "start" : "center" });
    setFlash(target);
    setTimeout(() => setFlash(f => (f === target ? null : f)), 1400);
  }

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => { getCurrentKurs().then(setCentralKurs).catch(() => {}); }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      fetchSheetWhere("Mijozlar", "Mijoz_ID", id),
      fetchSheetWhere("Sotuv", "Mijoz_ID", id),
      fetchSheetWhere("S_tolov", "Mijoz_ID", id).catch(() => ({ headers: [], data: [] })),
      fetchSheet("Foydalanuvchi").catch(() => ({ data: [] })),
      fetchSheetWhere("MijozBalans", "Mijoz_ID", id).catch(() => ({ data: [] })),
    ]).then(async ([mR, sR, tR, fR, bR]) => {
      // Mijoz
      const m = (mR.data as Mijoz[])[0] || null;
      setMijoz(m);
      const bRow = ((bR.data || []) as { Qoldi_som: string; Qoldi_dollar: string }[])[0] || null;
      setMijozBalans(bRow);

      // Sotuvlar for this mijoz, sorted by date desc
      const mySotuv = ((sR.data || []) as Sotuv[]);
      mySotuv.sort((a, b) => parseDate(b.Sana) - parseDate(a.Sana));
      setSotuvlar(mySotuv);
      const sotuvIds = mySotuv.map(s => String(s.Sotuv_ID || "").trim()).filter(Boolean);
      const [svR, sdR] = sotuvIds.length
        ? await Promise.all([
          fetchSheetWhere("Sotuv_Savat", "Sotuv_ID", sotuvIds).catch(() => ({ headers: [], data: [] })),
          fetchSheetWhere("Sotuv_savat_dollar", "Sotuv_ID", sotuvIds).catch(() => ({ headers: [], data: [] })),
        ])
        : [{ data: [] }, { data: [] }];

      // Sotuv_Savat map by Sotuv_ID
      const sm: Record<string, SotuvSavatRow[]> = {};
      ((svR.data || []) as SotuvSavatRow[]).forEach(r => {
        const key = String(r.Sotuv_ID || "").trim();
        if (!key) return;
        if (!sm[key]) sm[key] = [];
        sm[key].push(r);
      });
      setSavatMap(sm);

      // Sotuv_savat_dollar map by Sotuv_ID
      const sdm: Record<string, SotuvSavatDollarRow[]> = {};
      ((sdR.data || []) as SotuvSavatDollarRow[]).forEach(r => {
        const key = String(r.Sotuv_ID || "").trim();
        if (!key) return;
        if (!sdm[key]) sdm[key] = [];
        sdm[key].push(r);
      });
      setSavatDolMap(sdm);

      // S_tolov for this mijoz, sorted desc
      const myTolov = ((tR.data || []) as STolov[]);
      myTolov.sort((a, b) => parseDate(b.Sana) - parseDate(a.Sana));
      setTolovlar(myTolov);

      // Agent map
      const agents = (fR.data || []) as Foydalanuvchi[];
      setAgentlar(agents);
      const aMap: Record<string, string> = {};
      agents.forEach(f => { aMap[f.Foydalanuvchi_ID] = f.Nomi; });
      setAgentMap(aMap);
    })
    .catch(e => setError(e instanceof Error ? e.message : "Xatolik"))
    .finally(() => setLoading(false));
  }, [id, tick]);

  // Stats — qarzga tasdiqlangan sotuvlar (Chek bo'sh emas: TRUE yoki FALSE). Faqat bo'sh (Tasdiqlashga) hisobga olinmaydi.
  const tasdiqSotuv = (sv: Sotuv) => String(sv.Chek||"").trim()!=="";
  const jamiSotuvSom = useMemo(() =>
    sotuvlar.filter(tasdiqSotuv).reduce((s, sv) =>
      s + (savatMap[sv.Sotuv_ID] || []).reduce((ss, r) => ss + num(r.Summa_som), 0), 0),
    [sotuvlar, savatMap]);

  const jamiSotuvDollar = useMemo(() =>
    sotuvlar.filter(tasdiqSotuv).reduce((s, sv) =>
      s + (savatDolMap[sv.Sotuv_ID] || []).reduce((ss, r) => ss + num(r.Summa), 0), 0),
    [sotuvlar, savatDolMap]);

  const tolovSom = useMemo(() =>
    tolovlar.filter(t => !isDollarValyuta(t.Valyuta)).reduce((s, t) => s + num(t.Summa), 0),
    [tolovlar]);
  const tolovDollar = useMemo(() =>
    tolovlar.filter(t => isDollarValyuta(t.Valyuta)).reduce((s, t) => s + num(t.Summa_dollar), 0),
    [tolovlar]);

  const fromKey = qFrom ? qFrom.replace(/-/g, "") : "";
  const toKey   = qTo ? qTo.replace(/-/g, "") : "";
  const sumQ    = qSum.replace(/\D/g, "");
  const textQ   = qText.trim().toLowerCase();
  const qActive = !!(fromKey || toKey || sumQ || textQ);
  const fSotuv = useMemo(() => {
    if (!qActive) return sotuvlar;
    return sotuvlar.filter(s => {
      if (fromKey || toKey) { const k = sanaKey(s.Sana); if ((fromKey && k < fromKey) || (toKey && k > toKey)) return false; }
      if (sumQ) {
        const som = (savatMap[s.Sotuv_ID] || []).reduce((a, r) => a + num(r.Summa_som), 0);
        const usd = (savatDolMap[s.Sotuv_ID] || []).reduce((a, r) => a + num(r.Summa), 0);
        if (!`${Math.round(som)} ${Math.round(usd)}`.includes(sumQ)) return false;
      }
      if (textQ && !`${s.Sotuv_Raqami} ${s.Izoh || ""} ${s.Sana}`.toLowerCase().includes(textQ)) return false;
      return true;
    });
  }, [sotuvlar, savatMap, savatDolMap, fromKey, toKey, sumQ, textQ, qActive]);
  const fTolov = useMemo(() => {
    if (!qActive) return tolovlar;
    return tolovlar.filter(t => {
      if (fromKey || toKey) { const k = sanaKey(t.Sana); if ((fromKey && k < fromKey) || (toKey && k > toKey)) return false; }
      if (sumQ) {
        if (!`${Math.round(num(t.Som))} ${Math.round(num(t.Dollar))} ${Math.round(num(t.Summa))}`.includes(sumQ)) return false;
      }
      if (textQ && !`${t.Turi || ""} ${t.Izoh || ""} ${t.Sana}`.toLowerCase().includes(textQ)) return false;
      return true;
    });
  }, [tolovlar, fromKey, toKey, sumQ, textQ, qActive]);

  const boshlangichSom    = num(mijoz?.Boshlangich_Balans_som);
  const boshlangichDollar = num(mijoz?.Boshlangich_Balans_dollar);
  const qarzSom    = boshlangichSom    + jamiSotuvSom    - tolovSom;
  const qarzDollar = boshlangichDollar + jamiSotuvDollar - tolovDollar;

  // ── Akt-sverka (so'm va $ alohida) ──────────────────────
  function aktSection(cur: "som" | "dollar", fromISO: string, toISO: string): ExportSection | null {
    const fmtA = (v: number) => cur === "som"
      ? v.toLocaleString("ru-RU") + " so'm"
      : v.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $";
    const dkey = (sana: string) => { const [d, m, y] = (sana || "").split("."); return `${y || "0000"}${(m || "00").padStart(2, "0")}${(d || "00").padStart(2, "0")}`; };
    const fromKey = fromISO ? fromISO.replace(/-/g, "") : "";
    const toKey   = toISO   ? toISO.replace(/-/g, "")   : "";
    type Ev = { sana: string; vaqt: string; debit: number; credit: number; tavsif: string };
    const events: Ev[] = [];
    sotuvlar.filter(s => String(s.Chek || "").trim() !== "").forEach(s => {
      const amt = cur === "som"
        ? (savatMap[s.Sotuv_ID] || []).reduce((a, r) => a + num(r.Summa_som), 0)
        : (savatDolMap[s.Sotuv_ID] || []).reduce((a, r) => a + num(r.Summa), 0);
      if (amt > 0) events.push({ sana: s.Sana, vaqt: s.Vaqt || "", debit: amt, credit: 0, tavsif: `Sotuv${s.Sotuv_Raqami ? " #" + s.Sotuv_Raqami : ""}` });
    });
    tolovlar.forEach(t => {
      const isD = isDollarValyuta(t.Valyuta);
      const amt = cur === "som" ? (!isD ? num(t.Summa) : 0) : (isD ? num(t.Summa_dollar) : 0);
      if (amt > 0) events.push({ sana: t.Sana, vaqt: t.Vaqt || "", debit: 0, credit: amt, tavsif: `To'lov${t.Turi ? " (" + t.Turi + ")" : ""}` });
    });
    events.sort((a, b) => (dkey(a.sana) + a.vaqt).localeCompare(dkey(b.sana) + b.vaqt));
    const boshlangich = cur === "som" ? boshlangichSom : boshlangichDollar;
    const opening = boshlangich + events.filter(e => fromKey && dkey(e.sana) < fromKey).reduce((a, e) => a + e.debit - e.credit, 0);
    const inRange = events.filter(e => { const k = dkey(e.sana); return (!fromKey || k >= fromKey) && (!toKey || k <= toKey); });
    if (opening === 0 && inRange.length === 0) return null;
    let run = opening;
    const rows: (string | number)[][] = [["—", "Boshlang'ich qoldiq", "", "", fmtA(opening)]];
    inRange.forEach(e => { run += e.debit - e.credit; rows.push([e.sana, e.tavsif, e.debit ? fmtA(e.debit) : "", e.credit ? fmtA(e.credit) : "", fmtA(run)]); });
    return {
      heading: cur === "som" ? "SO'M HISOBVARAQA" : "DOLLAR ($) HISOBVARAQA",
      headers: ["Sana", "Amaliyot", "Sotuv (qarz)", "To'lov", "Qoldiq"],
      rows,
      foot: ["", "YAKUNIY QOLDIQ", "", "", fmtA(run)],
    };
  }
  function buildAkt(): ExportOpts {
    const ds = (iso: string) => iso ? iso.split("-").reverse().join(".") : "";
    const secs = [aktSection("som", aktFrom, aktTo), aktSection("dollar", aktFrom, aktTo)].filter(Boolean) as ExportSection[];
    return {
      title: `Akt-sverka — ${mijoz?.Ism || ""}`,
      subtitle: `Davr: ${ds(aktFrom) || "boshidan"} — ${ds(aktTo) || "hozirgача"}${mijoz?.Telefon ? "  ·  Tel: " + mijoz.Telefon : ""}`,
      filename: `akt-sverka-${(mijoz?.Ism || "klient").replace(/\s+/g, "_")}-${ds(aktTo).replace(/\./g, "-")}`,
      sections: secs.length ? secs : [{ headers: ["Sana", "Amaliyot", "Sotuv", "To'lov", "Qoldiq"], rows: [["", "Ma'lumot yo'q", "", "", ""]] }],
    };
  }

  // ── Telegramga qarzdorlik ulashish ──────────────────────
  function tgSana() { const d = new Date(); return `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${d.getFullYear()}`; }
  function tgMessage() {
    const lines = ["📋 QARZDORLIK", `Sana: ${tgSana()}`, `Mijoz: ${mijoz?.Ism || ""}`];
    if (qarzSom !== 0)    lines.push(`So'm: ${fmtSom(qarzSom)}`);
    if (qarzDollar !== 0) lines.push(`Dollar: ${fmtUsd(qarzDollar)}`);
    if (qarzSom === 0 && qarzDollar === 0) lines.push("Qarzdorlik yo'q ✅");
    return lines.join("\n");
  }
  function shareTgText() {
    // Matnni url paramiga qo'yamiz — Telegram uni oddiy matn sifatida yuboradi (URL emas → link/preview yo'q),
    // lekin param bo'sh emas, shuning uchun ulashish oynasi ochiladi va userga yuboriladi.
    window.open(`https://t.me/share/url?url=${encodeURIComponent(tgMessage())}`, "_blank");
    setTgOpen(false);
  }
  function buildDebtImage(): Promise<Blob | null> {
    return new Promise(resolve => {
      const W = 680, H = 420;
      const c = document.createElement("canvas"); c.width = W; c.height = H;
      const ctx = c.getContext("2d"); if (!ctx) { resolve(null); return; }
      ctx.fillStyle = "#f0f4ff"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#ffffff"; ctx.fillRect(24, 24, W - 48, H - 48);
      ctx.fillStyle = "#1a2744"; ctx.fillRect(24, 24, W - 48, 70);
      ctx.fillStyle = "#ffffff"; ctx.font = "bold 30px Arial"; ctx.textAlign = "center";
      ctx.fillText("MUSAFFO TEA", W / 2, 68);
      ctx.fillStyle = "#1a2744"; ctx.font = "bold 22px Arial"; ctx.textAlign = "left";
      ctx.fillText("QARZDORLIK", 48, 140);
      ctx.strokeStyle = "#e0e3ef"; ctx.beginPath(); ctx.moveTo(48, 155); ctx.lineTo(W - 48, 155); ctx.stroke();
      let y = 200;
      const row = (label: string, val: string, color: string) => {
        ctx.fillStyle = "#5a6080"; ctx.font = "18px Arial"; ctx.fillText(label, 48, y);
        ctx.fillStyle = color; ctx.font = "bold 24px Arial"; ctx.fillText(val, 230, y); y += 52;
      };
      row("Sana:", tgSana(), "#1a2744");
      row("Mijoz:", mijoz?.Ism || "—", "#2f6bf7");
      if (qarzSom !== 0) row("So'm:", fmtSom(qarzSom), qarzSom > 0 ? "#ef4444" : "#16a34a");
      if (qarzDollar !== 0) row("Dollar:", fmtUsd(qarzDollar), qarzDollar > 0 ? "#ef4444" : "#2563eb");
      if (qarzSom === 0 && qarzDollar === 0) row("Holat:", "Qarzdorlik yo'q", "#16a34a");
      ctx.fillStyle = "#b0b8d0"; ctx.font = "14px Arial"; ctx.textAlign = "center";
      ctx.fillText("musaffotea.uz", W / 2, H - 44);
      c.toBlob(b => resolve(b), "image/png");
    });
  }
  async function shareTgImage() {
    const blob = await buildDebtImage();
    if (!blob) return;
    const file = new File([blob], `qarzdorlik-${(mijoz?.Ism || "klient").replace(/\s+/g,"_")}.png`, { type: "image/png" });
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
    const isMobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    // 1) Telefon: qurilma ulashish oynasi (Telegramga to'g'ridan-to'g'ri)
    if (isMobileDevice && nav.canShare && nav.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text: tgMessage() }); setTgOpen(false); return; }
      catch (e) { if (e instanceof Error && e.name === "AbortError") { setTgOpen(false); return; } }
    }
    // 2) Kompyuter: rasmni buferga nusxalash (Telegram oynasiga Ctrl+V)
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard && navigator.clipboard.write) {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        alert("Rasm nusxalandi ✓ — Telegram oynasiga Ctrl+V bilan qo'ying.");
        setTgOpen(false);
        return;
      }
    } catch { /* clipboard bo'lmasa — pastdagi yuklab olishga o'tamiz */ }
    // 3) Zaxira: yuklab olish
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = file.name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setTgOpen(false);
  }

  async function handleToggleCheck(t: STolov, val: string) {
    setToggling(p => ({ ...p, [t.Tolov_ID]: true }));
    setTolovlar(prev => prev.map(item => item.Tolov_ID === t.Tolov_ID ? { ...item, Check: val } : item));
    try {
      await fetch("/api/sheets", { method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet: "S_tolov", idColumn: "Tolov_ID", idValue: t.Tolov_ID, row: { ...t, Check: val } }) });
    } finally {
      setToggling(p => ({ ...p, [t.Tolov_ID]: false }));
    }
  }

  async function handleSave() {
    if (!mijoz || !form.Ism?.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/sheets", { method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet: "Mijozlar", idColumn: "Mijoz_ID", idValue: mijoz.Mijoz_ID, row: { ...mijoz, ...form } }) });
      setEditOpen(false);
      setTimeout(() => setTick(t => t + 1), 800);
    } finally { setSaving(false); }
  }

  // ── Yangi to'lov (To'lovlar tarixi oynasida) ──
  function autoSelectGazna(turi: string, gz: Gazna[], setSom: (id: string) => void, setDol: (id: string) => void) {
    const somAccs = gz.filter(g => g.Turi !== "Dollar" && (!g.Shakli || g.Shakli === "Barchasi" || g.Shakli === turi));
    if (somAccs.length === 1 || (!isAdmin && somAccs.length > 0)) setSom(somAccs[0].Gazna_ID);
    const dolAccs = gz.filter(g => g.Turi === "Dollar" && (!g.Shakli || g.Shakli === "Barchasi" || g.Shakli === turi));
    if (dolAccs.length === 1 || (!isAdmin && dolAccs.length > 0)) setDol(dolAccs[0].Gazna_ID);
  }
  function selectTTuri(turi: string) {
    setTTuri(turi);
    setTGazna(""); setTGaznaDollar("");
    if (gaznalar.length) autoSelectGazna(turi, gaznaForUser(user, gaznalar), setTGazna, setTGaznaDollar);
  }
  async function openAddTolov() {
    setTSana(sanaToIso(nowStr().sana));
    setTValyuta("Som"); setTTuri("Naqd");
    setTSumma(""); setTDollar("");
    setTKurs(centralKurs || (typeof localStorage !== "undefined" ? localStorage.getItem("dollar_kurs") || "" : ""));
    setTIzoh(""); setTGazna(""); setTGaznaDollar("");
    setTAddOpen(true);
    try {
      const gzR = await fetchSheet("Gazna");
      if (Array.isArray(gzR.data) && gzR.data.length > 0) {
        const gz = (gzR.data as Gazna[]).filter(g => g.Gazna_ID);
        setGaznalar(gz);
        autoSelectGazna("Naqd", gaznaForUser(user, gz), setTGazna, setTGaznaDollar);
      }
    } catch {}
  }
  async function handleAddTolov() {
    if (!mijoz) return;
    const somVal = num(tSumma), usdVal = num(tDollar);
    if (somVal === 0 && usdVal === 0) return;
    if (usdVal > 0 && num(tKurs) < 11000) return;        // Dollar bo'lsa kurs majburiy
    if (!tTuri) return;                                   // To'lov turi majburiy
    if (tValyuta === "Som" ? !tGazna : !tGaznaDollar) return; // Hisob majburiy
    setTSaving(true);
    const { vaqt } = nowStr();
    const { sana, oy, yil } = tSana ? isoToParts(tSana) : nowStr();
    const kurs = num(tKurs);
    const isSom = tValyuta === "Som";
    const summa       = isSom ? String(somVal + usdVal * kurs) : "";
    const summaDollar = !isSom ? String(usdVal + (kurs > 0 ? somVal / kurs : 0)) : "";
    const valyuta     = isSom ? "So'm" : "Dollar";
    // Ostatka = to'lovdan oldingi joriy qarz (sahifadagi JORIY QARZ bilan bir xil — xom ma'lumotdan)
    const ostatkaSom = qarzSom, ostatkaDollar = qarzDollar;
    try {
      const saveRes = await fetch("/api/sheets", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet: "S_tolov", row: {
          Tolov_ID: uid(), Sotuv_ID: "", Mijoz_ID: mijoz.Mijoz_ID, Agent: user?.id || "",
          Yil: yil, Oy: oy, Sana: sana, Valyuta: valyuta, Turi: tTuri,
          Qarz_som: String(ostatkaSom), Qarz_dollar: String(ostatkaDollar),
          Som: String(somVal), Dollar: String(usdVal),
          Summa: summa, Summa_dollar: summaDollar,
          Dollar_Kursi: tKurs, Izoh: tIzoh, Vaqt: vaqt, Check: "False",
          Gazna_ID: tGazna, Gazna_dollar_ID: tGaznaDollar,
        } }) });
      // MUHIM: saqlanganini tasdiqlaymiz — xato bo'lsa to'lov jimgina yo'qolmasin (Telegram ham yuborilmaydi)
      if (!saveRes.ok) { const je = await saveRes.json().catch(() => ({})); throw new Error(je.error || "Server bilan bog'lanishda xatolik"); }
      if (typeof localStorage !== "undefined") localStorage.setItem("dollar_kurs", tKurs);

      // Telegram bot xabari — sotuvga to'lov qilindi
      const nS = (v: number) => String(Math.round(v));
      const nU = (v: number) => String(Math.round(v * 100) / 100);
      const msg =
        `💲✅ Sotuvga to'lov qilindi\n\n` +
        `📅 Sana: ${sana}\n` +
        `👤 Mijoz: ${mijoz.Ism || "—"}\n` +
        `📅 Ostatka(So'm): ${nS(ostatkaSom)}\n` +
        `📅 Ostatka(Dollar): ${nU(ostatkaDollar)}\n` +
        `💵 So'm: ${somVal > 0 ? nS(somVal) : "null"}\n` +
        `💵 Dollar: ${usdVal > 0 ? nU(usdVal) : "null"}\n` +
        `💵 Jami so'm: ${nS(num(summa))}\n` +
        `💵 Jami dollar: ${nU(num(summaDollar))}\n` +
        `💵 Qoldiq (so'm): ${nS(ostatkaSom - num(summa))}\n` +
        `💵 Qoldiq ($): ${nU(ostatkaDollar - num(summaDollar))}\n` +
        `📌 Izoh: ${tIzoh && tIzoh.trim() ? tIzoh : "null"}`;
      fetch("/api/telegram", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: msg, agent: mijoz.Agent || "" }) }).catch(() => {});

      // MijozBalans qoldig'ini yangilaymiz (mavjud bo'lsa)
      if (mijozBalans) {
        try {
          await fetch("/api/sheets", { method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sheet: "MijozBalans", idColumn: "Mijoz_ID", idValue: mijoz.Mijoz_ID,
              row: { Qoldi_som: String(num(mijozBalans.Qoldi_som) - somVal), Qoldi_dollar: String(num(mijozBalans.Qoldi_dollar) - usdVal) } }) });
        } catch {}
      }
      afterWrite("S_tolov");
      afterWrite("MijozBalans");
      setTAddOpen(false);
      setTimeout(() => setTick(t => t + 1), 800);
    } catch (e) {
      alert("To'lov saqlanmadi: " + (e instanceof Error ? e.message : "noma'lum") + ".\nInternet aloqasini tekshirib, qayta urinib ko'ring.");
    } finally { setTSaving(false); }
  }

  if (loading) return (
    <div className="page-content" style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
      <div className="spinner--page"/>
    </div>
  );

  if (error || !mijoz) return (
    <div className="page-content">
      <div className="empty">
        <p className="empty__title">Mijoz topilmadi</p>
        <button className="btn btn--outline" onClick={() => router.back()}>← Orqaga</button>
      </div>
    </div>
  );

  // № sana ustiga stack qilingan (1-ustun), qolganlar orasi columnGap bilan ochiq.
  // IZOH kengroq va o'ralib to'liq ko'rinadi (kesilmaydi).
  const COLS_S  = "96px 84px 1fr 1fr 72px";
  const COLS_T  = "82px 54px 1fr 1fr 1fr 1fr 88px 1.3fr";

  const statPad: React.CSSProperties = isMobile ? { padding: "14px 16px" } : { padding: "20px 24px" };
  const statCard: React.CSSProperties = { background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", ...statPad };
  const statLabel: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".06em", marginBottom: 8 };
  const statVal: React.CSSProperties   = { fontSize: isMobile ? 14 : 17, fontWeight: 800 };

  return (
    <>
      <header className="header">
        <div className="header__inner" style={{ gap: 14 }}>
          <button onClick={() => router.back()}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--white)", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text-2)", flexShrink: 0 }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
            Orqaga
          </button>
          <div style={{ flex: 1 }}/>
          <button onClick={() => setTgOpen(true)} title="Telegramga qarzdorlik yuborish"
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", border: "1.5px solid #229ED9", borderRadius: "var(--radius)", background: "#e9f6fc", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#229ED9", flexShrink: 0 }}>
            <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/></svg>
            {!isMobile && "Telegram"}
          </button>
          <button onClick={() => setAktOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", border: "1.5px solid var(--primary)", borderRadius: "var(--radius)", background: "var(--primary-glow)", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "var(--primary)", flexShrink: 0 }}>
            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            {!isMobile && "Akt-sverka"}
          </button>
          <button onClick={() => { setForm({ ...mijoz }); setEditOpen(true); }}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--white)", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text-2)", flexShrink: 0 }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            {!isMobile && "Tahrirlash"}
          </button>
        </div>
      </header>

      {aktOpen && (
        <div className="modal-overlay" onClick={() => setAktOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal__head">
              <h2 className="modal__title">Akt-sverka — {mijoz?.Ism || ""}</h2>
              <button className="modal__close" onClick={() => setAktOpen(false)}>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="modal__body">
              <p style={{ fontSize: 13, color: "var(--text-2)" }}>Sana oralig'ini tanlang. So&apos;m va $ alohida hisobvaraqada chiqariladi.</p>
              <div className="grid-2">
                <div className="field"><label>Dan</label><input type="date" value={aktFrom} onChange={e => setAktFrom(e.target.value)} /></div>
                <div className="field"><label>Gacha</label><input type="date" value={aktTo} onChange={e => setAktTo(e.target.value)} /></div>
              </div>
            </div>
            <div className="modal__footer">
              <button className="btn btn--outline" style={{ flex: 1 }} onClick={() => { exportExcel(buildAkt()); setAktOpen(false); }}>
                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg> Excel
              </button>
              <button className="btn btn--primary" style={{ flex: 1 }} onClick={() => { exportPDF(buildAkt()); setAktOpen(false); }}>
                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M4 4h9l5 5v11H4V4z"/></svg> PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {tgOpen && (
        <div className="modal-overlay" onClick={() => setTgOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal__head">
              <h2 className="modal__title">Telegramga yuborish</h2>
              <button className="modal__close" onClick={() => setTgOpen(false)}>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="modal__body">
              <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".05em", marginBottom: 8 }}>QARZDORLIK</p>
                <p style={{ fontSize: 13, color: "var(--text-2)" }}>Sana: <b style={{ color: "var(--text)" }}>{tgSana()}</b></p>
                <p style={{ fontSize: 13, color: "var(--text-2)" }}>Mijoz: <b style={{ color: "var(--primary)" }}>{mijoz?.Ism || "—"}</b></p>
                {qarzSom !== 0 && <p style={{ fontSize: 14, fontWeight: 800, color: qarzSom > 0 ? "#ef4444" : "#16a34a", marginTop: 4 }}>So&apos;m: {fmtSom(qarzSom)}</p>}
                {qarzDollar !== 0 && <p style={{ fontSize: 14, fontWeight: 800, color: qarzDollar > 0 ? "#ef4444" : "#2563eb", marginTop: 2 }}>Dollar: {fmtUsd(qarzDollar)}</p>}
                {qarzSom === 0 && qarzDollar === 0 && <p style={{ fontSize: 14, fontWeight: 800, color: "#16a34a", marginTop: 4 }}>Qarzdorlik yo&apos;q ✅</p>}
              </div>
            </div>
            <div className="modal__footer">
              <button className="btn btn--outline" style={{ flex: 1 }} onClick={shareTgText}>
                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 4v-4z"/></svg> Matn
              </button>
              <button className="btn btn--primary" style={{ flex: 1 }} onClick={shareTgImage}>
                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg> Surat
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page-content" style={{ maxWidth: 1320 }}>

        {/* ── Stats ── */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5,1fr)", gap: isMobile ? 10 : 16, marginBottom: isMobile ? 16 : 24 }}>

          {/* 1. Mijoz */}
          <div style={statCard}>
            <p style={statLabel}>MIJOZ</p>
            <p style={{ ...statVal, wordBreak: "break-word", lineHeight: 1.3 }}>{mijoz.Ism}</p>
            {mijoz.Telefon && <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginTop: 4 }}>{mijoz.Telefon}</p>}
            {agentMap[mijoz.Agent] && <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>{agentMap[mijoz.Agent]}</p>}
          </div>

          {/* 2. Jami sotuv som */}
          <div style={{ ...statCard, cursor: "pointer", transition: "box-shadow .15s, transform .15s" }} onClick={() => goSection("sotuv")} title="Sotuvlar ro'yxatiga o'tish"
            onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 20px rgba(30,64,124,.14)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = "var(--shadow-sm)"; e.currentTarget.style.transform = "none"; }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 8 }}>
              <p style={{ ...statLabel, marginBottom: 0 }}>JAMI SOTUV SOM</p>
              <svg width="13" height="13" fill="none" stroke="var(--text-3)" viewBox="0 0 24 24" style={{ flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
            </div>
            {jamiSotuvSom !== 0
              ? <p style={statVal}>{jamiSotuvSom.toLocaleString("ru-RU")} <span style={{ fontSize: 10 }}>so&apos;m</span></p>
              : <p style={{ ...statVal, color: "var(--text-3)" }}>0</p>}
          </div>

          {/* 3. Jami sotuv dollar */}
          <div style={{ ...statCard, cursor: "pointer", transition: "box-shadow .15s, transform .15s" }} onClick={() => goSection("sotuv")} title="Sotuvlar ro'yxatiga o'tish"
            onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 20px rgba(30,64,124,.14)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = "var(--shadow-sm)"; e.currentTarget.style.transform = "none"; }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 8 }}>
              <p style={{ ...statLabel, marginBottom: 0 }}>JAMI SOTUV DOLLAR</p>
              <svg width="13" height="13" fill="none" stroke="var(--text-3)" viewBox="0 0 24 24" style={{ flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
            </div>
            {jamiSotuvDollar !== 0
              ? <p style={{ ...statVal, color: "#2563eb" }}>{fmtUsd(jamiSotuvDollar)}</p>
              : <p style={{ ...statVal, color: "var(--text-3)" }}>$0,00</p>}
          </div>

          {/* 4. To'langan */}
          <div style={{ ...statCard, cursor: "pointer", transition: "box-shadow .15s, transform .15s" }} onClick={() => goSection("tolov")} title="To'lovlar tarixiga o'tish"
            onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 20px rgba(30,64,124,.14)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = "var(--shadow-sm)"; e.currentTarget.style.transform = "none"; }}>
            <p style={statLabel}>TO&apos;LANGAN</p>
            {tolovSom !== 0 && <p style={{ ...statVal, color: "#16a34a" }}>{tolovSom.toLocaleString("ru-RU")} <span style={{ fontSize: 10 }}>so&apos;m</span></p>}
            {tolovDollar !== 0 && <p style={{ fontSize: isMobile ? 13 : 15, fontWeight: 800, color: "#2563eb", marginTop: 4 }}>{fmtUsd(tolovDollar)}</p>}
            {tolovSom === 0 && tolovDollar === 0 && <p style={{ ...statVal, color: "var(--text-3)" }}>0</p>}
          </div>

          {/* 5. Joriy qarz */}
          <div style={statCard}>
            <p style={statLabel}>JORIY QARZ</p>
            {qarzSom !== 0 && <p style={{ ...statVal, color: qarzSom > 0 ? "#ef4444" : "#16a34a" }}>{qarzSom.toLocaleString("ru-RU")} <span style={{ fontSize: 10 }}>so&apos;m</span></p>}
            {qarzDollar !== 0 && <p style={{ fontSize: isMobile ? 13 : 15, fontWeight: 800, color: qarzDollar > 0 ? "#ef4444" : "#16a34a", marginTop: 4 }}>{fmtUsd(qarzDollar)}</p>}
            {qarzSom === 0 && qarzDollar === 0 && <p style={{ ...statVal, color: "#16a34a" }}>0</p>}
          </div>
        </div>

        {/* Sana va summa bo'yicha qidiruv */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", padding: isMobile ? "10px 12px" : "12px 16px", marginBottom: isMobile ? 14 : 16 }}>
          <svg width="16" height="16" fill="none" stroke="var(--text-2)" viewBox="0 0 24 24" style={{ flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3M3 11h18M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z"/></svg>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-2)" }}>Sana:</span>
          <input type="date" value={qFrom} onChange={e => setQFrom(e.target.value)} style={{ padding: "6px 8px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, background: "var(--bg)", color: "var(--text)" }} />
          <span style={{ color: "var(--text-3)" }}>–</span>
          <input type="date" value={qTo} onChange={e => setQTo(e.target.value)} style={{ padding: "6px 8px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, background: "var(--bg)", color: "var(--text)" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-2)", marginLeft: 6 }}>Summa:</span>
          <input type="text" inputMode="numeric" value={qSum} onChange={e => setQSum(e.target.value)} placeholder="masalan 1986000"
            style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, background: "var(--bg)", color: "var(--text)", width: 150 }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-2)", marginLeft: 6 }}>Qidiruv:</span>
          <input type="text" value={qText} onChange={e => setQText(e.target.value)} placeholder="Raqam, izoh..."
            style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, background: "var(--bg)", color: "var(--text)", width: 150 }} />
          {qActive && (
            <button onClick={() => { setQFrom(""); setQTo(""); setQSum(""); setQText(""); }} style={{ padding: "6px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--white)", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "flex", alignItems: "center", gap: 4 }}>
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg> Tozalash
            </button>
          )}
          {qActive && <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-3)", marginLeft: "auto" }}>{fSotuv.length} sotuv · {fTolov.length} to&apos;lov</span>}
        </div>

        {/* Sotuvlar va To'lovlar — yonma-yon */}
        <div style={{ display: isMobile ? "block" : "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "start" }}>

        {/* ── Sotuvlar ── */}
        <div ref={sotuvRef} style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: flash === "sotuv" ? "0 0 0 3px var(--primary)" : "var(--shadow-sm)", overflow: "hidden", marginBottom: isMobile ? 16 : 0, transition: "box-shadow .25s", scrollMarginTop: 80 }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>Sotuvlar soni: {fSotuv.length} ta</span>
          </div>

          {fSotuv.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>{qActive ? "Mos sotuv topilmadi" : "Sotuv topilmadi"}</div>
          ) : isMobile ? (
            <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
              {fSotuv.map((s, i) => {
                const svRows  = savatMap[s.Sotuv_ID]    || [];
                const sdRows  = savatDolMap[s.Sotuv_ID] || [];
                const somAmt  = svRows.reduce((acc, r) => acc + num(r.Summa_som), 0);
                const usdAmt  = sdRows.reduce((acc, r) => acc + num(r.Summa), 0);
                const isTasdiqlandi = String(s.Chek||"").trim()!=="";
                return (
                  <div key={s.Sotuv_ID} onClick={() => router.push(`/sotuv/${s.Sotuv_ID}`)}
                    style={{ background: isTasdiqlandi ? "#86efac" : "#fde047", borderRadius: "var(--radius)", padding: "12px 14px", cursor: "pointer", border: `1px solid ${isTasdiqlandi ? "#14532d" : "#a16207"}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700 }}>#{i + 1}</span>
                        {s.Sotuv_Raqami && (
                          <span style={{ fontSize: 12, fontWeight: 800, color: "var(--primary)", background: "#f0fdf4", padding: "2px 8px", borderRadius: 6 }}>#{s.Sotuv_Raqami}</span>
                        )}
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{s.Sana || "—"}</span>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
                        background: isTasdiqlandi ? "#16a34a" : "#ca8a04", color: "#fff" }}>
                        {isTasdiqlandi ? "Ha" : "Yo'q"}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: isTasdiqlandi ? "#14532d" : "#713f12" }}>{somAmt !== 0 ? fmtSom(somAmt) : "0 so'm"}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: isTasdiqlandi ? "#14532d" : "#713f12" }}>{usdAmt !== 0 ? fmtUsd(usdAmt) : "$0,00"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}><div style={{ minWidth: 520 }}>
              <div style={{ display: "grid", gridTemplateColumns: COLS_S, columnGap: 14, padding: "10px 16px", background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
                {["SANA", "RAQAM", "SUMMA (SO'M)", "SUMMA ($)", "AKT"].map(h => (
                  <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".04em" }}>{h}</span>
                ))}
              </div>
              {fSotuv.map((s, i) => {
                const svRows  = savatMap[s.Sotuv_ID]    || [];
                const sdRows  = savatDolMap[s.Sotuv_ID] || [];
                const somAmt  = svRows.reduce((acc, r) => acc + num(r.Summa_som), 0);
                const usdAmt  = sdRows.reduce((acc, r) => acc + num(r.Summa), 0);
                const isTasdiqlandi = String(s.Chek||"").trim()!=="";
                const tc = isTasdiqlandi ? "#14532d" : "#713f12";
                return (
                  <div key={s.Sotuv_ID} onClick={() => router.push(`/sotuv/${s.Sotuv_ID}`)}
                    style={{ display: "grid", gridTemplateColumns: COLS_S, columnGap: 14, padding: "14px 16px", alignItems: "center", borderBottom: i < fSotuv.length - 1 ? "1px solid var(--border)" : "none", cursor: "pointer", background: isTasdiqlandi ? "#86efac" : "#fde047" }}
                    onMouseEnter={e => (e.currentTarget.style.background = isTasdiqlandi ? "#4ade80" : "#facc15")}
                    onMouseLeave={e => (e.currentTarget.style.background = isTasdiqlandi ? "#86efac" : "#fde047")}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontSize: 10, color: tc, fontWeight: 700, opacity: .65 }}>№{i + 1}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: tc }}>{s.Sana || "—"}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: tc, background: "rgba(255,255,255,.55)", padding: "2px 8px", borderRadius: 6, display: "inline-block" }}>
                      {s.Sotuv_Raqami ? `#${s.Sotuv_Raqami}` : "—"}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: tc }}>{somAmt !== 0 ? somAmt.toLocaleString("ru-RU") : "0"}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: tc }}>{usdAmt !== 0 ? fmtUsd(usdAmt) : "$0,00"}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6, display: "inline-block",
                      background: isTasdiqlandi ? "#16a34a" : "#ca8a04", color: "#fff" }}>
                      {isTasdiqlandi ? "Ha" : "Yo'q"}
                    </span>
                  </div>
                );
              })}
            </div></div>
          )}
        </div>

        {/* ── S_tolov tarixi ── */}
        <div ref={tolovRef} style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: flash === "tolov" ? "0 0 0 3px var(--primary)" : "var(--shadow-sm)", overflow: "hidden", transition: "box-shadow .25s", scrollMarginTop: 80 }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>To&apos;lovlar tarixi</span>
            <button onClick={openAddTolov}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: "var(--radius)", border: "none", background: "var(--primary)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
              <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              To&apos;lov
            </button>
          </div>

          {fTolov.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>{qActive ? "Mos to'lov topilmadi" : "To'lov topilmadi"}</div>
          ) : isMobile ? (
            <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
              {fTolov.map((t, i) => {
                const somVal  = num(t.Som);
                const usdVal  = num(t.Dollar);
                const jamiSom = num(t.Summa);
                const jamiDollar = num(t.Summa_dollar);
                const isHa    = t.Check === "True" || t.Check === "true";
                // Find matching sotuv raqam
                const matchSotuv = t.Sotuv_ID ? sotuvlar.find(s => s.Sotuv_ID === t.Sotuv_ID) : null;
                return (
                  <div key={t.Tolov_ID || i} onClick={() => router.push(`/sotuv/tolov/${t.Tolov_ID}`)}
                    style={{ background: isHa ? "#86efac" : "#fca5a5", borderRadius: "var(--radius)", padding: "12px 14px", border: `1px solid ${isHa ? "#14532d" : "#7f1d1d"}`, cursor: "pointer" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700 }}>#{i + 1}</span>
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{t.Sana || "—"}</span>
                        {t.Turi && <span style={{ fontSize: 11, background: "#f1f5f9", padding: "1px 7px", borderRadius: 10, color: "var(--text-2)", fontWeight: 600 }}>{t.Turi}</span>}
                        {matchSotuv && (
                          <span style={{ fontSize: 11, color: "var(--primary)", fontWeight: 800, background: "#f0fdf4", padding: "1px 7px", borderRadius: 6 }}>
                            #{matchSotuv.Sotuv_Raqami}
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
                        {(["True", "False"] as const).map(val => {
                          const isActive = val === "True" ? isHa : !isHa;
                          return (
                            <button key={val} disabled={toggling[t.Tolov_ID]}
                              onClick={() => handleToggleCheck(t, val)}
                              style={{ padding: "2px 9px", fontSize: 11, fontWeight: 700, borderRadius: 6, border: "none", cursor: "pointer",
                                background: isActive ? (val === "True" ? "#16a34a" : "#ef4444") : "#f1f5f9",
                                color: isActive ? "#fff" : "var(--text-3)", opacity: toggling[t.Tolov_ID] ? 0.6 : 1 }}>
                              {val === "True" ? "Ha" : "Yo'q"}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: isHa ? "#14532d" : "#7f1d1d" }}>{somVal !== 0 ? fmtSom(somVal) : "0 so'm"}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: isHa ? "#14532d" : "#7f1d1d" }}>{usdVal !== 0 ? fmtUsd(usdVal) : "$0,00"}</span>
                      {jamiSom !== 0 && <span style={{ fontSize: 12, fontWeight: 700, color: isHa ? "#14532d" : "#7f1d1d" }}>{fmtSom(jamiSom)}</span>}
                      {jamiDollar !== 0 && <span style={{ fontSize: 12, fontWeight: 700, color: isHa ? "#14532d" : "#7f1d1d" }}>{fmtUsd(jamiDollar)}</span>}
                    </div>
                    {t.Izoh && <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>{t.Izoh}</p>}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}><div style={{ minWidth: 680 }}>
              <div style={{ display: "grid", gridTemplateColumns: COLS_T, columnGap: 12, padding: "10px 16px", background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
                {["SANA", "TURI", "SO'M", "DOLLAR", "JAMI (SO'M)", "JAMI ($)", "AKT", "IZOH"].map(h => (
                  <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".04em" }}>{h}</span>
                ))}
              </div>
              {fTolov.map((t, i) => {
                const somVal  = num(t.Som);
                const usdVal  = num(t.Dollar);
                const jamiSom = num(t.Summa);
                const jamiDollar = num(t.Summa_dollar);
                const isHa    = t.Check === "True" || t.Check === "true";
                const tc = isHa ? "#14532d" : "#7f1d1d";
                return (
                  <div key={t.Tolov_ID || i} onClick={() => router.push(`/sotuv/tolov/${t.Tolov_ID}`)}
                    style={{ display: "grid", gridTemplateColumns: COLS_T, columnGap: 12, padding: "14px 16px", alignItems: "center", borderBottom: i < fTolov.length - 1 ? "1px solid var(--border)" : "none", background: isHa ? "#86efac" : "#fca5a5", cursor: "pointer" }}
                    onMouseEnter={e => (e.currentTarget.style.background = isHa ? "#4ade80" : "#f87171")}
                    onMouseLeave={e => (e.currentTarget.style.background = isHa ? "#86efac" : "#fca5a5")}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontSize: 10, color: tc, fontWeight: 700, opacity: .65 }}>№{i + 1}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: tc }}>{t.Sana || "—"}</span>
                    </div>
                    <span style={{ fontSize: 11, background: t.Turi ? "rgba(255,255,255,.55)" : "transparent", padding: t.Turi ? "2px 6px" : 0, borderRadius: 10, fontWeight: 700, color: tc, display: "inline-block" }}>
                      {t.Turi || "—"}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: tc }}>{somVal !== 0 ? somVal.toLocaleString("ru-RU") : "0"}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: tc }}>{usdVal !== 0 ? fmtUsd(usdVal) : "$0,00"}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: tc }}>{jamiSom !== 0 ? jamiSom.toLocaleString("ru-RU") : "0"}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: tc }}>{jamiDollar !== 0 ? fmtUsd(jamiDollar) : "$0,00"}</span>
                    <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
                      {(["True", "False"] as const).map(val => {
                        const isActive = val === "True" ? isHa : !isHa;
                        return (
                          <button key={val} disabled={toggling[t.Tolov_ID]}
                            onClick={() => handleToggleCheck(t, val)}
                            style={{ padding: "3px 10px", fontSize: 11, fontWeight: 700, borderRadius: 6, border: "none", cursor: "pointer",
                              background: isActive ? (val === "True" ? "#16a34a" : "#ef4444") : "#f1f5f9",
                              color: isActive ? "#fff" : "var(--text-3)", opacity: toggling[t.Tolov_ID] ? 0.6 : 1 }}>
                            {val === "True" ? "Ha" : "Yo'q"}
                          </button>
                        );
                      })}
                    </div>
                    <span title={t.Izoh || ""} style={{ fontSize: 12, color: tc, whiteSpace: "normal", wordBreak: "break-word", lineHeight: 1.3 }}>{t.Izoh || "—"}</span>
                  </div>
                );
              })}
            </div></div>
          )}
        </div>
        </div>
      </div>

      {/* ── Edit drawer ── */}
      {editOpen && (
        <>
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,42,76,.42)", backdropFilter: "blur(4px)", zIndex: 999 }} onClick={() => setEditOpen(false)}/>
          <div style={{
            position: "fixed",
            ...(isMobile
              ? { bottom: 0, left: 0, right: 0, borderRadius: "20px 20px 0 0", maxHeight: "85vh", overflowY: "auto" }
              : { top: 0, right: 0, width: 380, height: "100%", overflowY: "auto" }),
            background: "var(--white)", zIndex: 1000, padding: "24px 20px",
            display: "flex", flexDirection: "column", gap: 16,
            boxShadow: "-16px 0 48px rgba(30,64,124,.18)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 16, fontWeight: 800 }}>Tahrirlash</span>
              <button onClick={() => setEditOpen(false)}
                style={{ border: "none", background: "none", cursor: "pointer", padding: 4, fontSize: 18, color: "var(--text-3)" }}>✕</button>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 6 }}>Ism</label>
              <input value={String(form.Ism || "")} onChange={e => setForm(p => ({ ...p, Ism: e.target.value }))} autoFocus
                style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 14, background: "var(--bg)", boxSizing: "border-box" }}/>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 6 }}>Telefon</label>
              <input value={String(form.Telefon || "")} onChange={e => setForm(p => ({ ...p, Telefon: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 14, background: "var(--bg)", boxSizing: "border-box" }}/>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 6 }}>Valyuta</label>
              <select value={String(form.Valyuta || "So'm")} onChange={e => setForm(p => ({ ...p, Valyuta: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 14, background: "var(--bg)" }}>
                {VALYUTALAR.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 6 }}>Agent</label>
              <select value={String(form.Agent || "")} onChange={e => setForm(p => ({ ...p, Agent: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 14, background: "var(--bg)" }}>
                <option value="">— Agent tanlanmagan —</option>
                {agentlar.map(a => <option key={a.Foydalanuvchi_ID} value={a.Foydalanuvchi_ID}>{a.Nomi}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 6 }}>Boshlang&apos;ich qoldiq (so&apos;m)</label>
              <input value={String(form.Boshlangich_Balans_som || "")} onChange={e => setForm(p => ({ ...p, Boshlangich_Balans_som: e.target.value }))} placeholder="0" inputMode="decimal"
                style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 14, background: "var(--bg)", boxSizing: "border-box" }}/>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 6 }}>Boshlang&apos;ich qoldiq ($)</label>
              <input value={String(form.Boshlangich_Balans_dollar || "")} onChange={e => setForm(p => ({ ...p, Boshlangich_Balans_dollar: e.target.value }))} placeholder="0" inputMode="decimal"
                style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 14, background: "var(--bg)", boxSizing: "border-box" }}/>
            </div>
            <button onClick={handleSave} disabled={saving || !form.Ism?.trim()}
              style={{ marginTop: 8, padding: 11, background: "var(--primary)", color: "#fff", border: "none", borderRadius: "var(--radius)", fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {saving && <span className="spinner"/>}
              {saving ? "Saqlanmoqda..." : "Saqlash"}
            </button>
          </div>
        </>
      )}

      {/* ── Yangi to'lov modal (To'lovlar tarixi oynasidan) ── */}
      {tAddOpen && (() => {
        const accounts = gaznaForUser(user, gaznalar);
        const mq = { som: qarzSom, usd: qarzDollar };
        const s = num(tSumma), d = num(tDollar), k = num(tKurs);
        const isSom = tValyuta === "Som";
        const res = isSom ? s + d * k : d + (k > 0 ? s / k : 0);
        const paidSom = isSom ? s + d * k : 0;
        const paidUsd = !isSom ? d + (k > 0 ? s / k : 0) : 0;
        const canSave = !tSaving && (num(tSumma) !== 0 || num(tDollar) !== 0) && !(num(tDollar) > 0 && num(tKurs) < 11000) && !!tTuri && (isSom ? !!tGazna : !!tGaznaDollar);
        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(15,42,76,.42)", backdropFilter: "blur(4px)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", padding: isMobile ? 0 : 20 }}
            onClick={() => { if (!tSaving) setTAddOpen(false); }}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: "var(--white)", width: "100%", maxWidth: isMobile ? "100%" : 620, borderRadius: isMobile ? "20px 20px 0 0" : 16, display: "flex", flexDirection: "column", maxHeight: isMobile ? "94dvh" : "92vh" }}>
              {isMobile && <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--border)", margin: "12px auto 0" }}/>}
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#16a34a" }}>{KASSA_ICON}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 800 }}>Yangi to&apos;lov</h2>
                  <p style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{mijoz.Ism}</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textAlign: "center" }}>Sana</span>
                  <input type="date" value={tSana} onChange={e => setTSana(e.target.value)} style={{ fontSize: 12, fontWeight: 600, padding: "6px 8px", border: "1px solid var(--border)", borderRadius: "var(--radius)", outline: "none", textAlign: "center" }}/>
                </div>
                {!isMobile && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textAlign: "center" }}>Vaqt</span>
                    <LiveClock style={{ color: "var(--text-3)" }}/>
                  </div>
                )}
                <button onClick={() => setTAddOpen(false)} style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid var(--border)", background: "var(--white)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
              {/* Body */}
              <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
                {/* Qoldiq */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius)", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".04em" }}>QOLDIQ:</span>
                  {mq.som === 0 && mq.usd === 0
                    ? <span style={{ fontSize: 15, fontWeight: 800, color: "#16a34a" }}>0</span>
                    : <>
                        {mq.som !== 0 && <span style={{ fontSize: 15, fontWeight: 800, color: mq.som > 0 ? "#ef4444" : "#16a34a" }}>{mq.som.toLocaleString("ru-RU")} so&apos;m</span>}
                        {mq.usd !== 0 && <span style={{ fontSize: 13, fontWeight: 700, color: mq.usd > 0 ? "#ef4444" : "#16a34a" }}>≈ {fmtUsd(mq.usd)}</span>}
                      </>}
                </div>
                {/* Valyuta */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 8 }}>Valyuta</label>
                  <div style={{ display: "flex", borderRadius: "var(--radius)", overflow: "hidden", border: "1.5px solid var(--border)" }}>
                    {(["Som","Dollar"] as const).map(v => (
                      <button key={v} onClick={() => {
                        setTValyuta(v);
                        if (v === "Som") {
                          const acc = accounts.filter(g => g.Turi !== "Dollar");
                          if (acc.length === 1 || (!isAdmin && acc.length > 0)) setTGazna(acc[0].Gazna_ID);
                          setTGaznaDollar("");
                        } else {
                          const acc = accounts.filter(g => g.Turi === "Dollar");
                          if (acc.length === 1 || (!isAdmin && acc.length > 0)) setTGaznaDollar(acc[0].Gazna_ID);
                          setTGazna("");
                        }
                      }}
                        style={{ flex: 1, padding: "10px", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", background: tValyuta === v ? (v === "Som" ? "var(--primary)" : "#2563eb") : "var(--white)", color: tValyuta === v ? "#fff" : "var(--text-3)", borderRight: v === "Som" ? "1.5px solid var(--border)" : "none" }}>
                        {v === "Som" ? "So'm" : "Dollar"}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Inputs */}
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 6 }}>So&apos;m</label>
                    <CurInput icon={SOM_ICON} iconColor="var(--primary)" value={tSumma} onChange={e => setTSumma((e.target.value.includes("-")?"-":"")+e.target.value.replace(/\D/g,""))} placeholder="0" type="number"
                      style={{ width: "100%", padding: "10px 12px", border: "1.5px solid var(--primary)", borderRadius: "var(--radius)", fontSize: 14, fontWeight: 700, outline: "none", boxSizing: "border-box" }}/>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#2563eb", display: "block", marginBottom: 6 }}>Dollar</label>
                    <CurInput icon={USD_ICON} iconColor="#2563eb" value={tDollar} onChange={e => setTDollar((e.target.value.includes("-")?"-":"")+e.target.value.replace(/[^\d.]/g,"").replace(/(\..*)\./g,"$1"))} placeholder="0.00" type="number"
                      style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #2563eb", borderRadius: "var(--radius)", fontSize: 14, fontWeight: 700, outline: "none", color: "#2563eb", boxSizing: "border-box" }}/>
                  </div>
                  <div style={{ gridColumn: isMobile ? "1 / -1" : undefined }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: (num(tDollar) > 0 && num(tKurs) < 11000) ? "#ef4444" : "var(--text-2)", display: "block", marginBottom: 6 }}>Dollar kursi {num(tDollar) > 0 && <span style={{ color: "#ef4444" }}>*</span>}</label>
                    <CurInput icon={KURS_ICON} iconColor="#16a34a" value={tKurs} onChange={e => setTKurs(e.target.value.replace(/\D/g,""))} placeholder="Min: 11 000" inputMode="numeric"
                      style={{ width: "100%", padding: "10px 12px", border: `1.5px solid ${(num(tDollar) > 0 && num(tKurs) < 11000) ? "#ef4444" : "var(--border)"}`, borderRadius: "var(--radius)", fontSize: 14, fontWeight: 600, outline: "none", boxSizing: "border-box" }}/>
                  </div>
                </div>
                {/* Jami + keyingi qoldiq */}
                {res !== 0 && (
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ flex: "1 1 200px", display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: isSom ? "#f0fdf4" : "#eff6ff", borderRadius: "var(--radius)" }}>
                      <span style={{ width: 34, height: 34, borderRadius: 9, background: "var(--white)", display: "flex", alignItems: "center", justifyContent: "center", color: isSom ? "#16a34a" : "#2563eb", flexShrink: 0 }}>{KASSA_ICON}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)" }}>Jami to&apos;lov</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: isSom ? "#16a34a" : "#2563eb" }}>{isSom ? res.toLocaleString("ru-RU") + " so'm" : fmtUsd(res)}</div>
                      </div>
                    </div>
                    <div style={{ flex: "1 1 200px", display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "#f8fafc", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
                      <span style={{ width: 34, height: 34, borderRadius: 9, background: "var(--white)", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563eb", flexShrink: 0 }}>{CALC_ICON}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)" }}>To&apos;lovdan keyingi qoldiq</div>
                        <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                          {((mq.som - paidSom) !== 0 || (mq.usd - paidUsd) === 0) && <span style={{ fontSize: 15, fontWeight: 800, color: (mq.som - paidSom) > 0 ? "#ef4444" : "#16a34a" }}>{(mq.som - paidSom).toLocaleString("ru-RU")} so&apos;m</span>}
                          {(mq.usd - paidUsd) !== 0 && <span style={{ fontSize: 13, fontWeight: 700, color: (mq.usd - paidUsd) > 0 ? "#ef4444" : "#16a34a" }}>≈ {fmtUsd(mq.usd - paidUsd)}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {/* Turi */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 8 }}>To&apos;lov turi</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {TURI_LIST.map(t => {
                      const active = tTuri === t;
                      return (
                        <button key={t} onClick={() => selectTTuri(t)}
                          style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px 8px", borderRadius: "var(--radius)", border: `1.5px solid ${active ? "#2563eb" : "var(--border)"}`, background: active ? "#eff6ff" : "var(--white)", fontSize: 13, fontWeight: 700, cursor: "pointer", color: active ? "var(--text)" : "var(--text-2)" }}>
                          <span style={{ display: "flex", color: t === "Naqd" ? "#16a34a" : t === "Bank" ? "#64748b" : "#7c3aed" }}>{turiIcon(t)}</span>
                          {t}
                          {active && <span style={{ position: "absolute", top: 7, right: 7, display: "flex" }}>{CHECK_ICON}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* Hisob (Gazna) */}
                {isSom ? (
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: !tGazna ? "#ef4444" : "var(--text-2)", display: "block", marginBottom: 8 }}>Hisob (So&apos;m) <span style={{ color: "#ef4444" }}>*</span></label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <GaznaButtons accounts={accounts} turi="Som" shakli={tTuri} value={tGazna} onChange={setTGazna} disabled={!isAdmin} />
                    </div>
                    {!tGazna && <p style={{ fontSize: 11, fontWeight: 600, color: "#ef4444", marginTop: 6 }}>Hisob tanlang</p>}
                  </div>
                ) : (
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: !tGaznaDollar ? "#ef4444" : "#2563eb", display: "block", marginBottom: 8 }}>Hisob (Dollar) <span style={{ color: "#ef4444" }}>*</span></label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <GaznaButtons accounts={accounts} turi="Dollar" shakli={tTuri} value={tGaznaDollar} onChange={setTGaznaDollar} disabled={!isAdmin} />
                    </div>
                    {!tGaznaDollar && <p style={{ fontSize: 11, fontWeight: 600, color: "#ef4444", marginTop: 6 }}>Hisob tanlang</p>}
                  </div>
                )}
                {/* Izoh */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 6 }}>Izoh</label>
                  <IzohSelect value={tIzoh} onChange={v => setTIzoh(v)} options={tIzohOpts} placeholder="Izoh yozing (ixtiyoriy)..." textarea rows={2} maxLength={255}
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 14, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", minHeight: 56 }}/>
                </div>
              </div>
              {/* Footer */}
              <div style={{ display: "flex", gap: 10, padding: "16px 20px", borderTop: "1px solid var(--border)", paddingBottom: isMobile ? "max(16px, env(safe-area-inset-bottom))" : 16 }}>
                <button className="btn btn--outline" style={{ flex: 1 }} onClick={() => setTAddOpen(false)}>Bekor</button>
                <button className="btn btn--primary" style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={handleAddTolov} disabled={!canSave}>
                  {tSaving ? <span className="spinner"/> : <span style={{ display: "flex" }}>{SAVE_ICON}</span>} Saqlash
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
