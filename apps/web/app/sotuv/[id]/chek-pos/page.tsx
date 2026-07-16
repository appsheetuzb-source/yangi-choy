"use client";
import { fetchSheet, fetchSheetWhere } from "@/lib/sheet-cache";
import { useEffect, useState, useRef, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

// 80mm termal chek — "Print Label" ilovasi uchun.
// "Chop etish" -> chek PDF qilinib ulashish oynasiga beriladi -> Print Label tanlanadi
// -> u yerda 58/80 kenglik tanlab termal printerga chop etiladi.
// Dizayn: toza jadval (Mahsulot nomi/Soni/Narxi/Summa/Jami) + qarzdorlik qutisi.

interface SotuvSavatRow { Savat_ID: string; Sotuv_ID: string; Mahsulot_ID: string; Soni: string; Som_Narx: string; Summa_som: string; }
interface SotuvSavatDollarRow { Savat_ID: string; Sotuv_ID: string; Mahsulot_ID: string; Soni: string; Narx: string; Summa: string; }
interface Mahsulot { Mahsulot_ID: string; Nomi: string; }

function num(v: string|number|undefined) { return parseFloat(String(v||"0").replace(/\s/g,"").replace(",",".")) || 0; }
function fmtSom(v: number) { return v.toLocaleString("ru-RU"); }
function fmtUsd(v: number) { return "$" + v.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtSoni(v: number) { return v.toLocaleString("ru-RU",{minimumFractionDigits:1,maximumFractionDigits:2}); }

function PosContent() {
  const { id } = useParams<{id:string}>();
  const router = useRouter();
  const sp = useSearchParams();

  const sana        = sp.get("sana")||"";
  const agentNomi   = sp.get("agent")||"";
  const mijozIsm    = sp.get("mijozIsm")||"";
  const mijozTel    = sp.get("mijozTel")||"";
  const totalSom    = num(sp.get("totalSom")||"0");
  const totalDollar = num(sp.get("totalDollar")||"0");
  const tolovSom    = num(sp.get("tolovSom")||"0");
  const tolovDollar = num(sp.get("tolovDollar")||"0");

  const [savatSom, setSavatSom]       = useState<SotuvSavatRow[]>([]);
  const [savatDollar, setSavatDollar] = useState<SotuvSavatDollarRow[]>([]);
  const [mMap, setMMap]               = useState<Record<string,Mahsulot>>({});
  const [rowsReady, setRowsReady]     = useState(false);
  const [busy, setBusy]               = useState(false);
  const chekRef = useRef<HTMLDivElement>(null);

  useEffect(()=>{
    if(!id) return;
    try {
      const c = sessionStorage.getItem(`chek_${id}`);
      if(c) {
        const d = JSON.parse(c);
        setSavatSom((d.savatSom as SotuvSavatRow[]).filter(r=>r.Sotuv_ID===id));
        setSavatDollar((d.savatDollar as SotuvSavatDollarRow[]).filter(r=>r.Sotuv_ID===id));
        setMMap(d.mMap);
        setRowsReady(true);
        return;
      }
    } catch {}
    Promise.all([
      fetchSheetWhere("Sotuv_Savat", "Sotuv_ID", id),
      fetchSheetWhere("Sotuv_savat_dollar", "Sotuv_ID", id),
      fetchSheet("Mahsulot"),
    ]).then(([ssR,sdR,mhR])=>{
      setSavatSom(ssR.data as SotuvSavatRow[]);
      setSavatDollar(sdR.data as SotuvSavatDollarRow[]);
      const mm:Record<string,Mahsulot>={};
      (mhR.data as Mahsulot[]).forEach(m=>{mm[m.Mahsulot_ID]=m;});
      setMMap(mm);
    }).finally(()=>setRowsReady(true));
  }, [id]);

  const thisSom    = savatSom.reduce((s,r)=>s+num(r.Summa_som),0);
  const thisDollar = savatDollar.reduce((s,r)=>s+num(r.Summa),0);
  const hasSom    = savatSom.length > 0;
  const hasDollar = savatDollar.length > 0;
  const showSom    = hasSom    || totalSom !== 0    || tolovSom !== 0;
  const showDollar = hasDollar || totalDollar !== 0 || tolovDollar !== 0;
  const yangiSom = totalSom + thisSom - tolovSom;
  const yangiUsd = totalDollar + thisDollar - tolovDollar;

  // Chekni PDF qilib "Print Label"ga (yoki boshqa ilovaga) beradi.
  async function printPdf() {
    if (!rowsReady || !chekRef.current) return;
    setBusy(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const jsPDF = (await import("jspdf")).default;
      const canvas = await html2canvas(chekRef.current, { scale: 3, backgroundColor: "#ffffff", useCORS: true });
      const wmm = 80;                                   // 80mm rulon eni
      const hmm = Math.max(40, (wmm * canvas.height) / canvas.width);
      const doc = new jsPDF({ unit: "mm", format: [wmm, hmm] });
      doc.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, wmm, hmm);
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      const isMob = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
      // Print Label "ulashish" (share) orqali chiqmaydi — faqat "ochish" (open with).
      // Shuning uchun PDF ni YUKLAB olamiz: Chrome pastida "Ochish" chiqadi ->
      // uni "Print Label" bilan oching (58/80 tanlab chop etasiz).
      const a = document.createElement("a");
      a.href = url; a.download = `chek-${id}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      if (!isMob) { window.open(url, "_blank"); }   // kompyuterda ko'rish uchun ochib ham beramiz
      setTimeout(() => URL.revokeObjectURL(url), 120_000);
    } catch {
      window.print();
    } finally { setBusy(false); }
  }

  // Detaildagi "80mm" tugmasidan kelinganda (?auto=1) — chek tayyor bo'lishi bilan
  // avtomatik PDF chiqarib beramiz (foydalanuvchi qo'shimcha tugma bosmasin).
  const autoFired = useRef(false);
  useEffect(() => {
    if (sp.get("auto") === "1" && rowsReady && !autoFired.current) {
      autoFired.current = true;
      const t = setTimeout(() => { printPdf(); }, 350);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsReady]);

  const cellHead: React.CSSProperties = { border: "1px solid #000", padding: "3px 4px", fontSize: 12, fontWeight: 800, fontStyle: "italic", textAlign: "center" };
  const cell: React.CSSProperties     = { border: "1px solid #000", padding: "3px 4px", fontSize: 12, fontWeight: 700 };
  const boxRow: React.CSSProperties    = { border: "1px solid #000", borderTop: "none", padding: "3px 6px", fontSize: 12.5, fontWeight: 700 };

  return (
    <div style={{ minHeight: "100vh", background: "#e9edf5", padding: 12, display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* "Downloading PDF" oynasi — PDF tayyorlanayotganda */}
      {busy && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "56px 20px" }}>
          <div style={{ background: "#fff", borderRadius: 10, width: "100%", maxWidth: 380, overflow: "hidden", boxShadow: "0 10px 40px rgba(0,0,0,.3)" }}>
            <div style={{ background: "#1e3a5f", color: "#fff", padding: "14px 18px", fontSize: 17, fontWeight: 800 }}>PDF tayyorlanmoqda</div>
            <div style={{ padding: "16px 18px" }}>
              <p style={{ fontSize: 14, color: "#334155", marginBottom: 14, lineHeight: 1.5 }}>PDF yuklangач uni ochish uchun ilova so&apos;raladi — <b>Print Label</b> ni tanlang.</p>
              <div style={{ height: 10, borderRadius: 5, background: "#e5e7eb", overflow: "hidden" }}>
                <div style={{ height: "100%", width: "100%", background: "#16a34a" }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Boshqaruv (chekka kirmaydi) */}
      <div style={{ display: "flex", gap: 8, width: "100%", maxWidth: 360, marginBottom: 12 }}>
        <button onClick={()=>router.back()} style={{ flex: "0 0 auto", padding: "12px 16px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", color: "#334155", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>←</button>
        <button onClick={printPdf} disabled={!rowsReady || busy}
          style={{ flex: 1, padding: "12px 10px", borderRadius: 10, border: "none", background: (!rowsReady||busy) ? "#9ca3af" : "#16a34a", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
          <svg width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M17 17H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2zm-1-12v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2m-3 5h12"/></svg>
          {busy ? "Tayyorlanmoqda..." : rowsReady ? "Chop etish (PDF)" : "Yuklanmoqda..."}
        </button>
      </div>

      {/* CHEK — Print Label uchun PDF shu yerdan olinadi */}
      <div ref={chekRef} style={{ width: 360, background: "#fff", color: "#000", padding: "12px 14px 14px", fontFamily: "Arial, sans-serif" }}>
        {/* Sarlavha */}
        <div style={{ textAlign: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 21, fontWeight: 900, letterSpacing: 1 }}>MUSAFFO TEA</div>
          <div style={{ fontSize: 11, fontWeight: 700 }}>Sotuv cheki</div>
        </div>
        {/* Info */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 700, marginBottom: 2 }}>
          <span>Sana: <b>{sana||"—"}</b></span>
          <span>Mijoz: <b>{mijozIsm||"—"}</b></span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, marginBottom: 8, borderBottom: "1px solid #000", paddingBottom: 6 }}>
          <span>{agentNomi||""}</span>
          <span>{mijozTel||""}</span>
        </div>

        {!rowsReady ? (
          <div style={{ textAlign: "center", fontSize: 13, padding: "8px 0" }}>Yuklanmoqda...</div>
        ) : (
          <>
            {/* So'm jadval */}
            {hasSom && (
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8 }}>
                <thead>
                  <tr>
                    <th style={{ ...cellHead, textAlign: "left" }}>Mahsulot nomi</th>
                    <th style={{ ...cellHead, width: 40 }}>Soni</th>
                    <th style={{ ...cellHead, width: 64 }}>Narxi</th>
                    <th style={{ ...cellHead, width: 72 }}>Summa</th>
                  </tr>
                </thead>
                <tbody>
                  {savatSom.map((r,i)=>(
                    <tr key={r.Savat_ID||i}>
                      <td style={{ ...cell, textAlign: "left" }}>{mMap[r.Mahsulot_ID]?.Nomi||r.Mahsulot_ID}</td>
                      <td style={{ ...cell, textAlign: "center" }}>{fmtSoni(num(r.Soni))}</td>
                      <td style={{ ...cell, textAlign: "right" }}>{fmtSom(num(r.Som_Narx))}</td>
                      <td style={{ ...cell, textAlign: "right" }}>{fmtSom(num(r.Summa_som))}</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ ...cell, textAlign: "right", fontWeight: 800 }} colSpan={3}>Jami:</td>
                    <td style={{ ...cell, textAlign: "right", fontWeight: 900 }}>{fmtSom(thisSom)}</td>
                  </tr>
                </tbody>
              </table>
            )}
            {/* So'm qarzdorlik qutisi */}
            {showSom && (
              <div style={{ marginBottom: hasDollar||showDollar ? 10 : 0 }}>
                <div style={{ ...boxRow, borderTop: "1px solid #000" }}>Eski qarzdorlik: {fmtSom(totalSom)}</div>
                <div style={boxRow}>To&apos;lovlar: {fmtSom(tolovSom)}</div>
                <div style={{ ...boxRow, fontWeight: 900 }}>Yangi qarzdorlik: {fmtSom(yangiSom)}</div>
              </div>
            )}

            {/* Dollar jadval */}
            {hasDollar && (
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8 }}>
                <thead>
                  <tr>
                    <th style={{ ...cellHead, textAlign: "left" }}>Mahsulot ($)</th>
                    <th style={{ ...cellHead, width: 40 }}>Soni</th>
                    <th style={{ ...cellHead, width: 64 }}>Narxi</th>
                    <th style={{ ...cellHead, width: 72 }}>Summa</th>
                  </tr>
                </thead>
                <tbody>
                  {savatDollar.map((r,i)=>(
                    <tr key={r.Savat_ID||i}>
                      <td style={{ ...cell, textAlign: "left" }}>{mMap[r.Mahsulot_ID]?.Nomi||r.Mahsulot_ID}</td>
                      <td style={{ ...cell, textAlign: "center" }}>{fmtSoni(num(r.Soni))}</td>
                      <td style={{ ...cell, textAlign: "right" }}>{fmtUsd(num(r.Narx))}</td>
                      <td style={{ ...cell, textAlign: "right" }}>{fmtUsd(num(r.Summa))}</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ ...cell, textAlign: "right", fontWeight: 800 }} colSpan={3}>Jami:</td>
                    <td style={{ ...cell, textAlign: "right", fontWeight: 900 }}>{fmtUsd(thisDollar)}</td>
                  </tr>
                </tbody>
              </table>
            )}
            {/* Dollar qarzdorlik qutisi */}
            {showDollar && (
              <div>
                <div style={{ ...boxRow, borderTop: "1px solid #000" }}>Eski qarzdorlik ($): {fmtUsd(totalDollar)}</div>
                <div style={boxRow}>To&apos;lovlar ($): {fmtUsd(tolovDollar)}</div>
                <div style={{ ...boxRow, fontWeight: 900 }}>Yangi qarzdorlik ($): {fmtUsd(yangiUsd)}</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function SotuvChekPosPage() {
  return (
    <Suspense fallback={<div style={{padding:40,textAlign:"center",fontFamily:"Arial"}}>Yuklanmoqda...</div>}>
      <PosContent />
    </Suspense>
  );
}
