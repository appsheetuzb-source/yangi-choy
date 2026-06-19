"use client";
import { fetchSheet, fetchSheets, afterWrite } from "@/lib/sheet-cache";
import { useScrollLock } from "@/lib/use-scroll-lock";
import FabAdd from "@/components/FabAdd";
import { useAuth } from "@/lib/AuthContext";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";

interface Sotuv {
  Sotuv_ID: string; Yil: string; Oy: string; Sana: string; Status: string;
  Sotuv_Raqami: string; Agent: string; Mijoz_ID: string;
  Balans: string; Balans_dollar: string; Izoh: string; Vaqt: string; Chek?: string;
}
interface SotuvSavatRow {
  Savat_ID: string; Sotuv_ID: string; Mahsulot_ID: string;
  Soni: string; Som_Narx: string; Summa_som: string; Kurs: string; Check: string;
}
interface SotuvSavatDollarRow {
  Savat_ID: string; Sotuv_ID: string; Mahsulot_ID: string;
  Soni: string; Narx: string; Summa: string; Kurs: string; Check: string;
}
interface Foydalanuvchi { Foydalanuvchi_ID: string; Nomi: string; }
interface Mijoz { Mijoz_ID: string; Ism: string; Telefon: string; Agent: string; Boshlangich_Balans_som?: string; Boshlangich_Balans_dollar?: string; }
interface Mahsulot {
  Mahsulot_ID: string; Nomi: string; Ombor_ID: string;
  Sotuv_dollar: string; Sotuv_som: string;
  Tan_som: string; Tan_dollar: string;
}
interface KursRow { Sana: string; Kurs: string; Vaqt?: string; }
interface SavatItem {
  id: string; Mahsulot_ID: string; Soni: string; Som_Narx: string; Narx: string;
  valyuta: "som" | "dollar"; Check: string;
}
interface STolov {
  Tolov_ID: string; Sotuv_ID: string; Mijoz_ID: string; Agent: string;
  Yil: string; Oy: string; Sana: string; Valyuta: string; Turi: string;
  Som: string; Dollar: string; Summa: string; Summa_dollar: string;
  Izoh: string; Dollar_Kursi: string; Vaqt: string; Check?: string;
}

const OY_NOMLARI = ["Yanvar","Fevral","Mart","Aprel","May","Iyun","Iyul","Avgust","Sentabr","Oktabr","Noyabr","Dekabr"];

function uid() { return Math.random().toString(36).slice(2, 10); }
function num(v: string|number|undefined) {
  return parseFloat(String(v||"0").replace(/\s/g,"").replace(",",".")) || 0;
}
function fmtSom(v: number) { return v ? v.toLocaleString("ru-RU") + " so'm" : "—"; }
function fmtUsd(v: number) {
  return v ? "$" + v.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2}) : "—";
}
function nowStr() {
  const d=new Date();
  const t=new Date(d.toLocaleString("en-US",{timeZone:"Asia/Tashkent"}));
  const pad=(n:number)=>String(n).padStart(2,"0");
  const dd=pad(t.getDate()),mm=pad(t.getMonth()+1),yy=String(t.getFullYear());
  const hh=pad(t.getHours()),mi=pad(t.getMinutes()),ss=pad(t.getSeconds());
  return { sana:`${dd}.${mm}.${yy}`, oy:String(t.getMonth()+1), yil:yy, vaqt:`${hh}:${mi}:${ss}` };
}

function SearchSelect({ items, value, onChange, placeholder, borderColor }: {
  items:{id:string;label:string}[]; value:string; onChange:(id:string)=>void; placeholder?:string; borderColor?:string;
}) {
  const [q,setQ]=useState(""); const [open,setOpen]=useState(false); const ref=useRef<HTMLDivElement>(null);
  const [pos,setPos]=useState<{top:number;left:number;width:number}|null>(null);
  const selected=items.find(i=>i.id===value);
  const place=()=>{ const el=ref.current; if(!el) return; const r=el.getBoundingClientRect(); setPos({top:r.bottom+4,left:r.left,width:r.width}); };
  useEffect(()=>{
    if(!open) return;
    const h=(e:MouseEvent)=>{ if(ref.current&&!ref.current.contains(e.target as Node)) setOpen(false); };
    const re=()=>place();
    document.addEventListener("mousedown",h);
    window.addEventListener("resize",re); window.addEventListener("scroll",re,true);
    return ()=>{ document.removeEventListener("mousedown",h); window.removeEventListener("resize",re); window.removeEventListener("scroll",re,true); };
  },[open]);
  const list=items.filter(i=>i.id&&(i.label||"").trim()&&i.label.toLowerCase().includes(q.toLowerCase())).slice(0,60);
  return (
    <div ref={ref} style={{position:"relative"}}>
      <div onClick={()=>{ if(!open) place(); setOpen(o=>!o); setQ(""); }}
        style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"var(--bg)",border:`1px solid ${borderColor||"var(--border)"}`,borderRadius:"var(--radius)",cursor:"pointer",fontSize:14,fontWeight:selected?400:600,color:selected?"var(--text)":"var(--text-2)"}}>
        <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{selected?selected.label:placeholder||"Tanlang..."}</span>
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{color:"var(--text-3)",transform:open?"rotate(180deg)":"none",transition:"transform .15s",flexShrink:0}}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </div>
      {open&&pos&&(
        <div style={{position:"fixed",top:pos.top,left:pos.left,width:pos.width,zIndex:1000,background:"var(--white)",border:"1px solid var(--border)",borderRadius:"var(--radius)",boxShadow:"var(--shadow)",overflow:"hidden"}}>
          <div style={{padding:"8px",borderBottom:"1px solid var(--border)"}}>
            <input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Qidirish..."
              style={{width:"100%",padding:"7px 10px",border:"1px solid var(--border)",borderRadius:8,fontSize:13,outline:"none"}}/>
          </div>
          <div style={{maxHeight:220,overflowY:"auto",overscrollBehavior:"contain"}} onTouchMove={e=>e.stopPropagation()}>
            {list.length===0?<div style={{padding:"12px 14px",fontSize:13,color:"var(--text-3)"}}>Topilmadi</div>
              :list.map(i=>(
                <div key={i.id} onClick={()=>{onChange(i.id);setOpen(false);setQ("");}}
                  style={{padding:"10px 14px",fontSize:13,cursor:"pointer",fontWeight:i.id===value?700:400,background:i.id===value?"var(--bg)":"transparent",color:i.id===value?"var(--primary)":"var(--text)"}}
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

function MultiSelect({ items, value, onChange, placeholder, fullWidth }: {
  items:{id:string;label:string}[]; value:string[]; onChange:(ids:string[])=>void; placeholder?:string; fullWidth?:boolean;
}) {
  const [open,setOpen]=useState(false); const [q,setQ]=useState(""); const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const h=(e:MouseEvent)=>{ if(ref.current&&!ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown",h); return ()=>document.removeEventListener("mousedown",h);
  },[]);
  const list=items.filter(i=>i.label.toLowerCase().includes(q.toLowerCase()));
  const toggle=(id:string)=>onChange(value.includes(id)?value.filter(v=>v!==id):[...value,id]);
  const label=value.length===0?(placeholder||"Tanlang..."): value.length===1?(items.find(i=>i.id===value[0])?.label||""):`${value.length} ta tanlangan`;
  return (
    <div ref={ref} style={{position:"relative",minWidth:fullWidth?undefined:180,flex:fullWidth?1:undefined}}>
      <div onClick={()=>{setOpen(o=>!o);setQ("");}}
        style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",background:"var(--white)",border:"1px solid var(--border)",borderRadius:"var(--radius)",cursor:"pointer",fontSize:13,fontWeight:600,color:value.length?"var(--text)":"var(--text-3)",gap:8,whiteSpace:"nowrap"}}>
        <span style={{overflow:"hidden",textOverflow:"ellipsis"}}>{label}</span>
        {value.length>0&&<span onClick={e=>{e.stopPropagation();onChange([]);}} style={{display:"flex",alignItems:"center",color:"var(--text-3)",flexShrink:0}}>
          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
        </span>}
        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{color:"var(--text-3)",transform:open?"rotate(180deg)":"none",transition:"transform .15s",flexShrink:0}}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </div>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,zIndex:200,minWidth:"100%",background:"var(--white)",border:"1px solid var(--border)",borderRadius:"var(--radius)",boxShadow:"var(--shadow)",overflow:"hidden"}}>
          <div style={{padding:"8px",borderBottom:"1px solid var(--border)"}}>
            <input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Qidirish..."
              style={{width:"100%",padding:"6px 10px",border:"1px solid var(--border)",borderRadius:8,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
          </div>
          <div style={{maxHeight:240,overflowY:"auto",overscrollBehavior:"contain"}} onTouchMove={e=>e.stopPropagation()}>
            {list.length===0&&<div style={{padding:"12px 14px",fontSize:13,color:"var(--text-3)"}}>Topilmadi</div>}
            {list.map(i=>{
              const checked=value.includes(i.id);
              return (
                <div key={i.id} onClick={()=>toggle(i.id)}
                  style={{display:"flex",alignItems:"center",gap:10,padding:"9px 14px",fontSize:13,cursor:"pointer",background:checked?"var(--bg)":"transparent",fontWeight:checked?700:400}}
                  onMouseEnter={e=>(e.currentTarget.style.background="var(--bg)")}
                  onMouseLeave={e=>(e.currentTarget.style.background=checked?"var(--bg)":"transparent")}>
                  <div style={{width:16,height:16,borderRadius:4,border:checked?"none":"1.5px solid var(--border)",background:checked?"var(--primary)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    {checked&&<svg width="10" height="10" fill="none" stroke="#fff" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                  </div>
                  {i.label}
                </div>
              );
            })}
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

function SavatEditor({items,onUpdate,onRemove,onAddSom,onAddDollar,jamiS,jamiD,kursVal,onKursChange,isMobile,somItems,dollarItems,mMap}:{
  items:SavatItem[]; onUpdate:(id:string,f:keyof SavatItem,v:string)=>void;
  onRemove:(id:string)=>void; onAddSom:()=>void; onAddDollar:()=>void; jamiS:number; jamiD:number;
  kursVal:string; onKursChange:(v:string)=>void; isMobile:boolean;
  somItems:{id:string;label:string}[]; dollarItems:{id:string;label:string}[]; mMap:Record<string,Mahsulot>;
}) {
  const somRows    = items.filter(i=>i.valyuta==="som");
  const dollarRows = items.filter(i=>i.valyuta==="dollar");
  return (
    <div>
      {/* So'm section */}
      <div style={{marginBottom:16}}>
        <span style={{fontSize:11,fontWeight:700,color:"#16a34a",letterSpacing:".05em",display:"block",marginBottom:8}}>SO&apos;M SAVAT</span>
        {!isMobile&&somRows.length>0&&(
          <div style={{display:"grid",gridTemplateColumns:"3fr 90px 130px 110px 36px",gap:8,padding:"6px 0",marginBottom:4}}>
            {["MAHSULOT","MIQDOR","NARX (so'm)","JAMI",""].map(h=>(
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
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                <input value={s.Soni} onChange={e=>onUpdate(s.id,"Soni",e.target.value)} placeholder="Miqdor"
                  style={{padding:"8px",border:"1px solid #bbf7d0",borderRadius:"var(--radius)",fontSize:13,fontWeight:600,outline:"none",textAlign:"center"}}/>
                <input value={s.Som_Narx} onChange={e=>onUpdate(s.id,"Som_Narx",e.target.value)} placeholder="Narx (so'm)"
                  style={{padding:"8px",border:`1px solid ${bc?"#ef4444":"#bbf7d0"}`,borderRadius:"var(--radius)",fontSize:13,fontWeight:600,outline:"none",textAlign:"center"}}/>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gridColumn:"1/-1"}}>
                  <span style={{fontSize:13,fontWeight:700,color:bc?"#ef4444":"#16a34a"}}>{bc?"Tan narxidan past!":(jS?jS.toLocaleString("ru-RU")+" so'm":"—")}</span>
                  <button onClick={()=>onRemove(s.id)} style={{width:28,height:28,borderRadius:6,border:"none",background:"#fee2e2",color:"#ef4444",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700}}>−</button>
                </div>
              </div>
            </div>
          );
          return (
            <div key={s.id} style={{display:"grid",gridTemplateColumns:"3fr 90px 130px 110px 36px",gap:8,alignItems:"center",marginBottom:8}}>
              <SearchSelect items={somItems} value={s.Mahsulot_ID} onChange={v=>onUpdate(s.id,"Mahsulot_ID",v)} placeholder="Mahsulot..."/>
              <input value={s.Soni} onChange={e=>onUpdate(s.id,"Soni",e.target.value)} placeholder="Miqdor"
                style={{padding:"10px",border:"1px solid #bbf7d0",borderRadius:"var(--radius)",fontSize:13,fontWeight:600,outline:"none",textAlign:"center"}}/>
              <input value={s.Som_Narx} onChange={e=>onUpdate(s.id,"Som_Narx",e.target.value)} placeholder="Narx (so'm)"
                style={{padding:"10px",border:`1px solid ${bc?"#ef4444":"#bbf7d0"}`,borderRadius:"var(--radius)",fontSize:13,fontWeight:600,outline:"none",textAlign:"center"}}/>
              <div style={{padding:"10px",background:bc?"#fef2f2":"#f0fdf4",borderRadius:"var(--radius)",fontSize:13,fontWeight:700,textAlign:"right",color:bc?"#ef4444":"#16a34a"}}>
                {bc?"Tan narxidan past!":(num(s.Soni)!==0?(jS?jS.toLocaleString("ru-RU")+" so'm":"—"):"—")}
              </div>
              <button onClick={()=>onRemove(s.id)} style={{width:36,height:40,borderRadius:8,border:"none",background:"#fee2e2",color:"#ef4444",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:20,fontWeight:700}}>−</button>
            </div>
          );
        })}
        <button onClick={onAddSom} style={{display:"flex",alignItems:"center",gap:4,padding:"8px 14px",border:"1px solid #bbf7d0",borderRadius:8,fontSize:13,fontWeight:600,background:"#f0fdf4",cursor:"pointer",color:"#16a34a",marginTop:4,width:isMobile?"100%":undefined,justifyContent:"center"}}>
          <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg> So&apos;m mahsulot
        </button>
      </div>

      {/* Dollar section */}
      <div style={{marginBottom:8}}>
        <span style={{fontSize:11,fontWeight:700,color:"#2563eb",letterSpacing:".05em",display:"block",marginBottom:8}}>DOLLAR SAVAT</span>
        {!isMobile&&dollarRows.length>0&&(
          <div style={{display:"grid",gridTemplateColumns:"3fr 90px 130px 110px 36px",gap:8,padding:"6px 0",marginBottom:4}}>
            {["MAHSULOT","MIQDOR","NARX ($)","JAMI",""].map(h=>(
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
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                <input value={s.Soni} onChange={e=>onUpdate(s.id,"Soni",e.target.value)} placeholder="Miqdor"
                  style={{padding:"8px",border:"1px solid #bfdbfe",borderRadius:"var(--radius)",fontSize:13,fontWeight:600,outline:"none",textAlign:"center"}}/>
                <input value={s.Narx} onChange={e=>onUpdate(s.id,"Narx",e.target.value)} placeholder="Narx ($)"
                  style={{padding:"8px",border:`1px solid ${bc?"#ef4444":"#bfdbfe"}`,borderRadius:"var(--radius)",fontSize:13,fontWeight:600,outline:"none",textAlign:"center",color:bc?"#ef4444":"#2563eb"}}/>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gridColumn:"1/-1"}}>
                  <span style={{fontSize:13,fontWeight:700,color:bc?"#ef4444":"#2563eb"}}>{bc?"Tan narxidan past!":(jU?fmtUsd(jU):"—")}</span>
                  <button onClick={()=>onRemove(s.id)} style={{width:28,height:28,borderRadius:6,border:"none",background:"#fee2e2",color:"#ef4444",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700}}>−</button>
                </div>
              </div>
            </div>
          );
          return (
            <div key={s.id} style={{display:"grid",gridTemplateColumns:"3fr 90px 130px 110px 36px",gap:8,alignItems:"center",marginBottom:8}}>
              <SearchSelect items={dollarItems} value={s.Mahsulot_ID} onChange={v=>onUpdate(s.id,"Mahsulot_ID",v)} placeholder="Mahsulot..."/>
              <input value={s.Soni} onChange={e=>onUpdate(s.id,"Soni",e.target.value)} placeholder="Miqdor"
                style={{padding:"10px",border:"1px solid #bfdbfe",borderRadius:"var(--radius)",fontSize:13,fontWeight:600,outline:"none",textAlign:"center"}}/>
              <input value={s.Narx} onChange={e=>onUpdate(s.id,"Narx",e.target.value)} placeholder="Narx ($)"
                style={{padding:"10px",border:`1px solid ${bc?"#ef4444":"#bfdbfe"}`,borderRadius:"var(--radius)",fontSize:13,fontWeight:600,outline:"none",textAlign:"center",color:bc?"#ef4444":"#2563eb"}}/>
              <div style={{padding:"10px",background:bc?"#fef2f2":"#eff6ff",borderRadius:"var(--radius)",fontSize:13,fontWeight:700,textAlign:"right",color:bc?"#ef4444":"#2563eb"}}>
                {bc?"Tan narxidan past!":(num(s.Soni)!==0?(jU?fmtUsd(jU):"—"):"—")}
              </div>
              <button onClick={()=>onRemove(s.id)} style={{width:36,height:40,borderRadius:8,border:"none",background:"#fee2e2",color:"#ef4444",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:20,fontWeight:700}}>−</button>
            </div>
          );
        })}
        <button onClick={onAddDollar} style={{display:"flex",alignItems:"center",gap:4,padding:"8px 14px",border:"1px solid #bfdbfe",borderRadius:8,fontSize:13,fontWeight:600,background:"#eff6ff",cursor:"pointer",color:"#2563eb",marginTop:4,width:isMobile?"100%":undefined,justifyContent:"center"}}>
          <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg> Dollar mahsulot
        </button>
      </div>

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

export default function SotuvPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isSotuvchi = user?.lavozim === "Sotuvchi";
  const isAdmin = user?.lavozim === "Admin";
  const [sotuvlar, setSotuvlar]             = useState<Sotuv[]>([]);
  const [savatSomMap, setSavatSomMap]       = useState<Record<string,SotuvSavatRow[]>>({});
  const [savatDollarMap, setSavatDollarMap] = useState<Record<string,SotuvSavatDollarRow[]>>({});
  const [agentlar, setAgentlar]             = useState<Foydalanuvchi[]>([]);
  const [aMap, setAMap]                     = useState<Record<string,string>>({});
  const [mijozlar, setMijozlar]             = useState<Mijoz[]>([]);
  const [mahsulotlar, setMahsulotlar]       = useState<Mahsulot[]>([]);
  const [mMap, setMMap]                     = useState<Record<string,Mahsulot>>({});
  const [stolovMap, setStolovMap]           = useState<Record<string,STolov[]>>({});
  // Mijoz_ID bo'yicha to'lovlar (Sotuv_ID bo'sh — umumiy to'lovlar ham hisoblanadi)
  const [stolovByMijoz, setStolovByMijoz]   = useState<Record<string,{som:number,dollar:number}>>({});
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState<string|null>(null);
  const [search, setSearch]                 = useState("");
  const [isMobile, setIsMobile]             = useState(false);

  const now = new Date();
  const [filterOy, setFilterOy]   = useState(String(now.getMonth()+1));
  const [filterYil, setFilterYil] = useState(String(now.getFullYear()));
  const [filterAgent, setFilterAgent] = useState<string[]>([]);
  const [viewTab, setViewTab] = useState<"all"|"som"|"dollar"|"bosh"|"bugungi"|"berilmagan">("all");

  const todaySana = nowStr().sana;

  // Add modal
  const [defaultKurs, setDefaultKurs] = useState("");
  const [addOpen, setAddOpen]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [addMijoz, setAddMijoz]   = useState("");
  const [addAgent, setAddAgent]   = useState("");
  const [addIzoh, setAddIzoh]     = useState("");
  const [addKurs, setAddKurs]     = useState("");
  const [savat, setSavat]         = useState<SavatItem[]>([]);
  const sana = nowStr().sana;

  // Edit modal
  const [detailSotuv, setDetailSotuv]   = useState<Sotuv|null>(null);
  const [editMijoz, setEditMijoz]       = useState("");
  const [editAgent, setEditAgent]       = useState("");
  const [editIzoh, setEditIzoh]         = useState("");
  const [editKurs, setEditKurs]         = useState("");
  const [editSavat, setEditSavat]       = useState<SavatItem[]>([]);
  const [editSaving, setEditSaving]     = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Sotuv|null>(null);
  useScrollLock(addOpen || !!detailSotuv || !!deleteTarget);
  const [deleting, setDeleting]         = useState(false);
  const [checkSaving, setCheckSaving]   = useState("");
  const [tasdiqSaving, setTasdiqSaving] = useState("");

  // Ro'yxat/jadval — mobilda kompakt mobil ko'rinish, desktopda jadval
  useEffect(()=>{
    const c=()=>setIsMobile(window.innerWidth<768);
    c(); window.addEventListener("resize",c); return ()=>window.removeEventListener("resize",c);
  },[]);
  // Savat formasi: desktopda gorizontal qator, mobilda stacklangan
  const [savatMobile, setSavatMobile] = useState(false);
  useEffect(()=>{
    const c=()=>setSavatMobile(window.innerWidth<640);
    c(); window.addEventListener("resize",c); return ()=>window.removeEventListener("resize",c);
  },[]);

  // Sotuv "Belgilangan" (tasdiqlangan) holati — Chek ustuni TRUE bo'lsa qarzga ta'sir qiladi
  // STATUS (badge): Chek bo'sh => "Tasdiqlash"; TRUE yoki FALSE => "Tasdiqlandi"
  const isTasdiq = (s: Sotuv) => String(s.Chek||"").trim() !== "";
  // QARZ hisobiga FAQAT Chek=TRUE qo'shiladi (eski dasturga mos; FALSE qarzga kirmaydi)
  const qarzTrue = (s: Sotuv) => String(s.Chek||"").toUpperCase() === "TRUE";

  async function toggleTasdiq(s: Sotuv) {
    if (tasdiqSaving) return;
    // Tasdiqlanganni bekor qilsa Chek bo'sh bo'ladi (qayta "Tasdiqlash"ga tushadi); aks holda TRUE
    const newChek = isTasdiq(s) ? "" : "TRUE";
    setTasdiqSaving(s.Sotuv_ID);
    setSotuvlar(prev => prev.map(x => x.Sotuv_ID===s.Sotuv_ID ? {...x, Chek:newChek} : x));
    try {
      await fetch("/api/sheets",{method:"PUT",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({sheet:"Sotuv", idColumn:"Sotuv_ID", idValue:s.Sotuv_ID, updates:{Chek:newChek}})});
      afterWrite("Sotuv");
    } finally { setTasdiqSaving(""); }
  }

  const loadData = useCallback((delay=0)=>{
    setLoading(true);
    setTimeout(()=>{
      fetchSheets(["Sotuv","Sotuv_Savat","Sotuv_savat_dollar","Foydalanuvchi","Mijozlar","Mahsulot","Kurs"])
      .then((rr)=>{
        const sR=rr["Sotuv"], ssR=rr["Sotuv_Savat"], sdR=rr["Sotuv_savat_dollar"], fR=rr["Foydalanuvchi"], mzR=rr["Mijozlar"], mhR=rr["Mahsulot"], kR=rr["Kurs"];
        if(sR.error) throw new Error(sR.error);
        // Eski dasturdagidek: sheet'dagi yaratilish tartibi bo'yicha, eng yangi qator (oxirgi qo'shilgan) tepada.
        // Ko'rsatilgan sana/vaqt yoki № emas — aynan sheet qatorlari teskari tartibda.
        const sorted=[...(sR.data as Sotuv[])].filter(s=>s.Sotuv_ID).reverse();
        setSotuvlar(sorted);

        const sm:Record<string,SotuvSavatRow[]>={};
        (ssR.data as SotuvSavatRow[]).forEach(r=>{
          const k=String(r.Sotuv_ID||"").trim(); if(!k) return;
          if(!sm[k])sm[k]=[]; sm[k].push(r);
        });
        setSavatSomMap(sm);

        const dm:Record<string,SotuvSavatDollarRow[]>={};
        (sdR.data as SotuvSavatDollarRow[]).forEach(r=>{
          const k=String(r.Sotuv_ID||"").trim(); if(!k) return;
          if(!dm[k])dm[k]=[]; dm[k].push(r);
        });
        setSavatDollarMap(dm);

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

        const kursArr=((kR.data||[]) as KursRow[]).filter(k=>k.Kurs&&num(k.Kurs)>0);
        if(kursArr.length>0){
          setDefaultKurs(kursArr[kursArr.length-1].Kurs);
        }
      }).catch(e=>setError(e instanceof Error?e.message:"Xatolik"))
        .finally(()=>{
          setLoading(false);
          // S_tolov katta bo'lgani uchun alohida, fonda yuklanadi
          fetchSheet("S_tolov").then(stR=>{
            const stm: Record<string,STolov[]> = {};
            const sbm: Record<string,{som:number,dollar:number}> = {};
            ((stR.data||[]) as STolov[]).forEach((r:STolov)=>{
              const k=String(r.Sotuv_ID||"").trim();
              if(k){ if(!stm[k]) stm[k]=[]; stm[k].push(r); }
              // Mijoz_ID bo'yicha barcha to'lovlar (Sotuv_ID bo'sh bo'lsa ham)
              const mid=String(r.Mijoz_ID||"").trim(); if(!mid) return;
              if(!sbm[mid]) sbm[mid]={som:0,dollar:0};
              const isD=String(r.Valyuta||"").toLowerCase().includes("dollar");
              sbm[mid].som    += (!isD?num(r.Summa):0);
              sbm[mid].dollar += (isD?num(r.Summa_dollar):0);
            });
            setStolovMap(stm);
            setStolovByMijoz(sbm);
          }).catch(()=>{});
        });
    }, delay);
  },[]);

  useEffect(()=>{loadData();},[loadData]);

  function addSomItem() {
    setSavat(p=>[...p,{id:uid(),Mahsulot_ID:"",Soni:"",Som_Narx:"",Narx:"",valyuta:"som",Check:"TRUE"}]);
  }
  function addDollarItem() {
    setSavat(p=>[...p,{id:uid(),Mahsulot_ID:"",Soni:"",Som_Narx:"",Narx:"",valyuta:"dollar",Check:"TRUE"}]);
  }
  function updateItem(itemId:string, field:keyof SavatItem, val:string) {
    setSavat(p=>p.map(s=>{
      if(s.id!==itemId) return s;
      const u={...s,[field]:val};
      if(field==="Mahsulot_ID"){
        const m=mMap[val];
        if(m){
          if(s.valyuta==="som"){u.Som_Narx=m.Sotuv_som||"";u.Narx="";}
          else{u.Narx=m.Sotuv_dollar||"";u.Som_Narx="";}
        }
      }
      return u;
    }));
  }
  function addSomEditItem() {
    setEditSavat(p=>[...p,{id:uid(),Mahsulot_ID:"",Soni:"",Som_Narx:"",Narx:"",valyuta:"som",Check:"TRUE"}]);
  }
  function addDollarEditItem() {
    setEditSavat(p=>[...p,{id:uid(),Mahsulot_ID:"",Soni:"",Som_Narx:"",Narx:"",valyuta:"dollar",Check:"TRUE"}]);
  }
  function updateEditItem(itemId:string, field:keyof SavatItem, val:string) {
    setEditSavat(p=>p.map(s=>{
      if(s.id!==itemId) return s;
      const u={...s,[field]:val};
      if(field==="Mahsulot_ID"){
        const m=mMap[val];
        if(m){
          if(s.valyuta==="som"){u.Som_Narx=m.Sotuv_som||"";u.Narx="";}
          else{u.Narx=m.Sotuv_dollar||"";u.Som_Narx="";}
        }
      }
      return u;
    }));
  }

  function openAdd() {
    // Sotuvchi bo'lsa — o'zini agenti qilib qo'yiladi va o'zgartirib bo'lmaydi
    setAddMijoz(""); setAddAgent(isSotuvchi && user?.id ? user.id : (agentlar[0]?.Foydalanuvchi_ID||""));
    setAddIzoh(""); setAddKurs(defaultKurs);
    setSavat([{id:uid(),Mahsulot_ID:"",Soni:"",Som_Narx:"",Narx:"",valyuta:"som",Check:"TRUE"}]);
    setAddOpen(true);
  }

  async function handleSave() {
    if(!addMijoz||!addAgent) return;
    const valid=savat.filter(s=>s.Mahsulot_ID&&s.Soni&&(num(s.Som_Narx)||num(s.Narx)));
    if(valid.length===0) return;
    setSaving(true);
    const {sana:snStr,oy,yil,vaqt}=nowStr();
    const sotuvId=uid();
    const maxRaqam=sotuvlar.reduce((mx,s)=>Math.max(mx,num(s.Sotuv_Raqami)),0);
    const raqam=String(maxRaqam+1);
    const kurs=addKurs||"0";
    const totalSom=valid.reduce((s,r)=>s+num(r.Soni)*num(r.Som_Narx),0);
    const totalUsd=valid.reduce((s,r)=>s+num(r.Soni)*num(r.Narx),0);
    try {
      await fetch("/api/sheets",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({sheet:"Sotuv",row:{
          Sotuv_ID:sotuvId,Yil:yil,Oy:oy,Sana:snStr,Status:"Tasdiqlandi",
          Sotuv_Raqami:raqam,Agent:addAgent,Mijoz_ID:addMijoz,
          Balans:String(totalSom),Balans_dollar:String(totalUsd),
          Izoh:addIzoh,Vaqt:vaqt,Foiz_som:"",Foiz_summa_som:"0",
          Foiz_dollar:"",Foiz_summasi_dollar:"0",Qoshdi:"",
          Qoshilgan_Vaqt:"",Ozgartirdi:"",Oxirgi_ozgarish:"",
          Chek:"FALSE",Chek_file:"",Chek_file_phone:"",Chek_phone:"",Change:"",Change_phone:"",
        }})});
      let savatIdx=1;
      for(const r of valid){
        const m=mMap[r.Mahsulot_ID];
        if(num(r.Som_Narx)>0){
          const tanSom=num(m?.Tan_som||"0");
          const tanDollar=num(m?.Tan_dollar||"0");
          const somTanNarx=tanSom!==0?tanSom:tanDollar*num(kurs);
          const foyda=num(r.Som_Narx)-somTanNarx;
          const foydaSumma=num(r.Soni)*foyda;
          await fetch("/api/sheets",{method:"POST",headers:{"Content-Type":"application/json"},
            body:JSON.stringify({sheet:"Sotuv_Savat",row:{
              Savat_ID:uid(),Yil:yil,Oy:oy,Sana:snStr,Sotuv_ID:sotuvId,Agent:addAgent,
              Mahsulot_ID:r.Mahsulot_ID,Soni:r.Soni,Som_Narx:r.Som_Narx,Kurs:kurs,
              Summa_som:String(num(r.Soni)*num(r.Som_Narx)),
              Som_tan_narx:String(Math.round(somTanNarx)),Foyda:String(Math.round(foyda)),Foyda_summasi_som:String(Math.round(foydaSumma)),
              Ombor_ID:m?.Ombor_ID||"",Raqam:String(savatIdx++),Vaqt:vaqt,Check:r.Check||"TRUE",Izoh:"",Mijoz_ID:addMijoz,
            }})});
        }
        if(num(r.Narx)>0){
          const tanDollar=num(m?.Tan_dollar||"0");
          const foyda=parseFloat((num(r.Narx)-tanDollar).toFixed(2));
          const foydaSumma=parseFloat((foyda*num(r.Soni)).toFixed(2));
          const narx=parseFloat(num(r.Narx).toFixed(2));
          const summa=parseFloat((num(r.Soni)*narx).toFixed(2));
          const tanNarx=parseFloat(tanDollar.toFixed(2));
          await fetch("/api/sheets",{method:"POST",headers:{"Content-Type":"application/json"},
            body:JSON.stringify({sheet:"Sotuv_savat_dollar",row:{
              Savat_ID:uid(),Yil:yil,Oy:oy,Sana:snStr,Sotuv_ID:sotuvId,Agent:addAgent,
              Mahsulot_ID:r.Mahsulot_ID,Soni:num(r.Soni),Narx:narx,Kurs:num(kurs),
              Summa:summa,
              Tan_narx:tanNarx,Foyda:foyda,Foyda_summasi_som:foydaSumma,
              Ombor_ID:m?.Ombor_ID||"",Raqam:savatIdx++,Vaqt:vaqt,Check:"",Izoh:"",Mijoz_ID:addMijoz,
            }})});
        }
      }
      setAddOpen(false);
      loadData(800);
    } finally { setSaving(false); }
  }

  function openEdit(s:Sotuv) {
    setDetailSotuv(s);
    setEditMijoz(s.Mijoz_ID);
    setEditAgent(s.Agent);
    setEditIzoh(s.Izoh||"");
    const somRows=savatSomMap[s.Sotuv_ID]||[];
    const dollarRows=savatDollarMap[s.Sotuv_ID]||[];
    const combined:SavatItem[]=[
      ...somRows.map(r=>({id:uid(),Mahsulot_ID:r.Mahsulot_ID,Soni:r.Soni,Som_Narx:r.Som_Narx,Narx:"",valyuta:"som" as const,Check:r.Check||"TRUE"})),
      ...dollarRows.map(r=>({id:uid(),Mahsulot_ID:r.Mahsulot_ID,Soni:r.Soni,Som_Narx:"",Narx:r.Narx,valyuta:"dollar" as const,Check:r.Check||"TRUE"})),
    ];
    const kursVal=(somRows[0]?.Kurs||dollarRows[0]?.Kurs||defaultKurs);
    setEditKurs(kursVal);
    setEditSavat(combined);
  }

  async function handleUpdate() {
    if(!detailSotuv||!editMijoz||!editAgent) return;
    const valid=editSavat.filter(s=>s.Mahsulot_ID&&s.Soni&&(num(s.Som_Narx)||num(s.Narx)));
    if(valid.length===0) return;
    setEditSaving(true);
    const kurs=editKurs||"0";
    const {sana:snStr,yil,oy,vaqt}=nowStr();
    const totalSom=valid.reduce((s,r)=>s+num(r.Soni)*num(r.Som_Narx),0);
    const totalUsd=valid.reduce((s,r)=>s+num(r.Soni)*num(r.Narx),0);
    try {
      await fetch("/api/sheets",{method:"PUT",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({sheet:"Sotuv",idColumn:"Sotuv_ID",idValue:detailSotuv.Sotuv_ID,
          row:{...detailSotuv,Agent:editAgent,Mijoz_ID:editMijoz,Izoh:editIzoh,
            Balans:String(totalSom),Balans_dollar:String(totalUsd)}})});
      // Delete old savat rows
      for(const r of (savatSomMap[detailSotuv.Sotuv_ID]||[])){
        await fetch("/api/sheets",{method:"DELETE",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({sheet:"Sotuv_Savat",idColumn:"Savat_ID",idValue:r.Savat_ID})});
      }
      for(const r of (savatDollarMap[detailSotuv.Sotuv_ID]||[])){
        await fetch("/api/sheets",{method:"DELETE",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({sheet:"Sotuv_savat_dollar",idColumn:"Savat_ID",idValue:r.Savat_ID})});
      }
      // Post new savat rows
      const snRow=detailSotuv.Sana; const [,moRow,yRow]=snRow.split(".");
      let savatIdx=1;
      for(const r of valid){
        const m=mMap[r.Mahsulot_ID];
        if(num(r.Som_Narx)>0){
          const tanSom=num(m?.Tan_som||"0");
          const tanDollar=num(m?.Tan_dollar||"0");
          const somTanNarx=tanSom!==0?tanSom:tanDollar*num(kurs);
          const foyda=num(r.Som_Narx)-somTanNarx;
          const foydaSumma=num(r.Soni)*foyda;
          await fetch("/api/sheets",{method:"POST",headers:{"Content-Type":"application/json"},
            body:JSON.stringify({sheet:"Sotuv_Savat",row:{
              Savat_ID:uid(),Yil:yRow,Oy:moRow.replace(/^0/,""),Sana:snRow,
              Sotuv_ID:detailSotuv.Sotuv_ID,Agent:editAgent,Mahsulot_ID:r.Mahsulot_ID,
              Soni:r.Soni,Som_Narx:String(Math.round(num(r.Som_Narx))),Kurs:kurs,
              Summa_som:String(Math.round(num(r.Soni)*num(r.Som_Narx))),
              Som_tan_narx:String(Math.round(somTanNarx)),Foyda:String(Math.round(foyda)),Foyda_summasi_som:String(Math.round(foydaSumma)),
              Ombor_ID:m?.Ombor_ID||"",Raqam:String(savatIdx++),Vaqt:vaqt,Check:r.Check||"TRUE",Izoh:"",Mijoz_ID:editMijoz,
            }})});
        }
        if(num(r.Narx)>0){
          const tanDollar=num(m?.Tan_dollar||"0");
          const foyda=parseFloat((num(r.Narx)-tanDollar).toFixed(2));
          const foydaSumma=parseFloat((foyda*num(r.Soni)).toFixed(2));
          const narx=parseFloat(num(r.Narx).toFixed(2));
          const summa=parseFloat((num(r.Soni)*narx).toFixed(2));
          const tanNarx=parseFloat(tanDollar.toFixed(2));
          await fetch("/api/sheets",{method:"POST",headers:{"Content-Type":"application/json"},
            body:JSON.stringify({sheet:"Sotuv_savat_dollar",row:{
              Savat_ID:uid(),Yil:yRow,Oy:moRow.replace(/^0/,""),Sana:snRow,
              Sotuv_ID:detailSotuv.Sotuv_ID,Agent:editAgent,Mahsulot_ID:r.Mahsulot_ID,
              Soni:num(r.Soni),Narx:narx,Kurs:num(kurs),
              Summa:summa,
              Tan_narx:tanNarx,Foyda:foyda,Foyda_summasi_som:foydaSumma,
              Ombor_ID:m?.Ombor_ID||"",Raqam:savatIdx++,Vaqt:vaqt,Check:"",Izoh:"",Mijoz_ID:editMijoz,
            }})});
        }
      }
      setDetailSotuv(null);
      loadData(800);
    } finally { setEditSaving(false); }
  }

  async function handleToggleCheck(savatId: string, sotuvId: string, sheet: "Sotuv_Savat"|"Sotuv_savat_dollar", newCheck: "TRUE"|"FALSE") {
    setCheckSaving(savatId);
    try {
      if (sheet === "Sotuv_Savat") {
        setSavatSomMap(prev => ({...prev, [sotuvId]: (prev[sotuvId]||[]).map(r => r.Savat_ID===savatId ? {...r, Check: newCheck} : r)}));
      } else {
        setSavatDollarMap(prev => ({...prev, [sotuvId]: (prev[sotuvId]||[]).map(r => r.Savat_ID===savatId ? {...r, Check: newCheck} : r)}));
      }
      await fetch("/api/sheets", {method:"PUT", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({sheet, idColumn:"Savat_ID", idValue:savatId, updates:{Check:newCheck}})});
    } finally { setCheckSaving(""); }
  }

  async function handleDelete() {
    if(!deleteTarget) return;
    setDeleting(true);
    const sid=deleteTarget.Sotuv_ID;
    try {
      const [ssRes,sdRes]=await Promise.all([
        fetchSheet("Sotuv_Savat"),
        fetchSheet("Sotuv_savat_dollar"),
      ]);
      const somItems=((ssRes.data||[]) as SotuvSavatRow[]).filter(r=>String(r.Sotuv_ID||"").trim()===sid);
      const dollarItems=((sdRes.data||[]) as SotuvSavatDollarRow[]).filter(r=>String(r.Sotuv_ID||"").trim()===sid);
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
      setDeleteTarget(null);
      loadData(800);
    } finally { setDeleting(false); }
  }

  // Sana (oy/yil) filtrisiz baza — agent/qidiruv/sotuvchi bo'yicha. "Bo'sh" tab shundan oladi.
  const filteredNoDate = useMemo(()=>sotuvlar.filter(s=>{
    if(!s.Sotuv_ID) return false;
    // Sotuvchi faqat o'z sotuvlarini ko'radi
    if(isSotuvchi && user?.id && s.Agent !== user.id) return false;
    const matchAgent=filterAgent.length===0||filterAgent.includes(s.Agent);
    const mJozIsi=mijozlar.find(m=>m.Mijoz_ID===s.Mijoz_ID)?.Ism||"";
    const matchSearch=!search||
      mJozIsi.toLowerCase().includes(search.toLowerCase())||
      (s.Sotuv_Raqami||"").includes(search)||
      (s.Izoh||"").toLowerCase().includes(search.toLowerCase());
    return matchAgent&&matchSearch;
  }),[sotuvlar,filterAgent,search,mijozlar,isSotuvchi,user]);

  // Sana filtri qo'llangan baza (qolgan tablar uchun)
  const filtered = useMemo(()=>filteredNoDate.filter(s=>{
    const matchOy=!filterOy||String(parseInt(s.Oy||"0"))===filterOy;
    const matchYil=!filterYil||s.Yil===filterYil;
    return matchOy&&matchYil;
  }),[filteredNoDate,filterOy,filterYil]);

  // "Bo'sh" tab — barcha davrlardagi tasdiqlanmagan (Chek bo'sh) sotuvlar (sana filtridan qat'i nazar)
  const viewFiltered = (viewTab === "bosh" ? filteredNoDate : filtered).filter(s => {
    const hasSom = (savatSomMap[s.Sotuv_ID]||[]).length > 0;
    const hasDollar = (savatDollarMap[s.Sotuv_ID]||[]).length > 0;
    if (viewTab === "som")     return hasSom;
    if (viewTab === "dollar")  return hasDollar;
    if (viewTab === "bosh")    return String(s.Chek||"").trim()==="";
    if (viewTab === "bugungi") return s.Sana === todaySana;
    if (viewTab === "berilmagan") {
      const somRows = savatSomMap[s.Sotuv_ID] || [];
      const dollarRows = savatDollarMap[s.Sotuv_ID] || [];
      return [...somRows, ...dollarRows].some(r => {
        const c = (r.Check ?? "").toString().toUpperCase();
        return c === "FALSE";
      });
    }
    return true;
  });

  const totalSom    = useMemo(()=>viewFiltered.reduce((s,sv)=>s+(savatSomMap[sv.Sotuv_ID]||[]).reduce((ss,r)=>ss+num(r.Summa_som),0),0),[viewFiltered,savatSomMap]);
  const totalDollar = useMemo(()=>viewFiltered.reduce((s,sv)=>s+(savatDollarMap[sv.Sotuv_ID]||[]).reduce((ss,r)=>ss+num(r.Summa),0),0),[viewFiltered,savatDollarMap]);

  const years = useMemo(()=>{
    const y=[...new Set(sotuvlar.map(s=>s.Yil).filter(Boolean))].sort((a,b)=>Number(b)-Number(a));
    if(!y.includes(String(now.getFullYear()))) y.unshift(String(now.getFullYear()));
    return y;
  },[sotuvlar]);

  const aItems        = useMemo(()=>agentlar.map(a=>({id:a.Foydalanuvchi_ID,label:a.Nomi})),[agentlar]);
  // Yangi sotuv: agent tanlanganda faqat o'sha agentga tegishli mijozlar
  // Mijoz.Agent maydoni Foydalanuvchi_ID saqlanadi
  const mJItems = useMemo(()=>{
    const list = addAgent
      ? mijozlar.filter(m => (m.Agent||"").trim() === addAgent.trim())
      : mijozlar;
    return list.map(m=>({id:m.Mijoz_ID,label:m.Ism+(m.Telefon?` (${m.Telefon})`:"")}));
  },[mijozlar, addAgent]);
  // Tahrirlash draweri uchun — editAgent bo'yicha filtr
  const mJItemsEdit = useMemo(()=>{
    const list = editAgent
      ? mijozlar.filter(m => (m.Agent||"").trim() === editAgent.trim())
      : mijozlar;
    return list.map(m=>({id:m.Mijoz_ID,label:m.Ism+(m.Telefon?` (${m.Telefon})`:"")}));
  },[mijozlar, editAgent]);
  const mhSomItems    = useMemo(()=>mahsulotlar.filter(m=>num(m.Sotuv_som)>0).map(m=>({id:m.Mahsulot_ID,label:m.Nomi})),[mahsulotlar]);
  const mhDollarItems = useMemo(()=>mahsulotlar.filter(m=>num(m.Sotuv_dollar)>0).map(m=>({id:m.Mahsulot_ID,label:m.Nomi})),[mahsulotlar]);

  const allUndeliveredSom = useMemo(()=>
    viewTab==="berilmagan" ? viewFiltered.flatMap(s=>(savatSomMap[s.Sotuv_ID]||[]).filter(r=>(r.Check??"").toString().toUpperCase()==="FALSE")) : [],
    [viewTab, viewFiltered, savatSomMap]);
  const allUndeliveredDollar = useMemo(()=>
    viewTab==="berilmagan" ? viewFiltered.flatMap(s=>(savatDollarMap[s.Sotuv_ID]||[]).filter(r=>(r.Check??"").toString().toUpperCase()==="FALSE")) : [],
    [viewTab, viewFiltered, savatDollarMap]);

  const jamiSom   = useMemo(()=>savat.reduce((s,r)=>s+num(r.Soni)*num(r.Som_Narx),0),[savat]);
  const jamiDollar= useMemo(()=>savat.reduce((s,r)=>s+num(r.Soni)*num(r.Narx),0),[savat]);
  const editJamiSom   = useMemo(()=>editSavat.reduce((s,r)=>s+num(r.Soni)*num(r.Som_Narx),0),[editSavat]);
  const editJamiDollar= useMemo(()=>editSavat.reduce((s,r)=>s+num(r.Soni)*num(r.Narx),0),[editSavat]);

  // Tanlangan mijozning eski qarzi (boshlang'ich + jami sotuv - jami to'lov)
  const addMijozEski = useMemo(()=>{
    if(!addMijoz) return null;
    const mj=mijozlar.find(m=>m.Mijoz_ID===addMijoz);
    let som=num(mj?.Boshlangich_Balans_som), dollar=num(mj?.Boshlangich_Balans_dollar);
    sotuvlar.filter(s=>s.Mijoz_ID===addMijoz && qarzTrue(s)).forEach(s=>{
      (savatSomMap[s.Sotuv_ID]||[]).forEach(r=>{ som+=num(r.Summa_som); });
      (savatDollarMap[s.Sotuv_ID]||[]).forEach(r=>{ dollar+=num(r.Summa); });
    });
    // Barcha to'lovlar (Mijoz_ID bo'yicha — umumiy/Sotuv_ID'siz to'lovlar ham) ayriladi
    const tl=stolovByMijoz[addMijoz]; if(tl){ som-=tl.som; dollar-=tl.dollar; }
    return { som, dollar };
  },[addMijoz, mijozlar, sotuvlar, savatSomMap, savatDollarMap, stolovByMijoz]);

  const modalOverlay:React.CSSProperties={position:"fixed",inset:0,zIndex:50,background:"rgba(15,42,76,.42)",backdropFilter:"blur(4px)",display:"flex",alignItems:isMobile?"flex-end":"center",justifyContent:"center",padding:isMobile?0:20};
  const modalBox:React.CSSProperties={background:"var(--white)",width:"100%",maxWidth:isMobile?"100%":900,borderRadius:isMobile?"20px 20px 0 0":16,display:"flex",flexDirection:"column",maxHeight:isMobile?"92dvh":"90vh"};

  return (
    <>
      <header className="header">
        <div className="header__inner">
          <div style={{display:"flex",flexDirection:"column",gap:2}}>
            <h1 className="header__title" style={{paddingLeft:4}}>Sotuvlar</h1>
            <span style={{fontSize:11,color:"var(--text-3)",paddingLeft:4}}>Barcha sotuvlar ro&apos;yxati</span>
          </div>
          <div className="header__spacer"/>
        </div>
      </header>

      {isMobile && <FabAdd onClick={openAdd} />}

      <div className="page-content">
        {loading&&<div className="spinner--page"/>}
        {error&&<div className="error-box"><p>{error}</p></div>}

        {!loading&&!error&&(
          <>
            {/* Stats */}
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)",gap:isMobile?10:14,marginBottom:isMobile?16:24}}>
              <div style={{background:"var(--white)",borderRadius:"var(--radius-xl)",boxShadow:"var(--shadow-sm)",padding:isMobile?"14px 16px":"20px 24px"}}>
                <p style={{fontSize:10,fontWeight:700,color:"var(--text-3)",letterSpacing:".06em",marginBottom:8}}>JAMI SOTUV</p>
                <p style={{fontSize:isMobile?20:26,fontWeight:800,lineHeight:1}}>{viewFiltered.length}</p>
              </div>
              <div style={{background:"var(--white)",borderRadius:"var(--radius-xl)",boxShadow:"var(--shadow-sm)",padding:isMobile?"14px 16px":"20px 24px"}}>
                <p style={{fontSize:10,fontWeight:700,color:"var(--text-3)",letterSpacing:".06em",marginBottom:8}}>JAMI SO&apos;M</p>
                <p style={{fontSize:isMobile?15:20,fontWeight:800,lineHeight:1,color:"#16a34a"}}>{totalSom?totalSom.toLocaleString("ru-RU"):"0"}</p>
              </div>
              <div style={{background:"var(--white)",borderRadius:"var(--radius-xl)",boxShadow:"var(--shadow-sm)",padding:isMobile?"14px 16px":"20px 24px"}}>
                <p style={{fontSize:10,fontWeight:700,color:"var(--text-3)",letterSpacing:".06em",marginBottom:8}}>JAMI DOLLAR</p>
                <p style={{fontSize:isMobile?15:20,fontWeight:800,lineHeight:1,color:"#2563eb"}}>{totalDollar?fmtUsd(totalDollar):"$0.00"}</p>
              </div>
            </div>

            {/* View tabs */}
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
              {([
                {key:"all",    label:"Barchasi",       count: filtered.length},
                {key:"som",    label:"So'm",           count: filtered.filter(s=>(savatSomMap[s.Sotuv_ID]||[]).length>0).length},
                {key:"dollar", label:"Dollar ($)",     count: filtered.filter(s=>(savatDollarMap[s.Sotuv_ID]||[]).length>0).length},
                {key:"bosh",   label:"Bo'sh",          count: filteredNoDate.filter(s=>String(s.Chek||"").trim()==="").length},
                {key:"bugungi",    label:"Bugungi",    count: filtered.filter(s=>s.Sana===todaySana).length},
                {key:"berilmagan", label:"Berilmagan", count: filtered.filter(s=>[...(savatSomMap[s.Sotuv_ID]||[]),...(savatDollarMap[s.Sotuv_ID]||[])].some(r=>(r.Check??"").toString().toUpperCase()==="FALSE")).length},
              ] as const).map(tab=>{
                const active = viewTab === tab.key;
                return (
                  <button key={tab.key} onClick={()=>setViewTab(tab.key)}
                    style={{padding:"7px 16px",borderRadius:20,border:`1.5px solid ${active?"var(--primary)":"var(--border)"}`,
                      background:active?"var(--primary)":"var(--white)",
                      color:active?"#fff":"var(--text-2)",
                      fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
                    {tab.label}
                    <span style={{fontSize:11,fontWeight:700,padding:"1px 7px",borderRadius:10,
                      background:active?"rgba(255,255,255,.25)":"var(--bg)"}}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div style={{background:"var(--white)",borderRadius:"var(--radius-xl)",boxShadow:"var(--shadow-sm)"}}>
              {/* Toolbar */}
              {isMobile?(
                <div style={{padding:"12px 14px",borderBottom:"1px solid var(--border)",display:"flex",flexDirection:"column",gap:10}}>
                  <div className="search">
                    <span className="search__icon"><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg></span>
                    <input className="search__input" placeholder="Mijoz, raqam..." value={search} onChange={e=>setSearch(e.target.value)}/>
                    {search&&<button className="search__clear" onClick={()=>setSearch("")}><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>}
                  </div>
                  <MultiSelect items={aItems} value={filterAgent} onChange={setFilterAgent} placeholder="Agent..." fullWidth/>
                  <div style={{display:"flex",gap:8}}>
                    <select value={filterOy} onChange={e=>setFilterOy(e.target.value)} style={{flex:1,padding:"8px 10px",border:"1px solid var(--border)",borderRadius:"var(--radius)",fontSize:13,fontWeight:600,background:"var(--white)",cursor:"pointer",outline:"none"}}>
                      <option value="">Barcha oylar</option>
                      {OY_NOMLARI.map((n,i)=><option key={i+1} value={String(i+1)}>{n}</option>)}
                    </select>
                    <select value={filterYil} onChange={e=>setFilterYil(e.target.value)} style={{flex:1,padding:"8px 10px",border:"1px solid var(--border)",borderRadius:"var(--radius)",fontSize:13,fontWeight:600,background:"var(--white)",cursor:"pointer",outline:"none"}}>
                      <option value="">Barcha yillar</option>
                      {years.map(y=><option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <div style={{fontSize:12,color:"var(--text-3)",fontWeight:600}}>Jami: {viewFiltered.length} ta sotuv</div>
                </div>
              ):(
                <div style={{position:"sticky",top:56,zIndex:10,background:"var(--white)",borderRadius:"var(--radius-xl) var(--radius-xl) 0 0"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 20px",borderBottom:"1px solid var(--border)",flexWrap:"wrap"}}>
                    <div style={{display:"flex",alignItems:"center",padding:"0 14px",height:36,background:"var(--bg)",border:"1px solid var(--border)",borderRadius:"var(--radius)",fontSize:13,fontWeight:700,color:"var(--text)",whiteSpace:"nowrap"}}>
                      Jami: {viewFiltered.length} ta
                    </div>
                    <span style={{flex:1}}/>
                    <div className="search" style={{maxWidth:220}}>
                      <span className="search__icon"><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg></span>
                      <input className="search__input" placeholder="Mijoz, raqam..." value={search} onChange={e=>setSearch(e.target.value)}/>
                      {search&&<button className="search__clear" onClick={()=>setSearch("")}><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>}
                    </div>
                    <MultiSelect items={aItems} value={filterAgent} onChange={setFilterAgent} placeholder="Agent..."/>
                    <select value={filterOy} onChange={e=>setFilterOy(e.target.value)} style={{padding:"8px 12px",border:"1px solid var(--border)",borderRadius:"var(--radius)",fontSize:13,fontWeight:600,background:"var(--white)",cursor:"pointer",outline:"none"}}>
                      <option value="">Barcha oylar</option>
                      {OY_NOMLARI.map((n,i)=><option key={i+1} value={String(i+1)}>{n}</option>)}
                    </select>
                    <select value={filterYil} onChange={e=>setFilterYil(e.target.value)} style={{padding:"8px 12px",border:"1px solid var(--border)",borderRadius:"var(--radius)",fontSize:13,fontWeight:600,background:"var(--white)",cursor:"pointer",outline:"none"}}>
                      <option value="">Barcha yillar</option>
                      {years.map(y=><option key={y} value={y}>{y}</option>)}
                    </select>
                    <button className="btn btn--primary" onClick={openAdd}>
                      <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                      Yangi sotuv
                    </button>
                  </div>
                  {/* Table header */}
                  {viewTab!=="berilmagan"&&(
                  <div style={{display:"grid",gridTemplateColumns:"96px minmax(110px,1.1fr) minmax(120px,1.4fr) minmax(80px,.8fr) minmax(100px,.85fr) minmax(100px,.85fr) minmax(110px,.95fr) minmax(120px,1fr) minmax(50px,.5fr) 96px",padding:"8px 16px",background:"var(--bg)",borderBottom:"1px solid var(--border)"}}>
                    {["#","SANA/RAQAM","MIJOZ","AGENT","JAMI SO'M","JAMI DOLLAR","TO'LANDI","QARZ","IZOH",""].map(h=>(
                      <span key={h} style={{fontSize:10,fontWeight:700,color:"var(--text)",letterSpacing:".05em"}}>{h}</span>
                    ))}
                  </div>
                  )}
                </div>
              )}

              {viewFiltered.length===0&&<div style={{padding:"48px 20px",textAlign:"center",color:"var(--text-3)",fontSize:13}}>Sotuv topilmadi</div>}

              {/* Mobile cards */}
              {isMobile?(
                <div style={{display:"flex",flexDirection:"column"}}>
                  {viewFiltered.map((s,idx)=>{
                    const mjNomi=mijozlar.find(m=>m.Mijoz_ID===s.Mijoz_ID)?.Ism||"—";
                    const agNomi=aMap[s.Agent]||"—";
                    const jS=(savatSomMap[s.Sotuv_ID]||[]).reduce((t,r)=>t+num(r.Summa_som),0);
                    const jD=(savatDollarMap[s.Sotuv_ID]||[]).reduce((t,r)=>t+num(r.Summa),0);
                    const stRows = stolovMap[s.Sotuv_ID] || [];
                    const paidSom = stRows.reduce((t,r) => t + num(r.Summa), 0);
                    const paidDollar = stRows.reduce((t,r) => t + num(r.Summa_dollar), 0);
                    const qarzSom = jS - paidSom;
                    const qarzDollar = jD - paidDollar;
                    return (
                      <div key={s.Sotuv_ID||idx} onClick={()=>router.push(`/sotuv/${s.Sotuv_ID}`)}
                        style={{padding:"14px",borderBottom:idx<viewFiltered.length-1?"1px solid var(--border)":"none",cursor:"pointer"}}>
                        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:8}}>
                          <div>
                            <p style={{fontSize:14,fontWeight:800,color:"var(--primary)"}}>{mjNomi}</p>
                            <p style={{fontSize:12,color:"var(--text-3)",marginTop:2}}>{s.Sana||"—"} {s.Vaqt?`· ${s.Vaqt}`:""} · #{s.Sotuv_Raqami||"—"}</p>
                            <p style={{fontSize:12,color:"var(--text-2)",marginTop:1}}>Agent: {agNomi}</p>
                          </div>
                          <div style={{display:"flex",gap:6,flexShrink:0,marginLeft:8}}>
                            <button disabled={tasdiqSaving===s.Sotuv_ID} onClick={e=>{e.stopPropagation();toggleTasdiq(s);}}
                              title={isTasdiq(s)?"Tasdiqlandi (bosib bekor qilish)":"Tasdiqlash (qarzga qo'shish)"}
                              style={{display:"flex",alignItems:"center",gap:5,padding:"7px 11px",borderRadius:10,border:`1.5px solid ${isTasdiq(s)?"#16a34a":"#f59e0b"}`,background:isTasdiq(s)?"#16a34a":"#fffbeb",cursor:"pointer",color:isTasdiq(s)?"#fff":"#b45309",fontSize:12,fontWeight:700,whiteSpace:"nowrap",opacity:tasdiqSaving===s.Sotuv_ID?.6:1}}>
                              {isTasdiq(s)&&<svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                              {isTasdiq(s)?"Tasdiqlandi":"Tasdiqlash"}
                            </button>
                            <button onClick={e=>{e.stopPropagation();openEdit(s);}}
                              style={{width:34,height:34,borderRadius:10,border:"1px solid #dbeafe",background:"#eff6ff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#2563eb"}}>
                              <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                            </button>
                            <button onClick={e=>{e.stopPropagation();setDeleteTarget(s);}}
                              style={{width:34,height:34,borderRadius:10,border:"1px solid #fee2e2",background:"#fff1f2",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#ef4444"}}>
                              <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            </button>
                          </div>
                        </div>
                        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                          {jS>0&&<span style={{fontSize:13,fontWeight:800,color:"#16a34a"}}>{jS.toLocaleString("ru-RU")} so&apos;m</span>}
                          {jD>0&&<span style={{fontSize:13,fontWeight:800,color:"#2563eb"}}>{fmtUsd(jD)}</span>}
                          {!jS&&!jD&&<span style={{fontSize:12,color:"var(--text-3)"}}>Savat bo&apos;sh</span>}
                        </div>
                        {(paidSom>0||paidDollar>0)&&(
                          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:4}}>
                            <span style={{fontSize:11,color:"var(--text-3)",fontWeight:600}}>To&apos;landi:</span>
                            {paidSom>0&&<span style={{fontSize:11,fontWeight:700,color:"var(--text-2)"}}>{paidSom.toLocaleString("ru-RU")} so&apos;m</span>}
                            {paidDollar>0&&<span style={{fontSize:11,fontWeight:700,color:"#2563eb"}}>{fmtUsd(paidDollar)}</span>}
                          </div>
                        )}
                        {(jS>0||jD>0)&&(
                          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:2}}>
                            {jS>0&&<span style={{fontSize:11,fontWeight:700,color:qarzSom>0?"#ef4444":qarzSom<0?"#2563eb":"#16a34a"}}>{qarzSom>0?"Qarz: "+qarzSom.toLocaleString("ru-RU")+" so'm":qarzSom<0?"Ortiq: "+Math.abs(qarzSom).toLocaleString("ru-RU")+" so'm":"To'liq so'm"}</span>}
                            {jD>0&&<span style={{fontSize:11,fontWeight:700,color:qarzDollar>0?"#ef4444":qarzDollar<0?"#2563eb":"#16a34a"}}>{qarzDollar>0?"Qarz: "+fmtUsd(qarzDollar):qarzDollar<0?"Ortiq: "+fmtUsd(Math.abs(qarzDollar)):"To'liq $"}</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ):(
                /* Desktop rows */
                viewTab==="berilmagan" ? (
                  <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:16}}>
                    {allUndeliveredSom.length>0&&(
                      <div style={{background:"var(--white)",borderRadius:"var(--radius-xl)",border:"1px solid var(--border)",overflow:"hidden"}}>
                        <div style={{padding:"14px 20px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:10}}>
                          <span style={{fontSize:14,fontWeight:800}}>So&apos;m mahsulotlar</span>
                          <span style={{fontSize:11,fontWeight:700,color:"var(--text-3)",background:"var(--bg)",padding:"2px 8px",borderRadius:10}}>{allUndeliveredSom.length} ta</span>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"40px 1.5fr 1fr 70px 130px 130px 160px",padding:"8px 16px",background:"var(--bg)",borderBottom:"1px solid var(--border)"}}>
                          {["#","MAHSULOT","MIJOZ","SONI","NARX","JAMI","YETKAZIB BERILDIMI?"].map(h=>(
                            <span key={h} style={{fontSize:10,fontWeight:700,color:"var(--text)",letterSpacing:".05em"}}>{h}</span>
                          ))}
                        </div>
                        {allUndeliveredSom.map((r,idx)=>{
                          const mNomi=mMap[r.Mahsulot_ID]?.Nomi||r.Mahsulot_ID;
                          const sv=sotuvlar.find(sv=>sv.Sotuv_ID===r.Sotuv_ID);
                          const mjNomi=mijozlar.find(m=>m.Mijoz_ID===sv?.Mijoz_ID)?.Ism||"—";
                          const isChecked=(r.Check??"").toString().toUpperCase()==="TRUE";
                          const isSav=checkSaving===r.Savat_ID;
                          return (
                            <div key={r.Savat_ID} style={{display:"grid",gridTemplateColumns:"40px 1.5fr 1fr 70px 130px 130px 160px",padding:"10px 16px",alignItems:"center",borderBottom:idx<allUndeliveredSom.length-1?"1px solid var(--border)":"none"}}>
                              <span style={{fontSize:12,color:"var(--text-3)"}}>{idx+1}</span>
                              <span style={{fontSize:13,fontWeight:700}}>{mNomi}</span>
                              <span style={{fontSize:12,color:"var(--text-2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{mjNomi}</span>
                              <span style={{fontSize:13,fontWeight:600}}>{r.Soni}</span>
                              <span style={{fontSize:13,fontWeight:600}}>{num(r.Som_Narx).toLocaleString("ru-RU")} so&apos;m</span>
                              <span style={{fontSize:13,fontWeight:700,color:"#16a34a"}}>{num(r.Summa_som).toLocaleString("ru-RU")} so&apos;m</span>
                              <div style={{display:"flex",gap:4}}>
                                <button disabled={isSav} onClick={()=>handleToggleCheck(r.Savat_ID,r.Sotuv_ID,"Sotuv_Savat","TRUE")}
                                  style={{padding:"4px 14px",borderRadius:20,border:"none",cursor:isSav?"default":"pointer",fontWeight:700,fontSize:12,background:isChecked?"#16a34a":"#f3f4f6",color:isChecked?"#fff":"var(--text-3)",opacity:isSav?.7:1}}>Ha</button>
                                <button disabled={isSav} onClick={()=>handleToggleCheck(r.Savat_ID,r.Sotuv_ID,"Sotuv_Savat","FALSE")}
                                  style={{padding:"4px 14px",borderRadius:20,border:"none",cursor:isSav?"default":"pointer",fontWeight:700,fontSize:12,background:!isChecked?"#ef4444":"#f3f4f6",color:!isChecked?"#fff":"var(--text-3)",opacity:isSav?.7:1}}>Yo&apos;q</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {allUndeliveredDollar.length>0&&(
                      <div style={{background:"var(--white)",borderRadius:"var(--radius-xl)",border:"1px solid var(--border)",overflow:"hidden"}}>
                        <div style={{padding:"14px 20px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:10}}>
                          <span style={{fontSize:14,fontWeight:800}}>Dollar mahsulotlar</span>
                          <span style={{fontSize:11,fontWeight:700,color:"var(--text-3)",background:"var(--bg)",padding:"2px 8px",borderRadius:10}}>{allUndeliveredDollar.length} ta</span>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"40px 1.5fr 1fr 70px 120px 120px 160px",padding:"8px 16px",background:"var(--bg)",borderBottom:"1px solid var(--border)"}}>
                          {["#","MAHSULOT","MIJOZ","SONI","NARX ($)","JAMI ($)","YETKAZIB BERILDIMI?"].map(h=>(
                            <span key={h} style={{fontSize:10,fontWeight:700,color:"var(--text)",letterSpacing:".05em"}}>{h}</span>
                          ))}
                        </div>
                        {allUndeliveredDollar.map((r,idx)=>{
                          const mNomi=mMap[r.Mahsulot_ID]?.Nomi||r.Mahsulot_ID;
                          const sv=sotuvlar.find(sv=>sv.Sotuv_ID===r.Sotuv_ID);
                          const mjNomi=mijozlar.find(m=>m.Mijoz_ID===sv?.Mijoz_ID)?.Ism||"—";
                          const isChecked=(r.Check??"").toString().toUpperCase()==="TRUE";
                          const isSav=checkSaving===r.Savat_ID;
                          return (
                            <div key={r.Savat_ID} style={{display:"grid",gridTemplateColumns:"40px 1.5fr 1fr 70px 120px 120px 160px",padding:"10px 16px",alignItems:"center",borderBottom:idx<allUndeliveredDollar.length-1?"1px solid var(--border)":"none"}}>
                              <span style={{fontSize:12,color:"var(--text-3)"}}>{idx+1}</span>
                              <span style={{fontSize:13,fontWeight:700}}>{mNomi}</span>
                              <span style={{fontSize:12,color:"var(--text-2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{mjNomi}</span>
                              <span style={{fontSize:13,fontWeight:600}}>{r.Soni}</span>
                              <span style={{fontSize:13,fontWeight:600,color:"#2563eb"}}>{fmtUsd(num(r.Narx))}</span>
                              <span style={{fontSize:13,fontWeight:700,color:"#2563eb"}}>{fmtUsd(num(r.Summa))}</span>
                              <div style={{display:"flex",gap:4}}>
                                <button disabled={isSav} onClick={()=>handleToggleCheck(r.Savat_ID,r.Sotuv_ID,"Sotuv_savat_dollar","TRUE")}
                                  style={{padding:"4px 14px",borderRadius:20,border:"none",cursor:isSav?"default":"pointer",fontWeight:700,fontSize:12,background:isChecked?"#16a34a":"#f3f4f6",color:isChecked?"#fff":"var(--text-3)",opacity:isSav?.7:1}}>Ha</button>
                                <button disabled={isSav} onClick={()=>handleToggleCheck(r.Savat_ID,r.Sotuv_ID,"Sotuv_savat_dollar","FALSE")}
                                  style={{padding:"4px 14px",borderRadius:20,border:"none",cursor:isSav?"default":"pointer",fontWeight:700,fontSize:12,background:!isChecked?"#ef4444":"#f3f4f6",color:!isChecked?"#fff":"var(--text-3)",opacity:isSav?.7:1}}>Yo&apos;q</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {allUndeliveredSom.length===0&&allUndeliveredDollar.length===0&&(
                      <div style={{padding:"48px 20px",textAlign:"center",color:"var(--text-3)",fontSize:13}}>Yetkazilmagan mahsulot topilmadi</div>
                    )}
                  </div>
                ) : (
                  <>
                    {viewFiltered.map((s,idx)=>{
                      const mjNomi=mijozlar.find(m=>m.Mijoz_ID===s.Mijoz_ID)?.Ism||"—";
                      const agNomi=aMap[s.Agent]||"—";
                      const jS=(savatSomMap[s.Sotuv_ID]||[]).reduce((t,r)=>t+num(r.Summa_som),0);
                      const jD=(savatDollarMap[s.Sotuv_ID]||[]).reduce((t,r)=>t+num(r.Summa),0);
                      const stRows = stolovMap[s.Sotuv_ID] || [];
                      const paidSom = stRows.reduce((t,r) => t + num(r.Som), 0);
                      const paidDollar = stRows.reduce((t,r) => t + num(r.Dollar), 0);
                      const qarzSom = jS - paidSom;
                      const qarzDollar = jD - paidDollar;
                      return (
                        <div key={s.Sotuv_ID||idx} onClick={()=>router.push(`/sotuv/${s.Sotuv_ID}`)}
                          style={{display:"grid",gridTemplateColumns:"96px minmax(110px,1.1fr) minmax(120px,1.4fr) minmax(80px,.8fr) minmax(100px,.85fr) minmax(100px,.85fr) minmax(110px,.95fr) minmax(120px,1fr) minmax(50px,.5fr) 96px",
                            padding:"10px 16px",alignItems:"center",borderBottom:idx<viewFiltered.length-1?"1px solid var(--border)":"none",
                            cursor:"pointer",background:"transparent",transition:"background .1s"}}
                          onMouseEnter={e=>(e.currentTarget.style.background="var(--bg)")}
                          onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}} onClick={e=>e.stopPropagation()}>
                            <span style={{fontSize:13,color:"var(--text-3)"}}>{idx+1}</span>
                            <button disabled={tasdiqSaving===s.Sotuv_ID} onClick={e=>{e.stopPropagation();toggleTasdiq(s);}} title={isTasdiq(s)?"Tasdiqlandi (bosib bekor qilish)":"Tasdiqlash (qarzga qo'shish)"}
                              style={{display:"flex",alignItems:"center",gap:3,padding:"3px 8px",borderRadius:20,border:`1.5px solid ${isTasdiq(s)?"#16a34a":"#f59e0b"}`,background:isTasdiq(s)?"#16a34a":"#fffbeb",cursor:"pointer",color:isTasdiq(s)?"#fff":"#b45309",fontSize:10,fontWeight:700,whiteSpace:"nowrap",lineHeight:1.4,opacity:tasdiqSaving===s.Sotuv_ID?.6:1}}>
                              {isTasdiq(s)
                                ?<><svg width="9" height="9" fill="none" stroke="#fff" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7"/></svg>Tasdiqlandi</>
                                :"Tasdiqlash"}
                            </button>
                          </div>
                          <div>
                            <p style={{fontSize:13,fontWeight:700}}>{s.Sana||"—"}</p>
                            <p style={{fontSize:11,color:"var(--text-3)",marginTop:1}}>#{s.Sotuv_Raqami||"—"}{s.Vaqt?` · ${s.Vaqt}`:""}</p>
                          </div>
                          <div>
                            <p style={{fontSize:13,fontWeight:800,color:"var(--primary)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{mjNomi}</p>
                          </div>
                          <span style={{fontSize:12,fontWeight:600,color:"var(--text-2)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{agNomi}</span>
                          <span style={{fontSize:13,fontWeight:700,color:jS?"#16a34a":"var(--text-3)"}}>{jS?jS.toLocaleString("ru-RU")+" so'm":"—"}</span>
                          <span style={{fontSize:13,fontWeight:700,color:jD?"#2563eb":"var(--text-3)"}}>{jD?fmtUsd(jD):"—"}</span>
                          <div>
                            {paidSom>0&&<p style={{fontSize:12,fontWeight:700,color:"#16a34a"}}>{paidSom.toLocaleString("ru-RU")} so&apos;m</p>}
                            {paidDollar>0&&<p style={{fontSize:12,fontWeight:700,color:"#2563eb",marginTop:paidSom>0?2:0}}>{fmtUsd(paidDollar)}</p>}
                            {!paidSom&&!paidDollar&&<span style={{fontSize:12,color:"var(--text-3)"}}>—</span>}
                          </div>
                          <div>
                            {jS>0&&<p style={{fontSize:12,fontWeight:700,color:qarzSom>0?"#ef4444":qarzSom<0?"#2563eb":"#16a34a"}}>{qarzSom>0?"Qarz: "+qarzSom.toLocaleString("ru-RU")+" so'm":qarzSom<0?"Ortiq: "+Math.abs(qarzSom).toLocaleString("ru-RU")+" so'm":"To'liq so'm"}</p>}
                            {jD>0&&<p style={{fontSize:12,fontWeight:700,color:qarzDollar>0?"#ef4444":qarzDollar<0?"#2563eb":"#16a34a",marginTop:jS>0?2:0}}>{qarzDollar>0?"Qarz: "+fmtUsd(qarzDollar):qarzDollar<0?"Ortiq: "+fmtUsd(Math.abs(qarzDollar)):"To'liq $"}</p>}
                            {!jS&&!jD&&<span style={{fontSize:12,color:"var(--text-3)"}}>—</span>}
                          </div>
                          <span style={{fontSize:12,color:"var(--text-2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.Izoh||"—"}</span>
                          <div style={{display:"flex",gap:4}} onClick={e=>e.stopPropagation()}>
                            <button onClick={()=>{
                              const mj=mijozlar.find(m=>m.Mijoz_ID===s.Mijoz_ID);
                              const ag=aMap[s.Agent]||"";
                              // Mijozning eski qarzi (detail sahifasidagi kabi)
                              const allIds=sotuvlar.filter(sv=>sv.Mijoz_ID===s.Mijoz_ID&&sv.Sotuv_ID!==s.Sotuv_ID&&qarzTrue(sv)).map(sv=>sv.Sotuv_ID);
                              const isDollar=(v:string)=>String(v||"").toLowerCase().includes("dollar")||v.trim()==="$";
                              const somJami=allIds.flatMap(id=>savatSomMap[id]||[]).reduce((t,r)=>t+num(r.Summa_som),0);
                              const dollarJami=allIds.flatMap(id=>savatDollarMap[id]||[]).reduce((t,r)=>t+num(r.Summa),0);
                              // Barcha to'lovlar (Mijoz_ID bo'yicha, umumiy to'lovlar ham) minus shu sotuvning to'lovlari
                              const curPay=stolovMap[s.Sotuv_ID]||[];
                              const allP=stolovByMijoz[s.Mijoz_ID]||{som:0,dollar:0};
                              const tolovSom=allP.som - curPay.reduce((t,r)=>t+(!isDollar(r.Valyuta)?num(r.Summa):0),0);
                              const tolovDollar=allP.dollar - curPay.reduce((t,r)=>t+(isDollar(r.Valyuta)?num(r.Summa_dollar):0),0);
                              const bSom=num(mj?.Boshlangich_Balans_som);
                              const bDollar=num(mj?.Boshlangich_Balans_dollar);
                              const eskiSom=bSom+somJami-tolovSom;
                              const eskiDollar=bDollar+dollarJami-tolovDollar;
                              sessionStorage.setItem(`chek_${s.Sotuv_ID}`,JSON.stringify({savatSom:savatSomMap[s.Sotuv_ID]||[],savatDollar:savatDollarMap[s.Sotuv_ID]||[],mMap}));
                              const params=new URLSearchParams({sana:s.Sana||"",agent:ag,mijozIsm:mj?.Ism||"",mijozTel:mj?.Telefon||"",totalSom:String(eskiSom),totalDollar:String(eskiDollar)});
                              router.push(`/sotuv/${s.Sotuv_ID}/chek?${params}`);
                            }}
                              style={{width:30,height:30,borderRadius:8,border:"none",background:"#f5f3ff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#7c3aed"}}
                              title="Chekni ochish"
                              onMouseEnter={e=>(e.currentTarget.style.background="#ddd6fe")}
                              onMouseLeave={e=>(e.currentTarget.style.background="#f5f3ff")}>
                              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                            </button>
                            <button onClick={()=>openEdit(s)}
                              style={{width:30,height:30,borderRadius:8,border:"none",background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#2563eb"}}
                              onMouseEnter={e=>(e.currentTarget.style.background="#dbeafe")}
                              onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                            </button>
                            <button onClick={()=>setDeleteTarget(s)}
                              style={{width:30,height:30,borderRadius:8,border:"none",background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#ef4444"}}
                              onMouseEnter={e=>(e.currentTarget.style.background="#fee2e2")}
                              onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Add Modal ── */}
      {addOpen&&(
        <div style={modalOverlay} onClick={()=>setAddOpen(false)}>
          <div style={modalBox} onClick={e=>e.stopPropagation()}>
            {isMobile&&<div style={{width:40,height:4,borderRadius:2,background:"var(--border)",margin:"12px auto 0"}}/>}
            <div style={{display:"flex",alignItems:"center",gap:16,padding:"16px 20px",borderBottom:"1px solid var(--border)"}}>
              <div style={{width:40,height:40,borderRadius:12,background:"#f0fdf4",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <svg width="18" height="18" fill="none" stroke="#16a34a" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
              </div>
              <div style={{flexShrink:0}}>
                <h2 style={{fontSize:16,fontWeight:800,marginBottom:2}}>Yangi sotuv</h2>
                <p style={{fontSize:12,color:"var(--text-3)",fontWeight:600}}>{sana}</p>
              </div>
              {!isMobile && (
                <div style={{width:240,flexShrink:1,minWidth:0}}>
                  <SearchSelect items={mJItems} value={addMijoz} onChange={setAddMijoz} placeholder="Mijoz" borderColor={!addMijoz?"#ef4444":undefined}/>
                  {addMijoz && addMijozEski && (
                    <div style={{display:"flex",gap:8,alignItems:"center",marginTop:4,flexWrap:"wrap"}}>
                      <span style={{fontSize:10,fontWeight:700,color:"var(--text-3)",letterSpacing:".05em"}}>QOLDIQ:</span>
                      {(addMijozEski.som!==0||addMijozEski.dollar===0)&&<span style={{fontSize:12,fontWeight:800,color:addMijozEski.som>0?"#ef4444":addMijozEski.som<0?"#2563eb":"#16a34a"}}>{addMijozEski.som.toLocaleString("ru-RU")} so&apos;m</span>}
                      {addMijozEski.dollar!==0&&<span style={{fontSize:12,fontWeight:800,color:addMijozEski.dollar>0?"#ef4444":"#2563eb"}}>{fmtUsd(addMijozEski.dollar)}</span>}
                    </div>
                  )}
                </div>
              )}
              {!isMobile && isAdmin && (
                <div style={{width:200,flexShrink:1,minWidth:0}}>
                  <SearchSelect items={aItems} value={addAgent} onChange={v=>{setAddAgent(v);setAddMijoz("");}} placeholder="Agent" borderColor={!addAgent?"#ef4444":undefined}/>
                </div>
              )}
              {!isMobile && (
                <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                  <label style={{fontSize:12,fontWeight:600,color:"var(--text-2)"}}>Kurs:</label>
                  <input value={addKurs} onChange={e=>setAddKurs(e.target.value)} placeholder="12800" inputMode="numeric"
                    style={{width:90,padding:"8px 10px",border:`1px solid ${num(addKurs)>0&&num(addKurs)<11000?"#ef4444":"var(--border)"}`,borderRadius:"var(--radius)",fontSize:13,fontWeight:600,outline:"none",textAlign:"center"}}/>
                </div>
              )}
              <button onClick={()=>setAddOpen(false)} style={{width:34,height:34,borderRadius:8,border:"1px solid var(--border)",background:"var(--white)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginLeft:"auto"}}>
                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:12,overflowY:"auto",flex:1}}>
              {isMobile && (
              <div style={{display:"grid",gridTemplateColumns:"1fr",gap:12}}>
                <div>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:6,minHeight:16}}>
                    <label style={{fontSize:12,fontWeight:600,color:"var(--text-2)"}}>Mijoz *</label>
                    {addMijoz && addMijozEski && (
                      <span style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",justifyContent:"flex-end"}}>
                        <span style={{fontSize:10,fontWeight:700,color:"var(--text-3)",letterSpacing:".05em"}}>QOLDIQ:</span>
                        {(addMijozEski.som!==0||addMijozEski.dollar===0)&&<span style={{fontSize:12,fontWeight:800,color:addMijozEski.som>0?"#ef4444":addMijozEski.som<0?"#2563eb":"#16a34a"}}>{addMijozEski.som.toLocaleString("ru-RU")} so&apos;m</span>}
                        {addMijozEski.dollar!==0&&<span style={{fontSize:12,fontWeight:800,color:addMijozEski.dollar>0?"#ef4444":"#2563eb"}}>{fmtUsd(addMijozEski.dollar)}</span>}
                      </span>
                    )}
                  </div>
                  <SearchSelect items={mJItems} value={addMijoz} onChange={setAddMijoz} placeholder="Mijoz tanlang..." borderColor={!addMijoz?"#ef4444":undefined}/>
                </div>
                {isAdmin && (
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:"var(--text-2)",display:"block",marginBottom:6}}>Agent *</label>
                    <SearchSelect items={aItems} value={addAgent} onChange={v=>{setAddAgent(v);setAddMijoz("");}} placeholder="Agent tanlang..." borderColor={!addAgent?"#ef4444":undefined}/>
                  </div>
                )}
              </div>
              )}

              {/* Sotuvdan keyingi qoldiq — faqat savatda summa bo'lsa */}
              {addMijoz && addMijozEski && (jamiSom>0 || jamiDollar>0) && (
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexWrap:"wrap",background:"var(--bg)",border:"1px solid var(--border)",borderRadius:"var(--radius)",padding:"11px 14px"}}>
                  <span style={{fontSize:12,fontWeight:600,color:"var(--text-3)"}}>Sotuvdan keyingi qoldiq:</span>
                  <span style={{display:"flex",gap:10}}>
                    {((addMijozEski.som+jamiSom)!==0||(addMijozEski.dollar+jamiDollar)===0)&&<span style={{fontSize:14,fontWeight:800,color:(addMijozEski.som+jamiSom)>0?"#ef4444":(addMijozEski.som+jamiSom)<0?"#2563eb":"#16a34a"}}>{(addMijozEski.som+jamiSom).toLocaleString("ru-RU")} so&apos;m</span>}
                    {(addMijozEski.dollar+jamiDollar)!==0&&<span style={{fontSize:14,fontWeight:800,color:(addMijozEski.dollar+jamiDollar)>0?"#ef4444":"#2563eb"}}>{fmtUsd(addMijozEski.dollar+jamiDollar)}</span>}
                  </span>
                </div>
              )}

              <div style={{borderTop:"1px solid var(--border)",paddingTop:12}}>
                {isMobile && (
                  <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:8,marginBottom:12}}>
                    <label style={{fontSize:12,fontWeight:600,color:"var(--text-2)"}}>Kurs:</label>
                    <input value={addKurs} onChange={e=>setAddKurs(e.target.value)} placeholder="12800" inputMode="numeric"
                      style={{width:100,padding:"6px 10px",border:`1px solid ${num(addKurs)>0&&num(addKurs)<11000?"#ef4444":"var(--border)"}`,borderRadius:"var(--radius)",fontSize:13,fontWeight:600,outline:"none",textAlign:"center"}}/>
                  </div>
                )}
                <SavatEditor items={savat} onUpdate={updateItem} onRemove={id=>setSavat(p=>p.filter(r=>r.id!==id))} onAddSom={addSomItem} onAddDollar={addDollarItem} jamiS={jamiSom} jamiD={jamiDollar} kursVal={addKurs} onKursChange={setAddKurs} isMobile={savatMobile} somItems={mhSomItems} dollarItems={mhDollarItems} mMap={mMap}/>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:"var(--text-2)",display:"block",marginBottom:6}}>Izoh</label>
                <input value={addIzoh} onChange={e=>setAddIzoh(e.target.value)} placeholder="Ixtiyoriy..."
                  style={{width:"100%",padding:"10px 12px",border:"1px solid var(--border)",borderRadius:"var(--radius)",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
              </div>
            </div>
            <div style={{display:"flex",gap:10,padding:"16px 20px",borderTop:"1px solid var(--border)",paddingBottom:isMobile?"max(16px, env(safe-area-inset-bottom))":16}}>
              <button className="btn btn--outline" style={{flex:1}} onClick={()=>setAddOpen(false)}>Bekor</button>
              <button className="btn btn--primary" style={{flex:2}} onClick={handleSave}
                disabled={saving||!addMijoz||!addAgent||savat.filter(s=>s.Mahsulot_ID&&s.Soni&&(num(s.Som_Narx)||num(s.Narx))).length===0||savat.some(s=>isBelowCost(s,addKurs,mMap))}>
                {saving&&<span className="spinner"/>} Saqlash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {detailSotuv&&(
        <div style={modalOverlay} onClick={()=>setDetailSotuv(null)}>
          <div style={modalBox} onClick={e=>e.stopPropagation()}>
            {isMobile&&<div style={{width:40,height:4,borderRadius:2,background:"var(--border)",margin:"12px auto 0"}}/>}
            <div style={{display:"flex",alignItems:"center",gap:16,padding:"16px 20px",borderBottom:"1px solid var(--border)"}}>
              <div style={{width:40,height:40,borderRadius:12,background:"#eff6ff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <svg width="18" height="18" fill="none" stroke="#2563eb" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              </div>
              <div style={{flex:1}}>
                <h2 style={{fontSize:16,fontWeight:800,marginBottom:2}}>Sotuvni tahrirlash</h2>
                <p style={{fontSize:12,color:"var(--text-3)",fontWeight:600}}>#{detailSotuv.Sotuv_Raqami} — {detailSotuv.Sana}</p>
              </div>
              <button onClick={()=>setDetailSotuv(null)} style={{width:34,height:34,borderRadius:8,border:"1px solid var(--border)",background:"var(--white)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:12,overflowY:"auto",flex:1}}>
              <div style={{display:"grid",gridTemplateColumns:(isMobile||!isAdmin)?"1fr":"1fr 1fr",gap:12}}>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:"var(--text-2)",display:"block",marginBottom:6}}>Mijoz *</label>
                  <SearchSelect items={mJItemsEdit} value={editMijoz} onChange={setEditMijoz} placeholder="Mijoz tanlang..." borderColor={!editMijoz?"#ef4444":undefined}/>
                </div>
                {isAdmin && (
                  <div>
                    <label style={{fontSize:12,fontWeight:600,color:"var(--text-2)",display:"block",marginBottom:6}}>Agent *</label>
                    <SearchSelect items={aItems} value={editAgent} onChange={v=>{ if(v!==editAgent) setEditMijoz(""); setEditAgent(v); }} placeholder="Agent tanlang..." borderColor={!editAgent?"#ef4444":undefined}/>
                  </div>
                )}
              </div>
              <div style={{borderTop:"1px solid var(--border)",paddingTop:12}}>
                <SavatEditor items={editSavat} onUpdate={updateEditItem} onRemove={id=>setEditSavat(p=>p.filter(r=>r.id!==id))} onAddSom={addSomEditItem} onAddDollar={addDollarEditItem} jamiS={editJamiSom} jamiD={editJamiDollar} kursVal={editKurs} onKursChange={setEditKurs} isMobile={savatMobile} somItems={mhSomItems} dollarItems={mhDollarItems} mMap={mMap}/>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:600,color:"var(--text-2)",display:"block",marginBottom:6}}>Izoh</label>
                <input value={editIzoh} onChange={e=>setEditIzoh(e.target.value)} placeholder="Ixtiyoriy..."
                  style={{width:"100%",padding:"10px 12px",border:"1px solid var(--border)",borderRadius:"var(--radius)",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
              </div>
            </div>
            <div style={{display:"flex",gap:10,padding:"16px 20px",borderTop:"1px solid var(--border)",paddingBottom:isMobile?"max(16px, env(safe-area-inset-bottom))":16}}>
              <button className="btn btn--outline" style={{flex:1}} onClick={()=>setDetailSotuv(null)}>Bekor</button>
              <button className="btn btn--primary" style={{flex:2}} onClick={handleUpdate}
                disabled={editSaving||!editMijoz||!editAgent||editSavat.some(s=>isBelowCost(s,editKurs,mMap))}>
                {editSaving&&<span className="spinner"/>} Saqlash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ── */}
      {deleteTarget&&(
        <div className="modal-overlay" onClick={()=>setDeleteTarget(null)}>
          <div className="confirm" onClick={e=>e.stopPropagation()}>
            <div className="confirm__icon"><svg width="24" height="24" fill="none" stroke="#ef4444" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></div>
            <h3 className="confirm__title">Sotuvni o&apos;chirish</h3>
            <p className="confirm__text"><strong>Sotuv #{deleteTarget.Sotuv_Raqami}</strong> va barcha savat elementlari o&apos;chiriladi.</p>
            <div className="confirm__actions">
              <button className="btn btn--outline" style={{flex:1}} onClick={()=>setDeleteTarget(null)}>Bekor</button>
              <button className="btn btn--red" style={{flex:1}} onClick={handleDelete} disabled={deleting}>
                {deleting&&<span className="spinner"/>} O&apos;chirish
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
