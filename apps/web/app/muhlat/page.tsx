"use client";
import { fetchSheet, afterWrite, invalidateSheet } from "@/lib/sheet-cache";
import { useAuth } from "@/lib/AuthContext";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { mijozlarQoldigi, type Qoldiq } from "@/lib/mijoz-ledger";
import { statusOchirilgan } from "@/lib/taminotchi-nom";
import { useScrollLock } from "@/lib/use-scroll-lock";
import {
  MUHLAT, MUHLAT_UZAYTIRISH, TURI_MIJOZ, TURI_FIRMA, BAJARILDI, ESLATMA_SOATI, KECH_SOATI,
  type Muhlat, type MuhlatUzaytirish, yangiMuhlat, yangiUzaytirish,
  sanaIso, isoSana, kunFarqi, isoQosh, toshkentHozir, uzaytirishSoni,
} from "@/lib/muhlat";

// ── Muhlat belgilash ──
// Mijoz (to'lov va'dasi) va Firma (ta'minotchiga to'lov muddati) yonma-yon.
// Forma: muhlat belgilangan sana, mijoz/ta'minotchi, va'da qilingan sana, izoh.
// Mijoz va'da qilingan kunda to'lay olmasa — "Uzaytirish": yangi va'da sanasi + sabab
// (har bir uzaytirish Muhlat_Uzaytirish jadvalida tarix bo'lib qoladi).
// Telegram (lib/muhlat-eslatma.ts): 08:00 da bugun va'da qilgan MIJOZLAR, 20:00 da va'dasini bajarmaganlar.

interface Mijoz { Mijoz_ID: string; Ism: string; Telefon?: string }
interface Taminotchi { Taminotchi_ID: string; Ism: string; Telefon?: string; Status?: string }
type Item = { id: string; nomi: string; tel: string };

function uid() { return Math.random().toString(36).slice(2, 10); }
function tr(v: unknown) { return String(v ?? "").trim(); }
function fmtSom(v: number) { return Math.round(v).toLocaleString("ru-RU") + " so'm"; }
function fmtUsd(v: number) { return "$" + v.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function qarzMatni(q: Qoldiq): string {
  const p: string[] = [];
  if (Math.round(q.som) !== 0) p.push(fmtSom(q.som));
  if (Math.round(q.usd * 100) !== 0) p.push(fmtUsd(q.usd));
  return p.length ? p.join(" · ") : "yo'q";
}
function faolmi(m: Muhlat) { return tr(m.Status) !== BAJARILDI; }
function hozirVaqt() { const h = toshkentHozir(); return `${h.sana} ${h.vaqt}`; }
/** "DD.MM.YYYY HH:MM:SS" -> xronologik kalit */
function vaqtKalit(v: string) { const [d = "", t = ""] = tr(v).split(" "); return `${sanaIso(d)} ${t}`; }
/** Joriy va'dadan keyingi va bugundan oldin bo'lmagan eng erta yangi sana */
function uzaytirishMin(m: Muhlat, bugun: string) {
  const t = sanaIso(m.Tugash);
  const keyingi = t ? isoQosh(t, 1) : bugun;
  return keyingi > bugun ? keyingi : bugun;
}

type Holat = { matn: string; rang: string; fon: string; ramka: string; kun: number | null };
function holatOf(m: Muhlat, bugun: string): Holat {
  if (!faolmi(m)) return { matn: "Bajarildi", rang: "#0369a1", fon: "#f0f9ff", ramka: "#bae6fd", kun: null };
  const iso = sanaIso(m.Tugash);
  if (!iso) return { matn: "Sana noto'g'ri", rang: "var(--text-3)", fon: "var(--bg)", ramka: "var(--border)", kun: null };
  const k = kunFarqi(bugun, iso);
  if (k < 0) return { matn: `${-k} kun o'tdi`, rang: "#b91c1c", fon: "#fef2f2", ramka: "#fecaca", kun: k };
  if (k === 0) return { matn: "Bugun", rang: "#b45309", fon: "#fffbeb", ramka: "#fcd34d", kun: k };
  if (k <= 3) return { matn: `${k} kun qoldi`, rang: "#b45309", fon: "#fffbeb", ramka: "#fde68a", kun: k };
  return { matn: `${k} kun qoldi`, rang: "#15803d", fon: "#f0fdf4", ramka: "#bbf7d0", kun: k };
}

const LABEL: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "var(--text-3)", display: "block", marginBottom: 5, letterSpacing: ".04em" };
const INPUT: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: 13, background: "var(--white)", color: "var(--text)", outline: "none", boxSizing: "border-box" };
const CHIP: React.CSSProperties = { padding: "3px 9px", fontSize: 11, fontWeight: 700, borderRadius: 20, border: "1px solid var(--border)", background: "var(--white)", color: "var(--text-2)", cursor: "pointer", whiteSpace: "nowrap" };

function Karta({ label, val, rang, fon, isMobile }: { label: string; val: number; rang: string; fon: string; isMobile: boolean }) {
  return (
    <div style={{ flex: "1 1 150px", background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", padding: isMobile ? "13px 15px" : "16px 20px" }}>
      <p style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".05em", marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: isMobile ? 20 : 24, fontWeight: 800, color: rang, background: fon, display: "inline-block", padding: "0 8px", borderRadius: 8 }}>{val}</p>
    </div>
  );
}

// ─────────────────────────── Qidiruvli tanlash (bitta maydon) ───────────────────────────
// Ilovadagi SearchSelect uslubi: maydon bosilganda ichida qidiruv bilan ro'yxat ochiladi.
// Nom yoki telefon bo'yicha qidiradi; ↑ ↓ Enter bilan tanlanadi, Esc ro'yxatni yopadi (oynani emas).
function TanlashMaydoni({ items, value, onChange, placeholder, acc }: {
  items: Item[]; value: string; onChange: (id: string) => void; placeholder: string; acc: string;
}) {
  const [q, setQ] = useState("");
  const [ochiq, setOchiq] = useState(false);
  const [faol, setFaol] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const tugmaRef = useRef<HTMLButtonElement>(null);
  const royxatRef = useRef<HTMLDivElement>(null);
  const tanlangan = items.find(i => i.id === value);

  useEffect(() => {
    if (!ochiq) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOchiq(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [ochiq]);

  const mos = useMemo(() => {
    const s = q.trim().toLowerCase();
    const sRaqam = s.replace(/[^\d]/g, "");
    const r = s ? items.filter(i => i.nomi.toLowerCase().includes(s) || (!!sRaqam && i.tel.replace(/[^\d]/g, "").includes(sRaqam))) : items;
    return r.slice(0, 100);
  }, [items, q]);

  useEffect(() => {
    if (ochiq) royxatRef.current?.querySelector<HTMLElement>(`[data-i="${faol}"]`)?.scrollIntoView({ block: "nearest" });
  }, [faol, ochiq]);

  function tanla(id: string) {
    onChange(id); setOchiq(false); setQ("");
    tugmaRef.current?.focus();
  }
  function klaviatura(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setFaol(f => Math.min(f + 1, Math.max(0, mos.length - 1))); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setFaol(f => Math.max(f - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (mos[faol]) tanla(mos[faol].id); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setOchiq(false); tugmaRef.current?.focus(); }
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button ref={tugmaRef} type="button" onClick={() => { setOchiq(o => !o); setQ(""); setFaol(0); }}
        style={{ ...INPUT, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", textAlign: "left",
          border: `1px solid ${value || ochiq ? acc : "var(--border)"}`, fontSize: 13.5, fontWeight: tanlangan ? 600 : 400, color: tanlangan ? "var(--text)" : "var(--text-3)" }}>
        <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0, color: "var(--text-3)" }}><circle cx="11" cy="11" r="7" strokeWidth={2}/><path strokeLinecap="round" strokeWidth={2} d="M20 20l-3.5-3.5"/></svg>
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tanlangan ? tanlangan.nomi : placeholder}</span>
        {tanlangan?.tel && <span style={{ fontSize: 11.5, fontWeight: 500, color: "var(--text-3)", flexShrink: 0 }}>{tanlangan.tel}</span>}
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0, color: "var(--text-3)", transform: ochiq ? "rotate(180deg)" : "none", transition: "transform .15s" }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      {ochiq && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 300, background: "var(--white)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow-lg)", overflow: "hidden" }}>
          <div style={{ padding: 8, borderBottom: "1px solid var(--border)" }}>
            <input autoFocus value={q} onChange={e => { setQ(e.target.value); setFaol(0); }} onKeyDown={klaviatura}
              placeholder="Qidirish (nom yoki telefon)..." style={{ ...INPUT, padding: "8px 10px" }}/>
          </div>
          <div ref={royxatRef} style={{ maxHeight: 240, overflowY: "auto", overscrollBehavior: "contain" }} onTouchMove={e => e.stopPropagation()}>
            {mos.length === 0
              ? <div style={{ padding: "12px 14px", fontSize: 13, color: "var(--text-3)" }}>Topilmadi</div>
              : mos.map((i, k) => (
                <div key={i.id} data-i={k} onMouseDown={e => e.preventDefault()} onClick={() => tanla(i.id)} onMouseEnter={() => setFaol(k)}
                  style={{ padding: "9px 14px", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                    background: k === faol ? "var(--bg)" : "transparent", fontWeight: i.id === value ? 700 : 500, color: i.id === value ? acc : "var(--text)" }}>
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.nomi}</span>
                  {i.tel && <span style={{ fontSize: 11.5, fontWeight: 500, color: "var(--text-3)", flexShrink: 0 }}>{i.tel}</span>}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── Yangi muhlat formasi (oyna) ───────────────────────────
type SaqlashMalumoti = { entId: string; nomi: string; belgilanganIso: string; vadaIso: string; izoh: string };

interface FormaProps {
  turi: string;
  items: Item[];
  bugun: string;                 // ISO (Toshkent)
  band: Set<string>;
  qarzlar: Record<string, Qoldiq>;
  onSave: (f: SaqlashMalumoti) => Promise<boolean>;
  onQarzKerak: (id: string) => void;
  onYop: () => void;
  onSaqlandi: () => void;
}

// Oyna faqat ochiq paytda mount bo'ladi — har ochilganda forma toza (bugungi sana bilan) boshlanadi
function MuhlatForma(p: FormaProps) {
  useScrollLock(true);
  const mijozmi = p.turi === TURI_MIJOZ;
  const acc = mijozmi ? "#2563eb" : "#7c3aed";
  const accFon = mijozmi ? "#eff6ff" : "#f5f3ff";
  const [entId, setEntId] = useState("");
  // Belgilangan sana: foydalanuvchi o'zgartirmaguncha har doim BUGUN
  const [belgilanganQolda, setBelgilanganQolda] = useState("");
  const belgilangan = belgilanganQolda || p.bugun;
  const [vada, setVada] = useState("");
  const [izoh, setIzoh] = useState("");

  const tanlangan = useMemo(() => p.items.find(i => i.id === entId), [p.items, entId]);

  const bandmi = p.band.has(p.turi);
  const belgilanganXato = belgilangan > p.bugun;
  const vadaXato = !!vada && vada < belgilangan;
  const tayyor = !!entId && !!vada && !vadaXato && !belgilanganXato && !bandmi;

  async function saqla() {
    if (!tayyor) return;
    const ok = await p.onSave({ entId, nomi: tanlangan?.nomi || "", belgilanganIso: belgilangan, vadaIso: vada, izoh: izoh.trim() });
    if (ok) p.onSaqlandi();
  }
  const yop = () => { if (!bandmi) p.onYop(); };

  // Fon bosilganda yopiladi — lekin faqat bosish HAM fonda boshlangan bo'lsa (inputda matn belgilab,
  // sichqonchani oyna tashqarisida qo'yib yuborganda forma yopilib, kiritilgan ma'lumot yo'qolmasin)
  const fonBosildi = useRef(false);
  // Klaviatura: oyna ochilganda fokus ichkariga o'tadi; Tab oyna ichida aylanadi; Esc yopadi
  const oynaRef = useRef<HTMLDivElement>(null);
  useEffect(() => { oynaRef.current?.focus(); }, []);
  function klaviatura(e: React.KeyboardEvent) {
    if (e.key === "Escape") { e.stopPropagation(); yop(); return; }
    if (e.key !== "Tab" || !oynaRef.current) return;
    const el = Array.from(oynaRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]"));
    if (!el.length) return;
    const birinchi = el[0], oxirgi = el[el.length - 1];
    const hozir = document.activeElement;
    if (e.shiftKey && (hozir === birinchi || hozir === oynaRef.current)) { e.preventDefault(); oxirgi.focus(); }
    else if (!e.shiftKey && hozir === oxirgi) { e.preventDefault(); birinchi.focus(); }
  }

  return (
    <div className="modal-overlay"
      onMouseDown={e => { fonBosildi.current = e.target === e.currentTarget; }}
      onClick={e => { if (fonBosildi.current && e.target === e.currentTarget) yop(); fonBosildi.current = false; }}>
      <div className="modal" ref={oynaRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Muhlat belgilash"
        onKeyDown={klaviatura} onClick={e => e.stopPropagation()} style={{ maxWidth: 480, outline: "none" }}>
        <div className="modal__head">
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <h2 className="modal__title">Muhlat belgilash</h2>
            <span style={{ fontSize: 11, fontWeight: 800, color: acc, background: accFon, padding: "3px 10px", borderRadius: 20, letterSpacing: ".04em" }}>
              {mijozmi ? "MIJOZ" : "FIRMA"}
            </span>
          </div>
          <button className="modal__close" onClick={yop} aria-label="Yopish">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="modal__body">
          <div>
            <label style={LABEL}>MUHLAT BELGILANGAN SANA *</label>
            <input type="date" value={belgilangan} max={p.bugun} onChange={e => setBelgilanganQolda(e.target.value === p.bugun ? "" : e.target.value)}
              style={{ ...INPUT, padding: "9px 10px", border: `1px solid ${belgilanganXato ? "#ef4444" : acc}`, cursor: "pointer" }}/>
            {belgilanganXato && <p style={{ fontSize: 11, color: "#b91c1c", marginTop: 4 }}>Kelajakdagi sana bo&apos;lmaydi</p>}
          </div>

          <div>
            <label style={LABEL}>{mijozmi ? "MIJOZ" : "TA'MINOTCHI"} *</label>
            <TanlashMaydoni items={p.items} value={entId} acc={acc}
              placeholder={mijozmi ? "Mijozni qidiring va tanlang..." : "Ta'minotchini qidiring va tanlang..."}
              onChange={v => { setEntId(v); if (mijozmi && v) p.onQarzKerak(v); }}/>
            {mijozmi && entId && (
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginTop: 6 }}>
                Joriy qarz:{" "}
                {p.qarzlar[entId]
                  ? <b style={{ color: p.qarzlar[entId].som > 0 || p.qarzlar[entId].usd > 0 ? "#b91c1c" : "#15803d" }}>{qarzMatni(p.qarzlar[entId])}</b>
                  : <span style={{ color: "var(--text-3)" }}>yuklanmoqda…</span>}
              </p>
            )}
          </div>

          <div>
            <label style={{ ...LABEL, color: vadaXato ? "#b91c1c" : LABEL.color }}>{mijozmi ? "VA'DA QILINGAN SANA" : "MUHLAT TUGASHI"} *</label>
            <input type="date" value={vada} min={belgilangan} onChange={e => setVada(e.target.value)}
              style={{ ...INPUT, padding: "9px 10px", border: `1px solid ${vadaXato ? "#ef4444" : vada ? acc : "var(--border)"}`, cursor: "pointer" }}/>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
              {([[1, "Ertaga"], [3, "3 kun"], [7, "1 hafta"], [14, "2 hafta"]] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setVada(isoQosh(toshkentHozir().iso, k))} style={CHIP}>
                  {l} · {isoSana(isoQosh(p.bugun, k)).slice(0, 5)}
                </button>
              ))}
            </div>
            {vadaXato && <p style={{ fontSize: 11, color: "#b91c1c", marginTop: 4 }}>Va&apos;da sanasi belgilangan sanadan oldin bo&apos;lmaydi</p>}
          </div>

          <div>
            <label style={LABEL}>IZOH</label>
            <input value={izoh} onChange={e => setIzoh(e.target.value)} placeholder="Ixtiyoriy..." maxLength={255}
              style={{ ...INPUT, padding: "9px 12px" }}/>
          </div>
        </div>

        <div className="modal__footer">
          <button className="btn btn--outline" style={{ flex: 1 }} disabled={bandmi} onClick={yop}>Bekor</button>
          <button className="btn btn--primary" disabled={!tayyor} onClick={saqla}
            style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              ...(tayyor ? { background: acc, borderColor: acc } : {}) }}>
            {bandmi && <span className="spinner"/>} Saqlash
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── Panel (Mijoz / Firma) ───────────────────────────
interface PanelProps {
  turi: string;
  royxat: Muhlat[];
  items: Item[];
  bugun: string;                 // ISO (Toshkent), har daqiqada yangilanadi
  loading: boolean;
  band: Set<string>;             // band amallar: turi (forma) yoki Muhlat_ID (qator)
  qarzlar: Record<string, Qoldiq>;
  tarix: Record<string, MuhlatUzaytirish[]>;
  onSave: (f: SaqlashMalumoti) => Promise<boolean>;
  onToggle: (m: Muhlat) => void;
  onExtend: (m: Muhlat) => void;
  onDelete: (m: Muhlat) => void;
  onQarzKerak: (id: string) => void;
  onOpen: (m: Muhlat) => void;
}

function MuhlatPanel(p: PanelProps) {
  const mijozmi = p.turi === TURI_MIJOZ;
  const acc = mijozmi ? "#2563eb" : "#7c3aed";
  const accFon = mijozmi ? "#eff6ff" : "#f5f3ff";
  const [formaOchiq, setFormaOchiq] = useState(false);
  const [korinish, setKorinish] = useState<"faol" | "bajarilgan">("faol");
  const [ochiqTarix, setOchiqTarix] = useState<Record<string, boolean>>({});

  const itemMap = useMemo(() => { const m: Record<string, Item> = {}; p.items.forEach(i => { m[i.id] = i; }); return m; }, [p.items]);
  const faollar = p.royxat.filter(faolmi);
  const bajarilganlar = p.royxat.filter(m => !faolmi(m));
  const korinadi = korinish === "faol" ? faollar : bajarilganlar;

  return (
    <div style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", overflow: "hidden", minWidth: 0 }}>
      <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: acc, background: accFon, padding: "3px 10px", borderRadius: 20, letterSpacing: ".04em" }}>
          {mijozmi ? "MIJOZ" : "FIRMA"}
        </span>
        <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-3)" }}>{faollar.length} ta faol muhlat</p>
        <span style={{ flex: 1 }}/>
        <button type="button" onClick={() => setFormaOchiq(true)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: "var(--radius)", border: "none", background: acc, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
          <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          Muhlat qo&apos;shish
        </button>
      </div>

      {/* ── Ro'yxat ── */}
      <div style={{ display: "flex", gap: 6, padding: "10px 18px", borderBottom: "1px solid var(--border)" }}>
        {([["faol", `Faol (${faollar.length})`], ["bajarilgan", `Bajarilgan (${bajarilganlar.length})`]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setKorinish(k)}
            style={{ ...CHIP, fontSize: 12, padding: "4px 12px", border: `1px solid ${korinish === k ? acc : "var(--border)"}`, background: korinish === k ? accFon : "var(--white)", color: korinish === k ? acc : "var(--text-2)" }}>
            {l}
          </button>
        ))}
      </div>
      <div style={{ maxHeight: "min(70vh, 720px)", overflowY: "auto" }}>
        {korinadi.length === 0 ? (
          <p style={{ padding: "26px 18px", fontSize: 13, color: "var(--text-3)", textAlign: "center" }}>
            {p.loading ? "Yuklanmoqda…" : korinish === "faol" ? "Faol muhlat yo'q — «Muhlat qo'shish» tugmasini bosing" : "Bajarilgan muhlat yo'q"}
          </p>
        ) : korinadi.map((m, i) => {
          const h = holatOf(m, p.bugun);
          const yopilgan = !faolmi(m);
          const n = uzaytirishSoni(m);
          const tarix = p.tarix[m.Muhlat_ID] || [];
          const ochiq = !!ochiqTarix[m.Muhlat_ID];
          const item = itemMap[tr(mijozmi ? m.Mijoz_ID : m.Taminotchi_ID)];
          const nomi = item?.nomi || tr(m.Nomi) || "—";
          const qarz = mijozmi ? p.qarzlar[tr(m.Mijoz_ID)] : undefined;
          const band = p.band.has(m.Muhlat_ID);
          return (
            <div key={m.Muhlat_ID} style={{ padding: "11px 18px", borderBottom: i < korinadi.length - 1 ? "1px solid var(--border)" : "none", opacity: yopilgan ? 0.7 : 1,
              background: h.kun === 0 ? "#fffbeb" : "transparent" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span onClick={() => p.onOpen(m)} title={mijozmi ? "Mijoz sahifasiga o'tish" : "Ta'minotchi sahifasiga o'tish"}
                  style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer",
                    textDecoration: yopilgan ? "line-through" : "none" }}>
                  {nomi}
                </span>
                <span style={{ fontSize: 11, fontWeight: 800, color: h.rang, background: h.fon, border: `1px solid ${h.ramka}`, padding: "2px 9px", borderRadius: 20, whiteSpace: "nowrap" }}>
                  {h.matn}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12, color: "var(--text-2)", fontWeight: 600 }}>
                <span style={{ whiteSpace: "nowrap" }}>{tr(m.Boshlanish) || "—"} → {mijozmi ? "va'da" : "muddat"}: <b style={{ color: "var(--text)" }}>{tr(m.Tugash) || "—"}</b></span>
                {n > 0 && (
                  <button type="button" onClick={() => setOchiqTarix(s => ({ ...s, [m.Muhlat_ID]: !s[m.Muhlat_ID] }))}
                    title="Uzaytirish tarixi"
                    style={{ ...CHIP, padding: "1px 8px", border: "1px solid #fde68a", background: "#fffbeb", color: "#b45309" }}>
                    ⟳ {n} marta uzaytirilgan {ochiq ? "▴" : "▾"}
                  </button>
                )}
                {tr(m.Eslatildi) && <span title="Telegramga eslatilgan kun" style={{ fontSize: 11, color: "var(--text-3)", whiteSpace: "nowrap" }}>🔔 {tr(m.Eslatildi)}</span>}
                {yopilgan && tr(m.Yopilgan_Sana) && <span style={{ fontSize: 11, color: "#0369a1", whiteSpace: "nowrap" }}>✓ {tr(m.Yopilgan_Sana)}</span>}
              </div>

              {(qarz || item?.tel) && !yopilgan && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 3, fontSize: 12, fontWeight: 600 }}>
                  {qarz && <span style={{ color: qarz.som > 0 || qarz.usd > 0 ? "#b91c1c" : "#15803d" }}>Qarz: {qarzMatni(qarz)}</span>}
                  {item?.tel && <a href={`tel:${item.tel.replace(/[^\d+]/g, "")}`} style={{ color: "var(--text-2)", textDecoration: "none" }}>📞 {item.tel}</a>}
                </div>
              )}
              {tr(m.Izoh) && <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 3, wordBreak: "break-word" }}>· {m.Izoh}</p>}

              {ochiq && (
                <div style={{ marginTop: 6, padding: "6px 10px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, display: "flex", flexDirection: "column", gap: 3 }}>
                  {tr(m.Asl_Tugash) && <span style={{ fontSize: 11.5, color: "var(--text-3)", fontWeight: 600 }}>Birinchi {mijozmi ? "va'da" : "muddat"}: {tr(m.Asl_Tugash)}</span>}
                  {tarix.map(u => (
                    <span key={u.Uzaytirish_ID} style={{ fontSize: 11.5, color: "var(--text-2)" }}>
                      <b>{tr(u.Sana)}</b>: {tr(u.Eski_sana)} → <b>{tr(u.Yangi_sana)}</b>{tr(u.Izoh) ? ` · ${tr(u.Izoh)}` : ""}
                    </span>
                  ))}
                  {tarix.length < n && <span style={{ fontSize: 11, color: "var(--text-3)" }}>{n - tarix.length} ta uzaytirish tarixi yozilmagan</span>}
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
                <button onClick={() => p.onToggle(m)} disabled={band}
                  title={yopilgan ? "Qayta faollashtirish" : mijozmi ? "Mijoz to'ladi — yopish" : "To'landi — yopish"}
                  style={{ ...CHIP, border: `1px solid ${yopilgan ? "var(--border)" : "#bbf7d0"}`, background: yopilgan ? "var(--white)" : "#f0fdf4", color: yopilgan ? "var(--text-2)" : "#15803d", opacity: band ? 0.6 : 1 }}>
                  {yopilgan ? "↩ Qaytarish" : "✓ Bajarildi"}
                </button>
                {!yopilgan && (
                  <button onClick={() => p.onExtend(m)} disabled={band} title="Yangi va'da sanasi belgilash"
                    style={{ ...CHIP, border: "1px solid #fde68a", background: "#fffbeb", color: "#b45309", opacity: band ? 0.6 : 1 }}>
                    ⟳ Uzaytirish
                  </button>
                )}
                <span style={{ flex: 1 }}/>
                <button onClick={() => p.onDelete(m)} title="O'chirish" aria-label="O'chirish" disabled={band}
                  style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #fecaca", background: "#fef2f2", color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: band ? 0.6 : 1 }}>
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {formaOchiq && (
        <MuhlatForma turi={p.turi} items={p.items} bugun={p.bugun} band={p.band} qarzlar={p.qarzlar}
          onSave={p.onSave} onQarzKerak={p.onQarzKerak}
          onYop={() => setFormaOchiq(false)}
          onSaqlandi={() => { setFormaOchiq(false); setKorinish("faol"); }}/>
      )}
    </div>
  );
}

// ─────────────────────────── Sahifa ───────────────────────────
export default function MuhlatPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [bugun, setBugun] = useState(() => toshkentHozir().iso);
  const [yangilash, setYangilash]       = useState(0);
  const [muhlatlar, setMuhlatlar]       = useState<Muhlat[]>([]);
  const [uzaytirishlar, setUzaytirish]  = useState<MuhlatUzaytirish[]>([]);
  const [mijozlar, setMijozlar]         = useState<Mijoz[]>([]);
  const [taminotchilar, setTam]         = useState<Taminotchi[]>([]);
  const [qarzlar, setQarzlar]           = useState<Record<string, Qoldiq>>({});
  const [loading, setLoading]           = useState(true);
  const [yuklashXato, setYuklashXato]   = useState(false);
  const [isMobile, setIsMobile]         = useState(false);
  const [ochirish, setOchirish]         = useState<Muhlat | null>(null);
  const [ochirilmoqda, setOchirilmoqda] = useState(false);
  // Uzaytirish oynasi
  const [uzaytir, setUzaytir]           = useState<Muhlat | null>(null);
  const [uzYangi, setUzYangi]           = useState("");
  const [uzIzoh, setUzIzoh]             = useState("");
  const [uzSaqlanmoqda, setUzSaqlanmoqda] = useState(false);
  // Sana uzaytirildi, lekin tarix yozilmay qoldi — "Tarixni saqlash" faqat shuni qayta yozadi
  const [uzKutilayotgan, setUzKutilayotgan] = useState<MuhlatUzaytirish | null>(null);

  // Yozuvlar hisoblagichi: fon yangilanishi yo'lda bo'lganda yozuv bo'lsa, eski natija ekranga qo'yilmaydi
  const yozuvlarSoni = useRef(0);
  const birinchiYuklandi = useRef(false);

  // Band amallar (ikki marta bosish / bir vaqtdagi amallar bir-birini ochib yubormasin)
  const bandRef = useRef<Set<string>>(new Set());
  const [band, setBand] = useState<Set<string>>(new Set());
  const boshla = useCallback((k: string) => {
    if (bandRef.current.has(k)) return false;
    bandRef.current.add(k); setBand(new Set(bandRef.current)); return true;
  }, []);
  const tugat = useCallback((k: string) => { bandRef.current.delete(k); setBand(new Set(bandRef.current)); }, []);

  useEffect(() => {
    const c = () => setIsMobile(window.innerWidth < 768);
    c(); window.addEventListener("resize", c);
    return () => window.removeEventListener("resize", c);
  }, []);

  // "Bugun" jonli: tab tunda ochiq qolsa ham sanalar to'g'ri; tabga qaytilganda ma'lumot yangilanadi
  useEffect(() => {
    const tekshir = () => { const b = toshkentHozir().iso; setBugun(x => (x === b ? x : b)); };
    const korinish = () => { if (document.visibilityState === "visible") { tekshir(); setYangilash(x => x + 1); } };
    const id = window.setInterval(tekshir, 60_000);
    document.addEventListener("visibilitychange", korinish);
    window.addEventListener("focus", tekshir);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", korinish); window.removeEventListener("focus", tekshir); };
  }, []);

  useEffect(() => {
    let bekor = false;
    const boshlanganda = yozuvlarSoni.current;
    // Muhlat jadvallari kichik — har safar serverdan yangi (cron yoki boshqa oyna o'zgarishlari ko'rinsin)
    invalidateSheet(MUHLAT);
    invalidateSheet(MUHLAT_UZAYTIRISH);
    type Natija = { headers?: string[]; data?: unknown[]; error?: string } | null;
    // O'qish muvaffaqiyatli bo'lsagina qabul qilinadi: tarmoq/server xatosi ko'rinib turgan ro'yxatni
    // bo'shatib yubormasin. (Jadval hali yaratilmagan bo'lsa birinchi yuklashda bo'sh ro'yxat to'g'ri.)
    const qabul = (r: Natija) => !!r && !r.error && ((r.headers || []).length > 0 || !birinchiYuklandi.current);
    Promise.all([
      fetchSheet(MUHLAT).catch((): Natija => null),
      fetchSheet(MUHLAT_UZAYTIRISH).catch((): Natija => null),
      fetchSheet("Mijozlar").catch((): Natija => null),
      fetchSheet("Taminotchi").catch((): Natija => null),
    ]).then(([mR, uR, mjR, tR]) => {
      if (bekor) return;
      // Yuklash davomida shu oynada yozuv bo'lgan bo'lsa — natija eskirgan: qayta yuklaymiz
      if (yozuvlarSoni.current !== boshlanganda) { setYangilash(x => x + 1); return; }
      setYuklashXato(!mR || !!mR.error);
      if (qabul(mR)) setMuhlatlar(((mR?.data || []) as Muhlat[]).filter(x => tr(x.Muhlat_ID)));
      if (qabul(uR)) setUzaytirish(((uR?.data || []) as MuhlatUzaytirish[]).filter(x => tr(x.Uzaytirish_ID) && tr(x.Muhlat_ID)));
      if (mjR && !mjR.error && (mjR.headers || []).length) setMijozlar(((mjR.data || []) as Mijoz[]).filter(x => tr(x.Mijoz_ID) && tr(x.Ism)));
      if (tR && !tR.error && (tR.headers || []).length) setTam(((tR.data || []) as Taminotchi[]).filter(x => tr(x.Taminotchi_ID) && tr(x.Ism) && !statusOchirilgan(x.Status)));
      birinchiYuklandi.current = true;
    }).finally(() => { if (!bekor) setLoading(false); });
    return () => { bekor = true; };
  }, [yangilash]);

  // Faol mijoz muhlatlaridagi mijozlarning JORIY qarzi (ledger bilan bir xil hisob, bitta to'plam so'rov)
  const sorovlar = useRef<Set<string>>(new Set());
  const faolMijozIds = useMemo(() => [...new Set(muhlatlar.filter(m => faolmi(m) && tr(m.Turi) === TURI_MIJOZ).map(m => tr(m.Mijoz_ID)).filter(Boolean))].sort(), [muhlatlar]);
  const qarzKalit = faolMijozIds.join(",");
  useEffect(() => {
    if (!qarzKalit) return;
    const ids = qarzKalit.split(",");
    ids.forEach(id => sorovlar.current.add(id));
    // Natija keyinroq kelsa ham saqlanadi (har mijoz alohida kalit) — "yuklanmoqda…"da qotib qolmasin
    mijozlarQoldigi(ids)
      .then(r => setQarzlar(q => ({ ...q, ...r })))
      .catch(() => { ids.forEach(id => sorovlar.current.delete(id)); });
  }, [qarzKalit, yangilash]);
  // Formada tanlangan mijoz uchun (ro'yxatda bo'lmasa) — har mijoz uchun bir marta
  const qarzKerak = useCallback((id: string) => {
    if (!id || sorovlar.current.has(id)) return;
    sorovlar.current.add(id);
    mijozlarQoldigi([id])
      .then(r => setQarzlar(x => ({ ...x, ...r })))
      .catch(() => { sorovlar.current.delete(id); });
  }, []);

  const tarixMap = useMemo(() => {
    const m: Record<string, MuhlatUzaytirish[]> = {};
    uzaytirishlar.forEach(u => { (m[tr(u.Muhlat_ID)] = m[tr(u.Muhlat_ID)] || []).push(u); });
    Object.values(m).forEach(arr => arr.sort((a, b) => vaqtKalit(a.Qoshilgan_Vaqt).localeCompare(vaqtKalit(b.Qoshilgan_Vaqt))));
    return m;
  }, [uzaytirishlar]);

  async function yoz(method: "POST" | "PUT" | "DELETE", body: object): Promise<boolean> {
    try {
      const r = await fetch("/api/sheets", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      return r.ok;
    } catch { return false; }
  }
  /** Qatorni serverdan YANGIDAN o'qiydi (boshqa oyna/cron o'zgarishlari ustidan yozmaslik uchun).
   *  undefined = o'qib bo'lmadi, null = qator o'chirilgan */
  async function yangiQator(id: string): Promise<Muhlat | null | undefined> {
    try {
      const r = await fetch(`/api/sheets?range=${MUHLAT}&filterColumn=Muhlat_ID&filterValue=${encodeURIComponent(id)}`, { cache: "no-store" });
      if (!r.ok) return undefined;
      const d = await r.json() as { headers?: string[]; data?: Muhlat[] };
      if (!(d.headers || []).length) return undefined;
      return (d.data || [])[0] || null;
    } catch { return undefined; }
  }
  /** Serverdagi holat ekrandagidan farq qilsa — ekranni yangilab, foydalanuvchiga aytadi */
  function farqliBolsaTaqqosla(m: Muhlat, f: Muhlat | null | undefined): f is Muhlat {
    if (f === undefined) { alert("Server bilan bog'lanib bo'lmadi, qayta urinib ko'ring."); return false; }
    if (f === null) {
      alert("Bu muhlat boshqa joyda o'chirilgan.");
      setMuhlatlar(p => p.filter(x => x.Muhlat_ID !== m.Muhlat_ID));
      return false;
    }
    if (tr(f.Status) !== tr(m.Status) || tr(f.Tugash) !== tr(m.Tugash) || uzaytirishSoni(f) !== uzaytirishSoni(m)) {
      setMuhlatlar(p => p.map(x => x.Muhlat_ID === m.Muhlat_ID ? { ...x, ...f } : x));
      alert("Bu muhlat boshqa joyda o'zgartirilgan — ekran yangilandi, qaytadan tekshiring.");
      return false;
    }
    return true;
  }
  // Faqat O'ZGARGAN ustunlar yoziladi: butun qator yozilsa, cron qo'ygan "Eslatildi" belgisi
  // (yoki boshqa oynadagi o'zgarish) eski qiymat bilan ustidan yozilib ketardi.
  async function yangila(id: string, updates: Partial<Muhlat>, asos?: Muhlat): Promise<boolean> {
    yozuvlarSoni.current++;
    if (!(await yoz("PUT", { sheet: MUHLAT, idColumn: "Muhlat_ID", idValue: id, updates }))) return false;
    afterWrite(MUHLAT);
    setMuhlatlar(p => p.map(x => x.Muhlat_ID === id ? { ...x, ...(asos || {}), ...updates } : x));
    return true;
  }

  async function saqla(turi: string, f: { entId: string; nomi: string; belgilanganIso: string; vadaIso: string; izoh: string }): Promise<boolean> {
    const tugash = isoSana(f.vadaIso), boshlanish = isoSana(f.belgilanganIso);
    if (!f.entId || !tugash || !boshlanish) return false;
    if (f.belgilanganIso > toshkentHozir().iso) { alert("Muhlat belgilangan sana kelajakda bo'lmaydi."); return false; }
    if (f.vadaIso < f.belgilanganIso) { alert("Va'da sanasi belgilangan sanadan oldin bo'lmaydi."); return false; }
    if (!boshla(turi)) return false;
    try {
      const row = yangiMuhlat({
        Muhlat_ID: uid(),
        Turi: turi,
        Mijoz_ID: turi === TURI_MIJOZ ? f.entId : "",
        Taminotchi_ID: turi === TURI_FIRMA ? f.entId : "",
        Nomi: f.nomi,
        Boshlanish: boshlanish,
        Tugash: tugash,
        Asl_Tugash: tugash,
        Izoh: f.izoh,
        Yil: f.belgilanganIso.slice(0, 4),
        Oy: String(parseInt(f.belgilanganIso.slice(5, 7), 10)),
        Qoshdi: user?.pochta || "",
        Qoshilgan_Vaqt: hozirVaqt(),
      });
      yozuvlarSoni.current++;
      if (!(await yoz("POST", { sheet: MUHLAT, row }))) { alert("Muhlat saqlanmadi. Internetni tekshirib, qayta urinib ko'ring."); return false; }
      afterWrite(MUHLAT);
      setMuhlatlar(p => [...p, row]);
      return true;
    } finally { tugat(turi); }
  }

  async function holatAlmashtir(m: Muhlat) {
    if (!boshla(m.Muhlat_ID)) return;
    try {
      const f = await yangiQator(m.Muhlat_ID);
      if (!farqliBolsaTaqqosla(m, f)) return;
      const yangi = faolmi(f) ? BAJARILDI : "";
      const ok = await yangila(m.Muhlat_ID, { Status: yangi, Yopilgan_Sana: yangi ? toshkentHozir().sana : "",
        Oxirgi_ozgartirdi: user?.pochta || "", Oxirgi_Ozgarish: hozirVaqt() }, f);
      if (!ok) alert("Saqlanmadi, qayta urinib ko'ring.");
    } finally { tugat(m.Muhlat_ID); }
  }

  // ── Uzaytirish ──
  const uzMin = useMemo(() => (uzaytir ? uzaytirishMin(uzaytir, bugun) : bugun), [uzaytir, bugun]);
  const uzAsos = useMemo(() => {
    const t = uzaytir ? sanaIso(uzaytir.Tugash) : "";
    return t && t > bugun ? t : bugun;
  }, [uzaytir, bugun]);
  function uzaytirishniOch(m: Muhlat) { setUzaytir(m); setUzYangi(""); setUzIzoh(""); setUzKutilayotgan(null); }
  function uzaytirishniYop() { if (!uzSaqlanmoqda) { setUzaytir(null); setUzKutilayotgan(null); } }

  async function tarixniYoz(q: MuhlatUzaytirish): Promise<boolean> {
    yozuvlarSoni.current++;
    if (!(await yoz("POST", { sheet: MUHLAT_UZAYTIRISH, row: q }))) return false;
    afterWrite(MUHLAT_UZAYTIRISH);
    setUzaytirish(p => [...p, q]);
    return true;
  }

  async function uzaytirSaqla() {
    if (!uzaytir) return;
    const m = uzaytir;
    if (!boshla(m.Muhlat_ID)) return;
    setUzSaqlanmoqda(true);
    try {
      // Oldingi urinishda sana uzaytirilgan, faqat tarix yozilmagan — faqat tarixni qayta yozamiz
      if (uzKutilayotgan) {
        if (await tarixniYoz(uzKutilayotgan)) { setUzKutilayotgan(null); setUzaytir(null); }
        else alert("Tarix yana saqlanmadi. Internetni tekshirib, qayta bosing.");
        return;
      }
      const f = await yangiQator(m.Muhlat_ID);
      if (!farqliBolsaTaqqosla(m, f)) { setUzaytir(null); return; }
      const minS = uzaytirishMin(f, toshkentHozir().iso);
      if (!uzYangi || uzYangi < minS) { alert(`Yangi sana ${isoSana(minS)} dan oldin bo'lmaydi.`); return; }
      const yangiSana = isoSana(uzYangi);
      const h = toshkentHozir();
      const updates: Partial<Muhlat> = {
        Tugash: yangiSana,
        Asl_Tugash: tr(f.Asl_Tugash) || tr(f.Tugash),
        Uzaytirildi: String(uzaytirishSoni(f) + 1),
        Oxirgi_ozgartirdi: user?.pochta || "", Oxirgi_Ozgarish: `${h.sana} ${h.vaqt}`,
      };
      // Avval asosiy qator (va'da sanasi), keyin tarix — tarix yozilmay qolsa ham muhlat to'g'ri bo'ladi
      if (!(await yangila(m.Muhlat_ID, updates, f))) { alert("Uzaytirilmadi, qayta urinib ko'ring."); return; }
      const q = yangiUzaytirish({
        Uzaytirish_ID: uid(), Muhlat_ID: m.Muhlat_ID, Mijoz_ID: tr(f.Mijoz_ID), Taminotchi_ID: tr(f.Taminotchi_ID),
        Eski_sana: tr(f.Tugash), Yangi_sana: yangiSana, Izoh: uzIzoh.trim(), Sana: h.sana,
        Qoshdi: user?.pochta || "", Qoshilgan_Vaqt: `${h.sana} ${h.vaqt}`,
      });
      if (await tarixniYoz(q)) setUzaytir(null);
      else {
        setUzKutilayotgan(q);
        alert("Muddat uzaytirildi, lekin sabab/tarix saqlanmadi — «Tarixni saqlash» tugmasini qayta bosing.");
      }
    } finally { setUzSaqlanmoqda(false); tugat(m.Muhlat_ID); }
  }

  async function ochir() {
    if (!ochirish) return;
    const m = ochirish;
    if (!boshla(m.Muhlat_ID)) return;
    setOchirilmoqda(true);
    try {
      yozuvlarSoni.current++;
      if (!(await yoz("DELETE", { sheet: MUHLAT, idColumn: "Muhlat_ID", idValue: m.Muhlat_ID }))) {
        // Boshqa joyda allaqachon o'chirilgan bo'lsa — xato emas, ro'yxatdan olib tashlaymiz
        if ((await yangiQator(m.Muhlat_ID)) !== null) { alert("O'chirilmadi, qayta urinib ko'ring."); return; }
      }
      afterWrite(MUHLAT);
      // Uzaytirish tarixi ham (bo'lsa)
      const tarix = tarixMap[m.Muhlat_ID] || [];
      for (const u of tarix) await yoz("DELETE", { sheet: MUHLAT_UZAYTIRISH, idColumn: "Uzaytirish_ID", idValue: u.Uzaytirish_ID });
      if (tarix.length) afterWrite(MUHLAT_UZAYTIRISH);
      setMuhlatlar(p => p.filter(x => x.Muhlat_ID !== m.Muhlat_ID));
      setUzaytirish(p => p.filter(u => u.Muhlat_ID !== m.Muhlat_ID));
      setOchirish(null);
    } finally { setOchirilmoqda(false); tugat(m.Muhlat_ID); }
  }

  // Faollar: va'dasi yaqinlari tepada (o'tganlar eng tepada); bajarilganlar: oxirgi yopilgan tepada
  const saralangan = useMemo(() => [...muhlatlar].sort((a, b) => {
    const fa = faolmi(a), fb = faolmi(b);
    if (fa !== fb) return fa ? -1 : 1;
    if (fa) return (sanaIso(a.Tugash) || "9999").localeCompare(sanaIso(b.Tugash) || "9999");
    return (sanaIso(b.Yopilgan_Sana) || "").localeCompare(sanaIso(a.Yopilgan_Sana) || "");
  }), [muhlatlar]);
  const mijozMuhlat = useMemo(() => saralangan.filter(m => tr(m.Turi) === TURI_MIJOZ), [saralangan]);
  const firmaMuhlat = useMemo(() => saralangan.filter(m => tr(m.Turi) === TURI_FIRMA), [saralangan]);

  const stat = useMemo(() => {
    let bugungi = 0, yaqin = 0, otgan = 0, faol = 0;
    muhlatlar.forEach(m => {
      if (!faolmi(m)) return;
      faol++;
      const iso = sanaIso(m.Tugash);
      if (!iso) return;
      const k = kunFarqi(bugun, iso);
      if (k < 0) otgan++;
      else if (k === 0) bugungi++;
      else if (k <= 3) yaqin++;
    });
    return { bugungi, yaqin, otgan, faol };
  }, [muhlatlar, bugun]);

  const mijozItems = useMemo<Item[]>(() => mijozlar.map(m => ({ id: m.Mijoz_ID, nomi: m.Ism, tel: tr(m.Telefon) })), [mijozlar]);
  const firmaItems = useMemo<Item[]>(() => taminotchilar.map(x => ({ id: x.Taminotchi_ID, nomi: x.Ism, tel: tr(x.Telefon) })), [taminotchilar]);

  const ochish = useCallback((m: Muhlat) => {
    if (tr(m.Turi) === TURI_MIJOZ && tr(m.Mijoz_ID)) router.push(`/mijozlar/${tr(m.Mijoz_ID)}`);
    else if (tr(m.Turi) === TURI_FIRMA && tr(m.Taminotchi_ID)) router.push(`/taminotchi/${tr(m.Taminotchi_ID)}`);
  }, [router]);

  const panelUmumiy = {
    bugun, loading, band, qarzlar, tarix: tarixMap,
    onToggle: holatAlmashtir, onExtend: uzaytirishniOch, onDelete: setOchirish, onQarzKerak: qarzKerak, onOpen: ochish,
  };

  useScrollLock(!!uzaytir || !!ochirish);
  const uzK = uzaytir ? holatOf(uzaytir, bugun) : null;
  const uzMijozmi = !!uzaytir && tr(uzaytir.Turi) === TURI_MIJOZ;

  return (
    <>
      <header className="header">
        <div className="header__inner">
          <div>
            <h1 className="header__title" style={{ paddingLeft: 4 }}>Muhlat belgilash</h1>
            <p style={{ fontSize: 12.5, color: "var(--text-3)", paddingLeft: 4, marginTop: 2 }}>
              Mijoz va firma uchun to&apos;lov muddati · Telegram: {String(ESLATMA_SOATI).padStart(2, "0")}:00 da bugun va&apos;da qilganlar, {String(KECH_SOATI).padStart(2, "0")}:00 da va&apos;dasini bajarmaganlar
            </p>
          </div>
        </div>
      </header>

      <div className="page-content">
        {loading && muhlatlar.length === 0 && <div className="spinner--page"/>}
        {yuklashXato && (
          <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: "var(--radius)", background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            Muhlatlar serverdan yuklanmadi — ko&apos;rinayotgan ro&apos;yxat eskirgan bo&apos;lishi mumkin.
            <button type="button" onClick={() => setYangilash(x => x + 1)} style={{ ...CHIP, borderColor: "#fecaca", color: "#b91c1c" }}>Qayta yuklash</button>
          </div>
        )}

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <Karta isMobile={isMobile} label="BUGUN MUHLATI KELGAN" val={stat.bugungi} rang="#b45309" fon="#fffbeb"/>
          <Karta isMobile={isMobile} label="1–3 KUN QOLGAN"      val={stat.yaqin}   rang="#a16207" fon="#fefce8"/>
          <Karta isMobile={isMobile} label="MUDDATI O'TGAN"      val={stat.otgan}   rang="#b91c1c" fon="#fef2f2"/>
          <Karta isMobile={isMobile} label="JAMI FAOL"           val={stat.faol}    rang="#15803d" fon="#f0fdf4"/>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, alignItems: "start" }}>
          <MuhlatPanel turi={TURI_MIJOZ} royxat={mijozMuhlat} items={mijozItems} onSave={f => saqla(TURI_MIJOZ, f)} {...panelUmumiy}/>
          <MuhlatPanel turi={TURI_FIRMA} royxat={firmaMuhlat} items={firmaItems} onSave={f => saqla(TURI_FIRMA, f)} {...panelUmumiy}/>
        </div>
      </div>

      {/* ── Uzaytirish ── */}
      {uzaytir && uzK && (
        <div className="modal-overlay" onClick={uzaytirishniYop}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal__head">
              <h2 className="modal__title">Muhlatni uzaytirish</h2>
              <button className="modal__close" onClick={uzaytirishniYop}>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="modal__body">
              <div style={{ padding: "10px 12px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius)", display: "flex", flexDirection: "column", gap: 4 }}>
                <p style={{ fontSize: 14, fontWeight: 800 }}>{tr(uzaytir.Nomi) || "—"}</p>
                <p style={{ fontSize: 12.5, color: "var(--text-2)", fontWeight: 600 }}>
                  Hozirgi {uzMijozmi ? "va'da" : "muddat"}: <b>{tr(uzaytir.Tugash) || "—"}</b>{" "}
                  <span style={{ fontSize: 11, fontWeight: 800, color: uzK.rang, background: uzK.fon, border: `1px solid ${uzK.ramka}`, padding: "1px 8px", borderRadius: 20 }}>{uzK.matn}</span>
                </p>
                {uzaytirishSoni(uzaytir) > 0 && (
                  <p style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>
                    Birinchi {uzMijozmi ? "va'da" : "muddat"}: {tr(uzaytir.Asl_Tugash) || "—"} · {uzaytirishSoni(uzaytir)} marta uzaytirilgan
                  </p>
                )}
                {uzMijozmi && qarzlar[tr(uzaytir.Mijoz_ID)] && (
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#b91c1c" }}>Joriy qarz: {qarzMatni(qarzlar[tr(uzaytir.Mijoz_ID)])}</p>
                )}
              </div>
              {uzKutilayotgan ? (
                <p style={{ fontSize: 13, fontWeight: 600, color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "var(--radius)", padding: "9px 12px" }}>
                  ✓ {uzMijozmi ? "Va'da" : "Muddat"} {tr(uzKutilayotgan.Yangi_sana)} gacha uzaytirildi. Faqat sabab/tarix saqlanmadi — «Tarixni saqlash»ni bosing.
                </p>
              ) : (
                <>
                  <div>
                    <label style={LABEL}>YANGI {uzMijozmi ? "VA'DA" : "MUDDAT"} SANASI *</label>
                    <input type="date" value={uzYangi} min={uzMin} onChange={e => setUzYangi(e.target.value)} autoFocus
                      style={{ ...INPUT, padding: "9px 10px", fontSize: 14, border: `1px solid ${uzYangi && uzYangi >= uzMin ? "#b45309" : uzYangi ? "#ef4444" : "var(--border)"}`, cursor: "pointer" }}/>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                      {([[1, "+1 kun"], [3, "+3 kun"], [7, "+1 hafta"], [14, "+2 hafta"]] as const).map(([k, l]) => (
                        <button key={k} type="button" onClick={() => setUzYangi(isoQosh(uzAsos, k))} style={CHIP}>{l} · {isoSana(isoQosh(uzAsos, k)).slice(0, 5)}</button>
                      ))}
                    </div>
                    {uzYangi && uzYangi < uzMin && <p style={{ fontSize: 11, color: "#b91c1c", marginTop: 4 }}>Yangi sana {isoSana(uzMin)} dan oldin bo&apos;lmaydi</p>}
                  </div>
                  <div>
                    <label style={LABEL}>SABAB / IZOH</label>
                    <input value={uzIzoh} onChange={e => setUzIzoh(e.target.value)} placeholder="Masalan: pul tushmadi, haftaga va'da berdi" maxLength={255}
                      style={{ ...INPUT, padding: "9px 12px" }}/>
                  </div>
                </>
              )}
            </div>
            <div className="modal__footer">
              <button className="btn btn--outline" style={{ flex: 1 }} disabled={uzSaqlanmoqda} onClick={uzaytirishniYop}>{uzKutilayotgan ? "Yopish" : "Bekor"}</button>
              <button className="btn btn--primary" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                disabled={uzSaqlanmoqda || (!uzKutilayotgan && (!uzYangi || uzYangi < uzMin))} onClick={uzaytirSaqla}>
                {uzSaqlanmoqda && <span className="spinner"/>} {uzKutilayotgan ? "Tarixni saqlash" : "⟳ Uzaytirish"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── O'chirish tasdiqlash ── */}
      {ochirish && (
        <div className="modal-overlay" onClick={() => !ochirilmoqda && setOchirish(null)}>
          <div className="confirm" onClick={e => e.stopPropagation()}>
            <div className="confirm__icon"><svg width="24" height="24" fill="none" stroke="#ef4444" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></div>
            <p className="confirm__title">Muhlatni o&apos;chirish</p>
            <p className="confirm__text">
              <strong>{tr(ochirish.Nomi) || "—"}</strong> uchun {tr(ochirish.Tugash)} muhlati
              {uzaytirishSoni(ochirish) > 0 ? " va uning uzaytirish tarixi" : ""} o&apos;chiriladi.
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button className="btn btn--outline" style={{ flex: 1 }} disabled={ochirilmoqda} onClick={() => setOchirish(null)}>Bekor</button>
              <button className="btn btn--red" style={{ flex: 1 }} disabled={ochirilmoqda} onClick={ochir}>
                {ochirilmoqda && <span className="spinner"/>} O&apos;chirish
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
