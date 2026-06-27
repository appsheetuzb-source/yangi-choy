"use client";

import { fetchSheets } from "@/lib/sheet-cache";
import { useAuth } from "@/lib/AuthContext";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

/* ── Interfaces ─────────────────────── */
interface Sotuv { Sotuv_ID: string; Yil: string; Oy: string; Sana: string; Mijoz_ID: string; Agent: string; Sotuv_Raqami: string; Vaqt: string; Chek?: string; }
interface SavatSom { Sotuv_ID: string; Mahsulot_ID: string; Soni: string; Summa_som: string; }
interface SavatDol { Sotuv_ID: string; Mahsulot_ID: string; Soni: string; Summa: string; }
interface STolov { Tolov_ID: string; Agent: string; Mijoz_ID: string; Yil: string; Oy: string; Sana: string; Summa: string; Summa_dollar: string; Vaqt: string; }
interface XTolov { Gazna_ID: string; Gazna_dollar_ID: string; Sana: string; Summa: string; Summa_dollar: string; }
interface Xarajat { Gazna_ID: string; Gazna_dollar_ID: string; Sana: string; Som: string; Dollar: string; }
interface Mahsulot { Mahsulot_ID: string; Nomi: string; Tan_som: string; Tan_dollar: string; Kg: string; }
interface Mijoz { Mijoz_ID: string; Ism: string; Agent: string; Boshlangich_Balans_som?: string; Boshlangich_Balans_dollar?: string; }
interface Gazna { Gazna_ID: string; Nomi: string; Turi: string; Boshlangich_balans: string; }
interface Foydalanuvchi { Foydalanuvchi_ID: string; Nomi: string; Gazna_ID: string; }

const OY = ["Yan","Fev","Mar","Apr","May","Iyn","Iyl","Avg","Sen","Okt","Noy","Dek"];

function num(v: string|number|undefined) { return parseFloat(String(v||"0").replace(/\s/g,"").replace(",",".")) || 0; }
function fmtS(v: number) { return v ? v.toLocaleString("ru-RU") : "0"; }
function fmtU(v: number) { return v ? "$"+v.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2}) : "$0"; }
function today() {
  const t = new Date(new Date().toLocaleString("en-US",{timeZone:"Asia/Tashkent"}));
  const pad=(n:number)=>String(n).padStart(2,"0");
  return { sana:`${pad(t.getDate())}.${pad(t.getMonth()+1)}.${t.getFullYear()}`, oy:String(t.getMonth()+1), yil:String(t.getFullYear()), soat:t.getHours() };
}
function todayISO() {
  const t = new Date(new Date().toLocaleString("en-US",{timeZone:"Asia/Tashkent"}));
  return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`;
}
function monthStartISO() {
  const t = new Date(new Date().toLocaleString("en-US",{timeZone:"Asia/Tashkent"}));
  return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-01`;
}
function parseSana(s: string): Date | null {
  if (!s || !s.includes(".")) return null;
  const [dd, mm, yyyy] = s.split(".");
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
}
function inRange(sana: string, from: string, to: string): boolean {
  const d = parseSana(sana);
  if (!d) return false;
  if (from) { const f = new Date(from); f.setHours(0,0,0,0); if (d < f) return false; }
  if (to)   { const e = new Date(to);   e.setHours(23,59,59,999); if (d > e) return false; }
  return true;
}

interface TipP { color?: string; name?: string|number; value?: string|number; }
function ChartTip({ active, payload, label }: { active?: boolean; payload?: TipP[]; label?: string|number }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"var(--white)", border:"1px solid var(--border)", borderRadius:10, padding:"10px 14px", boxShadow:"0 8px 28px rgba(30,64,124,.18)" }}>
      <p style={{ fontSize:12, fontWeight:700, marginBottom:6, color:"var(--text)" }}>{label}</p>
      {payload.map((p,i)=>(<p key={i} style={{ fontSize:12, color:p.color, fontWeight:600 }}>{p.name}: {fmtS(Number(p.value))}</p>))}
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const isSotuvchi = user?.lavozim === "Sotuvchi";

  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [dateFrom, setDateFrom] = useState(monthStartISO());
  const [dateTo, setDateTo]     = useState(todayISO());

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check(); window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  const [sotuvlar, setSotuvlar]   = useState<Sotuv[]>([]);
  const [savatS, setSavatS]       = useState<SavatSom[]>([]);
  const [savatD, setSavatD]       = useState<SavatDol[]>([]);
  const [tolovlar, setTolovlar]   = useState<STolov[]>([]);
  const [xtolov, setXtolov]       = useState<XTolov[]>([]);
  const [mahsulotlar, setMahsulotlar] = useState<Mahsulot[]>([]);
  const [mijozlar, setMijozlar]   = useState<Mijoz[]>([]);
  const [gaznalar, setGaznalar]   = useState<Gazna[]>([]);
  const [xarajatlar, setXarajatlar] = useState<Xarajat[]>([]);
  const [myGaznaIds, setMyGaznaIds] = useState<string[]>([]);

  useEffect(() => {
    // Faza 1 — yengil sheet'lar (dashboard DARHOL ko'rinadi)
    fetchSheets(["Sotuv","Mijozlar","Gazna","Mahsulot","Foydalanuvchi"])
    .then(r=>{
      setSotuvlar(r["Sotuv"]?.data||[]); setMahsulotlar(r["Mahsulot"]?.data||[]);
      setMijozlar(r["Mijozlar"]?.data||[]); setGaznalar(r["Gazna"]?.data||[]);
      const me = (r["Foydalanuvchi"]?.data as Foydalanuvchi[]||[]).find(u=>u.Foydalanuvchi_ID===user?.id);
      setMyGaznaIds((me?.Gazna_ID||"").split(",").map(x=>x.trim()).filter(Boolean));
    }).finally(()=>{
      setLoading(false);
      // Faza 2 — og'ir savat/to'lov/xarajat FONDA (KPI/grafik ~1-2s da to'ladi)
      fetchSheets(["Sotuv_Savat","Sotuv_Savat_Dollar","S_tolov","X_tolov","Xarajat"]).then(r=>{
        setSavatS(r["Sotuv_Savat"]?.data||[]); setSavatD(r["Sotuv_Savat_Dollar"]?.data||[]);
        setTolovlar(r["S_tolov"]?.data||[]); setXtolov(r["X_tolov"]?.data||[]); setXarajatlar(r["Xarajat"]?.data||[]);
      }).catch(()=>{});
    });
  }, [user]);

  const t = today();

  const sotuvMap = useMemo(()=>{ const m:Record<string,Sotuv>={}; sotuvlar.forEach(s=>{m[s.Sotuv_ID]=s;}); return m; },[sotuvlar]);
  const mahMap   = useMemo(()=>{ const m:Record<string,Mahsulot>={}; mahsulotlar.forEach(x=>{m[x.Mahsulot_ID]=x;}); return m; },[mahsulotlar]);
  const mijMap   = useMemo(()=>{ const m:Record<string,string>={}; mijozlar.forEach(x=>{m[x.Mijoz_ID]=x.Ism;}); return m; },[mijozlar]);
  function getMijozNomi(s?: Sotuv) { if(!s) return "Mijoz"; const raw=s.Mijoz_ID||""; const id=raw.includes(".")?raw.split(".")[1]:raw; return mijMap[id]||mijMap[raw]||"Mijoz"; }

  // Role-aware sotuv filter
  const mySotuvlar = useMemo(()=> isSotuvchi && user?.id ? sotuvlar.filter(s=>s.Agent===user.id) : sotuvlar, [sotuvlar, isSotuvchi, user]);
  const mySotuvIds = useMemo(()=> new Set(mySotuvlar.map(s=>s.Sotuv_ID)), [mySotuvlar]);
  const myTolovlar = useMemo(()=> isSotuvchi && user?.id ? tolovlar.filter(t=>t.Agent===user.id) : tolovlar, [tolovlar, isSotuvchi, user]);

  // ── Metrics (sana oralig'i bo'yicha) ──
  const stats = useMemo(()=>{
    let oySom=0, oyDollar=0, oyFoyda=0;
    const inR=(id:string)=>{ const s=sotuvMap[id]; return s && inRange(s.Sana, dateFrom, dateTo); };

    savatS.forEach(r=>{
      if(isSotuvchi && !mySotuvIds.has(r.Sotuv_ID)) return;
      if(inR(r.Sotuv_ID)) { const summa=num(r.Summa_som); oySom+=summa; oyFoyda += summa - num(mahMap[r.Mahsulot_ID]?.Tan_som)*num(r.Soni); }
    });
    let oyFoydaDollar=0;
    savatD.forEach(r=>{
      if(isSotuvchi && !mySotuvIds.has(r.Sotuv_ID)) return;
      if(inR(r.Sotuv_ID)) { oyDollar+=num(r.Summa); oyFoydaDollar += num(r.Summa) - num(mahMap[r.Mahsulot_ID]?.Tan_dollar)*num(r.Soni); }
    });
    const oyTolovSom = myTolovlar.filter(x=>inRange(x.Sana, dateFrom, dateTo)).reduce((a,x)=>a+num(x.Summa),0);
    const oyTolovDollar = myTolovlar.filter(x=>inRange(x.Sana, dateFrom, dateTo)).reduce((a,x)=>a+num(x.Summa_dollar),0);

    // Gazna balans
    // Gazna joriy balans = boshlangich + kirim(S_tolov) - chiqim(X_tolov + Xarajat)
    const gaznaList = user?.lavozim==="Admin" ? gaznalar : gaznalar.filter(g=>myGaznaIds.includes(g.Gazna_ID));
    let gaznaSom=0, gaznaDollar=0;
    gaznaList.forEach(g=>{
      const isD = g.Turi==="Dollar";
      const kir = isD
        ? tolovlar.reduce((a,x)=> a + ((x as STolov & {Gazna_dollar_ID?:string}).Gazna_dollar_ID===g.Gazna_ID ? num(x.Summa_dollar):0),0)
        : tolovlar.reduce((a,x)=> a + ((x as STolov & {Gazna_ID?:string}).Gazna_ID===g.Gazna_ID ? num(x.Summa):0),0);
      const chiqTolov = isD
        ? xtolov.reduce((a,x)=> a + (x.Gazna_dollar_ID===g.Gazna_ID ? num(x.Summa_dollar):0),0)
        : xtolov.reduce((a,x)=> a + (x.Gazna_ID===g.Gazna_ID ? num(x.Summa):0),0);
      const chiqXarajat = isD
        ? xarajatlar.reduce((a,x)=> a + (x.Gazna_dollar_ID===g.Gazna_ID ? num(x.Dollar):0),0)
        : xarajatlar.reduce((a,x)=> a + (x.Gazna_ID===g.Gazna_ID ? num(x.Som):0),0);
      const joriy = num(g.Boshlangich_balans) + kir - chiqTolov - chiqXarajat;
      if(isD) gaznaDollar+=joriy; else gaznaSom+=joriy;
    });

    // ── Qarzdorlik (joriy, davrga bog'liq emas): boshlangich + jami sotuv - jami to'lov ──
    // Faqat ko'rinadigan mijozlar bo'yicha
    const visibleMijoz = isSotuvchi && user?.id ? mijozlar.filter(m=>m.Agent===user.id) : mijozlar;
    const visMijIds = new Set(visibleMijoz.map(m=>m.Mijoz_ID));
    let qarzSom = 0, qarzDollar = 0;
    visibleMijoz.forEach(m=>{ qarzSom += num(m.Boshlangich_Balans_som); qarzDollar += num(m.Boshlangich_Balans_dollar); });
    const tasdiq=(s?:Sotuv)=>!!s && String(s.Chek||"").trim()!=="";
    savatS.forEach(r=>{ const s=sotuvMap[r.Sotuv_ID]; if(tasdiq(s) && visMijIds.has((s!.Mijoz_ID||"").includes(".")?s!.Mijoz_ID.split(".")[1]:s!.Mijoz_ID)) qarzSom += num(r.Summa_som); });
    savatD.forEach(r=>{ const s=sotuvMap[r.Sotuv_ID]; if(tasdiq(s) && visMijIds.has((s!.Mijoz_ID||"").includes(".")?s!.Mijoz_ID.split(".")[1]:s!.Mijoz_ID)) qarzDollar += num(r.Summa); });
    myTolovlar.forEach(x=>{ qarzSom -= num(x.Summa); qarzDollar -= num(x.Summa_dollar); });

    return { oySom, oyDollar, oyFoyda, oyFoydaDollar, oyTolovSom, oyTolovDollar, gaznaSom, gaznaDollar, qarzSom, qarzDollar };
  },[savatS, savatD, sotuvMap, mahMap, myTolovlar, tolovlar, xtolov, xarajatlar, gaznalar, myGaznaIds, mijozlar, isSotuvchi, user, mySotuvIds, dateFrom, dateTo]);

  // ── Chart: tanlangan davrga moslashadi (qisqa davr → kunlik, uzun → oylik) ──
  const { chartData, chartMode } = useMemo(()=>{
    const from = new Date(dateFrom); const to = new Date(dateTo);
    const diffDays = (to.getTime() - from.getTime()) / 86400000;
    const daily = diffDays <= 45;
    const buckets: Record<string, { label:string; sotuv:number; order:string }> = {};
    savatS.forEach(r=>{
      if(isSotuvchi && !mySotuvIds.has(r.Sotuv_ID)) return;
      const s=sotuvMap[r.Sotuv_ID]; if(!s) return;
      const d = parseSana(s.Sana); if(!d || !inRange(s.Sana, dateFrom, dateTo)) return;
      const pad=(n:number)=>String(n).padStart(2,"0");
      let key:string, label:string, order:string;
      if(daily){ key=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; label=`${pad(d.getDate())}.${pad(d.getMonth()+1)}`; order=key; }
      else { key=`${d.getFullYear()}-${pad(d.getMonth()+1)}`; label=`${OY[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`; order=key; }
      if(!buckets[key]) buckets[key]={ label, sotuv:0, order };
      buckets[key].sotuv += num(r.Summa_som);
    });
    return { chartData: Object.values(buckets).sort((a,b)=>a.order.localeCompare(b.order)), chartMode: daily?"kunlik":"oylik" };
  },[savatS, sotuvMap, isSotuvchi, mySotuvIds, dateFrom, dateTo]);

  // ── Top mijoz / mahsulot (davr bo'yicha) ──
  const { topMijoz, topMahsulot } = useMemo(()=>{
    const mj: Record<string, { nomi:string; summa:number }> = {};
    const mh: Record<string, { id:string; nomi:string; kg:number }> = {};
    const addMj=(s:Sotuv|undefined, som:number, dol:number)=>{
      if(!s) return; const raw=s.Mijoz_ID||""; const id=raw.includes(".")?raw.split(".")[1]:raw;
      if(!mj[id]) mj[id]={ nomi: mijMap[id]||mijMap[raw]||"Mijoz", summa:0 };
      mj[id].summa += som + dol*12000;
    };
    savatS.forEach(r=>{
      if(isSotuvchi && !mySotuvIds.has(r.Sotuv_ID)) return;
      const s=sotuvMap[r.Sotuv_ID]; if(!s||!inRange(s.Sana, dateFrom, dateTo)) return;
      addMj(s, num(r.Summa_som), 0);
      if(!mh[r.Mahsulot_ID]) mh[r.Mahsulot_ID]={ id:r.Mahsulot_ID, nomi: mahMap[r.Mahsulot_ID]?.Nomi||"?", kg:0 };
      mh[r.Mahsulot_ID].kg += num(r.Soni);
    });
    savatD.forEach(r=>{
      if(isSotuvchi && !mySotuvIds.has(r.Sotuv_ID)) return;
      const s=sotuvMap[r.Sotuv_ID]; if(!s||!inRange(s.Sana, dateFrom, dateTo)) return;
      addMj(s, 0, num(r.Summa));
      if(!mh[r.Mahsulot_ID]) mh[r.Mahsulot_ID]={ id:r.Mahsulot_ID, nomi: mahMap[r.Mahsulot_ID]?.Nomi||"?", kg:0 };
      mh[r.Mahsulot_ID].kg += num(r.Soni);
    });
    return {
      topMijoz: Object.values(mj).sort((a,b)=>b.summa-a.summa).slice(0,5),
      topMahsulot: Object.values(mh).sort((a,b)=>b.kg-a.kg).slice(0,5),
    };
  },[savatS, savatD, sotuvMap, mahMap, mijMap, isSotuvchi, mySotuvIds, dateFrom, dateTo]);

  // ── Oxirgi sotuvlar ──
  const recentSotuv = useMemo(()=>{
    const key=(s:Sotuv)=> (s.Sana?.split(".").reverse().join("")||"")+(s.Vaqt||"");
    return [...mySotuvlar].filter(s=>s.Sotuv_ID).sort((a,b)=>key(b).localeCompare(key(a))).slice(0,6);
  },[mySotuvlar]);

  const recentTolov = useMemo(()=>{
    const key=(x:STolov)=> (x.Sana?.split(".").reverse().join("")||"")+(x.Vaqt||"");
    return [...myTolovlar].filter(x=>x.Tolov_ID).sort((a,b)=>key(b).localeCompare(key(a))).slice(0,6);
  },[myTolovlar]);

  // Sotuv_ID -> jami summa xaritasi (har chaqiruvda 23k qatorni filter qilmaslik uchun)
  const sotuvSumMap  = useMemo(()=>{ const m:Record<string,number>={}; savatS.forEach(r=>{ const k=r.Sotuv_ID; m[k]=(m[k]||0)+num(r.Summa_som); }); return m; },[savatS]);
  const sotuvSumMapD = useMemo(()=>{ const m:Record<string,number>={}; savatD.forEach(r=>{ const k=r.Sotuv_ID; m[k]=(m[k]||0)+num(r.Summa); }); return m; },[savatD]);
  const sotuvSumma  = (id:string)=> sotuvSumMap[id]||0;
  const sotuvSummaD = (id:string)=> sotuvSumMapD[id]||0;

  const salom = t.soat<12 ? "Xayrli tong" : t.soat<18 ? "Xayrli kun" : "Xayrli kech";

  if (loading) return (
    <div className="page-content" style={{ display:"flex", justifyContent:"center", paddingTop:80 }}><div className="spinner--page"/></div>
  );

  const navCards = [
    { href:"/sotuv", label:"Sotuvlar", color:"#3fb950", bg:"var(--green-bg)", icon:<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg> },
    { href:"/sotuv/tolov", label:"To'lovlar", color:"#d97706", bg:"var(--orange-bg)", icon:<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg> },
    { href:"/mijozlar", label:"Mijozlar", color:"#58a6ff", bg:"var(--blue-bg)", icon:<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg> },
    { href:"/gazna", label:"Gazna", color:"#bc8cff", bg:"var(--purple-bg)", icon:<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg> },
  ];

  return (
    <>
      <header className="header">
        <div className="header__inner">
          <h1 className="header__title">Bosh sahifa</h1>
          <div className="header__spacer" />
          <span style={{ fontSize:13, color:"var(--text-3)", fontWeight:600 }}>{t.sana}</span>
        </div>
      </header>

      <div className="page-content">
        {/* Greeting */}
        <div style={{ marginBottom:24 }}>
          <h2 style={{ fontSize:24, fontWeight:800, color:"var(--text)", letterSpacing:"-.02em" }}>
            {salom}, {user?.nomi?.split(" ")[0] || "Foydalanuvchi"}! 👋
          </h2>
          <p style={{ fontSize:14, color:"var(--text-2)", marginTop:4 }}>
            {isSotuvchi ? "Tanlangan davr bo'yicha shaxsiy ko'rsatkichlaringiz" : "Tanlangan davr bo'yicha umumiy ko'rsatkichlar"}
          </p>
        </div>

        {/* Date filter */}
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:18, flexWrap:"wrap" }}>
          <span style={{ fontSize:12, fontWeight:700, color:"var(--text-2)" }}>Davr:</span>
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
            style={{ fontSize:13, border:"1px solid var(--border-2)", borderRadius:8, padding:"6px 10px", background:"var(--white)", color:"var(--text)", cursor:"pointer", width:"auto" }}/>
          <span style={{ color:"var(--text-3)" }}>—</span>
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
            style={{ fontSize:13, border:"1px solid var(--border-2)", borderRadius:8, padding:"6px 10px", background:"var(--white)", color:"var(--text)", cursor:"pointer", width:"auto" }}/>
          {/* Tezkor tugmalar */}
          {[
            { l:"Bugun", f:todayISO(), t:todayISO() },
            { l:"Shu oy", f:monthStartISO(), t:todayISO() },
            { l:"Shu yil", f:`${today().yil}-01-01`, t:todayISO() },
          ].map(b=>(
            <button key={b.l} onClick={()=>{ setDateFrom(b.f); setDateTo(b.t); }} style={{
              padding:"5px 12px", borderRadius:20, fontSize:11, fontWeight:700, cursor:"pointer",
              border:`1.5px solid ${dateFrom===b.f && dateTo===b.t ? "var(--primary)" : "var(--border)"}`,
              background: dateFrom===b.f && dateTo===b.t ? "var(--primary-glow)" : "transparent",
              color: dateFrom===b.f && dateTo===b.t ? "var(--primary)" : "var(--text-3)",
            }}>{b.l}</button>
          ))}
        </div>

        {/* KPI cards */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(220px, 1fr))", gap:14, marginBottom:24 }}>
          {[
            { label:"DAVR SOTUV (SO'M)", value:`${fmtS(stats.oySom)} so'm`, color:"#3fb950", bg:"var(--green-bg)",
              icon:<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg> },
            { label:"DAVR SOTUV ($)", value:fmtU(stats.oyDollar), color:"#58a6ff", bg:"var(--blue-bg)",
              icon:<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> },
            { label:"DAVR FOYDA", value:`${fmtS(stats.oyFoyda)} so'm`, sub: stats.oyFoydaDollar?fmtU(stats.oyFoydaDollar):undefined, color: stats.oyFoyda>=0?"#3fb950":"#f85149", bg: stats.oyFoyda>=0?"var(--green-bg)":"var(--red-bg)",
              icon:<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg> },
            { label:"DAVR TO'LOV", value:`${fmtS(stats.oyTolovSom)} so'm`, sub: stats.oyTolovDollar?fmtU(stats.oyTolovDollar):undefined, color:"#d97706", bg:"var(--orange-bg)",
              icon:<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg> },
            { label: isSotuvchi?"MENING GAZNAM (SO'M)":"GAZNA (SO'M)", value:`${fmtS(stats.gaznaSom)} so'm`, sub: stats.gaznaDollar?fmtU(stats.gaznaDollar):undefined, color:"#bc8cff", bg:"var(--purple-bg)",
              icon:<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg> },
            { label:"JAMI QARZDORLIK (SO'M)", value:`${fmtS(stats.qarzSom)} so'm`, sub: stats.qarzDollar?fmtU(stats.qarzDollar):undefined, color: stats.qarzSom>0?"#f85149":"#3fb950", bg:"var(--red-bg)",
              icon:<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> },
            { label:"MIJOZLAR", value:`${(isSotuvchi&&user?.id ? mijozlar.filter(m=>m.Agent===user.id):mijozlar).length} ta`, color:"#0891b2", bg:"rgba(8,145,178,.12)",
              icon:<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg> },
          ].map(c=>(
            <div key={c.label} style={{ background:"var(--white)", border:"1px solid var(--border)", borderRadius:"var(--radius-xl)", padding:"18px 20px", boxShadow:"var(--shadow-sm)" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
                <span style={{ fontSize:10, fontWeight:700, color:"var(--text-3)", letterSpacing:".06em" }}>{c.label}</span>
                <span style={{ width:32, height:32, borderRadius:9, background:c.bg, display:"flex", alignItems:"center", justifyContent:"center", color:c.color }}>{c.icon}</span>
              </div>
              <p style={{ fontSize:19, fontWeight:800, color:c.color, lineHeight:1.1 }}>{c.value}</p>
              {c.sub && <p style={{ fontSize:12, fontWeight:700, color:"#58a6ff", marginTop:4 }}>{c.sub}</p>}
            </div>
          ))}
        </div>

        {/* Chart */}
        <div style={{ background:"var(--white)", border:"1px solid var(--border)", borderRadius:"var(--radius-xl)", boxShadow:"var(--shadow-sm)", marginBottom:24, overflow:"hidden" }}>
          <div style={{ padding:"16px 20px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <p style={{ fontSize:14, fontWeight:700, color:"var(--text)" }}>Sotuv dinamikasi ({chartMode}, so&apos;m)</p>
          </div>
          <div style={{ padding:20 }}>
            {chartData.length === 0 ? (
              <p style={{ textAlign:"center", color:"var(--text-3)", fontSize:13, padding:"40px 0" }}>Tanlangan davrda sotuv yo&apos;q</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top:5, right:10, left:10, bottom:5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                  <XAxis dataKey="label" tick={{ fontSize:11, fill:"var(--text-3)" }}/>
                  <YAxis tick={{ fontSize:10, fill:"var(--text-3)" }} tickFormatter={v=> v>=1e6?(v/1e6).toFixed(1)+"M": v>=1e3?(v/1e3).toFixed(0)+"K":v}/>
                  <Tooltip content={<ChartTip/>} cursor={{ fill:"rgba(47,129,247,.08)" }}/>
                  <Bar dataKey="sotuv" name="Sotuv" fill="#2f81f7" radius={[6,6,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top mijoz / mahsulot (davr) */}
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:isMobile?14:20, marginBottom:24 }}>
          <div style={{ background:"var(--white)", border:"1px solid var(--border)", borderRadius:"var(--radius-xl)", boxShadow:"var(--shadow-sm)", overflow:"hidden" }}>
            <div style={{ padding:"14px 18px", borderBottom:"1px solid var(--border)" }}>
              <p style={{ fontSize:14, fontWeight:700 }}>🏆 Eng faol mijozlar</p>
            </div>
            <div style={{ padding:"6px 0" }}>
              {topMijoz.length===0 ? <p style={{ padding:"20px", textAlign:"center", color:"var(--text-3)", fontSize:13 }}>Ma&apos;lumot yo&apos;q</p> :
                topMijoz.map((m,i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 18px" }}>
                    <span style={{ width:22, height:22, borderRadius:"50%", background: i===0?"#d97706":"var(--bg-2)", color: i===0?"#fff":"var(--text-2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, flexShrink:0 }}>{i+1}</span>
                    <span style={{ flex:1, fontSize:13, fontWeight:600, color:"var(--text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{m.nomi}</span>
                    <span style={{ fontSize:12, fontWeight:700, color:"#3fb950" }}>{fmtS(Math.round(m.summa))}</span>
                  </div>
                ))}
            </div>
          </div>
          <div style={{ background:"var(--white)", border:"1px solid var(--border)", borderRadius:"var(--radius-xl)", boxShadow:"var(--shadow-sm)", overflow:"hidden" }}>
            <div style={{ padding:"14px 18px", borderBottom:"1px solid var(--border)" }}>
              <p style={{ fontSize:14, fontWeight:700 }}>📦 Eng ko&apos;p sotilgan mahsulot</p>
            </div>
            <div style={{ padding:"6px 0" }}>
              {topMahsulot.length===0 ? <p style={{ padding:"20px", textAlign:"center", color:"var(--text-3)", fontSize:13 }}>Ma&apos;lumot yo&apos;q</p> :
                topMahsulot.map((m,i)=>(
                  <div key={m.id||i} onClick={()=>router.push(`/mahsulot/${m.id}`)}
                    style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 18px", cursor:"pointer" }}
                    onMouseEnter={e=>e.currentTarget.style.background="var(--bg-2)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <span style={{ width:22, height:22, borderRadius:"50%", background: i===0?"#3fb950":"var(--bg-2)", color: i===0?"#fff":"var(--text-2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, flexShrink:0 }}>{i+1}</span>
                    <span style={{ flex:1, fontSize:13, fontWeight:600, color:"var(--text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{m.nomi}</span>
                    <span style={{ fontSize:12, fontWeight:700, color:"#58a6ff" }}>{fmtS(m.kg)} kg</span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Recent activity */}
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:isMobile?14:20, marginBottom:24 }}>
          {/* Recent sotuv */}
          <div style={{ background:"var(--white)", border:"1px solid var(--border)", borderRadius:"var(--radius-xl)", boxShadow:"var(--shadow-sm)", overflow:"hidden" }}>
            <div style={{ padding:"14px 18px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <p style={{ fontSize:14, fontWeight:700 }}>Oxirgi sotuvlar</p>
              <button onClick={()=>router.push("/sotuv")} style={{ fontSize:12, fontWeight:600, color:"var(--primary)", cursor:"pointer", background:"none" }}>Barchasi →</button>
            </div>
            <div>
              {recentSotuv.length===0 ? <p style={{ padding:"24px", textAlign:"center", color:"var(--text-3)", fontSize:13 }}>Sotuv yo&apos;q</p> :
                recentSotuv.map((s,i)=>{
                  const som=sotuvSumma(s.Sotuv_ID), dol=sotuvSummaD(s.Sotuv_ID);
                  return (
                    <div key={s.Sotuv_ID||i} onClick={()=>router.push(`/sotuv/${s.Sotuv_ID}`)}
                      style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 18px", borderBottom:i<recentSotuv.length-1?"1px solid var(--border)":"none", cursor:"pointer" }}
                      onMouseEnter={e=>e.currentTarget.style.background="var(--bg-2)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <div style={{ width:32, height:32, borderRadius:9, background:"var(--green-bg)", color:"#3fb950", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:13, fontWeight:800 }}>#{s.Sotuv_Raqami||"—"}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontSize:13, fontWeight:600, color:"var(--text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{getMijozNomi(s)}</p>
                        <p style={{ fontSize:11, color:"var(--text-3)" }}>{s.Sana}</p>
                      </div>
                      <div style={{ textAlign:"right", flexShrink:0 }}>
                        {som>0 && <p style={{ fontSize:13, fontWeight:800, color:"#3fb950" }}>{fmtS(som)}</p>}
                        {dol>0 && <p style={{ fontSize:12, fontWeight:700, color:"#58a6ff" }}>{fmtU(dol)}</p>}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Recent tolov */}
          <div style={{ background:"var(--white)", border:"1px solid var(--border)", borderRadius:"var(--radius-xl)", boxShadow:"var(--shadow-sm)", overflow:"hidden" }}>
            <div style={{ padding:"14px 18px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <p style={{ fontSize:14, fontWeight:700 }}>Oxirgi to&apos;lovlar</p>
              <button onClick={()=>router.push("/sotuv/tolov")} style={{ fontSize:12, fontWeight:600, color:"var(--primary)", cursor:"pointer", background:"none" }}>Barchasi →</button>
            </div>
            <div>
              {recentTolov.length===0 ? <p style={{ padding:"24px", textAlign:"center", color:"var(--text-3)", fontSize:13 }}>To&apos;lov yo&apos;q</p> :
                recentTolov.map((x,i)=>{
                  const som=num(x.Summa), dol=num(x.Summa_dollar);
                  const raw=x.Mijoz_ID||""; const mid=raw.includes(".")?raw.split(".")[1]:raw;
                  return (
                    <div key={x.Tolov_ID||i} onClick={()=>router.push(`/sotuv/tolov/${x.Tolov_ID}`)}
                      style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 18px", borderBottom:i<recentTolov.length-1?"1px solid var(--border)":"none", cursor:"pointer" }}
                      onMouseEnter={e=>e.currentTarget.style.background="var(--bg-2)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <div style={{ width:32, height:32, borderRadius:9, background:"var(--orange-bg)", color:"#d97706", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                        <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z"/></svg>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontSize:13, fontWeight:600, color:"var(--text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{mijMap[mid]||mijMap[raw]||"Mijoz"}</p>
                        <p style={{ fontSize:11, color:"var(--text-3)" }}>{x.Sana}</p>
                      </div>
                      <div style={{ textAlign:"right", flexShrink:0 }}>
                        {som>0 && <p style={{ fontSize:13, fontWeight:800, color:"#d97706" }}>{fmtS(som)}</p>}
                        {dol>0 && <p style={{ fontSize:12, fontWeight:700, color:"#58a6ff" }}>{fmtU(dol)}</p>}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Quick nav */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(160px, 1fr))", gap:14 }}>
          {navCards.map(c=>(
            <button key={c.href} onClick={()=>router.push(c.href)} style={{
              background:"var(--white)", border:"1px solid var(--border)", borderRadius:"var(--radius-xl)",
              padding:"20px", cursor:"pointer", display:"flex", flexDirection:"column", gap:10, alignItems:"flex-start",
              transition:"all .18s", boxShadow:"var(--shadow-sm)",
            }}
            onMouseEnter={e=>{ e.currentTarget.style.transform="translateY(-3px)"; e.currentTarget.style.boxShadow="var(--shadow)"; e.currentTarget.style.borderColor="var(--border-2)"; }}
            onMouseLeave={e=>{ e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="var(--shadow-sm)"; e.currentTarget.style.borderColor="var(--border)"; }}>
              <span style={{ width:42, height:42, borderRadius:12, background:c.bg, color:c.color, display:"flex", alignItems:"center", justifyContent:"center" }}>{c.icon}</span>
              <span style={{ fontSize:14, fontWeight:700, color:"var(--text)" }}>{c.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
