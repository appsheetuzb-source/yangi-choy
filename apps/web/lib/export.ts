// Qayta ishlatiladigan eksport yordamchilari — PDF (jsPDF) va Excel (.xls HTML-jadval).
// Dependency qo'shmasdan: Excel uchun application/vnd.ms-excel HTML-jadval (Excel ochadi, formatli).
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Cell = string | number;

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function esc(v: Cell | undefined) {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export interface ExportSection {
  heading?: string;            // bo'lim sarlavhasi (masalan "SO'M")
  headers: string[];
  rows: Cell[][];
  foot?: Cell[];               // jami qatori
}

export interface ExportOpts {
  title: string;               // hujjat sarlavhasi
  subtitle?: string;           // sana/oraliq
  filename: string;            // kengaytmasiz
  sections: ExportSection[];
}

// ── Excel (.xls) ──────────────────────────────────────────
export function exportExcel(o: ExportOpts) {
  const blocks = o.sections.map(sec => {
    const cols = sec.headers.length;
    const head = `<tr>${sec.headers.map(h => `<th style="background:#1a2744;color:#ffffff;border:1px solid #1a2744;padding:7px 10px;font-size:12px;text-align:left;font-weight:bold">${esc(h)}</th>`).join("")}</tr>`;
    const body = sec.rows.map((r, i) => `<tr style="background:${i % 2 ? "#f7f8fc" : "#ffffff"}">${r.map(c => `<td style="border:1px solid #c8cde1;padding:6px 10px;font-size:12px">${esc(c)}</td>`).join("")}</tr>`).join("");
    const foot = sec.foot ? `<tr>${sec.foot.map(c => `<td style="border:1px solid #1a2744;background:#eef0f8;padding:7px 10px;font-size:12px;font-weight:bold">${esc(c)}</td>`).join("")}</tr>` : "";
    const headingRow = sec.heading ? `<tr><td colspan="${cols}" style="font-size:13px;font-weight:bold;padding:10px 4px 4px;color:#1a2744">${esc(sec.heading)}</td></tr>` : "";
    return `${headingRow}<table style="border-collapse:collapse;font-family:Arial;margin-bottom:14px">${head}${body}${foot}</table>`;
  }).join("<br/>");

  const html = `<html><head><meta charset="UTF-8"></head><body style="font-family:Arial">
    <div style="font-size:18px;font-weight:bold;color:#1a2744">MUSAFFO TEA</div>
    <div style="font-size:14px;font-weight:bold;margin-top:4px">${esc(o.title)}</div>
    ${o.subtitle ? `<div style="font-size:11px;color:#555;margin-bottom:10px">${esc(o.subtitle)}</div>` : ""}
    ${blocks}
  </body></html>`;
  triggerDownload(new Blob(["﻿" + html], { type: "application/vnd.ms-excel" }), `${o.filename}.xls`);
}

// ── PDF (jsPDF + autoTable) ───────────────────────────────
export function exportPDF(o: ExportOpts) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();

  doc.setFillColor(26, 39, 68);
  doc.rect(0, 0, W, 18, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(15);
  doc.text("MUSAFFO TEA", W / 2, 12, { align: "center" });

  doc.setTextColor(26, 39, 68); doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.text(o.title, 14, 28);
  let y = 32;
  if (o.subtitle) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(90, 96, 128);
    doc.text(o.subtitle, 14, 34); y = 40;
  }

  for (const sec of o.sections) {
    if (sec.heading) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(26, 39, 68);
      doc.text(sec.heading, 14, y); y += 2;
    }
    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [sec.headers],
      body: sec.rows.map(r => r.map(String)),
      foot: sec.foot ? [sec.foot.map(String)] : undefined,
      theme: "grid",
      styles: { fontSize: 9, lineColor: [200, 205, 225], lineWidth: 0.2, cellPadding: 2 },
      headStyles: { fillColor: [26, 39, 68], textColor: 255, fontStyle: "bold", fontSize: 9, lineColor: [26, 39, 68], lineWidth: 0.2 },
      footStyles: { fillColor: [238, 240, 248], textColor: [26, 39, 68], fontStyle: "bold", fontSize: 10 },
      alternateRowStyles: { fillColor: [247, 248, 252] },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  doc.save(`${o.filename}.pdf`);
}
