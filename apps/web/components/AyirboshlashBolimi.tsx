"use client";
// So'm ⇄ $ ayirboshlash bo'limi — to'lovlar jadvalidagi ikki "Ayirboshlash" qatori (kassasiz):
//   so'm → $: so'm oyog'i +A (so'm qarzi kamayadi), $ oyog'i −A/kurs ($ qarzi ortadi); $ → so'm teskarisi.
// Firma sahifasida ishlatiladi (X_Tolov). Qarz formulalari Valyuta bo'yicha yig'gani uchun
// ikki oyoq qarzni avtomat to'g'ri o'zgartiradi; kassaga (Gazna_ID bo'sh) ta'sir qilmaydi.
import { useEffect, useMemo, useState } from "react";
import { afterWrite } from "@/lib/sheet-cache";
import { getCurrentKurs } from "@/lib/kurs";
import { useScrollLock } from "@/lib/use-scroll-lock";
import { AYIRBOSHLASH, ayirboshlashmi, ayirboshlashGuruhi, dollarmi } from "@/lib/mijoz-ledger";

type Qator = Record<string, string>;
export interface AbGuruh { id: string; sana: string; vaqt: string; kurs: number; som: number; usd: number; izoh: string; legIds: string[]; }

function num(v: unknown) { return parseFloat(String(v ?? "0").replace(/\s/g, "").replace(",", ".")) || 0; }
function tr(v: unknown) { return String(v ?? "").trim(); }
function fmtSom(v: number) { return Math.round(v).toLocaleString("ru-RU") + " so'm"; }
function fmtUsd(v: number) { return "$" + v.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function uid() { return Math.random().toString(36).slice(2, 10); }
function toshkent() {
  const q = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const o = (t: string) => q.find(x => x.type === t)?.value || "00";
  return { iso: `${o("year")}-${o("month")}-${o("day")}`, sana: `${o("day")}.${o("month")}.${o("year")}`, vaqt: `${o("hour")}:${o("minute")}:${o("second")}` };
}
function sanaKey(sana: string) { const [d, m, y] = tr(sana).split("."); return `${y || "0000"}${(m || "00").padStart(2, "0")}${(d || "00").padStart(2, "0")}`; }

/** Ayirboshlash qatorlarini guruhlarga yig'adi (som/usd "to'lov" ishorasida: som > 0 — so'm qarzi kamaydi) */
export function abGuruhlari(rows: Qator[], idField: string): AbGuruh[] {
  const m: Record<string, AbGuruh> = {};
  rows.filter(r => ayirboshlashmi(r)).forEach(r => {
    const g = ayirboshlashGuruhi(r[idField]) || tr(r[idField]);
    const e = m[g] || (m[g] = { id: g, sana: tr(r.Sana), vaqt: tr(r.Vaqt), kurs: num(r.Dollar_Kursi), som: 0, usd: 0, izoh: "", legIds: [] });
    if (dollarmi(r.Valyuta)) e.usd += num(r.Summa_dollar); else e.som += num(r.Summa);
    if (tr(r[idField])) e.legIds.push(tr(r[idField]));
    if (!e.izoh && tr(r.Izoh)) e.izoh = tr(r.Izoh);
    if (!e.kurs) e.kurs = num(r.Dollar_Kursi);
  });
  return Object.values(m).sort((a, b) => (sanaKey(b.sana) + b.vaqt).localeCompare(sanaKey(a.sana) + a.vaqt));
}
export function abMatni(g: AbGuruh | undefined, arrow = "→"): string {
  if (!g) return "Ayirboshlash";
  const somT = Math.abs(g.som).toLocaleString("ru-RU") + " so'm", usdT = fmtUsd(Math.abs(g.usd));
  const kursT = g.kurs ? ` (kurs ${g.kurs.toLocaleString("ru-RU")})` : "";
  return g.som > 0 || g.usd < 0 ? `Ayirboshlash: ${somT} ${arrow} ${usdT}${kursT}` : `Ayirboshlash: ${usdT} ${arrow} ${somT}${kursT}`;
}

const SWAP = (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>);
const TRASH = (<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>);
const RANG = "#7c3aed";

export default function AyirboshlashBolimi(p: {
  sheet: string;                 // "X_Tolov"
  idField: string;               // "X_Tolov_ID"
  ownerField: string;            // "Taminotchi_ID"
  ownerId: string;
  ownerNomi: string;
  rows: Qator[];                 // shu egasining barcha to'lov qatorlari (ayirboshlash oyoqlari ham)
  qarzSom: number;               // joriy qarz (ayirboshlash hisobga olingan)
  qarzDollar: number;
  isMobile: boolean;
  qoshimcha?: Qator;             // jadvalga xos qo'shimcha bo'sh ustunlar (masalan Xarid_ID)
  telegramSarlavha?: string;     // berilsa — asosiy guruhga xabar
  onChanged: () => void;
}) {
  const guruhlar = useMemo(() => abGuruhlari(p.rows, p.idField), [p.rows, p.idField]);
  const [ochiq, setOchiq] = useState(false);
  const [yon, setYon] = useState<"som2usd" | "usd2som">("som2usd");
  const [summa, setSumma] = useState("");
  const [kurs, setKurs] = useState("");
  const [sana, setSana] = useState("");
  const [izoh, setIzoh] = useState("");
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);
  const [ochirish, setOchirish] = useState<AbGuruh | null>(null);
  const [ochirilmoqda, setOchirilmoqda] = useState(false);
  const [joriyKurs, setJoriyKurs] = useState("");
  useScrollLock(ochiq || !!ochirish);
  useEffect(() => { getCurrentKurs().then(setJoriyKurs).catch(() => {}); }, []);

  function och() {
    setYon(p.qarzSom <= 0 && p.qarzDollar > 0 ? "usd2som" : "som2usd");
    setSumma(""); setIzoh(""); setSana(toshkent().iso);
    setKurs(joriyKurs || (typeof localStorage !== "undefined" ? localStorage.getItem("dollar_kurs") || "" : ""));
    setOchiq(true);
  }
  const h = (() => {
    const a = num(summa), k = num(kurs), som2usd = yon === "som2usd";
    const somAmt = som2usd ? Math.round(a) : (k > 0 ? Math.round(a * k) : 0);
    const usdAmt = som2usd ? (k > 0 ? Math.round(a / k * 100) / 100 : 0) : Math.round(a * 100) / 100;
    return { som2usd, k, somAmt, usdAmt, somLeg: som2usd ? somAmt : -somAmt, usdLeg: som2usd ? -usdAmt : usdAmt };
  })();
  const kursXato = num(kurs) < 11000;
  const tayyor = !saqlanmoqda && !kursXato && h.somAmt > 0 && h.usdAmt > 0 && !!sana;

  async function saqla() {
    if (!tayyor) return;
    setSaqlanmoqda(true);
    const t = toshkent();
    const [y, m, d] = sana.split("-");
    const g = uid();
    const umumiy: Qator = {
      ...(p.qoshimcha || {}),
      [p.ownerField]: p.ownerId, Yil: y, Oy: String(parseInt(m, 10)), Sana: `${d}.${m}.${y}`, Vaqt: t.vaqt,
      Turi: AYIRBOSHLASH, Dollar_Kursi: String(h.k), Izoh: izoh.trim(), Check: "True", Gazna_ID: "", Gazna_dollar_ID: "",
    };
    try {
      const res = await fetch("/api/sheets", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet: p.sheet, rows: [
          { ...umumiy, [p.idField]: `ab-${g}-s`, Valyuta: "So'm", Som: String(h.somLeg), Summa: String(h.somLeg), Dollar: "", Summa_dollar: "" },
          { ...umumiy, [p.idField]: `ab-${g}-d`, Valyuta: "Dollar", Som: "", Summa: "", Dollar: String(h.usdLeg), Summa_dollar: String(h.usdLeg) },
        ] }) });
      if (!res.ok) throw new Error("Server bilan bog'lanishda xatolik");
      if (typeof localStorage !== "undefined") localStorage.setItem("dollar_kurs", String(h.k));
      if (p.telegramSarlavha) {
        const yS = p.qarzSom - h.somLeg, yU = p.qarzDollar - h.usdLeg;
        const nS = (v: number) => String(Math.round(v)), nU = (v: number) => String(Math.round(v * 100) / 100);
        const matn = [
          `${p.telegramSarlavha} (${h.som2usd ? "so'm → $" : "$ → so'm"})`, "",
          `📅 Sana: ${d}.${m}.${y} · 🕒 ${t.vaqt.slice(0, 5)}`,
          `👤 ${p.ownerNomi || "—"}`,
          `📅 Ostatka(So'm): ${nS(p.qarzSom)}`, `📅 Ostatka(Dollar): ${nU(p.qarzDollar)}`,
          `🔁 So'm: ${h.somLeg > 0 ? "-" : "+"}${nS(h.somAmt)}`, `🔁 Dollar: ${h.usdLeg > 0 ? "-" : "+"}${nU(h.usdAmt)}`,
          `💱 Kurs: ${nS(h.k)}`,
          `💵 Qoldiq (so'm): ${nS(yS)}`, `💵 Qoldiq ($): ${nU(yU)}`,
          `📌 Izoh: ${izoh.trim() || "null"}`,
        ].join("\n");
        fetch("/api/telegram", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: matn }) }).catch(() => {});
      }
      afterWrite(p.sheet);
      setOchiq(false);
      setTimeout(p.onChanged, 600);
    } catch (e) {
      alert("Ayirboshlash saqlanmadi: " + (e instanceof Error ? e.message : "noma'lum") + ".");
    } finally { setSaqlanmoqda(false); }
  }

  async function ochir() {
    if (!ochirish) return;
    setOchirilmoqda(true);
    let xato = false;
    for (const id of ochirish.legIds) {
      try {
        const r = await fetch("/api/sheets", { method: "DELETE", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sheet: p.sheet, idColumn: p.idField, idValue: id }) });
        if (!r.ok) xato = true;
      } catch { xato = true; }
    }
    afterWrite(p.sheet);
    setOchirilmoqda(false); setOchirish(null);
    if (xato) alert("Ayirboshlash to'liq o'chmadi — sahifa yangilanadi, qolgan qismini qayta o'chiring.");
    setTimeout(p.onChanged, 600);
  }

  const inp: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: "var(--radius)", fontSize: 14, fontWeight: 700, outline: "none", boxSizing: "border-box", border: "1.5px solid var(--border)" };
  const manba = h.som2usd ? p.qarzSom : p.qarzDollar;

  return (
    <>
      <div style={{ background: "var(--white)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", overflow: "hidden", marginBottom: p.isMobile ? 14 : 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: p.isMobile ? "12px 14px" : "14px 20px", borderBottom: guruhlar.length ? "1px solid var(--border)" : "none" }}>
          <span style={{ width: 36, height: 36, borderRadius: 10, background: "#f5f3ff", color: RANG, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{SWAP}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 700 }}>So&apos;m ⇄ $ ayirboshlash</p>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)" }}>
              {guruhlar.length ? `${guruhlar.length} ta amal` : "So'm qarzini $ qarziga (yoki aksincha) kurs bo'yicha o'tkazish"}
            </p>
          </div>
          <button onClick={och} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: "var(--radius)", border: "none", background: RANG, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Ayirboshlash
          </button>
        </div>
        {guruhlar.map((g, i) => {
          const s2u = g.som > 0 || g.usd < 0;
          const somT = fmtSom(Math.abs(g.som)), usdT = fmtUsd(Math.abs(g.usd));
          return (
            <div key={g.id} style={{ display: "flex", alignItems: "center", gap: p.isMobile ? 8 : 14, flexWrap: p.isMobile ? "wrap" : "nowrap", padding: p.isMobile ? "10px 14px" : "10px 20px", borderBottom: i < guruhlar.length - 1 ? "1px solid var(--border)" : "none" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 84 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{g.sana || "—"}</span>
                {g.vaqt && <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)" }}>{g.vaqt.split(":").slice(0, 2).join(":")}</span>}
              </div>
              <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 10, background: "#f5f3ff", color: RANG, whiteSpace: "nowrap" }}>{s2u ? "So'm → $" : "$ → So'm"}</span>
              <span style={{ flex: 1, minWidth: p.isMobile ? "100%" : 0, order: p.isMobile ? 5 : 0, fontSize: 14, fontWeight: 800 }}>
                {s2u ? <>{somT} <span style={{ color: "var(--text-3)" }}>→</span> <span style={{ color: "#2563eb" }}>{usdT}</span></>
                     : <><span style={{ color: "#2563eb" }}>{usdT}</span> <span style={{ color: "var(--text-3)" }}>→</span> {somT}</>}
                {g.izoh && <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-3)", marginTop: 2 }}>{g.izoh}</span>}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", whiteSpace: "nowrap", marginLeft: p.isMobile ? "auto" : 0 }}>kurs {g.kurs ? g.kurs.toLocaleString("ru-RU") : "—"}</span>
              <button onClick={() => setOchirish(g)} title="O'chirish" aria-label="O'chirish"
                style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #fecaca", background: "#fef2f2", color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{TRASH}</button>
            </div>
          );
        })}
      </div>

      {ochiq && (
        <div className="modal-overlay" onClick={() => { if (!saqlanmoqda) setOchiq(false); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal__head">
              <div style={{ minWidth: 0 }}>
                <h2 className="modal__title">So&apos;m ⇄ $ ayirboshlash</h2>
                <p style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 600 }}>{p.ownerNomi}</p>
              </div>
              <button className="modal__close" onClick={() => { if (!saqlanmoqda) setOchiq(false); }} aria-label="Yopish">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="modal__body">
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius)", flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".04em" }}>JORIY QARZ:</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: p.qarzSom > 0 ? "#ef4444" : "#16a34a" }}>{fmtSom(p.qarzSom)}</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: p.qarzDollar > 0 ? "#ef4444" : "#16a34a" }}>{fmtUsd(p.qarzDollar)}</span>
              </div>
              <div className="field">
                <label>Sana</label>
                <input type="date" value={sana} onChange={e => setSana(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 8 }}>Yo&apos;nalish</label>
                <div style={{ display: "flex", borderRadius: "var(--radius)", overflow: "hidden", border: "1.5px solid var(--border)" }}>
                  {([["som2usd", "So'm → $"], ["usd2som", "$ → So'm"]] as const).map(([v, l], i) => (
                    <button key={v} type="button" onClick={() => { setYon(v); setSumma(""); }}
                      style={{ flex: 1, padding: 10, fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", background: yon === v ? RANG : "var(--white)", color: yon === v ? "#fff" : "var(--text-3)", borderRight: i === 0 ? "1.5px solid var(--border)" : "none" }}>{l}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: p.isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: h.som2usd ? "var(--text-2)" : "#2563eb" }}>{h.som2usd ? "So'm qarzidan" : "$ qarzidan"}</label>
                    {manba > 0 && (
                      <button type="button" onClick={() => setSumma(h.som2usd ? String(Math.round(p.qarzSom)) : String(Math.round(p.qarzDollar * 100) / 100))}
                        style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 8, border: `1px solid ${RANG}`, background: "#f5f3ff", color: RANG, cursor: "pointer" }}>
                        Hammasi: {h.som2usd ? Math.round(p.qarzSom).toLocaleString("ru-RU") : fmtUsd(p.qarzDollar)}
                      </button>
                    )}
                  </div>
                  <input value={summa} inputMode={h.som2usd ? "numeric" : "decimal"} placeholder={h.som2usd ? "0" : "0.00"}
                    onChange={e => setSumma(h.som2usd ? e.target.value.replace(/\D/g, "") : e.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1"))}
                    style={{ ...inp, borderColor: h.som2usd ? "var(--primary)" : "#2563eb", color: h.som2usd ? "var(--text)" : "#2563eb" }}/>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: kursXato ? "#ef4444" : "var(--text-2)", display: "block", marginBottom: 6 }}>Kurs *</label>
                  <input value={kurs} inputMode="numeric" placeholder="Min: 11 000" onChange={e => setKurs(e.target.value.replace(/\D/g, ""))}
                    style={{ ...inp, fontWeight: 600, borderColor: kursXato ? "#ef4444" : "var(--border)" }}/>
                  {joriyKurs && num(kurs) !== num(joriyKurs) && (
                    <button type="button" onClick={() => setKurs(joriyKurs)} style={{ marginTop: 6, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--white)", color: "var(--text-2)", cursor: "pointer" }}>
                      Joriy kurs: {num(joriyKurs).toLocaleString("ru-RU")}
                    </button>
                  )}
                </div>
              </div>
              {h.somAmt > 0 && h.usdAmt > 0 && !kursXato && (
                <div style={{ padding: "12px 14px", background: "#f5f3ff", borderRadius: "var(--radius)", display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: RANG }}>
                    {h.som2usd ? `${h.somAmt.toLocaleString("ru-RU")} so'm → ${fmtUsd(h.usdAmt)}` : `${fmtUsd(h.usdAmt)} → ${h.somAmt.toLocaleString("ru-RU")} so'm`}
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-2)" }}>
                    Keyingi qarz: {fmtSom(p.qarzSom - h.somLeg)} · {fmtUsd(p.qarzDollar - h.usdLeg)}
                  </span>
                </div>
              )}
              <p style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-3)", lineHeight: 1.45 }}>
                Kassaga pul kirmaydi va chiqmaydi — faqat qarz bir valyutadan ikkinchisiga o&apos;tadi.
              </p>
              <div className="field">
                <label>Izoh</label>
                <input value={izoh} onChange={e => setIzoh(e.target.value)} placeholder="Izoh (ixtiyoriy)..." maxLength={255}/>
              </div>
            </div>
            <div className="modal__footer">
              <button className="btn btn--outline" style={{ flex: 1 }} onClick={() => setOchiq(false)} disabled={saqlanmoqda}>Bekor</button>
              <button className="btn btn--primary" style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, ...(tayyor ? { background: RANG, borderColor: RANG } : {}) }}
                onClick={saqla} disabled={!tayyor}>
                {saqlanmoqda && <span className="spinner"/>} Saqlash
              </button>
            </div>
          </div>
        </div>
      )}

      {ochirish && (
        <div className="modal-overlay" onClick={() => { if (!ochirilmoqda) setOchirish(null); }}>
          <div className="confirm" onClick={e => e.stopPropagation()}>
            <div className="confirm__icon"><span style={{ color: "#ef4444", display: "flex" }}>{TRASH}</span></div>
            <p className="confirm__title">Ayirboshlashni o&apos;chirish</p>
            <p className="confirm__text">{ochirish.sana} · {abMatni(ochirish)}. Ikkala yozuv o&apos;chiriladi — qarz oldingi holatiga qaytadi.</p>
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
