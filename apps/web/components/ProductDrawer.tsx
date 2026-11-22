"use client";
import { useEffect, useState, useRef } from "react";
import { afterWrite } from "@/lib/sheet-cache";
import { useScrollLock } from "@/lib/use-scroll-lock";
import { blokdagiDona } from "@/lib/blok";
import { fmtSon } from "@/lib/birlik";

// "Blokdagi dona soni" maydoni: raqamlar + bitta ajratgich (vergul yoki nuqta) + 3 xonagacha kasr.
// Noto'g'ri belgi (harf, ikkinchi ajratgich) e'tiborsiz qoldiriladi — qiymat qayta yozilmaydi.
// Saqlashda "12,5" → "12.5" ko'rinishiga keltiriladi (handleSave).
function blokKiritish(v: string): string | null {
  const m = v.replace(/\s/g, "").match(/^(\d*)([.,]\d*)?$/);
  if (!m) return null;
  return m[1] + (m[2] ? m[2].slice(0, 4) : "");
}

export interface ProductRow {
  Mahsulot_ID: string;
  Ombor_ID: string;
  Nomi: string;
  Rasm: string;
  Tan_som: string;
  Sotuv_som: string;
  Tan_dollar: string;
  Sotuv_dollar: string;
  Qoshilgan_sana: string;
  Kg: string;
  Birlik: string;
  /** Bir blokdagi dona soni (masalan 15). Bo'sh yoki ≤ 1 — blok yo'q, faqat dona bilan sotiladi (lib/blok.ts) */
  Blokdagi_dona?: string;
  Check: string;
}
export interface OmborRow { Ombor_ID: string; Nomi: string; }

// O'lchov birligi: mahsulot dona bilan sanaladimi yoki kg bilan o'lchanadimi.
// Bo'sh qiymat "Dona" deb o'qiladi (lib/birlik.ts) — eski mahsulotlar shu sabab o'zgarmaydi.
const BIRLIKLAR = ["Dona", "Kg"] as const;

const EMPTY: ProductRow = {
  Mahsulot_ID: "", Ombor_ID: "", Nomi: "", Rasm: "",
  Tan_som: "", Sotuv_som: "", Tan_dollar: "", Sotuv_dollar: "",
  Qoshilgan_sana: "", Kg: "", Birlik: "Dona", Blokdagi_dona: "", Check: "TRUE",
};
function uid() { return Math.random().toString(36).slice(2, 10); }
function num(v: string) { return parseFloat(String(v || "0").replace(/\s/g, "").replace(",", ".")) || 0; }

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

/**
 * Mahsulot qo'shish / tahrirlash formasi (o'ng tomon drawer).
 * Mahsulot sahifasida ham, Xarid formasida "+ Yangi mahsulot" oynasi
 * sifatida ham AYNAN shu komponent ishlatiladi — ikki joyda bir xil forma.
 */
export default function ProductDrawer({ open, onClose, omborlar, editTarget = null, initialNomi, defaultOmborId, onSaved }: {
  open: boolean;
  onClose: () => void;
  omborlar: OmborRow[];
  editTarget?: ProductRow | null;
  initialNomi?: string;
  defaultOmborId?: string;
  onSaved: (saved: ProductRow) => void;
}) {
  const [formData, setFormData]     = useState<ProductRow>(EMPTY);
  const [saving, setSaving]         = useState(false);
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const [uploading, setUploading]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useScrollLock(open);

  // Ochilganda formani boshlang'ich holatga keltirish
  useEffect(() => {
    if (!open) return;
    if (editTarget) {
      // Eski mahsulotlarda Birlik bo'sh — "Dona" deb ochiladi va saqlanganda aniq yoziladi
      const f: ProductRow = { ...editTarget, Birlik: editTarget.Birlik || "Dona" };
      // Avvalgi forma "0"/"1" ni ham saqlagan (≤ 1 = blok yo'q) — bo'sh deb ochiladi; aks holda blokXato
      // Saqlashni o'chirib qo'yardi (faqat narxni o'zgartirmoqchi bo'lgan admin ham saqlay olmasdi)
      if (f.Birlik !== "Kg" && String(f.Blokdagi_dona ?? "").trim() !== "" && !blokdagiDona(f)) f.Blokdagi_dona = "";
      setFormData(f);
    } else {
      setFormData({ ...EMPTY, Mahsulot_ID: uid(), Ombor_ID: defaultOmborId || omborlar[0]?.Ombor_ID || "", Nomi: initialNomi || "" });
    }
    setImgPreview(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mahsulotId", formData.Mahsulot_ID || uid());
      const res  = await fetch("/api/image", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({} as { path?: string; error?: string }));
      if (res.ok && json.path) setFormData(p => ({ ...p, Rasm: json.path }));
      else { setImgPreview(null); alert(json.error || "Rasm yuklanmadi. Hajmi 20MB dan kichik rasm tanlang va qayta urinib ko'ring."); }
    } catch {
      setImgPreview(null); alert("Tarmoq xatosi — rasm yuklanmadi.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  // Blok o'lchami (lib/blok.ts bilan bir xil o'qiladi: "12,5" ham, "12.5" ham → 12.5)
  const blokN = blokdagiDona(formData);
  const blokXato = (formData.Birlik || "Dona") !== "Kg" && String(formData.Blokdagi_dona || "").trim() !== "" && !blokN;

  function isValid() {
    if (!formData.Nomi.trim()) return false;
    // Sotuv narxi: so'm yoki $ dan kamida bittasi
    if (num(formData.Sotuv_som) <= 0 && num(formData.Sotuv_dollar) <= 0) return false;
    // Tan narxi: so'm yoki $ dan kamida bittasi
    if (num(formData.Tan_som) <= 0 && num(formData.Tan_dollar) <= 0) return false;
    // Blokdagi dona soni yozilgan bo'lsa — 1 dan katta bo'lishi shart (aks holda blok ishlamaydi, xato ko'rsatiladi)
    if (blokXato) return false;
    return true;
  }

  async function handleSave() {
    if (!isValid()) return;
    setSaving(true);
    // Blok o'lchami bir xil ko'rinishda saqlanadi: "12,5" → "12.5", "12." → "12"; Kg mahsulotda — bo'sh
    const bn = blokdagiDona(formData);
    const row: ProductRow = formData.Blokdagi_dona !== undefined || bn
      ? { ...formData, Blokdagi_dona: bn ? String(bn) : "" }
      : formData;
    try {
      if (editTarget) {
        await fetch("/api/sheets", { method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sheet: "Mahsulot", idColumn: "Mahsulot_ID", idValue: editTarget.Mahsulot_ID, row }) });
      } else {
        await fetch("/api/sheets", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sheet: "Mahsulot", row }) });
      }
      afterWrite("Mahsulot");
      onSaved(row);
      onClose();
    } finally { setSaving(false); }
  }

  if (!open) return null;
  const nameEntered = formData.Nomi.trim().length > 0;
  const sotuvOk = num(formData.Sotuv_som) > 0 || num(formData.Sotuv_dollar) > 0;
  const tanOk   = num(formData.Tan_som) > 0 || num(formData.Tan_dollar) > 0;

  return (
    <>
      {/* z-index modal (50) va drawer (40/41) dan yuqori — modal ustidan ochilsin */}
      <div className="drawer-overlay" onClick={onClose} style={{ zIndex: 1200 }} />
      <div className="drawer" style={{ zIndex: 1201 }}>
        {/* Head */}
        <div className="drawer__head">
          <button className="drawer__back" onClick={onClose}>
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
          <span className="drawer__title">
            {editTarget ? "Mahsulotni tahrirlash" : "Yangi mahsulot"}
          </span>
        </div>

        {/* Body */}
        <div className="drawer__body">

          {/* 1. Asosiy */}
          <div className="drawer__section">
            <p className="drawer__section-label">Asosiy ma&apos;lumot</p>

            <div className="field">
              <label>Mahsulot nomi *</label>
              <input
                value={formData.Nomi}
                onChange={e => setFormData(p => ({ ...p, Nomi: e.target.value }))}
                placeholder="Masalan: Rizq 500gr"
                style={{ fontSize: 15, fontWeight: 600 }}
                autoFocus
              />
            </div>

            {/* Ombor tanlash */}
            {omborlar.length > 0 && (
              <div className="field">
                <label>Ombor</label>
                <div className="pill-group">
                  {omborlar.map(o => (
                    <button key={o.Ombor_ID} type="button"
                      className={`pill ${formData.Ombor_ID === o.Ombor_ID ? "pill--active" : ""}`}
                      onClick={() => setFormData(p => ({ ...p, Ombor_ID: o.Ombor_ID }))}>
                      {o.Nomi}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="field">
              <label>Og&apos;irligi (kg)</label>
              <input value={formData.Kg} onChange={e => setFormData(p => ({ ...p, Kg: e.target.value }))} placeholder="1" />
            </div>

            {/* O'lchov birligi — mahsulot dona bilan sanaladimi yoki kg bilan o'lchanadimi */}
            <div className="field">
              <label>O&apos;lchov birligi</label>
              <div className="pill-group">
                {BIRLIKLAR.map(b => (
                  <button key={b} type="button"
                    className={`pill ${(formData.Birlik || "Dona") === b ? "pill--active" : ""}`}
                    onClick={() => setFormData(p => ({ ...p, Birlik: b }))}>
                    {b}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", marginTop: 6 }}>
                {(formData.Birlik || "Dona") === "Kg"
                  ? "Miqdor kg bilan sanaladi (masalan 5,5 kg)"
                  : "Miqdor dona bilan sanaladi (masalan 12 dona)"}
              </p>
            </div>

            {/* Blok — faqat dona bilan sanaladigan mahsulotda */}
            {(formData.Birlik || "Dona") !== "Kg" && (
              <div className="field">
                <label>Blokdagi dona soni</label>
                {/* inputMode="decimal": telefonda vergul/nuqtali raqam klaviaturasi (iPhone "numeric"da ajratgich yo'q) */}
                <input value={formData.Blokdagi_dona || ""} inputMode="decimal"
                  placeholder="Masalan: 15 yoki 12,5"
                  style={blokXato ? { borderColor: "#ef4444" } : undefined}
                  onChange={e => { const v = blokKiritish(e.target.value); if (v !== null) setFormData(p => ({ ...p, Blokdagi_dona: v })); }} />
                <p style={{ fontSize: 11, fontWeight: 600, color: blokXato ? "#ef4444" : "var(--text-3)", marginTop: 6 }}>
                  {blokN
                    ? `Sotuvda blok bilan kiritiladi: 1 blok = ${fmtSon(blokN)} dona, narx esa bir dona uchun`
                    : blokXato
                      ? "Blokdagi dona soni 1 dan katta bo'lishi kerak (masalan 15 yoki 12,5). Blok kerak bo'lmasa — bo'sh qoldiring"
                      : "Bo'sh bo'lsa, mahsulot faqat dona bilan sotiladi"}
                </p>
              </div>
            )}

          </div>

          {/* 2. Narxlar — faqat nom kiritilganda */}
          {nameEntered && (
            <div className="drawer__section fade-in">
              <p className="drawer__section-label">Narxlar *</p>

              {/* Sotuv narxi — so'm yoki $ dan kamida bittasi majburiy */}
              <div className="grid-2">
                <Field label="Sotuv narxi so'm" value={formData.Sotuv_som} placeholder="0"
                  onChange={v => setFormData(p => ({ ...p, Sotuv_som: v }))} />
                <Field label="Sotuv narxi $" value={formData.Sotuv_dollar} placeholder="0"
                  onChange={v => setFormData(p => ({ ...p, Sotuv_dollar: v }))} />
              </div>
              <p style={{ fontSize: 11, fontWeight: 600, color: sotuvOk ? "var(--text-3)" : "#ef4444", margin: "-4px 0 12px" }}>
                Sotuv narxi: so&apos;m yoki $ dan kamida bittasini to&apos;ldiring *
              </p>

              {/* Tan narxi — so'm yoki $ dan kamida bittasi majburiy */}
              <div className="grid-2">
                <Field label="Tan narxi so'm" value={formData.Tan_som} placeholder="0"
                  onChange={v => setFormData(p => ({ ...p, Tan_som: v }))} />
                <Field label="Tan narxi $" value={formData.Tan_dollar} placeholder="0"
                  onChange={v => setFormData(p => ({ ...p, Tan_dollar: v }))} />
              </div>
              <p style={{ fontSize: 11, fontWeight: 600, color: tanOk ? "var(--text-3)" : "#ef4444", margin: "-4px 0 0" }}>
                Tan narxi: so&apos;m yoki $ dan kamida bittasini to&apos;ldiring *
              </p>
            </div>
          )}

          {/* Rasm — eng pastda, to'liq kenglik, past bo'y */}
          <div className="drawer__section">
            <p className="drawer__section-label">Rasm</p>
            <div className="img-upload"
              style={{ width: "100%", height: 110, aspectRatio: "unset" }}
              onClick={() => !uploading && fileRef.current?.click()}>
              {(imgPreview || formData.Rasm) ? (
                <>
                  <img src={imgPreview || `/api/image?path=${encodeURIComponent(formData.Rasm)}`} alt="preview" />
                  {uploading && (
                    <div className="img-upload__overlay">
                      <span className="spinner" style={{ borderTopColor: "var(--primary)", borderColor: "rgba(0,0,0,.1)", width: 22, height: 22 }} />
                    </div>
                  )}
                  {!uploading && (
                    <button className="img-upload__remove" type="button"
                      onClick={e => { e.stopPropagation(); setImgPreview(null); setFormData(p => ({ ...p, Rasm: "" })); }}>
                      <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    </button>
                  )}
                </>
              ) : (
                <div className="img-upload__placeholder" style={{ flexDirection: "row", gap: 8 }}>
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                  <span>{uploading ? "Yuklanmoqda..." : "Rasm tanlash"}</span>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
              onChange={handleImageSelect} />
          </div>
        </div>

        {/* Footer */}
        <div className="drawer__footer">
          <button className="btn btn--outline" style={{ flex: 1 }} onClick={onClose}>
            Bekor qilish
          </button>
          <button className="btn btn--primary" style={{ flex: 1 }} onClick={handleSave}
            disabled={saving || !isValid()}>
            {saving && <span className="spinner" />}
            {editTarget ? "Saqlash" : "Qoʻshish"}
          </button>
        </div>
      </div>
    </>
  );
}
