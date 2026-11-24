// Matnning ekrandagi eni (px) — jadval ustunini matn BIR QATORGA sig'adigan qilib o'lchash uchun.
// Brauzerda canvas bilan sahifaning haqiqiy shrifti orqali o'lchanadi; serverda (SSR) — taxminiy.
let ctx: CanvasRenderingContext2D | null = null;
let oila = "";

export function matnEni(matn: string, oG: number, vazn = 600): number {
  if (typeof document === "undefined") return matn.length * oG * 0.62;
  if (!ctx) ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return matn.length * oG * 0.62;
  if (!oila) oila = getComputedStyle(document.body).fontFamily || "sans-serif";
  ctx.font = `${vazn} ${oG}px ${oila}`;
  return ctx.measureText(matn).width;
}
