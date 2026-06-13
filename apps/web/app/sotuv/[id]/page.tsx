"use client";
import { fetchSheet } from "@/lib/sheet-cache";
import { useAuth } from "@/lib/AuthContext";
import { gaznaForUser } from "@/lib/auth";
import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";

interface Sotuv {
  Sotuv_ID: string; Yil: string; Oy: string; Sana: string; Status: string;
  Sotuv_Raqami: string; Agent: string; Mijoz_ID: string;
  Balans: string; Balans_dollar: string; Izoh: string; Vaqt: string;
}
interface SotuvSavatRow {
  Savat_ID: string; Sotuv_ID: string; Mahsulot_ID: string;
  Soni: string; Som_Narx: string; Summa_som: string; Kurs: string; Ombor_ID: string; Check: string;
}
interface SotuvSavatDollarRow {
  Savat_ID: string; Sotuv_ID: string; Mahsulot_ID: string;
  Soni: string; Narx: string; Summa: string; Kurs: string; Ombor_ID: string; Check: string;
}
interface Foydalanuvchi { Foydalanuvchi_ID: string; Nomi: string; }
interface Mijoz { Mijoz_ID: string; Ism: string; Telefon: string; Boshlangich_Balans_som?: string; Boshlangich_Balans_dollar?: string; }
interface Mahsulot { Mahsulot_ID: string; Nomi: string; Ombor_ID: string; Sotuv_dollar: string; Sotuv_som: string; }
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
function num(v: string|number|undefined) { return parseFloat(String(v||"0").replace(/\s/g,"").replace(",",".")) || 0; }
function fmt(v: string|number|undefined) { const n=num(v); return n?n.toLocaleString("ru-RU"):"0"; }
function fmtSom(v: string|number|undefined) { const n=num(v); return n?n.toLocaleString("ru-RU")+" so'm":"—"; }
function fmtUsd(v: string|number|undefined) { const n=num(v); return n?"$"+n.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2}):"—"; }

function SearchSelect({ items, value, onChange, placeholder }: {
  items:{id:string;label:string}[]; value:string; onChange:(id:string)=>void; placeholder?:string;
}) {
  const [q,setQ]=useState(""); const [open,setOpen]=useState(false); const ref=useRef<HTMLDivElement>(null);
  const selected=items.find(i=>i.id===value);
  useEffect(()=>{ const h=(e:MouseEvent)=>{ if(ref.current&&!ref.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener("mousedown",h); return ()=>document.removeEventListener("mousedown",h); },[]);
  const list=items.filter(i=>i.label.toLowerCase().includes(q.toLowerCase())).slice(0,60);
  return (
    <div ref={ref} style={{position:"relative"}}>
      <div onClick={()=>{setOpen(o=>!o);setQ("");}} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"var(--bg)",border:"1px solid var(--border)",borderRadius:"var(--radius)",cursor:"pointer",fontSize:14,color:selected?"var(--text)":"var(--text-3)"}}>
        <span>{selected?selected.label:placeholder||"Tanlang..."}</span>
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{transform:open?"rotate(180deg)":"none",transition:"transform .15s"}}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
      </div>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,zIndex:200,background:"var(--white)",border:"1px solid var(--border)",borderRadius:"var(--radius)",boxShadow:"var(--shadow)",overflow:"hidden"}}>
          <div style={{padding:"8px",borderBottom:"1px solid var(--border)"}}><input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Qidirish..." style={{width:"100%",padding:"7px 10px",border:"1px solid var(--border)",borderRadius:8,fontSize:13,outline:"none"}}/></div>
          <div style={{maxHeight:220,overflowY:"auto"}}>
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

export default function SotuvDetailPage() {
  const { id } = useParams<{id:string}>();
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.lavozim === "Admin";

  const [sotuv, setSotuv]             = useState<Sotuv|null>(null);
  const [savatSom, setSavatSom]       = useState<SotuvSavatRow[]>([]);
  const [savatDollar, setSavatDollar] = useState<SotuvSavatDollarRow[]>([]);
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
  const [editTolov, setEditTolov]             = useState<STolov|null>(null);
  const [editTolovValyuta, setEditTolovValyuta] = useState<"Som"|"Dollar">("Som");
  const [editTolovTuri, setEditTolovTuri]     = useState("Naqd");
  const [editTolovSom, setEditTolovSom]       = useState("");
  const [editTolovDollar, setEditTolovDollar] = useState("");
  const [editTolovKurs, setEditTolovKurs]     = useState("");
  const [editTolovIzoh, setEditTolovIzoh]     = useState("");
  const [editTolovGazna, setEditTolovGazna]   = useState("");
  const [editTolovGaznaDollar, setEditTolovGaznaDollar] = useState("");
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
  const [editSavatItems, setEditSavatItems] = useState<{id:string;Mahsulot_ID:string;Soni:string;Som_Narx:string;Narx:string;}[]>([]);
  const [editKurs, setEditKurs]           = useState("");
  const [editSaving, setEditSaving]       = useState(false);
  const [isAddMode, setIsAddMode]         = useState(false);

  // Inline edit for savat rows
  const [editSomRow, setEditSomRow]           = useState<SotuvSavatRow|null>(null);
  const [editSomSoni, setEditSomSoni]         = useState("");
  const [editSomNarx, setEditSomNarx]         = useState("");
  const [editSomSaving, setEditSomSaving]     = useState(false);
  const [editDollarRow, setEditDollarRow]     = useState<SotuvSavatDollarRow|null>(null);
  const [editDollarSoni, setEditDollarSoni]   = useState("");
  const [editDollarNarx, setEditDollarNarx]   = useState("");
  const [editDollarSaving, setEditDollarSaving] = useState(false);

  // Delete confirms
  const [deleteOpen, setDeleteOpen]         = useState(false);
  const [deleting, setDeleting]             = useState(false);
  const [deleteSomRow, setDeleteSomRow]     = useState<SotuvSavatRow|null>(null);
  const [deleteDollarRow, setDeleteDollarRow] = useState<SotuvSavatDollarRow|null>(null);

  const [chekDone, setChekDone] = useState(false);

  useEffect(()=>{
    if(!id) return;
    try {
      const ids: string[] = JSON.parse(localStorage.getItem("sotuv_chek_done")||"[]");
      setChekDone(ids.includes(id));
    } catch {}
  },[id]);

  function toggleChekDoneDetail() {
    setChekDone(prev=>{
      const next=!prev;
      try {
        const ids: string[] = JSON.parse(localStorage.getItem("sotuv_chek_done")||"[]");
        if(next){ if(!ids.includes(id)) ids.push(id); }
        else { const i=ids.indexOf(id); if(i!==-1) ids.splice(i,1); }
        localStorage.setItem("sotuv_chek_done",JSON.stringify(ids));
      } catch {}
      return next;
    });
  }

  // Inline add rows
  const [addSomOpen, setAddSomOpen]           = useState(false);
  const [addSomMahsulot, setAddSomMahsulot]   = useState("");
  const [addSomSoni, setAddSomSoni]           = useState("");
  const [addSomNarx, setAddSomNarx]           = useState("");
  const [addSomSaving, setAddSomSaving]       = useState(false);
  const [addDollarOpen, setAddDollarOpen]         = useState(false);
  const [addDollarMahsulot, setAddDollarMahsulot] = useState("");
  const [addDollarSoni, setAddDollarSoni]         = useState("");
  const [addDollarNarx, setAddDollarNarx]         = useState("");
  const [addDollarSaving, setAddDollarSaving]     = useState(false);

  function loadData() {
    setLoading(true);
    Promise.all([
      fetchSheet("Sotuv"),
      fetchSheet("Sotuv_Savat"),
      fetchSheet("Sotuv_savat_dollar"),
      fetchSheet("Foydalanuvchi"),
      fetchSheet("Mijozlar"),
      fetchSheet("Mahsulot"),
      fetchSheet("S_tolov"),
      fetchSheet("Gazna"),
    ]).then(([sR,ssR,sdR,fR,mzR,mhR,stR,gzR])=>{
      const s=(sR.data as Sotuv[]).find(x=>x.Sotuv_ID===id)||null;
      setSotuv(s);
      setSavatSom((ssR.data as SotuvSavatRow[]).filter(r=>r.Sotuv_ID===id));
      setSavatDollar((sdR.data as SotuvSavatDollarRow[]).filter(r=>r.Sotuv_ID===id));
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
      const sorted=((stR.data||[]) as STolov[]).filter(r=>r.Sotuv_ID===id).sort((a,b)=>{
        const p=(s:string)=>{const [d,mo,y]=(s||"").split(".").map(Number);return (y||0)*10000+(mo||0)*100+(d||0);};
        const t2s=(v:string)=>{const [h,m,s]=(v||"").split(":").map(Number);return (h||0)*3600+(m||0)*60+(s||0);};
        const dd=p(b.Sana)-p(a.Sana); return dd!==0?dd:t2s(b.Vaqt)-t2s(a.Vaqt);
      });
      setStolovlar(sorted);
      setGaznalar(((gzR.data||[]) as Gazna[]).filter(g=>g.Gazna_ID));

      // Mijozning umumiy balansi
      const mijozId = s?.Mijoz_ID || "";
      const mijozRec = (mzR.data as Mijoz[]).find(m=>m.Mijoz_ID===mijozId);
      const bSom    = num(mijozRec?.Boshlangich_Balans_som);
      const bDollar = num(mijozRec?.Boshlangich_Balans_dollar);
      const allSotuvIds = new Set(
        (sR.data as Sotuv[]).filter(sv=>sv.Mijoz_ID===mijozId && sv.Sotuv_ID!==id).map(sv=>sv.Sotuv_ID)
      );
      const isDollar=(v:string)=>{const lv=String(v||"").toLowerCase().trim();return lv.includes("dollar")||lv==="$"||lv.includes("usd");};
      const sotuvSomJami    = (ssR.data as SotuvSavatRow[]).filter(r=>allSotuvIds.has(r.Sotuv_ID)).reduce((s,r)=>s+num(r.Summa_som),0);
      const sotuvDollarJami = (sdR.data as SotuvSavatDollarRow[]).filter(r=>allSotuvIds.has(r.Sotuv_ID)).reduce((s,r)=>s+num(r.Summa),0);
      const mijozTolovlar   = (stR.data as STolov[]).filter(r=>r.Mijoz_ID===mijozId && r.Sotuv_ID!==id);
      const tolovSomJami    = mijozTolovlar.reduce((s,t)=>s+(!isDollar(t.Valyuta)?num(t.Som):0),0);
      const tolovDollarJami = mijozTolovlar.reduce((s,t)=>s+(isDollar(t.Valyuta)?num(t.Summa_dollar):0),0);
      setMijozQarzSom(bSom + sotuvSomJami - tolovSomJami);
      setMijozQarzDollar(bDollar + sotuvDollarJami - tolovDollarJami);
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
      setSavatSom(p=>p.map(r=>r.Savat_ID===s.Savat_ID?{...r,Check:newVal}:r));
    } finally { setTogglingId(null); }
  }

  async function toggleDollarCheck(s:SotuvSavatDollarRow) {
    const newVal=s.Check==="FALSE"?"TRUE":"FALSE";
    setTogglingId(s.Savat_ID);
    try {
      await fetch("/api/sheets",{method:"PUT",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({sheet:"Sotuv_savat_dollar",idColumn:"Savat_ID",idValue:s.Savat_ID,row:{Check:newVal}})});
      setSavatDollar(p=>p.map(r=>r.Savat_ID===s.Savat_ID?{...r,Check:newVal}:r));
    } finally { setTogglingId(null); }
  }

  function openEdit() {
    if(!sotuv) return;
    setIsAddMode(false);
    setEditMijoz(sotuv.Mijoz_ID); setEditAgent(sotuv.Agent); setEditIzoh(sotuv.Izoh||"");
    const combined=[
      ...savatSom.map(r=>({id:uid(),Mahsulot_ID:r.Mahsulot_ID,Soni:r.Soni,Som_Narx:r.Som_Narx,Narx:""})),
      ...savatDollar.map(r=>({id:uid(),Mahsulot_ID:r.Mahsulot_ID,Soni:r.Soni,Som_Narx:"",Narx:r.Narx})),
    ];
    setEditKurs(savatSom[0]?.Kurs||savatDollar[0]?.Kurs||"");
    setEditSavatItems(combined.length>0?combined:[{id:uid(),Mahsulot_ID:"",Soni:"",Som_Narx:"",Narx:""}]);
    setEditOpen(true);
  }

  function openAddItem() {
    if(!sotuv) return;
    setIsAddMode(true);
    setEditSavatItems([{id:uid(),Mahsulot_ID:"",Soni:"",Som_Narx:"",Narx:""}]);
    setEditKurs(savatSom[0]?.Kurs||savatDollar[0]?.Kurs||"");
    setEditOpen(true);
  }

  function updateItem(itemId:string, field:string, val:string) {
    setEditSavatItems(p=>p.map(s=>{
      if(s.id!==itemId) return s;
      const u={...s,[field]:val};
      if(field==="Mahsulot_ID"){const m=mMap[val];if(m){u.Som_Narx=m.Sotuv_som||"";u.Narx=m.Sotuv_dollar||"";}}
      return u;
    }));
  }

  async function handleUpdate() {
    if(!sotuv||!editMijoz||!editAgent) return;
    setEditSaving(true);
    const valid=editSavatItems.filter(s=>s.Mahsulot_ID&&s.Soni&&(num(s.Som_Narx)||num(s.Narx)));
    const kurs=editKurs||"0";
    const {sana:snStr,yil,oy,vaqt}=(() => {
      const d=new Date(); const dd=String(d.getDate()).padStart(2,"0"),mm=String(d.getMonth()+1).padStart(2,"0");
      const hh=String(d.getHours()).padStart(2,"0"),mi=String(d.getMinutes()).padStart(2,"0"),ss=String(d.getSeconds()).padStart(2,"0");
      return {sana:`${dd}.${mm}.${d.getFullYear()}`,oy:String(d.getMonth()+1),yil:String(d.getFullYear()),vaqt:`${hh}:${mi}:${ss}`};
    })();
    try {
      if(isAddMode) {
        for(const r of valid){
          const m=mMap[r.Mahsulot_ID];
          const snRow=sotuv.Sana; const [,moRow,yRow]=snRow.split(".");
          if(num(r.Som_Narx)>0){
            await fetch("/api/sheets",{method:"POST",headers:{"Content-Type":"application/json"},
              body:JSON.stringify({sheet:"Sotuv_Savat",row:{
                Savat_ID:uid(),Yil:yRow,Oy:moRow.replace(/^0/,""),Sana:snRow,
                Sotuv_ID:sotuv.Sotuv_ID,Agent:editAgent,Mahsulot_ID:r.Mahsulot_ID,
                Soni:r.Soni,Som_Narx:r.Som_Narx,Kurs:kurs,
                Summa_som:String(num(r.Soni)*num(r.Som_Narx)),
                Som_tan_narx:m?.Sotuv_som||"",Foyda:"",Foyda_summasi_som:"",
                Ombor_ID:m?.Ombor_ID||"",Raqam:"",Vaqt:vaqt,Check:"",Izoh:"",Mijoz_ID:editMijoz,
              }})});
          }
          if(num(r.Narx)>0){
            await fetch("/api/sheets",{method:"POST",headers:{"Content-Type":"application/json"},
              body:JSON.stringify({sheet:"Sotuv_savat_dollar",row:{
                Savat_ID:uid(),Yil:yRow,Oy:moRow.replace(/^0/,""),Sana:snRow,
                Sotuv_ID:sotuv.Sotuv_ID,Agent:editAgent,Mahsulot_ID:r.Mahsulot_ID,
                Soni:r.Soni,Narx:r.Narx,Kurs:kurs,Summa:String(num(r.Soni)*num(r.Narx)),
                Tan_narx:m?.Sotuv_dollar||"",Foyda:"",Foyda_summasi_som:"",
                Ombor_ID:m?.Ombor_ID||"",Raqam:"",Vaqt:vaqt,Check:"",Izoh:"",Mijoz_ID:editMijoz,
              }})});
          }
        }
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
        const snRow=sotuv.Sana; const [,moRow,yRow]=snRow.split(".");
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
                Ombor_ID:m?.Ombor_ID||"",Raqam:"",Vaqt:vaqt,Check:"",Izoh:"",Mijoz_ID:editMijoz,
              }})});
          }
          if(num(r.Narx)>0){
            await fetch("/api/sheets",{method:"POST",headers:{"Content-Type":"application/json"},
              body:JSON.stringify({sheet:"Sotuv_savat_dollar",row:{
                Savat_ID:uid(),Yil:yRow,Oy:moRow.replace(/^0/,""),Sana:snRow,
                Sotuv_ID:sotuv.Sotuv_ID,Agent:editAgent,Mahsulot_ID:r.Mahsulot_ID,
                Soni:r.Soni,Narx:r.Narx,Kurs:kurs,Summa:String(num(r.Soni)*num(r.Narx)),
                Tan_narx:m?.Sotuv_dollar||"",Foyda:"",Foyda_summasi_som:"",
                Ombor_ID:m?.Ombor_ID||"",Raqam:"",Vaqt:vaqt,Check:"",Izoh:"",Mijoz_ID:editMijoz,
              }})});
          }
        }
      }
      setEditOpen(false);
      setTimeout(()=>loadData(),600);
    } finally { setEditSaving(false); }
  }

  async function handleEditSomSave() {
    if(!editSomRow||!sotuv) return;
    setEditSomSaving(true);
    const oldSumma=num(editSomRow.Summa_som);
    const newSumma=num(editSomSoni)*num(editSomNarx);
    const newId=uid();
    try {
      const [,moRow,yRow]=sotuv.Sana.split(".");
      await fetch("/api/sheets",{method:"DELETE",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({sheet:"Sotuv_Savat",idColumn:"Savat_ID",idValue:editSomRow.Savat_ID})});
      await fetch("/api/sheets",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({sheet:"Sotuv_Savat",row:{
          Savat_ID:newId,Yil:yRow,Oy:moRow.replace(/^0/,""),Sana:sotuv.Sana,
          Sotuv_ID:sotuv.Sotuv_ID,Agent:sotuv.Agent,Mahsulot_ID:editSomRow.Mahsulot_ID,
          Soni:editSomSoni,Som_Narx:editSomNarx,Kurs:editSomRow.Kurs||"0",
          Summa_som:String(newSumma),
          Som_tan_narx:"",Foyda:"",Foyda_summasi_som:"",
          Ombor_ID:editSomRow.Ombor_ID||"",Raqam:"",Vaqt:sotuv.Sana,Check:editSomRow.Check||"",Izoh:"",Mijoz_ID:sotuv.Mijoz_ID,
        }})});
      setSavatSom(p=>p.map(r=>r.Savat_ID===editSomRow.Savat_ID
        ?{...r,Savat_ID:newId,Soni:editSomSoni,Som_Narx:editSomNarx,Summa_som:String(newSumma)}:r));
      setMijozQarzSom(p=>p-oldSumma+newSumma);
      setEditSomRow(null);
    } finally { setEditSomSaving(false); }
  }

  async function handleEditDollarSave() {
    if(!editDollarRow||!sotuv) return;
    setEditDollarSaving(true);
    const oldSumma=num(editDollarRow.Summa);
    const newSumma=num(editDollarSoni)*num(editDollarNarx);
    const newId=uid();
    try {
      const [,moRow,yRow]=sotuv.Sana.split(".");
      await fetch("/api/sheets",{method:"DELETE",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({sheet:"Sotuv_savat_dollar",idColumn:"Savat_ID",idValue:editDollarRow.Savat_ID})});
      await fetch("/api/sheets",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({sheet:"Sotuv_savat_dollar",row:{
          Savat_ID:newId,Yil:yRow,Oy:moRow.replace(/^0/,""),Sana:sotuv.Sana,
          Sotuv_ID:sotuv.Sotuv_ID,Agent:sotuv.Agent,Mahsulot_ID:editDollarRow.Mahsulot_ID,
          Soni:editDollarSoni,Narx:editDollarNarx,Kurs:editDollarRow.Kurs||"0",
          Summa:String(newSumma),
          Tan_narx:"",Foyda:"",Foyda_summasi_som:"",
          Ombor_ID:editDollarRow.Ombor_ID||"",Raqam:"",Vaqt:sotuv.Sana,Check:editDollarRow.Check||"",Izoh:"",Mijoz_ID:sotuv.Mijoz_ID,
        }})});
      setSavatDollar(p=>p.map(r=>r.Savat_ID===editDollarRow.Savat_ID
        ?{...r,Savat_ID:newId,Soni:editDollarSoni,Narx:editDollarNarx,Summa:String(newSumma)}:r));
      setMijozQarzDollar(p=>p-oldSumma+newSumma);
      setEditDollarRow(null);
    } finally { setEditDollarSaving(false); }
  }

  async function handleAddSomRow() {
    if(!sotuv||!addSomMahsulot||!addSomSoni) return;
    setAddSomSaving(true);
    const m=mMap[addSomMahsulot];
    const [,moRow,yRow]=sotuv.Sana.split(".");
    const {vaqt}=nowStr();
    const savatId=uid();
    const summa=num(addSomSoni)*num(addSomNarx);
    try {
      await fetch("/api/sheets",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({sheet:"Sotuv_Savat",row:{
          Savat_ID:savatId,Yil:yRow,Oy:moRow.replace(/^0/,""),Sana:sotuv.Sana,
          Sotuv_ID:sotuv.Sotuv_ID,Agent:sotuv.Agent,Mahsulot_ID:addSomMahsulot,
          Soni:addSomSoni,Som_Narx:addSomNarx,Kurs:savatSom[0]?.Kurs||"0",
          Summa_som:String(summa),
          Som_tan_narx:m?.Sotuv_som||"",Foyda:"",Foyda_summasi_som:"",
          Ombor_ID:m?.Ombor_ID||"",Raqam:"",Vaqt:vaqt,Check:"TRUE",Izoh:"",Mijoz_ID:sotuv.Mijoz_ID,
        }})});
      setSavatSom(p=>[...p,{Savat_ID:savatId,Sotuv_ID:sotuv.Sotuv_ID,Mahsulot_ID:addSomMahsulot,
        Soni:addSomSoni,Som_Narx:addSomNarx,Summa_som:String(summa),
        Kurs:savatSom[0]?.Kurs||"0",Ombor_ID:m?.Ombor_ID||"",Check:"TRUE"}]);
      setMijozQarzSom(p=>p+summa);
      setAddSomOpen(false); setAddSomMahsulot(""); setAddSomSoni(""); setAddSomNarx("");
    } finally { setAddSomSaving(false); }
  }

  async function handleAddDollarRow() {
    if(!sotuv||!addDollarMahsulot||!addDollarSoni) return;
    setAddDollarSaving(true);
    const m=mMap[addDollarMahsulot];
    const [,moRow,yRow]=sotuv.Sana.split(".");
    const {vaqt}=nowStr();
    const savatId=uid();
    const summa=num(addDollarSoni)*num(addDollarNarx);
    try {
      await fetch("/api/sheets",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({sheet:"Sotuv_savat_dollar",row:{
          Savat_ID:savatId,Yil:yRow,Oy:moRow.replace(/^0/,""),Sana:sotuv.Sana,
          Sotuv_ID:sotuv.Sotuv_ID,Agent:sotuv.Agent,Mahsulot_ID:addDollarMahsulot,
          Soni:addDollarSoni,Narx:addDollarNarx,Kurs:savatDollar[0]?.Kurs||"0",
          Summa:String(summa),
          Tan_narx:m?.Sotuv_dollar||"",Foyda:"",Foyda_summasi_som:"",
          Ombor_ID:m?.Ombor_ID||"",Raqam:"",Vaqt:vaqt,Check:"TRUE",Izoh:"",Mijoz_ID:sotuv.Mijoz_ID,
        }})});
      setSavatDollar(p=>[...p,{Savat_ID:savatId,Sotuv_ID:sotuv.Sotuv_ID,Mahsulot_ID:addDollarMahsulot,
        Soni:addDollarSoni,Narx:addDollarNarx,Summa:String(summa),
        Kurs:savatDollar[0]?.Kurs||"0",Ombor_ID:m?.Ombor_ID||"",Check:"TRUE"}]);
      setMijozQarzDollar(p=>p+summa);
      setAddDollarOpen(false); setAddDollarMahsulot(""); setAddDollarSoni(""); setAddDollarNarx("");
    } finally { setAddDollarSaving(false); }
  }

  async function handleDeleteSotuv() {
    if(!sotuv) return;
    setDeleting(true);
    const sid=sotuv.Sotuv_ID;
    try {
      const [ssRes,sdRes]=await Promise.all([
        fetchSheet("Sotuv_Savat"),
        fetchSheet("Sotuv_savat_dollar"),
      ]);
      const somItems=((ssRes.data||[]) as {Savat_ID:string;Sotuv_ID:string}[]).filter(r=>String(r.Sotuv_ID||"").trim()===sid);
      const dollarItems=((sdRes.data||[]) as {Savat_ID:string;Sotuv_ID:string}[]).filter(r=>String(r.Sotuv_ID||"").trim()===sid);
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
      router.push("/sotuv");
    } finally { setDeleting(false); }
  }

  function openAddTolov() {
    setAddTolovValyuta("Som"); setAddTolovTuri("Naqd");
    setAddTolovSom(""); setAddTolovDollar(""); setAddTolovKurs(""); setAddTolovIzoh("");
    setAddTolovGazna(""); setAddTolovGaznaDollar("");
    setAddTolovOpen(true);
  }

  async function handleAddTolov() {
    if(!sotuv) return;
    const somV=num(addTolovSom), usdV=num(addTolovDollar);
    if(somV===0&&usdV===0) return;
    if(num(addTolovKurs)<11000) return;
    setAddTolovSaving(true);
    const {sana,oy,yil,vaqt}=nowStr();
    const kurs=num(addTolovKurs);
    const isSom=addTolovValyuta==="Som";
    const summa=isSom?String(somV+usdV*kurs):"";
    const summaDollar=!isSom?String(usdV+(kurs>0?somV/kurs:0)):"";
    try {
      await fetch("/api/sheets",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({sheet:"S_tolov",row:{
          Tolov_ID:uid(),Sotuv_ID:sotuv.Sotuv_ID,Mijoz_ID:sotuv.Mijoz_ID,Agent:sotuv.Agent,
          Yil:yil,Oy:oy,Sana:sana,Valyuta:isSom?"So'm":"Dollar",Turi:addTolovTuri,
          Som:String(somV),Dollar:String(usdV),Summa:summa,Summa_dollar:summaDollar,
          Dollar_Kursi:addTolovKurs,Izoh:addTolovIzoh,Vaqt:vaqt,Check:"False",
          Gazna_ID:addTolovGazna,Gazna_dollar_ID:addTolovGaznaDollar,
        }})});
      setAddTolovOpen(false);
      setTimeout(()=>loadData(),600);
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
  }

  async function handleEditTolovSave() {
    if(!editTolov) return;
    if(num(editTolovKurs)<11000) return;
    setEditTolovSaving(true);
    const somV=num(editTolovSom), usdV=num(editTolovDollar), kurs=num(editTolovKurs);
    const isSom=editTolovValyuta==="Som";
    const summa=isSom?String(somV+usdV*kurs):"";
    const summaDollar=!isSom?String(usdV+(kurs>0?somV/kurs:0)):"";
    try {
      await fetch("/api/sheets",{method:"PUT",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({sheet:"S_tolov",idColumn:"Tolov_ID",idValue:editTolov.Tolov_ID,
          row:{...editTolov,Valyuta:isSom?"So'm":"Dollar",Turi:editTolovTuri,
            Som:String(somV),Dollar:String(usdV),Summa:summa,Summa_dollar:summaDollar,
            Dollar_Kursi:editTolovKurs,Izoh:editTolovIzoh,
            Gazna_ID:editTolovGazna,Gazna_dollar_ID:editTolovGaznaDollar}})});
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
      setDeleteTolov(null);
      setTimeout(()=>loadData(),600);
    } finally { setDeletingTolov(false); }
  }

  async function toggleTolovAkt(t:STolov) {
    setTogglingId(t.Tolov_ID);
    const newVal=(t.Check==="True"||t.Check==="true")?"False":"True";
    await fetch("/api/sheets",{method:"PUT",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({sheet:"S_tolov",idColumn:"Tolov_ID",idValue:t.Tolov_ID,row:{...t,Check:newVal}})});
    setStolovlar(p=>p.map(r=>r.Tolov_ID===t.Tolov_ID?{...r,Check:newVal}:r));
    setTogglingId(null);
  }

  const aItems  = useMemo(()=>agentlar.map(a=>({id:a.Foydalanuvchi_ID,label:a.Nomi})),[agentlar]);
  const mJItems = useMemo(()=>mijozlar.map(m=>({id:m.Mijoz_ID,label:m.Ism+(m.Telefon?` (${m.Telefon})`:""),})),[mijozlar]);
  const mhItems = useMemo(()=>mahsulotlar.map(m=>({id:m.Mahsulot_ID,label:m.Nomi})),[mahsulotlar]);

  const jamiSom    = useMemo(()=>savatSom.reduce((s,r)=>s+num(r.Summa_som),0),[savatSom]);
  const jamiDollar = useMemo(()=>savatDollar.reduce((s,r)=>s+num(r.Summa),0),[savatDollar]);
  const editJamiSom    = useMemo(()=>editSavatItems.reduce((s,r)=>s+num(r.Soni)*num(r.Som_Narx),0),[editSavatItems]);
  const editJamiDollar = useMemo(()=>editSavatItems.reduce((s,r)=>s+num(r.Soni)*num(r.Narx),0),[editSavatItems]);
  const tolovJamiSom    = useMemo(()=>stolovlar.reduce((s,t)=>s+(t.Valyuta!=="Dollar"?num(t.Som):0),0),[stolovlar]);
  const tolovJamiDollar = useMemo(()=>stolovlar.reduce((s,t)=>s+num(t.Dollar),0),[stolovlar]);

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
        <div className="header__inner" style={{gap:14}}>
          <button onClick={()=>router.back()} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",border:"1px solid var(--border)",borderRadius:"var(--radius)",background:"var(--white)",cursor:"pointer",fontSize:13,fontWeight:600,color:"var(--text-2)",flexShrink:0}}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg> Orqaga
          </button>
          <div style={{flex:1}}>
            <h1 style={{fontSize:20,fontWeight:800,lineHeight:1.2}}>Sotuv #{sotuv.Sotuv_Raqami||"—"}</h1>
            <p style={{fontSize:12,color:"var(--text-3)",marginTop:2}}>{sotuv.Sana} — {mjNomi}</p>
          </div>
          <button onClick={()=>{
              const mj=mijozlar.find(m=>m.Mijoz_ID===sotuv.Mijoz_ID);
              sessionStorage.setItem(`chek_${sotuv.Sotuv_ID}`,JSON.stringify({savatSom,savatDollar,mMap}));
              const p=new URLSearchParams({sana:sotuv.Sana,agent:agNomi,mijozIsm:mjNomi,mijozTel:mj?.Telefon||"",totalSom:String(mijozQarzSom),totalDollar:String(mijozQarzDollar)});
              router.push(`/sotuv/${sotuv.Sotuv_ID}/chek?${p.toString()}`);
            }} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 16px",border:"1px solid #ddd6fe",borderRadius:"var(--radius)",background:"#f5f3ff",cursor:"pointer",fontSize:13,fontWeight:700,color:"#7c3aed"}}>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              Chek
            </button>
          <button onClick={toggleChekDoneDetail}
            style={{display:"flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:"var(--radius)",border:`1.5px solid ${chekDone?"#7c3aed":"#d4d4d8"}`,background:chekDone?"#7c3aed":"var(--white)",cursor:"pointer",fontSize:13,fontWeight:700,color:chekDone?"#fff":"var(--text-3)",transition:"all .15s"}}>
            {chekDone
              ? <><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>Chiqarilgan</>
              : <><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" strokeWidth={2}/></svg>Belgilash</>
            }
          </button>
          <button onClick={()=>setDeleteOpen(true)} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 16px",border:"1px solid #fecaca",borderRadius:"var(--radius)",background:"var(--white)",cursor:"pointer",fontSize:13,fontWeight:600,color:"#ef4444"}}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg> O&apos;chirish
          </button>
        </div>
      </header>

      <div className="page-content" style={{maxWidth:1000}}>
        {/* Stats */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:24}}>
          {/* MIJOZ */}
          <div onClick={()=>router.push(`/mijozlar/${sotuv.Mijoz_ID}`)} style={{background:"var(--white)",borderRadius:"var(--radius-xl)",boxShadow:"var(--shadow-sm)",padding:"20px 24px",cursor:"pointer"}}
            onMouseEnter={e=>(e.currentTarget.style.boxShadow="var(--shadow)")} onMouseLeave={e=>(e.currentTarget.style.boxShadow="var(--shadow-sm)")}>
            <p style={{fontSize:10,fontWeight:700,color:"var(--text-3)",letterSpacing:".06em",marginBottom:10}}>MIJOZ</p>
            <p style={{fontSize:16,fontWeight:800,color:"var(--primary)"}}>{mjNomi}</p>
            <p style={{fontSize:11,color:"var(--text-3)",marginTop:4}}>Agent: {agNomi}</p>
          </div>
          {/* SO'M */}
          <div style={{background:"var(--white)",borderRadius:"var(--radius-xl)",boxShadow:"var(--shadow-sm)",padding:"16px 20px"}}>
            <p style={{fontSize:10,fontWeight:700,color:"#16a34a",letterSpacing:".06em",marginBottom:12}}>SO&apos;M</p>
            {[
              {label:"Mijoz balansi", val:mijozQarzSom, color:mijozQarzSom>0?"#ef4444":"#16a34a"},
              {label:"Sotuv summasi", val:jamiSom, color:"var(--text)"},
              {label:"Yakuniy qoldiq", val:jamiSom+mijozQarzSom, color:"var(--text)", bold:true},
            ].map((r,i,arr)=>(
              <div key={i} style={{paddingBottom:i<arr.length-1?10:0,marginBottom:i<arr.length-1?10:0,borderBottom:i<arr.length-1?"1px solid var(--border)":"none"}}>
                <p style={{fontSize:12,fontWeight:700,color:"var(--text-2)",marginBottom:3}}>{r.label}</p>
                <p style={{fontSize:r.bold?16:13,fontWeight:r.bold?800:700,color:r.color}}>
                  {r.val!==0?r.val.toLocaleString("ru-RU"):"0"} <span style={{fontSize:10,fontWeight:600}}>so&apos;m</span>
                </p>
              </div>
            ))}
          </div>
          {/* DOLLAR */}
          <div style={{background:"var(--white)",borderRadius:"var(--radius-xl)",boxShadow:"var(--shadow-sm)",padding:"16px 20px"}}>
            <p style={{fontSize:10,fontWeight:700,color:"#2563eb",letterSpacing:".06em",marginBottom:12}}>DOLLAR</p>
            {[
              {label:"Mijoz balansi", val:mijozQarzDollar, color:mijozQarzDollar>0?"#ef4444":"#16a34a"},
              {label:"Sotuv summasi", val:jamiDollar, color:"var(--text)"},
              {label:"Yakuniy qoldiq", val:jamiDollar+mijozQarzDollar, color:"var(--text)", bold:true},
            ].map((r,i,arr)=>(
              <div key={i} style={{paddingBottom:i<arr.length-1?10:0,marginBottom:i<arr.length-1?10:0,borderBottom:i<arr.length-1?"1px solid var(--border)":"none"}}>
                <p style={{fontSize:12,fontWeight:700,color:"var(--text-2)",marginBottom:3}}>{r.label}</p>
                <p style={{fontSize:r.bold?16:13,fontWeight:r.bold?800:700,color:r.color}}>
                  ${r.val!==0?r.val.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2}):"0.00"}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* So'm mahsulotlar */}
        {(savatSom.length>0||addSomOpen)&&(
          <div style={{background:"var(--white)",borderRadius:"var(--radius-xl)",boxShadow:"var(--shadow-sm)",marginBottom:(savatDollar.length>0||addDollarOpen)?16:0}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px",borderBottom:"1px solid var(--border)",borderRadius:"var(--radius-xl) var(--radius-xl) 0 0",overflow:"hidden"}}>
              <span style={{fontSize:15,fontWeight:700}}>So&apos;m mahsulotlar</span>
              <button onClick={()=>setAddSomOpen(true)} disabled={addSomOpen} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 14px",border:"1px solid var(--border)",borderRadius:"var(--radius)",background:"var(--white)",cursor:addSomOpen?"default":"pointer",fontSize:13,fontWeight:600,color:"var(--text-2)",opacity:addSomOpen?0.5:1}}>
                <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg> Qo&apos;shish
              </button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"48px 1fr 100px 120px 140px 90px 72px",padding:"10px 20px",background:"var(--bg)",borderBottom:"1px solid var(--border)"}}>
              {["#","MAHSULOT","SONI","NARX","JAMI","YETKAZIB BERILDIMI?",""].map(h=><span key={h} style={{fontSize:10,fontWeight:700,color:"var(--text-3)",letterSpacing:".05em"}}>{h}</span>)}
            </div>
            {savatSom.map((s,i)=>{
              const m=mMap[s.Mahsulot_ID];
              const isEdit=editSomRow?.Savat_ID===s.Savat_ID;
              const delivered=s.Check!=="FALSE";
              return (
                <div key={s.Savat_ID||i} style={{display:"grid",gridTemplateColumns:"48px 1fr 100px 120px 140px 90px 72px",padding:isEdit?"8px 20px":"13px 20px",alignItems:"center",borderBottom:i<savatSom.length-1?"1px solid var(--border)":"none",background:isEdit?"#f0f9ff":"transparent"}}>
                  <span style={{fontSize:13,color:"var(--text-3)"}}>{i+1}</span>
                  <span style={{fontSize:14,fontWeight:600}}>{m?.Nomi||"—"}</span>
                  {isEdit?<input autoFocus value={editSomSoni} onChange={e=>setEditSomSoni(e.target.value)} style={{padding:"6px 10px",border:"1.5px solid var(--primary)",borderRadius:"var(--radius)",fontSize:13,fontWeight:700,outline:"none",textAlign:"center"}}/>
                    :<span style={{fontSize:14,fontWeight:700}}>{fmt(s.Soni)}</span>}
                  {isEdit?<input value={editSomNarx} onChange={e=>setEditSomNarx(e.target.value)} style={{padding:"6px 10px",border:"1.5px solid var(--primary)",borderRadius:"var(--radius)",fontSize:13,fontWeight:700,outline:"none",textAlign:"center"}}/>
                    :<span style={{fontSize:14,fontWeight:700}}>{fmt(s.Som_Narx)}</span>}
                  <span style={{fontSize:14,fontWeight:800,color:isEdit?"var(--primary)":"var(--text)"}}>
                    {isEdit?fmtSom(num(editSomSoni)*num(editSomNarx)):fmtSom(s.Summa_som)}
                  </span>
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
                        <button onClick={()=>{setEditSomRow(s);setEditSomSoni(s.Soni);setEditSomNarx(s.Som_Narx);}} style={{width:30,height:30,borderRadius:8,border:"none",background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#2563eb"}} onMouseEnter={e=>(e.currentTarget.style.background="#dbeafe")} onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
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
            {addSomOpen&&(
              <div style={{display:"grid",gridTemplateColumns:"48px 1fr 100px 120px 140px 90px 72px",padding:"8px 20px",alignItems:"center",borderTop:savatSom.length>0?"1px solid var(--border)":"none",background:"#f0f9ff"}}>
                <span style={{fontSize:13,color:"var(--text-3)"}}>{savatSom.length+1}</span>
                <div style={{paddingRight:8}}>
                  <select value={addSomMahsulot} onChange={e=>{setAddSomMahsulot(e.target.value);const m=mMap[e.target.value];if(m)setAddSomNarx(m.Sotuv_som||"");}}
                    style={{width:"100%",padding:"7px 10px",border:"1.5px solid var(--primary)",borderRadius:"var(--radius)",fontSize:13,outline:"none",background:"var(--white)"}}>
                    <option value="">Mahsulot tanlang...</option>
                    {mahsulotlar.map(m=><option key={m.Mahsulot_ID} value={m.Mahsulot_ID}>{m.Nomi}</option>)}
                  </select>
                </div>
                <input autoFocus value={addSomSoni} onChange={e=>setAddSomSoni(e.target.value)} placeholder="Soni"
                  style={{padding:"6px 10px",border:"1.5px solid var(--primary)",borderRadius:"var(--radius)",fontSize:13,fontWeight:700,outline:"none",textAlign:"center"}}/>
                <input value={addSomNarx} onChange={e=>setAddSomNarx(e.target.value)} placeholder="Narx"
                  style={{padding:"6px 10px",border:"1.5px solid var(--primary)",borderRadius:"var(--radius)",fontSize:13,fontWeight:700,outline:"none",textAlign:"center"}}/>
                <span style={{fontSize:14,fontWeight:800,color:"var(--primary)"}}>{fmtSom(num(addSomSoni)*num(addSomNarx))}</span>
                <div/>
                <div style={{display:"flex",gap:4}}>
                  <button onClick={handleAddSomRow} disabled={addSomSaving||!addSomMahsulot||!addSomSoni}
                    style={{width:30,height:30,borderRadius:8,border:"none",background:"#dcfce7",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#16a34a"}}>
                    {addSomSaving?<span className="spinner" style={{width:12,height:12}}/>:<svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>}
                  </button>
                  <button onClick={()=>{setAddSomOpen(false);setAddSomMahsulot("");setAddSomSoni("");setAddSomNarx("");}}
                    style={{width:30,height:30,borderRadius:8,border:"none",background:"#fee2e2",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#ef4444"}}>
                    <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Dollar mahsulotlar */}
        {(savatDollar.length>0||addDollarOpen)&&(
        <div style={{background:"var(--white)",borderRadius:"var(--radius-xl)",boxShadow:"var(--shadow-sm)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px",borderBottom:"1px solid var(--border)",borderRadius:"var(--radius-xl) var(--radius-xl) 0 0",overflow:"hidden"}}>
            <span style={{fontSize:15,fontWeight:700}}>Dollar mahsulotlar</span>
            <button onClick={()=>setAddDollarOpen(true)} disabled={addDollarOpen} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 14px",border:"1px solid var(--border)",borderRadius:"var(--radius)",background:"var(--white)",cursor:addDollarOpen?"default":"pointer",fontSize:13,fontWeight:600,color:"var(--text-2)",opacity:addDollarOpen?0.5:1}}>
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg> Qo&apos;shish
            </button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"48px 1fr 100px 120px 140px 90px 72px",padding:"10px 20px",background:"var(--bg)",borderBottom:"1px solid var(--border)"}}>
            {["#","MAHSULOT","SONI","NARX ($)","JAMI ($)","YETKAZIB BERILDIMI?",""].map(h=><span key={h} style={{fontSize:10,fontWeight:700,color:"var(--text-3)",letterSpacing:".05em"}}>{h}</span>)}
          </div>
          {savatDollar.map((s,i)=>{
            const m=mMap[s.Mahsulot_ID];
            const isEdit=editDollarRow?.Savat_ID===s.Savat_ID;
            const delivered=s.Check!=="FALSE";
            return (
              <div key={s.Savat_ID||i} style={{display:"grid",gridTemplateColumns:"48px 1fr 100px 120px 140px 90px 72px",padding:isEdit?"8px 20px":"13px 20px",alignItems:"center",borderBottom:i<savatDollar.length-1?"1px solid var(--border)":"none",background:isEdit?"#eff6ff":"transparent"}}>
                <span style={{fontSize:13,color:"var(--text-3)"}}>{i+1}</span>
                <span style={{fontSize:14,fontWeight:600}}>{m?.Nomi||"—"}</span>
                {isEdit?<input autoFocus value={editDollarSoni} onChange={e=>setEditDollarSoni(e.target.value)} style={{padding:"6px 10px",border:"1.5px solid #2563eb",borderRadius:"var(--radius)",fontSize:13,fontWeight:700,outline:"none",textAlign:"center"}}/>
                  :<span style={{fontSize:14,fontWeight:700}}>{fmt(s.Soni)}</span>}
                {isEdit?<input value={editDollarNarx} onChange={e=>setEditDollarNarx(e.target.value)} style={{padding:"6px 10px",border:"1.5px solid #2563eb",borderRadius:"var(--radius)",fontSize:13,fontWeight:700,outline:"none",textAlign:"center",color:"#2563eb"}}/>
                  :<span style={{fontSize:14,fontWeight:700,color:"#2563eb"}}>{fmtUsd(s.Narx)}</span>}
                <span style={{fontSize:14,fontWeight:800,color:isEdit?"#2563eb":"var(--text)"}}>
                  {isEdit?fmtUsd(num(editDollarSoni)*num(editDollarNarx)):fmtUsd(s.Summa)}
                </span>
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
                      <button onClick={()=>{setEditDollarRow(s);setEditDollarSoni(s.Soni);setEditDollarNarx(s.Narx);}} style={{width:30,height:30,borderRadius:8,border:"none",background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#2563eb"}} onMouseEnter={e=>(e.currentTarget.style.background="#dbeafe")} onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
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
          {addDollarOpen&&(
            <div style={{display:"grid",gridTemplateColumns:"48px 1fr 100px 120px 140px 90px 72px",padding:"8px 20px",alignItems:"center",borderTop:savatDollar.length>0?"1px solid var(--border)":"none",background:"#eff6ff"}}>
              <span style={{fontSize:13,color:"var(--text-3)"}}>{savatDollar.length+1}</span>
              <div style={{paddingRight:8}}>
                <select value={addDollarMahsulot} onChange={e=>{setAddDollarMahsulot(e.target.value);const m=mMap[e.target.value];if(m)setAddDollarNarx(m.Sotuv_dollar||"");}}
                  style={{width:"100%",padding:"7px 10px",border:"1.5px solid #2563eb",borderRadius:"var(--radius)",fontSize:13,outline:"none",background:"var(--white)"}}>
                  <option value="">Mahsulot tanlang...</option>
                  {mahsulotlar.map(m=><option key={m.Mahsulot_ID} value={m.Mahsulot_ID}>{m.Nomi}</option>)}
                </select>
              </div>
              <input autoFocus value={addDollarSoni} onChange={e=>setAddDollarSoni(e.target.value)} placeholder="Soni"
                style={{padding:"6px 10px",border:"1.5px solid #2563eb",borderRadius:"var(--radius)",fontSize:13,fontWeight:700,outline:"none",textAlign:"center"}}/>
              <input value={addDollarNarx} onChange={e=>setAddDollarNarx(e.target.value)} placeholder="Narx ($)"
                style={{padding:"6px 10px",border:"1.5px solid #2563eb",borderRadius:"var(--radius)",fontSize:13,fontWeight:700,outline:"none",textAlign:"center",color:"#2563eb"}}/>
              <span style={{fontSize:14,fontWeight:800,color:"#2563eb"}}>{fmtUsd(num(addDollarSoni)*num(addDollarNarx))}</span>
              <div/>
              <div style={{display:"flex",gap:4}}>
                <button onClick={handleAddDollarRow} disabled={addDollarSaving||!addDollarMahsulot||!addDollarSoni}
                  style={{width:30,height:30,borderRadius:8,border:"none",background:"#dcfce7",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#16a34a"}}>
                  {addDollarSaving?<span className="spinner" style={{width:12,height:12}}/>:<svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>}
                </button>
                <button onClick={()=>{setAddDollarOpen(false);setAddDollarMahsulot("");setAddDollarSoni("");setAddDollarNarx("");}}
                  style={{width:30,height:30,borderRadius:8,border:"none",background:"#fee2e2",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#ef4444"}}>
                  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            </div>
          )}
        </div>
        )}
        {savatSom.length===0&&savatDollar.length===0&&!addSomOpen&&!addDollarOpen&&(
          <div style={{marginTop:24,background:"var(--white)",borderRadius:"var(--radius-xl)",boxShadow:"var(--shadow-sm)",padding:"32px 20px",textAlign:"center"}}>
            <p style={{color:"var(--text-3)",fontSize:13,marginBottom:12}}>Savat bo&apos;sh</p>
            <button onClick={openAddItem} className="btn btn--primary">
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg> Mahsulot qo&apos;shish
            </button>
          </div>
        )}

      </div>

      {/* ── Edit/Add Modal ── */}
      {editOpen&&(
        <div style={{position:"fixed",inset:0,zIndex:50,background:"rgba(0,0,0,.45)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={()=>setEditOpen(false)}>
          <div style={{background:"var(--white)",borderRadius:16,width:"100%",maxWidth:900,maxHeight:"92vh",display:"flex",flexDirection:"column",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",gap:16,padding:"20px 24px",borderBottom:"1px solid var(--border)"}}>
              <div style={{flex:1}}>
                <h2 style={{fontSize:17,fontWeight:800,marginBottom:2}}>{isAddMode?"Mahsulot qo'shish":"Tahrirlash"}</h2>
                <p style={{fontSize:12,color:"var(--text-3)"}}>Sotuv #{sotuv.Sotuv_Raqami} — {mjNomi}</p>
              </div>
              <button onClick={()=>setEditOpen(false)} style={{width:36,height:36,borderRadius:8,border:"1px solid var(--border)",background:"var(--white)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"20px 24px"}}>
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
                    <input value={editIzoh} onChange={e=>setEditIzoh(e.target.value)} placeholder="Ixtiyoriy..."
                      style={{width:"100%",padding:"10px 12px",border:"1px solid var(--border)",borderRadius:"var(--radius)",fontSize:14,outline:"none",boxSizing:"border-box"}}/>
                  </div>
                </div>
              )}
              {/* Kurs + items */}
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                <span style={{fontSize:11,fontWeight:700,color:"var(--text-3)",letterSpacing:".05em",flex:1}}>MAHSULOTLAR</span>
                <label style={{fontSize:12,fontWeight:600,color:"var(--text-2)"}}>Kurs:</label>
                <input value={editKurs} onChange={e=>setEditKurs(e.target.value)} placeholder="12800" inputMode="numeric"
                  style={{width:100,padding:"6px 10px",border:"1px solid var(--border)",borderRadius:"var(--radius)",fontSize:13,fontWeight:600,outline:"none",textAlign:"center"}}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"3fr 90px 110px 110px 110px 36px",gap:8,padding:"6px 0",marginBottom:4}}>
                {["MAHSULOT","MIQDOR","NARX (so'm)","NARX ($)","JAMI",""].map(h=>(
                  <span key={h} style={{fontSize:10,fontWeight:700,color:"var(--text-3)",letterSpacing:".04em"}}>{h}</span>
                ))}
              </div>
              {editSavatItems.map(s=>{
                const jS=num(s.Soni)*num(s.Som_Narx), jU=num(s.Soni)*num(s.Narx);
                return (
                  <div key={s.id} style={{display:"grid",gridTemplateColumns:"3fr 90px 110px 110px 110px 36px",gap:8,alignItems:"center",marginBottom:8}}>
                    <SearchSelect items={mhItems} value={s.Mahsulot_ID} onChange={v=>updateItem(s.id,"Mahsulot_ID",v)} placeholder="Mahsulot..."/>
                    <input value={s.Soni} onChange={e=>updateItem(s.id,"Soni",e.target.value)} placeholder="Miqdor" style={{padding:"10px",border:"1px solid var(--border)",borderRadius:"var(--radius)",fontSize:13,fontWeight:600,outline:"none",textAlign:"center"}}/>
                    <input value={s.Som_Narx} onChange={e=>updateItem(s.id,"Som_Narx",e.target.value)} placeholder="Narx (so'm)" style={{padding:"10px",border:"1px solid var(--border)",borderRadius:"var(--radius)",fontSize:13,fontWeight:600,outline:"none",textAlign:"center"}}/>
                    <input value={s.Narx} onChange={e=>updateItem(s.id,"Narx",e.target.value)} placeholder="Narx ($)" style={{padding:"10px",border:"1px solid var(--border)",borderRadius:"var(--radius)",fontSize:13,fontWeight:600,outline:"none",textAlign:"center",color:"#2563eb"}}/>
                    <div style={{padding:"10px",background:"var(--bg)",borderRadius:"var(--radius)",fontSize:13,fontWeight:700,textAlign:"right"}}>
                      {num(s.Soni)!==0?(jS?jS.toLocaleString("ru-RU"):jU?"$"+jU.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2}):"—"):"—"}
                    </div>
                    <button onClick={()=>setEditSavatItems(p=>p.filter(r=>r.id!==s.id))} style={{width:36,height:40,borderRadius:8,border:"none",background:"#dbeafe",color:"#2563eb",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700}}>−</button>
                  </div>
                );
              })}
              <button onClick={()=>setEditSavatItems(p=>[...p,{id:uid(),Mahsulot_ID:"",Soni:"",Som_Narx:"",Narx:""}])} style={{display:"flex",alignItems:"center",gap:4,padding:"7px 14px",border:"1px solid var(--border)",borderRadius:8,fontSize:12,fontWeight:600,background:"var(--white)",cursor:"pointer",color:"var(--text-2)",marginTop:4}}>
                <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg> Qo&apos;shish
              </button>
              {(editJamiSom>0||editJamiDollar>0)&&(
                <div style={{display:"flex",justifyContent:"flex-end",gap:16,padding:"10px 14px",background:"var(--bg)",borderRadius:"var(--radius)",marginTop:8}}>
                  <span style={{fontSize:12,fontWeight:700,color:"var(--text-3)"}}>Jami:</span>
                  {editJamiSom>0&&<span style={{fontSize:14,fontWeight:700,color:"#16a34a"}}>{fmtSom(editJamiSom)}</span>}
                  {editJamiDollar>0&&<span style={{fontSize:14,fontWeight:700,color:"#2563eb"}}>{fmtUsd(editJamiDollar)}</span>}
                </div>
              )}
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:10,padding:"16px 24px",borderTop:"1px solid var(--border)"}}>
              <button className="btn btn--outline" onClick={()=>setEditOpen(false)}>Bekor</button>
              <button className="btn btn--primary" onClick={handleUpdate}
                disabled={editSaving||editSavatItems.filter(s=>s.Mahsulot_ID&&s.Soni&&(num(s.Som_Narx)||num(s.Narx))).length===0}>
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
                setMijozQarzSom(p=>p-num(row.Summa_som));
                await fetch("/api/sheets",{method:"DELETE",headers:{"Content-Type":"application/json"},
                  body:JSON.stringify({sheet:"Sotuv_Savat",idColumn:"Savat_ID",idValue:row.Savat_ID})});
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
                setMijozQarzDollar(p=>p-num(row.Summa));
                await fetch("/api/sheets",{method:"DELETE",headers:{"Content-Type":"application/json"},
                  body:JSON.stringify({sheet:"Sotuv_savat_dollar",idColumn:"Savat_ID",idValue:row.Savat_ID})});
              }}>O&apos;chirish</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Tolov Modal ── */}
      {addTolovOpen&&(
        <div style={{position:"fixed",inset:0,zIndex:50,background:"rgba(0,0,0,.45)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={()=>setAddTolovOpen(false)}>
          <div style={{background:"var(--white)",borderRadius:16,width:"100%",maxWidth:480,maxHeight:"90vh",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",gap:14,padding:"16px 20px",borderBottom:"1px solid var(--border)"}}>
              <div style={{width:38,height:38,borderRadius:10,background:"#f0fdf4",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <svg width="17" height="17" fill="none" stroke="#16a34a" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z"/></svg>
              </div>
              <div style={{flex:1}}>
                <h2 style={{fontSize:15,fontWeight:800}}>Yangi to&apos;lov</h2>
                <p style={{fontSize:11,color:"var(--text-3)",marginTop:1}}>{mjNomi} — Sotuv #{sotuv.Sotuv_Raqami}</p>
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
                <input value={addTolovIzoh} onChange={e=>setAddTolovIzoh(e.target.value)} placeholder="Ixtiyoriy..."
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
        <div style={{position:"fixed",inset:0,zIndex:50,background:"rgba(0,0,0,.45)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={()=>setEditTolov(null)}>
          <div style={{background:"var(--white)",borderRadius:16,width:"100%",maxWidth:480,maxHeight:"90vh",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 20px",borderBottom:"1px solid var(--border)"}}>
              <h2 style={{fontSize:15,fontWeight:800}}>To&apos;lovni tahrirlash</h2>
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
                <input value={editTolovIzoh} onChange={e=>setEditTolovIzoh(e.target.value)} placeholder="Ixtiyoriy..."
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
    </>
  );
}
