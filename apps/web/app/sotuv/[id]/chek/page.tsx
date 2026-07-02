"use client";
import { fetchSheet, fetchSheetWhere } from "@/lib/sheet-cache";
import { useEffect, useState, useRef, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import jsPDF from "jspdf";

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
function fmtUsd(v: number) { return v.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:4})+" $"; }
// Balans xulosasi uchun — aniq 2 xona (jami summalar pul ko'rinishida)
function fmtUsd2(v: number) { return v.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2})+" $"; }


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
  const tolovSom    = num(sp.get("tolovSom")||"0");
  const tolovDollar = num(sp.get("tolovDollar")||"0");

  const [savatSom, setSavatSom]       = useState<SotuvSavatRow[]>([]);
  const [savatDollar, setSavatDollar] = useState<SotuvSavatDollarRow[]>([]);
  const [mMap, setMMap]               = useState<Record<string,Mahsulot>>({});
  const [rowsReady, setRowsReady]     = useState(false);
  const [sharing, setSharing]         = useState(false);
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

  const thisSom        = savatSom.reduce((s,r)=>s+num(r.Summa_som),0);
  const thisDollar     = savatDollar.reduce((s,r)=>s+num(r.Summa),0);
  const eskiQarzSom    = totalSom;
  const eskiQarzDollar = totalDollar;

  const hasSom    = !rowsReady || savatSom.length > 0;
  const hasDollar = !rowsReady || savatDollar.length > 0;
  // Balans xulosasi uchun: o'sha valyutada mahsulot bo'lmasa ham, qarz yoki to'lov bo'lsa ustun ko'rsatiladi
  const showSomBal    = !rowsReady || savatSom.length > 0    || eskiQarzSom !== 0    || tolovSom !== 0    || thisSom !== 0;
  const showDollarBal = !rowsReady || savatDollar.length > 0 || eskiQarzDollar !== 0 || tolovDollar !== 0 || thisDollar !== 0;

  async function handleShare() {
    if (!rowsReady || !id || !chekRef.current) return;
    setSharing(true);
    const el = chekRef.current;
    const prevMinH = el.style.minHeight;
    try {
      // Dastur oynasidagi (HTML) chekni AYNAN rasmga olamiz — ulashilgan PDF ko'rinish/pechat bilan bir xil bo'ladi
      el.style.minHeight = "auto";   // 100vh bo'sh joyni olib tashlaymiz
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        ignoreElements: (e) => (e as HTMLElement).classList?.contains("no-print"),
      });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const imgW = 210;                                   // A4 eni (mm)
      const imgH = (canvas.height * imgW) / canvas.width;
      const doc = new jsPDF({ unit: "mm", format: [imgW, imgH] });
      doc.addImage(imgData, "JPEG", 0, 0, imgW, imgH);
      const pdfBlob = doc.output("blob");
      const fileName = `chek-${id}.pdf`;
      el.style.minHeight = prevMinH;   // ko'rinishni darhol tiklaymiz

      const file = new File([pdfBlob], fileName, { type: "application/pdf" });

      // 1) Web Share (fayl bilan) — qo'llab-quvvatlasa
      if (typeof navigator !== "undefined" && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `Chek #${id} — Musaffo Tea` });
          return;
        } catch (e) {
          // foydalanuvchi bekor qilgan bo'lsa — jimgina chiqamiz
          if (e instanceof Error && (e.name === "AbortError" || (e.name === "NotAllowedError" && /cancel/i.test(e.message)))) return;
          // aks holda pastdagi zaxiraga o'tamiz
        }
      }

      // 2) Zaxira: PDF'ni yangi oynada ochish (mobilda ishonchli — ko'rib/saqlab/ulashish mumkin)
      const url = URL.createObjectURL(pdfBlob);
      const win = window.open(url, "_blank");
      if (!win) {
        const a = document.createElement("a");
        a.href = url; a.download = fileName;
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

        /* Table — har bir katak ramkali (grid) */
        .chek-table { width:100%; border-collapse:collapse; margin-bottom:4px; border:1.5px solid #1a2744; }
        .chek-table thead th {
          background: #1a2744;
          color: #fff;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          padding: 8px 12px;
          text-align: center;
          border: 1px solid #2d3a5c;
        }
        .chek-table tbody tr:nth-child(even) { background: #f7f8fc; }
        .chek-table tbody tr:hover { background: #eef0f8; }
        .chek-table tbody td {
          padding: 9px 12px;
          font-size: 12px;
          font-weight: 700;
          color: #2d3348;
          border: 1px solid #c8cde1;
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
          border: 1px solid #1a2744;
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
          @page { size: A4; margin: 0; }
          html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          *, th, td, span, div, p, strong { font-weight: 700 !important; }
          .chek-table th, .chek-table td { font-weight: 700 !important; }
          .chek-info__label, .chek-info__value { font-weight: 700 !important; }
          .chek-balance__cell-label, .chek-balance__cell-val { font-weight: 700 !important; }
          /* A4 o'rtasidan teng 2 ga bo'linadi: CHAP yarmida (10.5sm) chek chiqadi,
             O'NG yarmi (10.5sm) bo'sh qoladi — o'sha teng joyga keyingi (2-pechat)
             chek sig'adi. Chek chap yarmiga markazlashgan, chetlardan kesilmaydi.
             min-height: auto — aks holda 100vh balandlik 2-sahifa hosil qiladi. */
          .chek-sheet { width: 10.5cm; padding-top: 4mm; }
          .chek-wrap { width: 9.3cm; max-width: 9.3cm; min-height: auto; margin: 0 auto; }
          /* qattiq ustun enlarini bekor qilib, jadval 10.5sm'ga sig'sin */
          .chek-table { table-layout: fixed !important; width: 100% !important; }
          .chek-table th, .chek-table td { word-break: break-word; white-space: normal !important; }
          /* Mahsulot nomi keng (to'liq), qolganlari kichik */
          .chek-table th:nth-child(1), .chek-table td:nth-child(1) { width: 6% !important; }
          .chek-table th:nth-child(2), .chek-table td:nth-child(2) { width: 42% !important; text-align: left !important; }
          .chek-table th:nth-child(3), .chek-table td:nth-child(3) { width: 9% !important; }
          .chek-table th:nth-child(4), .chek-table td:nth-child(4) { width: 15% !important; }
          .chek-table th:nth-child(5), .chek-table td:nth-child(5) { width: 18% !important; }
          .chek-table th:nth-child(6), .chek-table td:nth-child(6) { width: 10% !important; }

          .chek-header {
            justify-content: center;
            padding: 6px 10px;
          }
          .chek-header__left {
            align-items: center;
            text-align: center;
          }
          .chek-header__sub { display: none; }
          .chek-header { background-color: #1a2744 !important; }
          .chek-header__logo, .chek-header__logo span { font-size: 18px; color: #fff !important; }

          .chek-info {
            padding: 6px 24px;
            gap: 2px 16px;
          }
          .chek-info__item { gap: 0; }
          .chek-info__label { font-size: 10px; }
          .chek-info__value { font-size: 11px; }

          .chek-section-title { padding: 3px 8px 2px; font-size: 9px; letter-spacing: 1px; }
          .chek-table-wrap { padding: 0 0 3px; }
          .chek-info { padding: 5px 8px; }
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
          /* Yakuniy balans — navy chiziq + oq qalin matn (toza chiqishi uchun) */
          .chek-balance__row--total .chek-balance__cell { font-size: 11.5px; background-color: #1a2744 !important; }
          .chek-balance__row--total .chek-balance__cell-label,
          .chek-balance__row--total .chek-balance__cell-val { color: #fff !important; font-weight: 900 !important; }
          .chek-footer { padding: 5px 0; font-size: 9px; margin: 0 8px; }
        }
      `}</style>

      {/* Toolbar — faqat orqaga tugmasi */}
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
            {showSomBal    && <div className="chek-balance__header-cell">So&apos;m</div>}
            {showDollarBal && <div className="chek-balance__header-cell">Dollar</div>}
          </div>
          <div className="chek-balance__row">
            {showSomBal    && <div className="chek-balance__cell"><span className="chek-balance__cell-label" style={{fontWeight:800}}>Eski qarz</span><span className="chek-balance__cell-val" style={{fontWeight:800}}>{fmtSom(eskiQarzSom)}</span></div>}
            {showDollarBal && <div className="chek-balance__cell"><span className="chek-balance__cell-label" style={{fontWeight:800}}>Eski qarz</span><span className="chek-balance__cell-val" style={{fontWeight:800}}>{fmtUsd2(eskiQarzDollar)}</span></div>}
          </div>
          <div className="chek-balance__row">
            {showSomBal    && <div className="chek-balance__cell"><span className="chek-balance__cell-label" style={{fontWeight:800}}>Olingan tovar</span><span className="chek-balance__cell-val" style={{fontWeight:800}}>{fmtSom(thisSom)}</span></div>}
            {showDollarBal && <div className="chek-balance__cell"><span className="chek-balance__cell-label" style={{fontWeight:800}}>Olingan tovar</span><span className="chek-balance__cell-val" style={{fontWeight:800}}>{fmtUsd2(thisDollar)}</span></div>}
          </div>
          {(tolovSom>0||tolovDollar>0) && (
          <div className="chek-balance__row">
            {showSomBal    && <div className="chek-balance__cell"><span className="chek-balance__cell-label" style={{fontWeight:800}}>To&apos;lov</span><span className="chek-balance__cell-val" style={{fontWeight:800,color:"#16a34a"}}>− {fmtSom(tolovSom)}</span></div>}
            {showDollarBal && <div className="chek-balance__cell"><span className="chek-balance__cell-label" style={{fontWeight:800}}>To&apos;lov</span><span className="chek-balance__cell-val" style={{fontWeight:800,color:"#16a34a"}}>− {fmtUsd2(tolovDollar)}</span></div>}
          </div>
          )}
          <div className="chek-balance__row chek-balance__row--total">
            {showSomBal    && <div className="chek-balance__cell"><span className="chek-balance__cell-label" style={{fontWeight:900}}>Yakuniy balans</span><span className="chek-balance__cell-val" style={{fontWeight:900}}>{fmtSom(totalSom+thisSom-tolovSom)}</span></div>}
            {showDollarBal && <div className="chek-balance__cell"><span className="chek-balance__cell-label" style={{fontWeight:900}}>Yakuniy balans</span><span className="chek-balance__cell-val" style={{fontWeight:900}}>{fmtUsd2(totalDollar+thisDollar-tolovDollar)}</span></div>}
          </div>
        </div>

        <div className="chek-footer">MUSAFFO TEA · {sana}</div>
      </>
    );
  }
}

export default function SotuvChekPage() {
  return (
    <Suspense fallback={<div style={{padding:40,textAlign:"center",fontFamily:"Arial"}}>Yuklanmoqda...</div>}>
      <ChekContent />
    </Suspense>
  );
}
