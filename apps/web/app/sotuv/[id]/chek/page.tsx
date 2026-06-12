"use client";
import { fetchSheet } from "@/lib/sheet-cache";
import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface SotuvSavatRow {
  Savat_ID: string; Sotuv_ID: string; Mahsulot_ID: string;
  Soni: string; Som_Narx: string; Summa_som: string; Izoh?: string;
}
interface SotuvSavatDollarRow {
  Savat_ID: string; Sotuv_ID: string; Mahsulot_ID: string;
  Soni: string; Narx: string; Summa: string; Izoh?: string;
}
interface Mahsulot { Mahsulot_ID: string; Nomi: string; }

function num(v: string|number|undefined) { return parseFloat(String(v||"0").replace(/\s/g,"").replace(",",".")) || 0; }
function fmtSom(v: number) { return v.toLocaleString("ru-RU") + " so'm"; }
function fmtUsd(v: number) { return v.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2})+" $"; }

function buildPDF(
  id: string, sana: string, agentNomi: string, mijozIsm: string, mijozTel: string,
  savatSom: SotuvSavatRow[], savatDollar: SotuvSavatDollarRow[],
  mMap: Record<string,Mahsulot>,
  totalSom: number, totalDollar: number,
): jsPDF {
  const margin = 4;
  const W = 210;
  const rowH = 7;
  const headerH  = 22;
  const infoH    = 30;
  const somH     = savatSom.length    > 0 ? 16 + savatSom.length    * rowH + 12 : 0;
  const dollarH  = savatDollar.length > 0 ? 16 + savatDollar.length * rowH + 12 : 0;
  const balanceH = 55;
  const footerH  = 14;
  const totalH   = headerH + infoH + somH + dollarH + balanceH + footerH;

  const doc = new jsPDF({ unit: "mm", format: [W, Math.max(totalH, 80)] });
  let y = 0;

  // ── Header band ──────────────────────────────────────────────
  doc.setFillColor(26, 39, 68);
  doc.rect(0, 0, W, 22, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("MUSAFFO TEA", W / 2, 14, { align: "center" });

  y = 28;

  // ── Info grid ────────────────────────────────────────────────
  const col1 = margin;
  const col2 = W / 2 + 4;
  const labelW = 22;
  const infoRows = [
    ["Sana", sana||"—",       "Agent",   agentNomi||"—"],
    ["Mijoz", mijozIsm||"—",  "Telefon", mijozTel||"—"],
  ];
  doc.setFillColor(247, 248, 252);
  doc.rect(0, y - 4, W, infoRows.length * 8 + 6, "F");

  for (const [l1,v1,l2,v2] of infoRows) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(26, 39, 68);
    doc.text(l1 + ":", col1, y);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(45, 51, 72);
    doc.text(v1, col1 + labelW, y);

    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(26, 39, 68);
    doc.text(l2 + ":", col2, y);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(45, 51, 72);
    doc.text(v2, col2 + labelW, y);
    y += 8;
  }
  y += 4;

  const thisSom    = savatSom.reduce((s,r)=>s+num(r.Summa_som),0);
  const thisDollar = savatDollar.reduce((s,r)=>s+num(r.Summa),0);

  // ── So'm table ───────────────────────────────────────────────
  if (savatSom.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["№","Mahsulot","Soni","Narxi (so'm)","Summa (so'm)","Izoh"]],
      body: savatSom.map((r,i) => [
        i+1,
        mMap[r.Mahsulot_ID]?.Nomi||r.Mahsulot_ID,
        num(r.Soni).toFixed(1),
        num(r.Som_Narx).toLocaleString("ru-RU"),
        num(r.Summa_som).toLocaleString("ru-RU"),
        r.Izoh||"",
      ]),
      foot: [["","","","Jami:",thisSom.toLocaleString("ru-RU")+" so'm",""]],
      styles: { fontStyle:"bold" },
      headStyles: { fillColor:[26,39,68], textColor:255, fontStyle:"bold", fontSize:8 },
      bodyStyles: { fontSize:9, textColor:[45,51,72], fontStyle:"bold" },
      footStyles: { fillColor:[238,240,248], textColor:[26,39,68], fontStyle:"bold", fontSize:10 },
      alternateRowStyles: { fillColor:[247,248,252] },
      columnStyles: { 0:{halign:"center",cellWidth:10}, 2:{halign:"center",cellWidth:14}, 3:{halign:"right",cellWidth:34}, 4:{halign:"right",cellWidth:38}, 5:{cellWidth:22} },
      showFoot: "lastPage",
      willDrawCell: () => { doc.setFont("helvetica","bold"); },
    });
    y = (doc as jsPDF & {lastAutoTable:{finalY:number}}).lastAutoTable.finalY + 8;
  }

  // ── Dollar table ─────────────────────────────────────────────
  if (savatDollar.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["№","Mahsulot","Soni","Narxi ($)","Summa ($)","Izoh"]],
      body: savatDollar.map((r,i) => [
        i+1,
        mMap[r.Mahsulot_ID]?.Nomi||r.Mahsulot_ID,
        num(r.Soni).toFixed(1),
        num(r.Narx).toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2})+" $",
        num(r.Summa).toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2})+" $",
        r.Izoh||"",
      ]),
      foot: [["","","","Jami:",thisDollar.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2})+" $",""]],
      styles: { fontStyle:"bold" },
      headStyles: { fillColor:[26,39,68], textColor:255, fontStyle:"bold", fontSize:8 },
      bodyStyles: { fontSize:9, textColor:[45,51,72], fontStyle:"bold" },
      footStyles: { fillColor:[238,240,248], textColor:[26,39,68], fontStyle:"bold", fontSize:10 },
      alternateRowStyles: { fillColor:[247,248,252] },
      columnStyles: { 0:{halign:"center",cellWidth:10}, 2:{halign:"center",cellWidth:14}, 3:{halign:"right",cellWidth:34}, 4:{halign:"right",cellWidth:38}, 5:{cellWidth:22} },
      showFoot: "lastPage",
      willDrawCell: () => { doc.setFont("helvetica","bold"); },
    });
    y = (doc as jsPDF & {lastAutoTable:{finalY:number}}).lastAutoTable.finalY + 8;
  }

  // ── Balance box ──────────────────────────────────────────────
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(154, 160, 176);
  doc.text("BALANS XULOSASI", margin, y);
  doc.setDrawColor(232, 234, 240);
  doc.line(margin + 34, y - 1, W - margin, y - 1);
  y += 5;

  const colW = savatSom.length > 0 && savatDollar.length > 0 ? (W - margin*2) / 2 : (W - margin*2);
  const cols: Array<{label:string; eski:string; tovar:string; yak:string}> = [];
  if (savatSom.length > 0)    cols.push({ label:"So'm",   eski:fmtSom(totalSom),   tovar:fmtSom(thisSom),   yak:fmtSom(totalSom+thisSom) });
  if (savatDollar.length > 0) cols.push({ label:"Dollar", eski:fmtUsd(totalDollar), tovar:fmtUsd(thisDollar), yak:fmtUsd(totalDollar+thisDollar) });

  const rows2 = [
    { key:"Eski qarz:",      bg:[255,255,255] as [number,number,number], bold:false },
    { key:"Olingan tovar:",  bg:[247,248,252] as [number,number,number], bold:false },
    { key:"Yakuniy balans:", bg:[240,244,255] as [number,number,number], bold:true  },
  ];
  const vals = [
    cols.map(c=>c.eski),
    cols.map(c=>c.tovar),
    cols.map(c=>c.yak),
  ];

  // header row
  doc.setFillColor(26, 39, 68);
  doc.rect(margin, y, W - margin*2, 8, "F");
  doc.setTextColor(255,255,255); doc.setFontSize(8); doc.setFont("helvetica","bold");
  cols.forEach((c,ci) => doc.text(c.label, margin + colW*ci + colW/2, y+5.5, {align:"center"}));
  y += 8;

  rows2.forEach((row, ri) => {
    const rowH = row.bold ? 10 : 9;
    doc.setFillColor(...row.bg);
    doc.rect(margin, y, W - margin*2, rowH, "F");
    doc.setDrawColor(232, 234, 240);
    doc.line(margin, y+rowH, W-margin, y+rowH);

    doc.setFont("helvetica", row.bold?"bold":"normal");
    doc.setFontSize(row.bold ? 10 : 9);
    doc.setTextColor(row.bold ? 26 : 122, row.bold ? 39 : 128, row.bold ? 68 : 160);
    doc.text(row.key, margin+4, y + rowH*0.65);

    vals[ri].forEach((val, ci) => {
      doc.setFont("helvetica","bold");
      doc.setFontSize(row.bold ? 10 : 9);
      doc.setTextColor(26, 39, 68);
      doc.text(val, margin + colW*(ci+1) - 4, y + rowH*0.65, {align:"right"});
    });

    if (cols.length > 1) {
      doc.setDrawColor(232, 234, 240);
      doc.line(margin + colW, y, margin + colW, y + rowH);
    }
    y += rowH;
  });

  // border around balance
  doc.setDrawColor(200, 205, 225);
  doc.rect(margin, y - rows2.reduce((s,r)=>s+(r.bold?10:9),0) - 8, W - margin*2, rows2.reduce((s,r)=>s+(r.bold?10:9),0) + 8);

  // ── Footer ───────────────────────────────────────────────────
  y += 10;
  doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(176, 184, 208);
  doc.text(`MUSAFFO TEA  ·  ${sana}`, W/2, y, {align:"center"});

  return doc;
}

function ChekContent() {
  const { id } = useParams<{id:string}>();
  const router = useRouter();
  const sp = useSearchParams();

  const sana        = sp.get("sana")||"";
  const agentNomi   = sp.get("agent")||"";
  const mijozIsm    = sp.get("mijozIsm")||"";
  const mijozTel    = sp.get("mijozTel")||"";
  const totalSom    = num(sp.get("totalSom")||"0");
  const totalDollar = num(sp.get("totalDollar")||"0");

  const [savatSom, setSavatSom]       = useState<SotuvSavatRow[]>([]);
  const [savatDollar, setSavatDollar] = useState<SotuvSavatDollarRow[]>([]);
  const [mMap, setMMap]               = useState<Record<string,Mahsulot>>({});
  const [rowsReady, setRowsReady]     = useState(false);
  const [sharing, setSharing]         = useState(false);


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
      fetchSheet("Sotuv_Savat"),
      fetchSheet("Sotuv_savat_dollar"),
      fetchSheet("Mahsulot"),
    ]).then(([ssR,sdR,mhR])=>{
      setSavatSom((ssR.data as SotuvSavatRow[]).filter(r=>r.Sotuv_ID===id));
      setSavatDollar((sdR.data as SotuvSavatDollarRow[]).filter(r=>r.Sotuv_ID===id));
      const mm:Record<string,Mahsulot>={};
      (mhR.data as Mahsulot[]).forEach(m=>{mm[m.Mahsulot_ID]=m;});
      setMMap(mm);
    }).finally(()=>setRowsReady(true));
  }, [id]);

  const thisSom        = savatSom.reduce((s,r)=>s+num(r.Summa_som),0);
  const thisDollar     = savatDollar.reduce((s,r)=>s+num(r.Summa),0);
  const eskiQarzSom    = totalSom;
  const eskiQarzDollar = totalDollar;

  const hasSom    = !rowsReady || savatSom.length > 0;
  const hasDollar = !rowsReady || savatDollar.length > 0;

  async function handleShare() {
    if (!rowsReady || !id) return;
    setSharing(true);
    try {
      const doc = buildPDF(id, sana, agentNomi, mijozIsm, mijozTel, savatSom, savatDollar, mMap, totalSom, totalDollar);
      const pdfBlob = doc.output("blob");
      const fileName = `chek-${id}.pdf`;

      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const file = new File([pdfBlob], fileName, { type: "application/pdf" });

      if (isMobile && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `Chek #${id} — Musaffo Tea` });
      } else {
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement("a");
        a.href = url; a.download = fileName; a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setSharing(false);
    }
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Arial', sans-serif; background: #f0f2f5; }

        .chek-wrap {
          max-width: 720px;
          margin: 0 auto;
          background: #fff;
          min-height: 100vh;
        }

        /* Header */
        .chek-header {
          background: #1a2744;
          color: #fff;
          padding: 22px 32px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .chek-header__left { display: flex; flex-direction: column; gap: 3px; }
        .chek-header__logo {
          font-size: 26px;
          font-weight: 900;
          letter-spacing: 2px;
          text-transform: uppercase;
        }
        .chek-header__logo span { color: #f5c842; }
        .chek-header__sub {
          font-size: 11px;
          color: rgba(255,255,255,0.55);
          letter-spacing: 3px;
          text-transform: uppercase;
        }
        .chek-header__btns {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .btn-share-top {
          padding: 8px 16px;
          background: rgba(245,200,66,0.15);
          border: 1.5px solid rgba(245,200,66,0.55);
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 700;
          color: #f5c842;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .btn-share-top:hover { background: rgba(245,200,66,0.25); }
        .btn-share-top:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-print-header {
          padding: 8px 16px;
          background: #f5c842;
          color: #1a2744;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 800;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .btn-print-header:disabled { background: #4a5270; color: #8892b0; cursor: not-allowed; }

        /* Info strip */
        .chek-info {
          background: #f7f8fc;
          border-bottom: 2px solid #e8eaf0;
          padding: 16px 32px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px 24px;
        }
        .chek-info__item { display: flex; flex-direction: column; gap: 1px; }
        .chek-info__label { font-size: 12px; color: #1a2744; font-weight: 800; }
        .chek-info__value { font-size: 13px; font-weight: 800; color: #2d3348; }

        /* Section title */
        .chek-section-title {
          padding: 8px 32px 5px;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #1a2744;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .chek-section-title::after { content:''; flex:1; height:2px; background:#e8eaf0; }

        /* Table wrapper */
        .chek-table-wrap { padding: 0 32px 10px; }

        /* Table */
        .chek-table { width:100%; border-collapse:collapse; margin-bottom:4px; }
        .chek-table thead th {
          background: #1a2744;
          color: #fff;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          padding: 8px 12px;
          text-align: center;
        }
        .chek-table tbody tr:nth-child(even) { background: #f7f8fc; }
        .chek-table tbody tr:hover { background: #eef0f8; }
        .chek-table tbody td {
          padding: 9px 12px;
          font-size: 12px;
          font-weight: 700;
          color: #2d3348;
          border-bottom: 1px solid #f0f2f5;
          text-align: center;
        }
        .chek-table tbody td.left { text-align: left; }
        .chek-table tbody td.name { font-weight: 800; text-align: left; }
        .chek-table tbody td.amount { font-weight: 800; color: #1a2744; }
        .chek-table tfoot td {
          padding: 10px 12px;
          font-size: 13px;
          font-weight: 800;
          color: #1a2744;
          background: #eef0f8;
          border-top: 3px double #1a2744;
          text-align: center;
        }
        .chek-table tfoot td.label { text-align: right; color: #5a6080; font-weight: 800; }

        /* Balance box */
        .chek-balance {
          margin: 6px 32px 16px;
          border-radius: 12px;
          overflow: hidden;
          border: 1.5px solid #e0e3ef;
        }
        .chek-balance__header {
          background: #1a2744; color: #fff;
          font-size: 12px; font-weight: 900;
          letter-spacing: 2px; text-transform: uppercase;
          padding: 10px 20px;
          display: flex;
        }
        .chek-balance__header-cell { flex: 1; text-align: center; }
        .chek-balance__row { display: flex; border-bottom: 1px solid #e8eaf0; }
        .chek-balance__row:last-child { border-bottom: none; }
        .chek-balance__cell {
          flex: 1; padding: 10px 20px;
          display: flex; justify-content: space-between; align-items: center;
          font-size: 12.5px; color: #2d3348;
          border-right: 1px solid #e8eaf0;
        }
        .chek-balance__cell:last-child { border-right: none; }
        .chek-balance__cell-label { color: #4a5270; font-size: 12px; font-weight: 800; }
        .chek-balance__cell-val { font-weight: 800; }
        .chek-balance__row--total .chek-balance__cell { background: #f0f4ff; font-size: 13px; }
        .chek-balance__row--total .chek-balance__cell-label { font-weight: 700; color: #1a2744; }
        .chek-balance__row--total .chek-balance__cell-val { font-size: 14px; color: #1a2744; }

        /* Footer */
        .chek-footer {
          border-top: 2px dashed #e0e3ef;
          margin: 0 32px;
          padding: 16px 0;
          text-align: center;
          font-size: 11px;
          color: #b0b8d0;
          letter-spacing: 1px;
        }

        /* Print toolbar */
        .no-print {
          position: sticky; top: 0; z-index: 50;
          padding: 10px 16px;
          background: #1a2744;
          display: flex; gap: 8px; align-items: center;
        }
        .btn-print {
          padding: 8px 22px;
          background: #f5c842; color: #1a2744;
          border: none; border-radius: 8px;
          cursor: pointer; font-size: 13px; font-weight: 800;
          display: flex; align-items: center; gap: 6px;
        }
        .btn-print:disabled { background: #4a5270; color: #8892b0; cursor: not-allowed; }
        .btn-back {
          padding: 8px 18px;
          background: transparent;
          border: 1px solid rgba(255,255,255,0.25);
          border-radius: 8px; cursor: pointer;
          font-size: 13px; font-weight: 600;
          color: rgba(255,255,255,0.75);
        }

        @media print {
          .no-print { display: none !important; }
          @page { margin: 0; }
          body { background: #fff; }
          *, th, td, span, div, p, strong { font-weight: 700 !important; }
          .chek-table th, .chek-table td { font-weight: 700 !important; }
          .chek-info__label, .chek-info__value { font-weight: 700 !important; }
          .chek-balance__cell-label, .chek-balance__cell-val { font-weight: 700 !important; }
          .chek-wrap { max-width: 100%; }

          .chek-header {
            justify-content: center;
            padding: 10px 24px;
          }
          .chek-header__left {
            align-items: center;
            text-align: center;
          }
          .chek-header__sub { display: none; }
          .chek-header__logo { font-size: 18px; }

          .chek-info {
            padding: 6px 24px;
            gap: 2px 16px;
          }
          .chek-info__item { gap: 0; }
          .chek-info__label { font-size: 10px; }
          .chek-info__value { font-size: 11px; }

          .chek-section-title { padding: 5px 8px 3px; font-size: 9px; letter-spacing: 1px; }
          .chek-table-wrap { padding: 0 0 6px; }
          .chek-info { padding: 6px 8px; }
          .chek-table thead th { padding: 4px 8px; font-size: 8px; color: #000 !important; }
          .chek-table tbody td { padding: 3px 8px; font-size: 10px; }
          .chek-table tfoot td { padding: 4px 8px; font-size: 11px; }

          .chek-balance { margin: 5px 0 10px; border-radius: 0; }
          .chek-balance__header { padding: 5px 10px; font-size: 9px; color: #000 !important; }
          .chek-balance__header-cell { color: #000 !important; font-weight: 900 !important; }
          .chek-balance__cell { padding: 4px 10px; font-size: 10px; color: #000 !important; }
          .chek-balance__cell-label { font-size: 10px; color: #000 !important; font-weight: 800 !important; }
          .chek-balance__cell-val { color: #000 !important; font-weight: 800 !important; }
          .chek-balance__row--total .chek-balance__cell { font-size: 11px; color: #000 !important; }
          .chek-footer { padding: 5px 0; font-size: 9px; margin: 0 8px; }
        }
      `}</style>

      {/* Toolbar — faqat orqaga tugmasi */}
      <div className="no-print">
        <button className="btn-back" onClick={()=>router.back()}>← Orqaga</button>
      </div>

      <div className="chek-wrap">

        {/* Header */}
        <div className="chek-header">
          <div className="chek-header__left">
            <div className="chek-header__logo">Musaffo <span>Tea</span></div>
            <div className="chek-header__sub">Hisob · Faktura</div>
          </div>
          <div className="chek-header__btns no-print">
            <button className="btn-print-header" disabled={!rowsReady}
              onClick={()=>{ if(!rowsReady) return; window.print(); }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 17H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2zm-1-12v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2m-3 5h12"/>
              </svg>
              {rowsReady ? "Chop etish" : "Yuklanmoqda..."}
            </button>
            <button className="btn-share-top" disabled={!rowsReady || sharing} onClick={handleShare}>
              {sharing ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/>
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
                </svg>
              )}
              {sharing ? "Tayyorlanmoqda..." : "Ulashish"}
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="chek-info">
          <div className="chek-info__item">
            <span className="chek-info__label" style={{fontWeight:800}}>Sana</span>
            <span className="chek-info__value" style={{fontWeight:800}}>{sana||"—"}</span>
          </div>
          <div className="chek-info__item">
            <span className="chek-info__label" style={{fontWeight:800}}>Agent</span>
            <span className="chek-info__value" style={{fontWeight:800}}>{agentNomi||"—"}</span>
          </div>
          <div className="chek-info__item">
            <span className="chek-info__label" style={{fontWeight:800}}>Mijoz</span>
            <span className="chek-info__value" style={{fontWeight:800}}>{mijozIsm||"—"}</span>
          </div>
          <div className="chek-info__item">
            <span className="chek-info__label" style={{fontWeight:800}}>Telefon</span>
            <span className="chek-info__value" style={{fontWeight:800}}>{mijozTel||"—"}</span>
          </div>
        </div>

        {/* So'm table */}
        {hasSom && (
          <>
            <div className="chek-table-wrap">
              <table className="chek-table">
                <thead>
                  <tr>
                    <th style={{width:36,fontWeight:900}}>№</th>
                    <th style={{textAlign:"left",fontWeight:900}}>So&apos;m mahsulot</th>
                    <th style={{width:60,fontWeight:900}}>Soni</th>
                    <th style={{width:110,fontWeight:900}}>Narxi</th>
                    <th style={{width:120,fontWeight:900}}>Summa</th>
                    <th style={{width:90,fontWeight:900}}>Izoh</th>
                  </tr>
                </thead>
                <tbody>
                  {!rowsReady ? (
                    <tr><td colSpan={6} style={{color:"#aaa",padding:16}}>Yuklanmoqda...</td></tr>
                  ) : savatSom.map((r,i)=>(
                    <tr key={r.Savat_ID}>
                      <td style={{fontWeight:700}}>{i+1}</td>
                      <td className="name" style={{fontWeight:800}}>{mMap[r.Mahsulot_ID]?.Nomi||r.Mahsulot_ID}</td>
                      <td style={{fontWeight:700}}>{num(r.Soni).toFixed(1)}</td>
                      <td style={{fontWeight:700}}>{fmtSom(num(r.Som_Narx))}</td>
                      <td className="amount" style={{fontWeight:800}}>{fmtSom(num(r.Summa_som))}</td>
                      <td className="left" style={{color:"#7a80a0",fontWeight:700}}>{r.Izoh||""}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} className="label">Jami:</td>
                    <td>{fmtSom(thisSom)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}

        {/* Dollar table */}
        {hasDollar && (
          <>
            <div className="chek-table-wrap">
              <table className="chek-table">
                <thead>
                  <tr>
                    <th style={{width:36,fontWeight:900}}>№</th>
                    <th style={{textAlign:"left",fontWeight:900}}>Dollar mahsulot</th>
                    <th style={{width:60,fontWeight:900}}>Soni</th>
                    <th style={{width:110,fontWeight:900}}>Narxi</th>
                    <th style={{width:120,fontWeight:900}}>Summa</th>
                    <th style={{width:90,fontWeight:900}}>Izoh</th>
                  </tr>
                </thead>
                <tbody>
                  {!rowsReady ? (
                    <tr><td colSpan={6} style={{color:"#aaa",padding:16}}>Yuklanmoqda...</td></tr>
                  ) : savatDollar.map((r,i)=>(
                    <tr key={r.Savat_ID}>
                      <td style={{fontWeight:700}}>{i+1}</td>
                      <td className="name" style={{fontWeight:800}}>{mMap[r.Mahsulot_ID]?.Nomi||r.Mahsulot_ID}</td>
                      <td style={{fontWeight:700}}>{num(r.Soni).toFixed(1)}</td>
                      <td style={{fontWeight:700}}>{fmtUsd(num(r.Narx))}</td>
                      <td className="amount" style={{fontWeight:800}}>{fmtUsd(num(r.Summa))}</td>
                      <td className="left" style={{color:"#7a80a0",fontWeight:700}}>{r.Izoh||""}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} className="label">Jami:</td>
                    <td>{fmtUsd(thisDollar)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}

        {/* Balance */}
        <div className="chek-section-title">Balans xulosasi</div>
        <div className="chek-balance">
          <div className="chek-balance__header">
            {hasSom    && <div className="chek-balance__header-cell">So&apos;m</div>}
            {hasDollar && <div className="chek-balance__header-cell">Dollar</div>}
          </div>
          <div className="chek-balance__row">
            {hasSom    && <div className="chek-balance__cell"><span className="chek-balance__cell-label" style={{fontWeight:800}}>Eski qarz</span><span className="chek-balance__cell-val" style={{fontWeight:800}}>{fmtSom(eskiQarzSom)}</span></div>}
            {hasDollar && <div className="chek-balance__cell"><span className="chek-balance__cell-label" style={{fontWeight:800}}>Eski qarz</span><span className="chek-balance__cell-val" style={{fontWeight:800}}>{fmtUsd(eskiQarzDollar)}</span></div>}
          </div>
          <div className="chek-balance__row">
            {hasSom    && <div className="chek-balance__cell"><span className="chek-balance__cell-label" style={{fontWeight:800}}>Olingan tovar</span><span className="chek-balance__cell-val" style={{fontWeight:800}}>{fmtSom(thisSom)}</span></div>}
            {hasDollar && <div className="chek-balance__cell"><span className="chek-balance__cell-label" style={{fontWeight:800}}>Olingan tovar</span><span className="chek-balance__cell-val" style={{fontWeight:800}}>{fmtUsd(thisDollar)}</span></div>}
          </div>
          <div className="chek-balance__row chek-balance__row--total">
            {hasSom    && <div className="chek-balance__cell"><span className="chek-balance__cell-label" style={{fontWeight:900}}>Yakuniy balans</span><span className="chek-balance__cell-val" style={{fontWeight:900}}>{fmtSom(totalSom+thisSom)}</span></div>}
            {hasDollar && <div className="chek-balance__cell"><span className="chek-balance__cell-label" style={{fontWeight:900}}>Yakuniy balans</span><span className="chek-balance__cell-val" style={{fontWeight:900}}>{fmtUsd(totalDollar+thisDollar)}</span></div>}
          </div>
        </div>

        <div className="chek-footer">MUSAFFO TEA · {sana}</div>

      </div>
    </>
  );
}

export default function SotuvChekPage() {
  return (
    <Suspense fallback={<div style={{padding:40,textAlign:"center",fontFamily:"Arial"}}>Yuklanmoqda...</div>}>
      <ChekContent />
    </Suspense>
  );
}
