"use client";

import { fetchSheet, afterWrite } from "@/lib/sheet-cache";
import { useScrollLock } from "@/lib/use-scroll-lock";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";

interface Xarajat {
  Xarajat_ID: string; Yil: string; Oy: string; Sana: string;
  Kategoriya: string; Agent: string; Nomi: string; Soni: string;
  Som: string; Dollar_kursi: string; Dollar: string; Summa: string;
  Turi: string; Gazna_ID: string; Gazna_dollar_ID: string;
  Izoh: string; Qoshdi: string; Qoshilgan_Vaqt: string;
}
interface Gazna { Gazna_ID: string; Nomi: string; Turi: string; }
interface Foydalanuvchi { Foydalanuvchi_ID: string; Nomi: string; }

function num(v: string|number|undefined) {
  return parseFloat(String(v||"0").replace(/\s/g,"").replace(",",".")) || 0;
}
function fmtSom(v: number) { return v ? v.toLocaleString("ru-RU") + " so'm" : "—"; }
function fmtUsd(v: number) { return v ? "$" + v.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"; }

export default function XarajatDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [xarajat, setXarajat]   = useState<Xarajat | null>(null);
  const [gaznalar, setGaznalar] = useState<Gazna[]>([]);
  const [agentMap, setAgentMap] = useState<Record<string, string>>({});
  const [loading, setLoading]   = useState(true);
  const [delOpen, setDelOpen]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  useScrollLock(delOpen);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([fetchSheet("Xarajat"), fetchSheet("Gazna"), fetchSheet("Foydalanuvchi")])
      .then(([xR, gR, fR]) => {
        setXarajat(((xR.data as Xarajat[]) || []).find(x => x.Xarajat_ID === id) || null);
        setGaznalar((gR.data as Gazna[]) || []);
        const am: Record<string, string> = {};
        ((fR.data as Foydalanuvchi[]) || []).forEach(f => { am[f.Foydalanuvchi_ID] = f.Nomi; });
        setAgentMap(am);
      }).finally(() => setLoading(false));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function handleDelete() {
    if (!xarajat) return;
    setDeleting(true);
    try {
      await fetch("/api/sheets", { method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet: "Xarajat", idColumn: "Xarajat_ID", idValue: xarajat.Xarajat_ID }) });
      afterWrite("Xarajat");
      router.push("/xarajat");
    } finally { setDeleting(false); }
  }

  if (loading) return <div className="page-content" style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}><div className="spinner--page" /></div>;
  if (!xarajat) return (
    <div className="page-content"><div className="empty">
      <div className="empty__icon">💸</div>
      <p className="empty__title">Xarajat topilmadi</p>
      <button className="btn btn--outline" onClick={() => router.push("/xarajat")}>← Orqaga</button>
    </div></div>
  );

  const som = num(xarajat.Som), dollar = num(xarajat.Dollar);
  const gaznaNomi = (gid: string) => gaznalar.find(g => g.Gazna_ID === gid)?.Nomi || "—";
  const isDollar = dollar > 0;

  const rows: { label: string; value: string }[] = [
    { label: "Kategoriya", value: xarajat.Kategoriya || "—" },
    { label: "Nomi", value: xarajat.Nomi || "—" },
    { label: "Soni", value: xarajat.Soni || "—" },
    { label: "Agent", value: agentMap[xarajat.Agent] || "—" },
    { label: "Turi", value: xarajat.Turi || "—" },
    ...(som ? [
      { label: "So'm", value: fmtSom(som) },
      { label: "Hisob (so'm)", value: gaznaNomi(xarajat.Gazna_ID) },
    ] : []),
    ...(dollar ? [
      { label: "Dollar", value: fmtUsd(dollar) },
      { label: "Dollar kursi", value: xarajat.Dollar_kursi || "—" },
      { label: "Hisob (dollar)", value: gaznaNomi(xarajat.Gazna_dollar_ID) },
    ] : []),
    { label: "Izoh", value: xarajat.Izoh || "—" },
    { label: "Qo'shdi", value: xarajat.Qoshdi || "—" },
    { label: "Qo'shilgan vaqt", value: xarajat.Qoshilgan_Vaqt || "—" },
  ];

  return (
    <>
      <header className="header" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="header__inner" style={{ gap: 12 }}>
          <button onClick={() => router.push("/xarajat")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--white)", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text-2)", flexShrink: 0 }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg> Orqaga
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 className="header__title">Xarajat</h1>
            <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{xarajat.Sana || "—"}</p>
          </div>
          <button onClick={() => setDelOpen(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", border: "1px solid #fecaca", borderRadius: "var(--radius)", background: "var(--white)", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--red)", flexShrink: 0 }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg> O&apos;chirish
          </button>
        </div>
      </header>

      <div className="page-content" style={{ maxWidth: 760 }}>
        {/* Summary */}
        <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", padding: "20px 24px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 20, background: "var(--red-bg)", color: "var(--red)" }}>{xarajat.Kategoriya || "—"}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)" }}>{xarajat.Turi || "—"}</span>
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{xarajat.Nomi || "—"}</p>
          <p style={{ fontSize: 26, fontWeight: 800, color: isDollar ? "#2563eb" : "var(--red)" }}>
            {isDollar ? fmtUsd(dollar) : fmtSom(som)}
          </p>
          {som > 0 && dollar > 0 && <p style={{ fontSize: 15, fontWeight: 700, color: "var(--red)", marginTop: 2 }}>{fmtSom(som)}</p>}
        </div>

        {/* Details */}
        <div style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
          {rows.map((r, i) => (
            <div key={r.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "13px 20px", borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : "none" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-3)", flexShrink: 0 }}>{r.label}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", textAlign: "right", wordBreak: "break-word" }}>{r.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Delete confirm */}
      {delOpen && (
        <div className="modal-overlay" onClick={() => setDelOpen(false)}>
          <div className="confirm" onClick={e => e.stopPropagation()}>
            <div className="confirm__icon">
              <svg width="22" height="22" fill="none" stroke="var(--red)" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </div>
            <p className="confirm__title">Xarajatni o&apos;chirish</p>
            <p className="confirm__text"><strong>{xarajat.Kategoriya}</strong> — {isDollar ? fmtUsd(dollar) : fmtSom(som)}</p>
            <div className="confirm__actions">
              <button className="btn btn--outline" style={{ flex: 1 }} onClick={() => setDelOpen(false)} disabled={deleting}>Bekor</button>
              <button className="btn btn--red" style={{ flex: 1 }} onClick={handleDelete} disabled={deleting}>{deleting ? "O'chirilmoqda..." : "O'chirish"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
