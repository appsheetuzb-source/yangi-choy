"use client";

import { useEffect, useState, useCallback } from "react";

interface Mijoz {
  Mijoz_ID: string;
  Ism: string;
  Telefon: string;
  Valyuta: string;
}

interface Balans {
  Mijoz_ID: string;
  Oldi_som: string;
  Oldi_dollar: string;
  Berdi_som: string;
  Berdi_dollar: string;
  Qoldi_som: string;
  Qoldi_dollar: string;
}

interface MijozRow extends Mijoz, Partial<Balans> {}

function num(v: string | number | undefined): number {
  return parseFloat(String(v || "0").replace(/\s/g, "").replace(",", ".")) || 0;
}
function fmtSom(v: string | number | undefined) {
  const n = num(v);
  return n.toLocaleString("ru-RU") + " so'm";
}
function fmtDollar(v: string | number | undefined) {
  const n = num(v);
  return "$" + n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function MijozlarPage() {
  const [mijozlar, setMijozlar]   = useState<MijozRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [search, setSearch]       = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mRes, bRes] = await Promise.all([
        fetch("/api/sheets?range=Mijozlar").then(r => r.json()),
        fetch("/api/sheets?range=MijozBalans").then(r => r.json()),
      ]);
      if (mRes.error) throw new Error(mRes.error);

      const balansMap: Record<string, Balans> = {};
      if (!bRes.error) {
        (bRes.data as Balans[]).forEach(b => { balansMap[b.Mijoz_ID] = b; });
      }

      const rows: MijozRow[] = (mRes.data as Mijoz[]).map(m => ({
        ...m, ...(balansMap[m.Mijoz_ID] || {}),
      }));
      setMijozlar(rows);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Xatolik");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const isSom    = (m: MijozRow) => { const v = String(m.Valyuta||"").toLowerCase(); return v.includes("so'm")||v.includes("som"); };
  const isDollar = (m: MijozRow) => { const v = String(m.Valyuta||"").toLowerCase(); return v.includes("dollar")||v.includes("$"); };

  const matchSearch = (m: MijozRow) =>
    String(m.Ism||"").toLowerCase().includes(search.toLowerCase()) ||
    String(m.Telefon||"").includes(search);

  const somList    = mijozlar.filter(m => isSom(m) && matchSearch(m));
  const dollarList = mijozlar.filter(m => isDollar(m) && matchSearch(m));

  return (
    <>
      <header className="header">
        <div className="header__inner">
          <h1 className="header__title" style={{ paddingLeft: 4 }}>Mijozlar</h1>
          <div className="search" style={{ maxWidth: 300 }}>
            <span className="search__icon">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
            </span>
            <input className="search__input" placeholder="Ism yoki telefon..." value={search}
              onChange={e => setSearch(e.target.value)} />
            {search && (
              <button className="search__clear" onClick={() => setSearch("")}>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="page-content">
        {loading && <div className="spinner--page" />}
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
            {/* So'm bo'limi */}
            <Section title="So'm mijozlar" count={somList.length} currency="som" rows={somList} />

            <div style={{ height: 32 }} />

            {/* Dollar bo'limi */}
            <Section title="Dollar mijozlar" count={dollarList.length} currency="dollar" rows={dollarList} />
          </>
        )}
      </div>
    </>
  );
}

/* ── Section ─────────────────────────────── */
function Section({ title, count, currency, rows }: {
  title: string; count: number; currency: "som" | "dollar"; rows: MijozRow[];
}) {
  return (
    <div>
      {/* Bo'lim sarlavhasi */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{title}</h2>
        <span style={{
          fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
          background: "var(--primary)", color: "#fff",
        }}>{count}</span>
      </div>

      {rows.length === 0 ? (
        <div className="empty" style={{ padding: "32px 0" }}>
          <p style={{ fontSize: 13, color: "var(--text-3)" }}>Mijoz topilmadi</p>
        </div>
      ) : (
        <div className="list">
          {/* Ustun sarlavhalari */}
          <div className="list__head">
            <div className="list__head-img" style={{ width: 48 }} />
            <div className="list__head-name"><span>Ism</span></div>
            <div className="list__head-col"><span style={{ background: "#2563eb" }}>Sotuv</span></div>
            <div className="list__head-col"><span style={{ background: "#16a34a" }}>To&apos;lov</span></div>
            <div className="list__head-col"><span>Balans</span></div>
          </div>

          {rows.map((m, i) => (
            <MijozCard key={m.Mijoz_ID || i} mijoz={m} currency={currency} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── MijozCard ───────────────────────────── */
function MijozCard({ mijoz: m, currency }: { mijoz: MijozRow; currency: "som" | "dollar" }) {
  const initials = String(m.Ism || "?").split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();

  const sotuv   = currency === "som" ? fmtSom(m.Oldi_som)   : fmtDollar(m.Oldi_dollar);
  const tolov   = currency === "som" ? fmtSom(m.Berdi_som)  : fmtDollar(m.Berdi_dollar);
  const balansN = currency === "som" ? num(m.Qoldi_som)     : num(m.Qoldi_dollar);
  const balans  = currency === "som" ? fmtSom(m.Qoldi_som)  : fmtDollar(m.Qoldi_dollar);

  const balansColor = balansN > 0 ? "#dc2626" : balansN < 0 ? "#2563eb" : "#16a34a";

  return (
    <div className="list-card">
      {/* Avatar */}
      <div style={{
        width: 48, height: 72, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--bg)", fontSize: 14, fontWeight: 700, color: "var(--text-2)",
      }}>
        {initials}
      </div>

      {/* Ism + telefon */}
      <div className="list-card__name">
        <p>{m.Ism || "—"}</p>
        <span>{m.Telefon || ""}</span>
      </div>

      {/* Sotuv — ko'k */}
      <div className="list-card__col">
        <p style={{ fontSize: 15, fontWeight: 700, color: "#2563eb", whiteSpace: "nowrap" }}>{sotuv}</p>
      </div>

      {/* To'lov — yashil */}
      <div className="list-card__col">
        <p style={{ fontSize: 15, fontWeight: 700, color: "#16a34a", whiteSpace: "nowrap" }}>{tolov}</p>
      </div>

      {/* Balans — qizil (qarz) / yashil (teng) / ko'k (ortiqcha) */}
      <div className="list-card__col">
        <p style={{ fontSize: 15, fontWeight: 700, color: balansColor, whiteSpace: "nowrap" }}>{balans}</p>
        {balansN > 0 && (
          <span style={{ fontSize: 10, color: "#dc2626", fontWeight: 600 }}>qarz</span>
        )}
      </div>
    </div>
  );
}
