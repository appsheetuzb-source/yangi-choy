"use client";
import { fetchSheet, fetchSheetWhere } from "@/lib/sheet-cache";
import { useEffect, useState, useRef, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

// 80mm termal chek (Xprinter M817, ESC/POS) — telefon orqali chop etish uchun.
// Ma'lumot A4 chek bilan bir xil manbadan olinadi (sessionStorage `chek_${id}` + URL param).

interface SotuvSavatRow { Savat_ID: string; Sotuv_ID: string; Mahsulot_ID: string; Soni: string; Som_Narx: string; Summa_som: string; Izoh?: string; }
interface SotuvSavatDollarRow { Savat_ID: string; Sotuv_ID: string; Mahsulot_ID: string; Soni: string; Narx: string; Summa: string; Izoh?: string; }
interface Mahsulot { Mahsulot_ID: string; Nomi: string; }

function num(v: string|number|undefined) { return parseFloat(String(v||"0").replace(/\s/g,"").replace(",",".")) || 0; }
function fmtSom(v: number) { return v.toLocaleString("ru-RU"); }
function fmtUsd(v: number) { return "$" + v.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2}); }

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
  const showSomBal    = hasSom    || totalSom !== 0    || tolovSom !== 0    || thisSom !== 0;
  const showDollarBal = hasDollar || totalDollar !== 0 || tolovDollar !== 0 || thisDollar !== 0;
  const yakuniySom = totalSom + thisSom - tolovSom;
  const yakuniyUsd = totalDollar + thisDollar - tolovDollar;

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        .pos-screen { min-height: 100vh; background: #e9edf5; padding: 12px; display: flex; flex-direction: column; align-items: center; }
        .pos-bar { position: sticky; top: 0; z-index: 10; display: flex; gap: 8px; width: 100%; max-width: 340px; margin-bottom: 12px; }
        .pos-btn { flex: 1; padding: 12px 10px; border-radius: 10px; border: none; font-size: 14px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; }
        .pos-btn--print { background: #16a34a; color: #fff; }
        .pos-btn--print:disabled { background: #9ca3af; }
        .pos-btn--back { background: #fff; color: #334155; border: 1px solid #cbd5e1; flex: 0 0 auto; padding: 12px 16px; }

        /* Chek — ekranda ~76mm kenglik (telefonda o'qish uchun) */
        .receipt {
          width: 302px; background: #fff; color: #000;
          padding: 10px 12px 16px; font-family: 'Arial', sans-serif;
          box-shadow: 0 4px 18px rgba(0,0,0,.12);
        }
        .r-center { text-align: center; }
        .r-logo { font-size: 19px; font-weight: 900; letter-spacing: 1px; }
        .r-sub { font-size: 11px; font-weight: 700; margin-top: 1px; }
        .r-hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
        .r-info { font-size: 12px; font-weight: 700; line-height: 1.55; }
        .r-info b { font-weight: 900; }
        .r-sec { font-size: 11px; font-weight: 900; letter-spacing: .5px; margin-bottom: 4px; }
        .r-item { margin-bottom: 5px; }
        .r-item-name { font-size: 12.5px; font-weight: 800; }
        .r-item-line { display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; }
        .r-jami { display: flex; justify-content: space-between; font-size: 13px; font-weight: 900; margin-top: 3px; }
        .r-bal { display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; line-height: 1.7; }
        .r-bal--total { font-size: 13.5px; font-weight: 900; }
        .r-foot { font-size: 11px; font-weight: 700; margin-top: 8px; }

        @media print {
          @page { size: 80mm auto; margin: 0; }
          html, body { width: 80mm; margin: 0 !important; padding: 0 !important; background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .pos-screen { min-height: auto; background: #fff; padding: 0; display: block; }
          .pos-bar { display: none !important; }
          .receipt { width: 72mm; box-shadow: none; padding: 0 2mm; margin: 0 auto; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="pos-screen">
        <div className="pos-bar">
          <button className="pos-btn--back pos-btn" onClick={()=>router.back()}>←</button>
          <button className="pos-btn pos-btn--print" disabled={!rowsReady} onClick={()=>{ if(rowsReady) window.print(); }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M17 17H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2zm-1-12v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2m-3 5h12"/></svg>
            {rowsReady ? "Chop etish (80mm)" : "Yuklanmoqda..."}
          </button>
        </div>

        <div className="receipt">
          <div className="r-center">
            <div className="r-logo">MUSAFFO TEA</div>
            <div className="r-sub">SOTUV CHEKI</div>
          </div>
          <hr className="r-hr"/>
          <div className="r-info">
            <div>Sana: <b>{sana||"—"}</b></div>
            <div>Mijoz: <b>{mijozIsm||"—"}</b></div>
            {agentNomi && <div>Agent: <b>{agentNomi}</b></div>}
            {mijozTel && <div>Tel: <b>{mijozTel}</b></div>}
          </div>
          <hr className="r-hr"/>

          {!rowsReady ? (
            <div className="r-center" style={{fontSize:12,color:"#555",padding:"8px 0"}}>Yuklanmoqda...</div>
          ) : (
            <>
              {hasSom && (
                <>
                  <div className="r-sec">MAHSULOTLAR (SO&apos;M)</div>
                  {savatSom.map((r,i)=>(
                    <div className="r-item" key={r.Savat_ID||i}>
                      <div className="r-item-name">{mMap[r.Mahsulot_ID]?.Nomi||r.Mahsulot_ID}</div>
                      <div className="r-item-line">
                        <span>{num(r.Soni).toFixed(1)} × {fmtSom(num(r.Som_Narx))}</span>
                        <span>{fmtSom(num(r.Summa_som))}</span>
                      </div>
                    </div>
                  ))}
                  <div className="r-jami"><span>JAMI so&apos;m</span><span>{fmtSom(thisSom)}</span></div>
                  <hr className="r-hr"/>
                </>
              )}

              {hasDollar && (
                <>
                  <div className="r-sec">MAHSULOTLAR ($)</div>
                  {savatDollar.map((r,i)=>(
                    <div className="r-item" key={r.Savat_ID||i}>
                      <div className="r-item-name">{mMap[r.Mahsulot_ID]?.Nomi||r.Mahsulot_ID}</div>
                      <div className="r-item-line">
                        <span>{num(r.Soni).toFixed(1)} × {fmtUsd(num(r.Narx))}</span>
                        <span>{fmtUsd(num(r.Summa))}</span>
                      </div>
                    </div>
                  ))}
                  <div className="r-jami"><span>JAMI $</span><span>{fmtUsd(thisDollar)}</span></div>
                  <hr className="r-hr"/>
                </>
              )}

              <div className="r-sec">BALANS</div>
              {showSomBal && (
                <>
                  <div className="r-bal"><span>Eski qarz</span><span>{fmtSom(totalSom)}</span></div>
                  <div className="r-bal"><span>Olingan tovar</span><span>{fmtSom(thisSom)}</span></div>
                  {tolovSom>0 && <div className="r-bal"><span>To&apos;lov</span><span>− {fmtSom(tolovSom)}</span></div>}
                  <div className="r-bal r-bal--total"><span>Yakuniy so&apos;m</span><span>{fmtSom(yakuniySom)}</span></div>
                </>
              )}
              {showDollarBal && (
                <>
                  <div className="r-bal" style={{marginTop:showSomBal?6:0}}><span>Eski qarz ($)</span><span>{fmtUsd(totalDollar)}</span></div>
                  <div className="r-bal"><span>Olingan ($)</span><span>{fmtUsd(thisDollar)}</span></div>
                  {tolovDollar>0 && <div className="r-bal"><span>To&apos;lov ($)</span><span>− {fmtUsd(tolovDollar)}</span></div>}
                  <div className="r-bal r-bal--total"><span>Yakuniy $</span><span>{fmtUsd(yakuniyUsd)}</span></div>
                </>
              )}
            </>
          )}

          <hr className="r-hr"/>
          <div className="r-center r-foot">Rahmat! · musaffotea.uz</div>
          <div className="r-center r-foot" style={{marginTop:2}}>{sana}</div>
        </div>
      </div>
    </>
  );
}

export default function SotuvChekPosPage() {
  return (
    <Suspense fallback={<div style={{padding:40,textAlign:"center",fontFamily:"Arial"}}>Yuklanmoqda...</div>}>
      <PosContent />
    </Suspense>
  );
}
