"use client";

import { fetchSheet } from "@/lib/sheet-cache";
import { exportPDF, type ExportOpts } from "@/lib/export";
import { computeInvByOmbor, shopWarehouseSet, type FoydalanuvchiLike } from "@/lib/ombor-transfer";
import { usePersistedState } from "@/lib/usePersistedState";
import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";

interface Mahsulot {
  Mahsulot_ID: string; Ombor_ID: string; Nomi: string;
  Sotuv_som: string; Sotuv_dollar: string;
}
interface SelItem { som: string; usd: string; }

function n(v: string | number | undefined) {
  return parseFloat(String(v || "0").replace(/\s/g, "").replace(",", ".")) || 0;
}
function fmtSom(v: number) { return v ? v.toLocaleString("ru-RU") + " so'm" : "—"; }
function fmtUsd(v: number) { return v ? "$" + v.toLocaleString("ru-RU", { maximumFractionDigits: 3 }) : "—"; }
function sanaStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

export default function NarxChekPage() {
  const router = useRouter();
  const [mahsulotlar, setMahsulotlar] = useState<Mahsulot[]>([]);
  const [balans, setBalans]           = useState<Record<string, number>>({});
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = usePersistedState("flt:narxchek:search", "");
  // Tanlangan mahsulotlar + (tahrirlangan) narxlar — localStorage'da saqlanadi
  const [items, setItems]             = usePersistedState<Record<string, SelItem>>("flt:narxchek:items", {});
  const [shown, setShown]             = useState(60);
  const [isMobile, setIsMobile]       = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 899px)");
    const c = () => setIsMobile(mq.matches);
    c(); mq.addEventListener("change", c); return () => mq.removeEventListener("change", c);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchSheet("Mahsulot"),
      fetchSheet("Sotuv_Savat"),
      fetchSheet("Sotuv_Savat_Dollar"),
      fetchSheet("Xarid_Savat"),
      fetchSheet("Foydalanuvchi"),
    ]).then(([mRes, ssRes, ssdRes, xsRes, fRes]) => {
      setMahsulotlar(((mRes.data as Mahsulot[]) || []).filter(m => m.Mahsulot_ID));
      const shopWH = shopWarehouseSet((fRes.data as FoydalanuvchiLike[]) || []);
      const { global } = computeInvByOmbor(
        xsRes.data as Record<string, string>[],
        ssRes.data as Record<string, string>[],
        ssdRes.data as Record<string, string>[],
        shopWH,
      );
      setBalans(global);
    }).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() =>
    mahsulotlar.filter(m => String(m.Nomi || "").toLowerCase().includes(search.toLowerCase())),
    [mahsulotlar, search]);

  useEffect(() => { setShown(60); }, [search]);
  useEffect(() => {
    const el = moreRef.current; if (!el) return;
    const io = new IntersectionObserver(es => { if (es[0].isIntersecting) setShown(s => s + 60); });
    io.observe(el); return () => io.disconnect();
  }, [filtered.length]);

  const selCount = Object.keys(items).length;

  function toggle(m: Mahsulot) {
    setItems(prev => {
      const next = { ...prev };
      if (next[m.Mahsulot_ID]) delete next[m.Mahsulot_ID];
      else next[m.Mahsulot_ID] = { som: m.Sotuv_som || "", usd: m.Sotuv_dollar || "" };
      return next;
    });
  }
  function setPrice(id: string, field: keyof SelItem, val: string) {
    setItems(prev => prev[id] ? { ...prev, [id]: { ...prev[id], [field]: val } } : prev);
  }
  function clearAll() { setItems({}); }

  function selectedList(): { m: Mahsulot; it: SelItem }[] {
    return mahsulotlar.filter(m => items[m.Mahsulot_ID]).map(m => ({ m, it: items[m.Mahsulot_ID] }));
  }

  function buildChek(): ExportOpts {
    const list = selectedList();
    const rows = list.map(({ m, it }, i) => [
      i + 1,
      m.Nomi || "—",
      fmtSom(n(it.som)),
      fmtUsd(n(it.usd)),
      `${(balans[m.Mahsulot_ID] ?? 0).toLocaleString("ru-RU")} dona`,
    ]);
    return {
      title: "Musaffotea mahsulotlari",
      subtitle: `${sanaStr()}  ·  ${list.length} ta mahsulot`,
      filename: `musaffotea-mahsulotlar-${sanaStr().replace(/\./g, "-")}`,
      center: true,
      sections: [{ headers: ["№", "Mahsulot nomi", "Narx (so'm)", "Narx ($)", "Omborda bor"], rows }],
    };
  }

  async function shareTelegram() {
    const list = selectedList();
    if (!list.length) return;
    const lines = list.map(({ m, it }, i) => {
      const som = n(it.som), usd = n(it.usd);
      const parts: string[] = [];
      if (som) parts.push(`${som.toLocaleString("ru-RU")} so'm`);
      if (usd) parts.push(`$${usd.toLocaleString("ru-RU", { maximumFractionDigits: 3 })}`);
      return `${i + 1}. ${m.Nomi || "—"} — ${parts.join(" · ") || "—"}`;
    });
    const text = `📋 MUSAFFOTEA MAHSULOTLARI\n📅 ${sanaStr()} · ${list.length} ta\n\n${lines.join("\n")}`;
    // Mobil: tizim ulashish oynasi (Telegram to'g'ridan-to'g'ri matnni oladi)
    if (isMobile && typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ text }); } catch { /* foydalanuvchi bekor qildi */ }
      return;
    }
    // Desktop (yoki share yo'q): avval Telegram web ochiladi (gesture saqlanadi), so'ng nusxalanadi — kerakli chatga paste
    window.open("https://web.telegram.org/", "_blank");
    let copied = false;
    try { await navigator.clipboard.writeText(text); copied = true; } catch { /* clipboard bloklangan */ }
    alert(copied
      ? "Chek matni nusxalandi ✅\nOchilgan Telegram'da kerakli chatga joylashtiring (Ctrl+V)."
      : "Telegram ochildi. Matnni qo'lda ko'chiring.");
  }

  const inputStyle: React.CSSProperties = {
    padding: "7px 9px", border: "1px solid var(--border)", borderRadius: "var(--radius)",
    fontSize: 13, fontWeight: 700, outline: "none", textAlign: "right", width: "100%", boxSizing: "border-box", background: "var(--white)",
  };

  // O'ng panel — tanlangan mahsulotlar (nomi + narxi)
  const summaryPanel = (
    <div style={{ position: isMobile ? "static" : "sticky", top: 12, background: "var(--white)", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", padding: "14px 16px", maxHeight: isMobile ? undefined : "calc(100dvh - 90px)", overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 800 }}>Tanlangan ({selCount})</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".03em" }}>Narxlari</span>
      </div>
      {selCount === 0 ? (
        <p style={{ fontSize: 12, color: "var(--text-3)" }}>Mahsulot tanlanmagan</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {selectedList().map(({ m, it }, i) => {
            const som = n(it.som), usd = n(it.usd);
            const narx = [som ? som.toLocaleString("ru-RU") + " so'm" : "", usd ? "$" + usd.toLocaleString("ru-RU", { maximumFractionDigits: 3 }) : ""].filter(Boolean).join(" · ") || "—";
            return (
              <div key={m.Mahsulot_ID} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i + 1}. {m.Nomi || "—"}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: "var(--primary)", whiteSpace: "nowrap", flexShrink: 0 }}>{narx}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <>
      <header className="header" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="header__inner" style={{ gap: 12, flexWrap: "wrap" }}>
          <button onClick={() => router.push("/mahsulot")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--white)", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text-2)", flexShrink: 0 }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg> Orqaga
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 className="header__title">Mijoz cheki</h1>
            <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>Mahsulot va narxni tanlab chek chiqarish</p>
          </div>
          {!isMobile && selCount > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn--primary" onClick={() => exportPDF(buildChek())} title="Chek (PDF)">
                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2zm-1-12v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2m-3 5h12" /></svg>
                Chek ({selCount})
              </button>
              <button className="btn btn--outline" onClick={shareTelegram} title="Telegram" style={{ color: "#229ED9" }}>
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71l-4.14-3.05-1.99 1.93c-.23.23-.42.42-.83.42z" /></svg>
                Telegram
              </button>
              <button className="btn btn--outline" onClick={clearAll} title="Tozalash (sbros)" style={{ color: "#ef4444", borderColor: "#fecaca" }}>
                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                Tozalash
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="page-content" style={{ maxWidth: isMobile ? 820 : 1140, paddingBottom: isMobile && selCount > 0 ? 80 : undefined }}>
        <div style={isMobile ? undefined : { display: "grid", gridTemplateColumns: "1fr 300px", gap: 16, alignItems: "start" }}>
          <div>
        {isMobile && selCount > 0 && <div style={{ marginBottom: 12 }}>{summaryPanel}</div>}
        <div className="search" style={{ marginBottom: 14 }}>
          <span className="search__icon"><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></span>
          <input className="search__input" placeholder="Mahsulot qidirish..." value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className="search__clear" onClick={() => setSearch("")}><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>}
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}><div className="spinner--page" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty"><p className="empty__title">Mahsulot topilmadi</p></div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.slice(0, shown).map(m => {
              const it = items[m.Mahsulot_ID];
              const sel = !!it;
              const soni = balans[m.Mahsulot_ID] ?? 0;
              return (
                <div key={m.Mahsulot_ID}
                  style={{ background: "var(--white)", border: `1px solid ${sel ? "var(--primary)" : "var(--border)"}`, borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <input type="checkbox" checked={sel} onChange={() => toggle(m)}
                      style={{ width: 18, height: 18, flexShrink: 0, cursor: "pointer", accentColor: "#2563eb" }} />
                    <div style={{ minWidth: 0, flex: 1, cursor: "pointer" }} onClick={() => toggle(m)}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.Nomi || "—"}</p>
                      {!sel && <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{fmtSom(n(m.Sotuv_som))} · {fmtUsd(n(m.Sotuv_dollar))}</p>}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: soni > 0 ? "var(--primary)" : "var(--text-3)", flexShrink: 0, whiteSpace: "nowrap" }}>{soni.toLocaleString("ru-RU")} dona</span>
                  </div>
                  {sel && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 4 }}>Narx (so&apos;m)</label>
                        <input value={it.som} onChange={e => setPrice(m.Mahsulot_ID, "som", e.target.value)} inputMode="decimal" placeholder="0" style={inputStyle} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 4 }}>Narx ($)</label>
                        <input value={it.usd} onChange={e => setPrice(m.Mahsulot_ID, "usd", e.target.value)} inputMode="decimal" placeholder="0" style={{ ...inputStyle, color: "#2563eb" }} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {shown < filtered.length && (
              <div ref={moreRef} style={{ padding: 12, textAlign: "center", color: "var(--text-3)", fontSize: 12, fontWeight: 600 }}>
                Yuklanmoqda… ({shown}/{filtered.length})
              </div>
            )}
          </div>
        )}
          </div>
          {!isMobile && summaryPanel}
        </div>
      </div>

      {/* Mobil — pastki amal paneli */}
      {isMobile && selCount > 0 && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 60, background: "var(--white)", borderTop: "1px solid var(--border)", boxShadow: "0 -4px 20px rgba(30,64,124,.14)", padding: "10px 14px", paddingBottom: "max(10px, env(safe-area-inset-bottom))", display: "flex", gap: 8 }}>
          <button className="btn btn--primary" style={{ flex: 2, justifyContent: "center" }} onClick={() => exportPDF(buildChek())}>
            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2zm-1-12v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2m-3 5h12" /></svg>
            Chek ({selCount})
          </button>
          <button className="btn btn--outline" style={{ flex: 1, justifyContent: "center", color: "#229ED9" }} onClick={shareTelegram} title="Telegram">
            <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71l-4.14-3.05-1.99 1.93c-.23.23-.42.42-.83.42z" /></svg>
          </button>
          <button className="btn btn--outline" style={{ flex: 1, justifyContent: "center", color: "#ef4444", borderColor: "#fecaca" }} onClick={clearAll} title="Tozalash">
            <svg width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}
    </>
  );
}
