"use client";
import { fetchSheet, fetchSheetWhere } from "@/lib/sheet-cache";
import { useEffect, useState, useRef, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

// 80mm termal chek. "Chek" tugmasi kabi window.print() ishlatadi (Print Label
// print xizmati orqali chiqadi) — faqat @page 80mm (termal rulon eni).

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

  // Chekni MATNLI (vektor) PDF qilib yuklab beradi — Print Label to'g'ri ko'rsatadi
  // (rasm-PDF bo'sh chiqardi). Yuklab olgach "Print Label" bilan oching.
  async function downloadPdf() {
    if (!rowsReady) return;
    setBusy(true);
    try {
      const jsPDF = (await import("jspdf")).default;
      const autoTable = (await import("jspdf-autotable")).default;
      const W = 80;
      // Balandlikni taxminlash — kontent bitta betga sig'sin (Print Label 1/1)
      let h = 16;
      h += 4; if (agentNomi) h += 4; if (mijozTel) h += 4; h += 2;
      if (hasSom)     h += 7 + savatSom.length * 6 + 7;
      if (showSom)    h += 6 * 3 + 4;
      if (hasDollar)  h += 7 + savatDollar.length * 6 + 7;
      if (showDollar) h += 6 * 3 + 4;
      h += 8;
      const doc = new jsPDF({ unit: "mm", format: [W, Math.max(55, Math.ceil(h))] });
      const fY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

      doc.setFont("helvetica", "bold"); doc.setFontSize(13);
      doc.text("MUSAFFO TEA", W / 2, 7, { align: "center" });
      doc.setFont("helvetica", "normal"); doc.setFontSize(8);
      doc.text("Sotuv cheki", W / 2, 11, { align: "center" });

      let y = 16;
      doc.setFont("helvetica", "bold"); doc.setFontSize(8);
      doc.text(`Sana: ${sana || "—"}`, 3, y);
      if (mijozIsm) doc.text(`Mijoz: ${mijozIsm}`, W - 3, y, { align: "right" });
      y += 4;
      if (agentNomi) { doc.text(agentNomi, 3, y); y += 4; }
      if (mijozTel)  { doc.text(`Tel: ${mijozTel}`, 3, y); y += 4; }
      y += 1;

      if (hasSom) {
        autoTable(doc, {
          startY: y, theme: "grid", margin: { left: 2, right: 2 },
          head: [["Mahsulot nomi", "Soni", "Narxi", "Summa"]],
          body: savatSom.map(r => [mMap[r.Mahsulot_ID]?.Nomi || r.Mahsulot_ID, fmtSoni(num(r.Soni)), fmtSom(num(r.Som_Narx)), fmtSom(num(r.Summa_som))]),
          foot: [[{ content: "Jami:", colSpan: 3, styles: { halign: "right" } }, fmtSom(thisSom)]],
          styles: { font: "helvetica", fontStyle: "bold", fontSize: 7, cellPadding: 1, lineColor: [0,0,0], lineWidth: 0.2, textColor: [0,0,0] },
          headStyles: { fontStyle: "bolditalic", fillColor: [255,255,255], textColor: [0,0,0], halign: "center" },
          footStyles: { fillColor: [255,255,255], textColor: [0,0,0], fontStyle: "bold" },
          columnStyles: { 0: { halign: "left" }, 1: { halign: "center", cellWidth: 10 }, 2: { halign: "right", cellWidth: 16 }, 3: { halign: "right", cellWidth: 18 } },
        });
        y = fY() + 1;
      }
      if (showSom) {
        autoTable(doc, {
          startY: y, theme: "grid", margin: { left: 2, right: 2 },
          body: [[`Eski qarzdorlik: ${fmtSom(totalSom)}`], [`To'lovlar: ${fmtSom(tolovSom)}`], [`Yangi qarzdorlik: ${fmtSom(yangiSom)}`]],
          styles: { font: "helvetica", fontStyle: "bold", fontSize: 8, cellPadding: 1.2, lineColor: [0,0,0], lineWidth: 0.2, textColor: [0,0,0], halign: "left" },
        });
        y = fY() + 2;
      }
      if (hasDollar) {
        autoTable(doc, {
          startY: y, theme: "grid", margin: { left: 2, right: 2 },
          head: [["Mahsulot ($)", "Soni", "Narxi", "Summa"]],
          body: savatDollar.map(r => [mMap[r.Mahsulot_ID]?.Nomi || r.Mahsulot_ID, fmtSoni(num(r.Soni)), fmtUsd(num(r.Narx)), fmtUsd(num(r.Summa))]),
          foot: [[{ content: "Jami:", colSpan: 3, styles: { halign: "right" } }, fmtUsd(thisDollar)]],
          styles: { font: "helvetica", fontStyle: "bold", fontSize: 7, cellPadding: 1, lineColor: [0,0,0], lineWidth: 0.2, textColor: [0,0,0] },
          headStyles: { fontStyle: "bolditalic", fillColor: [255,255,255], textColor: [0,0,0], halign: "center" },
          footStyles: { fillColor: [255,255,255], textColor: [0,0,0], fontStyle: "bold" },
          columnStyles: { 0: { halign: "left" }, 1: { halign: "center", cellWidth: 10 }, 2: { halign: "right", cellWidth: 16 }, 3: { halign: "right", cellWidth: 18 } },
        });
        y = fY() + 1;
      }
      if (showDollar) {
        autoTable(doc, {
          startY: y, theme: "grid", margin: { left: 2, right: 2 },
          body: [[`Eski qarzdorlik ($): ${fmtUsd(totalDollar)}`], [`To'lovlar ($): ${fmtUsd(tolovDollar)}`], [`Yangi qarzdorlik ($): ${fmtUsd(yangiUsd)}`]],
          styles: { font: "helvetica", fontStyle: "bold", fontSize: 8, cellPadding: 1.2, lineColor: [0,0,0], lineWidth: 0.2, textColor: [0,0,0], halign: "left" },
        });
      }

      const url = URL.createObjectURL(doc.output("blob"));
      const a = document.createElement("a");
      a.href = url; a.download = `chek-${id}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 180_000);
    } catch {
      alert("PDF yaratishda xatolik. Qayta urinib ko'ring.");
    } finally { setBusy(false); }
  }

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

  const cellHead: React.CSSProperties = { border: "1px solid #000", padding: "3px 4px", fontSize: 12, fontWeight: 800, fontStyle: "italic", textAlign: "center" };
  const cell: React.CSSProperties     = { border: "1px solid #000", padding: "3px 4px", fontSize: 12, fontWeight: 700 };
  const boxRow: React.CSSProperties    = { border: "1px solid #000", borderTop: "none", padding: "3px 6px", fontSize: 12.5, fontWeight: 700 };

  return (
    <div className="pos-screen" style={{ minHeight: "100vh", background: "#e9edf5", padding: 12, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <style>{`
        @media print {
          @page { size: 80mm auto; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .pos-screen { display: block !important; min-height: 0 !important; background: #fff !important; padding: 0 !important; }
          .chek-body { width: 76mm !important; margin: 0 auto !important; box-shadow: none !important; padding: 1mm 2mm !important; }
          .chek-body table th, .chek-body table td { font-size: 9px !important; padding: 2px 3px !important; }
          .chek-body .r-box { font-size: 9px !important; padding: 2px 4px !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>

      {/* Boshqaruv (chopda ko'rinmaydi) */}
      <div className="no-print" style={{ display: "flex", gap: 8, width: "100%", maxWidth: 360, marginBottom: 12 }}>
        <button onClick={()=>router.back()} style={{ flex: "0 0 auto", padding: "12px 16px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", color: "#334155", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>←</button>
        <button onClick={downloadPdf} disabled={!rowsReady || busy}
          style={{ flex: 1, padding: "12px 10px", borderRadius: 10, border: "none", background: (!rowsReady||busy) ? "#9ca3af" : "#16a34a", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
          <svg width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M17 17H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2zm-1-12v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2m-3 5h12"/></svg>
          {busy ? "Tayyorlanmoqda..." : rowsReady ? "Chop etish" : "Yuklanmoqda..."}
        </button>
      </div>

      {/* CHEK */}
      <div className="chek-body" ref={chekRef} style={{ width: 360, background: "#fff", color: "#000", padding: "12px 14px 14px", fontFamily: "Arial, sans-serif" }}>
        <div style={{ textAlign: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 21, fontWeight: 900, letterSpacing: 1 }}>MUSAFFO TEA</div>
          <div style={{ fontSize: 11, fontWeight: 700 }}>Sotuv cheki</div>
        </div>
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
            {hasSom && (
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8 }}>
                <thead><tr>
                  <th style={{ ...cellHead, textAlign: "left" }}>Mahsulot nomi</th>
                  <th style={{ ...cellHead, width: 40 }}>Soni</th>
                  <th style={{ ...cellHead, width: 64 }}>Narxi</th>
                  <th style={{ ...cellHead, width: 72 }}>Summa</th>
                </tr></thead>
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
            {showSom && (
              <div style={{ marginBottom: hasDollar||showDollar ? 10 : 0 }}>
                <div className="r-box" style={{ ...boxRow, borderTop: "1px solid #000" }}>Eski qarzdorlik: {fmtSom(totalSom)}</div>
                <div className="r-box" style={boxRow}>To&apos;lovlar: {fmtSom(tolovSom)}</div>
                <div className="r-box" style={{ ...boxRow, fontWeight: 900 }}>Yangi qarzdorlik: {fmtSom(yangiSom)}</div>
              </div>
            )}

            {hasDollar && (
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8 }}>
                <thead><tr>
                  <th style={{ ...cellHead, textAlign: "left" }}>Mahsulot ($)</th>
                  <th style={{ ...cellHead, width: 40 }}>Soni</th>
                  <th style={{ ...cellHead, width: 64 }}>Narxi</th>
                  <th style={{ ...cellHead, width: 72 }}>Summa</th>
                </tr></thead>
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
            {showDollar && (
              <div>
                <div className="r-box" style={{ ...boxRow, borderTop: "1px solid #000" }}>Eski qarzdorlik ($): {fmtUsd(totalDollar)}</div>
                <div className="r-box" style={boxRow}>To&apos;lovlar ($): {fmtUsd(tolovDollar)}</div>
                <div className="r-box" style={{ ...boxRow, fontWeight: 900 }}>Yangi qarzdorlik ($): {fmtUsd(yangiUsd)}</div>
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
