"use client";
import { fetchSheet, fetchSheetWhere } from "@/lib/sheet-cache";
import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

// 80mm termal chek — oq-qora. window.print() orqali chop etiladi.
// Termal printerga chiqarish uchun "RawBT Print Service" (bepul ilova) tanlanadi.
// Faqat so'm. Ma'lumot A4 "Chek" bilan bir xil.

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

  return (
    <div className="pos-screen" style={{ minHeight: "100vh", background: "#e9edf5", padding: 12, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <style>{`
        @media print {
          @page { size: 80mm auto; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .pos-screen { display: block !important; min-height: 0 !important; background: #fff !important; padding: 0 !important; }
          .chek-body { width: 76mm !important; margin: 0 auto !important; padding: 1mm 2mm !important; }
          .chek-body table th, .chek-body table td { font-size: 8.5px !important; padding: 2px 3px !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>

      <div className="no-print" style={{ display: "flex", gap: 8, width: "100%", maxWidth: 360, marginBottom: 12 }}>
        <button onClick={()=>router.back()} style={{ flex: "0 0 auto", padding: "12px 16px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", color: "#334155", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>←</button>
        <button onClick={()=>{ if(rowsReady) window.print(); }} disabled={!rowsReady}
          style={{ flex: 1, padding: "12px 10px", borderRadius: 10, border: "none", background: !rowsReady ? "#9ca3af" : "#16a34a", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
          <svg width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M17 17H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2zm-1-12v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2m-3 5h12"/></svg>
          {rowsReady ? "Chop etish" : "Yuklanmoqda..."}
        </button>
      </div>

      <div className="chek-body" style={{ width: 360, background: "#fff", color: "#000", padding: "12px 14px 14px", fontFamily: "Arial, sans-serif" }}>
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
