"use client";
import { fetchSheet, afterWrite } from "@/lib/sheet-cache";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Ombor {
  Ombor_ID: string; Nomi: string; Masul: string; Status: string;
}
interface Mahsulot {
  Mahsulot_ID: string; Ombor_ID: string; Nomi: string; Rasm: string;
  Tan_som: string; Sotuv_som: string; Tan_dollar: string; Sotuv_dollar: string; Kg: string;
}

type CurrencyType = "som" | "dollar";
type ViewMode = "grid" | "list";

function num(v: string | number | undefined) {
  return parseFloat(String(v || "0").replace(/\s/g, "").replace(",", ".")) || 0;
}
function fmtSom(v: number) {
  return v ? v.toLocaleString("ru-RU") + " so'm" : "—";
}
function fmtUsd(v: number) {
  return v ? "$" + v.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
}
function cardGrad(name: string) {
  const palettes = [
    ["#667eea","#764ba2"],["#f093fb","#f5576c"],["#4facfe","#00f2fe"],
    ["#43e97b","#38f9d7"],["#fa709a","#fee140"],["#a18cd1","#fbc2eb"],
    ["#30cfd0","#667eea"],["#f6d365","#fda085"],["#96fbc4","#f9f586"],["#fbc2eb","#a6c1ee"],
  ];
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  const [a, b] = palettes[h % palettes.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

export default function OmborPage() {
  const router = useRouter();
  const [mainOmbor, setMainOmbor]     = useState<Ombor | null>(null);
  const [mahsulotlar, setMahsulotlar] = useState<Mahsulot[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [search, setSearch]           = useState("");
  const [currency, setCurrency]       = useState<CurrencyType>("som");
  const [view, setView]               = useState<ViewMode>("grid");
  const [isMobile, setIsMobile]       = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const loadData = useCallback(() => {
    setLoading(true); setError(null);
    Promise.all([
      fetchSheet("Ombor"),
      fetchSheet("Mahsulot"),
    ]).then(([oRes, mRes]) => {
      if (oRes.error) throw new Error(oRes.error);
      if (mRes.error) throw new Error(mRes.error);
      setMainOmbor((oRes.data as Ombor[])[0] || null);
      setMahsulotlar(mRes.data as Mahsulot[]);
    })
    .catch((e: unknown) => setError(e instanceof Error ? e.message : "Xatolik"))
    .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const allMahsulotlar = mainOmbor
    ? mahsulotlar.filter(m => m.Ombor_ID === mainOmbor.Ombor_ID)
    : mahsulotlar;

  const filtered = allMahsulotlar.filter(m =>
    String(m.Nomi || "").toLowerCase().includes(search.toLowerCase())
  );

  const totalTanSom   = allMahsulotlar.reduce((s, m) => s + num(m.Tan_som),   0);
  const totalSotuvSom = allMahsulotlar.reduce((s, m) => s + num(m.Sotuv_som), 0);
  const totalTanUsd   = allMahsulotlar.reduce((s, m) => s + num(m.Tan_dollar),   0);
  const totalSotuvUsd = allMahsulotlar.reduce((s, m) => s + num(m.Sotuv_dollar), 0);
  const marjaSom      = totalSotuvSom - totalTanSom;
  const marjaUsd      = totalSotuvUsd - totalTanUsd;

  const stats = [
    {
      label: "MAHSULOTLAR",
      value: allMahsulotlar.length.toString(),
      sub: "ta mahsulot",
      color: "var(--primary)" as string,
      bg: "var(--white)" as string,
      icon: (
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
        </svg>
      ),
    },
    {
      label: "TAN NARXI",
      value: currency === "som" ? fmtSom(totalTanSom) : fmtUsd(totalTanUsd),
      sub: "umumiy kirim narx",
      color: "#64748b" as string,
      bg: "var(--white)" as string,
      icon: (
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
        </svg>
      ),
    },
    {
      label: "SOTUV NARXI",
      value: currency === "som" ? fmtSom(totalSotuvSom) : fmtUsd(totalSotuvUsd),
      sub: "umumiy chiqim narx",
      color: "var(--primary)" as string,
      bg: "#f0fdf4" as string,
      icon: (
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
        </svg>
      ),
    },
    {
      label: "TAXMINIY FOYDA",
      value: currency === "som" ? fmtSom(marjaSom) : fmtUsd(marjaUsd),
      sub: "sotuv − tan narxi",
      color: "#2563eb" as string,
      bg: "#eff6ff" as string,
      icon: (
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
        </svg>
      ),
    },
  ];

  return (
    <>
      <header className="header">
        <div className="header__inner">
          <div style={{ display: "flex", flexDirection: "column" }}>
            <h1 className="header__title" style={{ paddingLeft: 4 }}>Ombor</h1>
            {mainOmbor && (
              <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600, paddingLeft: 4, marginTop: 1 }}>
                {mainOmbor.Nomi}
              </span>
            )}
          </div>

          {!isMobile && (
            <div className="search" style={{ maxWidth: 280 }}>
              <span className="search__icon">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
              </span>
              <input className="search__input" placeholder="Mahsulot qidirish..." value={search}
                onChange={e => setSearch(e.target.value)}/>
              {search && (
                <button className="search__clear" onClick={() => setSearch("")}>
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              )}
            </div>
          )}

          <div className="header__spacer"/>

          {/* Currency toggle */}
          <div style={{ display: "flex", gap: 3, background: "var(--bg)", borderRadius: 10, padding: 3, border: "1px solid var(--border)" }}>
            {(["som", "dollar"] as CurrencyType[]).map(c => (
              <button key={c} onClick={() => setCurrency(c)} style={{
                padding: "5px 14px", borderRadius: 7, border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 700,
                background: currency === c ? "var(--white)" : "transparent",
                color: currency === c ? "var(--primary)" : "var(--text-3)",
                boxShadow: currency === c ? "0 1px 4px rgba(0,0,0,.08)" : "none",
                transition: "all .15s",
              }}>
                {c === "som" ? "So'm" : "$"}
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div style={{ display: "flex", gap: 3, background: "var(--bg)", borderRadius: 10, padding: 3, border: "1px solid var(--border)" }}>
            {([
              { v: "grid" as ViewMode, icon: <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" strokeWidth={2}/><rect x="14" y="3" width="7" height="7" rx="1" strokeWidth={2}/><rect x="3" y="14" width="7" height="7" rx="1" strokeWidth={2}/><rect x="14" y="14" width="7" height="7" rx="1" strokeWidth={2}/></svg> },
              { v: "list" as ViewMode, icon: <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg> },
            ]).map(({ v, icon }) => (
              <button key={v} onClick={() => setView(v)} style={{
                width: 32, height: 30, borderRadius: 7, border: "none", cursor: "pointer",
                background: view === v ? "var(--white)" : "transparent",
                color: view === v ? "var(--primary)" : "var(--text-3)",
                boxShadow: view === v ? "0 1px 4px rgba(0,0,0,.08)" : "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all .15s",
              }}>
                {icon}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="page-content">
        {loading && <div className="spinner--page"/>}
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
            {/* Mobile search */}
            {isMobile && (
              <div className="search" style={{ marginBottom: 14 }}>
                <span className="search__icon">
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                </span>
                <input className="search__input" placeholder="Mahsulot qidirish..." value={search}
                  onChange={e => setSearch(e.target.value)}/>
                {search && (
                  <button className="search__clear" onClick={() => setSearch("")}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                )}
              </div>
            )}

            {/* Stats */}
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
              gap: isMobile ? 10 : 14,
              marginBottom: isMobile ? 16 : 24,
            }}>
              {stats.map((s, i) => (
                <div key={i} style={{
                  background: s.bg, borderRadius: "var(--radius-xl)",
                  boxShadow: "var(--shadow-sm)", padding: isMobile ? "14px 14px" : "18px 20px",
                  border: "1px solid var(--border)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".06em" }}>{s.label}</span>
                    <span style={{ color: s.color, opacity: .6 }}>{s.icon}</span>
                  </div>
                  <p style={{ fontSize: isMobile ? 13 : 15, fontWeight: 800, color: s.color, lineHeight: 1.2, wordBreak: "break-all" }}>{s.value}</p>
                  <p style={{ fontSize: 10, color: "var(--text-3)", marginTop: 4 }}>{s.sub}</p>
                </div>
              ))}
            </div>

            {/* Count */}
            <p className="count-label" style={{ marginBottom: 14 }}>
              {search ? `${filtered.length} ta topildi` : `${allMahsulotlar.length} ta mahsulot`}
            </p>

            {filtered.length === 0 ? (
              <div className="empty">
                <div className="empty__icon">📦</div>
                <p className="empty__title">Mahsulot topilmadi</p>
              </div>
            ) : view === "grid" ? (
              <div style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(auto-fill, minmax(210px, 1fr))",
                gap: isMobile ? 12 : 16,
              }}>
                {filtered.map(m => (
                  <ProductCard key={m.Mahsulot_ID || m.Nomi} mahsulot={m} currency={currency}
                    onPress={() => router.push(`/ombor/${m.Mahsulot_ID}`)}/>
                ))}
              </div>
            ) : (
              <div style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", overflow: "hidden", border: "1px solid var(--border)" }}>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "44px 1fr 110px" : "44px 1fr 155px 155px 70px 110px",
                  padding: "10px 16px",
                  background: "var(--bg)", borderBottom: "1px solid var(--border)",
                }}>
                  {(isMobile
                    ? ["", "NOMI", "NARX"]
                    : ["", "NOMI", "TAN NARXI", "SOTUV NARXI", "KG", "FOYDA"]
                  ).map((h, i) => (
                    <span key={i} style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".05em" }}>{h}</span>
                  ))}
                </div>
                {filtered.map((m, idx) => (
                  <ProductRow key={m.Mahsulot_ID || m.Nomi} mahsulot={m} currency={currency}
                    idx={idx} total={filtered.length} isMobile={isMobile}
                    onPress={() => router.push(`/ombor/${m.Mahsulot_ID}`)}/>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

/* ── Product Card (grid) ──────────────────────────────── */
function ProductCard({ mahsulot: m, currency, onPress }: { mahsulot: Mahsulot; currency: CurrencyType; onPress: () => void }) {
  const [imgErr, setImgErr] = useState(false);
  const [hovered, setHovered] = useState(false);
  const tanVal   = currency === "som" ? num(m.Tan_som)   : num(m.Tan_dollar);
  const sotuvVal = currency === "som" ? num(m.Sotuv_som) : num(m.Sotuv_dollar);
  const marjaPct = tanVal > 0 ? Math.round((sotuvVal - tanVal) / tanVal * 100) : 0;
  const fmtFn    = currency === "som" ? fmtSom : fmtUsd;
  const hasImg   = !imgErr && m.Rasm;

  return (
    <div
      onClick={onPress}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "var(--white)", borderRadius: "var(--radius-xl)",
        border: "1px solid var(--border)", overflow: "hidden",
        boxShadow: hovered ? "0 8px 28px rgba(0,0,0,.10)" : "var(--shadow-sm)",
        transform: hovered ? "translateY(-3px)" : "none",
        transition: "transform .18s ease, box-shadow .18s ease",
        cursor: "pointer",
      }}>

      {/* Image */}
      <div style={{
        height: 148, position: "relative", overflow: "hidden",
        background: hasImg ? "#f8fafc" : cardGrad(m.Nomi || ""),
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {hasImg ? (
          <img src={`/api/image?path=${encodeURIComponent(m.Rasm)}`} alt={m.Nomi}
            onError={() => setImgErr(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover",
              transform: hovered ? "scale(1.04)" : "scale(1)", transition: "transform .3s ease" }}/>
        ) : (
          <svg width="36" height="36" fill="none" stroke="rgba(255,255,255,.75)" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.4}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
          </svg>
        )}

        {/* Margin badge */}
        {marjaPct > 0 && (
          <div style={{
            position: "absolute", top: 8, right: 8,
            background: "rgba(22,163,74,.88)", color: "#fff",
            fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 20,
          }}>
            +{marjaPct}%
          </div>
        )}

        {/* Kg badge */}
        {m.Kg && (
          <div style={{
            position: "absolute", bottom: 8, left: 8,
            background: "rgba(0,0,0,.38)", color: "#fff",
            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
          }}>
            {m.Kg} kg
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: "12px 14px 14px" }}>
        <p style={{
          fontSize: 13, fontWeight: 700, color: "var(--text)",
          marginBottom: 10, lineHeight: 1.35,
          maxHeight: "2.7em", overflow: "hidden",
        }}>
          {m.Nomi || "—"}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 600 }}>Tan narxi</span>
            <span style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 600 }}>{fmtFn(tanVal)}</span>
          </div>
          <div style={{ height: 1, background: "var(--border)" }}/>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 600 }}>Sotuv narxi</span>
            <span style={{ fontSize: 14, color: "var(--primary)", fontWeight: 800 }}>{fmtFn(sotuvVal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Product Row (list) ───────────────────────────────── */
function ProductRow({ mahsulot: m, currency, idx, total, isMobile, onPress }: {
  mahsulot: Mahsulot; currency: CurrencyType; idx: number; total: number; isMobile: boolean; onPress: () => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  const tanVal   = currency === "som" ? num(m.Tan_som)   : num(m.Tan_dollar);
  const sotuvVal = currency === "som" ? num(m.Sotuv_som) : num(m.Sotuv_dollar);
  const marja    = sotuvVal - tanVal;
  const marjaPct = tanVal > 0 ? Math.round(marja / tanVal * 100) : 0;
  const fmtFn    = currency === "som" ? fmtSom : fmtUsd;
  const hasImg   = !imgErr && m.Rasm;

  return (
    <div
      onClick={onPress}
      style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "44px 1fr 110px" : "44px 1fr 155px 155px 70px 110px",
        padding: "11px 16px", alignItems: "center",
        borderBottom: idx < total - 1 ? "1px solid var(--border)" : "none",
        transition: "background .12s", cursor: "pointer",
      }}
      onMouseEnter={e => (e.currentTarget.style.background = "var(--bg)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>

      {/* Thumbnail */}
      <div style={{
        width: 38, height: 38, borderRadius: 10, overflow: "hidden", flexShrink: 0,
        background: hasImg ? "#f1f5f9" : cardGrad(m.Nomi || ""),
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {hasImg ? (
          <img src={`/api/image?path=${encodeURIComponent(m.Rasm)}`} alt={m.Nomi}
            onError={() => setImgErr(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
        ) : (
          <svg width="14" height="14" fill="none" stroke="rgba(255,255,255,.8)" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
          </svg>
        )}
      </div>

      {/* Name */}
      <div style={{ paddingRight: 10, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {m.Nomi || "—"}
        </p>
        {m.Kg && (
          <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2, fontWeight: 600 }}>{m.Kg} kg</p>
        )}
      </div>

      {!isMobile ? (
        <>
          <span style={{ fontSize: 13, color: "var(--text-2)", fontWeight: 600 }}>{fmtFn(tanVal)}</span>
          <span style={{ fontSize: 14, color: "var(--primary)", fontWeight: 800 }}>{fmtFn(sotuvVal)}</span>
          <span style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>
            {m.Kg ? `${m.Kg} kg` : "—"}
          </span>
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, color: marja >= 0 ? "#16a34a" : "#ef4444" }}>
              {marja >= 0 ? "+" : ""}{fmtFn(marja)}
            </span>
            {marjaPct > 0 && (
              <p style={{ fontSize: 10, color: "#16a34a", fontWeight: 700, marginTop: 1 }}>+{marjaPct}%</p>
            )}
          </div>
        </>
      ) : (
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: "var(--primary)" }}>{fmtFn(sotuvVal)}</p>
          <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{fmtFn(tanVal)}</p>
        </div>
      )}
    </div>
  );
}
