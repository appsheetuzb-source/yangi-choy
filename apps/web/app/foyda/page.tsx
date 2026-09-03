"use client";
import { fetchSheets } from "@/lib/sheet-cache";
import { useAuth } from "@/lib/AuthContext";
import { usePersistedState } from "@/lib/usePersistedState";
import { useEffect, useState, useCallback, useMemo } from "react";

interface Sotuv { Sotuv_ID: string; Mijoz_ID: string; Yil: string; Oy: string; Sana: string; Agent: string; }
interface SavatRow { Sotuv_ID: string; Mahsulot_ID: string; Soni: string; Summa_som: string; Kurs: string; Som_tan_narx?: string; Foyda?: string; Foyda_summasi_som?: string; }
interface SavatDollarRow { Sotuv_ID: string; Mahsulot_ID: string; Soni: string; Summa: string; Kurs: string; Tan_narx?: string; Foyda?: string; Foyda_summasi_som?: string; }
interface Mahsulot { Mahsulot_ID: string; Nomi: string; Tan_som: string; Tan_dollar: string; }
interface Mijoz { Mijoz_ID: string; Ism: string; }
interface KursRow { Kurs: string; }
interface Xarajat { Xarajat_ID: string; Agent: string; Sana: string; Yil: string; Oy: string; Som: string; Dollar: string; }
interface Foydalanuvchi { Foydalanuvchi_ID: string; Nomi: string; Lavozim: string; }

function num(v: string | number | undefined) {
  return parseFloat(String(v || "0").replace(/\s/g, "").replace(",", ".")) || 0;
}
function fmtSom(v: number) { return Math.round(v).toLocaleString("ru-RU") + " so'm"; }
function fmtUsd(v: number) { return "$" + v.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

const OYLAR = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];

// "DD.MM.YYYY" -> "YYYY-MM-DD" (leksik solishtirish uchun), format noto'g'ri bo'lsa ""
function sanaISO(sana: string): string {
  const m = String(sana || "").match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
}

export default function FoydaPage() {
  const { user } = useAuth();
  const uid = user?.id || "";
  const isAdmin = user?.lavozim === "Admin";
  const [sotuvlar, setSotuvlar]       = useState<Sotuv[]>([]);
  const [savatSom, setSavatSom]       = useState<SavatRow[]>([]);
  const [savatDollar, setSavatDollar] = useState<SavatDollarRow[]>([]);
  const [mahsulotlar, setMahsulotlar] = useState<Mahsulot[]>([]);
  const [mijozlar, setMijozlar]       = useState<Mijoz[]>([]);
  const [xarajatlar, setXarajatlar]   = useState<Xarajat[]>([]);
  const [agentlar, setAgentlar]       = useState<Foydalanuvchi[]>([]);
  const [kurs, setKurs]               = useState(12800);
  const [loading, setLoading]         = useState(true);
  const [heavyReady, setHeavyReady]   = useState(false);
  const [isMobile, setIsMobile]       = useState(false);

  const [yil, setYil] = usePersistedState("flt:foyda:yil", "");    // "" = placeholder "Yil", "all" = Barcha yillar
  const [oy, setOy]   = usePersistedState("flt:foyda:oy", "");    // "" = placeholder "Oy", "0" = Barcha oylar
  const [dateFrom, setDateFrom] = usePersistedState("flt:foyda:dateFrom", ""); // YYYY-MM-DD; qo'yilsa Oy/Yil o'rniga sana oralig'i
  const [dateTo, setDateTo]     = usePersistedState("flt:foyda:dateTo", "");
  // Agent tanlagich: Admin istalgan agentni yoki "all" (barcha agentlar) ni tanlaydi,
  // Sotuvchi esa doim faqat o'zini ko'radi.
  const [selAgent, setSelAgent] = usePersistedState("flt:foyda:agent", "");
  const effAgent = isAdmin ? (selAgent || uid) : uid;
  const [selMijoz, setSelMijoz]   = useState<string | null>(null);
  const [qMijoz, setQMijoz]       = usePersistedState("flt:foyda:qMijoz", "");
  const [qMahsulot, setQMahsulot] = usePersistedState("flt:foyda:qMahsulot", "");

  useEffect(() => {
    const c = () => setIsMobile(window.innerWidth < 768);
    c(); window.addEventListener("resize", c); return () => window.removeEventListener("resize", c);
  }, []);

  const loadData = useCallback(() => {
    setLoading(true);
    // Faza 1 — yengil
    fetchSheets(["Sotuv", "Mahsulot", "Mijozlar", "Kurs", "Xarajat", "Foydalanuvchi"]).then(r => {
      setSotuvlar(((r["Sotuv"]?.data) || []) as Sotuv[]);
      setMahsulotlar((((r["Mahsulot"]?.data) || []) as Mahsulot[]).filter(m => m.Nomi));
      setMijozlar(((r["Mijozlar"]?.data) || []) as Mijoz[]);
      setXarajatlar(((r["Xarajat"]?.data) || []) as Xarajat[]);
      setAgentlar((((r["Foydalanuvchi"]?.data) || []) as Foydalanuvchi[]).filter(f => String(f.Foydalanuvchi_ID || "").trim() && String(f.Nomi || "").trim()));
      const kA = (((r["Kurs"]?.data) || []) as KursRow[]).filter(k => num(k.Kurs) > 0);
      if (kA.length) setKurs(num(kA[kA.length - 1].Kurs));
    }).catch(() => {}).finally(() => setLoading(false));
    // Faza 2 — og'ir savat (qayta urinish bilan)
    const loadHeavy = (attempt: number) => {
      fetchSheets(["Sotuv_Savat", "Sotuv_savat_dollar"]).then(r => {
        const ss = r["Sotuv_Savat"], sd = r["Sotuv_savat_dollar"];
        if (!ss?.headers?.length || ss.error || !sd?.headers?.length || sd.error) throw new Error("heavy incomplete");
        setSavatSom((ss.data || []) as SavatRow[]);
        setSavatDollar((sd.data || []) as SavatDollarRow[]);
        setHeavyReady(true);
      }).catch(() => { if (attempt < 5) setTimeout(() => loadHeavy(attempt + 1), Math.min(1000 * Math.pow(2, attempt), 8000)); });
    };
    loadHeavy(0);
  }, []);
  useEffect(() => { loadData(); }, [loadData]);

  const mahMap = useMemo(() => { const m: Record<string, Mahsulot> = {}; mahsulotlar.forEach(x => { m[x.Mahsulot_ID] = x; }); return m; }, [mahsulotlar]);
  const mijozMap = useMemo(() => { const m: Record<string, string> = {}; mijozlar.forEach(x => { if (x.Mijoz_ID) m[x.Mijoz_ID] = x.Ism; }); return m; }, [mijozlar]);
  const sotuvMap = useMemo(() => { const m: Record<string, Sotuv> = {}; sotuvlar.forEach(s => { if (s.Sotuv_ID) m[s.Sotuv_ID] = s; }); return m; }, [sotuvlar]);

  const yillar = useMemo(() => {
    const set = new Set<string>();
    sotuvlar.forEach(s => { if (s.Yil) set.add(s.Yil); });
    return [...set].sort((a, b) => Number(b) - Number(a));
  }, [sotuvlar]);

  // ── Foyda hisobi (jonli): foyda = Summa − Tan × Soni ──
  const { clientProfit, productAll, clientProduct, jami } = useMemo(() => {
    const cp: Record<string, { som: number; usd: number }> = {};
    const pp: Record<string, { som: number; usd: number }> = {};
    const cpp: Record<string, Record<string, { som: number; usd: number }>> = {};
    const jami = { som: 0, usd: 0, usdSom: 0 };
    const useRange = !!(dateFrom || dateTo);
    const agentOk = (a: string) => {
      const v = String(a || "").trim();
      if (effAgent === "all") return !!v;      // barcha agentlar (agentsiz qatorlar hisobga olinmaydi)
      return !!effAgent && v === effAgent;
    };
    const inFilter = (s: Sotuv) => {
      if (!agentOk(s.Agent)) return false;
      if (useRange) {
        const d = sanaISO(s.Sana);
        if (!d) return false;
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
        return true;
      }
      const yilOk = !yil || yil === "all" || s.Yil === yil;
      const oyOk  = !oy  || oy  === "0"   || String(parseInt(s.Oy || "0")) === oy;
      return yilOk && oyOk;
    };

    savatSom.forEach(r => {
      const s = sotuvMap[String(r.Sotuv_ID || "").trim()];
      if (!s || !inFilter(s)) return;
      const mah = mahMap[r.Mahsulot_ID];
      const rk = num(r.Kurs) || kurs;
      // ⚠️ Som_tan_narx ustunini TO'G'RIDAN-TO'G'RI ISHLATIB BO'LMAYDI — u ARALASH birlikda:
      // 23 004 qatordan 10 320 tasida qiymat so'mda, 10 740 tasida DOLLARDA saqlangan
      // (eski AppSheet mahsulotning Tan_dollar qiymatini shu ustunga xom holda yozgan).
      // Uni so'm deb o'qish foydani ~5,47 mlrd so'mga oshirib yuboradi.
      // Shuning uchun sotuv paytida hisoblanib SAQLANGAN foydani o'qiymiz — u yozilish
      // paytida to'g'ri birlik bilan hisoblangan (eski AppSheet Foyda oynasi ham aynan shundan
      // foydalangan va skrinshotdagi raqamlar shu bilan aynan qayta tiklandi).
      const snapFoyda = String(r.Foyda_summasi_som ?? "").trim();
      // Saqlangan foyda yo'q eski qatorlar uchun — joriy tan narx bilan hisoblanadi
      // (Tan_som bo'sh bo'lsa mahsulot dollarda olingan → tannarx = Tan_dollar × kurs)
      const tanS = num(mah?.Tan_som) > 0 ? num(mah?.Tan_som) : num(mah?.Tan_dollar) * rk;
      const foyda = snapFoyda !== ""
        ? num(snapFoyda)
        : num(r.Summa_som) - tanS * num(r.Soni);
      const mid = s.Mijoz_ID || "—", pid = r.Mahsulot_ID || "—";
      (cp[mid] ||= { som: 0, usd: 0 }).som += foyda;
      (pp[pid] ||= { som: 0, usd: 0 }).som += foyda;
      ((cpp[mid] ||= {})[pid] ||= { som: 0, usd: 0 }).som += foyda;
      jami.som += foyda;
    });
    savatDollar.forEach(r => {
      const s = sotuvMap[String(r.Sotuv_ID || "").trim()];
      if (!s || !inFilter(s)) return;
      const mah = mahMap[r.Mahsulot_ID];
      const rk = num(r.Kurs) || kurs;
      // Dollar savatida Tan_narx izchil DOLLARDA saqlangan (9 263/9 295 qator tekshirildi),
      // shuning uchun bu yerda snapshot'dan tan narxni o'qish xavfsiz.
      const snapOk = String(r.Foyda ?? "").trim() !== "" && num(r.Tan_narx) > 0;
      // Snapshot yo'q eski qatorlar uchun — avvalgidek joriy tan narx
      // (Tan_dollar bo'sh bo'lsa mahsulot so'mda olingan → tannarx = Tan_som / kurs)
      const tanD = snapOk ? num(r.Tan_narx)
        : (num(mah?.Tan_dollar) > 0 ? num(mah?.Tan_dollar) : (rk > 0 ? num(mah?.Tan_som) / rk : 0));
      const foyda = num(r.Summa) - tanD * num(r.Soni);
      // Eski AppSheet "Jami mahsulot foydasi" dollar savatini SO'MDA qo'shgan.
      // Sotuv paytida saqlangan Foyda_summasi_som allaqachon so'mda; yo'q bo'lsa qator kursi bilan.
      const fSomRaw = String(r.Foyda_summasi_som ?? "").trim();
      jami.usdSom += fSomRaw !== "" ? num(fSomRaw) : foyda * rk;
      const mid = s.Mijoz_ID || "—", pid = r.Mahsulot_ID || "—";
      (cp[mid] ||= { som: 0, usd: 0 }).usd += foyda;
      (pp[pid] ||= { som: 0, usd: 0 }).usd += foyda;
      ((cpp[mid] ||= {})[pid] ||= { som: 0, usd: 0 }).usd += foyda;
      jami.usd += foyda;
    });
    return { clientProfit: cp, productAll: pp, clientProduct: cpp, jami };
  }, [savatSom, savatDollar, sotuvMap, mahMap, yil, oy, dateFrom, dateTo, kurs, effAgent]);

  // ── Tanlangan agentning shu davrdagi xarajatlari ──
  const xarajatJami = useMemo(() => {
    const res = { som: 0, usd: 0 };
    const useRange = !!(dateFrom || dateTo);
    xarajatlar.forEach(x => {
      const a = String(x.Agent || "").trim();
      const ok = effAgent === "all" ? !!a : (!!effAgent && a === effAgent);
      if (!x.Xarajat_ID || !ok) return;
      if (useRange) {
        const d = sanaISO(x.Sana);
        if (!d || (dateFrom && d < dateFrom) || (dateTo && d > dateTo)) return;
      } else {
        const yilOk = !yil || yil === "all" || x.Yil === yil;
        const oyOk  = !oy  || oy  === "0"   || String(parseInt(x.Oy || "0")) === oy;
        if (!(yilOk && oyOk)) return;
      }
      res.som += num(x.Som);
      res.usd += num(x.Dollar);
    });
    return res;
  }, [xarajatlar, effAgent, yil, oy, dateFrom, dateTo]);

  const combined = (v: { som: number; usd: number }) => v.som + v.usd * kurs;

  const clientRows = useMemo(() => {
    return Object.entries(clientProfit)
      .map(([mid, v]) => ({ id: mid, name: mijozMap[mid] || (mid === "—" ? "—" : mid), ...v }))
      .filter(r => !qMijoz || r.name.toLowerCase().includes(qMijoz.toLowerCase()))
      .sort((a, b) => combined(b) - combined(a));
  }, [clientProfit, mijozMap, qMijoz, kurs]);

  // Tanlangan klient: bosilgan (selMijoz) YOKI qidiruv bitta klientga tushsa — o'sha
  const effMijoz = selMijoz || (qMijoz.trim() && clientRows.length === 1 ? clientRows[0].id : null);

  const productRows = useMemo(() => {
    const src = effMijoz ? (clientProduct[effMijoz] || {}) : productAll;
    return Object.entries(src)
      .map(([pid, v]) => ({ id: pid, name: mahMap[pid]?.Nomi || (pid === "—" ? "—" : pid), ...v }))
      .filter(r => !qMahsulot || r.name.toLowerCase().includes(qMahsulot.toLowerCase()))
      .sort((a, b) => combined(b) - combined(a));
  }, [effMijoz, clientProduct, productAll, mahMap, qMahsulot, kurs]);

  const selName = effMijoz ? (mijozMap[effMijoz] || effMijoz) : null;
  // Klient tanlangan bo'lsa o'sha klient foydasi, aks holda tanlangan agentning jamisi
  const displayJami = effMijoz ? (clientProfit[effMijoz] || { som: 0, usd: 0 }) : jami;
  // Dollar foydasi SO'MDA (eski AppSheet "Mahsulot foydasi ($)" ustuni aslida so'm edi).
  // Klient tanlanganda uning dollar foydasi joriy kurs bilan aylantiriladi.
  const displayUsdSom = effMijoz ? displayJami.usd * kurs : jami.usdSom;
  // Jami mahsulot foydasi = so'm savati + dollar savati (ikkalasi ham so'mda)
  const yalpiJami = displayJami.som + displayUsdSom;
  // Xarajat so'mda (dollar xarajat joriy kurs bilan)
  const xarajatJamiSom = xarajatJami.som + xarajatJami.usd * kurs;
  // Sof foyda = jami foyda − xarajat. Klient tanlanganda xarajat ayrilmaydi
  // (xarajat bitta klientga emas, agentga tegishli) — faqat ma'lumot uchun ko'rsatiladi.
  const sofFoyda = effMijoz ? yalpiJami : yalpiJami - xarajatJamiSom;

  // ── UI qismlari ──
  const ProfitCell = ({ som, usd }: { som: number; usd: number }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-end" }}>
      {som !== 0 && <span style={{ fontSize: 13, fontWeight: 800, color: som > 0 ? "#16a34a" : "#ef4444" }}>{fmtSom(som)}</span>}
      {usd !== 0 && <span style={{ fontSize: 13, fontWeight: 800, color: usd > 0 ? "#16a34a" : "#ef4444" }}>{fmtUsd(usd)}</span>}
      {som === 0 && usd === 0 && <span style={{ fontSize: 13, color: "var(--text-3)" }}>0</span>}
    </div>
  );

  const searchBox = (val: string, set: (v: string) => void, ph: string) => (
    <div className="search" style={{ marginBottom: 12 }}>
      <span className="search__icon"><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg></span>
      <input className="search__input" placeholder={ph} value={val} onChange={e => set(e.target.value)}/>
      {val && <button className="search__clear" onClick={() => set("")}><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>}
    </div>
  );

  return (
    <>
      <header className="header" style={{ height: isMobile ? "auto" : undefined }}>
        <div className="header__inner" style={{ flexWrap: isMobile ? "wrap" : "nowrap", height: isMobile ? "auto" : undefined, padding: isMobile ? "9px 14px 9px 52px" : undefined, rowGap: isMobile ? 8 : undefined, alignItems: isMobile ? "flex-start" : undefined }}>
          <div style={{ minWidth: isMobile ? "100%" : undefined }}>
            <h1 className="header__title" style={{ paddingLeft: 4 }}>Foyda</h1>
            <p style={{ fontSize: 12.5, color: "var(--text-3)", paddingLeft: 4, marginTop: 2 }}>Klient va mahsulot bo&apos;yicha foyda</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: isMobile ? "wrap" : "nowrap", rowGap: 8, marginLeft: isMobile ? 0 : 16, width: isMobile ? "100%" : undefined }}>
            {/* Agent tanlagich — Admin istalgan agentni ko'radi, Sotuvchi faqat o'zini */}
            {isAdmin && (
              <select value={selAgent || uid} onChange={e => { setSelAgent(e.target.value); setSelMijoz(null); }}
                title="Agent bo'yicha foyda"
                style={{ width: "auto", maxWidth: 190, fontSize: 12, fontWeight: 700, border: "1px solid var(--primary)", borderRadius: "var(--radius)", padding: "5px 8px", background: "var(--white)", outline: "none", color: "var(--primary)", cursor: "pointer" }}>
                <option value="all">Barcha agentlar</option>
                {agentlar.map(a => <option key={a.Foydalanuvchi_ID} value={a.Foydalanuvchi_ID}>{a.Nomi}</option>)}
              </select>
            )}
            {/* Yil — bo'sh bo'lsa kulrang "Yil" placeholder */}
            <select value={yil} onChange={e => setYil(e.target.value)} disabled={!!(dateFrom || dateTo)}
              style={{ width: "auto", fontSize: 12, border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "5px 8px", background: "var(--white)", outline: "none", color: yil ? "var(--text)" : "var(--text-3)", opacity: (dateFrom || dateTo) ? .5 : 1, cursor: (dateFrom || dateTo) ? "not-allowed" : "pointer" }}>
              <option value="" disabled hidden>Yil</option>
              <option value="all">Barcha yillar</option>
              {yillar.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {/* Oy — bo'sh bo'lsa kulrang "Oy" placeholder */}
            <select value={oy} onChange={e => setOy(e.target.value)} disabled={!!(dateFrom || dateTo)}
              style={{ width: "auto", fontSize: 12, border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "5px 8px", background: "var(--white)", outline: "none", color: oy ? "var(--text)" : "var(--text-3)", opacity: (dateFrom || dateTo) ? .5 : 1, cursor: (dateFrom || dateTo) ? "not-allowed" : "pointer" }}>
              <option value="" disabled hidden>Oy</option>
              <option value="0">Barcha oylar</option>
              {OYLAR.map((o, i) => <option key={i} value={String(i + 1)}>{o}</option>)}
            </select>
            {/* Davr: sana oralig'i (Kassa/Gazna uslubi) */}
            <span style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600, whiteSpace: "nowrap", marginLeft: 4 }}>Davr:</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="Boshlanish sana"
              style={{ fontSize: 12, border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "5px 8px", background: "var(--white)", color: "var(--text)", cursor: "pointer" }}/>
            <span style={{ color: "var(--text-3)", fontSize: 14 }}>—</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} title="Tugash sana"
              style={{ fontSize: 12, border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "5px 8px", background: "var(--white)", color: "var(--text)", cursor: "pointer" }}/>
            {(dateFrom || dateTo) && <button onClick={() => { setDateFrom(""); setDateTo(""); }} title="Sanani tozalash"
              style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--white)", cursor: "pointer", fontSize: 14, fontWeight: 700, color: "var(--text-2)", lineHeight: 1 }}>×</button>}
          </div>
        </div>
      </header>

      <div className="page-content">
        {loading && <div className="spinner--page"/>}

        {!loading && (
          <>
            {/* KPI — eski AppSheet "Foyda" oynasidagi 5 ta ko'rsatkich */}
            {(() => {
              const K = ({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) => (
                <div style={{ flex: "1 1 190px", minWidth: 0, background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", padding: isMobile ? "13px 15px" : "16px 20px" }}>
                  <p style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".05em", marginBottom: 6 }}>{label}</p>
                  <p style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: color || "var(--text)", overflowWrap: "anywhere" }}>
                    {heavyReady ? value : "Yuklanmoqda…"}
                  </p>
                  {sub && heavyReady && <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", marginTop: 4 }}>{sub}</p>}
                </div>
              );
              return (
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                  <K label={selName ? "TANLANGAN KLIENT · JAMI FOYDA" : "JAMI MAHSULOT FOYDASI"}
                     value={fmtSom(yalpiJami)} color={yalpiJami >= 0 ? "#16a34a" : "#ef4444"}
                     sub={selName || undefined}/>
                  <K label="JAMI XARAJATLAR"
                     value={fmtSom(xarajatJamiSom)} color={xarajatJamiSom > 0 ? "#ef4444" : "var(--text)"}
                     sub={selName ? "klient foydasidan ayrilmaydi" : undefined}/>
                  <K label={selName ? "TANLANGAN KLIENT · FOYDA" : "SOF FOYDA"}
                     value={fmtSom(sofFoyda)} color={sofFoyda >= 0 ? "#16a34a" : "#ef4444"}
                     sub={selName ? undefined : "jami foyda − xarajat"}/>
                  <K label="MAHSULOT FOYDASI (SO'M)"
                     value={fmtSom(displayJami.som)} color={displayJami.som >= 0 ? "#16a34a" : "#ef4444"}
                     sub="so'mlik sotuvlardan"/>
                  <K label="MAHSULOT FOYDASI ($)"
                     value={fmtSom(displayUsdSom)} color={displayUsdSom >= 0 ? "#16a34a" : "#ef4444"}
                     sub={`dollarlik sotuvlardan · ${fmtUsd(displayJami.usd)}`}/>
                </div>
              );
            })()}

            {/* Xarajat ma'lumoti to'liq emasligi haqida ogohlantirish */}
            {heavyReady && xarajatJamiSom === 0 && yalpiJami !== 0 && (
              <div style={{ marginBottom: 16, padding: "10px 16px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "var(--radius)", fontSize: 12.5, fontWeight: 600, color: "#b45309" }}>
                ⚠️ Tanlangan davr/agent bo&apos;yicha xarajat yozilmagan — «Sof foyda» yalpi foydaga teng chiqmoqda.
                Bazada xarajat faqat 2 ta agentda va 2026-yildan boshlab mavjud.
              </div>
            )}

            {!heavyReady && <p style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 12 }}>Foyda ma&apos;lumoti yuklanmoqda…</p>}

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, alignItems: "start" }}>
              {/* ── Klient bo'yicha foyda ── */}
              <div style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
                  <p style={{ fontSize: 14, fontWeight: 700 }}>Klient bo&apos;yicha foyda</p>
                  <p style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>Klientni bosing yoki qidiring — o&apos;sha klientning mahsulotlari o&apos;ngda ko&apos;rinadi</p>
                </div>
                <div style={{ padding: "12px 18px 0" }}>{searchBox(qMijoz, setQMijoz, "Klient qidirish...")}</div>
                <div style={{ maxHeight: 520, overflowY: "auto" }}>
                  {clientRows.length === 0 ? (
                    <p style={{ padding: "20px 18px", fontSize: 13, color: "var(--text-3)", textAlign: "center" }}>{heavyReady ? "Ma'lumot yo'q" : "Yuklanmoqda…"}</p>
                  ) : clientRows.map((r, i) => {
                    const on = effMijoz === r.id;
                    return (
                    <div key={r.id} onClick={() => setSelMijoz(selMijoz === r.id ? null : r.id)}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 18px", borderBottom: i < clientRows.length - 1 ? "1px solid var(--border)" : "none", cursor: "pointer", background: on ? "var(--primary-glow)" : "transparent" }}
                      onMouseEnter={e => { if (!on) e.currentTarget.style.background = "#f8fafc"; }}
                      onMouseLeave={e => { if (!on) e.currentTarget.style.background = "transparent"; }}>
                      <span style={{ fontSize: 12, color: "var(--text-3)", width: 20, flexShrink: 0 }}>{i + 1}</span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: on ? 800 : 600, color: on ? "var(--primary)" : "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                      <ProfitCell som={r.som} usd={r.usd}/>
                    </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Mahsulot bo'yicha foyda ── */}
              <div style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 700 }}>Mahsulot bo&apos;yicha foyda</p>
                    <p style={{ fontSize: 11.5, color: selName ? "var(--primary)" : "var(--text-3)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selName ? `Klient: ${selName}` : "Barcha klientlar"}</p>
                  </div>
                  {selName && <button onClick={() => { setSelMijoz(null); setQMijoz(""); }} style={{ flexShrink: 0, padding: "6px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--white)", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>Barchasi</button>}
                </div>
                <div style={{ padding: "12px 18px 0" }}>{searchBox(qMahsulot, setQMahsulot, "Mahsulot qidirish...")}</div>
                <div style={{ maxHeight: 520, overflowY: "auto" }}>
                  {productRows.length === 0 ? (
                    <p style={{ padding: "20px 18px", fontSize: 13, color: "var(--text-3)", textAlign: "center" }}>{heavyReady ? "Ma'lumot yo'q" : "Yuklanmoqda…"}</p>
                  ) : productRows.map((r, i) => (
                    <div key={r.id}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 18px", borderBottom: i < productRows.length - 1 ? "1px solid var(--border)" : "none" }}>
                      <span style={{ fontSize: 12, color: "var(--text-3)", width: 20, flexShrink: 0 }}>{i + 1}</span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                      <ProfitCell som={r.som} usd={r.usd}/>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
