"use client";
import { fetchSheet, fetchSheetWhere } from "@/lib/sheet-cache";
import { useEffect, useState, useRef, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

// 80mm termal chek — oq-qora, matnli (vektor) PDF (Print Label uchun).
// Ma'lumotlar A4 "Chek" bilan bir xil: Sana/Agent/Mijoz/Telefon, So'm+Dollar
// jadvallar (№/Mahsulot/Soni/Narxi/Summa/Jami) va balans (Eski qarz/Olingan
// tovar/[To'lov]/Yakuniy balans).

interface SotuvSavatRow { Savat_ID: string; Sotuv_ID: string; Mahsulot_ID: string; Soni: string; Som_Narx: string; Summa_som: string; }
interface SotuvSavatDollarRow { Savat_ID: string; Sotuv_ID: string; Mahsulot_ID: string; Soni: string; Narx: string; Summa: string; }
interface Mahsulot { Mahsulot_ID: string; Nomi: string; }

function num(v: string|number|undefined) { return parseFloat(String(v||"0").replace(/\s/g,"").replace(",",".")) || 0; }
function fmtSom(v: number) { return v.toLocaleString("ru-RU") + " so'm"; }
function fmtUsd(v: number) { return v.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2}) + " $"; }
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
  const yakuniySom = totalSom + thisSom - tolovSom;
  const yakuniyUsd = totalDollar + thisDollar - tolovDollar;

  // Matnli (vektor) PDF — Print Label to'g'ri ko'rsatadi. A4 chek bilan bir xil ma'lumot.
  async function downloadPdf() {
    if (!rowsReady) return;
    setBusy(true);
    try {
      const jsPDF = (await import("jspdf")).default;
      const autoTable = (await import("jspdf-autotable")).default;
      const W = 80;
      // Balandlikni taxminlash (bitta bet — 1/1)
      let h = 14 + 4 * 4 + 4;
      if (hasSom)     h += 7 + savatSom.length * 6 + 7;
      if (showSom)    h += 6 + 6 * (3 + (tolovSom > 0 ? 1 : 0));
      if (hasDollar)  h += 7 + savatDollar.length * 6 + 7;
      if (showDollar) h += 6 + 6 * (3 + (tolovDollar > 0 ? 1 : 0));
      h += 10;
      const doc = new jsPDF({ unit: "mm", format: [W, Math.max(60, Math.ceil(h))] });
      const fY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

      doc.setFont("helvetica", "bold"); doc.setFontSize(13);
      doc.text("MUSAFFO TEA", W / 2, 7, { align: "center" });
      doc.setFont("helvetica", "normal"); doc.setFontSize(8);
      doc.text("Sotuv cheki", W / 2, 11, { align: "center" });

      let y = 16;
      doc.setFontSize(8);
      const info = (label: string, val: string) => {
        if (!val) return;
        doc.setFont("helvetica", "normal"); doc.text(label, 3, y);
        doc.setFont("helvetica", "bold"); doc.text(doc.splitTextToSize(val, 58), 20, y);
        y += 4;
      };
      info("Sana:", sana || "—");
      info("Agent:", agentNomi);
      info("Mijoz:", mijozIsm || "—");
      info("Telefon:", mijozTel);
      y += 1;

      const prodCols = {
        0: { halign: "center" as const, cellWidth: 7 },
        1: { halign: "left" as const },
        2: { halign: "center" as const, cellWidth: 10 },
        3: { halign: "right" as const, cellWidth: 15 },
        4: { halign: "right" as const, cellWidth: 17 },
      };
      const prodStyles = { font: "helvetica", fontStyle: "bold" as const, fontSize: 7, cellPadding: 1, lineColor: [0,0,0] as [number,number,number], lineWidth: 0.2, textColor: [0,0,0] as [number,number,number] };
      const prodHead = { fontStyle: "bolditalic" as const, fillColor: [255,255,255] as [number,number,number], textColor: [0,0,0] as [number,number,number], halign: "center" as const, fontSize: 6.5 };
      const prodFoot = { fillColor: [255,255,255] as [number,number,number], textColor: [0,0,0] as [number,number,number], fontStyle: "bold" as const };

      if (hasSom) {
        autoTable(doc, {
          startY: y, theme: "grid", margin: { left: 2, right: 2 },
          head: [["№", "So'm mahsulot", "Soni", "Narxi", "Summa"]],
          body: savatSom.map((r,i)=>[String(i+1), mMap[r.Mahsulot_ID]?.Nomi||r.Mahsulot_ID, fmtSoni(num(r.Soni)), fmtSom(num(r.Som_Narx)), fmtSom(num(r.Summa_som))]),
          foot: [[{ content: "Jami:", colSpan: 4, styles: { halign: "right" } }, fmtSom(thisSom)]],
          styles: prodStyles, headStyles: prodHead, footStyles: prodFoot, columnStyles: prodCols,
        });
        y = fY() + 1;
      }
      if (showSom) {
        const rows: (string|{content:string;colSpan?:number;styles?:Record<string,unknown>})[][] = [
          ["Eski qarz", fmtSom(totalSom)],
          ["Olingan tovar", fmtSom(thisSom)],
        ];
        if (tolovSom > 0) rows.push(["To'lov", "− " + fmtSom(tolovSom)]);
        rows.push([{ content: "Yakuniy balans", styles: { fontStyle: "bold" } }, { content: fmtSom(yakuniySom), styles: { fontStyle: "bold" } }]);
        autoTable(doc, {
          startY: y, theme: "grid", margin: { left: 2, right: 2 },
          head: [[{ content: "BALANS (SO'M)", colSpan: 2, styles: { halign: "center" } }]],
          body: rows,
          styles: { font: "helvetica", fontStyle: "bold", fontSize: 8, cellPadding: 1.2, lineColor: [0,0,0], lineWidth: 0.2, textColor: [0,0,0] },
          headStyles: { fillColor: [255,255,255], textColor: [0,0,0], fontStyle: "bold", halign: "center", fontSize: 8 },
          columnStyles: { 0: { halign: "left" }, 1: { halign: "right" } },
        });
        y = fY() + 2;
      }
      if (hasDollar) {
        autoTable(doc, {
          startY: y, theme: "grid", margin: { left: 2, right: 2 },
          head: [["№", "Dollar mahsulot", "Soni", "Narxi", "Summa"]],
          body: savatDollar.map((r,i)=>[String(i+1), mMap[r.Mahsulot_ID]?.Nomi||r.Mahsulot_ID, fmtSoni(num(r.Soni)), fmtUsd(num(r.Narx)), fmtUsd(num(r.Summa))]),
          foot: [[{ content: "Jami:", colSpan: 4, styles: { halign: "right" } }, fmtUsd(thisDollar)]],
          styles: prodStyles, headStyles: prodHead, footStyles: prodFoot, columnStyles: prodCols,
        });
        y = fY() + 1;
      }
      if (showDollar) {
        const rows: (string|{content:string;colSpan?:number;styles?:Record<string,unknown>})[][] = [
          ["Eski qarz", fmtUsd(totalDollar)],
          ["Olingan tovar", fmtUsd(thisDollar)],
        ];
        if (tolovDollar > 0) rows.push(["To'lov", "− " + fmtUsd(tolovDollar)]);
        rows.push([{ content: "Yakuniy balans", styles: { fontStyle: "bold" } }, { content: fmtUsd(yakuniyUsd), styles: { fontStyle: "bold" } }]);
        autoTable(doc, {
          startY: y, theme: "grid", margin: { left: 2, right: 2 },
          head: [[{ content: "BALANS ($)", colSpan: 2, styles: { halign: "center" } }]],
          body: rows,
          styles: { font: "helvetica", fontStyle: "bold", fontSize: 8, cellPadding: 1.2, lineColor: [0,0,0], lineWidth: 0.2, textColor: [0,0,0] },
          headStyles: { fillColor: [255,255,255], textColor: [0,0,0], fontStyle: "bold", halign: "center", fontSize: 8 },
          columnStyles: { 0: { halign: "left" }, 1: { halign: "right" } },
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

  // ── Ekrandagi ko'rinish (preview) — PDF bilan bir xil ──
  const cellHead: React.CSSProperties = { border: "1px solid #000", padding: "3px 3px", fontSize: 10.5, fontWeight: 800, fontStyle: "italic", textAlign: "center" };
  const cell: React.CSSProperties     = { border: "1px solid #000", padding: "3px 4px", fontSize: 11.5, fontWeight: 700 };
  const balCell: React.CSSProperties   = { border: "1px solid #000", padding: "3px 6px", fontSize: 12, fontWeight: 700 };

  function ProdTable({ title, rows, jami }: { title: string; rows: React.ReactNode[][]; jami: string }) {
    return (
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8 }}>
        <thead><tr>
          <th style={{ ...cellHead, width: 26 }}>№</th>
          <th style={{ ...cellHead, textAlign: "left" }}>{title}</th>
          <th style={{ ...cellHead, width: 38 }}>Soni</th>
          <th style={{ ...cellHead, width: 60 }}>Narxi</th>
          <th style={{ ...cellHead, width: 70 }}>Summa</th>
        </tr></thead>
        <tbody>
          {rows.map((c,i)=>(
            <tr key={i}>
              <td style={{ ...cell, textAlign: "center" }}>{i+1}</td>
              <td style={{ ...cell, textAlign: "left" }}>{c[0]}</td>
              <td style={{ ...cell, textAlign: "center" }}>{c[1]}</td>
              <td style={{ ...cell, textAlign: "right" }}>{c[2]}</td>
              <td style={{ ...cell, textAlign: "right" }}>{c[3]}</td>
            </tr>
          ))}
          <tr>
            <td style={{ ...cell, textAlign: "right", fontWeight: 800 }} colSpan={4}>Jami:</td>
            <td style={{ ...cell, textAlign: "right", fontWeight: 900 }}>{jami}</td>
          </tr>
        </tbody>
      </table>
    );
  }

  function BalTable({ title, eski, olingan, tolov, yakuniy }: { title: string; eski: string; olingan: string; tolov: string|null; yakuniy: string }) {
    return (
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8 }}>
        <thead><tr><th style={{ ...balCell, textAlign: "center", fontWeight: 900 }} colSpan={2}>{title}</th></tr></thead>
        <tbody>
          <tr><td style={{ ...balCell }}>Eski qarz</td><td style={{ ...balCell, textAlign: "right" }}>{eski}</td></tr>
          <tr><td style={{ ...balCell }}>Olingan tovar</td><td style={{ ...balCell, textAlign: "right" }}>{olingan}</td></tr>
          {tolov && <tr><td style={{ ...balCell }}>To&apos;lov</td><td style={{ ...balCell, textAlign: "right" }}>− {tolov}</td></tr>}
          <tr><td style={{ ...balCell, fontWeight: 900 }}>Yakuniy balans</td><td style={{ ...balCell, textAlign: "right", fontWeight: 900 }}>{yakuniy}</td></tr>
        </tbody>
      </table>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#e9edf5", padding: 12, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ display: "flex", gap: 8, width: "100%", maxWidth: 360, marginBottom: 12 }}>
        <button onClick={()=>router.back()} style={{ flex: "0 0 auto", padding: "12px 16px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", color: "#334155", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>←</button>
        <button onClick={downloadPdf} disabled={!rowsReady || busy}
          style={{ flex: 1, padding: "12px 10px", borderRadius: 10, border: "none", background: (!rowsReady||busy) ? "#9ca3af" : "#16a34a", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
          <svg width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M17 17H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2zm-1-12v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2m-3 5h12"/></svg>
          {busy ? "Tayyorlanmoqda..." : rowsReady ? "Chop etish" : "Yuklanmoqda..."}
        </button>
      </div>

      <div style={{ width: 360, background: "#fff", color: "#000", padding: "12px 14px 14px", fontFamily: "Arial, sans-serif" }}>
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 21, fontWeight: 900, letterSpacing: 1 }}>MUSAFFO TEA</div>
          <div style={{ fontSize: 11, fontWeight: 700 }}>Sotuv cheki</div>
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.55, marginBottom: 8, borderBottom: "1px solid #000", paddingBottom: 6 }}>
          <div>Sana: <b>{sana||"—"}</b></div>
          {agentNomi && <div>Agent: <b>{agentNomi}</b></div>}
          <div>Mijoz: <b>{mijozIsm||"—"}</b></div>
          {mijozTel && <div>Telefon: <b>{mijozTel}</b></div>}
        </div>

        {!rowsReady ? (
          <div style={{ textAlign: "center", fontSize: 13, padding: "8px 0" }}>Yuklanmoqda...</div>
        ) : (
          <>
            {hasSom && <ProdTable title="So'm mahsulot" jami={fmtSom(thisSom)}
              rows={savatSom.map(r=>[mMap[r.Mahsulot_ID]?.Nomi||r.Mahsulot_ID, fmtSoni(num(r.Soni)), fmtSom(num(r.Som_Narx)), fmtSom(num(r.Summa_som))])} />}
            {showSom && <BalTable title="BALANS (SO'M)" eski={fmtSom(totalSom)} olingan={fmtSom(thisSom)} tolov={tolovSom>0?fmtSom(tolovSom):null} yakuniy={fmtSom(yakuniySom)} />}
            {hasDollar && <ProdTable title="Dollar mahsulot" jami={fmtUsd(thisDollar)}
              rows={savatDollar.map(r=>[mMap[r.Mahsulot_ID]?.Nomi||r.Mahsulot_ID, fmtSoni(num(r.Soni)), fmtUsd(num(r.Narx)), fmtUsd(num(r.Summa))])} />}
            {showDollar && <BalTable title="BALANS ($)" eski={fmtUsd(totalDollar)} olingan={fmtUsd(thisDollar)} tolov={tolovDollar>0?fmtUsd(tolovDollar):null} yakuniy={fmtUsd(yakuniyUsd)} />}
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
