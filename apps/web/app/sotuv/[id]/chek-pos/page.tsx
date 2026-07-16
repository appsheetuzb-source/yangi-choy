"use client";
import { fetchSheet, fetchSheetWhere } from "@/lib/sheet-cache";
import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

// 80mm termal chek — oq-qora, matnli (vektor) PDF (Print Label uchun). Faqat so'm.
// Ma'lumotlar A4 "Chek" bilan bir xil: Sana/Agent/Mijoz/Telefon, mahsulot jadvali
// (№/Mahsulot/Soni/Narxi/Summa/Jami) va balans (Eski qarz/Olingan tovar/[To'lov]/Yakuniy).

interface SotuvSavatRow { Savat_ID: string; Sotuv_ID: string; Mahsulot_ID: string; Soni: string; Som_Narx: string; Summa_som: string; }
interface Mahsulot { Mahsulot_ID: string; Nomi: string; }

function num(v: string|number|undefined) { return parseFloat(String(v||"0").replace(/\s/g,"").replace(",",".")) || 0; }
function fmtSom(v: number) { return v.toLocaleString("ru-RU") + " so'm"; }
function fmtSoni(v: number) { return v.toLocaleString("ru-RU",{minimumFractionDigits:1,maximumFractionDigits:2}); }

const cellHead: React.CSSProperties = { border: "1px solid #000", padding: "3px 3px", fontSize: 10.5, fontWeight: 800, fontStyle: "italic", textAlign: "center" };
const cell: React.CSSProperties     = { border: "1px solid #000", padding: "3px 4px", fontSize: 11.5, fontWeight: 700 };
const balCell: React.CSSProperties   = { border: "1px solid #000", padding: "3px 6px", fontSize: 12, fontWeight: 700 };

function ProdTable({ rows, jami }: { rows: React.ReactNode[][]; jami: string }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8 }}>
      <thead><tr>
        <th style={{ ...cellHead, width: 26 }}>№</th>
        <th style={{ ...cellHead, textAlign: "left" }}>Mahsulot nomi</th>
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

function BalTable({ eski, olingan, tolov, yakuniy }: { eski: string; olingan: string; tolov: string|null; yakuniy: string }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8 }}>
      <thead><tr><th style={{ ...balCell, textAlign: "center", fontWeight: 900 }} colSpan={2}>BALANS</th></tr></thead>
      <tbody>
        <tr><td style={balCell}>Eski qarz</td><td style={{ ...balCell, textAlign: "right" }}>{eski}</td></tr>
        <tr><td style={balCell}>Olingan tovar</td><td style={{ ...balCell, textAlign: "right" }}>{olingan}</td></tr>
        {tolov && <tr><td style={balCell}>To&apos;lov</td><td style={{ ...balCell, textAlign: "right" }}>− {tolov}</td></tr>}
        <tr><td style={{ ...balCell, fontWeight: 900 }}>Yakuniy balans</td><td style={{ ...balCell, textAlign: "right", fontWeight: 900 }}>{yakuniy}</td></tr>
      </tbody>
    </table>
  );
}

function PosContent() {
  const { id } = useParams<{id:string}>();
  const router = useRouter();
  const sp = useSearchParams();

  const sana      = sp.get("sana")||"";
  const agentNomi = sp.get("agent")||"";
  const mijozIsm  = sp.get("mijozIsm")||"";
  const mijozTel  = sp.get("mijozTel")||"";
  const totalSom  = num(sp.get("totalSom")||"0");
  const tolovSom  = num(sp.get("tolovSom")||"0");

  const [savatSom, setSavatSom] = useState<SotuvSavatRow[]>([]);
  const [mMap, setMMap]         = useState<Record<string,Mahsulot>>({});
  const [rowsReady, setRowsReady] = useState(false);
  const [busy, setBusy]         = useState(false);

  useEffect(()=>{
    if(!id) return;
    try {
      const c = sessionStorage.getItem(`chek_${id}`);
      if(c) {
        const d = JSON.parse(c);
        setSavatSom((d.savatSom as SotuvSavatRow[]).filter(r=>r.Sotuv_ID===id));
        setMMap(d.mMap);
        setRowsReady(true);
        return;
      }
    } catch {}
    Promise.all([
      fetchSheetWhere("Sotuv_Savat", "Sotuv_ID", id),
      fetchSheet("Mahsulot"),
    ]).then(([ssR,mhR])=>{
      setSavatSom(ssR.data as SotuvSavatRow[]);
      const mm:Record<string,Mahsulot>={};
      (mhR.data as Mahsulot[]).forEach(m=>{mm[m.Mahsulot_ID]=m;});
      setMMap(mm);
    }).finally(()=>setRowsReady(true));
  }, [id]);

  const thisSom    = savatSom.reduce((s,r)=>s+num(r.Summa_som),0);
  const hasSom     = savatSom.length > 0;
  const showSom    = hasSom || totalSom !== 0 || tolovSom !== 0;
  const yakuniySom = totalSom + thisSom - tolovSom;

  // Matnli (vektor) PDF — Print Label to'g'ri ko'rsatadi (rasm-PDF bo'sh chiqardi).
  async function downloadPdf() {
    if (!rowsReady) return;
    setBusy(true);
    try {
      const jsPDF = (await import("jspdf")).default;
      const autoTable = (await import("jspdf-autotable")).default;
      const W = 80;
      let h = 14 + 4 * 4 + 4;
      if (hasSom)  h += 7 + savatSom.length * 6 + 7;
      if (showSom) h += 6 + 6 * (3 + (tolovSom > 0 ? 1 : 0));
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

      if (hasSom) {
        autoTable(doc, {
          startY: y, theme: "grid", margin: { left: 2, right: 2 },
          head: [["№", "Mahsulot nomi", "Soni", "Narxi", "Summa"]],
          body: savatSom.map((r,i)=>[String(i+1), mMap[r.Mahsulot_ID]?.Nomi||r.Mahsulot_ID, fmtSoni(num(r.Soni)), fmtSom(num(r.Som_Narx)), fmtSom(num(r.Summa_som))]),
          foot: [[{ content: "Jami:", colSpan: 4, styles: { halign: "right" } }, fmtSom(thisSom)]],
          styles: { font: "helvetica", fontStyle: "bold", fontSize: 7, cellPadding: 1, lineColor: [0,0,0], lineWidth: 0.2, textColor: [0,0,0] },
          headStyles: { fontStyle: "bolditalic", fillColor: [255,255,255], textColor: [0,0,0], halign: "center", fontSize: 6.5 },
          footStyles: { fillColor: [255,255,255], textColor: [0,0,0], fontStyle: "bold" },
          columnStyles: { 0: { halign: "center", cellWidth: 7 }, 1: { halign: "left" }, 2: { halign: "center", cellWidth: 10 }, 3: { halign: "right", cellWidth: 15 }, 4: { halign: "right", cellWidth: 17 } },
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
          head: [[{ content: "BALANS", colSpan: 2, styles: { halign: "center" } }]],
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
            {hasSom && <ProdTable jami={fmtSom(thisSom)}
              rows={savatSom.map(r=>[mMap[r.Mahsulot_ID]?.Nomi||r.Mahsulot_ID, fmtSoni(num(r.Soni)), fmtSom(num(r.Som_Narx)), fmtSom(num(r.Summa_som))])} />}
            {showSom && <BalTable eski={fmtSom(totalSom)} olingan={fmtSom(thisSom)} tolov={tolovSom>0?fmtSom(tolovSom):null} yakuniy={fmtSom(yakuniySom)} />}
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
