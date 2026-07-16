// Sotuv 80mm chekini PDF qilib YUKLAB beradi (Print Label ilovasida ochish uchun).
// MUHIM: bu funksiya foydalanuvchi tugma bosgan paytda (gesture) chaqirilishi kerak —
// aks holda brauzer avtomatik yuklashni bloklaydi.

interface SavatSom { Mahsulot_ID: string; Soni: string; Som_Narx: string; Summa_som: string }
interface SavatDollar { Mahsulot_ID: string; Soni: string; Narx: string; Summa: string }

export interface SotuvChekData {
  id: string;
  sana: string; agent: string; mijozIsm: string; mijozTel: string;
  savatSom: SavatSom[]; savatDollar: SavatDollar[];
  mMap: Record<string, { Nomi: string }>;
  totalSom: number; totalDollar: number; tolovSom: number; tolovDollar: number;
}

const num = (v: string|number|undefined) => parseFloat(String(v||"0").replace(/\s/g,"").replace(",",".")) || 0;
const fmtSom  = (v: number) => v.toLocaleString("ru-RU");
const fmtUsd  = (v: number) => "$" + v.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtSoni = (v: number) => v.toLocaleString("ru-RU",{minimumFractionDigits:1,maximumFractionDigits:2});
const esc = (s: string) => String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

const TH = "border:1px solid #000;padding:3px 4px;font-size:12px;font-weight:800;font-style:italic;text-align:center;";
const TD = "border:1px solid #000;padding:3px 4px;font-size:12px;font-weight:700;";
const BOX = "border:1px solid #000;border-top:none;padding:3px 6px;font-size:12.5px;font-weight:700;";

function tableHtml(title: string, rows: string, jami: string): string {
  return `<table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
    <thead><tr>
      <th style="${TH}text-align:left;">${title}</th>
      <th style="${TH}width:40px;">Soni</th>
      <th style="${TH}width:64px;">Narxi</th>
      <th style="${TH}width:72px;">Summa</th>
    </tr></thead>
    <tbody>${rows}
      <tr><td colspan="3" style="${TD}text-align:right;font-weight:800;">Jami:</td>
      <td style="${TD}text-align:right;font-weight:900;">${jami}</td></tr>
    </tbody></table>`;
}

function boxHtml(eski: string, tolov: string, yangi: string, usd: boolean): string {
  const suf = usd ? " ($)" : "";
  return `<div style="margin-bottom:10px;">
    <div style="${BOX}border-top:1px solid #000;">Eski qarzdorlik${suf}: ${eski}</div>
    <div style="${BOX}">To&#39;lovlar${suf}: ${tolov}</div>
    <div style="${BOX}font-weight:900;">Yangi qarzdorlik${suf}: ${yangi}</div>
  </div>`;
}

export async function printSotuvChek(d: SotuvChekData): Promise<void> {
  const thisSom    = d.savatSom.reduce((s,r)=>s+num(r.Summa_som),0);
  const thisDollar = d.savatDollar.reduce((s,r)=>s+num(r.Summa),0);
  const yangiSom = d.totalSom + thisSom - d.tolovSom;
  const yangiUsd = d.totalDollar + thisDollar - d.tolovDollar;
  const hasSom = d.savatSom.length>0, hasDollar = d.savatDollar.length>0;
  const showSom = hasSom || d.totalSom!==0 || d.tolovSom!==0;
  const showDollar = hasDollar || d.totalDollar!==0 || d.tolovDollar!==0;

  const somRows = d.savatSom.map(r=>`<tr>
    <td style="${TD}text-align:left;">${esc(d.mMap[r.Mahsulot_ID]?.Nomi||r.Mahsulot_ID)}</td>
    <td style="${TD}text-align:center;">${fmtSoni(num(r.Soni))}</td>
    <td style="${TD}text-align:right;">${fmtSom(num(r.Som_Narx))}</td>
    <td style="${TD}text-align:right;">${fmtSom(num(r.Summa_som))}</td></tr>`).join("");
  const dolRows = d.savatDollar.map(r=>`<tr>
    <td style="${TD}text-align:left;">${esc(d.mMap[r.Mahsulot_ID]?.Nomi||r.Mahsulot_ID)}</td>
    <td style="${TD}text-align:center;">${fmtSoni(num(r.Soni))}</td>
    <td style="${TD}text-align:right;">${fmtUsd(num(r.Narx))}</td>
    <td style="${TD}text-align:right;">${fmtUsd(num(r.Summa))}</td></tr>`).join("");

  const html =
    `<div style="text-align:center;margin-bottom:6px;">
       <div style="font-size:21px;font-weight:900;letter-spacing:1px;">MUSAFFO TEA</div>
       <div style="font-size:11px;font-weight:700;">Sotuv cheki</div>
     </div>
     <div style="display:flex;justify-content:space-between;font-size:12.5px;font-weight:700;margin-bottom:2px;">
       <span>Sana: <b>${esc(d.sana)||"—"}</b></span><span>Mijoz: <b>${esc(d.mijozIsm)||"—"}</b></span>
     </div>
     <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin-bottom:8px;border-bottom:1px solid #000;padding-bottom:6px;">
       <span>${esc(d.agent)}</span><span>${esc(d.mijozTel)}</span>
     </div>
     ${hasSom ? tableHtml("Mahsulot nomi", somRows, fmtSom(thisSom)) : ""}
     ${showSom ? boxHtml(fmtSom(d.totalSom), fmtSom(d.tolovSom), fmtSom(yangiSom), false) : ""}
     ${hasDollar ? tableHtml("Mahsulot ($)", dolRows, fmtUsd(thisDollar)) : ""}
     ${showDollar ? boxHtml(fmtUsd(d.totalDollar), fmtUsd(d.tolovDollar), fmtUsd(yangiUsd), true) : ""}`;

  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-10000px;top:0;width:360px;background:#fff;color:#000;font-family:Arial,sans-serif;padding:12px 14px 14px;";
  host.innerHTML = html;
  document.body.appendChild(host);
  try {
    const html2canvas = (await import("html2canvas")).default;
    const jsPDF = (await import("jspdf")).default;
    const canvas = await html2canvas(host, { scale: 3, backgroundColor: "#ffffff" });
    const wmm = 80;
    const hmm = Math.max(40, (wmm * canvas.height) / canvas.width);
    const doc = new jsPDF({ unit: "mm", format: [wmm, hmm] });
    doc.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, wmm, hmm);
    const url = URL.createObjectURL(doc.output("blob"));
    const a = document.createElement("a");
    a.href = url; a.download = `chek-${d.id}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
  } finally {
    document.body.removeChild(host);
  }
}
