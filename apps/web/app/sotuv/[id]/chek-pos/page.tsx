"use client";
import { fetchSheet, fetchSheetWhere } from "@/lib/sheet-cache";
import { useEffect, useState, useRef, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

// 80mm termal chek (Xprinter M817). Telefon: "Chop etish" -> chek RASM qilinib
// ulashish oynasi ochiladi -> Printlaber (yoki boshqa termal ilova) tanlanadi.
// Rasm tor (80mm nisbatida), oq fon + qora matn — termal printerga toza chiqadi.

interface SotuvSavatRow { Savat_ID: string; Sotuv_ID: string; Mahsulot_ID: string; Soni: string; Som_Narx: string; Summa_som: string; }
interface SotuvSavatDollarRow { Savat_ID: string; Sotuv_ID: string; Mahsulot_ID: string; Soni: string; Narx: string; Summa: string; }
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
  const showSomBal    = hasSom    || totalSom !== 0    || tolovSom !== 0    || thisSom !== 0;
  const showDollarBal = hasDollar || totalDollar !== 0 || tolovDollar !== 0 || thisDollar !== 0;
  const yakuniySom = totalSom + thisSom - tolovSom;
  const yakuniyUsd = totalDollar + thisDollar - tolovDollar;

  // Chekni tor (80mm) RASM qilib qaytaradi — termal printer ilovasiga toza chiqishi uchun
  async function buildImage(): Promise<Blob | null> {
    if (!chekRef.current) return null;
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(chekRef.current, {
      scale: 2, backgroundColor: "#ffffff", useCORS: true,
    });
    return await new Promise((res) => canvas.toBlob((b) => res(b), "image/png"));
  }

  // Telefon: ulashish oynasi (Printlaber/termal ilova). Kompyuter: yuklab olish/print.
  async function printOrShare() {
    if (!rowsReady) return;
    setBusy(true);
    try {
      const blob = await buildImage();
      if (!blob) { window.print(); return; }
      const file = new File([blob], `chek-${id}.png`, { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
      const isMob = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
      if (isMob && nav.canShare && nav.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: `Chek — Musaffo Tea` }); return; }
        catch (e) { if (e instanceof Error && e.name === "AbortError") return; }
      }
      // Kompyuter (yoki share bo'lmasa): rasmni yangi oynada ochamiz — chop etish/saqlash uchun
      const url = URL.createObjectURL(blob);
      const w = window.open(url, "_blank");
      if (!w) { const a=document.createElement("a"); a.href=url; a.download=`chek-${id}.png`; a.click(); }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      window.print();
    } finally { setBusy(false); }
  }

  const it: React.CSSProperties = { fontSize: 13, fontWeight: 700, lineHeight: 1.5 };
  const hr = <div style={{ borderTop: "1px dashed #000", margin: "7px 0" }} />;

  return (
    <div style={{ minHeight: "100vh", background: "#e9edf5", padding: 12, display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* Boshqaruv (rasmga tushmaydi) */}
      <div style={{ display: "flex", gap: 8, width: "100%", maxWidth: 360, marginBottom: 12 }}>
        <button onClick={()=>router.back()} style={{ flex: "0 0 auto", padding: "12px 16px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", color: "#334155", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>←</button>
        <button onClick={printOrShare} disabled={!rowsReady || busy}
          style={{ flex: 1, padding: "12px 10px", borderRadius: 10, border: "none", background: (!rowsReady||busy) ? "#9ca3af" : "#16a34a", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
          <svg width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M17 17H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2zm-1-12v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2m-3 5h12"/></svg>
          {busy ? "Tayyorlanmoqda..." : rowsReady ? "Chop etish / Ulashish" : "Yuklanmoqda..."}
        </button>
      </div>

      {/* CHEK — tor (80mm), oq fon + qora matn */}
      <div ref={chekRef} style={{ width: 360, background: "#fff", color: "#000", padding: "14px 16px 18px", fontFamily: "Arial, sans-serif", boxShadow: "0 4px 18px rgba(0,0,0,.12)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 1 }}>MUSAFFO TEA</div>
          <div style={{ fontSize: 12, fontWeight: 800, marginTop: 1 }}>SOTUV CHEKI</div>
        </div>
        {hr}
        <div style={it}>
          <div>Sana: <b>{sana||"—"}</b></div>
          <div>Mijoz: <b>{mijozIsm||"—"}</b></div>
          {agentNomi && <div>Agent: <b>{agentNomi}</b></div>}
          {mijozTel && <div>Tel: <b>{mijozTel}</b></div>}
        </div>
        {hr}

        {!rowsReady ? (
          <div style={{ textAlign: "center", fontSize: 13, padding: "8px 0" }}>Yuklanmoqda...</div>
        ) : (
          <>
            {hasSom && (
              <>
                <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 4 }}>MAHSULOTLAR (SO&apos;M)</div>
                {savatSom.map((r,i)=>(
                  <div key={r.Savat_ID||i} style={{ marginBottom: 5 }}>
                    <div style={{ fontSize: 13, fontWeight: 800 }}>{mMap[r.Mahsulot_ID]?.Nomi||r.Mahsulot_ID}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}>
                      <span>{num(r.Soni).toFixed(1)} × {fmtSom(num(r.Som_Narx))}</span>
                      <span>{fmtSom(num(r.Summa_som))}</span>
                    </div>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 900, marginTop: 3 }}>
                  <span>JAMI so&apos;m</span><span>{fmtSom(thisSom)}</span>
                </div>
                {hr}
              </>
            )}

            {hasDollar && (
              <>
                <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 4 }}>MAHSULOTLAR ($)</div>
                {savatDollar.map((r,i)=>(
                  <div key={r.Savat_ID||i} style={{ marginBottom: 5 }}>
                    <div style={{ fontSize: 13, fontWeight: 800 }}>{mMap[r.Mahsulot_ID]?.Nomi||r.Mahsulot_ID}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}>
                      <span>{num(r.Soni).toFixed(1)} × {fmtUsd(num(r.Narx))}</span>
                      <span>{fmtUsd(num(r.Summa))}</span>
                    </div>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 900, marginTop: 3 }}>
                  <span>JAMI $</span><span>{fmtUsd(thisDollar)}</span>
                </div>
                {hr}
              </>
            )}

            {showSomBal && (
              <>
                <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 4 }}>BALANS (SO&apos;M)</div>
                <div style={{ display: "flex", justifyContent: "space-between", ...it }}><span>Eski qarz</span><span>{fmtSom(totalSom)}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", ...it }}><span>Olingan tovar</span><span>{fmtSom(thisSom)}</span></div>
                {tolovSom>0 && <div style={{ display: "flex", justifyContent: "space-between", ...it }}><span>To&apos;lov</span><span>− {fmtSom(tolovSom)}</span></div>}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14.5, fontWeight: 900, marginTop: 2 }}><span>YAKUNIY</span><span>{fmtSom(yakuniySom)}</span></div>
                {showDollarBal && hr}
              </>
            )}
            {showDollarBal && (
              <>
                <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 4 }}>BALANS ($)</div>
                <div style={{ display: "flex", justifyContent: "space-between", ...it }}><span>Eski qarz</span><span>{fmtUsd(totalDollar)}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", ...it }}><span>Olingan tovar</span><span>{fmtUsd(thisDollar)}</span></div>
                {tolovDollar>0 && <div style={{ display: "flex", justifyContent: "space-between", ...it }}><span>To&apos;lov</span><span>− {fmtUsd(tolovDollar)}</span></div>}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14.5, fontWeight: 900, marginTop: 2 }}><span>YAKUNIY</span><span>{fmtUsd(yakuniyUsd)}</span></div>
              </>
            )}
          </>
        )}

        {hr}
        <div style={{ textAlign: "center", fontSize: 12, fontWeight: 700 }}>Rahmat! · musaffotea.uz</div>
        <div style={{ textAlign: "center", fontSize: 12, fontWeight: 700, marginTop: 2 }}>{sana}</div>
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
