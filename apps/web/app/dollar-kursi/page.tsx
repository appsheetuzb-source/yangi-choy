"use client";
import { fetchSheet, afterWrite } from "@/lib/sheet-cache";
import { useEffect, useState, useMemo } from "react";

interface KursRow { Kurs_ID: string; Sana_1: string; Kurs: string; }

function n(v: unknown) { return parseFloat(String(v ?? "0").replace(/\s/g, "").replace(",", ".")) || 0; }
function uid() { return Math.random().toString(36).slice(2, 10); }
function today() {
  const t = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tashkent" }));
  const p = (x: number) => String(x).padStart(2, "0");
  return `${p(t.getDate())}.${p(t.getMonth() + 1)}.${t.getFullYear()}`;
}
function fmt(v: number) { return v.toLocaleString("ru-RU"); }

export default function DollarKursiPage() {
  const [rows, setRows] = useState<KursRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [val, setVal] = useState("");
  const [saving, setSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => { const c = () => setIsMobile(window.innerWidth < 768); c(); window.addEventListener("resize", c); return () => window.removeEventListener("resize", c); }, []);

  function load() {
    setLoading(true);
    fetchSheet("Kurs").then(r => {
      setRows(((r.data || []) as KursRow[]).filter(k => k.Kurs && n(k.Kurs) > 0));
    }).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  const current = rows.length ? rows[rows.length - 1] : null;
  const prev = rows.length > 1 ? rows[rows.length - 2] : null;
  const diff = current && prev ? n(current.Kurs) - n(prev.Kurs) : 0;
  const history = useMemo(() => [...rows].reverse(), [rows]);

  const newVal = n(val);
  const tooLow = newVal > 0 && newVal < 11000;

  async function save() {
    if (newVal <= 0 || saving) return;
    if (tooLow && !confirm("Kurs 11 000 dan past. Davom etasizmi?")) return;
    setSaving(true);
    try {
      const last = rows[rows.length - 1];
      if (last && last.Sana_1 === today() && last.Kurs_ID) {
        // Bugungi kurs bor — yangilaymiz
        await fetch("/api/sheets", { method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sheet: "Kurs", idColumn: "Kurs_ID", idValue: last.Kurs_ID, updates: { Kurs: String(newVal) } }) });
      } else {
        await fetch("/api/sheets", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sheet: "Kurs", row: { Kurs_ID: uid(), Sana_1: today(), Kurs: String(newVal) } }) });
      }
      afterWrite("Kurs");
      setVal("");
      setTimeout(load, 500);
    } finally { setSaving(false); }
  }

  return (
    <>
      <header className="header">
        <div className="header__inner">
          <h1 className="header__title" style={{ paddingLeft: 4 }}>Dollar kursi</h1>
          <span style={{ fontSize: 11, color: "var(--text-3)", paddingLeft: 4 }}>Markaziy kurs — barcha sotuv/to&apos;lov shu yerdan oladi</span>
        </div>
      </header>

      <div className="page-content" style={{ maxWidth: 620 }}>
        {loading && <div className="spinner--page" />}
        {!loading && (
          <>
            {/* Joriy kurs karta */}
            <div style={{ background: "linear-gradient(135deg,#1a2744,#2d3a5c)", color: "#fff", borderRadius: "var(--radius-xl)", padding: isMobile ? 20 : 26, marginBottom: 18, boxShadow: "var(--shadow-sm)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", color: "rgba(255,255,255,.6)", textTransform: "uppercase" }}>Joriy kurs (1 $)</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: isMobile ? 36 : 44, fontWeight: 900, lineHeight: 1 }}>{current ? fmt(n(current.Kurs)) : "—"}</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#f5c842" }}>so&apos;m</span>
                {diff !== 0 && (
                  <span style={{ fontSize: 13, fontWeight: 800, color: diff > 0 ? "#fca5a5" : "#86efac" }}>
                    {diff > 0 ? "▲" : "▼"} {fmt(Math.abs(diff))}
                  </span>
                )}
              </div>
              {current && <div style={{ fontSize: 12, color: "rgba(255,255,255,.55)", marginTop: 8 }}>So&apos;nggi yangilanish: {current.Sana_1}</div>}
            </div>

            {/* Yangi kurs kiritish */}
            <div style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", padding: isMobile ? 16 : 20, marginBottom: 18 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: "var(--text-2)", display: "block", marginBottom: 8 }}>Yangi kurs kiritish</label>
              <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
                <input value={val} onChange={e => setVal(e.target.value)} placeholder="masalan: 12 800" inputMode="numeric"
                  onKeyDown={e => { if (e.key === "Enter") save(); }}
                  style={{ flex: 1, minWidth: 0, padding: "12px 14px", border: `1.5px solid ${tooLow ? "#ef4444" : "var(--border)"}`, borderRadius: 12, fontSize: 18, fontWeight: 800, outline: "none", textAlign: "center", letterSpacing: ".02em" }} />
                <button className="btn btn--primary" onClick={save} disabled={saving || newVal <= 0} style={{ flexShrink: 0, padding: "0 22px", fontSize: 15 }}>
                  {saving ? <span className="spinner" /> : "Saqlash"}
                </button>
              </div>
              {tooLow && <p style={{ fontSize: 12, color: "#ef4444", fontWeight: 600, marginTop: 8 }}>Diqqat: kurs 11 000 dan past.</p>}
              <p style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 10 }}>
                Saqlangach barcha viewlarda (sotuv, pul ayirish va h.k.) dollar kursi avtomatik shu qiymatdan olinadi.
              </p>
            </div>

            {/* Tarix */}
            <div style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
              <p className="count-label" style={{ padding: "12px 16px 0" }}>Tarix ({history.length})</p>
              {history.length === 0 ? (
                <div className="empty" style={{ padding: 24 }}><p className="empty__title">Kurs tarixi yo&apos;q</p></div>
              ) : history.map((k, i) => {
                const p = history[i + 1];
                const d = p ? n(k.Kurs) - n(p.Kurs) : 0;
                return (
                  <div key={k.Kurs_ID || i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 13, color: "var(--text-3)", fontWeight: 600 }}>{k.Sana_1}{i === 0 && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 800, color: "#15803d", background: "#dcfce7", padding: "2px 7px", borderRadius: 20 }}>JORIY</span>}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {d !== 0 && <span style={{ fontSize: 11.5, fontWeight: 700, color: d > 0 ? "#ef4444" : "#16a34a" }}>{d > 0 ? "▲" : "▼"}{fmt(Math.abs(d))}</span>}
                      <span style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>{fmt(n(k.Kurs))} <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>so&apos;m</span></span>
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}
