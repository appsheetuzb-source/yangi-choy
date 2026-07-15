"use client";
import { fetchSheet, fetchSheetWhere } from "@/lib/sheet-cache";
import { useEffect, useState, useRef, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import jsPDF from "jspdf";

interface XaridSavatRow {
  X_Savat: string; Xarid_ID: string; Mahsulot_ID: string;
  Soni: string; Narxi: string; Narx_som: string;
  Summa_Som: string; Jami_Summa: string;
}
interface Mahsulot { Mahsulot_ID: string; Nomi: string; }

function num(v: string|number|undefined) { return parseFloat(String(v||"0").replace(/\s/g,"").replace(",",".")) || 0; }
function fmtSom(v: number) { return v.toLocaleString("ru-RU") + " so'm"; }
function fmtUsd(v: number) { return v.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:4})+" $"; }
// Balans xulosasi uchun — aniq 2 xona
function fmtUsd2(v: number) { return v.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2})+" $"; }

function ChekContent() {
  const { id } = useParams<{id:string}>();
  const router = useRouter();
  const sp = useSearchParams();

  const sana         = sp.get("sana")||"";
  const firma        = sp.get("firma")||"";
  const raqam        = sp.get("raqam")||"";
  const taminotchiId = sp.get("tid")||"";

  const [savatRows, setSavatRows] = useState<XaridSavatRow[]>([]);
  const [mMap, setMMap]           = useState<Record<string,Mahsulot>>({});
  const [rowsReady, setRowsReady] = useState(false);
  const [qarzSom, setQarzSom]     = useState(0);
  const [qarzUsd, setQarzUsd]     = useState(0);
  const [sharing, setSharing]     = useState(false);
  const chekRef = useRef<HTMLDivElement>(null);

  // 1) Shu xariddagi savat + mahsulot nomlari (avval sessionStorage'dan)
  useEffect(()=>{
    if(!id) return;
    try {
      const c = sessionStorage.getItem(`xchek_${id}`);
      if(c) {
        const d = JSON.parse(c);
        setSavatRows((d.savat as XaridSavatRow[]).filter(r=>r.Xarid_ID===id));
        setMMap(d.mMap);
        setRowsReady(true);
        return;
      }
    } catch {}
    Promise.all([
      fetchSheetWhere("Xarid_Savat", "Xarid_ID", id),
      fetchSheet("Mahsulot"),
    ]).then(([xsR,mhR])=>{
      setSavatRows(xsR.data as XaridSavatRow[]);
      const mm:Record<string,Mahsulot>={};
      (mhR.data as Mahsulot[]).forEach(m=>{mm[m.Mahsulot_ID]=m;});
      setMMap(mm);
    }).finally(()=>setRowsReady(true));
  }, [id]);

  // 2) Firma umumiy qarzi (boshlang'ich + barcha xarid − barcha to'lov) — Ta'minotchi sahifasi bilan bir xil
  useEffect(()=>{
    if(!taminotchiId) return;
    let cancelled = false;
    (async ()=>{
      try {
        const [tR, xR, tolvR] = await Promise.all([
          fetchSheetWhere("Taminotchi", "Taminotchi_ID", taminotchiId),
          fetchSheetWhere("Xarid", "Taminotchi_ID", taminotchiId),
          fetchSheetWhere("X_Tolov", "Taminotchi_ID", taminotchiId).catch(()=>({ headers:[], data:[] })),
        ]);
        const t = (tR.data as Record<string,string>[])[0] || {};
        const bSom = num(t.Boshlangich_som), bUsd = num(t.Boshlangich_Balans);
        const xaridIds = (xR.data as Record<string,string>[]).map(x=>String(x.Xarid_ID||"").trim()).filter(Boolean);
        const xsR = xaridIds.length
          ? await fetchSheetWhere("Xarid_Savat", "Xarid_ID", xaridIds).catch(()=>({ headers:[], data:[] }))
          : { data: [] };
        let xSom=0, xUsd=0;
        (xsR.data as Record<string,string>[]).forEach(r=>{ xSom += num(r.Summa_Som); xUsd += num(r.Jami_Summa); });
        let pSom=0, pUsd=0;
        (tolvR.data as Record<string,string>[]).forEach(p=>{ pSom += num(p.Summa); pUsd += num(p.Summa_dollar); });
        if(!cancelled){ setQarzSom(bSom + xSom - pSom); setQarzUsd(bUsd + xUsd - pUsd); }
      } catch {}
    })();
    return ()=>{ cancelled = true; };
  }, [taminotchiId]);

  // So'm qatorlar (Narx_som > 0) va Dollar qatorlar (dollar narxli)
  const savatSom    = savatRows.filter(r => num(r.Narx_som) > 0);
  const savatDollar = savatRows.filter(r => num(r.Narx_som) === 0 && num(r.Narxi) > 0);
  const thisSom     = savatRows.reduce((s,r)=>s+num(r.Summa_Som),0);
  const thisDollar  = savatRows.reduce((s,r)=>s+num(r.Jami_Summa),0);

  const hasSom    = !rowsReady || savatSom.length > 0;
  const hasDollar = !rowsReady || savatDollar.length > 0;
  const eskiQarzSom    = qarzSom - thisSom;
  const eskiQarzDollar = qarzUsd - thisDollar;
  const showSomBal    = !rowsReady || savatSom.length > 0    || qarzSom !== 0 || thisSom !== 0;
  const showDollarBal = !rowsReady || savatDollar.length > 0 || qarzUsd !== 0 || thisDollar !== 0;

  async function handleShare() {
    if (!rowsReady || !id || !chekRef.current) return;
    setSharing(true);
    const el = chekRef.current;
    const prevMinH = el.style.minHeight;
    try {
      el.style.minHeight = "auto";
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        ignoreElements: (e) => (e as HTMLElement).classList?.contains("no-print"),
      });
      el.style.minHeight = prevMinH;

      const pngBlob: Blob | null = await new Promise((res) => canvas.toBlob((b) => res(b), "image/png"));
      const isMobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };

      if (pngBlob && isMobileDevice && nav.canShare) {
        const file = new File([pngBlob], `xarid-chek-${id}.png`, { type: "image/png" });
        if (nav.canShare({ files: [file] })) {
          try { await navigator.share({ files: [file], title: `Xarid #${raqam} — Musaffo Tea` }); return; }
          catch (e) { if (e instanceof Error && e.name === "AbortError") return; }
        }
      }

      if (pngBlob) {
        try {
          if (typeof ClipboardItem !== "undefined" && navigator.clipboard && navigator.clipboard.write) {
            await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
            alert("Chek rasmi nusxalandi ✓ — Telegramga Ctrl+V bilan qo'ying.");
            return;
          }
        } catch { /* clipboard bo'lmasa — PDF zaxiraga o'tamiz */ }
      }

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const imgW = 210;
      const imgH = (canvas.height * imgW) / canvas.width;
      const doc = new jsPDF({ unit: "mm", format: [imgW, imgH] });
      doc.addImage(imgData, "JPEG", 0, 0, imgW, imgH);
      const pdfBlob = doc.output("blob");
      const url = URL.createObjectURL(pdfBlob);
      const win = window.open(url, "_blank");
      if (!win) {
        const a = document.createElement("a");
        a.href = url; a.download = `xarid-chek-${id}.pdf`;
        document.body.appendChild(a); a.click(); a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      alert("Chekni ulashishda xatolik: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      el.style.minHeight = prevMinH;
      setSharing(false);
    }
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Arial', sans-serif; background: #f0f2f5; }
        .chek-wrap { max-width: 720px; margin: 0 auto; background: #fff; min-height: 100vh; }
        .chek-header { background: #1a2744; color: #fff; padding: 22px 32px 20px; display: flex; align-items: center; justify-content: space-between; }
        .chek-header__left { display: flex; flex-direction: column; gap: 3px; }
        .chek-header__logo { font-size: 26px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; }
        .chek-header__logo span { color: #f5c842; }
        .chek-header__sub { font-size: 11px; color: rgba(255,255,255,0.55); letter-spacing: 3px; text-transform: uppercase; }
        .chek-header__btns { display: flex; gap: 8px; align-items: center; }
        .btn-share-top { padding: 8px 16px; background: rgba(245,200,66,0.15); border: 1.5px solid rgba(245,200,66,0.55); border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 700; color: #f5c842; display: flex; align-items: center; gap: 6px; }
        .btn-share-top:hover { background: rgba(245,200,66,0.25); }
        .btn-share-top:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-print-header { padding: 8px 16px; background: #f5c842; color: #1a2744; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 800; display: flex; align-items: center; gap: 6px; }
        .btn-print-header:disabled { background: #4a5270; color: #8892b0; cursor: not-allowed; }
        .chek-info { background: #f7f8fc; border-bottom: 2px solid #e8eaf0; padding: 16px 32px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
        .chek-info__item { display: flex; flex-direction: column; gap: 1px; }
        .chek-info__label { font-size: 12px; color: #1a2744; font-weight: 800; }
        .chek-info__value { font-size: 13px; font-weight: 800; color: #2d3348; }
        .chek-section-title { padding: 8px 32px 5px; font-size: 11px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; color: #1a2744; display: flex; align-items: center; gap: 10px; }
        .chek-section-title::after { content:''; flex:1; height:2px; background:#e8eaf0; }
        .chek-table-wrap { padding: 0 32px 10px; }
        .chek-table { width:100%; border-collapse:collapse; margin-bottom:4px; border:1.5px solid #1a2744; }
        .chek-table thead th { background: #1a2744; color: #fff; font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; padding: 8px 12px; text-align: center; border: 1px solid #2d3a5c; }
        .chek-table tbody tr:nth-child(even) { background: #f7f8fc; }
        .chek-table tbody td { padding: 9px 12px; font-size: 12px; font-weight: 700; color: #2d3348; border: 1px solid #c8cde1; text-align: center; }
        .chek-table tbody td.name { font-weight: 800; text-align: left; }
        .chek-table tbody td.amount { font-weight: 800; color: #1a2744; }
        .chek-table tfoot td { padding: 10px 12px; font-size: 13px; font-weight: 800; color: #1a2744; background: #eef0f8; border: 1px solid #1a2744; text-align: center; }
        .chek-table tfoot td.label { text-align: right; color: #5a6080; font-weight: 800; }
        .chek-balance { margin: 6px 32px 16px; border-radius: 12px; overflow: hidden; border: 1.5px solid #e0e3ef; }
        .chek-balance__header { background: #1a2744; color: #fff; font-size: 12px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; padding: 10px 20px; display: flex; }
        .chek-balance__header-cell { flex: 1; text-align: center; }
        .chek-balance__row { display: flex; border-bottom: 1px solid #e8eaf0; }
        .chek-balance__row:last-child { border-bottom: none; }
        .chek-balance__cell { flex: 1; padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; font-size: 12.5px; color: #2d3348; border-right: 1px solid #e8eaf0; }
        .chek-balance__cell:last-child { border-right: none; }
        .chek-balance__cell-label { color: #4a5270; font-size: 12px; font-weight: 800; }
        .chek-balance__cell-val { font-weight: 800; }
        .chek-balance__row--total .chek-balance__cell { background: #f0f4ff; font-size: 13px; }
        .chek-balance__row--total .chek-balance__cell-label { font-weight: 700; color: #1a2744; }
        .chek-balance__row--total .chek-balance__cell-val { font-size: 14px; color: #1a2744; }
        .chek-footer { border-top: 2px dashed #e0e3ef; margin: 0 32px; padding: 16px 0; text-align: center; font-size: 11px; color: #b0b8d0; letter-spacing: 1px; }
        .no-print { position: sticky; top: 0; z-index: 50; padding: 10px 16px; background: #1a2744; display: flex; gap: 8px; align-items: center; }
        .btn-back { padding: 8px 18px; background: transparent; border: 1px solid rgba(255,255,255,0.25); border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.75); }

        @media print {
          .no-print { display: none !important; }
          @page { size: A4; margin: 0; }
          html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          *, th, td, span, div, p, strong { font-weight: 700 !important; }
          .chek-sheet { width: 10.5cm; padding-top: 4mm; }
          .chek-wrap { width: 9.3cm; max-width: 9.3cm; min-height: auto; margin: 0 auto; }
          .chek-table { table-layout: fixed !important; width: 100% !important; }
          .chek-table th, .chek-table td { word-break: break-word; white-space: normal !important; }
          .chek-table th:nth-child(1), .chek-table td:nth-child(1) { width: 8% !important; }
          .chek-table th:nth-child(2), .chek-table td:nth-child(2) { width: 44% !important; text-align: left !important; }
          .chek-table th:nth-child(3), .chek-table td:nth-child(3) { width: 12% !important; }
          .chek-table th:nth-child(4), .chek-table td:nth-child(4) { width: 17% !important; }
          .chek-table th:nth-child(5), .chek-table td:nth-child(5) { width: 19% !important; }
          .chek-header { justify-content: center; padding: 6px 10px; }
          .chek-header__left { align-items: center; text-align: center; }
          .chek-header__sub { display: none; }
          .chek-header { background-color: #1a2744 !important; }
          .chek-header__logo, .chek-header__logo span { font-size: 18px; color: #fff !important; }
          .chek-info { padding: 5px 8px; gap: 2px 16px; }
          .chek-info__item { gap: 0; }
          .chek-info__label { font-size: 10px; }
          .chek-info__value { font-size: 11px; }
          .chek-section-title { padding: 3px 8px 2px; font-size: 9px; letter-spacing: 1px; }
          .chek-table-wrap { padding: 0 0 3px; }
          .chek-table { border: 1.2px solid #000 !important; }
          .chek-table thead th { padding: 3px 4px; font-size: 8px; color: #fff !important; background-color: #1a2744 !important; border: 0.8px solid #2d3a5c !important; }
          .chek-table tbody td { padding: 3px 4px; font-size: 9px; border: 0.8px solid #555 !important; }
          .chek-table tfoot td { padding: 3px 4px; font-size: 10px; border: 0.8px solid #000 !important; }
          .chek-balance { margin: 4px 0 6px; border-radius: 0; }
          .chek-balance__header { padding: 5px 10px; font-size: 9px; color: #fff !important; background-color: #1a2744 !important; }
          .chek-balance__header-cell { color: #fff !important; font-weight: 900 !important; }
          .chek-balance__row { background-color: #fff !important; }
          .chek-balance__cell { padding: 4px 10px; font-size: 10px; color: #000 !important; background-color: #fff !important; }
          .chek-balance__cell-label { font-size: 10px; color: #000 !important; font-weight: 800 !important; }
          .chek-balance__cell-val { color: #000 !important; font-weight: 800 !important; }
          .chek-balance__row--total .chek-balance__cell { font-size: 11.5px; background-color: #1a2744 !important; }
          .chek-balance__row--total .chek-balance__cell-label,
          .chek-balance__row--total .chek-balance__cell-val { color: #fff !important; font-weight: 900 !important; }
          .chek-footer { padding: 5px 0; font-size: 9px; margin: 0 8px; }
        }
      `}</style>

      <div className="no-print">
        <button className="btn-back" onClick={()=>router.back()}>← Orqaga</button>
      </div>

      <div className="chek-sheet">
        <div className="chek-wrap" ref={chekRef}>{renderInner()}</div>
      </div>
    </>
  );

  function renderInner() {
    return (
      <>
        {/* Header */}
        <div className="chek-header">
          <div className="chek-header__left">
            <div className="chek-header__logo">Musaffo <span>Tea</span></div>
            <div className="chek-header__sub">Xarid · Faktura</div>
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
            <span className="chek-info__label">Sana</span>
            <span className="chek-info__value">{sana||"—"}</span>
          </div>
          <div className="chek-info__item">
            <span className="chek-info__label">Xarid №</span>
            <span className="chek-info__value">#{raqam||"—"}</span>
          </div>
          <div className="chek-info__item" style={{gridColumn:"1 / -1"}}>
            <span className="chek-info__label">Firma</span>
            <span className="chek-info__value">{firma||"—"}</span>
          </div>
        </div>

        {/* So'm table */}
        {hasSom && (
          <div className="chek-table-wrap">
            <table className="chek-table">
              <thead>
                <tr>
                  <th style={{width:36}}>№</th>
                  <th style={{textAlign:"left"}}>So&apos;m mahsulot</th>
                  <th style={{width:60}}>Soni</th>
                  <th style={{width:110}}>Narxi</th>
                  <th style={{width:120}}>Summa</th>
                </tr>
              </thead>
              <tbody>
                {!rowsReady ? (
                  <tr><td colSpan={5} style={{color:"#aaa",padding:16}}>Yuklanmoqda...</td></tr>
                ) : savatSom.map((r,i)=>(
                  <tr key={r.X_Savat||i}>
                    <td>{i+1}</td>
                    <td className="name">{mMap[r.Mahsulot_ID]?.Nomi||r.Mahsulot_ID}</td>
                    <td>{num(r.Soni).toFixed(1)}</td>
                    <td>{fmtSom(num(r.Narx_som))}</td>
                    <td className="amount">{fmtSom(num(r.Summa_Som))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="label">Jami:</td>
                  <td>{fmtSom(thisSom)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Dollar table */}
        {hasDollar && (
          <div className="chek-table-wrap">
            <table className="chek-table">
              <thead>
                <tr>
                  <th style={{width:36}}>№</th>
                  <th style={{textAlign:"left"}}>Dollar mahsulot</th>
                  <th style={{width:60}}>Soni</th>
                  <th style={{width:110}}>Narxi</th>
                  <th style={{width:120}}>Summa</th>
                </tr>
              </thead>
              <tbody>
                {!rowsReady ? (
                  <tr><td colSpan={5} style={{color:"#aaa",padding:16}}>Yuklanmoqda...</td></tr>
                ) : savatDollar.map((r,i)=>(
                  <tr key={r.X_Savat||i}>
                    <td>{i+1}</td>
                    <td className="name">{mMap[r.Mahsulot_ID]?.Nomi||r.Mahsulot_ID}</td>
                    <td>{num(r.Soni).toFixed(1)}</td>
                    <td>{fmtUsd(num(r.Narxi))}</td>
                    <td className="amount">{fmtUsd(num(r.Jami_Summa))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="label">Jami:</td>
                  <td>{fmtUsd(thisDollar)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Balance */}
        <div className="chek-section-title">Firma balansi</div>
        <div className="chek-balance">
          <div className="chek-balance__header">
            {showSomBal    && <div className="chek-balance__header-cell">So&apos;m</div>}
            {showDollarBal && <div className="chek-balance__header-cell">Dollar</div>}
          </div>
          <div className="chek-balance__row">
            {showSomBal    && <div className="chek-balance__cell"><span className="chek-balance__cell-label">Eski qarz</span><span className="chek-balance__cell-val">{fmtSom(eskiQarzSom)}</span></div>}
            {showDollarBal && <div className="chek-balance__cell"><span className="chek-balance__cell-label">Eski qarz</span><span className="chek-balance__cell-val">{fmtUsd2(eskiQarzDollar)}</span></div>}
          </div>
          <div className="chek-balance__row">
            {showSomBal    && <div className="chek-balance__cell"><span className="chek-balance__cell-label">Olingan tovar</span><span className="chek-balance__cell-val">{fmtSom(thisSom)}</span></div>}
            {showDollarBal && <div className="chek-balance__cell"><span className="chek-balance__cell-label">Olingan tovar</span><span className="chek-balance__cell-val">{fmtUsd2(thisDollar)}</span></div>}
          </div>
          <div className="chek-balance__row chek-balance__row--total">
            {showSomBal    && <div className="chek-balance__cell"><span className="chek-balance__cell-label">Yakuniy qarz</span><span className="chek-balance__cell-val">{fmtSom(qarzSom)}</span></div>}
            {showDollarBal && <div className="chek-balance__cell"><span className="chek-balance__cell-label">Yakuniy qarz</span><span className="chek-balance__cell-val">{fmtUsd2(qarzUsd)}</span></div>}
          </div>
        </div>

        <div className="chek-footer">MUSAFFO TEA · {sana}</div>
      </>
    );
  }
}

export default function XaridChekPage() {
  return (
    <Suspense fallback={<div style={{padding:40,textAlign:"center",fontFamily:"Arial"}}>Yuklanmoqda...</div>}>
      <ChekContent />
    </Suspense>
  );
}
