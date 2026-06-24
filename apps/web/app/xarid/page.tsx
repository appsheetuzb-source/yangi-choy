"use client";
import { fetchSheet, afterWrite } from "@/lib/sheet-cache";
import { useScrollLock } from "@/lib/use-scroll-lock";
import FabAdd from "@/components/FabAdd";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";

interface Xarid {
  Xarid_ID: string; Sana: string; Sotuv_Raqami: string;
  Taminotchi_ID: string; Vaqt: string; Izoh: string; Yil: string; Oy: string;
  Akt_sverka?: string; Qoshdi?: string;
}
interface XaridSavat {
  X_Savat: string; Xarid_ID: string; Mahsulot_ID: string; Ombor_ID: string;
  Soni: string; Narxi: string; Narx_som: string; Foiz: string; Foizli_narx_dollar: string;
  Summa_Som: string; Jami_Summa: string;
}
interface Taminotchi { Taminotchi_ID: string; Ism: string; Boshlangich_som?: string; Boshlangich_Balans?: string; }
interface XTolov { X_Tolov_ID: string; Taminotchi_ID: string; Valyuta: string; Summa: string; Som: string; Summa_dollar: string; Dollar: string; }
interface Mahsulot {
  Mahsulot_ID: string; Nomi: string; Kg: string; Ombor_ID: string;
  Sotuv_dollar: string; Sotuv_som: string; Tan_dollar: string; Tan_som: string;
}
interface SavatItem {
  id: string; Mahsulot_ID: string; Soni: string; Narxi: string; Narx_som: string; Foiz: string;
}

const OY_NOMLARI = ["Yanvar","Fevral","Mart","Aprel","May","Iyun","Iyul","Avgust","Sentabr","Oktabr","Noyabr","Dekabr"];

function uid()  { return Math.random().toString(36).slice(2, 10); }
function num(v: string|number|undefined) {
  return parseFloat(String(v||"0").replace(/\s/g,"").replace(",",".")) || 0;
}
function fmtSom(v: string|number|undefined) {
  const n=num(v); return n?n.toLocaleString("ru-RU")+" so'm":"—";
}
function fmtUsd(v: string|number|undefined) {
  const n=num(v);
  return n?"$"+n.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2}):"—";
}
function fmtRaqam(r: string) { return r || "—"; }
function nowStr() {
  const d=new Date();
  const t=new Date(d.toLocaleString("en-US",{timeZone:"Asia/Tashkent"}));
  const pad=(n:number)=>String(n).padStart(2,"0");
  const dd=pad(t.getDate()),mm=pad(t.getMonth()+1),yy=String(t.getFullYear());
  const hh=pad(t.getHours()),mi=pad(t.getMinutes()),ss=pad(t.getSeconds());
  return { sana:`${dd}.${mm}.${yy}`, vaqt:`${hh}:${mi}:${ss}` };
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
  const label=value.length===0?(placeholder||"Tanlang..."): value.length===1?(items.find(i=>i.id===value[0])?.label||""):(`${value.length} ta tanlangan`);
  return (
    <div ref={ref} style={{position:"relative", minWidth: fullWidth ? undefined : 180, flex: fullWidth ? 1 : undefined}}>
      <div onClick={()=>{setOpen(o=>!o);setQ("");}}
        style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",background:"var(--white)",border:"1px solid var(--border)",borderRadius:"var(--radius)",cursor:"pointer",fontSize:13,fontWeight:600,color:value.length?"var(--text)":"var(--text-3)",gap:8,whiteSpace:"nowrap"}}>
        <span style={{overflow:"hidden",textOverflow:"ellipsis"}}>{label}</span>
        {value.length>0&&(
          <span onClick={e=>{e.stopPropagation();onChange([]);}} style={{display:"flex",alignItems:"center",color:"var(--text-3)",flexShrink:0}}>
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </span>
        )}
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
          <div style={{maxHeight:240,overflowY:"auto",overscrollBehavior:"contain"}}
            onTouchMove={e=>e.stopPropagation()}>
            {list.length===0&&<div style={{padding:"12px 14px",fontSize:13,color:"var(--text-3)"}}>Topilmadi</div>}
            {list.map(i=>{
              const checked=value.includes(i.id);
              return (
                <div key={i.id} onClick={()=>toggle(i.id)}
                  style={{display:"flex",alignItems:"center",gap:10,padding:"9px 14px",fontSize:13,cursor:"pointer",background:checked?"var(--bg)":"transparent",fontWeight:checked?700:400}}
                  onMouseEnter={e=>(e.currentTarget.style.background="var(--bg)")}
                  onMouseLeave={e=>(e.currentTarget.style.background=checked?"var(--bg)":"transparent")}>
                  <div style={{width:16,height:16,borderRadius:4,border:checked?"none":"1.5px solid var(--border)",background:checked?"var(--primary)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .12s"}}>
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

function SearchSelect({ items, value, onChange, placeholder, clearable }: {
  items:{id:string;label:string}[]; value:string; onChange:(id:string)=>void; placeholder?:string; clearable?:boolean;
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
        style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"var(--bg)",border:"1px solid var(--border)",borderRadius:"var(--radius)",cursor:"pointer",fontSize:14,fontWeight:selected?400:600,color:selected?"var(--text)":"var(--text-2)"}}>
        <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{selected?selected.label:placeholder||"Tanlang..."}</span>
        <span style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
          {clearable&&value&&(
            <span onClick={e=>{e.stopPropagation();onChange("");setOpen(false);}} title="Bekor qilish"
              style={{display:"flex",alignItems:"center",justifyContent:"center",width:18,height:18,borderRadius:4,cursor:"pointer",color:"var(--text-3)"}}
              onMouseEnter={e=>(e.currentTarget.style.background="var(--border)")} onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
              <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
            </span>
          )}
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{color:"var(--text-3)",transform:open?"rotate(180deg)":"none",transition:"transform .15s"}}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
          </svg>
        </span>
      </div>
      {open&&pos&&(
        <div style={{position:"fixed",top:pos.top,left:pos.left,width:pos.width,zIndex:1000,background:"var(--white)",border:"1px solid var(--border)",borderRadius:"var(--radius)",boxShadow:"var(--shadow)",overflow:"hidden"}}>
          <div style={{padding:"8px",borderBottom:"1px solid var(--border)"}}>
            <input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Qidirish..."
              style={{width:"100%",padding:"7px 10px",border:"1px solid var(--border)",borderRadius:8,fontSize:13,outline:"none"}}/>
          </div>
          <div style={{maxHeight:220,overflowY:"auto",overscrollBehavior:"contain"}}
            onTouchMove={e=>e.stopPropagation()}>
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

export default function XaridPage() {
  const router = useRouter();
  const [xaridlar, setXaridlar]           = useState<Xarid[]>([]);
  const [savatMap, setSavatMap]           = useState<Record<string,XaridSavat[]>>({});
  const [xtolov, setXtolov]               = useState<XTolov[]>([]);
  const [taminotchilar, setTaminotchilar] = useState<Taminotchi[]>([]);
  const [tMap, setTMap]                   = useState<Record<string,string>>({});
  const [mahsulotlar, setMahsulotlar]     = useState<Mahsulot[]>([]);
  const [mMap, setMMap]                   = useState<Record<string,Mahsulot>>({});
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string|null>(null);
  const [search, setSearch]               = useState("");
  const [isMobile, setIsMobile]           = useState(false);

  const now = new Date();
  const [filterOy, setFilterOy]   = useState(String(now.getMonth()+1));
  const [filterYil, setFilterYil] = useState(String(now.getFullYear()));
  const [filterT, setFilterT]     = useState<string[]>([]);

  const [addOpen, setAddOpen]             = useState(false);
  const [saving, setSaving]               = useState(false);
  const [taminotchiId, setTaminotchiId]   = useState("");
  const [izoh, setIzoh]                   = useState("");
  const [savat, setSavat]                 = useState<SavatItem[]>([]);
  const [detailXarid, setDetailXarid]     = useState<Xarid|null>(null);
  const [editTaminotchi, setEditTaminotchi] = useState("");
  const [editIzoh, setEditIzoh]           = useState("");
  const [editSavat, setEditSavat]         = useState<SavatItem[]>([]);
  const [editSaving, setEditSaving]       = useState(false);
  const [chegirmaHa, setChegirmaHa]           = useState(false);
  const [chegirmaFoiz, setChegirmaFoiz]       = useState("");
  const [editChegirmaHa, setEditChegirmaHa]   = useState(false);
  const [editChegirmaFoiz, setEditChegirmaFoiz] = useState("");
  const [triedSave, setTriedSave]             = useState(false);
  const [editTriedSave, setEditTriedSave]     = useState(false);
  const [deleteTarget, setDeleteTarget]   = useState<Xarid|null>(null);

  // Modal ochilganda orqa fon scroll'i qulflanadi (faqat forma ichi scroll bo'ladi)
  useScrollLock(addOpen || !!detailXarid || !!deleteTarget);
  const [deleting, setDeleting]           = useState(false);

  useEffect(()=>{
    const check=()=>setIsMobile(window.innerWidth<768);
    check();
    window.addEventListener("resize",check);
    return ()=>window.removeEventListener("resize",check);
  },[]);

  const loadData = useCallback((delay=0)=>{
    setLoading(true);
    setTimeout(()=>{
      // Faza 1 — yengil (list DARHOL ko'rinadi)
      Promise.all([
        fetchSheet("Xarid"),
        fetchSheet("Taminotchi"),
        fetchSheet("Mahsulot"),
      ]).then(([xR,tR,mR])=>{
        if(xR.error) throw new Error(xR.error);
        const pDate=(s:string)=>{const[d,mo,y]=(s||"").split(".").map(Number);return(y||0)*10000+(mo||0)*100+(d||0);};
        const pTime=(v:string)=>{const[h,m,s]=(v||"").split(":").map(Number);return(h||0)*3600+(m||0)*60+(s||0);};
        const sorted=[...(xR.data as Xarid[])].sort((a,b)=>{const dd=pDate(b.Sana)-pDate(a.Sana);return dd!==0?dd:pTime(b.Vaqt)-pTime(a.Vaqt);});
        setXaridlar(sorted);
        const t=tR.data as Taminotchi[];
        setTaminotchilar(t);
        const tm:Record<string,string>={};
        t.forEach(i=>{tm[i.Taminotchi_ID]=i.Ism;});
        setTMap(tm);
        // ta'minotchi boshlang'ich bo'sh qolsin
        const mArr=(mR.data as Mahsulot[]).filter(m=>m.Nomi);
        setMahsulotlar(mArr);
        const mm:Record<string,Mahsulot>={};
        mArr.forEach(m=>{mm[m.Mahsulot_ID]=m;});
        setMMap(mm);
      }).catch(e=>setError(e instanceof Error?e.message:"Xatolik"))
        .finally(()=>{
          setLoading(false);
          // Faza 2 — og'ir Xarid_Savat + X_Tolov FONDA (jami/qoldiq ~1-2s da to'ladi)
          Promise.all([fetchSheet("Xarid_Savat"), fetchSheet("X_Tolov")]).then(([xsR,xtR])=>{
            const sm:Record<string,XaridSavat[]>={};
            ((xsR.data||[]) as XaridSavat[]).forEach(s=>{
              const key=String(s.Xarid_ID||"").trim();
              if(!key) return;
              if(!sm[key])sm[key]=[];
              sm[key].push(s);
            });
            setSavatMap(sm);
            setXtolov((xtR.data as XTolov[]) || []);
          }).catch(()=>{});
        });
    },delay);
  },[]);

  useEffect(()=>{loadData();},[loadData]);

  // Yangi mahsulot qo'shilganda bo'sh Foiz maydonini global chegirma % bilan to'ldiradi
  useEffect(()=>{
    if(!chegirmaHa||!chegirmaFoiz) return;
    setSavat(p=>{
      const hasEmpty=p.some(r=>!r.Foiz);
      if(!hasEmpty) return p;
      return p.map(r=>!r.Foiz?{...r,Foiz:chegirmaFoiz}:r);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[savat.length]);

  useEffect(()=>{
    if(!editChegirmaHa||!editChegirmaFoiz) return;
    setEditSavat(p=>{
      const hasEmpty=p.some(r=>!r.Foiz);
      if(!hasEmpty) return p;
      return p.map(r=>!r.Foiz?{...r,Foiz:editChegirmaFoiz}:r);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[editSavat.length]);

  const [togglingId, setTogglingId] = useState<string|null>(null);

  async function toggleAkt(x: Xarid) {
    setTogglingId(x.Xarid_ID);
    const isActive = String(x.Akt_sverka||"").toUpperCase()==="TRUE";
    const newVal = isActive ? "FALSE" : "TRUE";
    await fetch("/api/sheets", { method:"PUT", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ sheet:"Xarid", idColumn:"Xarid_ID", idValue:x.Xarid_ID,
        row: {...x, Akt_sverka: newVal} }) });
    setXaridlar(p => p.map(r => r.Xarid_ID===x.Xarid_ID ? {...r, Akt_sverka: newVal} : r));
    setTogglingId(null);
  }

  const filtered = useMemo(()=>xaridlar.filter(x=>{
    if (!x.Xarid_ID || (!x.Sotuv_Raqami && !x.Sana && !x.Taminotchi_ID)) return false;
    const matchOy  = !filterOy  || String(parseInt(x.Oy||"0")) === filterOy;
    const matchYil = !filterYil || x.Yil === filterYil;
    const matchT   = filterT.length===0 || filterT.includes(x.Taminotchi_ID);
    const tNomi = tMap[x.Taminotchi_ID]||"";
    const matchSearch = !search || (x.Sotuv_Raqami||"").includes(search) || (x.Sana||"").includes(search) || tNomi.toLowerCase().includes(search.toLowerCase());
    return matchOy && matchYil && matchT && matchSearch;
  }),[xaridlar,filterOy,filterYil,filterT,tMap,search]);

  const totalUsd = useMemo(()=>filtered.reduce((s,x)=>s+(savatMap[String(x.Xarid_ID||"").trim()]||[]).reduce((ss,r)=>ss+num(r.Jami_Summa),0),0),[filtered,savatMap]);
  const totalSom = useMemo(()=>filtered.reduce((s,x)=>s+(savatMap[String(x.Xarid_ID||"").trim()]||[]).reduce((ss,r)=>ss+num(r.Summa_Som),0),0),[filtered,savatMap]);

  const years = useMemo(()=>{
    const y=[...new Set(xaridlar.map(x=>x.Yil).filter(Boolean))].sort((a,b)=>Number(b)-Number(a));
    if(!y.includes(String(now.getFullYear()))) y.unshift(String(now.getFullYear()));
    return y;
  },[xaridlar]);

  function addItem(){
    const first=mahsulotlar[0];
    setSavat(p=>[...p,{id:uid(),Mahsulot_ID:first?.Mahsulot_ID||"",Soni:"",Narxi:first?.Tan_dollar||"",Narx_som:first?.Tan_som||"",Foiz:chegirmaHa?chegirmaFoiz:""}]);
  }
  function updateItem(id:string,field:keyof SavatItem,val:string){
    setSavat(p=>p.map(s=>{
      if(s.id!==id) return s;
      const u={...s,[field]:val};
      if(field==="Mahsulot_ID"){const m=mMap[val];if(m){u.Narxi=m.Tan_dollar||"";u.Narx_som=m.Tan_som||"";}}
      return u;
    }));
  }
  function addEditItem(){
    const first=mahsulotlar[0];
    setEditSavat(p=>[...p,{id:uid(),Mahsulot_ID:first?.Mahsulot_ID||"",Soni:"",Narxi:first?.Tan_dollar||"",Narx_som:first?.Tan_som||"",Foiz:editChegirmaHa?editChegirmaFoiz:""}]);
  }
  function updateEditItem(id:string,field:keyof SavatItem,val:string){
    setEditSavat(p=>p.map(s=>{
      if(s.id!==id) return s;
      const u={...s,[field]:val};
      if(field==="Mahsulot_ID"){const m=mMap[val];if(m){u.Narxi=m.Tan_dollar||"";u.Narx_som=m.Tan_som||"";}}
      return u;
    }));
  }

  function startEdit(x:Xarid){
    setDetailXarid(x);
    setEditTaminotchi(x.Taminotchi_ID);
    setEditIzoh(x.Izoh||"");
    const items=(savatMap[x.Xarid_ID]||[]).map(s=>({
      id:uid(), Mahsulot_ID:s.Mahsulot_ID, Soni:s.Soni, Narxi:s.Narxi, Narx_som:s.Narx_som, Foiz:s.Foiz||"",
    }));
    setEditSavat(items);
    const hasChegirma=items.some(s=>num(s.Foiz)>0);
    setEditChegirmaHa(hasChegirma);
    setEditChegirmaFoiz(hasChegirma?(items.find(s=>num(s.Foiz)>0)?.Foiz||""):"");
    setEditTriedSave(false);
  }

  async function handleSave(){
    if(!taminotchiId||savat.filter(s=>s.Mahsulot_ID&&s.Soni).length===0) return;
    const narxInvalid=savat.filter(s=>s.Mahsulot_ID&&s.Soni).some(s=>{const a=!!num(s.Narxi),b=!!num(s.Narx_som);return (!a&&!b)||(a&&b);});
    if(narxInvalid){setTriedSave(true);return;}
    setSaving(true);
    const {sana:s,vaqt:v}=nowStr();
    try{
      const xaridId=uid();
      const nextRaqam=String(Math.max(...xaridlar.map(x=>num(x.Sotuv_Raqami)),0)+1);
      const [,mo,y]=s.split(".");
      await fetch("/api/sheets",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({sheet:"Xarid",row:{Xarid_ID:xaridId,Yil:y,Oy:mo.replace(/^0/,""),Sana:s,Sotuv_Raqami:nextRaqam,Taminotchi_ID:taminotchiId,Vaqt:v,Izoh:izoh,Akt_sverka:"FALSE",Change:"1",Foiz_som:"",Foiz_summa_som:"0",Foiz_dollar:"",Foiz_summasi_dollar:"0"}})});
      for(let i=0;i<savat.length;i++){
        const r=savat[i]; if(!r.Mahsulot_ID||!r.Soni) continue;
        const m=mMap[r.Mahsulot_ID];
        await fetch("/api/sheets",{method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({sheet:"Xarid_Savat",row:{X_Savat:uid(),Yil:y,Oy:mo.replace(/^0/,""),Sana:s,Raqam:String(i+1),Xarid_ID:xaridId,Ombor_ID:m?.Ombor_ID||"",Mahsulot_ID:r.Mahsulot_ID,Soni:r.Soni,Narxi:r.Narxi,Narx_som:r.Narx_som,Foiz:chegirmaHa?(r.Foiz||""):"",Foizli_narx:chegirmaHa&&num(r.Foiz)>0?String(num(r.Narx_som)*(1-num(r.Foiz)/100)):"0",Foizli_narx_dollar:chegirmaHa&&num(r.Foiz)>0?String(num(r.Narxi)*(1-num(r.Foiz)/100)):r.Narxi,Jami_Summa:String(chegirmaHa&&num(r.Foiz)>0?num(r.Soni)*num(r.Narxi)*(1-num(r.Foiz)/100):num(r.Soni)*num(r.Narxi)),Summa_Som:String(chegirmaHa&&num(r.Foiz)>0?num(r.Soni)*num(r.Narx_som)*(1-num(r.Foiz)/100):num(r.Soni)*num(r.Narx_som)),Vaqt:`${s} ${v}`}})});
      }
      setAddOpen(false); setIzoh(""); setSavat([]); setChegirmaHa(false);
      afterWrite("Xarid"); afterWrite("Xarid_Savat"); loadData(1000);
    } finally{setSaving(false);}
  }

  async function handleUpdate(){
    if(!detailXarid||!editTaminotchi) return;
    const editNarxInvalid=editSavat.filter(r=>r.Mahsulot_ID&&r.Soni).some(r=>{const a=!!num(r.Narxi),b=!!num(r.Narx_som);return (!a&&!b)||(a&&b);});
    if(editNarxInvalid){setEditTriedSave(true);return;}
    setEditSaving(true);
    try{
      await fetch("/api/sheets",{method:"PUT",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({sheet:"Xarid",idColumn:"Xarid_ID",idValue:detailXarid.Xarid_ID,
          row:{...detailXarid,Taminotchi_ID:editTaminotchi,Izoh:editIzoh}})});
      const existing=savatMap[detailXarid.Xarid_ID]||[];
      const validEdit=editSavat.filter(r=>r.Mahsulot_ID&&r.Soni);
      const [,mo,y]=detailXarid.Sana.split(".");
      for(let i=0;i<validEdit.length;i++){
        const r=validEdit[i];
        const m=mMap[r.Mahsulot_ID];
        const foizRow=editChegirmaHa&&num(r.Foiz)>0;
        const rowData={
          Yil:y,Oy:mo.replace(/^0/,""),Sana:detailXarid.Sana,Raqam:String(i+1),
          Xarid_ID:detailXarid.Xarid_ID,Ombor_ID:m?.Ombor_ID||"",
          Mahsulot_ID:r.Mahsulot_ID,Soni:r.Soni,Narxi:r.Narxi,Narx_som:r.Narx_som,
          Foiz:editChegirmaHa?(r.Foiz||""):"",
          Foizli_narx:foizRow?String(num(r.Narx_som)*(1-num(r.Foiz)/100)):"0",
          Foizli_narx_dollar:foizRow?String(num(r.Narxi)*(1-num(r.Foiz)/100)):r.Narxi,
          Jami_Summa:String(foizRow?num(r.Soni)*num(r.Narxi)*(1-num(r.Foiz)/100):num(r.Soni)*num(r.Narxi)),
          Summa_Som:String(foizRow?num(r.Soni)*num(r.Narx_som)*(1-num(r.Foiz)/100):num(r.Soni)*num(r.Narx_som)),
          Vaqt:detailXarid.Sana,
        };
        if(existing[i]){
          await fetch("/api/sheets",{method:"PUT",headers:{"Content-Type":"application/json"},
            body:JSON.stringify({sheet:"Xarid_Savat",idColumn:"X_Savat",idValue:existing[i].X_Savat,
              row:{...existing[i],...rowData}})});
        } else {
          await fetch("/api/sheets",{method:"POST",headers:{"Content-Type":"application/json"},
            body:JSON.stringify({sheet:"Xarid_Savat",row:{X_Savat:uid(),...rowData}})});
        }
      }
      for(let i=validEdit.length;i<existing.length;i++){
        await fetch("/api/sheets",{method:"DELETE",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({sheet:"Xarid_Savat",idColumn:"X_Savat",idValue:existing[i].X_Savat})});
      }
      afterWrite("Xarid"); afterWrite("Xarid_Savat"); setDetailXarid(null); loadData(1000);
    } finally{setEditSaving(false);}
  }

  async function handleDelete(){
    if(!deleteTarget) return;
    setDeleting(true);
    try{
      for(const s of savatMap[deleteTarget.Xarid_ID]||[]){
        await fetch("/api/sheets",{method:"DELETE",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({sheet:"Xarid_Savat",idColumn:"X_Savat",idValue:s.X_Savat})});
      }
      await fetch("/api/sheets",{method:"DELETE",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({sheet:"Xarid",idColumn:"Xarid_ID",idValue:deleteTarget.Xarid_ID})});
      afterWrite("Xarid"); afterWrite("Xarid_Savat"); setDeleteTarget(null); loadData(800);
    } finally{setDeleting(false);}
  }

  const jamiUsd=savat.reduce((s,r)=>s+num(r.Soni)*num(r.Narxi),0);
  const jamiSom=savat.reduce((s,r)=>s+num(r.Soni)*num(r.Narx_som),0);
  const editJamiUsd=editSavat.reduce((s,r)=>s+num(r.Soni)*num(r.Narxi),0);
  const editJamiSom=editSavat.reduce((s,r)=>s+num(r.Soni)*num(r.Narx_som),0);
  const tItems=useMemo(()=>taminotchilar.filter(t=>t.Taminotchi_ID&&(t.Ism||"").trim()).map(t=>({id:t.Taminotchi_ID,label:t.Ism})),[taminotchilar]);
  const mItems=useMemo(()=>mahsulotlar.map(m=>({id:m.Mahsulot_ID,label:m.Nomi})),[mahsulotlar]);

  // Tanlangan ta'minotchining eski qoldig'i (boshlang'ich + jami xarid - jami to'lov)
  const tEski=useMemo(()=>{
    if(!taminotchiId) return null;
    const t=taminotchilar.find(i=>i.Taminotchi_ID===taminotchiId);
    const bSom=num(t?.Boshlangich_som), bUsd=num(t?.Boshlangich_Balans);
    const xSom=xaridlar.filter(x=>x.Taminotchi_ID===taminotchiId).reduce((s,x)=>s+(savatMap[String(x.Xarid_ID||"").trim()]||[]).reduce((ss,r)=>ss+num(r.Summa_Som),0),0);
    const xUsd=xaridlar.filter(x=>x.Taminotchi_ID===taminotchiId).reduce((s,x)=>s+(savatMap[String(x.Xarid_ID||"").trim()]||[]).reduce((ss,r)=>ss+num(r.Jami_Summa),0),0);
    const tSom=xtolov.filter(p=>p.Taminotchi_ID===taminotchiId).reduce((s,p)=>s+(p.Valyuta!=="Dollar"?num(p.Summa||p.Som):0),0);
    const tUsd=xtolov.filter(p=>p.Taminotchi_ID===taminotchiId).reduce((s,p)=>s+(p.Valyuta==="Dollar"?num(p.Summa_dollar||p.Dollar):0),0);
    return { som: bSom+xSom-tSom, usd: bUsd+xUsd-tUsd };
  },[taminotchiId, taminotchilar, xaridlar, savatMap, xtolov]);
  const {sana,vaqt}=nowStr();

  const modalOverlay: React.CSSProperties = {
    position:"fixed",inset:0,zIndex:50,background:"rgba(15,42,76,.42)",backdropFilter:"blur(4px)",
    display:"flex", alignItems: isMobile ? "flex-end" : "center",
    justifyContent:"center", padding: isMobile ? 0 : 20,
  };
  const modalBox: React.CSSProperties = {
    background:"var(--white)", width:"100%",
    maxWidth: isMobile ? "100%" : 1100,
    borderRadius: isMobile ? "20px 20px 0 0" : 16,
    display:"flex", flexDirection:"column",
    maxHeight: isMobile ? "95dvh" : "94vh",
  };

  // Mobile product row for add/edit
  function MobileProductRow({ s, onUpdate, onRemove, mItems, chegirmaHa, narxError }: {
    s: SavatItem;
    onUpdate: (id:string, field:keyof SavatItem, val:string)=>void;
    onRemove: (id:string)=>void;
    mItems: {id:string;label:string}[];
    chegirmaHa: boolean;
    narxError?: boolean;
  }) {
    const foiz = chegirmaHa ? num(s.Foiz) : 0;
    const jamiS = num(s.Soni)*num(s.Narx_som)*(1 - foiz/100);
    const jamiU = num(s.Soni)*num(s.Narxi)*(1 - foiz/100);
    return (
      <div style={{background:"var(--bg)",borderRadius:"var(--radius)",padding:"12px",marginBottom:10,border:"1px solid var(--border)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <span style={{fontSize:11,fontWeight:700,color:"var(--text-3)"}}>MAHSULOT</span>
          <button onClick={()=>onRemove(s.id)} style={{width:28,height:28,borderRadius:8,border:"none",background:"#fee2e2",color:"#ef4444",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <SearchSelect items={mItems} value={s.Mahsulot_ID} onChange={v=>onUpdate(s.id,"Mahsulot_ID",v)} placeholder="Mahsulot tanlang..."/>
        <div style={{marginTop:8}}>
          <label style={{fontSize:10,fontWeight:600,color:"var(--text-3)",display:"block",marginBottom:4}}>MIQDOR</label>
          <input value={s.Soni} onChange={e=>onUpdate(s.id,"Soni",e.target.value)} placeholder="0" type="number"
            style={{width:"100%",padding:"9px 10px",border:"1px solid var(--border)",borderRadius:"var(--radius)",fontSize:14,fontWeight:700,outline:"none",textAlign:"center",boxSizing:"border-box"}}/>
        </div>
        <div style={{marginTop:8}}>
          <label style={{fontSize:10,fontWeight:600,color:"#2563eb",display:"block",marginBottom:4}}>NARX ($)</label>
          <input value={s.Narxi} onChange={e=>onUpdate(s.id,"Narxi",e.target.value)} placeholder="0.00" inputMode="decimal"
            style={{width:"100%",padding:"9px 10px",border:`1px solid ${narxError?"#ef4444":"#bfdbfe"}`,borderRadius:"var(--radius)",fontSize:14,fontWeight:700,outline:"none",color:"#2563eb",textAlign:"center",boxSizing:"border-box"}}/>
          {jamiU!==0&&<div style={{fontSize:12,fontWeight:800,color:"#2563eb",textAlign:"right",marginTop:4}}>
            Jami: ${jamiU.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2})}
          </div>}
        </div>
        <div style={{marginTop:8}}>
          <label style={{fontSize:10,fontWeight:600,color:narxError?"#ef4444":"var(--text-3)",display:"block",marginBottom:4}}>NARX (SO&apos;M)</label>
          <input value={s.Narx_som} onChange={e=>onUpdate(s.id,"Narx_som",e.target.value)} placeholder="0" inputMode="numeric"
            style={{width:"100%",padding:"9px 10px",border:`1px solid ${narxError?"#ef4444":"var(--border)"}`,borderRadius:"var(--radius)",fontSize:14,fontWeight:700,outline:"none",textAlign:"center",boxSizing:"border-box"}}/>
          {jamiS!==0&&<div style={{fontSize:12,fontWeight:800,color:"var(--text)",textAlign:"right",marginTop:4}}>
            Jami: {jamiS.toLocaleString("ru-RU")} so&apos;m
          </div>}
        </div>
        {chegirmaHa&&(
          <div style={{marginTop:8}}>
            <label style={{fontSize:10,fontWeight:600,color:"#d97706",display:"block",marginBottom:4}}>CHEGIRMA (%)</label>
            <input value={s.Foiz} onChange={e=>onUpdate(s.id,"Foiz",e.target.value)} placeholder="0" inputMode="decimal"
              style={{width:"100%",padding:"9px 10px",border:"1px solid #fde68a",borderRadius:"var(--radius)",fontSize:14,fontWeight:700,outline:"none",color:"#d97706",textAlign:"center",boxSizing:"border-box"}}/>
          </div>
        )}
        {narxError&&!!num(s.Narxi)&&!!num(s.Narx_som)&&(
          <p style={{fontSize:11,fontWeight:600,color:"#ef4444",marginTop:6}}>So&apos;m va dollar narxlardan birini tanlash kerak</p>
        )}
      </div>
    );
  }

  return (
    <>
      {/* ── Header ── */}
      <header className="header">
        <div className="header__inner">
          <div style={{display:"flex",flexDirection:"column",gap:2}}>
            <h1 className="header__title" style={{paddingLeft:4}}>Prixod</h1>
            <span style={{fontSize:11,color:"var(--text-3)",paddingLeft:4}}>Barcha xaridlar ro&apos;yxati</span>
          </div>
          <div className="header__spacer"/>
        </div>
      </header>

      {isMobile && <FabAdd onClick={()=>{setTaminotchiId("");setIzoh("");setSavat([]);setChegirmaHa(false);setChegirmaFoiz("");setTriedSave(false);setAddOpen(true);}} />}

      <div className="page-content">
        {loading&&<div className="spinner--page"/>}
        {error&&<div className="error-box"><p>{error}</p></div>}

        {!loading&&!error&&(
          <>
            {/* Stats */}
            <div style={{
              position: isMobile ? undefined : "sticky",
              top: isMobile ? undefined : 56,
              zIndex: isMobile ? undefined : 11,
              background: isMobile ? undefined : "var(--bg)",
              paddingBottom: isMobile ? 0 : 16,
              marginBottom: isMobile ? 14 : 8,
            }}>
              <div style={{display:"grid",gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3,1fr)",gap: isMobile ? 10 : 14}}>
                <StatCard label="JAMI XARIDLAR" value={String(filtered.length)} isMobile={isMobile}/>
                <StatCard label="JAMI SUMMA ($)" value={totalUsd!==0?"$"+Math.abs(totalUsd).toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2}):"$0.00"} color="#2563eb" isMobile={isMobile}/>
                <div style={{gridColumn: isMobile ? "1 / -1" : undefined}}>
                  <StatCard label="JAMI SUMMA (SO'M)" value={totalSom!==0?totalSom.toLocaleString("ru-RU"):"0"} isMobile={isMobile}/>
                </div>
              </div>
            </div>

            {/* Table Card */}
            <div style={{background:"var(--white)",borderRadius:"var(--radius-xl)",boxShadow:"var(--shadow-sm)"}}>

              {/* MOBILE toolbar */}
              {isMobile ? (
                <div style={{padding:"12px 14px",borderBottom:"1px solid var(--border)",display:"flex",flexDirection:"column",gap:10}}>
                  <div className="search">
                    <span className="search__icon"><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg></span>
                    <input className="search__input" placeholder="Qidirish..." value={search} onChange={e=>setSearch(e.target.value)}/>
                    {search&&<button className="search__clear" onClick={()=>setSearch("")}><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>}
                  </div>
                  <MultiSelect items={taminotchilar.map(t=>({id:t.Taminotchi_ID,label:t.Ism}))} value={filterT} onChange={setFilterT} placeholder="Ta'minotchi..." fullWidth/>
                  <div style={{display:"flex",gap:8}}>
                    <select value={filterOy} onChange={e=>setFilterOy(e.target.value)}
                      style={{flex:1,padding:"8px 10px",border:"1px solid var(--border)",borderRadius:"var(--radius)",fontSize:13,fontWeight:600,background:"var(--white)",cursor:"pointer",outline:"none"}}>
                      <option value="">Barcha oylar</option>
                      {OY_NOMLARI.map((n,i)=><option key={i+1} value={String(i+1)}>{n}</option>)}
                    </select>
                    <select value={filterYil} onChange={e=>setFilterYil(e.target.value)}
                      style={{flex:1,padding:"8px 10px",border:"1px solid var(--border)",borderRadius:"var(--radius)",fontSize:13,fontWeight:600,background:"var(--white)",cursor:"pointer",outline:"none"}}>
                      <option value="">Barcha yillar</option>
                      {years.map(y=><option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <span style={{fontSize:12,color:"var(--text-3)",fontWeight:600}}>Jami: {filtered.length} ta xarid</span>
                </div>
              ) : (
                /* DESKTOP sticky wrapper */
                <div style={{position:"sticky",top:156,zIndex:10,background:"var(--white)",borderRadius:"var(--radius-xl) var(--radius-xl) 0 0"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 20px",borderBottom:"1px solid var(--border)",flexWrap:"wrap"}}>
                    <span style={{fontSize:14,fontWeight:700,flex:1}}>Xaridlar: {filtered.length} ta</span>
                    <div className="search" style={{maxWidth:220}}>
                      <span className="search__icon"><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg></span>
                      <input className="search__input" placeholder="Qidirish..." value={search} onChange={e=>setSearch(e.target.value)}/>
                      {search&&<button className="search__clear" onClick={()=>setSearch("")}><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>}
                    </div>
                    <MultiSelect items={taminotchilar.map(t=>({id:t.Taminotchi_ID,label:t.Ism}))} value={filterT} onChange={setFilterT} placeholder="Ta'minotchi..."/>
                    <select value={filterOy} onChange={e=>setFilterOy(e.target.value)}
                      style={{padding:"8px 12px",border:"1px solid var(--border)",borderRadius:"var(--radius)",fontSize:13,fontWeight:600,background:"var(--white)",cursor:"pointer",outline:"none"}}>
                      <option value="">Barcha oylar</option>
                      {OY_NOMLARI.map((n,i)=><option key={i+1} value={String(i+1)}>{n}</option>)}
                    </select>
                    <select value={filterYil} onChange={e=>setFilterYil(e.target.value)}
                      style={{padding:"8px 12px",border:"1px solid var(--border)",borderRadius:"var(--radius)",fontSize:13,fontWeight:600,background:"var(--white)",cursor:"pointer",outline:"none"}}>
                      <option value="">Barcha yillar</option>
                      {years.map(y=><option key={y} value={y}>{y}</option>)}
                    </select>
                    <button className="btn btn--primary" onClick={()=>{setTaminotchiId("");setIzoh("");setSavat([]);setChegirmaHa(false);setChegirmaFoiz("");setTriedSave(false);setAddOpen(true);}}>
                      <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                      Yangi xarid
                    </button>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"50px 110px 100px 1fr 130px 120px 140px 80px",padding:"10px 20px",background:"var(--bg)",borderBottom:"1px solid var(--border)"}}>
                    {["#","Sana","Raqam","Ta'minotchi","Summa (so'm)","Summa ($)","Akt sverka",""].map(h=>(
                      <span key={h} style={{fontSize:10,fontWeight:700,color:"var(--text-3)",textTransform:"uppercase",letterSpacing:".04em"}}>{h}</span>
                    ))}
                  </div>
                </div>
              )}

              {filtered.length===0&&(
                <div style={{padding:"48px 20px",textAlign:"center",color:"var(--text-3)",fontSize:13}}>Xarid topilmadi</div>
              )}

              {/* MOBILE cards */}
              {isMobile ? (
                <div style={{display:"flex",flexDirection:"column"}}>
                  {filtered.map((x,idx)=>{
                    const savati=savatMap[String(x.Xarid_ID||"").trim()]||[];
                    const tNomi=tMap[x.Taminotchi_ID]||"—";
                    const xaridSom=savati.reduce((s,r)=>s+num(r.Summa_Som),0);
                    const xaridUsd=savati.reduce((s,r)=>s+num(r.Jami_Summa),0);
                    const isHa=String(x.Akt_sverka||"").toUpperCase()==="TRUE";
                    return (
                      <div key={x.Xarid_ID}
                        style={{padding:"14px",borderBottom:idx<filtered.length-1?"1px solid var(--border)":"none",background:"var(--white)",borderLeft:`3px solid ${isHa?"#16a34a":"#ef4444"}`}}>
                        {/* Row 1: raqam + ta'minotchi + actions */}
                        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:8}}>
                          <div style={{cursor:"pointer",flex:1}} onClick={()=>router.push(`/xarid/${x.Xarid_ID}`)}>
                            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                              <span style={{fontSize:12,fontWeight:800,color:"var(--primary)",background:"#f0fdf4",padding:"2px 8px",borderRadius:6,border:"1px solid #bbf7d0"}}>
                                #{fmtRaqam(x.Sotuv_Raqami)}
                              </span>
                              <span style={{fontSize:11,color:"var(--text-3)"}}>{x.Sana}</span>
                            </div>
                            <p style={{fontSize:14,fontWeight:800,color:"var(--text)"}}>{tNomi}</p>
                            {x.Izoh&&<p style={{fontSize:11,color:"var(--text-3)",marginTop:1}}>{x.Izoh}</p>}
                          </div>
                          <div style={{display:"flex",gap:6,flexShrink:0,marginLeft:8}}>
                            <button onClick={()=>startEdit(x)}
                              style={{width:34,height:34,borderRadius:10,border:"1px solid #dbeafe",background:"#eff6ff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#2563eb"}}>
                              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                            </button>
                            <button onClick={()=>setDeleteTarget(x)}
                              style={{width:34,height:34,borderRadius:10,border:"1px solid #fee2e2",background:"#fff1f2",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#ef4444"}}>
                              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            </button>
                          </div>
                        </div>
                        {/* Row 2: summalar + akt */}
                        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                          {xaridSom>0&&<span style={{fontSize:13,fontWeight:800}}>{xaridSom.toLocaleString("ru-RU")} so&apos;m</span>}
                          {xaridUsd>0&&<span style={{fontSize:13,fontWeight:800,color:"#2563eb"}}>${xaridUsd.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>}
                          <span style={{marginLeft:"auto"}}>
                            <div style={{display:"inline-flex",borderRadius:20,overflow:"hidden",border:"1.5px solid var(--border)",opacity:togglingId===x.Xarid_ID?0.5:1,pointerEvents:togglingId===x.Xarid_ID?"none":"auto"}}>
                              <button onClick={()=>!isHa&&toggleAkt(x)}
                                style={{padding:"5px 14px",fontSize:12,fontWeight:700,border:"none",borderRight:"1.5px solid var(--border)",cursor:isHa?"default":"pointer",background:isHa?"#16a34a":"var(--white)",color:isHa?"#fff":"var(--text-3)"}}>
                                Ha
                              </button>
                              <button onClick={()=>isHa&&toggleAkt(x)}
                                style={{padding:"5px 14px",fontSize:12,fontWeight:700,border:"none",cursor:isHa?"pointer":"default",background:!isHa?"#ef4444":"var(--white)",color:!isHa?"#fff":"var(--text-3)"}}>
                                Yo&apos;q
                              </button>
                            </div>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* DESKTOP table rows */
                <>
                  {filtered.map((x,idx)=>{
                    const savati=savatMap[String(x.Xarid_ID||"").trim()]||[];
                    const tNomi=tMap[x.Taminotchi_ID]||"—";
                    const xaridSom=savati.reduce((s,r)=>s+num(r.Summa_Som),0);
                    const xaridUsd=savati.reduce((s,r)=>s+num(r.Jami_Summa),0);
                    const isHa=String(x.Akt_sverka||"").toUpperCase()==="TRUE";
                    const rowBg=isHa?"#dcfce7":"#fee2e2";
                    const rowBgHover=isHa?"#bbf7d0":"#fecaca";
                    return (
                      <div key={x.Xarid_ID}
                        style={{display:"grid",gridTemplateColumns:"50px 110px 100px 1fr 130px 120px 140px 80px",padding:"13px 20px",alignItems:"center",borderBottom:idx<filtered.length-1?"1px solid var(--border)":"none",transition:"background .12s",cursor:"default",background:rowBg}}
                        onMouseEnter={e=>(e.currentTarget.style.background=rowBgHover)}
                        onMouseLeave={e=>(e.currentTarget.style.background=rowBg)}>
                        <span style={{fontSize:12,fontWeight:700,color:"var(--text-3)"}}>{idx+1}</span>
                        <span style={{fontSize:13,fontWeight:700}}>{x.Sana}</span>
                        <span style={{fontSize:12,fontWeight:800,color:"var(--primary)",background:"#f0fdf4",padding:"3px 8px",borderRadius:6,display:"inline-block",width:"fit-content"}}>
                          {fmtRaqam(x.Sotuv_Raqami)}
                        </span>
                        <div style={{cursor:"pointer"}} onClick={()=>router.push(`/xarid/${x.Xarid_ID}`)}>
                          <p style={{fontSize:13,fontWeight:700,color:"var(--text)"}}>{tNomi}</p>
                          {x.Izoh&&<p style={{fontSize:11,color:"var(--text-3)",marginTop:1}}>{x.Izoh}</p>}
                        </div>
                        <span style={{fontSize:13,fontWeight:700}}>{xaridSom!==0?xaridSom.toLocaleString("ru-RU"):"—"}</span>
                        <span style={{fontSize:13,fontWeight:700,color:xaridUsd!==0?"#2563eb":"var(--text-3)"}}>{xaridUsd!==0?"$"+xaridUsd.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2}):"—"}</span>
                        <div style={{display:"inline-flex",borderRadius:20,overflow:"hidden",border:"1.5px solid var(--border)",opacity:togglingId===x.Xarid_ID?0.6:1,pointerEvents:togglingId===x.Xarid_ID?"none":"auto"}}>
                          <button onClick={()=>!isHa&&toggleAkt(x)}
                            style={{padding:"4px 12px",fontSize:11,fontWeight:700,border:"none",borderRight:"1.5px solid var(--border)",cursor:isHa?"default":"pointer",background:isHa?"#16a34a":"var(--white)",color:isHa?"#fff":"var(--text-3)"}}>
                            Ha
                          </button>
                          <button onClick={()=>isHa&&toggleAkt(x)}
                            style={{padding:"4px 12px",fontSize:11,fontWeight:700,border:"none",cursor:isHa?"pointer":"default",background:!isHa?"#ef4444":"var(--white)",color:!isHa?"#fff":"var(--text-3)"}}>
                            Yo&apos;q
                          </button>
                        </div>
                        <div style={{display:"flex",gap:4,justifyContent:"flex-end"}}>
                          <button className="icon-btn icon-btn--blue" onClick={()=>startEdit(x)}>
                            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                          </button>
                          <button className="icon-btn icon-btn--red" onClick={()=>setDeleteTarget(x)}>
                            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {filtered.length>0&&(
                    <div style={{display:"flex",justifyContent:"flex-end",gap:20,padding:"12px 20px",borderTop:"2px solid var(--border)",background:"var(--bg)"}}>
                      <span style={{fontSize:12,fontWeight:700,color:"var(--text-3)",alignSelf:"center"}}>Jami:</span>
                      {totalSom>0&&<span style={{fontSize:14,fontWeight:800}}>{fmtSom(totalSom)}</span>}
                      {totalUsd>0&&<span style={{fontSize:14,fontWeight:800,color:"#2563eb"}}>{fmtUsd(totalUsd)}</span>}
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Edit Modal ── */}
      {detailXarid&&(
        <div style={modalOverlay} onClick={()=>setDetailXarid(null)}>
          <div style={modalBox} onClick={e=>e.stopPropagation()}>
            {isMobile&&<div style={{width:40,height:4,borderRadius:2,background:"var(--border)",margin:"12px auto 0"}}/>}
            <div style={{display:"flex",alignItems:"center",gap:16,padding:"16px 20px",borderBottom:"1px solid var(--border)"}}>
              <div style={{width:40,height:40,borderRadius:12,background:"#eff6ff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <svg width="18" height="18" fill="none" stroke="#2563eb" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              </div>
              <div style={{flex:1}}>
                <h2 style={{fontSize:16,fontWeight:800,marginBottom:1}}>Xarid #{detailXarid.Sotuv_Raqami}</h2>
                <p style={{fontSize:11,color:"var(--text-3)"}}>{detailXarid.Sana}</p>
              </div>
              <button onClick={()=>setDetailXarid(null)} style={{width:32,height:32,borderRadius:8,border:"1px solid var(--border)",background:"var(--white)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"16px 20px"}}>
              <div style={{display:"grid",gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",gap:12,marginBottom:14}}>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:"var(--text-2)",display:"block",marginBottom:6}}>Ta&apos;minotchi *</label>
                  <SearchSelect items={tItems} value={editTaminotchi} onChange={setEditTaminotchi} placeholder="Ta'minotchi tanlang..."/>
                </div>
                <div>
                  <label style={{fontSize:12,fontWeight:600,color:"var(--text-2)",display:"block",marginBottom:6}}>Izoh</label>
                  <input value={editIzoh} onChange={e=>setEditIzoh(e.target.value)} placeholder="Ixtiyoriy..."
                    style={{width:"100%",padding:"10px 14px",border:"1px solid var(--border)",borderRadius:"var(--radius)",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
                </div>
              </div>
              <div style={{marginBottom:16}}>
                <label style={{fontSize:12,fontWeight:600,color:"var(--text-2)",display:"block",marginBottom:8}}>Chegirma bormi?</label>
                <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                  <div style={{display:"inline-flex",borderRadius:20,overflow:"hidden",border:"1.5px solid var(--border)"}}>
                    <button onClick={()=>{setEditChegirmaHa(true);}} style={{padding:"7px 20px",fontSize:13,fontWeight:700,border:"none",borderRight:"1.5px solid var(--border)",cursor:"pointer",background:editChegirmaHa?"var(--primary)":"var(--white)",color:editChegirmaHa?"#fff":"var(--text-3)"}}>Ha</button>
                    <button onClick={()=>{setEditChegirmaHa(false);setEditChegirmaFoiz("");setEditSavat(p=>p.map(r=>({...r,Foiz:""})));}} style={{padding:"7px 20px",fontSize:13,fontWeight:700,border:"none",cursor:"pointer",background:!editChegirmaHa?"var(--primary)":"var(--white)",color:!editChegirmaHa?"#fff":"var(--text-3)"}}>Yo&apos;q</button>
                  </div>
                  {editChegirmaHa&&(
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <input value={editChegirmaFoiz} onChange={e=>{setEditChegirmaFoiz(e.target.value);setEditSavat(p=>p.map(r=>({...r,Foiz:e.target.value})));}}
                        placeholder="0" inputMode="decimal"
                        style={{width:90,padding:"7px 12px",border:"1.5px solid #fde68a",borderRadius:"var(--radius)",fontSize:14,fontWeight:700,outline:"none",color:"#d97706",textAlign:"center"}}/>
                      <span style={{fontSize:14,fontWeight:700,color:"#d97706"}}>%</span>
                    </div>
                  )}
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <span style={{fontSize:11,fontWeight:700,color:"var(--text-3)",letterSpacing:".06em"}}>MAHSULOTLAR</span>
                <button onClick={addEditItem} style={{display:"flex",alignItems:"center",gap:4,padding:"5px 12px",border:"1px solid var(--border)",borderRadius:8,fontSize:12,fontWeight:600,background:"var(--white)",cursor:"pointer",color:"var(--text-2)"}}>
                  <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                  Qo&apos;shish
                </button>
              </div>
              {!isMobile&&editSavat.length>0&&(
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,paddingBottom:6,borderBottom:"1px solid var(--border)"}}>
                  <div style={{flex:3,minWidth:0}}><span style={{fontSize:10,fontWeight:700,color:"var(--text-3)",letterSpacing:".04em"}}>MAHSULOT</span></div>
                  <div style={{width:90,textAlign:"center"}}><span style={{fontSize:10,fontWeight:700,color:"var(--text-3)",letterSpacing:".04em"}}>MIQDOR</span></div>
                  <div style={{width:100,textAlign:"center"}}><span style={{fontSize:10,fontWeight:700,color:"#2563eb",letterSpacing:".04em"}}>NARX ($)</span></div>
                  <div style={{width:120,textAlign:"center"}}><span style={{fontSize:10,fontWeight:700,color:"var(--text-3)",letterSpacing:".04em"}}>NARX (SO&apos;M)</span></div>
                  {editChegirmaHa&&<div style={{width:70,textAlign:"center"}}><span style={{fontSize:10,fontWeight:700,color:"#d97706",letterSpacing:".04em"}}>CHEGIRMA</span></div>}
                  <div style={{minWidth:110,textAlign:"right"}}><span style={{fontSize:10,fontWeight:700,color:"var(--text-3)",letterSpacing:".04em"}}>JAMI</span></div>
                  <div style={{width:36}}/>
                </div>
              )}
              {isMobile ? (
                editSavat.map(s=>{
                  const a=!!num(s.Narxi),b=!!num(s.Narx_som);const ne=editTriedSave&&!!s.Mahsulot_ID&&!!s.Soni&&((!a&&!b)||(a&&b));
                  return <MobileProductRow key={s.id} s={s} onUpdate={updateEditItem} onRemove={id=>setEditSavat(p=>p.filter(r=>r.id!==id))} mItems={mItems} chegirmaHa={editChegirmaHa} narxError={ne}/>;
                })
              ) : (
                editSavat.map(s=>{
                  const foiz=editChegirmaHa?num(s.Foiz):0;
                  const jS=num(s.Soni)*num(s.Narx_som)*(1-foiz/100);
                  const jU=num(s.Soni)*num(s.Narxi)*(1-foiz/100);
                  const a=!!num(s.Narxi),b=!!num(s.Narx_som);const ne=editTriedSave&&!!s.Mahsulot_ID&&!!s.Soni&&((!a&&!b)||(a&&b));const bothFilled=ne&&a&&b;
                  return (
                  <div key={s.id} style={{marginBottom:bothFilled?2:8}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{flex:3,minWidth:0}}><SearchSelect items={mItems} value={s.Mahsulot_ID} onChange={v=>updateEditItem(s.id,"Mahsulot_ID",v)} placeholder="Mahsulot..."/></div>
                    <input type="number" value={s.Soni} onChange={e=>updateEditItem(s.id,"Soni",e.target.value)} placeholder="Miqdor" style={{width:90,padding:"10px",border:"1px solid var(--border)",borderRadius:"var(--radius)",fontSize:13,fontWeight:600,outline:"none",textAlign:"center"}}/>
                    <input value={s.Narxi} onChange={e=>updateEditItem(s.id,"Narxi",e.target.value)} placeholder="Narx ($)" style={{width:100,padding:"10px",border:`1px solid ${ne?"#ef4444":"var(--border)"}`,borderRadius:"var(--radius)",fontSize:13,fontWeight:600,outline:"none",color:"#2563eb",textAlign:"center"}}/>
                    <input value={s.Narx_som} onChange={e=>updateEditItem(s.id,"Narx_som",e.target.value)} placeholder="Narx (so'm)" style={{width:120,padding:"10px",border:`1px solid ${ne?"#ef4444":"var(--border)"}`,borderRadius:"var(--radius)",fontSize:13,fontWeight:600,outline:"none",textAlign:"center"}}/>
                    {editChegirmaHa&&<input value={s.Foiz} onChange={e=>updateEditItem(s.id,"Foiz",e.target.value)} placeholder="%" inputMode="decimal" style={{width:70,padding:"10px",border:"1px solid #fde68a",borderRadius:"var(--radius)",fontSize:13,fontWeight:600,outline:"none",color:"#d97706",textAlign:"center"}}/>}
                    <div style={{minWidth:110,padding:"10px",background:"var(--bg)",borderRadius:"var(--radius)",fontSize:13,fontWeight:700,textAlign:"right"}}>
                      {num(s.Soni)!==0?(jS!==0?jS.toLocaleString("ru-RU"):jU!==0?"$"+jU.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2}):"—"):"—"}
                    </div>
                    <button onClick={()=>setEditSavat(p=>p.filter(r=>r.id!==s.id))} style={{width:36,height:40,borderRadius:8,border:"none",background:"#dbeafe",color:"#2563eb",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:20,fontWeight:700}}>−</button>
                    </div>
                    {bothFilled&&<p style={{fontSize:11,fontWeight:600,color:"#ef4444",margin:"2px 0 6px 0"}}>So&apos;m va dollar narxlardan birini tanlash kerak</p>}
                  </div>
                  );
                })
              )}
              {editSavat.length>0&&(()=>{
                const foizSom=editChegirmaHa?editSavat.reduce((s,r)=>s+num(r.Soni)*num(r.Narx_som)*(num(r.Foiz)/100),0):0;
                const foizUsd=editChegirmaHa?editSavat.reduce((s,r)=>s+num(r.Soni)*num(r.Narxi)*(num(r.Foiz)/100),0):0;
                const netSom=editJamiSom-foizSom;
                const netUsd=editJamiUsd-foizUsd;
                const hasDiscount=editChegirmaHa&&(foizSom>0||foizUsd>0);
                return (
                  <div style={{marginTop:4,background:"var(--bg)",borderRadius:"var(--radius)",overflow:"hidden"}}>
                    {hasDiscount&&(
                      <div style={{display:"flex",justifyContent:"flex-end",gap:16,padding:"8px 14px",borderBottom:"1px solid var(--border)"}}>
                        <span style={{fontSize:12,fontWeight:600,color:"var(--text-3)"}}>Chegirmadan oldingi summa:</span>
                        {editJamiSom>0&&<span style={{fontSize:13,fontWeight:700}}>{fmtSom(editJamiSom)}</span>}
                        {editJamiUsd>0&&<span style={{fontSize:13,fontWeight:700,color:"#2563eb"}}>{fmtUsd(editJamiUsd)}</span>}
                      </div>
                    )}
                    {hasDiscount&&(
                      <div style={{display:"flex",justifyContent:"flex-end",gap:16,padding:"8px 14px",borderBottom:"1px solid var(--border)",background:"#fffbeb"}}>
                        <span style={{fontSize:12,fontWeight:700,color:"#d97706"}}>Chegirma:</span>
                        {foizSom>0&&<span style={{fontSize:13,fontWeight:700,color:"#d97706"}}>-{foizSom.toLocaleString("ru-RU")} so&apos;m</span>}
                        {foizUsd>0&&<span style={{fontSize:13,fontWeight:700,color:"#d97706"}}>-${foizUsd.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>}
                      </div>
                    )}
                    <div style={{display:"flex",justifyContent:"flex-end",gap:16,padding:"10px 14px"}}>
                      <span style={{fontSize:12,fontWeight:700,color:"var(--text-3)"}}>{hasDiscount?"Jami summa:":"Jami:"}</span>
                      {(hasDiscount?netSom:editJamiSom)>0&&<span style={{fontSize:14,fontWeight:800}}>{fmtSom(hasDiscount?netSom:editJamiSom)}</span>}
                      {(hasDiscount?netUsd:editJamiUsd)>0&&<span style={{fontSize:14,fontWeight:800,color:"#2563eb"}}>{fmtUsd(hasDiscount?netUsd:editJamiUsd)}</span>}
                    </div>
                  </div>
                );
              })()}
            </div>
            <div style={{display:"flex",gap:10,padding:"16px 20px",borderTop:"1px solid var(--border)",paddingBottom:isMobile?"max(16px, env(safe-area-inset-bottom))":16}}>
              <button className="btn btn--outline" style={{flex:1}} onClick={()=>setDetailXarid(null)}>Bekor</button>
              <button className="btn btn--primary" style={{flex:2}} onClick={handleUpdate}
                disabled={editSaving||!editTaminotchi||editSavat.filter(s=>s.Mahsulot_ID&&s.Soni).length===0}>
                {editSaving&&<span className="spinner"/>} Saqlash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Modal ── */}
      {addOpen&&(
        <div style={modalOverlay} onClick={()=>setAddOpen(false)}>
          <div style={modalBox} onClick={e=>e.stopPropagation()}>
            {isMobile&&<div style={{width:40,height:4,borderRadius:2,background:"var(--border)",margin:"12px auto 0"}}/>}
            <div style={{display:"flex",flexDirection:isMobile?"column":"row",alignItems:isMobile?"stretch":"center",gap:isMobile?12:16,padding:"16px 20px",borderBottom:"1px solid var(--border)"}}>
              <div style={{display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
                <div style={{width:40,height:40,borderRadius:12,background:"#fff7ed",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <svg width="18" height="18" fill="none" stroke="#f97316" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                </div>
                <div>
                  <h2 style={{fontSize:16,fontWeight:800,marginBottom:2}}>Yangi xarid</h2>
                  <p style={{fontSize:12,color:"var(--text-3)",fontWeight:600}}>{sana}</p>
                </div>
              </div>
              <div style={{width:isMobile?"100%":260,flexShrink:1,minWidth:0}}>
                <SearchSelect items={tItems} value={taminotchiId} onChange={setTaminotchiId} placeholder="Ta'minotchi" clearable/>
                {taminotchiId && tEski && (
                  <div style={{display:"flex",gap:8,alignItems:"center",marginTop:4,flexWrap:"wrap"}}>
                    <span style={{fontSize:10,fontWeight:700,color:"var(--text-3)",letterSpacing:".05em"}}>QOLDIQ:</span>
                    {(tEski.som!==0||tEski.usd===0)&&<span style={{fontSize:12,fontWeight:800,color:tEski.som>0?"#ef4444":tEski.som<0?"#2563eb":"#16a34a"}}>{tEski.som.toLocaleString("ru-RU")} so&apos;m</span>}
                    {tEski.usd!==0&&<span style={{fontSize:12,fontWeight:800,color:tEski.usd>0?"#ef4444":"#2563eb"}}>{fmtUsd(tEski.usd)}</span>}
                  </div>
                )}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
                <span style={{fontSize:12,fontWeight:600,color:"var(--text-2)",whiteSpace:"nowrap"}}>Chegirma bormi?</span>
                <div style={{display:"inline-flex",borderRadius:20,overflow:"hidden",border:"1.5px solid var(--border)"}}>
                  <button onClick={()=>{setChegirmaHa(true);}} style={{padding:"7px 16px",fontSize:13,fontWeight:700,border:"none",borderRight:"1.5px solid var(--border)",cursor:"pointer",background:chegirmaHa?"var(--primary)":"var(--white)",color:chegirmaHa?"#fff":"var(--text-3)"}}>Ha</button>
                  <button onClick={()=>{setChegirmaHa(false);setChegirmaFoiz("");setSavat(p=>p.map(r=>({...r,Foiz:""})));}} style={{padding:"7px 16px",fontSize:13,fontWeight:700,border:"none",cursor:"pointer",background:!chegirmaHa?"var(--primary)":"var(--white)",color:!chegirmaHa?"#fff":"var(--text-3)"}}>Yo&apos;q</button>
                </div>
                {chegirmaHa&&(
                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                    <input value={chegirmaFoiz} onChange={e=>{setChegirmaFoiz(e.target.value);setSavat(p=>p.map(r=>({...r,Foiz:e.target.value})));}}
                      placeholder="0" inputMode="decimal"
                      style={{width:70,padding:"7px 10px",border:"1.5px solid #fde68a",borderRadius:"var(--radius)",fontSize:14,fontWeight:700,outline:"none",color:"#d97706",textAlign:"center"}}/>
                    <span style={{fontSize:14,fontWeight:700,color:"#d97706"}}>%</span>
                  </div>
                )}
              </div>
              <button onClick={()=>setAddOpen(false)} style={{width:32,height:32,borderRadius:8,border:"1px solid var(--border)",background:"var(--white)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginLeft:"auto"}}>
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"16px 20px"}}>

              {/* Xariddan keyingi qoldiq — faqat savatda summa bo'lsa */}
              {taminotchiId && tEski && (jamiSom>0 || jamiUsd>0) && (
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexWrap:"wrap",background:"var(--bg)",border:"1px solid var(--border)",borderRadius:"var(--radius)",padding:"11px 14px",marginBottom:14}}>
                  <span style={{fontSize:12,fontWeight:600,color:"var(--text-3)"}}>Xariddan keyingi qoldiq:</span>
                  <span style={{display:"flex",gap:10}}>
                    {((tEski.som+jamiSom)!==0||(tEski.usd+jamiUsd)===0)&&<span style={{fontSize:14,fontWeight:800,color:(tEski.som+jamiSom)>0?"#ef4444":(tEski.som+jamiSom)<0?"#2563eb":"#16a34a"}}>{(tEski.som+jamiSom).toLocaleString("ru-RU")} so&apos;m</span>}
                    {(tEski.usd+jamiUsd)!==0&&<span style={{fontSize:14,fontWeight:800,color:(tEski.usd+jamiUsd)>0?"#ef4444":"#2563eb"}}>{fmtUsd(tEski.usd+jamiUsd)}</span>}
                  </span>
                </div>
              )}

              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <span style={{fontSize:11,fontWeight:700,color:"var(--text-3)",letterSpacing:".06em"}}>MAHSULOTLAR</span>
              </div>
              {savat.length===0&&(
                <div style={{padding:"24px",textAlign:"center",background:"var(--bg)",borderRadius:"var(--radius)",border:"1.5px dashed var(--border)",marginBottom:10}}>
                  <p style={{fontSize:13,color:"var(--text-3)",marginBottom:10}}>Mahsulot qo&apos;shilmagan</p>
                  <button className="btn btn--outline btn--sm" onClick={addItem}>+ Mahsulot qo&apos;shish</button>
                </div>
              )}
              {!isMobile&&savat.length>0&&(
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,paddingBottom:6,borderBottom:"1px solid var(--border)"}}>
                  <div style={{flex:3,minWidth:0}}><span style={{fontSize:10,fontWeight:700,color:"var(--text-3)",letterSpacing:".04em"}}>MAHSULOT</span></div>
                  <div style={{width:90,textAlign:"center"}}><span style={{fontSize:10,fontWeight:700,color:"var(--text-3)",letterSpacing:".04em"}}>MIQDOR</span></div>
                  <div style={{width:100,textAlign:"center"}}><span style={{fontSize:10,fontWeight:700,color:"#2563eb",letterSpacing:".04em"}}>NARX ($)</span></div>
                  <div style={{width:120,textAlign:"center"}}><span style={{fontSize:10,fontWeight:700,color:"var(--text-3)",letterSpacing:".04em"}}>NARX (SO&apos;M)</span></div>
                  {chegirmaHa&&<div style={{width:70,textAlign:"center"}}><span style={{fontSize:10,fontWeight:700,color:"#d97706",letterSpacing:".04em"}}>CHEGIRMA</span></div>}
                  <div style={{minWidth:110,textAlign:"right"}}><span style={{fontSize:10,fontWeight:700,color:"var(--text-3)",letterSpacing:".04em"}}>JAMI</span></div>
                  <div style={{width:36}}/>
                </div>
              )}
              {isMobile ? (
                savat.map(s=>{
                  const a=!!num(s.Narxi),b=!!num(s.Narx_som);const ne=triedSave&&!!s.Mahsulot_ID&&!!s.Soni&&((!a&&!b)||(a&&b));
                  return <MobileProductRow key={s.id} s={s} onUpdate={updateItem} onRemove={id=>setSavat(p=>p.filter(r=>r.id!==id))} mItems={mItems} chegirmaHa={chegirmaHa} narxError={ne}/>;
                })
              ) : (
                savat.map(s=>{
                  const foiz=chegirmaHa?num(s.Foiz):0;
                  const jS=num(s.Soni)*num(s.Narx_som)*(1-foiz/100);
                  const jU=num(s.Soni)*num(s.Narxi)*(1-foiz/100);
                  const a=!!num(s.Narxi),b=!!num(s.Narx_som);const ne=triedSave&&!!s.Mahsulot_ID&&!!s.Soni&&((!a&&!b)||(a&&b));const bothFilled=ne&&a&&b;
                  return (
                  <div key={s.id} style={{marginBottom:bothFilled?2:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{flex:3,minWidth:0}}><SearchSelect items={mItems} value={s.Mahsulot_ID} onChange={v=>updateItem(s.id,"Mahsulot_ID",v)} placeholder="Mahsulot..."/></div>
                    <input type="number" value={s.Soni} onChange={e=>updateItem(s.id,"Soni",e.target.value)} placeholder="Miqdor" style={{width:90,padding:"10px",border:"1px solid var(--border)",borderRadius:"var(--radius)",fontSize:13,fontWeight:600,outline:"none",textAlign:"center"}}/>
                    <input value={s.Narxi} onChange={e=>updateItem(s.id,"Narxi",e.target.value)} placeholder="Narx ($)" style={{width:100,padding:"10px",border:`1px solid ${ne?"#ef4444":"var(--border)"}`,borderRadius:"var(--radius)",fontSize:13,fontWeight:600,outline:"none",color:"#2563eb",textAlign:"center"}}/>
                    <input value={s.Narx_som} onChange={e=>updateItem(s.id,"Narx_som",e.target.value)} placeholder="Narx (so'm)" style={{width:120,padding:"10px",border:`1px solid ${ne?"#ef4444":"var(--border)"}`,borderRadius:"var(--radius)",fontSize:13,fontWeight:600,outline:"none",textAlign:"center"}}/>
                    {chegirmaHa&&<input value={s.Foiz} onChange={e=>updateItem(s.id,"Foiz",e.target.value)} placeholder="%" inputMode="decimal" style={{width:70,padding:"10px",border:"1px solid #fde68a",borderRadius:"var(--radius)",fontSize:13,fontWeight:600,outline:"none",color:"#d97706",textAlign:"center"}}/>}
                    <div style={{minWidth:110,padding:"10px",background:"var(--bg)",borderRadius:"var(--radius)",fontSize:13,fontWeight:700,textAlign:"right"}}>
                      {num(s.Soni)!==0?(jS!==0?jS.toLocaleString("ru-RU"):jU!==0?"$"+jU.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2}):"—"):"—"}
                    </div>
                    <button onClick={()=>setSavat(p=>p.filter(r=>r.id!==s.id))} style={{width:36,height:40,borderRadius:8,border:"none",background:"#dbeafe",color:"#2563eb",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:20,fontWeight:700}}>−</button>
                  </div>
                  {bothFilled&&<p style={{fontSize:11,fontWeight:600,color:"#ef4444",margin:"2px 0 6px 0"}}>So&apos;m va dollar narxlardan birini tanlash kerak</p>}
                  </div>
                  );
                })
              )}
              <button onClick={addItem} style={{display:"flex",alignItems:"center",gap:4,padding:"8px 14px",border:"1px solid var(--border)",borderRadius:8,fontSize:13,fontWeight:600,background:"var(--white)",cursor:"pointer",color:"var(--text-2)",marginTop:6,width:isMobile?"100%":undefined,justifyContent:"center"}}>
                <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                Qo&apos;shish
              </button>
              {savat.length>0&&(()=>{
                const foizSom=chegirmaHa?savat.reduce((s,r)=>s+num(r.Soni)*num(r.Narx_som)*(num(r.Foiz)/100),0):0;
                const foizUsd=chegirmaHa?savat.reduce((s,r)=>s+num(r.Soni)*num(r.Narxi)*(num(r.Foiz)/100),0):0;
                const netSom=jamiSom-foizSom;
                const netUsd=jamiUsd-foizUsd;
                const hasDiscount=chegirmaHa&&(foizSom>0||foizUsd>0);
                return (
                  <div style={{marginTop:8,background:"var(--bg)",borderRadius:"var(--radius)",overflow:"hidden"}}>
                    {hasDiscount&&(
                      <div style={{display:"flex",justifyContent:"flex-end",gap:16,padding:"8px 14px",borderBottom:"1px solid var(--border)"}}>
                        <span style={{fontSize:12,fontWeight:600,color:"var(--text-3)"}}>Chegirmadan oldingi summa:</span>
                        {jamiSom!==0&&<span style={{fontSize:13,fontWeight:700}}>{fmtSom(jamiSom)}</span>}
                        {jamiUsd!==0&&<span style={{fontSize:13,fontWeight:700,color:"#2563eb"}}>{fmtUsd(jamiUsd)}</span>}
                      </div>
                    )}
                    {hasDiscount&&(
                      <div style={{display:"flex",justifyContent:"flex-end",gap:16,padding:"8px 14px",borderBottom:"1px solid var(--border)",background:"#fffbeb"}}>
                        <span style={{fontSize:12,fontWeight:700,color:"#d97706"}}>Chegirma:</span>
                        {foizSom>0&&<span style={{fontSize:13,fontWeight:700,color:"#d97706"}}>-{foizSom.toLocaleString("ru-RU")} so&apos;m</span>}
                        {foizUsd>0&&<span style={{fontSize:13,fontWeight:700,color:"#d97706"}}>-${foizUsd.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>}
                      </div>
                    )}
                    <div style={{display:"flex",justifyContent:"flex-end",gap:16,padding:"10px 14px"}}>
                      <span style={{fontSize:12,fontWeight:700,color:"var(--text-3)"}}>{hasDiscount?"Jami summa:":"Jami:"}</span>
                      {(hasDiscount?netSom:jamiSom)!==0&&<span style={{fontSize:14,fontWeight:800}}>{fmtSom(hasDiscount?netSom:jamiSom)}</span>}
                      {(hasDiscount?netUsd:jamiUsd)!==0&&<span style={{fontSize:14,fontWeight:800,color:"#2563eb"}}>{fmtUsd(hasDiscount?netUsd:jamiUsd)}</span>}
                    </div>
                  </div>
                );
              })()}
              <div style={{marginTop:16}}>
                <label style={{fontSize:12,fontWeight:600,color:"var(--text-2)",display:"block",marginBottom:6}}>Izoh</label>
                <input value={izoh} onChange={e=>setIzoh(e.target.value)} placeholder="Qo'shimcha izoh..."
                  style={{width:"100%",padding:"10px 14px",border:"1px solid var(--border)",borderRadius:"var(--radius)",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
              </div>
            </div>
            <div style={{display:"flex",gap:10,padding:"16px 20px",borderTop:"1px solid var(--border)",paddingBottom:isMobile?"max(16px, env(safe-area-inset-bottom))":16}}>
              <button className="btn btn--outline" style={{flex:1}} onClick={()=>setAddOpen(false)}>Bekor</button>
              <button className="btn btn--primary" style={{flex:2}} onClick={handleSave}
                disabled={saving||!taminotchiId||savat.filter(s=>s.Mahsulot_ID&&s.Soni).length===0}>
                {saving&&<span className="spinner"/>} Saqlash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ── */}
      {deleteTarget&&(
        <div className="modal-overlay" onClick={()=>setDeleteTarget(null)}>
          <div className="confirm" onClick={e=>e.stopPropagation()}>
            <div className="confirm__icon">
              <svg width="24" height="24" fill="none" stroke="#ef4444" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </div>
            <h3 className="confirm__title">O&apos;chirishni tasdiqlang</h3>
            <p className="confirm__text"><strong>Xarid #{deleteTarget.Sotuv_Raqami}</strong> va barcha savat elementlari o&apos;chiriladi.</p>
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

function StatCard({ label, value, color, isMobile }: { label: string; value: string; color?: string; isMobile?: boolean }) {
  return (
    <div style={{background:"var(--white)",borderRadius:"var(--radius-xl)",boxShadow:"var(--shadow-sm)",padding: isMobile ? "14px 16px" : "20px 24px"}}>
      <p style={{fontSize:10,fontWeight:700,color:"var(--text-3)",letterSpacing:".06em",marginBottom: isMobile ? 8 : 10}}>{label}</p>
      <p style={{fontSize: isMobile ? 17 : 26,fontWeight:800,color:color||"var(--text)",lineHeight:1}}>{value}</p>
    </div>
  );
}
