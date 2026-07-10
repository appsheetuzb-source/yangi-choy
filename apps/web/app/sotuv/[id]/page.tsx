"use client";
import { fetchSheet, fetchSheetWhere, afterWrite, appendSheetRows, removeSheetRows, replaceSheetRows } from "@/lib/sheet-cache";
import { getCurrentKurs } from "@/lib/kurs";
import { useAuth } from "@/lib/AuthContext";
import { gaznaForUser } from "@/lib/auth";
import { dokonOmbor, manbaOmbor, omborByAgent, shopWarehouseSet } from "@/lib/ombor-transfer";
import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import LiveClock from "@/components/LiveClock";
import IzohSelect from "@/components/IzohSelect";
import { useIzohOptions } from "@/lib/useIzohOptions";

interface Sotuv {
  Sotuv_ID: string; Yil: string; Oy: string; Sana: string; Status: string;
  Sotuv_Raqami: string; Agent: string; Mijoz_ID: string;
  Balans: string; Balans_dollar: string; Izoh: string; Vaqt: string; Chek?: string;
}
interface SotuvSavatRow {
  Savat_ID: string; Sotuv_ID: string; Mahsulot_ID: string;
  Soni: string; Som_Narx: string; Summa_som: string; Kurs: string; Ombor_ID: string; Check: string; Izoh?: string; Vaqt?: string;
}
interface SotuvSavatDollarRow {
  Savat_ID: string; Sotuv_ID: string; Mahsulot_ID: string;
  Soni: string; Narx: string; Summa: string; Kurs: string; Ombor_ID: string; Check: string; Izoh?: string; Vaqt?: string;
}
interface Foydalanuvchi { Foydalanuvchi_ID: string; Nomi: string; Ombor_ID?: string; }
interface Mijoz { Mijoz_ID: string; Ism: string; Telefon: string; Agent?: string; Dokon_Ombor_ID?: string; Boshlangich_Balans_som?: string; Boshlangich_Balans_dollar?: string; }
interface Mahsulot { Mahsulot_ID: string; Nomi: string; Ombor_ID: string; Sotuv_dollar: string; Sotuv_som: string; Tan_som?: string; Tan_dollar?: string; }
interface SavatItem { id: string; Mahsulot_ID: string; Soni: string; Som_Narx: string; Narx: string; valyuta: "som"|"dollar"; Izoh?: string; }
interface AddRow { id: string; Mahsulot_ID: string; Soni: string; Narx: string; Izoh: string; }
interface Gazna { Gazna_ID: string; Nomi: string; Turi: string; }
interface STolov {
  Tolov_ID: string; Sotuv_ID: string; Mijoz_ID: string; Agent: string;
  Yil: string; Oy: string; Sana: string; Valyuta: string; Turi: string;
  Som: string; Dollar: string; Summa: string; Summa_dollar: string;
  Izoh: string; Dollar_Kursi: string; Vaqt: string; Check?: string;
  Gazna_ID?: string; Gazna_dollar_ID?: string;
}

const TURI_LIST = ["Naqd","Bank","Karta"];

function uid() { return Math.random().toString(36).slice(2, 10); }
function nowStr() {
  const d=new Date();
  const t=new Date(d.toLocaleString("en-US",{timeZone:"Asia/Tashkent"}));
  const pad=(n:number)=>String(n).padStart(2,"0");
  const dd=pad(t.getDate()),mm=pad(t.getMonth()+1),yy=String(t.getFullYear());
  const hh=pad(t.getHours()),mi=pad(t.getMinutes()),ss=pad(t.getSeconds());
  return {sana:`${dd}.${mm}.${yy}`,oy:String(t.getMonth()+1),yil:yy,vaqt:`${hh}:${mi}:${ss}`};
}
function isoToParts(iso:string){ const [y,m,d]=(iso||"").split("-"); return { sana: d+"."+m+"."+y, oy:String(parseInt(m||"1")), yil:y||"" }; }
function sanaToIso(sana:string){ const mm=(sana||"").match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/); return mm ? (mm[3]+"-"+mm[2].padStart(2,"0")+"-"+mm[1].padStart(2,"0")) : ""; }
function num(v: string|number|undefined) { return parseFloat(String(v||"0").replace(/\s/g,"").replace(",",".")) || 0; }
function fmt(v: string|number|undefined) { const n=num(v); return n?n.toLocaleString("ru-RU"):"0"; }
function fmtSom(v: string|number|undefined) { const n=num(v); return n?n.toLocaleString("ru-RU")+" so'm":"—"; }
function fmtUsd(v: string|number|undefined) { const n=num(v); return n?"$"+n.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:4}):"—"; }

function SearchSelect({ items, value, onChange, placeholder, compact }: {
  items:{id:string;label:string}[]; value:string; onChange:(id:string)=>void; placeholder?:string; compact?:boolean;
}) {
  const [q,setQ]=useState(""); const [open,setOpen]=useState(false); const ref=useRef<HTMLDivElement>(null);
  const [pos,setPos]=useState<{left:number;width:number;top?:number;bottom?:number;listMaxH:number}|null>(null);
  const selected=items.find(i=>i.id===value);
  const place=()=>{
    const el=ref.current; if(!el) return; const r=el.getBoundingClientRect();
    const vh=window.innerHeight;
    const spaceBelow=vh-r.bottom-8, spaceAbove=r.top-8;
    const up = spaceBelow < 260 && spaceAbove > spaceBelow;
    const avail = up ? spaceAbove : spaceBelow;
    const listMaxH = Math.max(140, Math.min(380, avail - 60));
    if(up) setPos({left:r.left,width:r.width,bottom:vh-r.top+4,listMaxH});
    else setPos({left:r.left,width:r.width,top:r.bottom+4,listMaxH});
  };
  useEffect(()=>{
    if(!open) return;
    const h=(e:MouseEvent)=>{ if(ref.current&&!ref.current.contains(e.target as Node)) setOpen(false); };
    const re=()=>place();
    document.addEventListener("mousedown",h);
    window.addEventListener("resize",re); window.addEventListener("scroll",re,true);
    return ()=>{ document.removeEventListener("mousedown",h); window.removeEventListener("resize",re); window.removeEventListener("scroll",re,true); };
  },[open]);
  const list=items.filter(i=>i.label.toLowerCase().includes(q.toLowerCase())).slice(0,60);
  return (
    <div ref={ref} style={{position:"relative"}}>
      <div onClick={()=>{ if(!open) place(); setOpen(o=>!o); setQ(""); }} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:compact?"9px 8px":"10px 14px",background:"var(--bg)",border:"1px solid var(--border)",borderRadius:"var(--radius)",cursor:"pointer",fontSize:compact?13:14,color:selected?"var(--text)":"var(--text-3)"}}>
        <span style={{flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{selected?selected.label:placeholder||"Tanlang..."}</span>
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{flexShrink:0,marginLeft:6,transform:open?"rotate(180deg)":"none",transition:"transform .15s"}}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
      </div>
      {open&&pos&&(
        <div style={{position:"fixed",top:pos.top,bottom:pos.bottom,left:pos.left,width:pos.width,zIndex:1000,background:"var(--white)",border:"1px solid var(--border)",borderRadius:"var(--radius)",boxShadow:"var(--shadow)",overflow:"hidden"}}>
          <div style={{padding:"10px",borderBottom:"1px solid var(--border)"}}><input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Qidirish..." style={{width:"100%",padding:"10px 12px",border:"1px solid var(--border)",borderRadius:8,fontSize:14.5,outline:"none"}}/></div>
          <div style={{maxHeight:pos.listMaxH,overflowY:"auto",overscrollBehavior:"contain"}} onTouchMove={e=>e.stopPropagation()}>
            {list.length===0?<div style={{padding:"14px 16px",fontSize:14,color:"var(--text-3)"}}>Topilmadi</div>
              :list.map(i=>(
                <div key={i.id} onClick={()=>{onChange(i.id);setOpen(false);setQ("");}}
                  style={{padding:"12px 16px",fontSize:14.5,cursor:"pointer",fontWeight:i.id===value?700:500,background:i.id===value?"var(--bg)":"transparent",color:i.id===value?"var(--primary)":"var(--text)"}}
                  onMouseEnter={e=>(e.currentTarget.style.background="var(--bg)")}
                  onMouseLeave={e=>(e.currentTarget.style.background=i.id===value?"var(--bg)":"transparent")}>
                  {i.label}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function isBelowCost(s:SavatItem,kurs:string,mMap:Record<string,Mahsulot>):boolean {
  if(!s.Mahsulot_ID) return false;
  const m=mMap[s.Mahsulot_ID]; if(!m) return false;
  if(s.valyuta==="som"){
    const narx=num(s.Som_Narx);
    const tanSom=num(m.Tan_som||"0"); const tanDollar=num(m.Tan_dollar||"0");
    const minNarx=tanSom!==0?tanSom:tanDollar*num(kurs);
    if(narx<=0) return minNarx>0;
    return minNarx>0&&narx<minNarx;
  } else {
    const narx=num(s.Narx);
    const tanDollar=num(m.Tan_dollar||"0");
    if(narx<=0) return tanDollar>0;
    return tanDollar>0&&narx<tanDollar;
  }
}

function SavatEditor({items,onUpdate,onRemove,onAddSom,onAddDollar,jamiS,jamiD,kursVal,isMobile,somItems,dollarItems,mMap,simple}:{
  items:SavatItem[]; onUpdate:(id:string,f:keyof SavatItem,v:string)=>void;
  onRemove:(id:string)=>void; onAddSom:()=>void; onAddDollar:()=>void; jamiS:number; jamiD:number;
  kursVal:string; isMobile:boolean;
  somItems:{id:string;label:string}[]; dollarItems:{id:string;label:string}[]; mMap:Record<string,Mahsulot>;
  simple?:boolean;
}) {
  const somRows    = items.filter(i=>i.valyuta==="som");
  const dollarRows = items.filter(i=>i.valyuta==="dollar");
  return (
    <div>
      {/* So'm section */}
      {(!simple||somRows.length>0)&&(
      <div style={{marginBottom:16}}>
        <span style={{fontSize:11,fontWeight:700,color:"#16a34a",letterSpacing:".05em",display:"block",marginBottom:8}}>SO&apos;M SAVAT</span>
        {!isMobile&&somRows.length>0&&(
          <div style={{display:"grid",gridTemplateColumns:"3fr 90px 130px 110px 1fr 36px",gap:8,padding:"6px 0",marginBottom:4}}>
            {["MAHSULOT","MIQDOR","NARX (so'm)","JAMI","IZOH",""].map(h=>(
              <span key={h} style={{fontSize:10,fontWeight:700,color:"var(--text-3)",letterSpacing:".04em"}}>{h}</span>
            ))}
          </div>
        )}
        {somRows.map(s=>{
          const jS=num(s.Soni)*num(s.Som_Narx);
          const bc=isBelowCost(s,kursVal,mMap);
          if(isMobile) return (
            <div key={s.id} style={{background:"#f0fdf4",borderRadius:"var(--radius)",padding:"10px 12px",marginBottom:8,border:bc?"1px solid #ef4444":undefined}}>
              <div style={{marginBottom:6}}>
                <SearchSelect items={somItems} value={s.Mahsulot_ID} onChange={v=>onUpdate(s.id,"Mahsulot_ID",v)} placeholder="Mahsulot..."/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:simple?"1fr":"1fr 1fr",gap:6}}>
                <input value={s.Soni} onChange={e=>onUpdate(s.id,"Soni",e.target.value)} placeholder="Miqdor" type="number"
                  style={{width:"100%",minWidth:0,boxSizing:"border-box",padding:"8px",border:"1px solid #bbf7d0",borderRadius:"var(--radius)",fontSize:13,fontWeight:600,outline:"none",textAlign:"center"}}/>
                <input value={s.Som_Narx} onChange={e=>onUpdate(s.id,"Som_Narx",e.target.value)} placeholder="Narx (so'm)" inputMode="decimal"
                  style={{width:"100%",minWidth:0,boxSizing:"border-box",padding:"8px",border:`1px solid ${bc?"#ef4444":"#bbf7d0"}`,borderRadius:"var(--radius)",fontSize:13,fontWeight:600,outline:"none",textAlign:"center"}}/>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gridColumn:"1/-1"}}>
                  <span style={{fontSize:13,fontWeight:700,color:bc?"#ef4444":"#16a34a"}}>{simple?<span style={{color:"var(--text-3)",fontWeight:600}}>Summa: </span>:null}{bc?"Tan narxidan past!":(jS?jS.toLocaleString("ru-RU")+" so'm":"—")}</span>
                  <button onClick={()=>onRemove(s.id)} style={{width:28,height:28,borderRadius:6,border:"none",background:"#fee2e2",color:"#ef4444",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700}}>−</button>
                </div>
              </div>
              <input value={s.Izoh||""} onChange={e=>onUpdate(s.id,"Izoh",e.target.value)} placeholder="Izoh (ixtiyoriy)" style={{width:"100%",marginTop:6,padding:"8px",border:"1px solid #bbf7d0",borderRadius:"var(--radius)",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
            </div>
          );
          return (
            <div key={s.id} style={{display:"grid",gridTemplateColumns:"3fr 90px 130px 110px 1fr 36px",gap:8,alignItems:"center",marginBottom:8}}>
              <SearchSelect items={somItems} value={s.Mahsulot_ID} onChange={v=>onUpdate(s.id,"Mahsulot_ID",v)} placeholder="Mahsulot..."/>
              <input value={s.Soni} onChange={e=>onUpdate(s.id,"Soni",e.target.value)} placeholder="Miqdor" type="number"
                style={{padding:"10px",border:"1px solid #bbf7d0",borderRadius:"var(--radius)",fontSize:13,fontWeight:600,outline:"none",textAlign:"center"}}/>
              <input value={s.Som_Narx} onChange={e=>onUpdate(s.id,"Som_Narx",e.target.value)} placeholder="Narx (so'm)" inputMode="decimal"
                style={{padding:"10px",border:`1px solid ${bc?"#ef4444":"#bbf7d0"}`,borderRadius:"var(--radius)",fontSize:13,fontWeight:600,outline:"none",textAlign:"center"}}/>
              <div style={{padding:"10px",background:bc?"#fef2f2":"#f0fdf4",borderRadius:"var(--radius)",fontSize:13,fontWeight:700,textAlign:"right",color:bc?"#ef4444":"#16a34a"}}>
                {bc?"Tan narxidan past!":(num(s.Soni)!==0?(jS?jS.toLocaleString("ru-RU")+" so'm":"—"):"—")}
              </div>
              <input value={s.Izoh||""} onChange={e=>onUpdate(s.id,"Izoh",e.target.value)} placeholder="Izoh"
                style={{padding:"10px",border:"1px solid var(--border)",borderRadius:"var(--radius)",fontSize:13,outline:"none",minWidth:0}}/>
              <button onClick={()=>onRemove(s.id)} style={{width:36,height:40,borderRadius:8,border:"none",background:"#fee2e2",color:"#ef4444",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:20,fontWeight:700}}>−</button>
            </div>
          );
        })}
        {!simple&&(
        <button onClick={onAddSom} style={{display:"flex",alignItems:"center",gap:4,padding:"8px 14px",border:"1px solid #bbf7d0",borderRadius:8,fontSize:13,fontWeight:600,background:"#f0fdf4",cursor:"pointer",color:"#16a34a",marginTop:4,width:isMobile?"100%":undefined,justifyContent:"center"}}>
          <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg> So&apos;m mahsulot
        </button>
        )}
      </div>
      )}

      {/* Dollar section */}
      {(!simple||dollarRows.length>0)&&(
      <div style={{marginBottom:8}}>
        <span style={{fontSize:11,fontWeight:700,color:"#2563eb",letterSpacing:".05em",display:"block",marginBottom:8}}>DOLLAR SAVAT</span>
        {!isMobile&&dollarRows.length>0&&(
          <div style={{display:"grid",gridTemplateColumns:"3fr 90px 130px 110px 1fr 36px",gap:8,padding:"6px 0",marginBottom:4}}>
            {["MAHSULOT","MIQDOR","NARX ($)","JAMI","IZOH",""].map(h=>(
              <span key={h} style={{fontSize:10,fontWeight:700,color:"var(--text-3)",letterSpacing:".04em"}}>{h}</span>
            ))}
          </div>
        )}
        {dollarRows.map(s=>{
          const jU=num(s.Soni)*num(s.Narx);
          const bc=isBelowCost(s,kursVal,mMap);
          if(isMobile) return (
            <div key={s.id} style={{background:"#eff6ff",borderRadius:"var(--radius)",padding:"10px 12px",marginBottom:8,border:bc?"1px solid #ef4444":undefined}}>
              <div style={{marginBottom:6}}>
                <SearchSelect items={dollarItems} value={s.Mahsulot_ID} onChange={v=>onUpdate(s.id,"Mahsulot_ID",v)} placeholder="Mahsulot..."/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:simple?"1fr":"1fr 1fr",gap:6}}>
                <input value={s.Soni} onChange={e=>onUpdate(s.id,"Soni",e.target.value)} placeholder="Miqdor" type="number"
                  style={{width:"100%",minWidth:0,boxSizing:"border-box",padding:"8px",border:"1px solid #bfdbfe",borderRadius:"var(--radius)",fontSize:13,fontWeight:600,outline:"none",textAlign:"center"}}/>
                <input value={s.Narx} onChange={e=>onUpdate(s.id,"Narx",e.target.value)} placeholder="Narx ($)" inputMode="decimal"
                  style={{width:"100%",minWidth:0,boxSizing:"border-box",padding:"8px",border:`1px solid ${bc?"#ef4444":"#bfdbfe"}`,borderRadius:"var(--radius)",fontSize:13,fontWeight:600,outline:"none",textAlign:"center",color:bc?"#ef4444":"#2563eb"}}/>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gridColumn:"1/-1"}}>
                  <span style={{fontSize:13,fontWeight:700,color:bc?"#ef4444":"#2563eb"}}>{simple?<span style={{color:"var(--text-3)",fontWeight:600}}>Summa: </span>:null}{bc?"Tan narxidan past!":(jU?fmtUsd(jU):"—")}</span>
                  <button onClick={()=>onRemove(s.id)} style={{width:28,height:28,borderRadius:6,border:"none",background:"#fee2e2",color:"#ef4444",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700}}>−</button>
                </div>
              </div>
              <input value={s.Izoh||""} onChange={e=>onUpdate(s.id,"Izoh",e.target.value)} placeholder="Izoh (ixtiyoriy)" style={{width:"100%",marginTop:6,padding:"8px",border:"1px solid #bfdbfe",borderRadius:"var(--radius)",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
            </div>
          );
          return (
            <div key={s.id} style={{display:"grid",gridTemplateColumns:"3fr 90px 130px 110px 1fr 36px",gap:8,alignItems:"center",marginBottom:8}}>
              <SearchSelect items={dollarItems} value={s.Mahsulot_ID} onChange={v=>onUpdate(s.id,"Mahsulot_ID",v)} placeholder="Mahsulot..."/>
              <input value={s.Soni} onChange={e=>onUpdate(s.id,"Soni",e.target.value)} placeholder="Miqdor" type="number"
                style={{padding:"10px",border:"1px solid #bfdbfe",borderRadius:"var(--radius)",fontSize:13,fontWeight:600,outline:"none",textAlign:"center"}}/>
              <input value={s.Narx} onChange={e=>onUpdate(s.id,"Narx",e.target.value)} placeholder="Narx ($)" inputMode="decimal"
                style={{padding:"10px",border:`1px solid ${bc?"#ef4444":"#bfdbfe"}`,borderRadius:"var(--radius)",fontSize:13,fontWeight:600,outline:"none",textAlign:"center",color:bc?"#ef4444":"#2563eb"}}/>
              <div style={{padding:"10px",background:bc?"#fef2f2":"#eff6ff",borderRadius:"var(--radius)",fontSize:13,fontWeight:700,textAlign:"right",color:bc?"#ef4444":"#2563eb"}}>
                {bc?"Tan narxidan past!":(num(s.Soni)!==0?(jU?fmtUsd(jU):"—"):"—")}
              </div>
              <input value={s.Izoh||""} onChange={e=>onUpdate(s.id,"Izoh",e.target.value)} placeholder="Izoh"
                style={{padding:"10px",border:"1px solid var(--border)",borderRadius:"var(--radius)",fontSize:13,outline:"none",minWidth:0}}/>
              <button onClick={()=>onRemove(s.id)} style={{width:36,height:40,borderRadius:8,border:"none",background:"#fee2e2",color:"#ef4444",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:20,fontWeight:700}}>−</button>
            </div>
          );
        })}
        {!simple&&(
        <button onClick={onAddDollar} style={{display:"flex",alignItems:"center",gap:4,padding:"8px 14px",border:"1px solid #bfdbfe",borderRadius:8,fontSize:13,fontWeight:600,background:"#eff6ff",cursor:"pointer",color:"#2563eb",marginTop:4,width:isMobile?"100%":undefined,justifyContent:"center"}}>
          <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg> Dollar mahsulot
        </button>
        )}
      </div>
      )}

      {(jamiS>0||jamiD>0)&&(
        <div style={{marginTop:8,background:"var(--bg)",borderRadius:"var(--radius)",overflow:"hidden"}}>
          <div style={{display:"flex",justifyContent:"flex-end",gap:16,padding:"10px 14px"}}>
            <span style={{fontSize:12,fontWeight:600,color:"var(--text-3)"}}>Jami:</span>
            {jamiS>0&&<span style={{fontSize:14,fontWeight:700,color:"#16a34a"}}>{fmtSom(jamiS)}</span>}
            {jamiD>0&&<span style={{fontSize:14,fontWeight:700,color:"#2563eb"}}>{fmtUsd(jamiD)}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SotuvDetailPage() {
  const { id } = useParams<{id:string}>();
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.lavozim === "Admin";

  const [sotuv, setSotuv]             = useState<Sotuv|null>(null);
  const [savatSom, setSavatSom]       = useState<SotuvSavatRow[]>([]);
  const [savatDollar, setSavatDollar] = useState<SotuvSavatDollarRow[]>([]);
  const [savatSearch, setSavatSearch] = useState("");
  const [agentlar, setAgentlar]       = useState<Foydalanuvchi[]>([]);
  const [aMap, setAMap]               = useState<Record<string,string>>({});
  const [mijozlar, setMijozlar]       = useState<Mijoz[]>([]);
  const [mahsulotlar, setMahsulotlar] = useState<Mahsulot[]>([]);
  const [mMap, setMMap]               = useState<Record<string,Mahsulot>>({});
  const [loading, setLoading]         = useState(true);

  // S_tolov
  const [stolovlar, setStolovlar]             = useState<STolov[]>([]);
  const [addTolovOpen, setAddTolovOpen]       = useState(false);
  const [addTolovValyuta, setAddTolovValyuta] = useState<"Som"|"Dollar">("Som");
  const [addTolovTuri, setAddTolovTuri]       = useState("Naqd");
  const [addTolovSom, setAddTolovSom]         = useState("");
  const [addTolovDollar, setAddTolovDollar]   = useState("");
  const [addTolovKurs, setAddTolovKurs]       = useState("");
  const [addTolovIzoh, setAddTolovIzoh]       = useState("");
  const [addTolovSaving, setAddTolovSaving]   = useState(false);
  const [addTolovGazna, setAddTolovGazna]     = useState("");
  const [addTolovGaznaDollar, setAddTolovGaznaDollar] = useState("");
  const [addTolovSana, setAddTolovSana]       = useState(()=>sanaToIso(nowStr().sana));
  const [editTolov, setEditTolov]             = useState<STolov|null>(null);
  const [editTolovValyuta, setEditTolovValyuta] = useState<"Som"|"Dollar">("Som");
  const [editTolovTuri, setEditTolovTuri]     = useState("Naqd");
  const [editTolovSom, setEditTolovSom]       = useState("");
  const [editTolovDollar, setEditTolovDollar] = useState("");
  const [editTolovKurs, setEditTolovKurs]     = useState("");
  const [editTolovIzoh, setEditTolovIzoh]     = useState("");
  const [editTolovGazna, setEditTolovGazna]   = useState("");
  const [editTolovGaznaDollar, setEditTolovGaznaDollar] = useState("");
  const [editTolovSana, setEditTolovSana]     = useState("");
  const [editTolovVaqt, setEditTolovVaqt]     = useState("");
  const [editTolovSaving, setEditTolovSaving] = useState(false);
  const [gaznalar, setGaznalar]               = useState<Gazna[]>([]);
  const [deleteTolov, setDeleteTolov]         = useState<STolov|null>(null);
  const [deletingTolov, setDeletingTolov]     = useState(false);
  const [togglingId, setTogglingId]           = useState<string|null>(null);
  const [mijozQarzSom, setMijozQarzSom]       = useState(0);
  const [mijozQarzDollar, setMijozQarzDollar] = useState(0);

  // Edit drawer
  const [editOpen, setEditOpen]           = useState(false);
  const [editMijoz, setEditMijoz]         = useState("");
  const [editAgent, setEditAgent]         = useState("");
  const [editIzoh, setEditIzoh]           = useState("");
  const [editItems, setEditItems] = useState<SavatItem[]>([]);
  const [editKurs, setEditKurs]           = useState("");
  const [editSana, setEditSana]           = useState("");
  const [editSaving, setEditSaving]       = useState(false);
  const [isAddMode, setIsAddMode]         = useState(false);

  // Inline edit for savat rows
  const [editSomRow, setEditSomRow]           = useState<SotuvSavatRow|null>(null);
  const [editSomMahsulot, setEditSomMahsulot] = useState("");
  const [editSomSoni, setEditSomSoni]         = useState("");
  const [editSomNarx, setEditSomNarx]         = useState("");
  const [editSomIzoh, setEditSomIzoh]         = useState("");
  const [editSomSaving, setEditSomSaving]     = useState(false);
  const [editDollarRow, setEditDollarRow]     = useState<SotuvSavatDollarRow|null>(null);
  const [editDollarMahsulot, setEditDollarMahsulot] = useState("");
  const [editDollarSoni, setEditDollarSoni]   = useState("");
  const [editDollarNarx, setEditDollarNarx]   = useState("");
  const [editDollarIzoh, setEditDollarIzoh]   = useState("");
  const [editDollarSaving, setEditDollarSaving] = useState(false);

  // Ommaviy (bulk) tahrirlash — narx/soni
  const [bulkMode, setBulkMode]   = useState(false);
  const [bulkSel, setBulkSel]     = useState<Set<string>>(new Set());
  const [bulkEdits, setBulkEdits] = useState<Record<string,{Soni:string;Narx:string;Mahsulot?:string}>>({});
  const [bulkSaving, setBulkSaving] = useState(false);

  // Delete confirms
  const [deleteOpen, setDeleteOpen]         = useState(false);
  const [deleting, setDeleting]             = useState(false);
  const [deleteSomRow, setDeleteSomRow]     = useState<SotuvSavatRow|null>(null);
  const [deleteDollarRow, setDeleteDollarRow] = useState<SotuvSavatDollarRow|null>(null);

  const [tasdiqSaving, setTasdiqSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [centralKurs, setCentralKurs] = useState("");
  const izohOptsSotuv = useIzohOptions("Sotuv");
  const izohOptsTolov = useIzohOptions("S_tolov");
  useEffect(() => { const c = () => setIsMobile(window.innerWidth < 768); c(); window.addEventListener("resize", c); return () => window.removeEventListener("resize", c); }, []);
  useEffect(() => { getCurrentKurs().then(setCentralKurs).catch(() => {}); }, []);
  const addSomRef = useRef<HTMLDivElement>(null);
  const addDollarRef = useRef<HTMLDivElement>(null);

  async function toggleTasdiq() {
    if(!sotuv||tasdiqSaving) return;
    // Tasdiqlangan (Chek bo'sh emas) bo'lsa bekor => bo'sh; aks holda tasdiqlash => TRUE
    const newChek = String(sotuv.Chek||"").trim()!=="" ? "" : "TRUE";
    setTasdiqSaving(true);
    setSotuv(s=>s?{...s,Chek:newChek}:s);
    try {
      await fetch("/api/sheets",{method:"PUT",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({sheet:"Sotuv",idColumn:"Sotuv_ID",idValue:sotuv.Sotuv_ID,updates:{Chek:newChek, Status:newChek?"Tasdiqlandi":"Tasdiqlashga"}})});
      afterWrite("Sotuv");
    } finally { setTasdiqSaving(false); }
  }

  // Inline add — bir vaqtda bir nechta qator (har biri to'lganda avtomat saqlanadi)
  const [addSomRows, setAddSomRows]       = useState<AddRow[]>([]);
  const [addDollarRows, setAddDollarRows] = useState<AddRow[]>([]);
  const savingRowIds = useRef<Set<string>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{text:string;ok:boolean}|null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>|null>(null);
  function showToast(text:string, ok:boolean){ setToast({text,ok}); if(toastTimer.current) clearTimeout(toastTimer.current); toastTimer.current=setTimeout(()=>setToast(null), 2400); }
  function addSomBlank(){ setAddSomRows(p=>[...p,{id:uid(),Mahsulot_ID:"",Soni:"",Narx:"",Izoh:""}]); }
  function addDollarBlank(){ setAddDollarRows(p=>[...p,{id:uid(),Mahsulot_ID:"",Soni:"",Narx:"",Izoh:""}]); }
  function updSomRow(id:string,f:keyof AddRow,v:string){ setAddSomRows(p=>p.map(x=>{ if(x.id!==id) return x; const u={...x,[f]:v}; if(f==="Mahsulot_ID"){const m=mMap[v];if(m)u.Narx=m.Sotuv_som||x.Narx;} return u; })); }
  function updDollarRow(id:string,f:keyof AddRow,v:string){ setAddDollarRows(p=>p.map(x=>{ if(x.id!==id) return x; const u={...x,[f]:v}; if(f==="Mahsulot_ID"){const m=mMap[v];if(m)u.Narx=m.Sotuv_dollar||x.Narx;} return u; })); }
  function rmSomRow(id:string){ setAddSomRows(p=>p.filter(x=>x.id!==id)); }
  function rmDollarRow(id:string){ setAddDollarRows(p=>p.filter(x=>x.id!==id)); }
  useEffect(() => { if (addSomRows.length) setTimeout(() => addSomRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 60); }, [addSomRows.length]);
  useEffect(() => { if (addDollarRows.length) setTimeout(() => addDollarRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 60); }, [addDollarRows.length]);
  // To'liq qator (mahsulot+soni+narx) topilsa — debounce bilan avtomat saqlanadi (✓ bosish shart emas)
  useEffect(() => {
    if (bulkMode) return;
    const r = addSomRows.find(x => x.Mahsulot_ID && num(x.Soni)>0 && num(x.Narx)>0 && !savingRowIds.current.has(x.id));
    if (!r) return;
    const t = setTimeout(() => { saveAddRow(r, "som"); }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addSomRows, bulkMode]);
  useEffect(() => {
    if (bulkMode) return;
    const r = addDollarRows.find(x => x.Mahsulot_ID && num(x.Soni)>0 && num(x.Narx)>0 && !savingRowIds.current.has(x.id));
    if (!r) return;
    const t = setTimeout(() => { saveAddRow(r, "dollar"); }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addDollarRows, bulkMode]);

  function loadData() {
    setLoading(true);
    Promise.all([
      fetchSheetWhere("Sotuv", "Sotuv_ID", id),
      fetchSheetWhere("Sotuv_Savat", "Sotuv_ID", id),
      fetchSheetWhere("Sotuv_savat_dollar", "Sotuv_ID", id),
      fetchSheet("Foydalanuvchi"),
      fetchSheet("Mijozlar"),
      fetchSheet("Mahsulot"),
      fetchSheetWhere("S_tolov", "Sotuv_ID", id),
      fetchSheet("Gazna"),
    ]).then(([sR,ssR,sdR,fR,mzR,mhR,stR,gzR])=>{
      const s=(sR.data as Sotuv[])[0]||null;
      setSotuv(s);
      setSavatSom(ssR.data as SotuvSavatRow[]);
      setSavatDollar(sdR.data as SotuvSavatDollarRow[]);
      const fArr=fR.data as Foydalanuvchi[];
      setAgentlar(fArr);
      const am:Record<string,string>={};
      fArr.forEach(f=>{am[f.Foydalanuvchi_ID]=f.Nomi;});
      setAMap(am);
      setMijozlar((mzR.data as Mijoz[]).filter(m=>m.Mijoz_ID));
      const mhArr=(mhR.data as Mahsulot[]).filter(m=>m.Nomi);
      setMahsulotlar(mhArr);
      const mm:Record<string,Mahsulot>={};
      mhArr.forEach(m=>{mm[m.Mahsulot_ID]=m;});
      setMMap(mm);
      const sorted=((stR.data||[]) as STolov[]).sort((a,b)=>{
        const p=(s:string)=>{const [d,mo,y]=(s||"").split(".").map(Number);return (y||0)*10000+(mo||0)*100+(d||0);};
        const t2s=(v:string)=>{const [h,m,s]=(v||"").split(":").map(Number);return (h||0)*3600+(m||0)*60+(s||0);};
        const dd=p(b.Sana)-p(a.Sana); return dd!==0?dd:t2s(b.Vaqt)-t2s(a.Vaqt);
      });
      setStolovlar(sorted);
      setGaznalar(((gzR.data||[]) as Gazna[]).filter(g=>g.Gazna_ID));

      // Dastlab snapshot (darhol ko'rinadi), so'ng JONLI aniq qiymat bilan almashtiriladi
      setMijozQarzSom(num(s?.Balans));
      setMijozQarzDollar(num(s?.Balans_dollar));

      // Mijoz balansi (eski qarz) — JONLI: boshlang'ich + TASDIQLANGAN sotuvlar (shu sotuvdan tashqari)
      // − barcha to'lov (shu sotuvnikidan tashqari). Snapshot o'rniga: har qanday to'lov darhol aks etadi,
      // faqat tasdiqlangan sotuv hisoblanadi. Fonda hisoblanadi (sahifani kechiktirmaydi).
      const mid = String(s?.Mijoz_ID||"").trim();
      if (mid) {
        (async () => {
          try {
            const mjC = (mzR.data as Mijoz[]).find(m=>m.Mijoz_ID===mid);
            const [mSalesR, mTolovR] = await Promise.all([
              fetchSheetWhere("Sotuv", "Mijoz_ID", mid),
              fetchSheetWhere("S_tolov", "Mijoz_ID", mid),
            ]);
            const confIds = (mSalesR.data as Sotuv[])
              .filter(x=>String(x.Chek||"").trim()!=="" && x.Sotuv_ID!==id)
              .map(x=>x.Sotuv_ID);
            let eSom = num(mjC?.Boshlangich_Balans_som), eDol = num(mjC?.Boshlangich_Balans_dollar);
            if (confIds.length) {
              const [csR, cdR] = await Promise.all([
                fetchSheetWhere("Sotuv_Savat", "Sotuv_ID", confIds),
                fetchSheetWhere("Sotuv_savat_dollar", "Sotuv_ID", confIds),
              ]);
              (csR.data as SotuvSavatRow[]).forEach(r=>{ eSom += num(r.Summa_som); });
              (cdR.data as SotuvSavatDollarRow[]).forEach(r=>{ eDol += num(r.Summa); });
            }
            ((mTolovR.data||[]) as STolov[]).forEach(t=>{
              if(t.Sotuv_ID===id) return;
              if(t.Valyuta==="Dollar") eDol -= num(t.Summa_dollar); else eSom -= num(t.Summa);
            });
            setMijozQarzSom(eSom);
            setMijozQarzDollar(eDol);
          } catch { /* xato bo'lsa snapshot qoladi */ }
        })();
      }
    }).finally(()=>setLoading(false));
  }

  useEffect(()=>{ if(id) loadData(); },[id]); // eslint-disable-line

  // Admin emas — so'm/dollar > 0 bo'lsa biriktirilgan gazna avtomatik tanlanadi
  useEffect(()=>{
    if(isAdmin) return;
    const som=gaznaForUser(user,gaznalar).filter(g=>g.Turi!=="Dollar");
    const dol=gaznaForUser(user,gaznalar).filter(g=>g.Turi==="Dollar");
    if(num(addTolovSom)>0 && som.length>0 && !som.some(g=>g.Gazna_ID===addTolovGazna)) setAddTolovGazna(som[0].Gazna_ID);
    if(num(addTolovDollar)>0 && dol.length>0 && !dol.some(g=>g.Gazna_ID===addTolovGaznaDollar)) setAddTolovGaznaDollar(dol[0].Gazna_ID);
    if(num(editTolovSom)>0 && som.length>0 && !som.some(g=>g.Gazna_ID===editTolovGazna)) setEditTolovGazna(som[0].Gazna_ID);
    if(num(editTolovDollar)>0 && dol.length>0 && !dol.some(g=>g.Gazna_ID===editTolovGaznaDollar)) setEditTolovGaznaDollar(dol[0].Gazna_ID);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[addTolovSom,addTolovDollar,editTolovSom,editTolovDollar,addTolovGazna,addTolovGaznaDollar,editTolovGazna,editTolovGaznaDollar,gaznalar,isAdmin,user]);

  async function toggleSomCheck(s:SotuvSavatRow) {
    const newVal=s.Check==="FALSE"?"TRUE":"FALSE";
    setTogglingId(s.Savat_ID);
    try {
      await fetch("/api/sheets",{method:"PUT",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({sheet:"Sotuv_Savat",idColumn:"Savat_ID",idValue:s.Savat_ID,row:{Check:newVal}})});
      afterWrite("Sotuv_Savat");
      setSavatSom(p=>p.map(r=>r.Savat_ID===s.Savat_ID?{...r,Check:newVal}:r));
    } finally { setTogglingId(null); }
  }

  async function toggleDollarCheck(s:SotuvSavatDollarRow) {
    const newVal=s.Check==="FALSE"?"TRUE":"FALSE";
    setTogglingId(s.Savat_ID);
    try {
      await fetch("/api/sheets",{method:"PUT",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({sheet:"Sotuv_savat_dollar",idColumn:"Savat_ID",idValue:s.Savat_ID,row:{Check:newVal}})});
      afterWrite("Sotuv_savat_dollar");
      setSavatDollar(p=>p.map(r=>r.Savat_ID===s.Savat_ID?{...r,Check:newVal}:r));
    } finally { setTogglingId(null); }
  }

  function openEdit() {
    if(!sotuv) return;
    setIsAddMode(false);
    setEditMijoz(sotuv.Mijoz_ID); setEditAgent(sotuv.Agent); setEditIzoh(sotuv.Izoh||"");
    const items:SavatItem[]=[
      ...savatSom.map(r=>({id:uid(),Mahsulot_ID:r.Mahsulot_ID,Soni:r.Soni,Som_Narx:r.Som_Narx,Narx:"",valyuta:"som" as const})),
      ...savatDollar.map(r=>({id:uid(),Mahsulot_ID:r.Mahsulot_ID,Soni:r.Soni,Som_Narx:"",Narx:r.Narx,valyuta:"dollar" as const})),
    ];
    setEditKurs(savatSom[0]?.Kurs||savatDollar[0]?.Kurs||centralKurs||"");
    setEditSana(sanaToIso(sotuv.Sana));
    setEditItems(items.length>0?items:[{id:uid(),Mahsulot_ID:"",Soni:"",Som_Narx:"",Narx:"",valyuta:"som"}]);
    setEditOpen(true);
  }

  function openAddItem(valyuta:"som"|"dollar"="som") {
    if(!sotuv) return;
    setIsAddMode(true);
    setEditMijoz(sotuv.Mijoz_ID); setEditAgent(sotuv.Agent); setEditIzoh(sotuv.Izoh||"");
    setEditItems([{id:uid(),Mahsulot_ID:"",Soni:"",Som_Narx:"",Narx:"",valyuta,Izoh:""}]);
    setEditKurs(savatSom[0]?.Kurs||savatDollar[0]?.Kurs||centralKurs||"");
    setEditSana(sanaToIso(sotuv.Sana));
    setEditOpen(true);
  }

  function updateItem(itemId:string, field:keyof SavatItem, val:string) {
    setEditItems(p=>p.map(s=>{
      if(s.id!==itemId) return s;
      const u={...s,[field]:val};
      if(field==="Mahsulot_ID"){const m=mMap[val];if(m){ if(s.valyuta==="som") u.Som_Narx=m.Sotuv_som||""; else u.Narx=m.Sotuv_dollar||""; }}
      return u;
    }));
  }
  function addSomItem(){ setEditItems(p=>[...p,{id:uid(),Mahsulot_ID:"",Soni:"",Som_Narx:"",Narx:"",valyuta:"som",Izoh:""}]); }
  function addDollarItem(){ setEditItems(p=>[...p,{id:uid(),Mahsulot_ID:"",Soni:"",Som_Narx:"",Narx:"",valyuta:"dollar",Izoh:""}]); }
  function removeItem(itemId:string){ setEditItems(p=>p.filter(s=>s.id!==itemId)); }

  // Ombor semantikasi: Ombor_ID = MANBA (chiqim), Ombor_2 = QABUL (do'konga transfer).
  // Manba sotuv-AGENTiga bog'liq: agent do'kon omboriga biriktirilgan bo'lsa — o'sha ombor, aks holda mahsulot ombori.
  function ombSrc(agentId: string, mahOmborId: string) { return manbaOmbor(omborByAgent(agentlar)[String(agentId||"").trim()], shopWarehouseSet(mijozlar), mahOmborId||""); }
  function ombDest(mijozId: string) { return dokonOmbor(mijozlar.find(mz => mz.Mijoz_ID === mijozId)); }

  async function handleUpdate() {
    if(!sotuv||!editMijoz||!editAgent) return;
    // Tan narxidan past narx bo'lsa saqlashga ruxsat berilmaydi
    if(editItems.some(s=>isBelowCost(s,editKurs||"0",mMap))){ alert("Ba'zi mahsulot tan narxidan past narxda — saqlab bo'lmaydi. Narxni to'g'rilang."); return; }
    setEditSaving(true);
    const valid=editItems.filter(s=>s.Mahsulot_ID&&s.Soni&&(num(s.Som_Narx)||num(s.Narx)));
    const kurs=editKurs||"0";
    const {sana:snStr,yil,oy,vaqt}=(() => {
      const d=new Date(); const dd=String(d.getDate()).padStart(2,"0"),mm=String(d.getMonth()+1).padStart(2,"0");
      const hh=String(d.getHours()).padStart(2,"0"),mi=String(d.getMinutes()).padStart(2,"0"),ss=String(d.getSeconds()).padStart(2,"0");
      return {sana:`${dd}.${mm}.${d.getFullYear()}`,oy:String(d.getMonth()+1),yil:String(d.getFullYear()),vaqt:`${hh}:${mi}:${ss}`};
    })();
    try {
      if(isAddMode) {
        // Bir vaqtda ko'p mahsulot qo'shish — barchasini POST + keshni iliq saqlab (ro'yxat sekin bo'lmaydi)
        const snRow=editSana?editSana.split("-").reverse().join("."):sotuv.Sana; const [,moRow,yRow]=snRow.split(".");
        const somSheet:Record<string,string|number>[]=[]; const dollarSheet:Record<string,string|number>[]=[];
        const newSom:SotuvSavatRow[]=[]; const newDollar:SotuvSavatDollarRow[]=[];
        for(const r of valid){
          const m=mMap[r.Mahsulot_ID];
          if(num(r.Som_Narx)>0){
            const sid=uid(); const summa=String(num(r.Soni)*num(r.Som_Narx));
            const row={Savat_ID:sid,Yil:yRow,Oy:moRow.replace(/^0/,""),Sana:snRow,Sotuv_ID:sotuv.Sotuv_ID,Agent:editAgent,Mahsulot_ID:r.Mahsulot_ID,Soni:r.Soni,Som_Narx:r.Som_Narx,Kurs:kurs,Summa_som:summa,Som_tan_narx:m?.Sotuv_som||"",Foyda:"",Foyda_summasi_som:"",Ombor_ID:ombSrc(editAgent,m?.Ombor_ID||""),Ombor_2:ombDest(editMijoz),Raqam:"",Vaqt:vaqt,Check:"TRUE",Izoh:r.Izoh||"",Mijoz_ID:editMijoz};
            await fetch("/api/sheets",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sheet:"Sotuv_Savat",row})});
            somSheet.push(row);
            newSom.push({Savat_ID:sid,Sotuv_ID:sotuv.Sotuv_ID,Mahsulot_ID:r.Mahsulot_ID,Soni:r.Soni,Som_Narx:r.Som_Narx,Summa_som:summa,Kurs:kurs,Ombor_ID:m?.Ombor_ID||"",Check:"TRUE",Izoh:r.Izoh||""});
          }
          if(num(r.Narx)>0){
            const sid=uid(); const summa=String(num(r.Soni)*num(r.Narx));
            const row={Savat_ID:sid,Yil:yRow,Oy:moRow.replace(/^0/,""),Sana:snRow,Sotuv_ID:sotuv.Sotuv_ID,Agent:editAgent,Mahsulot_ID:r.Mahsulot_ID,Soni:r.Soni,Narx:r.Narx,Kurs:kurs,Summa:summa,Tan_narx:m?.Sotuv_dollar||"",Foyda:"",Foyda_summasi_som:"",Ombor_ID:ombSrc(editAgent,m?.Ombor_ID||""),Ombor_2:ombDest(editMijoz),Raqam:"",Vaqt:vaqt,Check:"TRUE",Izoh:r.Izoh||"",Mijoz_ID:editMijoz};
            await fetch("/api/sheets",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sheet:"Sotuv_savat_dollar",row})});
            dollarSheet.push(row);
            newDollar.push({Savat_ID:sid,Sotuv_ID:sotuv.Sotuv_ID,Mahsulot_ID:r.Mahsulot_ID,Soni:r.Soni,Narx:r.Narx,Summa:summa,Kurs:kurs,Ombor_ID:m?.Ombor_ID||"",Check:"TRUE",Izoh:r.Izoh||""});
          }
        }
        setSavatSom(p=>[...p,...newSom]);
        setSavatDollar(p=>[...p,...newDollar]);
        appendSheetRows("Sotuv_Savat",somSheet);
        appendSheetRows("Sotuv_savat_dollar",dollarSheet);
        setEditOpen(false);
        setEditSaving(false);
        return;
      } else {
        await fetch("/api/sheets",{method:"PUT",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({sheet:"Sotuv",idColumn:"Sotuv_ID",idValue:sotuv.Sotuv_ID,
            row:{...sotuv,Agent:editAgent,Mijoz_ID:editMijoz,Izoh:editIzoh}})});
        for(const r of savatSom){
          await fetch("/api/sheets",{method:"DELETE",headers:{"Content-Type":"application/json"},
            body:JSON.stringify({sheet:"Sotuv_Savat",idColumn:"Savat_ID",idValue:r.Savat_ID})});
        }
        for(const r of savatDollar){
          await fetch("/api/sheets",{method:"DELETE",headers:{"Content-Type":"application/json"},
            body:JSON.stringify({sheet:"Sotuv_savat_dollar",idColumn:"Savat_ID",idValue:r.Savat_ID})});
        }
        const snRow=editSana?editSana.split("-").reverse().join("."):sotuv.Sana; const [,moRow,yRow]=snRow.split(".");
        for(const r of valid){
          const m=mMap[r.Mahsulot_ID];
          if(num(r.Som_Narx)>0){
            await fetch("/api/sheets",{method:"POST",headers:{"Content-Type":"application/json"},
              body:JSON.stringify({sheet:"Sotuv_Savat",row:{
                Savat_ID:uid(),Yil:yRow,Oy:moRow.replace(/^0/,""),Sana:snRow,
                Sotuv_ID:sotuv.Sotuv_ID,Agent:editAgent,Mahsulot_ID:r.Mahsulot_ID,
                Soni:r.Soni,Som_Narx:r.Som_Narx,Kurs:kurs,
                Summa_som:String(num(r.Soni)*num(r.Som_Narx)),
                Som_tan_narx:m?.Sotuv_som||"",Foyda:"",Foyda_summasi_som:"",
                Ombor_ID:ombSrc(editAgent,m?.Ombor_ID||""),Ombor_2:ombDest(editMijoz),Raqam:"",Vaqt:vaqt,Check:"",Izoh:"",Mijoz_ID:editMijoz,
              }})});
          }
          if(num(r.Narx)>0){
            await fetch("/api/sheets",{method:"POST",headers:{"Content-Type":"application/json"},
              body:JSON.stringify({sheet:"Sotuv_savat_dollar",row:{
                Savat_ID:uid(),Yil:yRow,Oy:moRow.replace(/^0/,""),Sana:snRow,
                Sotuv_ID:sotuv.Sotuv_ID,Agent:editAgent,Mahsulot_ID:r.Mahsulot_ID,
                Soni:r.Soni,Narx:r.Narx,Kurs:kurs,Summa:String(num(r.Soni)*num(r.Narx)),
                Tan_narx:m?.Sotuv_dollar||"",Foyda:"",Foyda_summasi_som:"",
                Ombor_ID:ombSrc(editAgent,m?.Ombor_ID||""),Ombor_2:ombDest(editMijoz),Raqam:"",Vaqt:vaqt,Check:"",Izoh:"",Mijoz_ID:editMijoz,
              }})});
          }
        }
      }
      afterWrite("Sotuv");
      afterWrite("Sotuv_Savat");
      afterWrite("Sotuv_savat_dollar");
      setEditOpen(false);
      setTimeout(()=>loadData(),600);
    } finally { setEditSaving(false); }
  }

  async function handleEditSomSave() {
    if(!editSomRow||!sotuv) return;
    setEditSomSaving(true);
    const newSumma=num(editSomSoni)*num(editSomNarx);
    const newId=uid();
    try {
      const [,moRow,yRow]=sotuv.Sana.split(".");
      const newRow={
        Savat_ID:newId,Yil:yRow,Oy:moRow.replace(/^0/,""),Sana:sotuv.Sana,
        Sotuv_ID:sotuv.Sotuv_ID,Agent:sotuv.Agent,Mahsulot_ID:editSomMahsulot||editSomRow.Mahsulot_ID,
        Soni:editSomSoni,Som_Narx:editSomNarx,Kurs:editSomRow.Kurs||"0",
        Summa_som:String(newSumma),
        Som_tan_narx:mMap[editSomMahsulot||editSomRow.Mahsulot_ID]?.Sotuv_som||"",Foyda:"",Foyda_summasi_som:"",
        Ombor_ID:ombSrc(sotuv.Agent,mMap[editSomMahsulot||editSomRow.Mahsulot_ID]?.Ombor_ID||editSomRow.Ombor_ID||""),Ombor_2:ombDest(sotuv.Mijoz_ID),Raqam:"",Vaqt:sotuv.Sana,Check:editSomRow.Check||"",Izoh:editSomIzoh,Mijoz_ID:sotuv.Mijoz_ID,
      };
      await fetch("/api/sheets",{method:"DELETE",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({sheet:"Sotuv_Savat",idColumn:"Savat_ID",idValue:editSomRow.Savat_ID})});
      await fetch("/api/sheets",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({sheet:"Sotuv_Savat",row:newRow})});
      setSavatSom(p=>p.map(r=>r.Savat_ID===editSomRow.Savat_ID
        ?{...r,Savat_ID:newId,Mahsulot_ID:editSomMahsulot||editSomRow.Mahsulot_ID,Soni:editSomSoni,Som_Narx:editSomNarx,Summa_som:String(newSumma),Izoh:editSomIzoh}:r));
      replaceSheetRows("Sotuv_Savat","Savat_ID",[editSomRow.Savat_ID],[newRow]);
      setEditSomRow(null);
    } finally { setEditSomSaving(false); }
  }

  async function handleEditDollarSave() {
    if(!editDollarRow||!sotuv) return;
    setEditDollarSaving(true);
    const newSumma=num(editDollarSoni)*num(editDollarNarx);
    const newId=uid();
    try {
      const [,moRow,yRow]=sotuv.Sana.split(".");
      const newRow={
        Savat_ID:newId,Yil:yRow,Oy:moRow.replace(/^0/,""),Sana:sotuv.Sana,
        Sotuv_ID:sotuv.Sotuv_ID,Agent:sotuv.Agent,Mahsulot_ID:editDollarMahsulot||editDollarRow.Mahsulot_ID,
        Soni:editDollarSoni,Narx:editDollarNarx,Kurs:editDollarRow.Kurs||"0",
        Summa:String(newSumma),
        Tan_narx:mMap[editDollarMahsulot||editDollarRow.Mahsulot_ID]?.Sotuv_dollar||"",Foyda:"",Foyda_summasi_som:"",
        Ombor_ID:ombSrc(sotuv.Agent,mMap[editDollarMahsulot||editDollarRow.Mahsulot_ID]?.Ombor_ID||editDollarRow.Ombor_ID||""),Ombor_2:ombDest(sotuv.Mijoz_ID),Raqam:"",Vaqt:sotuv.Sana,Check:editDollarRow.Check||"",Izoh:editDollarIzoh,Mijoz_ID:sotuv.Mijoz_ID,
      };
      await fetch("/api/sheets",{method:"DELETE",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({sheet:"Sotuv_savat_dollar",idColumn:"Savat_ID",idValue:editDollarRow.Savat_ID})});
      await fetch("/api/sheets",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({sheet:"Sotuv_savat_dollar",row:newRow})});
      setSavatDollar(p=>p.map(r=>r.Savat_ID===editDollarRow.Savat_ID
        ?{...r,Savat_ID:newId,Mahsulot_ID:editDollarMahsulot||editDollarRow.Mahsulot_ID,Soni:editDollarSoni,Narx:editDollarNarx,Summa:String(newSumma),Izoh:editDollarIzoh}:r));
      replaceSheetRows("Sotuv_savat_dollar","Savat_ID",[editDollarRow.Savat_ID],[newRow]);
      setEditDollarRow(null);
    } finally { setEditDollarSaving(false); }
  }

  // Tan narxidan past narx (narx kiritilgan va tan narxdan kam) — sotuvga ruxsat berilmaydi
  function priceBelowCost(mahsulotId:string, narxStr:string, valyuta:"som"|"dollar"):boolean {
    const m=mMap[mahsulotId]; if(!m) return false;
    const narx=num(narxStr); if(narx<=0) return false;
    if(valyuta==="som"){
      const tanSom=num(m.Tan_som||"0"), tanDollar=num(m.Tan_dollar||"0");
      const kurs=num(savatSom[0]?.Kurs||savatDollar[0]?.Kurs||centralKurs||"0");
      const minNarx=tanSom!==0?tanSom:tanDollar*kurs;
      return minNarx>0 && narx<minNarx;
    }
    const tanDollar=num(m.Tan_dollar||"0");
    return tanDollar>0 && narx<tanDollar;
  }

  // ── Ommaviy (bulk) tahrirlash ───────────────────────────
  function exitBulk(){ setBulkMode(false); setBulkSel(new Set()); setBulkEdits({}); }
  function toggleBulkRow(savatId:string, soni:string, narx:string){
    setBulkSel(prev=>{ const n=new Set(prev); if(n.has(savatId)) n.delete(savatId); else n.add(savatId); return n; });
    setBulkEdits(e=> e[savatId] ? e : {...e,[savatId]:{Soni:soni,Narx:narx}});
  }
  function setBulkVal(savatId:string, field:"Soni"|"Narx"|"Mahsulot", val:string){
    setBulkEdits(e=>({...e,[savatId]:{...(e[savatId]||{Soni:"",Narx:""}),[field]:val}}));
  }
  function toggleAllBulk(rows:{Savat_ID:string;Soni:string;narx:string}[]){
    const allSel = rows.length>0 && rows.every(r=>bulkSel.has(r.Savat_ID));
    if(allSel){
      setBulkSel(prev=>{ const n=new Set(prev); rows.forEach(r=>n.delete(r.Savat_ID)); return n; });
    } else {
      setBulkSel(prev=>{ const n=new Set(prev); rows.forEach(r=>n.add(r.Savat_ID)); return n; });
      setBulkEdits(e=>{ const ne={...e}; rows.forEach(r=>{ if(!ne[r.Savat_ID]) ne[r.Savat_ID]={Soni:r.Soni,Narx:r.narx}; }); return ne; });
    }
  }
  async function handleBulkSave(){
    if(!sotuv||bulkSel.size===0) return;
    // Tan narxidan past narx bo'lsa saqlashni bloklaymiz
    for(const r of savatSom){ if(bulkSel.has(r.Savat_ID)){ const e=bulkEdits[r.Savat_ID]; if(e&&priceBelowCost(e.Mahsulot||r.Mahsulot_ID,e.Narx,"som")){ alert("Ba'zi mahsulot tan narxidan past narxda — saqlab bo'lmaydi. Narxni to'g'rilang."); return; } } }
    for(const r of savatDollar){ if(bulkSel.has(r.Savat_ID)){ const e=bulkEdits[r.Savat_ID]; if(e&&priceBelowCost(e.Mahsulot||r.Mahsulot_ID,e.Narx,"dollar")){ alert("Ba'zi mahsulot tan narxidan past narxda — saqlab bo'lmaydi. Narxni to'g'rilang."); return; } } }
    setBulkSaving(true);
    try {
      for(const r of savatSom){
        if(!bulkSel.has(r.Savat_ID)) continue;
        const e=bulkEdits[r.Savat_ID]; if(!e) continue;
        await fetch("/api/sheets",{method:"PUT",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({sheet:"Sotuv_Savat",idColumn:"Savat_ID",idValue:r.Savat_ID,updates:{Mahsulot_ID:e.Mahsulot||r.Mahsulot_ID,Soni:e.Soni,Som_Narx:e.Narx,Summa_som:String(num(e.Soni)*num(e.Narx))}})});
      }
      for(const r of savatDollar){
        if(!bulkSel.has(r.Savat_ID)) continue;
        const e=bulkEdits[r.Savat_ID]; if(!e) continue;
        await fetch("/api/sheets",{method:"PUT",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({sheet:"Sotuv_savat_dollar",idColumn:"Savat_ID",idValue:r.Savat_ID,updates:{Mahsulot_ID:e.Mahsulot||r.Mahsulot_ID,Soni:e.Soni,Narx:e.Narx,Summa:String(num(e.Soni)*num(e.Narx))}})});
      }
      afterWrite("Sotuv_Savat"); afterWrite("Sotuv_savat_dollar");
      setSavatSom(p=>p.map(r=>{ const e=bulkSel.has(r.Savat_ID)?bulkEdits[r.Savat_ID]:null; return e?{...r,Mahsulot_ID:e.Mahsulot||r.Mahsulot_ID,Soni:e.Soni,Som_Narx:e.Narx,Summa_som:String(num(e.Soni)*num(e.Narx))}:r; }));
      setSavatDollar(p=>p.map(r=>{ const e=bulkSel.has(r.Savat_ID)?bulkEdits[r.Savat_ID]:null; return e?{...r,Mahsulot_ID:e.Mahsulot||r.Mahsulot_ID,Soni:e.Soni,Narx:e.Narx,Summa:String(num(e.Soni)*num(e.Narx))}:r; }));
      exitBulk();
    } finally { setBulkSaving(false); }
  }

  // Bitta inline qatorni saqlaydi (to'lganda avtomat yoki ✓ bilan); saqlangach qator ro'yxatdan o'chadi
  async function saveAddRow(row:AddRow, valyuta:"som"|"dollar") {
    if(!sotuv) return;
    if(savingRowIds.current.has(row.id)) return;
    // Tan narxidan past narxga sotishga ruxsat berilmaydi
    if(priceBelowCost(row.Mahsulot_ID,row.Narx,valyuta)){ showToast("Narx tan narxidan past — saqlanmadi", false); return; }
    savingRowIds.current.add(row.id);
    setSavingIds(s=>new Set(s).add(row.id));
    const m=mMap[row.Mahsulot_ID];
    const [,moRow,yRow]=sotuv.Sana.split(".");
    const {vaqt}=nowStr();
    const sid=uid();
    const kurs=savatSom[0]?.Kurs||savatDollar[0]?.Kurs||centralKurs||"0";
    try {
      if(valyuta==="som"){
        const summa=String(num(row.Soni)*num(row.Narx));
        const newRow={Savat_ID:sid,Yil:yRow,Oy:moRow.replace(/^0/,""),Sana:sotuv.Sana,Sotuv_ID:sotuv.Sotuv_ID,Agent:sotuv.Agent,Mahsulot_ID:row.Mahsulot_ID,Soni:row.Soni,Som_Narx:row.Narx,Kurs:kurs,Summa_som:summa,Som_tan_narx:m?.Sotuv_som||"",Foyda:"",Foyda_summasi_som:"",Ombor_ID:ombSrc(sotuv.Agent,m?.Ombor_ID||""),Ombor_2:ombDest(sotuv.Mijoz_ID),Raqam:"",Vaqt:vaqt,Check:"TRUE",Izoh:row.Izoh||"",Mijoz_ID:sotuv.Mijoz_ID};
        await fetch("/api/sheets",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sheet:"Sotuv_Savat",row:newRow})});
        setSavatSom(p=>[...p,{Savat_ID:sid,Sotuv_ID:sotuv.Sotuv_ID,Mahsulot_ID:row.Mahsulot_ID,Soni:row.Soni,Som_Narx:row.Narx,Summa_som:summa,Kurs:kurs,Ombor_ID:m?.Ombor_ID||"",Check:"TRUE",Izoh:row.Izoh||""}]);
        appendSheetRows("Sotuv_Savat",[newRow]);
        setAddSomRows(p=>p.filter(x=>x.id!==row.id));
      } else {
        const summa=String(num(row.Soni)*num(row.Narx));
        const newRow={Savat_ID:sid,Yil:yRow,Oy:moRow.replace(/^0/,""),Sana:sotuv.Sana,Sotuv_ID:sotuv.Sotuv_ID,Agent:sotuv.Agent,Mahsulot_ID:row.Mahsulot_ID,Soni:row.Soni,Narx:row.Narx,Kurs:kurs,Summa:summa,Tan_narx:m?.Sotuv_dollar||"",Foyda:"",Foyda_summasi_som:"",Ombor_ID:ombSrc(sotuv.Agent,m?.Ombor_ID||""),Ombor_2:ombDest(sotuv.Mijoz_ID),Raqam:"",Vaqt:vaqt,Check:"TRUE",Izoh:row.Izoh||"",Mijoz_ID:sotuv.Mijoz_ID};
        await fetch("/api/sheets",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sheet:"Sotuv_savat_dollar",row:newRow})});
        setSavatDollar(p=>[...p,{Savat_ID:sid,Sotuv_ID:sotuv.Sotuv_ID,Mahsulot_ID:row.Mahsulot_ID,Soni:row.Soni,Narx:row.Narx,Summa:summa,Kurs:kurs,Ombor_ID:m?.Ombor_ID||"",Check:"TRUE",Izoh:row.Izoh||""}]);
        appendSheetRows("Sotuv_savat_dollar",[newRow]);
        setAddDollarRows(p=>p.filter(x=>x.id!==row.id));
      }
      showToast("Mahsulot saqlandi", true);
    } catch {
      savingRowIds.current.delete(row.id);
      showToast("Mahsulot saqlanmadi", false);
    } finally {
      setSavingIds(s=>{const n=new Set(s);n.delete(row.id);return n;});
    }
  }

  async function handleDeleteSotuv() {
    if(!sotuv) return;
    setDeleting(true);
    const sid=sotuv.Sotuv_ID;
    try {
      const [ssRes,sdRes]=await Promise.all([
        fetchSheetWhere("Sotuv_Savat", "Sotuv_ID", sid),
        fetchSheetWhere("Sotuv_savat_dollar", "Sotuv_ID", sid),
      ]);
      const somItems=(ssRes.data||[]) as {Savat_ID:string;Sotuv_ID:string}[];
      const dollarItems=(sdRes.data||[]) as {Savat_ID:string;Sotuv_ID:string}[];
      for(const r of somItems){
        await fetch("/api/sheets",{method:"DELETE",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({sheet:"Sotuv_Savat",idColumn:"Savat_ID",idValue:r.Savat_ID})});
      }
      for(const r of dollarItems){
        await fetch("/api/sheets",{method:"DELETE",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({sheet:"Sotuv_savat_dollar",idColumn:"Savat_ID",idValue:r.Savat_ID})});
      }
      await fetch("/api/sheets",{method:"DELETE",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({sheet:"Sotuv",idColumn:"Sotuv_ID",idValue:sid})});
      afterWrite("Sotuv");
      afterWrite("Sotuv_Savat");
      afterWrite("Sotuv_savat_dollar");
      router.push("/sotuv");
    } finally { setDeleting(false); }
  }

  function openAddTolov() {
    setAddTolovValyuta("Som"); setAddTolovTuri("Naqd");
    setAddTolovSom(""); setAddTolovDollar(""); setAddTolovKurs(""); setAddTolovIzoh("");
    setAddTolovGazna(""); setAddTolovGaznaDollar("");
    setAddTolovSana(sanaToIso(nowStr().sana));
    setAddTolovOpen(true);
  }

  async function handleAddTolov() {
    if(!sotuv) return;
    const somV=num(addTolovSom), usdV=num(addTolovDollar);
    if(somV===0&&usdV===0) return;
    if(num(addTolovKurs)<11000) return;
    setAddTolovSaving(true);
    const {vaqt}=nowStr();
    const {sana,oy,yil}=addTolovSana?isoToParts(addTolovSana):nowStr();
    const kurs=num(addTolovKurs);
    const isSom=addTolovValyuta==="Som";
    const summa=isSom?String(somV+usdV*kurs):"";
    const summaDollar=!isSom?String(usdV+(kurs>0?somV/kurs:0)):"";
    try {
      const saveRes=await fetch("/api/sheets",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({sheet:"S_tolov",row:{
          Tolov_ID:uid(),Sotuv_ID:sotuv.Sotuv_ID,Mijoz_ID:sotuv.Mijoz_ID,Agent:sotuv.Agent,
          Yil:yil,Oy:oy,Sana:sana,Valyuta:isSom?"So'm":"Dollar",Turi:addTolovTuri,
          Som:String(somV),Dollar:String(usdV),Summa:summa,Summa_dollar:summaDollar,
          Dollar_Kursi:addTolovKurs,Izoh:addTolovIzoh,Vaqt:vaqt,Check:"False",
          Gazna_ID:addTolovGazna,Gazna_dollar_ID:addTolovGaznaDollar,
        }})});
      // MUHIM: saqlanganini tasdiqlaymiz — xato bo'lsa to'lov jimgina yo'qolmasin
      if(!saveRes.ok){ const je=await saveRes.json().catch(()=>({})); throw new Error(je.error||"Server bilan bog'lanishda xatolik"); }
      afterWrite("S_tolov");
      setAddTolovOpen(false);
      setTimeout(()=>loadData(),600);
    } catch(e) {
      alert("To'lov saqlanmadi: "+(e instanceof Error?e.message:"noma'lum")+".\nInternet aloqasini tekshirib, qayta urinib ko'ring.");
    } finally { setAddTolovSaving(false); }
  }

  function openEditTolov(t:STolov) {
    setEditTolov(t);
    setEditTolovValyuta(t.Valyuta==="Dollar"?"Dollar":"Som");
    setEditTolovSom(t.Som||""); setEditTolovDollar(t.Dollar||"");
    setEditTolovKurs(t.Dollar_Kursi||""); setEditTolovTuri(t.Turi||"Naqd");
    setEditTolovIzoh(t.Izoh||"");
    setEditTolovGazna(t.Gazna_ID||"");
    setEditTolovGaznaDollar(t.Gazna_dollar_ID||"");
    setEditTolovSana(sanaToIso(t.Sana));
    setEditTolovVaqt(t.Vaqt||"");
  }

  async function handleEditTolovSave() {
    if(!editTolov) return;
    if(num(editTolovKurs)<11000) return;
    setEditTolovSaving(true);
    const somV=num(editTolovSom), usdV=num(editTolovDollar), kurs=num(editTolovKurs);
    const isSom=editTolovValyuta==="Som";
    const summa=isSom?String(somV+usdV*kurs):"";
    const summaDollar=!isSom?String(usdV+(kurs>0?somV/kurs:0)):"";
    const _sp = editTolovSana ? isoToParts(editTolovSana) : { sana: editTolov.Sana, oy: editTolov.Oy, yil: editTolov.Yil };
    try {
      await fetch("/api/sheets",{method:"PUT",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({sheet:"S_tolov",idColumn:"Tolov_ID",idValue:editTolov.Tolov_ID,
          row:{...editTolov,Valyuta:isSom?"So'm":"Dollar",Turi:editTolovTuri,
            Som:String(somV),Dollar:String(usdV),Summa:summa,Summa_dollar:summaDollar,
            Dollar_Kursi:editTolovKurs,Izoh:editTolovIzoh,
            Sana:_sp.sana,Yil:_sp.yil,Oy:_sp.oy,
            Vaqt:editTolovVaqt||editTolov.Vaqt,
            Gazna_ID:editTolovGazna,Gazna_dollar_ID:editTolovGaznaDollar}})});
      afterWrite("S_tolov");
      setEditTolov(null);
      setTimeout(()=>loadData(),600);
    } finally { setEditTolovSaving(false); }
  }

  async function handleDeleteTolov() {
    if(!deleteTolov) return;
    setDeletingTolov(true);
    try {
      await fetch("/api/sheets",{method:"DELETE",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({sheet:"S_tolov",idColumn:"Tolov_ID",idValue:deleteTolov.Tolov_ID})});
      afterWrite("S_tolov");
      setDeleteTolov(null);
      setTimeout(()=>loadData(),600);
    } finally { setDeletingTolov(false); }
  }

  async function toggleTolovAkt(t:STolov) {
    setTogglingId(t.Tolov_ID);
    const newVal=(t.Check==="True"||t.Check==="true")?"False":"True";
    await fetch("/api/sheets",{method:"PUT",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({sheet:"S_tolov",idColumn:"Tolov_ID",idValue:t.Tolov_ID,row:{...t,Check:newVal}})});
    afterWrite("S_tolov");
    setStolovlar(p=>p.map(r=>r.Tolov_ID===t.Tolov_ID?{...r,Check:newVal}:r));
    setTogglingId(null);
  }

  const aItems  = useMemo(()=>agentlar.map(a=>({id:a.Foydalanuvchi_ID,label:a.Nomi})),[agentlar]);
  const mJItems = useMemo(()=>mijozlar.map(m=>({id:m.Mijoz_ID,label:m.Ism+(m.Telefon?` (${m.Telefon})`:""),})),[mijozlar]);
  const mhItems = useMemo(()=>mahsulotlar.map(m=>({id:m.Mahsulot_ID,label:m.Nomi})),[mahsulotlar]);

  const jamiSom    = useMemo(()=>savatSom.reduce((s,r)=>s+num(r.Summa_som),0),[savatSom]);
  const jamiDollar = useMemo(()=>savatDollar.reduce((s,r)=>s+num(r.Summa),0),[savatDollar]);
  // Shu sotuvning foydasi: Summa − Tan×Soni (Tan_som bo'sh bo'lsa Tan_dollar×kurs, va aksincha)
  const sotuvFoyda = useMemo(()=>{
    const k0 = num(savatSom[0]?.Kurs||savatDollar[0]?.Kurs||centralKurs||"0");
    let som=0, usd=0;
    savatSom.forEach(r=>{
      const m=mMap[r.Mahsulot_ID]; const rk=num(r.Kurs)||k0;
      const tanS=num(m?.Tan_som)>0?num(m?.Tan_som):num(m?.Tan_dollar)*rk;
      som += num(r.Summa_som) - tanS*num(r.Soni);
    });
    savatDollar.forEach(r=>{
      const m=mMap[r.Mahsulot_ID]; const rk=num(r.Kurs)||k0;
      const tanD=num(m?.Tan_dollar)>0?num(m?.Tan_dollar):(rk>0?num(m?.Tan_som)/rk:0);
      usd += num(r.Summa) - tanD*num(r.Soni);
    });
    return {som, usd};
  },[savatSom,savatDollar,mMap,centralKurs]);
  const editJamiSom    = useMemo(()=>editItems.reduce((s,r)=>s+num(r.Soni)*num(r.Som_Narx),0),[editItems]);
  const editJamiDollar = useMemo(()=>editItems.reduce((s,r)=>s+num(r.Soni)*num(r.Narx),0),[editItems]);
  const tolovJamiSom    = useMemo(()=>stolovlar.reduce((s,t)=>s+(t.Valyuta!=="Dollar"?num(t.Summa):0),0),[stolovlar]);
  const tolovJamiDollar = useMemo(()=>stolovlar.reduce((s,t)=>s+(t.Valyuta==="Dollar"?num(t.Summa_dollar):0),0),[stolovlar]);

  if(loading) return <div className="page-content" style={{display:"flex",justifyContent:"center",paddingTop:80}}><div className="spinner--page"/></div>;
  if(!sotuv) return (
    <div className="page-content"><div className="empty">
      <div className="empty__icon">📊</div>
      <p className="empty__title">Sotuv topilmadi</p>
      <button className="btn btn--outline" onClick={()=>router.back()}>← Orqaga</button>
    </div></div>
  );

  const mjNomi = mijozlar.find(m=>m.Mijoz_ID===sotuv.Mijoz_ID)?.Ism||"—";
  const agNomi = aMap[sotuv.Agent]||"—";

  return (
    <>
      <header className="header" style={{borderBottom:"1px solid var(--border)"}}>
        <div className="header__inner" style={{gap:isMobile?10:12,flexWrap:isMobile?"wrap":"nowrap"}}>
          <button onClick={()=>router.back()} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",border:"1px solid var(--border)",borderRadius:"var(--radius)",background:"var(--white)",cursor:"pointer",fontSize:13,fontWeight:600,color:"var(--text-2)",flexShrink:0}}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg> Orqaga
          </button>
          {/* Sotuv raqami + O'chirish */}
          <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0,flex:1}}>
            <div style={{minWidth:0,flex:1}}>
              <h1 style={{fontSize:isMobile?17:20,fontWeight:800,lineHeight:1.2}}>Sotuv #{sotuv.Sotuv_Raqami||"—"}</h1>
              <p style={{fontSize:12,color:"var(--text-3)",marginTop:2}}>{sotuv.Sana}</p>
            </div>
            <button onClick={()=>setDeleteOpen(true)} title="O'chirish" style={{display:"flex",alignItems:"center",gap:6,padding:isMobile?"8px 11px":"8px 16px",border:"1px solid #fecaca",borderRadius:"var(--radius)",background:"var(--white)",cursor:"pointer",fontSize:13,fontWeight:600,color:"#ef4444",flexShrink:0}}>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>{!isMobile && <span>O&apos;chirish</span>}
            </button>
          </div>
        </div>
      </header>

      <div className="page-content" style={{maxWidth:1500,paddingBottom:bulkMode?(isMobile?130:90):undefined}}>
        {/* Stats */}
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"1fr 1fr 1fr",gap:isMobile?10:16,marginBottom:isMobile?16:24}}>
          {/* MIJOZ */}
          <div style={{gridColumn:isMobile?"1 / -1":undefined,background:"var(--white)",borderRadius:"var(--radius-xl)",boxShadow:"var(--shadow-sm)",padding:isMobile?"16px 18px":"20px 24px"}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
              <div onClick={()=>router.push(`/mijozlar/${sotuv.Mijoz_ID}`)} style={{minWidth:0,flex:1,cursor:"pointer"}}>
                <p style={{fontSize:10,fontWeight:700,color:"var(--text-3)",letterSpacing:".06em",marginBottom:10}}>MIJOZ</p>
                <p style={{fontSize:16,fontWeight:800,color:"var(--primary)"}}>{mjNomi}</p>
                <p style={{fontSize:11,color:"var(--text-3)",marginTop:4}}>Agent: {agNomi}</p>
              </div>
              <div style={{display:"flex",gap:8,flexShrink:0,flexWrap:"wrap",justifyContent:"flex-end"}}>
                <button onClick={()=>{
                    const mj=mijozlar.find(m=>m.Mijoz_ID===sotuv.Mijoz_ID);
                    sessionStorage.setItem(`chek_${sotuv.Sotuv_ID}`,JSON.stringify({savatSom,savatDollar,mMap}));
                    const p=new URLSearchParams({sana:sotuv.Sana,agent:agNomi,mijozIsm:mjNomi,mijozTel:mj?.Telefon||"",totalSom:String(mijozQarzSom),totalDollar:String(mijozQarzDollar),tolovSom:String(tolovJamiSom),tolovDollar:String(tolovJamiDollar)});
                    router.push(`/sotuv/${sotuv.Sotuv_ID}/chek?${p.toString()}`);
                  }} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 14px",border:"1px solid #ddd6fe",borderRadius:"var(--radius)",background:"#f5f3ff",cursor:"pointer",fontSize:13,fontWeight:700,color:"#7c3aed"}}>
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                  Chek
                </button>
                {(() => { const td = String(sotuv.Chek||"").trim()!==""; return (
                <button onClick={toggleTasdiq} disabled={tasdiqSaving} title={td?"Tasdiqlandi (bosib bekor qilish)":"Tasdiqlash (qarzga qo'shish)"}
                  style={{display:"flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:"var(--radius)",border:`1.5px solid ${td?"#16a34a":"#f59e0b"}`,background:td?"#16a34a":"#fffbeb",cursor:"pointer",fontSize:13,fontWeight:700,color:td?"#fff":"#b45309",transition:"all .15s",opacity:tasdiqSaving?.6:1}}>
                  {td
                    ? <><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>Tasdiqlandi</>
                    : <><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" strokeWidth={2}/></svg>Tasdiqlash</>
                  }
                </button>
                ); })()}
              </div>
            </div>
            {isAdmin && (savatSom.length>0||savatDollar.length>0) && (
              <div style={{marginTop:14,paddingTop:14,borderTop:"1px solid var(--border)"}}>
                <p style={{fontSize:10,fontWeight:700,color:"var(--text-3)",letterSpacing:".06em",marginBottom:8}}>SHU SOTUVDAN FOYDA</p>
                <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
                  {sotuvFoyda.som!==0 && (
                    <div>
                      <p style={{fontSize:11,fontWeight:600,color:"var(--text-3)",marginBottom:2}}>So&apos;m</p>
                      <p style={{fontSize:15,fontWeight:800,color:sotuvFoyda.som>=0?"#16a34a":"#ef4444"}}>{Math.round(sotuvFoyda.som).toLocaleString("ru-RU")} <span style={{fontSize:10,fontWeight:600}}>so&apos;m</span></p>
                    </div>
                  )}
                  {sotuvFoyda.usd!==0 && (
                    <div>
                      <p style={{fontSize:11,fontWeight:600,color:"var(--text-3)",marginBottom:2}}>Dollar</p>
                      <p style={{fontSize:15,fontWeight:800,color:sotuvFoyda.usd>=0?"#16a34a":"#ef4444"}}>${sotuvFoyda.usd.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
                    </div>
                  )}
                  {sotuvFoyda.som===0 && sotuvFoyda.usd===0 && <p style={{fontSize:14,fontWeight:800,color:"var(--text-3)"}}>0</p>}
                </div>
              </div>
            )}
          </div>
          {/* SO'M */}
          <div style={{background:"var(--white)",borderRadius:"var(--radius-xl)",boxShadow:"var(--shadow-sm)",padding:isMobile?"13px 13px":"16px 20px",minWidth:0}}>
            <p style={{fontSize:10,fontWeight:700,color:"#16a34a",letterSpacing:".06em",marginBottom:12}}>SO&apos;M</p>
            {[
              {label:"Mijoz balansi", val:mijozQarzSom, color:mijozQarzSom>0?"#ef4444":"#16a34a", bold:false, neg:false},
              {label:"Sotuv summasi", val:jamiSom, color:"var(--text)", bold:false, neg:false},
              ...(tolovJamiSom>0?[{label:"To'lov", val:tolovJamiSom, color:"#16a34a", bold:false, neg:true}]:[]),
              // Yakuniy qoldiq = eski qoldiq + shu sotuv tovari − shu sotuvga qilingan to'lov
              {label:"Yakuniy qoldiq", val:mijozQarzSom+jamiSom-tolovJamiSom, color:"var(--text)", bold:true, neg:false},
            ].map((r,i,arr)=>(
              <div key={i} style={{paddingBottom:i<arr.length-1?10:0,marginBottom:i<arr.length-1?10:0,borderBottom:i<arr.length-1?"1px solid var(--border)":"none"}}>
                <p style={{fontSize:12,fontWeight:700,color:"var(--text-2)",marginBottom:3}}>{r.label}</p>
                <p style={{fontSize:r.bold?16:13,fontWeight:r.bold?800:700,color:r.color}}>
                  {r.neg?"− ":""}{r.val!==0?r.val.toLocaleString("ru-RU"):"0"} <span style={{fontSize:10,fontWeight:600}}>so&apos;m</span>
                </p>
              </div>
            ))}
          </div>
          {/* DOLLAR */}
          <div style={{background:"var(--white)",borderRadius:"var(--radius-xl)",boxShadow:"var(--shadow-sm)",padding:isMobile?"13px 13px":"16px 20px",minWidth:0}}>
            <p style={{fontSize:10,fontWeight:700,color:"#2563eb",letterSpacing:".06em",marginBottom:12}}>DOLLAR</p>
            {[
              {label:"Mijoz balansi", val:mijozQarzDollar, color:mijozQarzDollar>0?"#ef4444":"#16a34a", bold:false, neg:false},
              {label:"Sotuv summasi", val:jamiDollar, color:"var(--text)", bold:false, neg:false},
              ...(tolovJamiDollar>0?[{label:"To'lov", val:tolovJamiDollar, color:"#16a34a", bold:false, neg:true}]:[]),
              // Yakuniy qoldiq = eski qoldiq + shu sotuv tovari − shu sotuvga qilingan to'lov
              {label:"Yakuniy qoldiq", val:mijozQarzDollar+jamiDollar-tolovJamiDollar, color:"var(--text)", bold:true, neg:false},
            ].map((r,i,arr)=>(
              <div key={i} style={{paddingBottom:i<arr.length-1?10:0,marginBottom:i<arr.length-1?10:0,borderBottom:i<arr.length-1?"1px solid var(--border)":"none"}}>
                <p style={{fontSize:12,fontWeight:700,color:"var(--text-2)",marginBottom:3}}>{r.label}</p>
                <p style={{fontSize:r.bold?16:13,fontWeight:r.bold?800:700,color:r.color}}>
                  {r.neg?"− ":""}${r.val!==0?r.val.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2}):"0.00"}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="search" style={{marginBottom:16}}><span className="search__icon"><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg></span><input className="search__input" placeholder="Mahsulot qidirish..." value={savatSearch} onChange={e=>setSavatSearch(e.target.value)}/>{savatSearch&&<button className="search__clear" onClick={()=>setSavatSearch("")}><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>}</div>

        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:16,alignItems:"start"}}>
        {/* So'm mahsulotlar */}
        {(savatSom.length>0||addSomRows.length>0||savatDollar.length>0||addDollarRows.length>0)&&(
          <div style={{background:"var(--white)",borderRadius:"var(--radius-xl)",boxShadow:"var(--shadow-sm)",overflowX:isMobile?"auto":undefined}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px",borderBottom:"1px solid var(--border)",borderRadius:"var(--radius-xl) var(--radius-xl) 0 0",overflow:"hidden"}}>
              {isMobile?<span style={{fontSize:13,fontWeight:700,color:"#16a34a",letterSpacing:".05em"}}>SO&apos;M SAVAT</span>:<span style={{fontSize:15,fontWeight:700}}>So&apos;m mahsulotlar</span>}
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>bulkMode?exitBulk():setBulkMode(true)} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 14px",border:`1px solid ${bulkMode?"var(--primary)":"var(--border)"}`,borderRadius:"var(--radius)",background:bulkMode?"var(--primary-glow)":"var(--white)",cursor:"pointer",fontSize:13,fontWeight:600,color:bulkMode?"var(--primary)":"var(--text-2)"}}>
                  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg> {bulkMode?"Bekor":"Ommaviy"}
                </button>
              </div>
            </div>
            {(savatSom.length>0||addSomRows.length>0) && (!isMobile ? (
            <div style={{display:"grid",gridTemplateColumns:"36px 1fr 56px 76px 100px 60px 80px 52px",padding:"10px 20px",background:"var(--bg)",borderBottom:"1px solid var(--border)",alignItems:"center"}}>
              {bulkMode
                ? <input type="checkbox" checked={savatSom.length>0&&savatSom.every(r=>bulkSel.has(r.Savat_ID))} onChange={()=>toggleAllBulk(savatSom.map(r=>({Savat_ID:r.Savat_ID,Soni:r.Soni,narx:r.Som_Narx})))} style={{width:17,height:17,cursor:"pointer"}}/>
                : <span style={{fontSize:10,fontWeight:700,color:"var(--text-3)",letterSpacing:".05em"}}>#</span>}
              {["MAHSULOT","SONI","NARX","JAMI","IZOH",bulkMode?"":"YETKAZIB BERILDIMI?",""].map((h,hi)=><span key={hi} style={{fontSize:10,fontWeight:700,color:"var(--text-3)",letterSpacing:".05em"}}>{h}</span>)}
            </div>
            ) : bulkMode ? (
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"11px 16px",background:"var(--bg)",borderBottom:"1px solid var(--border)"}}>
              <input type="checkbox" checked={savatSom.length>0&&savatSom.every(r=>bulkSel.has(r.Savat_ID))} onChange={()=>toggleAllBulk(savatSom.map(r=>({Savat_ID:r.Savat_ID,Soni:r.Soni,narx:r.Som_Narx})))} style={{width:18,height:18,cursor:"pointer"}}/>
              <span style={{fontSize:12,fontWeight:700,color:"var(--text-2)"}}>Hammasini tanlash</span>
            </div>
            ) : null)}
            {savatSom.filter(s=>!savatSearch||(mMap[s.Mahsulot_ID]?.Nomi||"").toLowerCase().includes(savatSearch.toLowerCase())).map((s,i)=>{
              const m=mMap[s.Mahsulot_ID];
              const isEdit=editSomRow?.Savat_ID===s.Savat_ID;
              const delivered=s.Check!=="FALSE";
              if(bulkMode){
                const sel=bulkSel.has(s.Savat_ID);
                const e=bulkEdits[s.Savat_ID]||{Soni:s.Soni,Narx:s.Som_Narx,Mahsulot:s.Mahsulot_ID};
                const jami=sel?num(e.Soni)*num(e.Narx):num(s.Summa_som);
                if(isMobile) return (
                  <div key={s.Savat_ID||i} style={{padding:"10px 16px",borderBottom:i<savatSom.length-1?"1px solid var(--border)":"none",background:sel?"#f0f9ff":"transparent",display:"flex",alignItems:"center",gap:10}}>
                    <input type="checkbox" checked={sel} onChange={()=>toggleBulkRow(s.Savat_ID,s.Soni,s.Som_Narx)} style={{width:18,height:18,cursor:"pointer",flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}>
                      {sel
                        ? <SearchSelect items={mhItems} value={e.Mahsulot||s.Mahsulot_ID} onChange={v=>setBulkEdits(prev=>{const cur=prev[s.Savat_ID]||{Soni:s.Soni,Narx:s.Som_Narx,Mahsulot:s.Mahsulot_ID};const mm=mMap[v];return{...prev,[s.Savat_ID]:{...cur,Mahsulot:v,Narx:mm?.Sotuv_som||cur.Narx}};})} placeholder="Mahsulot..."/>
                        : <div style={{fontSize:14,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m?.Nomi||"—"}</div>}
                      <div style={{display:"flex",alignItems:"center",gap:6,marginTop:5,flexWrap:"wrap"}}>
                        {sel?(<>
                          <input value={e.Soni} onChange={ev=>setBulkVal(s.Savat_ID,"Soni",ev.target.value)} type="number" style={{width:56,padding:"6px 8px",border:"1.5px solid var(--primary)",borderRadius:"var(--radius)",fontSize:13,fontWeight:700,outline:"none",textAlign:"center"}}/>
                          <span style={{color:"var(--text-3)"}}>×</span>
                          <input value={e.Narx} onChange={ev=>setBulkVal(s.Savat_ID,"Narx",ev.target.value)} inputMode="decimal" style={{width:80,padding:"6px 8px",border:"1.5px solid var(--primary)",borderRadius:"var(--radius)",fontSize:13,fontWeight:700,outline:"none",textAlign:"center"}}/>
                          <span style={{fontSize:13,fontWeight:800,color:"var(--primary)"}}>= {fmtSom(jami)}</span>
                        </>):(
                          <span style={{fontSize:13,color:"var(--text-2)"}}>{fmt(s.Soni)} × {fmt(s.Som_Narx)} = <b style={{color:"var(--text)"}}>{fmtSom(jami)}</b></span>
                        )}
                      </div>
                    </div>
                  </div>
                );
                return (
                  <div key={s.Savat_ID||i} style={{display:"grid",minWidth:isMobile?640:undefined,gridTemplateColumns:"36px 1fr 56px 76px 100px 60px 80px 52px",padding:"10px 20px",alignItems:"center",borderBottom:i<savatSom.length-1?"1px solid var(--border)":"none",background:sel?"#f0f9ff":"transparent"}}>
                    <input type="checkbox" checked={sel} onChange={()=>toggleBulkRow(s.Savat_ID,s.Soni,s.Som_Narx)} style={{width:17,height:17,cursor:"pointer"}}/>
                    {sel
                      ? <SearchSelect items={mhItems} value={e.Mahsulot||s.Mahsulot_ID} onChange={v=>setBulkEdits(prev=>{const cur=prev[s.Savat_ID]||{Soni:s.Soni,Narx:s.Som_Narx,Mahsulot:s.Mahsulot_ID};const mm=mMap[v];return{...prev,[s.Savat_ID]:{...cur,Mahsulot:v,Narx:mm?.Sotuv_som||cur.Narx}};})} placeholder="Mahsulot..."/>
                      : <span style={{fontSize:14,fontWeight:600}}>{m?.Nomi||"—"}</span>}
                    {sel
                      ? <input value={e.Soni} onChange={ev=>setBulkVal(s.Savat_ID,"Soni",ev.target.value)} type="number" style={{padding:"6px 10px",border:"1.5px solid var(--primary)",borderRadius:"var(--radius)",fontSize:13,fontWeight:700,outline:"none",textAlign:"center"}}/>
                      : <span style={{fontSize:14,fontWeight:700}}>{fmt(s.Soni)}</span>}
                    {sel
                      ? <input value={e.Narx} onChange={ev=>setBulkVal(s.Savat_ID,"Narx",ev.target.value)} inputMode="decimal" style={{padding:"6px 10px",border:"1.5px solid var(--primary)",borderRadius:"var(--radius)",fontSize:13,fontWeight:700,outline:"none",textAlign:"center"}}/>
                      : <span style={{fontSize:14,fontWeight:700}}>{fmt(s.Som_Narx)}</span>}
                    <span style={{fontSize:14,fontWeight:800,color:sel?"var(--primary)":"var(--text)"}}>{fmtSom(jami)}</span>
                    <span style={{fontSize:12,color:"var(--text-3)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={s.Izoh||""}>{s.Izoh||"—"}</span>
                    <div/><div/>
                  </div>
                );
              }
              if(isMobile) return (
                <div key={s.Savat_ID||i} style={{padding:"12px 16px",borderBottom:i<savatSom.length-1?"1px solid var(--border)":"none",background:isEdit?"#f0f9ff":"transparent"}}>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8,marginBottom:8}}>
                    <div style={{minWidth:0}}><span style={{fontSize:14,fontWeight:700,minWidth:0,overflow:"hidden",textOverflow:"ellipsis"}}>{i+1}. {m?.Nomi||"—"}</span>{s.Vaqt&&s.Vaqt.includes(":")&&<span style={{display:"block",fontSize:11,color:"var(--text-3)",fontWeight:500,marginTop:2}}>{s.Vaqt}</span>}</div>
                    <div style={{display:"flex",gap:4,flexShrink:0}}>
                      {isEdit?(<>
                        <button onClick={handleEditSomSave} disabled={editSomSaving} style={{width:30,height:30,borderRadius:8,border:"none",background:"#dcfce7",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#16a34a"}}>{editSomSaving?<span className="spinner" style={{width:12,height:12}}/>:<svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>}</button>
                        <button onClick={()=>setEditSomRow(null)} style={{width:30,height:30,borderRadius:8,border:"none",background:"#fee2e2",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#ef4444"}}><svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>
                      </>):(<>
                        <button onClick={()=>{setEditSomRow(s);setEditSomMahsulot(s.Mahsulot_ID);setEditSomSoni(s.Soni);setEditSomNarx(s.Som_Narx);setEditSomIzoh(s.Izoh||"");}} style={{width:30,height:30,borderRadius:8,border:"1px solid #dbeafe",background:"#eff6ff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#2563eb"}}><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>
                        <button onClick={()=>setDeleteSomRow(s)} style={{width:30,height:30,borderRadius:8,border:"1px solid #fee2e2",background:"#fef2f2",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#ef4444"}}><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
                      </>)}
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                    {isEdit?(
                      <span style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                        <span style={{flexBasis:"100%"}}><SearchSelect items={mhItems} value={editSomMahsulot} onChange={v=>{setEditSomMahsulot(v);const mm=mMap[v];if(mm)setEditSomNarx(mm.Sotuv_som||editSomNarx);}} placeholder="Mahsulot..."/></span>
                        <input autoFocus value={editSomSoni} onChange={e=>setEditSomSoni(e.target.value)} type="number" style={{width:60,padding:"6px 8px",border:"1.5px solid var(--primary)",borderRadius:"var(--radius)",fontSize:13,fontWeight:700,outline:"none",textAlign:"center"}}/>
                        <span style={{color:"var(--text-3)"}}>×</span>
                        <input value={editSomNarx} onChange={e=>setEditSomNarx(e.target.value)} inputMode="decimal" style={{width:84,padding:"6px 8px",border:"1.5px solid var(--primary)",borderRadius:"var(--radius)",fontSize:13,fontWeight:700,outline:"none",textAlign:"center"}}/>
                        <span style={{fontSize:13,fontWeight:800,color:(num(editSomSoni)*num(editSomNarx))<0?"#ec4899":"var(--primary)"}}>= {fmtSom(num(editSomSoni)*num(editSomNarx))}</span>
                      </span>
                    ):(
                      <span style={{fontSize:13,color:"var(--text-2)"}}>{fmt(s.Soni)} × {fmt(s.Som_Narx)} = <b style={{color:num(s.Summa_som)<0?"#ec4899":"var(--text)",fontSize:14}}>{fmtSom(s.Summa_som)}</b></span>
                    )}
                    <div style={{display:"flex",borderRadius:20,overflow:"hidden",border:"1px solid var(--border)",marginLeft:"auto",opacity:togglingId===s.Savat_ID?0.6:1}}>
                      <button onClick={()=>!delivered&&toggleSomCheck(s)} disabled={togglingId===s.Savat_ID} style={{padding:"5px 12px",border:"none",background:delivered?"#16a34a":"var(--bg)",color:delivered?"#fff":"var(--text-3)",cursor:delivered?"default":"pointer",fontSize:12,fontWeight:700}}>Ha</button>
                      <button onClick={()=>delivered&&toggleSomCheck(s)} disabled={togglingId===s.Savat_ID} style={{padding:"5px 12px",border:"none",background:!delivered?"#ef4444":"var(--bg)",color:!delivered?"#fff":"var(--text-3)",cursor:!delivered?"default":"pointer",fontSize:12,fontWeight:700}}>{togglingId===s.Savat_ID?<span className="spinner" style={{width:8,height:8}}/>:"Yo'q"}</button>
                    </div>
                  </div>
                </div>
              );
              return (
                <div key={s.Savat_ID||i} style={{display:"grid",minWidth:isMobile?640:undefined,gridTemplateColumns:"36px 1fr 56px 76px 100px 60px 80px 52px",padding:isEdit?"8px 20px":"13px 20px",alignItems:"center",borderBottom:i<savatSom.length-1?"1px solid var(--border)":"none",background:isEdit?"#f0f9ff":"transparent"}}>
                  <span style={{fontSize:13,color:"var(--text-3)"}}>{i+1}</span>
                  {isEdit
                    ? <SearchSelect items={mhItems} value={editSomMahsulot} onChange={v=>{setEditSomMahsulot(v);const mm=mMap[v];if(mm)setEditSomNarx(mm.Sotuv_som||editSomNarx);}} placeholder="Mahsulot..."/>
                    : <div style={{minWidth:0}}><span style={{fontSize:14,fontWeight:600}}>{m?.Nomi||"—"}</span>{s.Vaqt&&s.Vaqt.includes(":")&&<span style={{display:"block",fontSize:11,color:"var(--text-3)",fontWeight:500,marginTop:2}}>{s.Vaqt}</span>}</div>}
                  {isEdit?<input type="number" autoFocus value={editSomSoni} onChange={e=>setEditSomSoni(e.target.value)} style={{padding:"6px 10px",border:"1.5px solid var(--primary)",borderRadius:"var(--radius)",fontSize:13,fontWeight:700,outline:"none",textAlign:"center"}}/>
                    :<span style={{fontSize:14,fontWeight:700}}>{fmt(s.Soni)}</span>}
                  {isEdit?<input value={editSomNarx} onChange={e=>setEditSomNarx(e.target.value)} style={{padding:"6px 10px",border:"1.5px solid var(--primary)",borderRadius:"var(--radius)",fontSize:13,fontWeight:700,outline:"none",textAlign:"center"}}/>
                    :<span style={{fontSize:14,fontWeight:700}}>{fmt(s.Som_Narx)}</span>}
                  <span style={{fontSize:14,fontWeight:800,color:(isEdit?(num(editSomSoni)*num(editSomNarx)):num(s.Summa_som))<0?"#ec4899":(isEdit?"var(--primary)":"var(--text)")}}>
                    {isEdit?fmtSom(num(editSomSoni)*num(editSomNarx)):fmtSom(s.Summa_som)}
                  </span>
                  {isEdit
                    ? <input value={editSomIzoh} onChange={e=>setEditSomIzoh(e.target.value)} placeholder="Izoh" style={{padding:"6px 8px",border:"1.5px solid var(--primary)",borderRadius:"var(--radius)",fontSize:12,outline:"none",minWidth:0}}/>
                    : <span style={{fontSize:12,color:"var(--text-3)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={s.Izoh||""}>{s.Izoh||"—"}</span>}
                  <div style={{display:"flex",borderRadius:20,overflow:"hidden",border:"1px solid var(--border)",opacity:togglingId===s.Savat_ID?0.6:1}}>
                    <button onClick={()=>!delivered&&toggleSomCheck(s)} disabled={togglingId===s.Savat_ID}
                      style={{padding:"5px 12px",border:"none",background:delivered?"#16a34a":"var(--bg)",color:delivered?"#fff":"var(--text-3)",cursor:delivered?"default":"pointer",fontSize:12,fontWeight:700,transition:"background .15s"}}>
                      Ha
                    </button>
                    <button onClick={()=>delivered&&toggleSomCheck(s)} disabled={togglingId===s.Savat_ID}
                      style={{padding:"5px 12px",border:"none",background:!delivered?"#ef4444":"var(--bg)",color:!delivered?"#fff":"var(--text-3)",cursor:!delivered?"default":"pointer",fontSize:12,fontWeight:700,transition:"background .15s"}}>
                      {togglingId===s.Savat_ID?<span className="spinner" style={{width:8,height:8}}/>:"Yo'q"}
                    </button>
                  </div>
                  <div style={{display:"flex",gap:4}}>
                    {isEdit?(
                      <>
                        <button onClick={handleEditSomSave} disabled={editSomSaving} style={{width:30,height:30,borderRadius:8,border:"none",background:"#dcfce7",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#16a34a"}}>
                          {editSomSaving?<span className="spinner" style={{width:12,height:12}}/>:<svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>}
                        </button>
                        <button onClick={()=>setEditSomRow(null)} style={{width:30,height:30,borderRadius:8,border:"none",background:"#fee2e2",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#ef4444"}}>
                          <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                      </>
                    ):(
                      <>
                        <button onClick={()=>{setEditSomRow(s);setEditSomMahsulot(s.Mahsulot_ID);setEditSomSoni(s.Soni);setEditSomNarx(s.Som_Narx);setEditSomIzoh(s.Izoh||"");}} style={{width:30,height:30,borderRadius:8,border:"none",background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#2563eb"}} onMouseEnter={e=>(e.currentTarget.style.background="#dbeafe")} onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </button>
                        <button onClick={()=>setDeleteSomRow(s)} style={{width:30,height:30,borderRadius:8,border:"none",background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#ef4444"}} onMouseEnter={e=>(e.currentTarget.style.background="#fee2e2")} onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            {addSomRows.map((row,ri)=>(isMobile ? (
              <div key={row.id} ref={ri===addSomRows.length-1?addSomRef:undefined} style={{padding:"10px 14px",borderTop:(savatSom.length>0||ri>0)?"1px solid var(--border)":"none",background:"#f0f9ff"}}>
                <div style={{display:"grid",gridTemplateColumns:"13px minmax(0,1fr) 40px 54px minmax(46px,auto)",gap:5,alignItems:"center"}}>
                  <span style={{fontSize:12,fontWeight:700,color:"var(--text-3)",textAlign:"center"}}>{savatSom.length+ri+1}</span>
                  <SearchSelect items={mhItems} value={row.Mahsulot_ID} onChange={id=>updSomRow(row.id,"Mahsulot_ID",id)} placeholder="Mahsulot..." compact/>
                  <input value={row.Soni} onChange={e=>updSomRow(row.id,"Soni",e.target.value)} placeholder="0" type="number"
                    style={{minWidth:0,width:"100%",padding:"9px 2px",border:"1.5px solid var(--primary)",borderRadius:8,fontSize:13,fontWeight:700,outline:"none",textAlign:"center",boxSizing:"border-box"}}/>
                  <input value={row.Narx} onChange={e=>updSomRow(row.id,"Narx",e.target.value)} placeholder="Narx" inputMode="decimal"
                    style={{minWidth:0,width:"100%",padding:"9px 2px",border:"1.5px solid var(--primary)",borderRadius:8,fontSize:13,fontWeight:700,outline:"none",textAlign:"center",boxSizing:"border-box"}}/>
                  {(num(row.Soni)*num(row.Narx))
                    ? <span style={{minWidth:0,fontSize:13,fontWeight:800,textAlign:"right",color:"var(--primary)",whiteSpace:"nowrap"}}>{(num(row.Soni)*num(row.Narx)).toLocaleString("ru-RU")}</span>
                    : <button onClick={()=>rmSomRow(row.id)} title="Qatorni o'chirish" style={{justifySelf:"end",width:30,height:28,borderRadius:6,border:"1px solid #fecaca",background:"#fef2f2",color:"#ef4444",cursor:"pointer",fontSize:18,fontWeight:700,lineHeight:1,display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>−</button>}
                </div>
              </div>
            ) : (
              <div key={row.id} ref={ri===addSomRows.length-1?addSomRef:undefined} style={{display:"grid",gridTemplateColumns:"36px 1fr 56px 76px 100px 60px 80px 52px",padding:"8px 20px",alignItems:"center",borderTop:(savatSom.length>0||ri>0)?"1px solid var(--border)":"none",background:"#f0f9ff"}}>
                <span style={{fontSize:13,color:"var(--text-3)"}}>{savatSom.length+ri+1}</span>
                <div style={{paddingRight:8}}>
                  <SearchSelect items={mhItems} value={row.Mahsulot_ID} onChange={id=>updSomRow(row.id,"Mahsulot_ID",id)} placeholder="Mahsulot..."/>
                </div>
                <input type="number" value={row.Soni} onChange={e=>updSomRow(row.id,"Soni",e.target.value)} placeholder="Soni"
                  style={{padding:"6px 10px",border:"1.5px solid var(--primary)",borderRadius:"var(--radius)",fontSize:13,fontWeight:700,outline:"none",textAlign:"center"}}/>
                <input value={row.Narx} onChange={e=>updSomRow(row.id,"Narx",e.target.value)} placeholder="Narx"
                  style={{padding:"6px 10px",border:"1.5px solid var(--primary)",borderRadius:"var(--radius)",fontSize:13,fontWeight:700,outline:"none",textAlign:"center"}}/>
                <span style={{fontSize:14,fontWeight:800,color:"var(--primary)"}}>{fmtSom(num(row.Soni)*num(row.Narx))}</span>
                <input value={row.Izoh} onChange={e=>updSomRow(row.id,"Izoh",e.target.value)} placeholder="Izoh"
                  style={{padding:"6px 8px",border:"1px solid var(--border)",borderRadius:"var(--radius)",fontSize:12,outline:"none",minWidth:0}}/>
                <div/>
                <div style={{display:"flex",gap:4}}>
                  <button onClick={()=>saveAddRow(row,"som")} disabled={!row.Mahsulot_ID||!row.Soni||savingIds.has(row.id)||priceBelowCost(row.Mahsulot_ID,row.Narx,"som")}
                    style={{width:30,height:30,borderRadius:8,border:"none",background:"#dcfce7",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#16a34a"}}>
                    {savingIds.has(row.id)?<span className="spinner" style={{width:13,height:13}}/>:<svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>}
                  </button>
                  <button onClick={()=>rmSomRow(row.id)}
                    style={{width:30,height:30,borderRadius:8,border:"none",background:"#fee2e2",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#ef4444"}}>
                    <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>
            )))}
            {!bulkMode && (
              <div style={{padding:isMobile?"8px 14px 12px":"10px 20px 14px"}}>
                <button onClick={()=>isMobile?openAddItem("som"):addSomBlank()} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,width:"100%",padding:"11px 14px",border:"1px solid var(--border)",borderRadius:10,fontSize:13,fontWeight:600,background:"var(--white)",cursor:"pointer",color:"var(--text-2)"}}>
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg> Qo&apos;shish
                </button>
              </div>
            )}
          </div>
        )}

        {/* Dollar mahsulotlar */}
        {(savatDollar.length>0||addDollarRows.length>0||savatSom.length>0||addSomRows.length>0)&&(
        <div style={{background:"var(--white)",borderRadius:"var(--radius-xl)",boxShadow:"var(--shadow-sm)",overflowX:isMobile?"auto":undefined}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px",borderBottom:"1px solid var(--border)",borderRadius:"var(--radius-xl) var(--radius-xl) 0 0",overflow:"hidden"}}>
            {isMobile?<span style={{fontSize:13,fontWeight:700,color:"#2563eb",letterSpacing:".05em"}}>DOLLAR SAVAT</span>:<span style={{fontSize:15,fontWeight:700}}>Dollar mahsulotlar</span>}
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>bulkMode?exitBulk():setBulkMode(true)} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 14px",border:`1px solid ${bulkMode?"var(--primary)":"var(--border)"}`,borderRadius:"var(--radius)",background:bulkMode?"var(--primary-glow)":"var(--white)",cursor:"pointer",fontSize:13,fontWeight:600,color:bulkMode?"var(--primary)":"var(--text-2)"}}>
                <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg> {bulkMode?"Bekor":"Ommaviy"}
              </button>
            </div>
          </div>
          {(savatDollar.length>0||addDollarRows.length>0) && (!isMobile ? (
          <div style={{display:"grid",gridTemplateColumns:"36px 1fr 56px 76px 100px 60px 80px 52px",padding:"10px 20px",background:"var(--bg)",borderBottom:"1px solid var(--border)",alignItems:"center"}}>
            {bulkMode
              ? <input type="checkbox" checked={savatDollar.length>0&&savatDollar.every(r=>bulkSel.has(r.Savat_ID))} onChange={()=>toggleAllBulk(savatDollar.map(r=>({Savat_ID:r.Savat_ID,Soni:r.Soni,narx:r.Narx})))} style={{width:17,height:17,cursor:"pointer"}}/>
              : <span style={{fontSize:10,fontWeight:700,color:"var(--text-3)",letterSpacing:".05em"}}>#</span>}
            {["MAHSULOT","SONI","NARX ($)","JAMI ($)",bulkMode?"":"YETKAZIB BERILDIMI?",""].map((h,hi)=><span key={hi} style={{fontSize:10,fontWeight:700,color:"var(--text-3)",letterSpacing:".05em"}}>{h}</span>)}
          </div>
          ) : bulkMode ? (
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"11px 16px",background:"var(--bg)",borderBottom:"1px solid var(--border)"}}>
            <input type="checkbox" checked={savatDollar.length>0&&savatDollar.every(r=>bulkSel.has(r.Savat_ID))} onChange={()=>toggleAllBulk(savatDollar.map(r=>({Savat_ID:r.Savat_ID,Soni:r.Soni,narx:r.Narx})))} style={{width:18,height:18,cursor:"pointer"}}/>
            <span style={{fontSize:12,fontWeight:700,color:"var(--text-2)"}}>Hammasini tanlash</span>
          </div>
          ) : null)}
          {savatDollar.filter(s=>!savatSearch||(mMap[s.Mahsulot_ID]?.Nomi||"").toLowerCase().includes(savatSearch.toLowerCase())).map((s,i)=>{
            const m=mMap[s.Mahsulot_ID];
            const isEdit=editDollarRow?.Savat_ID===s.Savat_ID;
            const delivered=s.Check!=="FALSE";
            if(bulkMode){
              const sel=bulkSel.has(s.Savat_ID);
              const e=bulkEdits[s.Savat_ID]||{Soni:s.Soni,Narx:s.Narx,Mahsulot:s.Mahsulot_ID};
              const jami=sel?num(e.Soni)*num(e.Narx):num(s.Summa);
              if(isMobile) return (
                <div key={s.Savat_ID||i} style={{padding:"10px 16px",borderBottom:i<savatDollar.length-1?"1px solid var(--border)":"none",background:sel?"#eff6ff":"transparent",display:"flex",alignItems:"center",gap:10}}>
                  <input type="checkbox" checked={sel} onChange={()=>toggleBulkRow(s.Savat_ID,s.Soni,s.Narx)} style={{width:18,height:18,cursor:"pointer",flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    {sel
                      ? <SearchSelect items={mhItems} value={e.Mahsulot||s.Mahsulot_ID} onChange={v=>setBulkEdits(prev=>{const cur=prev[s.Savat_ID]||{Soni:s.Soni,Narx:s.Narx,Mahsulot:s.Mahsulot_ID};const mm=mMap[v];return{...prev,[s.Savat_ID]:{...cur,Mahsulot:v,Narx:mm?.Sotuv_dollar||cur.Narx}};})} placeholder="Mahsulot..."/>
                      : <div style={{fontSize:14,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m?.Nomi||"—"}</div>}
                    <div style={{display:"flex",alignItems:"center",gap:6,marginTop:5,flexWrap:"wrap"}}>
                      {sel?(<>
                        <input value={e.Soni} onChange={ev=>setBulkVal(s.Savat_ID,"Soni",ev.target.value)} type="number" style={{width:56,padding:"6px 8px",border:"1.5px solid #2563eb",borderRadius:"var(--radius)",fontSize:13,fontWeight:700,outline:"none",textAlign:"center"}}/>
                        <span style={{color:"var(--text-3)"}}>×</span>
                        <input value={e.Narx} onChange={ev=>setBulkVal(s.Savat_ID,"Narx",ev.target.value)} inputMode="decimal" style={{width:80,padding:"6px 8px",border:"1.5px solid #2563eb",borderRadius:"var(--radius)",fontSize:13,fontWeight:700,outline:"none",textAlign:"center",color:"#2563eb"}}/>
                        <span style={{fontSize:13,fontWeight:800,color:"#2563eb"}}>= {fmtUsd(jami)}</span>
                      </>):(
                        <span style={{fontSize:13,color:"var(--text-2)"}}>{fmt(s.Soni)} × <span style={{color:"#2563eb"}}>{fmtUsd(s.Narx)}</span> = <b style={{color:"var(--text)"}}>{fmtUsd(jami)}</b></span>
                      )}
                    </div>
                  </div>
                </div>
              );
              return (
                <div key={s.Savat_ID||i} style={{display:"grid",minWidth:isMobile?640:undefined,gridTemplateColumns:"36px 1fr 56px 76px 100px 60px 80px 52px",padding:"10px 20px",alignItems:"center",borderBottom:i<savatDollar.length-1?"1px solid var(--border)":"none",background:sel?"#eff6ff":"transparent"}}>
                  <input type="checkbox" checked={sel} onChange={()=>toggleBulkRow(s.Savat_ID,s.Soni,s.Narx)} style={{width:17,height:17,cursor:"pointer"}}/>
                  {sel
                    ? <SearchSelect items={mhItems} value={e.Mahsulot||s.Mahsulot_ID} onChange={v=>setBulkEdits(prev=>{const cur=prev[s.Savat_ID]||{Soni:s.Soni,Narx:s.Narx,Mahsulot:s.Mahsulot_ID};const mm=mMap[v];return{...prev,[s.Savat_ID]:{...cur,Mahsulot:v,Narx:mm?.Sotuv_dollar||cur.Narx}};})} placeholder="Mahsulot..."/>
                    : <span style={{fontSize:14,fontWeight:600}}>{m?.Nomi||"—"}</span>}
                  {sel
                    ? <input value={e.Soni} onChange={ev=>setBulkVal(s.Savat_ID,"Soni",ev.target.value)} type="number" style={{padding:"6px 10px",border:"1.5px solid #2563eb",borderRadius:"var(--radius)",fontSize:13,fontWeight:700,outline:"none",textAlign:"center"}}/>
                    : <span style={{fontSize:14,fontWeight:700}}>{fmt(s.Soni)}</span>}
                  {sel
                    ? <input value={e.Narx} onChange={ev=>setBulkVal(s.Savat_ID,"Narx",ev.target.value)} inputMode="decimal" style={{padding:"6px 10px",border:"1.5px solid #2563eb",borderRadius:"var(--radius)",fontSize:13,fontWeight:700,outline:"none",textAlign:"center",color:"#2563eb"}}/>
                    : <span style={{fontSize:14,fontWeight:700,color:"#2563eb"}}>{fmtUsd(s.Narx)}</span>}
                  <span style={{fontSize:14,fontWeight:800,color:sel?"#2563eb":"var(--text)"}}>{fmtUsd(jami)}</span>
                  <span style={{fontSize:12,color:"var(--text-3)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={s.Izoh||""}>{s.Izoh||"—"}</span>
                  <div/><div/>
                </div>
              );
            }
            if(isMobile) return (
              <div key={s.Savat_ID||i} style={{padding:"12px 16px",borderBottom:i<savatDollar.length-1?"1px solid var(--border)":"none",background:isEdit?"#eff6ff":"transparent"}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8,marginBottom:8}}>
                  <span style={{fontSize:14,fontWeight:700,minWidth:0,overflow:"hidden",textOverflow:"ellipsis"}}>{i+1}. {m?.Nomi||"—"}</span>
                  <div style={{display:"flex",gap:4,flexShrink:0}}>
                    {isEdit?(<>
                      <button onClick={handleEditDollarSave} disabled={editDollarSaving} style={{width:30,height:30,borderRadius:8,border:"none",background:"#dcfce7",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#16a34a"}}>{editDollarSaving?<span className="spinner" style={{width:12,height:12}}/>:<svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>}</button>
                      <button onClick={()=>setEditDollarRow(null)} style={{width:30,height:30,borderRadius:8,border:"none",background:"#fee2e2",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#ef4444"}}><svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>
                    </>):(<>
                      <button onClick={()=>{setEditDollarRow(s);setEditDollarMahsulot(s.Mahsulot_ID);setEditDollarSoni(s.Soni);setEditDollarNarx(s.Narx);setEditDollarIzoh(s.Izoh||"");}} style={{width:30,height:30,borderRadius:8,border:"1px solid #dbeafe",background:"#eff6ff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#2563eb"}}><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>
                      <button onClick={()=>setDeleteDollarRow(s)} style={{width:30,height:30,borderRadius:8,border:"1px solid #fee2e2",background:"#fef2f2",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#ef4444"}}><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
                    </>)}
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                  {isEdit?(
                    <span style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                      <span style={{flexBasis:"100%"}}><SearchSelect items={mhItems} value={editDollarMahsulot} onChange={v=>{setEditDollarMahsulot(v);const mm=mMap[v];if(mm)setEditDollarNarx(mm.Sotuv_dollar||editDollarNarx);}} placeholder="Mahsulot..."/></span>
                      <input autoFocus value={editDollarSoni} onChange={e=>setEditDollarSoni(e.target.value)} type="number" style={{width:60,padding:"6px 8px",border:"1.5px solid #2563eb",borderRadius:"var(--radius)",fontSize:13,fontWeight:700,outline:"none",textAlign:"center"}}/>
                      <span style={{color:"var(--text-3)"}}>×</span>
                      <input value={editDollarNarx} onChange={e=>setEditDollarNarx(e.target.value)} inputMode="decimal" style={{width:84,padding:"6px 8px",border:"1.5px solid #2563eb",borderRadius:"var(--radius)",fontSize:13,fontWeight:700,outline:"none",textAlign:"center",color:"#2563eb"}}/>
                      <span style={{fontSize:13,fontWeight:800,color:(num(editDollarSoni)*num(editDollarNarx))<0?"#ec4899":"#2563eb"}}>= {fmtUsd(num(editDollarSoni)*num(editDollarNarx))}</span>
                    </span>
                  ):(
                    <span style={{fontSize:13,color:"var(--text-2)"}}>{fmt(s.Soni)} × <span style={{color:"#2563eb"}}>{fmtUsd(s.Narx)}</span> = <b style={{color:num(s.Summa)<0?"#ec4899":"var(--text)",fontSize:14}}>{fmtUsd(s.Summa)}</b></span>
                  )}
                  <div style={{display:"flex",borderRadius:20,overflow:"hidden",border:"1px solid var(--border)",marginLeft:"auto",opacity:togglingId===s.Savat_ID?0.6:1}}>
                    <button onClick={()=>!delivered&&toggleDollarCheck(s)} disabled={togglingId===s.Savat_ID} style={{padding:"5px 12px",border:"none",background:delivered?"#16a34a":"var(--bg)",color:delivered?"#fff":"var(--text-3)",cursor:delivered?"default":"pointer",fontSize:12,fontWeight:700}}>Ha</button>
                    <button onClick={()=>delivered&&toggleDollarCheck(s)} disabled={togglingId===s.Savat_ID} style={{padding:"5px 12px",border:"none",background:!delivered?"#ef4444":"var(--bg)",color:!delivered?"#fff":"var(--text-3)",cursor:!delivered?"default":"pointer",fontSize:12,fontWeight:700}}>{togglingId===s.Savat_ID?<span className="spinner" style={{width:8,height:8}}/>:"Yo'q"}</button>
                  </div>
                </div>
              </div>
            );
            return (
              <div key={s.Savat_ID||i} style={{display:"grid",minWidth:isMobile?640:undefined,gridTemplateColumns:"36px 1fr 56px 76px 100px 60px 80px 52px",padding:isEdit?"8px 20px":"13px 20px",alignItems:"center",borderBottom:i<savatDollar.length-1?"1px solid var(--border)":"none",background:isEdit?"#eff6ff":"transparent"}}>
                <span style={{fontSize:13,color:"var(--text-3)"}}>{i+1}</span>
                {isEdit
                  ? <SearchSelect items={mhItems} value={editDollarMahsulot} onChange={v=>{setEditDollarMahsulot(v);const mm=mMap[v];if(mm)setEditDollarNarx(mm.Sotuv_dollar||editDollarNarx);}} placeholder="Mahsulot..."/>
                  : <div style={{minWidth:0}}><span style={{fontSize:14,fontWeight:600}}>{m?.Nomi||"—"}</span>{s.Vaqt&&s.Vaqt.includes(":")&&<span style={{display:"block",fontSize:11,color:"var(--text-3)",fontWeight:500,marginTop:2}}>{s.Vaqt}</span>}</div>}
                {isEdit?<input type="number" autoFocus value={editDollarSoni} onChange={e=>setEditDollarSoni(e.target.value)} style={{padding:"6px 10px",border:"1.5px solid #2563eb",borderRadius:"var(--radius)",fontSize:13,fontWeight:700,outline:"none",textAlign:"center"}}/>
                  :<span style={{fontSize:14,fontWeight:700}}>{fmt(s.Soni)}</span>}
                {isEdit?<input value={editDollarNarx} onChange={e=>setEditDollarNarx(e.target.value)} style={{padding:"6px 10px",border:"1.5px solid #2563eb",borderRadius:"var(--radius)",fontSize:13,fontWeight:700,outline:"none",textAlign:"center",color:"#2563eb"}}/>
                  :<span style={{fontSize:14,fontWeight:700,color:"#2563eb"}}>{fmtUsd(s.Narx)}</span>}
                <span style={{fontSize:14,fontWeight:800,color:(isEdit?(num(editDollarSoni)*num(editDollarNarx)):num(s.Summa))<0?"#ec4899":(isEdit?"#2563eb":"var(--text)")}}>
                  {isEdit?fmtUsd(num(editDollarSoni)*num(editDollarNarx)):fmtUsd(s.Summa)}
                </span>
                {isEdit
                  ? <input value={editDollarIzoh} onChange={e=>setEditDollarIzoh(e.target.value)} placeholder="Izoh" style={{padding:"6px 8px",border:"1.5px solid #2563eb",borderRadius:"var(--radius)",fontSize:12,outline:"none",minWidth:0}}/>
                  : <span style={{fontSize:12,color:"var(--text-3)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={s.Izoh||""}>{s.Izoh||"—"}</span>}
                <div style={{display:"flex",borderRadius:20,overflow:"hidden",border:"1px solid var(--border)",opacity:togglingId===s.Savat_ID?0.6:1}}>
                  <button onClick={()=>!delivered&&toggleDollarCheck(s)} disabled={togglingId===s.Savat_ID}
                    style={{padding:"5px 12px",border:"none",background:delivered?"#16a34a":"var(--bg)",color:delivered?"#fff":"var(--text-3)",cursor:delivered?"default":"pointer",fontSize:12,fontWeight:700,transition:"background .15s"}}>
                    Ha
                  </button>
                  <button onClick={()=>delivered&&toggleDollarCheck(s)} disabled={togglingId===s.Savat_ID}
                    style={{padding:"5px 12px",border:"none",background:!delivered?"#ef4444":"var(--bg)",color:!delivered?"#fff":"var(--text-3)",cursor:!delivered?"default":"pointer",fontSize:12,fontWeight:700,transition:"background .15s"}}>
                    {togglingId===s.Savat_ID?<span className="spinner" style={{width:8,height:8}}/>:"Yo'q"}
                  </button>
                </div>
                <div style={{display:"flex",gap:4}}>
                  {isEdit?(
                    <>
                      <button onClick={handleEditDollarSave} disabled={editDollarSaving} style={{width:30,height:30,borderRadius:8,border:"none",background:"#dcfce7",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#16a34a"}}>
                        {editDollarSaving?<span className="spinner" style={{width:12,height:12}}/>:<svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>}
                      </button>
                      <button onClick={()=>setEditDollarRow(null)} style={{width:30,height:30,borderRadius:8,border:"none",background:"#fee2e2",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#ef4444"}}>
                        <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>
                    </>
                  ):(
                    <>
                      <button onClick={()=>{setEditDollarRow(s);setEditDollarMahsulot(s.Mahsulot_ID);setEditDollarSoni(s.Soni);setEditDollarNarx(s.Narx);setEditDollarIzoh(s.Izoh||"");}} style={{width:30,height:30,borderRadius:8,border:"none",background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#2563eb"}} onMouseEnter={e=>(e.currentTarget.style.background="#dbeafe")} onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                      </button>
                      <button onClick={()=>setDeleteDollarRow(s)} style={{width:30,height:30,borderRadius:8,border:"none",background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#ef4444"}} onMouseEnter={e=>(e.currentTarget.style.background="#fee2e2")} onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {addDollarRows.map((row,ri)=>(isMobile ? (
            <div key={row.id} ref={ri===addDollarRows.length-1?addDollarRef:undefined} style={{padding:"10px 14px",borderTop:(savatDollar.length>0||ri>0)?"1px solid var(--border)":"none",background:"#eff6ff"}}>
              <div style={{display:"grid",gridTemplateColumns:"13px minmax(0,1fr) 40px 54px minmax(46px,auto)",gap:5,alignItems:"center"}}>
                <span style={{fontSize:12,fontWeight:700,color:"var(--text-3)",textAlign:"center"}}>{savatDollar.length+ri+1}</span>
                <SearchSelect items={mhItems} value={row.Mahsulot_ID} onChange={id=>updDollarRow(row.id,"Mahsulot_ID",id)} placeholder="Mahsulot..." compact/>
                <input value={row.Soni} onChange={e=>updDollarRow(row.id,"Soni",e.target.value)} placeholder="0" type="number"
                  style={{minWidth:0,width:"100%",padding:"9px 2px",border:"1.5px solid #2563eb",borderRadius:8,fontSize:13,fontWeight:700,outline:"none",textAlign:"center",boxSizing:"border-box"}}/>
                <input value={row.Narx} onChange={e=>updDollarRow(row.id,"Narx",e.target.value)} placeholder="$" inputMode="decimal"
                  style={{minWidth:0,width:"100%",padding:"9px 2px",border:"1.5px solid #2563eb",borderRadius:8,fontSize:13,fontWeight:700,outline:"none",textAlign:"center",color:"#2563eb",boxSizing:"border-box"}}/>
                {(num(row.Soni)*num(row.Narx))
                  ? <span style={{minWidth:0,fontSize:13,fontWeight:800,textAlign:"right",color:"#2563eb",whiteSpace:"nowrap"}}>{fmtUsd(num(row.Soni)*num(row.Narx))}</span>
                  : <button onClick={()=>rmDollarRow(row.id)} title="Qatorni o'chirish" style={{justifySelf:"end",width:30,height:28,borderRadius:6,border:"1px solid #fecaca",background:"#fef2f2",color:"#ef4444",cursor:"pointer",fontSize:18,fontWeight:700,lineHeight:1,display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>−</button>}
              </div>
            </div>
          ) : (
            <div key={row.id} ref={ri===addDollarRows.length-1?addDollarRef:undefined} style={{display:"grid",gridTemplateColumns:"36px 1fr 56px 76px 100px 60px 80px 52px",padding:"8px 20px",alignItems:"center",borderTop:(savatDollar.length>0||ri>0)?"1px solid var(--border)":"none",background:"#eff6ff"}}>
              <span style={{fontSize:13,color:"var(--text-3)"}}>{savatDollar.length+ri+1}</span>
              <div style={{paddingRight:8}}>
                <SearchSelect items={mhItems} value={row.Mahsulot_ID} onChange={id=>updDollarRow(row.id,"Mahsulot_ID",id)} placeholder="Mahsulot..."/>
              </div>
              <input type="number" value={row.Soni} onChange={e=>updDollarRow(row.id,"Soni",e.target.value)} placeholder="Soni"
                style={{padding:"6px 10px",border:"1.5px solid #2563eb",borderRadius:"var(--radius)",fontSize:13,fontWeight:700,outline:"none",textAlign:"center"}}/>
              <input value={row.Narx} onChange={e=>updDollarRow(row.id,"Narx",e.target.value)} placeholder="Narx ($)" inputMode="decimal"
                style={{padding:"6px 10px",border:`1.5px solid ${priceBelowCost(row.Mahsulot_ID,row.Narx,"dollar")?"#ef4444":"#2563eb"}`,borderRadius:"var(--radius)",fontSize:13,fontWeight:700,outline:"none",textAlign:"center",color:priceBelowCost(row.Mahsulot_ID,row.Narx,"dollar")?"#ef4444":"#2563eb"}}/>
              <span style={{fontSize:14,fontWeight:800,color:priceBelowCost(row.Mahsulot_ID,row.Narx,"dollar")?"#ef4444":"#2563eb"}}>{priceBelowCost(row.Mahsulot_ID,row.Narx,"dollar")?"Tan narxidan past!":fmtUsd(num(row.Soni)*num(row.Narx))}</span>
              <input value={row.Izoh} onChange={e=>updDollarRow(row.id,"Izoh",e.target.value)} placeholder="Izoh"
                style={{padding:"6px 8px",border:"1px solid var(--border)",borderRadius:"var(--radius)",fontSize:12,outline:"none",minWidth:0}}/>
              <div/>
              <div style={{display:"flex",gap:4}}>
                <button onClick={()=>saveAddRow(row,"dollar")} disabled={!row.Mahsulot_ID||!row.Soni||savingIds.has(row.id)||priceBelowCost(row.Mahsulot_ID,row.Narx,"dollar")}
                  style={{width:30,height:30,borderRadius:8,border:"none",background:"#dcfce7",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#16a34a"}}>
                  {savingIds.has(row.id)?<span className="spinner" style={{width:13,height:13}}/>:<svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>}
                </button>
                <button onClick={()=>rmDollarRow(row.id)}
                  style={{width:30,height:30,borderRadius:8,border:"none",background:"#fee2e2",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#ef4444"}}>
                  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            </div>
          )))}
          {!bulkMode && (
            <div style={{padding:isMobile?"8px 14px 12px":"10px 20px 14px"}}>
              <button onClick={()=>isMobile?openAddItem("dollar"):addDollarBlank()} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,width:"100%",padding:"11px 14px",border:"1px solid var(--border)",borderRadius:10,fontSize:13,fontWeight:600,background:"var(--white)",cursor:"pointer",color:"var(--text-2)"}}>
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg> Qo&apos;shish
              </button>
            </div>
          )}
        </div>
        )}
        </div>

        {/* Ommaviy tahrirlash — pastki saqlash paneli (jonli jami summa bilan) */}
        {bulkMode&&(()=>{
          const bSom = savatSom.filter(r=>bulkSel.has(r.Savat_ID)).reduce((t,r)=>{const e=bulkEdits[r.Savat_ID]; return t+(e?num(e.Soni)*num(e.Narx):num(r.Summa_som));},0);
          const bDol = savatDollar.filter(r=>bulkSel.has(r.Savat_ID)).reduce((t,r)=>{const e=bulkEdits[r.Savat_ID]; return t+(e?num(e.Soni)*num(e.Narx):num(r.Summa));},0);
          return (
          <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:60,background:"var(--white)",borderTop:"1px solid var(--border)",boxShadow:"0 -4px 20px rgba(30,64,124,.14)",padding:"12px 20px",display:"flex",alignItems:"center",justifyContent:"center",gap:14,flexWrap:"wrap"}}>
            <span style={{fontSize:13,fontWeight:700,color:"var(--text-2)"}}>{bulkSel.size} ta tanlandi</span>
            {bSom>0&&<span style={{fontSize:14,fontWeight:800,color:"#16a34a"}}>Jami: {bSom.toLocaleString("ru-RU")} so&apos;m</span>}
            {bDol>0&&<span style={{fontSize:14,fontWeight:800,color:"#2563eb"}}>Jami: {fmtUsd(bDol)}</span>}
            <button onClick={exitBulk} className="btn btn--outline" disabled={bulkSaving}>Bekor</button>
            <button onClick={handleBulkSave} className="btn btn--primary" disabled={bulkSaving||bulkSel.size===0}>
              {bulkSaving?<span className="spinner"/>:null}{bulkSaving?"Saqlanmoqda...":"Saqlash"}
            </button>
          </div>
          );
        })()}
        {savatSom.length===0&&savatDollar.length===0&&addSomRows.length===0&&addDollarRows.length===0&&(
          <div style={{marginTop:24,background:"var(--white)",borderRadius:"var(--radius-xl)",boxShadow:"var(--shadow-sm)",padding:"32px 20px",textAlign:"center"}}>
            <p style={{color:"var(--text-3)",fontSize:13,marginBottom:12}}>Savat bo&apos;sh</p>
            <button onClick={()=>isMobile?openAddItem("som"):addSomBlank()} className="btn btn--primary">
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg> Mahsulot qo&apos;shish
            </button>
          </div>
        )}

      </div>

      {/* ── Edit/Add Modal ── */}
      {editOpen&&(
        <div style={{position:"fixed",inset:0,zIndex:50,background:"rgba(15,42,76,.42)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",padding:isMobile?0:20}} onClick={()=>setEditOpen(false)}>
          <div style={{background:"var(--white)",borderRadius:isMobile?0:16,width:isMobile?"100%":"97vw",maxWidth:isMobile?"100%":1500,height:isMobile?"100dvh":"97vh",display:"flex",flexDirection:"column",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",gap:16,padding:isMobile?"16px":"20px 24px",borderBottom:"1px solid var(--border)"}}>
              <div style={{flex:1}}>
                <h2 style={{fontSize:17,fontWeight:800,marginBottom:2}}>{isAddMode?"Mahsulot qo'shish":"Tahrirlash"}</h2>
                <p style={{fontSize:12,color:"var(--text-3)"}}>Sotuv #{sotuv.Sotuv_Raqami} — {mjNomi}</p>
              </div>
              <button onClick={()=>setEditOpen(false)} style={{width:36,height:36,borderRadius:8,border:"1px solid var(--border)",background:"var(--white)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:isMobile?"16px":"20px 24px"}}>
              {!isAddMode&&(
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:"var(--text-2)",display:"block",marginBottom:6}}>Mijoz *</label>
                    <SearchSelect items={mJItems} value={editMijoz} onChange={setEditMijoz} placeholder="Mijoz tanlang..."/>
                  </div>
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:"var(--text-2)",display:"block",marginBottom:6}}>Agent *</label>
                    <SearchSelect items={aItems} value={editAgent} onChange={setEditAgent} placeholder="Agent tanlang..."/>
                  </div>
                  <div style={{gridColumn:"1/-1"}}>
                    <label style={{fontSize:12,fontWeight:600,color:"var(--text-2)",display:"block",marginBottom:6}}>Izoh</label>
                    <IzohSelect value={editIzoh} onChange={v=>setEditIzoh(v)} options={izohOptsSotuv} placeholder="Ixtiyoriy..."
                      style={{width:"100%",padding:"10px 12px",border:"1px solid var(--border)",borderRadius:"var(--radius)",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
                  </div>
                </div>
              )}
              {/* Sana + Kurs */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:14,flexWrap:"wrap"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <label style={{fontSize:12,fontWeight:600,color:"var(--text-2)"}}>Sana:</label>
                  <input type="date" value={editSana} onChange={e=>setEditSana(e.target.value)}
                    style={{padding:"8px 10px",border:"1px solid var(--border)",borderRadius:"var(--radius)",fontSize:13,fontWeight:600,outline:"none",background:"var(--white)",color:"var(--text)"}}/>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <label style={{fontSize:12,fontWeight:600,color:"var(--text-2)"}}>Kurs:</label>
                  <input value={editKurs} onChange={e=>setEditKurs(e.target.value)} placeholder="12800" inputMode="numeric"
                    style={{width:110,padding:"8px 10px",border:`1px solid ${num(editKurs)>0&&num(editKurs)<11000?"#ef4444":"var(--border)"}`,borderRadius:"var(--radius)",fontSize:13,fontWeight:600,outline:"none",textAlign:"center"}}/>
                </div>
              </div>
              <SavatEditor items={editItems} onUpdate={updateItem} onRemove={removeItem} onAddSom={addSomItem} onAddDollar={addDollarItem} jamiS={editJamiSom} jamiD={editJamiDollar} kursVal={editKurs} isMobile={isMobile} somItems={mhItems} dollarItems={mhItems} mMap={mMap} simple={isAddMode}/>
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:10,padding:isMobile?"14px 16px":"16px 24px",borderTop:"1px solid var(--border)"}}>
              <button className="btn btn--outline" onClick={()=>setEditOpen(false)}>Bekor</button>
              <button className="btn btn--primary" onClick={handleUpdate}
                disabled={editSaving||editItems.filter(s=>s.Mahsulot_ID&&s.Soni&&(num(s.Som_Narx)||num(s.Narx))).length===0||editItems.some(s=>isBelowCost(s,editKurs||"0",mMap))}>
                {editSaving&&<span className="spinner"/>} Saqlash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete savat row confirms */}
      {deleteSomRow&&(
        <div className="modal-overlay" onClick={()=>setDeleteSomRow(null)}>
          <div className="confirm" onClick={e=>e.stopPropagation()}>
            <div className="confirm__icon"><svg width="24" height="24" fill="none" stroke="#ef4444" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></div>
            <h3 className="confirm__title">Mahsulotni o&apos;chirish</h3>
            <p className="confirm__text"><strong>{mMap[deleteSomRow.Mahsulot_ID]?.Nomi||"Mahsulot"}</strong> savatdan o&apos;chiriladi.</p>
            <div className="confirm__actions">
              <button className="btn btn--outline" style={{flex:1}} onClick={()=>setDeleteSomRow(null)}>Bekor</button>
              <button className="btn btn--red" style={{flex:1}} onClick={async()=>{
                const row=deleteSomRow;
                setDeleteSomRow(null);
                setSavatSom(p=>p.filter(r=>r.Savat_ID!==row.Savat_ID));
                await fetch("/api/sheets",{method:"DELETE",headers:{"Content-Type":"application/json"},
                  body:JSON.stringify({sheet:"Sotuv_Savat",idColumn:"Savat_ID",idValue:row.Savat_ID})});
                afterWrite("Sotuv_Savat");
              }}>O&apos;chirish</button>
            </div>
          </div>
        </div>
      )}
      {deleteDollarRow&&(
        <div className="modal-overlay" onClick={()=>setDeleteDollarRow(null)}>
          <div className="confirm" onClick={e=>e.stopPropagation()}>
            <div className="confirm__icon"><svg width="24" height="24" fill="none" stroke="#ef4444" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></div>
            <h3 className="confirm__title">Mahsulotni o&apos;chirish</h3>
            <p className="confirm__text"><strong>{mMap[deleteDollarRow.Mahsulot_ID]?.Nomi||"Mahsulot"}</strong> savatdan o&apos;chiriladi.</p>
            <div className="confirm__actions">
              <button className="btn btn--outline" style={{flex:1}} onClick={()=>setDeleteDollarRow(null)}>Bekor</button>
              <button className="btn btn--red" style={{flex:1}} onClick={async()=>{
                const row=deleteDollarRow;
                setDeleteDollarRow(null);
                setSavatDollar(p=>p.filter(r=>r.Savat_ID!==row.Savat_ID));
                await fetch("/api/sheets",{method:"DELETE",headers:{"Content-Type":"application/json"},
                  body:JSON.stringify({sheet:"Sotuv_savat_dollar",idColumn:"Savat_ID",idValue:row.Savat_ID})});
                afterWrite("Sotuv_savat_dollar");
              }}>O&apos;chirish</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Tolov Modal ── */}
      {addTolovOpen&&(
        <div style={{position:"fixed",inset:0,zIndex:50,background:"rgba(15,42,76,.42)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={()=>setAddTolovOpen(false)}>
          <div style={{background:"var(--white)",borderRadius:16,width:"100%",maxWidth:480,maxHeight:"90vh",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",gap:14,padding:"16px 20px",borderBottom:"1px solid var(--border)"}}>
              <div style={{width:38,height:38,borderRadius:10,background:"#f0fdf4",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <svg width="17" height="17" fill="none" stroke="#16a34a" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z"/></svg>
              </div>
              <div style={{flex:1}}>
                <h2 style={{fontSize:15,fontWeight:800}}>Yangi to&apos;lov</h2>
                <p style={{fontSize:11,color:"var(--text-3)",marginTop:1}}>{mjNomi} — Sotuv #{sotuv.Sotuv_Raqami}</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textAlign: "center" }}>Sana</span>
                <input type="date" value={addTolovSana} onChange={e => setAddTolovSana(e.target.value)} style={{ fontSize: 12, fontWeight: 600, padding: "6px 8px", border: "1px solid var(--border)", borderRadius: "var(--radius)", outline: "none", textAlign: "center" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textAlign: "center" }}>Vaqt</span>
                <LiveClock style={{ color: "var(--text-3)" }} />
              </div>
              <button onClick={()=>setAddTolovOpen(false)} style={{width:32,height:32,borderRadius:8,border:"1px solid var(--border)",background:"var(--white)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:13,overflowY:"auto"}}>
              {/* Valyuta */}
              <div>
                <label style={{fontSize:12,fontWeight:600,color:"var(--text-2)",display:"block",marginBottom:7}}>Valyuta</label>
                <div style={{display:"flex",borderRadius:"var(--radius)",overflow:"hidden",border:"1.5px solid var(--border)"}}>
                  {(["Som","Dollar"] as const).map(v=>(
                    <button key={v} onClick={()=>setAddTolovValyuta(v)}
                      style={{flex:1,padding:"10px",fontSize:13,fontWeight:700,border:"none",cursor:"pointer",background:addTolovValyuta===v?(v==="Som"?"var(--primary)":"#2563eb"):"var(--white)",color:addTolovValyuta===v?"#fff":"var(--text-3)",borderRight:v==="Som"?"1.5px solid var(--border)":"none"}}>
                      {v==="Som"?"So'm":"Dollar"}
                    </button>
                  ))}
                </div>
              </div>
              {/* Inputs */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:"var(--text-2)",display:"block",marginBottom:5}}>So&apos;m</label>
                  <input value={addTolovSom} onChange={e=>setAddTolovSom(e.target.value)} placeholder="0" inputMode="numeric"
                    style={{width:"100%",padding:"10px 12px",border:"1.5px solid var(--primary)",borderRadius:"var(--radius)",fontSize:14,fontWeight:700,outline:"none",boxSizing:"border-box"}}/>
                </div>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:"#2563eb",display:"block",marginBottom:5}}>Dollar</label>
                  <input value={addTolovDollar} onChange={e=>setAddTolovDollar(e.target.value)} placeholder="0.00" inputMode="decimal"
                    style={{width:"100%",padding:"10px 12px",border:"1.5px solid #2563eb",borderRadius:"var(--radius)",fontSize:14,fontWeight:700,outline:"none",color:"#2563eb",boxSizing:"border-box"}}/>
                </div>
                <div style={{gridColumn:"1/-1"}}>
                  <label style={{fontSize:12,fontWeight:600,color:num(addTolovKurs)<11000?"#ef4444":"var(--text-2)",display:"block",marginBottom:5}}>
                    Dollar kursi <span style={{color:"#ef4444"}}>*</span>
                    {num(addTolovKurs)>0&&num(addTolovKurs)<11000&&<span style={{fontWeight:400,marginLeft:6}}>min: 11 000</span>}
                  </label>
                  <input value={addTolovKurs} onChange={e=>setAddTolovKurs(e.target.value)} placeholder="Min: 11 000" inputMode="numeric"
                    style={{width:"100%",padding:"10px 12px",border:`1.5px solid ${num(addTolovKurs)<11000?"#ef4444":"var(--border)"}`,borderRadius:"var(--radius)",fontSize:14,fontWeight:600,outline:"none",boxSizing:"border-box"}}/>
                </div>
              </div>
              {/* Preview */}
              {(()=>{
                const s=num(addTolovSom),d=num(addTolovDollar),k=num(addTolovKurs);
                const res=addTolovValyuta==="Som"?s+d*k:d+(k>0?s/k:0);
                return res>0?(
                  <div style={{padding:"9px 13px",background:addTolovValyuta==="Som"?"#f0fdf4":"#eff6ff",borderRadius:"var(--radius)",display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:12,fontWeight:600,color:"var(--text-3)"}}>Jami {addTolovValyuta==="Som"?"so'm":"dollar"}:</span>
                    <span style={{fontSize:15,fontWeight:800,color:addTolovValyuta==="Som"?"#16a34a":"#2563eb"}}>
                      {addTolovValyuta==="Som"?res.toLocaleString("ru-RU")+" so'm":"$"+res.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2})}
                    </span>
                  </div>
                ):null;
              })()}
              {/* Turi */}
              <div>
                <label style={{fontSize:12,fontWeight:600,color:"var(--text-2)",display:"block",marginBottom:7}}>To&apos;lov turi</label>
                <div style={{display:"flex",gap:8}}>
                  {TURI_LIST.map(t=>(
                    <button key={t} onClick={()=>setAddTolovTuri(t)}
                      style={{flex:1,padding:"9px 8px",borderRadius:"var(--radius)",border:`1.5px solid ${addTolovTuri===t?"var(--primary)":"var(--border)"}`,background:addTolovTuri===t?"#f0fdf4":"var(--white)",fontSize:13,fontWeight:700,cursor:"pointer",color:addTolovTuri===t?"var(--primary)":"var(--text-2)"}}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:"var(--text-2)",display:"block",marginBottom:5}}>Izoh</label>
                <IzohSelect value={addTolovIzoh} onChange={v=>setAddTolovIzoh(v)} options={izohOptsTolov} placeholder="Ixtiyoriy..."
                  style={{width:"100%",padding:"10px 12px",border:"1px solid var(--border)",borderRadius:"var(--radius)",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
              </div>
              {gaznaForUser(user, gaznalar).filter(g=>g.Turi!=="Dollar").length>0 && (
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:"var(--text-2)",display:"block",marginBottom:8}}>Hisob (So&apos;m)</label>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {gaznaForUser(user, gaznalar).filter(g=>g.Turi!=="Dollar").map(g=>(
                      <button key={g.Gazna_ID} onClick={()=>setAddTolovGazna(addTolovGazna===g.Gazna_ID?"":g.Gazna_ID)}
                        style={{flex:"1 1 auto",padding:"10px 8px",borderRadius:"var(--radius)",border:`1.5px solid ${addTolovGazna===g.Gazna_ID?"var(--primary)":"var(--border)"}`,background:addTolovGazna===g.Gazna_ID?"#f0fdf4":"var(--white)",fontSize:13,fontWeight:700,cursor:"pointer",color:addTolovGazna===g.Gazna_ID?"var(--primary)":"var(--text-2)"}}>
                        {g.Nomi}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {gaznaForUser(user, gaznalar).filter(g=>g.Turi==="Dollar").length>0 && (
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:"#2563eb",display:"block",marginBottom:8}}>Hisob (Dollar)</label>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {gaznaForUser(user, gaznalar).filter(g=>g.Turi==="Dollar").map(g=>(
                      <button key={g.Gazna_ID} onClick={()=>setAddTolovGaznaDollar(addTolovGaznaDollar===g.Gazna_ID?"":g.Gazna_ID)}
                        style={{flex:"1 1 auto",padding:"10px 8px",borderRadius:"var(--radius)",border:`1.5px solid ${addTolovGaznaDollar===g.Gazna_ID?"#2563eb":"var(--border)"}`,background:addTolovGaznaDollar===g.Gazna_ID?"#eff6ff":"var(--white)",fontSize:13,fontWeight:700,cursor:"pointer",color:addTolovGaznaDollar===g.Gazna_ID?"#2563eb":"var(--text-2)"}}>
                        {g.Nomi}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div style={{display:"flex",gap:10,padding:"14px 20px",borderTop:"1px solid var(--border)"}}>
              <button className="btn btn--outline" style={{flex:1}} onClick={()=>setAddTolovOpen(false)}>Bekor</button>
              <button className="btn btn--primary" style={{flex:2}} onClick={handleAddTolov}
                disabled={addTolovSaving||(!num(addTolovSom)&&!num(addTolovDollar))||num(addTolovKurs)<11000}>
                {addTolovSaving&&<span className="spinner"/>} Saqlash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Tolov Modal ── */}
      {editTolov&&(
        <div style={{position:"fixed",inset:0,zIndex:50,background:"rgba(15,42,76,.42)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={()=>setEditTolov(null)}>
          <div style={{background:"var(--white)",borderRadius:16,width:"100%",maxWidth:480,maxHeight:"90vh",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"18px 20px",borderBottom:"1px solid var(--border)"}}>
              <h2 style={{fontSize:15,fontWeight:800}}>To&apos;lovni tahrirlash</h2>
              <span style={{ flex: 1 }}/>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textAlign: "center" }}>Sana</span>
                <input type="date" value={editTolovSana} onChange={e => setEditTolovSana(e.target.value)} style={{ fontSize: 12, fontWeight: 600, padding: "6px 8px", border: "1px solid var(--border)", borderRadius: "var(--radius)", outline: "none", textAlign: "center" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textAlign: "center" }}>Vaqt</span>
                <input type="time" step="1" value={editTolovVaqt} onChange={e => setEditTolovVaqt(e.target.value)} style={{ fontSize: 12, fontWeight: 600, padding: "6px 8px", border: "1px solid var(--border)", borderRadius: "var(--radius)", outline: "none", textAlign: "center", color: "var(--text-3)" }} />
              </div>
              <button onClick={()=>setEditTolov(null)} style={{width:32,height:32,borderRadius:8,border:"1px solid var(--border)",background:"var(--white)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:13,overflowY:"auto"}}>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:"var(--text-2)",display:"block",marginBottom:7}}>Valyuta</label>
                <div style={{display:"flex",borderRadius:"var(--radius)",overflow:"hidden",border:"1.5px solid var(--border)"}}>
                  {(["Som","Dollar"] as const).map(v=>(
                    <button key={v} onClick={()=>setEditTolovValyuta(v)}
                      style={{flex:1,padding:"10px",fontSize:13,fontWeight:700,border:"none",cursor:"pointer",background:editTolovValyuta===v?(v==="Som"?"var(--primary)":"#2563eb"):"var(--white)",color:editTolovValyuta===v?"#fff":"var(--text-3)",borderRight:v==="Som"?"1.5px solid var(--border)":"none"}}>
                      {v==="Som"?"So'm":"Dollar"}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:"var(--text-2)",display:"block",marginBottom:5}}>So&apos;m</label>
                  <input value={editTolovSom} onChange={e=>setEditTolovSom(e.target.value)} placeholder="0" inputMode="numeric"
                    style={{width:"100%",padding:"10px 12px",border:"1.5px solid var(--primary)",borderRadius:"var(--radius)",fontSize:14,fontWeight:700,outline:"none",boxSizing:"border-box"}}/>
                </div>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:"#2563eb",display:"block",marginBottom:5}}>Dollar</label>
                  <input value={editTolovDollar} onChange={e=>setEditTolovDollar(e.target.value)} placeholder="0.00" inputMode="decimal"
                    style={{width:"100%",padding:"10px 12px",border:"1.5px solid #2563eb",borderRadius:"var(--radius)",fontSize:14,fontWeight:700,outline:"none",color:"#2563eb",boxSizing:"border-box"}}/>
                </div>
                <div style={{gridColumn:"1/-1"}}>
                  <label style={{fontSize:12,fontWeight:600,color:num(editTolovKurs)<11000?"#ef4444":"var(--text-2)",display:"block",marginBottom:5}}>Dollar kursi <span style={{color:"#ef4444"}}>*</span></label>
                  <input value={editTolovKurs} onChange={e=>setEditTolovKurs(e.target.value)} placeholder="Min: 11 000" inputMode="numeric"
                    style={{width:"100%",padding:"10px 12px",border:`1.5px solid ${num(editTolovKurs)<11000?"#ef4444":"var(--border)"}`,borderRadius:"var(--radius)",fontSize:14,fontWeight:600,outline:"none",boxSizing:"border-box"}}/>
                </div>
              </div>
              {(()=>{
                const s=num(editTolovSom),d=num(editTolovDollar),k=num(editTolovKurs);
                const res=editTolovValyuta==="Som"?s+d*k:d+(k>0?s/k:0);
                return res>0?(
                  <div style={{padding:"9px 13px",background:editTolovValyuta==="Som"?"#f0fdf4":"#eff6ff",borderRadius:"var(--radius)",display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:12,fontWeight:600,color:"var(--text-3)"}}>Jami:</span>
                    <span style={{fontSize:15,fontWeight:800,color:editTolovValyuta==="Som"?"#16a34a":"#2563eb"}}>
                      {editTolovValyuta==="Som"?res.toLocaleString("ru-RU")+" so'm":"$"+res.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2})}
                    </span>
                  </div>
                ):null;
              })()}
              <div>
                <label style={{fontSize:12,fontWeight:600,color:"var(--text-2)",display:"block",marginBottom:7}}>To&apos;lov turi</label>
                <div style={{display:"flex",gap:8}}>
                  {TURI_LIST.map(t=>(
                    <button key={t} onClick={()=>setEditTolovTuri(t)}
                      style={{flex:1,padding:"9px 8px",borderRadius:"var(--radius)",border:`1.5px solid ${editTolovTuri===t?"var(--primary)":"var(--border)"}`,background:editTolovTuri===t?"#f0fdf4":"var(--white)",fontSize:13,fontWeight:700,cursor:"pointer",color:editTolovTuri===t?"var(--primary)":"var(--text-2)"}}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:"var(--text-2)",display:"block",marginBottom:5}}>Izoh</label>
                <IzohSelect value={editTolovIzoh} onChange={v=>setEditTolovIzoh(v)} options={izohOptsTolov} placeholder="Ixtiyoriy..."
                  style={{width:"100%",padding:"10px 12px",border:"1px solid var(--border)",borderRadius:"var(--radius)",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
              </div>
              {gaznaForUser(user, gaznalar).filter(g=>g.Turi!=="Dollar").length>0 && (
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:"var(--text-2)",display:"block",marginBottom:8}}>Hisob (So&apos;m)</label>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {gaznaForUser(user, gaznalar).filter(g=>g.Turi!=="Dollar").map(g=>(
                      <button key={g.Gazna_ID} onClick={()=>setEditTolovGazna(editTolovGazna===g.Gazna_ID?"":g.Gazna_ID)}
                        style={{flex:"1 1 auto",padding:"10px 8px",borderRadius:"var(--radius)",border:`1.5px solid ${editTolovGazna===g.Gazna_ID?"var(--primary)":"var(--border)"}`,background:editTolovGazna===g.Gazna_ID?"#f0fdf4":"var(--white)",fontSize:13,fontWeight:700,cursor:"pointer",color:editTolovGazna===g.Gazna_ID?"var(--primary)":"var(--text-2)"}}>
                        {g.Nomi}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {gaznaForUser(user, gaznalar).filter(g=>g.Turi==="Dollar").length>0 && (
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:"#2563eb",display:"block",marginBottom:8}}>Hisob (Dollar)</label>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {gaznaForUser(user, gaznalar).filter(g=>g.Turi==="Dollar").map(g=>(
                      <button key={g.Gazna_ID} onClick={()=>setEditTolovGaznaDollar(editTolovGaznaDollar===g.Gazna_ID?"":g.Gazna_ID)}
                        style={{flex:"1 1 auto",padding:"10px 8px",borderRadius:"var(--radius)",border:`1.5px solid ${editTolovGaznaDollar===g.Gazna_ID?"#2563eb":"var(--border)"}`,background:editTolovGaznaDollar===g.Gazna_ID?"#eff6ff":"var(--white)",fontSize:13,fontWeight:700,cursor:"pointer",color:editTolovGaznaDollar===g.Gazna_ID?"#2563eb":"var(--text-2)"}}>
                        {g.Nomi}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div style={{display:"flex",gap:10,padding:"14px 20px",borderTop:"1px solid var(--border)"}}>
              <button className="btn btn--outline" style={{flex:1}} onClick={()=>setEditTolov(null)}>Bekor</button>
              <button className="btn btn--primary" style={{flex:2}} onClick={handleEditTolovSave} disabled={editTolovSaving||num(editTolovKurs)<11000}>
                {editTolovSaving&&<span className="spinner"/>} Saqlash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Tolov confirm ── */}
      {deleteTolov&&(
        <div className="modal-overlay" onClick={()=>setDeleteTolov(null)}>
          <div className="confirm" onClick={e=>e.stopPropagation()}>
            <div className="confirm__icon"><svg width="24" height="24" fill="none" stroke="#ef4444" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></div>
            <h3 className="confirm__title">To&apos;lovni o&apos;chirish</h3>
            <p className="confirm__text"><strong>{deleteTolov.Sana} — {deleteTolov.Turi}</strong> to&apos;lovi o&apos;chiriladi.</p>
            <div className="confirm__actions">
              <button className="btn btn--outline" style={{flex:1}} onClick={()=>setDeleteTolov(null)}>Bekor</button>
              <button className="btn btn--red" style={{flex:1}} onClick={handleDeleteTolov} disabled={deletingTolov}>
                {deletingTolov&&<span className="spinner"/>} O&apos;chirish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete sotuv confirm */}
      {deleteOpen&&(
        <div className="modal-overlay" onClick={()=>setDeleteOpen(false)}>
          <div className="confirm" onClick={e=>e.stopPropagation()}>
            <div className="confirm__icon"><svg width="24" height="24" fill="none" stroke="#ef4444" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></div>
            <h3 className="confirm__title">Sotuvni o&apos;chirish</h3>
            <p className="confirm__text"><strong>Sotuv #{sotuv.Sotuv_Raqami}</strong> va barcha mahsulotlar o&apos;chiriladi.</p>
            <div className="confirm__actions">
              <button className="btn btn--outline" style={{flex:1}} onClick={()=>setDeleteOpen(false)}>Bekor</button>
              <button className="btn btn--red" style={{flex:1}} onClick={handleDeleteSotuv} disabled={deleting}>
                {deleting&&<span className="spinner"/>} O&apos;chirish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Saqlash holati — toast */}
      {toast&&(
        <div style={{position:"fixed",left:"50%",bottom:24,transform:"translateX(-50%)",zIndex:200,padding:"12px 22px",borderRadius:12,background:toast.ok?"#16a34a":"#ef4444",color:"#fff",fontSize:14,fontWeight:700,boxShadow:"0 8px 28px rgba(0,0,0,.25)",display:"flex",alignItems:"center",gap:8}}>
          {toast.ok
            ? <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
            : <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>}
          {toast.text}
        </div>
      )}
    </>
  );
}
