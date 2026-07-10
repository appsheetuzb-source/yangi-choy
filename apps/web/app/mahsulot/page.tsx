"use client";
import { fetchSheet, afterWrite } from "@/lib/sheet-cache";
import { exportPDF, exportExcel, type ExportOpts } from "@/lib/export";
import { useScrollLock } from "@/lib/use-scroll-lock";
import { usePersistedState } from "@/lib/usePersistedState";
import FabAdd from "@/components/FabAdd";
import ProductDrawer from "@/components/ProductDrawer";
import { useAuth } from "@/lib/AuthContext";
import { computeInvByOmbor, shopWarehouseSet, type FoydalanuvchiLike } from "@/lib/ombor-transfer";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";

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

interface Ombor {
  Ombor_ID: string;
  Nomi: string;
}

export default function MahsulotPage() {
  const { user } = useAuth();
  const isAdmin = user?.lavozim === "Admin";
  // Non-admin (Sotuvchi/Omborchi) faqat o'ziga biriktirilgan ombor mahsulotlarini ko'radi
  const myOmbor = (user?.omborId || "").trim();
  const [mahsulotlar, setMahsulotlar] = useState<Mahsulot[]>([]);
  const [omborlar, setOmborlar]       = useState<Ombor[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [search, setSearch]           = usePersistedState("flt:mahsulot:search", "");
  const [jamiSotuvSom, setJamiSotuvSom]         = useState(0);
  const [jamiSotuvDollar, setJamiSotuvDollar]   = useState(0);
  // Per-ombor inventar: inv[ombor][mahsulot]. Ombor_ID=chiqim(manba), Ombor_2=kirim(transfer qabul).
  const [invByOmbor, setInvByOmbor]             = useState<Record<string, Record<string, number>>>({});
  const [globalBalans, setGlobalBalans]         = useState<Record<string, number>>({});
  // Ombor bo'yicha ko'rsatish filtri: "all" = jami (barcha omborlar), yoki Ombor_ID
  const [filterOmbor, setFilterOmbor]           = usePersistedState<string>("flt:mahsulot:ombor", "all");
  // Klient (manba) bo'yicha filtr: mijoz qaysi mahsulotlarni olgan
  const [mijMahMap, setMijMahMap]   = useState<Record<string, Set<string>>>({});
  const [mijItems, setMijItems]     = useState<{ id: string; label: string }[]>([]);
  const [filterMijoz, setFilterMijoz] = usePersistedState("flt:mahsulot:filterMijoz", "");
  const [sortCol, setSortCol]   = useState<string | null>(null);
  const [sortDir, setSortDir]   = useState<"asc" | "desc">("asc");

  const [currency, setCurrency]       = usePersistedState<"barchasi" | "som" | "dollar">("flt:mahsulot:currency", "barchasi");
  const [view, setView]               = useState<"grid" | "list">("grid");
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [editTarget, setEditTarget]   = useState<Mahsulot | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Mahsulot | null>(null);
  const [deleting, setDeleting]       = useState(false);
  const [isMobile, setIsMobile]       = useState(false);
  useEffect(() => { const c = () => setIsMobile(window.innerWidth < 768); c(); window.addEventListener("resize", c); return () => window.removeEventListener("resize", c); }, []);
  useScrollLock(!!deleteTarget);

  const loadData = useCallback((delay = 0) => {
    setLoading(true);
    setTimeout(() => {
      fetchSheet("Mahsulot")
        .then(json => {
          if ((json as {error?:string}).error) throw new Error((json as {error:string}).error);
          setMahsulotlar(json.data as Mahsulot[]);
        })
        .catch(e => setError(e.message))
        .finally(() => setLoading(false));
    }, delay);
  }, []);

  useEffect(() => {
    loadData();
    fetchSheet("Ombor")
      .then(j => { if (!(j as {error?:string}).error) setOmborlar(j.data as Ombor[]); });
    Promise.all([
      fetchSheet("Sotuv_Savat"),
      fetchSheet("Sotuv_Savat_Dollar"),
      fetchSheet("Xarid_Savat"),
      fetchSheet("Sotuv"),
      fetchSheet("Mijozlar"),
      fetchSheet("Foydalanuvchi"),
    ]).then(([ssRes, ssdRes, xsRes, sRes, mRes, fRes]) => {
      const n = (v: string | number | undefined) => parseFloat(String(v || "0").replace(/\s/g, "").replace(",", ".")) || 0;
      const som    = (ssRes.data  as Record<string, string>[]).reduce((s, r) => s + n(r.Summa_som), 0);
      const dollar = (ssdRes.data as Record<string, string>[]).reduce((s, r) => s + n(r.Summa),     0);
      setJamiSotuvSom(som);
      setJamiSotuvDollar(dollar);

      // Per-ombor balans (yagona helper). Ombor_2 ni FAQAT do'kon ombori bo'lsa transfer deb hisoblaydi
      // (legacy " Ombor_2"=Asosiy e'tiborsiz). Do'kon omborlari Foydalanuvchi'dan quriladi (barqaror).
      const shopWH = shopWarehouseSet((fRes.data as FoydalanuvchiLike[]) || []);
      const { inv, global } = computeInvByOmbor(
        xsRes.data as Record<string, string>[],
        ssRes.data as Record<string, string>[],
        ssdRes.data as Record<string, string>[],
        shopWH,
      );
      setInvByOmbor(inv);
      setGlobalBalans(global);

      // Klient (manba) → mahsulotlar xaritasi
      const purifyMid = (raw: string) => { const v = String(raw || "").trim(); return v.includes(".") ? v.split(".")[1] : v; };
      const sotuvMijoz: Record<string, string> = {};
      (sRes.data as Record<string, string>[]).forEach(s => {
        const sid = String(s.Sotuv_ID || "").trim();
        if (sid) sotuvMijoz[sid] = purifyMid(s.Mijoz_ID);
      });
      const mm: Record<string, Set<string>> = {};
      const addRow = (r: Record<string, string>) => {
        const mid = sotuvMijoz[String(r.Sotuv_ID || "").trim()];
        if (!mid || !r.Mahsulot_ID) return;
        if (!mm[mid]) mm[mid] = new Set();
        mm[mid].add(r.Mahsulot_ID);
      };
      (ssRes.data as Record<string, string>[]).forEach(addRow);
      (ssdRes.data as Record<string, string>[]).forEach(addRow);
      setMijMahMap(mm);
      const mijNames: Record<string, string> = {};
      (mRes.data as Record<string, string>[]).forEach(m => { if (m.Mijoz_ID) mijNames[m.Mijoz_ID] = m.Ism || m.Mijoz_ID; });
      setMijItems(Object.keys(mm).map(id => ({ id, label: mijNames[id] || id })).sort((a, b) => a.label.localeCompare(b.label, "uz")));
    });
  }, [loadData]);

  // Ko'riladigan ombor: Admin → tanlangan filtr ("all"=jami); Sotuvchi → FAQAT o'z ombori (qulflangan)
  const effOmbor = (isAdmin || !myOmbor) ? filterOmbor : myOmbor;
  // Ko'rsatiladigan qoldiq: "all" → global (barcha omborlar jami), aks holda tanlangan ombor qoldig'i
  const balansMap = useMemo<Record<string, number>>(
    () => effOmbor === "all" ? globalBalans : (invByOmbor[effOmbor] || {}),
    [effOmbor, globalBalans, invByOmbor]);
  // Mahsulotlar: "all" → barchasi; ombor tanlansa — o'sha omborda harakati bo'lgan mahsulotlar
  const omborMahsulotlar = useMemo(()=>
    effOmbor === "all" ? mahsulotlar
      : mahsulotlar.filter(m => (invByOmbor[effOmbor]?.[m.Mahsulot_ID] !== undefined) || (m.Ombor_ID || "").trim() === effOmbor),
    [mahsulotlar,effOmbor,invByOmbor]);
  const filtered = useMemo(()=>omborMahsulotlar.filter(m =>
    String(m.Nomi || "").toLowerCase().includes(search.toLowerCase()) &&
    (!filterMijoz || (mijMahMap[filterMijoz]?.has(m.Mahsulot_ID) ?? false))
  ),[omborMahsulotlar,search,filterMijoz,mijMahMap]);

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

  const n = (v: string | number | undefined) => parseFloat(String(v || "0").replace(/\s/g, "").replace(",", ".")) || 0;

  const sorted = useMemo(()=> sortCol ? [...filtered].sort((a, b) => {
    let av = 0, bv = 0;
    let as = "", bs = "";
    if (sortCol === "nomi")    { as = a.Nomi || ""; bs = b.Nomi || ""; return sortDir === "asc" ? as.localeCompare(bs, "uz") : bs.localeCompare(as, "uz"); }
    if (sortCol === "sotuv_som")   { av = n(a.Sotuv_som);    bv = n(b.Sotuv_som);    }
    if (sortCol === "sotuv_usd")   { av = n(a.Sotuv_dollar); bv = n(b.Sotuv_dollar); }
    if (sortCol === "tan_som")     { av = n(a.Tan_som);      bv = n(b.Tan_som);      }
    if (sortCol === "tan_usd")     { av = n(a.Tan_dollar);   bv = n(b.Tan_dollar);   }
    if (sortCol === "hozirda_bor") { av = balansMap[a.Mahsulot_ID] ?? 0; bv = balansMap[b.Mahsulot_ID] ?? 0; }
    return sortDir === "asc" ? av - bv : bv - av;
  }) : filtered,[filtered,sortCol,sortDir,balansMap]);

  // Windowing — kartalarni bo'lib render qilish (skroll tezligi uchun)
  const [shown, setShown] = useState(60);
  const moreRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setShown(60); }, [search, filterMijoz, view, filterOmbor]);
  useEffect(() => {
    const el = moreRef.current; if (!el) return;
    const io = new IntersectionObserver(es => { if (es[0].isIntersecting) setShown(n => n + 60); });
    io.observe(el); return () => io.disconnect();
  }, [filtered.length, view]);

  // ── Yuklash: mahsulot nomi + qoldiq (dona) + chiqarilgan sana ──
  function buildMahsulotExport(): ExportOpts {
    const d = new Date();
    const sana = `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${d.getFullYear()}`;
    const rows = sorted.map((m, i) => [i+1, m.Nomi || "—", `${(balansMap[m.Mahsulot_ID] ?? 0).toLocaleString("ru-RU")} dona`]);
    const jami = sorted.reduce((s, m) => s + (balansMap[m.Mahsulot_ID] ?? 0), 0);
    return {
      title: "Mahsulotlar — qoldiq",
      subtitle: `Chiqarilgan sana: ${sana}  ·  Jami: ${sorted.length} ta mahsulot`,
      filename: `mahsulotlar-qoldiq-${sana.replace(/\./g,"-")}`,
      sections: [{
        headers: ["№", "Mahsulot nomi", "Qoldiq (dona)"],
        rows,
        foot: ["", "JAMI", `${jami.toLocaleString("ru-RU")} dona`],
      }],
    };
  }

  function openAdd() {
    setEditTarget(null);
    setDrawerOpen(true);
  }

  function openEdit(m: Mahsulot) {
    setEditTarget(m);
    setDrawerOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch("/api/sheets", { method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet: "Mahsulot", idColumn: "Mahsulot_ID", idValue: deleteTarget.Mahsulot_ID }) });
      setDeleteTarget(null);
      afterWrite("Mahsulot"); loadData(800);
    } finally { setDeleting(false); }
  }

  const omborNomi = (id: string) => omborlar.find(o => o.Ombor_ID === id)?.Nomi || "";
  // "Barchasi" ko'rinishida mahsulotning ombor bo'yicha taqsimoti (qaysi omborda qancha qoldiq bor)
  const omborBreakdown = (mid: string) => Object.keys(invByOmbor)
    .filter(o => o !== "__none__" && Math.round(invByOmbor[o]?.[mid] || 0) !== 0)
    .map(o => ({ nomi: omborNomi(o) || o, qty: invByOmbor[o][mid] }))
    .sort((a, b) => b.qty - a.qty);

  return (
    <>
      {/* Header */}
      <header className="header" style={{ height: isMobile ? "auto" : undefined }}>
        <div className="header__inner" style={{ flexWrap: isMobile ? "wrap" : "nowrap", height: isMobile ? "auto" : undefined, padding: isMobile ? "9px 14px 9px 52px" : undefined, rowGap: isMobile ? 8 : undefined }}>
          <h1 className="header__title" style={{ paddingLeft: 4 }}>Mahsulot va ombor</h1>
          <div className="search" style={{ maxWidth: isMobile ? "100%" : 320, flexBasis: isMobile ? "100%" : undefined }}>
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
          {!isMobile && <div className="header__spacer" />}
          {!isMobile && (<>
            {/* Currency toggle */}
            <div style={{ display: "flex", gap: 3, background: "var(--bg)", borderRadius: 10, padding: 3, border: "1px solid var(--border)" }}>
              {([["barchasi", "Barchasi"], ["som", "So'm"], ["dollar", "Dollar"]] as [string, string][]).map(([val, label]) => (
                <button key={val} onClick={() => setCurrency(val as "barchasi" | "som" | "dollar")} style={{
                  padding: "5px 14px", borderRadius: 7, border: "none", cursor: "pointer",
                  fontSize: 12, fontWeight: 700,
                  background: currency === val ? "var(--white)" : "transparent",
                  color: currency === val ? "var(--primary)" : "var(--text-3)",
                  boxShadow: currency === val ? "0 1px 4px rgba(0,0,0,.08)" : "none",
                  transition: "all .15s",
                }}>{label}</button>
              ))}
            </div>
            {/* Ombor filtri — Admin uchun (jami + har ombor); Sotuvchi o'z omboriga qulflangan */}
            {isAdmin && omborlar.length > 0 && (
              <select value={filterOmbor} onChange={e => setFilterOmbor(e.target.value)} title="Ombor bo'yicha qoldiq"
                style={{ padding: "7px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 12, fontWeight: 700, color: filterOmbor === "all" ? "var(--text-2)" : "var(--primary)", outline: "none", cursor: "pointer", maxWidth: 190 }}>
                <option value="all">Barcha omborlar (jami)</option>
                {omborlar.map(o => <option key={o.Ombor_ID} value={o.Ombor_ID}>{o.Nomi}</option>)}
              </select>
            )}
            <button className="btn btn--outline" onClick={() => exportExcel(buildMahsulotExport())} title="Excel yuklash">
              <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3.5" fill="#1d7c4d"/><path d="M8.6 8.2l6.8 7.6M15.4 8.2l-6.8 7.6" stroke="#fff" strokeWidth="1.7" strokeLinecap="round"/></svg>
              Excel
            </button>
            <button className="btn btn--outline" onClick={() => exportPDF(buildMahsulotExport())} title="PDF yuklash">
              <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3.5" fill="#e23b34"/><text x="12" y="15.7" fontSize="6.6" fontWeight="800" fill="#fff" textAnchor="middle" fontFamily="Arial, sans-serif">PDF</text></svg>
              PDF
            </button>
          </>)}
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

      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar__inner">
          {isMobile && (
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn--outline" onClick={() => exportExcel(buildMahsulotExport())} title="Excel" style={{ padding: "7px 11px" }}>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3.5" fill="#1d7c4d"/><path d="M8.6 8.2l6.8 7.6M15.4 8.2l-6.8 7.6" stroke="#fff" strokeWidth="1.7" strokeLinecap="round"/></svg>
              </button>
              <button className="btn btn--outline" onClick={() => exportPDF(buildMahsulotExport())} title="PDF" style={{ padding: "7px 11px" }}>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3.5" fill="#e23b34"/><text x="12" y="15.7" fontSize="6.6" fontWeight="800" fill="#fff" textAnchor="middle" fontFamily="Arial, sans-serif">PDF</text></svg>
              </button>
            </div>
          )}
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

        {/* Mobil: Barchasi/So'm/Dollar — karta */}
        {isMobile && (
          <div style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", padding: "8px 10px", marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 3, background: "var(--bg)", borderRadius: 10, padding: 3, border: "1px solid var(--border)" }}>
              {([["barchasi", "Barchasi"], ["som", "So'm"], ["dollar", "Dollar"]] as [string, string][]).map(([val, label]) => (
                <button key={val} onClick={() => setCurrency(val as "barchasi" | "som" | "dollar")} style={{
                  flex: 1, padding: "7px 4px", borderRadius: 7, border: "none", cursor: "pointer",
                  fontSize: 12, fontWeight: 700,
                  background: currency === val ? "var(--white)" : "transparent",
                  color: currency === val ? "var(--primary)" : "var(--text-3)",
                  boxShadow: currency === val ? "0 1px 4px rgba(0,0,0,.08)" : "none",
                }}>{label}</button>
              ))}
            </div>
            {isAdmin && omborlar.length > 0 && (
              <select value={filterOmbor} onChange={e => setFilterOmbor(e.target.value)}
                style={{ width: "100%", marginTop: 8, padding: "9px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 13, fontWeight: 700, color: filterOmbor === "all" ? "var(--text-2)" : "var(--primary)", outline: "none" }}>
                <option value="all">Barcha omborlar (jami)</option>
                {omborlar.map(o => <option key={o.Ombor_ID} value={o.Ombor_ID}>{o.Nomi}</option>)}
              </select>
            )}
          </div>
        )}

        {/* Summary cards */}
        {(() => {
          const n = (v: string | number | undefined) => parseFloat(String(v || "0").replace(/\s/g, "").replace(",", ".")) || 0;
          const fmt    = (v: number) => v.toLocaleString("ru-RU", { maximumFractionDigits: 0 });
          const fmtUsd = (v: number) => v.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          // Hozirda bor — DONA da (balansMap: xarid Soni - sotuv Soni)
          const hozirdaBorDona   = omborMahsulotlar.reduce((s, m) => s + (balansMap[m.Mahsulot_ID] ?? 0), 0);
          const hozirdaBorSom    = omborMahsulotlar.reduce((s, m) => s + (balansMap[m.Mahsulot_ID] ?? 0) * n(m.Sotuv_som),    0);
          const hozirdaBorDollar = omborMahsulotlar.reduce((s, m) => s + (balansMap[m.Mahsulot_ID] ?? 0) * n(m.Sotuv_dollar), 0);
          return (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
              {[
                { label: "HOZIRDA BOR (DONA)", value: `${fmt(hozirdaBorDona)} dona`, color: "var(--primary)", bg: "#dcfce7",
                  icon: <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 3H8v4h8V3z"/></svg> },
                { label: "HOZIRDA BOR", value: `${fmt(hozirdaBorSom)} so'm`, color: "#16a34a", bg: "#dcfce7",
                  icon: <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 3H8v4h8V3z"/></svg> },
                { label: "HOZIRDA BOR ($)", value: `$${fmtUsd(hozirdaBorDollar)}`, color: "#2563eb", bg: "#dbeafe",
                  icon: <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> },
                { label: "JAMI MAHSULOT", value: `${filtered.length} ta`, color: "#7c3aed", bg: "#ede9fe",
                  icon: <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg> },
              ].map(card => (
                <div key={card.label} style={{
                  background: "var(--white)", borderRadius: "var(--radius-xl)",
                  boxShadow: "var(--shadow-sm)", border: "1px solid var(--border)", padding: 20,
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".06em" }}>{card.label}</span>
                    <span style={{ width: 28, height: 28, borderRadius: 8, background: card.bg, display: "flex", alignItems: "center", justifyContent: "center", color: card.color }}>
                      {card.icon}
                    </span>
                  </div>
                  <p style={{ fontSize: 18, fontWeight: 800, color: card.color, lineHeight: 1.1 }}>{card.value}</p>
                </div>
              ))}
            </div>
          );
        })()}

        {!loading && !error && <p className="count-label">{filtered.length} ta mahsulot</p>}

        {loading && (
          view === "grid" ? (
            <div className="card-grid">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="skeleton">
                  <div className="skeleton__img" style={{ aspectRatio: "unset", height: 120 }} />
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

        {!loading && !error && filtered.length > 0 && view === "grid" && (
          <div className="card-grid">
            {filtered.slice(0,shown).map((m, i) => (
              <GridCard key={m.Mahsulot_ID || `${m.Nomi}-${i}`} mahsulot={m}
                currency={currency}
                omborNomi={effOmbor === "all" ? "" : omborNomi(effOmbor)}
                jami={effOmbor === "all"}
                breakdown={effOmbor === "all" ? omborBreakdown(m.Mahsulot_ID) : undefined}
                balans={balansMap[m.Mahsulot_ID]}
                onEdit={() => openEdit(m)} onDelete={() => setDeleteTarget(m)} />
            ))}
          </div>
        )}

        {!loading && !error && filtered.length > 0 && view === "list" && (() => {
          const cols = [
            { key: "nomi",        label: "Nomi",         cls: "list__head-name", show: true },
            { key: "sotuv_som",   label: "Sotuv (so'm)", cls: "list__head-col",  show: currency !== "dollar" },
            { key: "sotuv_usd",   label: "Sotuv ($)",    cls: "list__head-col",  show: currency !== "som" },
            { key: "tan_som",     label: "Tan (so'm)",   cls: "list__head-col",  show: currency !== "dollar" },
            { key: "tan_usd",     label: "Tan ($)",      cls: "list__head-col",  show: currency !== "som" },
            { key: "hozirda_bor", label: "Hozirda bor",  cls: "list__head-col",  show: true },
          ].filter(c => c.show);
          return (
          <div className="list" style={{ overflowX: "auto" }}>
            <div className="list__head" style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--white)", minWidth: "fit-content" }}>
              <div className="list__head-img" />
              {cols.map(col => (
                <div key={col.key} className={col.cls}
                  onClick={() => toggleSort(col.key)}
                  style={{ cursor: "pointer", userSelect: "none" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: col.cls === "list__head-name" ? "flex-start" : "flex-end", gap: 2 }}>
                    <span style={{ fontWeight: 700 }}>{col.label}</span>
                    <span style={{ fontSize: 10, color: sortCol === col.key ? "var(--primary)" : "var(--text-3)" }}>
                      {sortCol === col.key ? (sortDir === "asc" ? "↑ o'sish" : "↓ kamayish") : "↕ sort"}
                    </span>
                  </div>
                </div>
              ))}
              <div className="list__head-actions" />
            </div>
            {sorted.slice(0,shown).map((m, i) => (
              <ListCard key={m.Mahsulot_ID || `${m.Nomi}-${i}`} mahsulot={m}
                currency={currency}
                balans={balansMap[m.Mahsulot_ID]}
                onEdit={() => openEdit(m)} onDelete={() => setDeleteTarget(m)} />
            ))}
          </div>
          );
        })()}
        {!loading && !error && shown < (view === "grid" ? filtered.length : sorted.length) && (
          <div ref={moreRef} style={{ padding: 14, textAlign: "center", color: "var(--text-3)", fontSize: 12, fontWeight: 600 }}>
            Yuklanmoqda… ({shown}/{view === "grid" ? filtered.length : sorted.length})
          </div>
        )}
      </div>

      {/* ── Mahsulot forma (drawer) — Xarid formasi bilan bir xil komponent ── */}
      <ProductDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        omborlar={isAdmin || !myOmbor ? omborlar : omborlar.filter(o => o.Ombor_ID === myOmbor)}
        defaultOmborId={myOmbor || undefined}
        editTarget={editTarget}
        onSaved={() => loadData(800)}
      />

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

/* ── Price Line ─────────────────────────────── */
function PriceLine({ label, value, blue, dim }: { label: string; value: string; blue?: boolean; dim?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: dim ? "var(--text-3)" : "var(--text-2)", whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ fontSize: dim ? 11.5 : 12.5, fontWeight: dim ? 600 : 800, color: dim ? "var(--text-3)" : (blue ? "#2563eb" : "var(--text)"), whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
}

/* ── List Card ──────────────────────────────── */
function ListCard({ mahsulot: m, currency, balans, onEdit, onDelete }: {
  mahsulot: Mahsulot; currency: string; balans?: number; onEdit: () => void; onDelete: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const router = useRouter();
  const hasSom    = m.Sotuv_som    && String(m.Sotuv_som).trim()    !== "" && String(m.Sotuv_som).trim()    !== "0";
  const hasDollar = m.Sotuv_dollar && String(m.Sotuv_dollar).trim() !== "" && String(m.Sotuv_dollar).trim() !== "0";

  return (
    <div className="list-card" style={{ cursor: "pointer" }} onClick={() => router.push(`/mahsulot/${m.Mahsulot_ID}`)}>
      <div className="list-card__img">
        {!imgError && m.Rasm
          ? <img src={`/api/image?path=${encodeURIComponent(m.Rasm)}`} alt={m.Nomi} onError={() => setImgError(true)} />
          : <div className="list-card__img-ph">📦</div>}
      </div>
      <div className="list-card__name">
        <p>{m.Nomi}</p>
        {m.Kg && <span>{m.Kg} kg</span>}
      </div>
      {currency !== "dollar" && (
        <div className="list-card__col">
          <p className="list-card__col-val">{hasSom ? `${Number(m.Sotuv_som).toLocaleString("ru-RU")}` : "—"}</p>
        </div>
      )}
      {currency !== "som" && (
        <div className="list-card__col">
          <p className="list-card__col-val" style={{ color: hasDollar ? "#2563eb" : undefined }}>
            {hasDollar ? `${Number(m.Sotuv_dollar).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : "—"}
          </p>
        </div>
      )}
      {currency !== "dollar" && (
        <div className="list-card__col">
          <p className="list-card__col-val--gray">
            {m.Tan_som && String(m.Tan_som).trim() !== "" && String(m.Tan_som).trim() !== "0"
              ? Number(m.Tan_som).toLocaleString("ru-RU") : "—"}
          </p>
        </div>
      )}
      {currency !== "som" && (
        <div className="list-card__col">
          <p className="list-card__col-val--gray" style={{ color: m.Tan_dollar && String(m.Tan_dollar).trim() !== "" && String(m.Tan_dollar).trim() !== "0" ? "#2563eb" : undefined }}>
            {m.Tan_dollar && String(m.Tan_dollar).trim() !== "" && String(m.Tan_dollar).trim() !== "0"
              ? Number(m.Tan_dollar).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : "—"}
          </p>
        </div>
      )}
      <div className="list-card__col">
        <p className="list-card__col-val" style={{ color: balans !== undefined && balans > 0 ? "var(--primary)" : balans !== undefined && balans < 0 ? "#ef4444" : "var(--text-3)", fontWeight: 700 }}>
          {balans !== undefined ? `${balans.toLocaleString("ru-RU")} dona` : "—"}
        </p>
      </div>
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

/* ── Grid Card ──────────────────────────────── */
function GridCard({ mahsulot: m, currency, omborNomi, jami, breakdown, balans, onEdit, onDelete }: {
  mahsulot: Mahsulot; currency: string; omborNomi: string; jami?: boolean; breakdown?: { nomi: string; qty: number }[]; balans?: number; onEdit: () => void; onDelete: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const router = useRouter();

  const hasSom    = m.Sotuv_som    && String(m.Sotuv_som).trim()    !== "" && String(m.Sotuv_som).trim()    !== "0";
  const hasDollar = m.Sotuv_dollar && String(m.Sotuv_dollar).trim() !== "" && String(m.Sotuv_dollar).trim() !== "0";
  const showSom    = currency !== "dollar";
  const showDollar = currency !== "som";

  return (
    <div className="card" style={{ cursor: "pointer" }}
      onClick={() => router.push(`/mahsulot/${m.Mahsulot_ID}`)}>
      {/* Kichikroq rasm */}
      <div className="card__img" style={{ aspectRatio: "unset", height: 120 }}>
        {!imgError && m.Rasm
          ? <img src={`/api/image?path=${encodeURIComponent(m.Rasm)}`} alt={m.Nomi} onError={() => setImgError(true)} />
          : <div className="card__img-placeholder" style={{ fontSize: 32 }}>📦</div>}
        <div className="card__actions">
          <button className="card__action-btn card__action-btn--edit" onClick={e => { e.stopPropagation(); onEdit(); }}>
            <svg width="15" height="15" fill="none" stroke="#2563eb" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
          <button className="card__action-btn card__action-btn--del" onClick={e => { e.stopPropagation(); onDelete(); }}>
            <svg width="15" height="15" fill="none" stroke="#ef4444" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="card__body">
        <p className="card__name">{m.Nomi || "—"}</p>

        {/* Ombor + zaxira chiplari */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: breakdown && breakdown.length ? 6 : 8, flexWrap: "wrap" }}>
          {omborNomi && (
            <span style={{ fontSize: 10, fontWeight: 700, color: "#15803d", background: "#dcfce7", padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{omborNomi}</span>
          )}
          {balans !== undefined && (
            <span style={{ fontSize: 10.5, fontWeight: 800, color: balans < 0 ? "#dc2626" : balans === 0 ? "var(--text-3)" : "#15803d", background: balans < 0 ? "#fef2f2" : balans === 0 ? "var(--bg)" : "#f0fdf4", padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>
              {jami ? "Jami: " : ""}{balans.toLocaleString("ru-RU")} dona
            </span>
          )}
        </div>
        {/* "Barchasi" ko'rinishida ombor bo'yicha taqsimot (qaysi omborda qancha) */}
        {breakdown && breakdown.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
            {breakdown.map(b => (
              <span key={b.nomi} style={{ fontSize: 10, fontWeight: 600, color: "var(--text-2)", background: "var(--bg)", border: "1px solid var(--border)", padding: "2px 7px", borderRadius: 8, whiteSpace: "nowrap" }}>
                {b.nomi}: <b style={{ color: b.qty < 0 ? "#dc2626" : "#15803d" }}>{b.qty.toLocaleString("ru-RU")}</b>
              </span>
            ))}
          </div>
        )}

        {/* Narxlar bloki */}
        <div style={{ background: "var(--bg-2)", borderRadius: 10, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 5 }}>
          {showSom && hasSom && (<>
            <PriceLine label="Sotuv (so'm)" value={Number(m.Sotuv_som).toLocaleString("ru-RU")} />
            {m.Tan_som && String(m.Tan_som).trim() !== "" && String(m.Tan_som).trim() !== "0" && (
              <PriceLine label="Tan (so'm)" value={Number(m.Tan_som).toLocaleString("ru-RU")} dim />
            )}
          </>)}
          {showDollar && hasDollar && (<>
            <PriceLine label="Sotuv ($)" value={Number(m.Sotuv_dollar).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} blue />
            {m.Tan_dollar && String(m.Tan_dollar).trim() !== "" && String(m.Tan_dollar).trim() !== "0" && (
              <PriceLine label="Tan ($)" value={Number(m.Tan_dollar).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} dim />
            )}
          </>)}
          {!hasSom && !hasDollar && (
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>Narx kiritilmagan</span>
          )}
        </div>
      </div>
    </div>
  );
}
