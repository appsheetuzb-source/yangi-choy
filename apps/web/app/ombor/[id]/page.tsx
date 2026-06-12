"use client";

import { fetchSheet } from "@/lib/sheet-cache";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface Mahsulot {
  Mahsulot_ID: string; Ombor_ID: string; Nomi: string; Rasm: string;
  Tan_som: string; Sotuv_som: string; Tan_dollar: string; Sotuv_dollar: string; Kg: string;
}

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

export default function MahsulotDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [mahsulot, setMahsulot] = useState<Mahsulot | null>(null);
  const [loading, setLoading]   = useState(true);
  const [imgErr, setImgErr]     = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!id) return;
    fetchSheet("Mahsulot")
      .then(res => {
        const found = (res.data as Mahsulot[]).find(m => m.Mahsulot_ID === id) || null;
        setMahsulot(found);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="page-content" style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
      <div className="spinner--page"/>
    </div>
  );

  if (!mahsulot) return (
    <div className="page-content">
      <div className="empty">
        <p className="empty__title">Mahsulot topilmadi</p>
        <button className="btn btn--outline" onClick={() => router.back()}>← Orqaga</button>
      </div>
    </div>
  );

  const tanSom   = num(mahsulot.Tan_som);
  const tanUsd   = num(mahsulot.Tan_dollar);
  const sotuvSom = num(mahsulot.Sotuv_som);
  const sotuvUsd = num(mahsulot.Sotuv_dollar);
  const marjaSom = sotuvSom - tanSom;
  const marjaUsd = sotuvUsd - tanUsd;
  const marjaPct = tanSom > 0 ? Math.round(marjaSom / tanSom * 100) : tanUsd > 0 ? Math.round(marjaUsd / tanUsd * 100) : 0;
  const hasImg   = !imgErr && mahsulot.Rasm;

  const priceBlocks = [
    {
      group: "TAN NARXI",
      color: "#64748b",
      bg: "var(--white)",
      items: [
        { label: "So'm", value: fmtSom(tanSom), color: "var(--text)" },
        { label: "Dollar", value: fmtUsd(tanUsd), color: "#2563eb" },
      ],
    },
    {
      group: "SOTUV NARXI",
      color: "var(--primary)",
      bg: "#f0fdf4",
      items: [
        { label: "So'm", value: fmtSom(sotuvSom), color: "var(--primary)" },
        { label: "Dollar", value: fmtUsd(sotuvUsd), color: "#2563eb" },
      ],
    },
    {
      group: "FOYDA",
      color: marjaSom > 0 ? "#16a34a" : "#64748b",
      bg: marjaSom > 0 ? "#f0fdf4" : "var(--white)",
      items: [
        { label: "So'm", value: marjaSom ? (marjaSom > 0 ? "+" : "") + fmtSom(marjaSom) : "—", color: marjaSom > 0 ? "#16a34a" : "var(--text-3)" },
        { label: "Dollar", value: marjaUsd ? (marjaUsd > 0 ? "+" : "") + fmtUsd(marjaUsd) : "—", color: marjaUsd > 0 ? "#16a34a" : "var(--text-3)" },
      ],
    },
  ];

  return (
    <>
      <header className="header">
        <div className="header__inner" style={{ gap: 14 }}>
          <button onClick={() => router.back()} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
            border: "1px solid var(--border)", borderRadius: "var(--radius)",
            background: "var(--white)", cursor: "pointer", fontSize: 13,
            fontWeight: 600, color: "var(--text-2)", flexShrink: 0,
          }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
            Orqaga
          </button>
          <div style={{ flex: 1 }}/>
        </div>
      </header>

      <div className="page-content" style={{ maxWidth: 760 }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "260px 1fr",
          gap: isMobile ? 16 : 28,
          marginBottom: 24,
        }}>
          {/* Image */}
          <div style={{
            borderRadius: "var(--radius-xl)", overflow: "hidden",
            aspectRatio: "1 / 1",
            background: hasImg ? "#f1f5f9" : cardGrad(mahsulot.Nomi || ""),
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "var(--shadow-sm)", border: "1px solid var(--border)",
            position: "relative",
          }}>
            {hasImg ? (
              <img src={`/api/image?path=${encodeURIComponent(mahsulot.Rasm)}`}
                alt={mahsulot.Nomi} onError={() => setImgErr(true)}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
            ) : (
              <svg width="56" height="56" fill="none" stroke="rgba(255,255,255,.65)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
              </svg>
            )}
            {marjaPct > 0 && (
              <div style={{
                position: "absolute", top: 12, right: 12,
                background: "rgba(22,163,74,.9)", color: "#fff",
                fontSize: 13, fontWeight: 800, padding: "5px 12px", borderRadius: 24,
              }}>
                +{marjaPct}%
              </div>
            )}
          </div>

          {/* Info */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <h1 style={{ fontSize: isMobile ? 20 : 24, fontWeight: 800, lineHeight: 1.3, marginBottom: 8 }}>
                {mahsulot.Nomi || "—"}
              </h1>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {mahsulot.Kg && (
                  <span style={{
                    fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 20,
                    background: "var(--bg)", color: "var(--text-2)", border: "1px solid var(--border)",
                  }}>
                    {mahsulot.Kg} kg
                  </span>
                )}
                <span style={{
                  fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 20,
                  background: "var(--bg)", color: "var(--text-3)", border: "1px solid var(--border)",
                }}>
                  ID: {mahsulot.Mahsulot_ID}
                </span>
              </div>
            </div>

            {/* Price blocks */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {priceBlocks.map((block, bi) => (
                <div key={bi} style={{
                  background: block.bg, borderRadius: "var(--radius-xl)",
                  border: "1px solid var(--border)", padding: "14px 18px",
                }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".06em", marginBottom: 10 }}>
                    {block.group}
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {block.items.map((item, ii) => (
                      <div key={ii}>
                        <p style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600, marginBottom: 3 }}>{item.label}</p>
                        <p style={{ fontSize: 16, fontWeight: 800, color: item.color }}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
