"use client";
import { useState, useRef, useEffect, CSSProperties } from "react";

/**
 * Izoh uchun combobox: erkin yozib bo'ladi (yangi izoh) YOKI oldin yozilgan
 * izohlar ro'yxatidan tanlanadi. Ro'yxat matn kiritilganda filtrlaydi.
 * Dropdown fixed-joylashuvda (SearchSelect kabi) — modal/drawer ichida kesilmaydi.
 */
export default function IzohSelect({
  value, onChange, options, placeholder, style, className, textarea, rows, maxLength, onBlur,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  style?: CSSProperties;
  className?: string;
  textarea?: boolean;
  rows?: number;
  maxLength?: number;
  onBlur?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const place = () => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left, width: r.width });
  };

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const re = () => place();
    document.addEventListener("mousedown", h);
    window.addEventListener("resize", re);
    window.addEventListener("scroll", re, true);
    return () => {
      document.removeEventListener("mousedown", h);
      window.removeEventListener("resize", re);
      window.removeEventListener("scroll", re, true);
    };
  }, [open]);

  const q = (value || "").trim().toLowerCase();
  const uniq = Array.from(new Set(options.map(o => (o || "").trim()).filter(Boolean)));
  const list = uniq.filter(o => o.toLowerCase().includes(q)).slice(0, 60);
  // Faqat bitta mos kelsa va u aynan yozilganга teng bo'lsa — ro'yxat ko'rsatilmaydi
  const showList = open && !!pos && list.length > 0 && !(list.length === 1 && list[0].toLowerCase() === q);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange(maxLength ? e.target.value.slice(0, maxLength) : e.target.value);
  };
  const onFocus = () => { place(); setOpen(true); };

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      {textarea ? (
        <textarea value={value} onChange={handleChange} onFocus={onFocus} onBlur={onBlur}
          placeholder={placeholder} rows={rows || 2} style={style} className={className} autoComplete="off" />
      ) : (
        <input value={value} onChange={handleChange} onFocus={onFocus} onBlur={onBlur}
          placeholder={placeholder} style={style} className={className} autoComplete="off" />
      )}
      {showList && (
        <div style={{
          position: "fixed", top: pos!.top, left: pos!.left, width: pos!.width, zIndex: 2000,
          background: "var(--white)", border: "1px solid var(--border)", borderRadius: "var(--radius)",
          boxShadow: "var(--shadow)", overflow: "hidden",
        }}>
          <div style={{ maxHeight: 200, overflowY: "auto", overscrollBehavior: "contain" }}
            onTouchMove={e => e.stopPropagation()}>
            {list.map((o, i) => (
              <div key={i} onMouseDown={e => { e.preventDefault(); onChange(o); setOpen(false); }}
                style={{
                  padding: "9px 12px", fontSize: 13, cursor: "pointer",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  fontWeight: o.toLowerCase() === q ? 700 : 400,
                  color: o.toLowerCase() === q ? "var(--primary)" : "var(--text)",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--bg)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                {o}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
