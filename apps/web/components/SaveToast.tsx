"use client";

import { useEffect, useRef, useState } from "react";

type ToastType = "success" | "error";

// Global saqlash bildirishnomasi.
// window.fetch'ni bir marta o'rab oladi: /api/sheets ga POST/PUT (saqlash/tahrirlash)
// yuborilganda natijaga qarab "Saqlandi" yoki "Ma'lumot saqlanmadi" toast ko'rsatadi.
// Ketma-ket ko'p yozuv (masalan bitta sotuvning savat qatorlari) bitta xabarga yig'iladi.
export default function SaveToast() {
  const [toast, setToast] = useState<{ type: ToastType; msg: string; id: number } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingType = useRef<ToastType | null>(null);
  const idRef = useRef(0);

  function show(type: ToastType) {
    idRef.current += 1;
    setToast({ type, msg: type === "success" ? "Saqlandi" : "Ma'lumot saqlanmadi", id: idRef.current });
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setToast(null), 2200);
  }

  useEffect(() => {
    // 1) Global fetch'ni bir marta patch qilamiz
    const w = window as unknown as { __saveToastPatched?: boolean };
    if (!w.__saveToastPatched) {
      w.__saveToastPatched = true;
      const orig = window.fetch.bind(window);
      window.fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
        const [input, init] = args;
        const url =
          typeof input === "string" ? input :
          input instanceof URL ? input.href :
          (input as Request).url || "";
        const method = (
          init?.method ||
          (input instanceof Request ? input.method : "GET") ||
          "GET"
        ).toUpperCase();
        // Faqat ma'lumot saqlash/tahrirlash (POST/PUT) — o'qish (GET) va o'chirish (DELETE) emas
        const isSave = url.includes("/api/sheets") && (method === "POST" || method === "PUT");
        try {
          const res = await orig(...args);
          if (isSave) window.dispatchEvent(new CustomEvent("app:save", { detail: res.ok ? "success" : "error" }));
          return res;
        } catch (e) {
          if (isSave) window.dispatchEvent(new CustomEvent("app:save", { detail: "error" }));
          throw e;
        }
      };
    }

    // 2) Natijalarni tinglaymiz — qisqa vaqtdagi burstlarni bitta xabarga yig'amiz (xato ustun turadi)
    const onSave = (e: Event) => {
      const type = (e as CustomEvent).detail as ToastType;
      if (type === "error") pendingType.current = "error";
      else if (pendingType.current !== "error") pendingType.current = "success";
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        show(pendingType.current || "success");
        pendingType.current = null;
      }, 500);
    };
    window.addEventListener("app:save", onSave);
    return () => {
      window.removeEventListener("app:save", onSave);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  if (!toast) return null;
  const ok = toast.type === "success";
  return (
    <div style={{ position: "fixed", top: 16, left: 0, right: 0, zIndex: 9999, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <div key={toast.id} style={{
        display: "flex", alignItems: "center", gap: 10, padding: "11px 20px", borderRadius: 12,
        background: ok ? "#16a34a" : "#ef4444", color: "#fff", fontSize: 14, fontWeight: 700,
        boxShadow: "0 8px 28px rgba(0,0,0,.22)", animation: "saveToastIn .22s ease-out", maxWidth: "92vw",
      }}>
        <svg width="18" height="18" fill="none" stroke="#fff" strokeWidth={3} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
          {ok
            ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            : <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />}
        </svg>
        {toast.msg}
      </div>
      <style>{`@keyframes saveToastIn{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}
