"use client";
import { fetchSheets, afterWrite } from "@/lib/sheet-cache";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getPushStatus, enablePush, disablePush, testLocalNotification, ensureFreshSW, type PushStatus } from "@/lib/push-client";

interface Mijoz { Mijoz_ID: string; Ism: string; Telefon?: string; }
interface Ogoh { Ogoh_ID: string; Mijoz_ID: string; Sana?: string; Vaqt?: string; Status?: string; Izoh?: string; Qoshilgan_vaqt?: string; }

function uid() { return Math.random().toString(36).slice(2, 10); }
function parseIds(v?: string) { return String(v || "").split(/\s*,\s*/).map(s => s.trim()).filter(Boolean); }
function nowStr() {
  const t = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tashkent" }));
  const pad = (n: number) => String(n).padStart(2, "0");
  const sana = `${pad(t.getDate())}.${pad(t.getMonth() + 1)}.${t.getFullYear()}`;
  const vaqt = `${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`;
  return { sana, vaqt };
}

const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  "Jarayonda": { bg: "#dbeafe", fg: "#1d4ed8" },
  "Kechiktirildi": { bg: "#fef3c7", fg: "#b45309" },
  "Yakunlandi": { bg: "#dcfce7", fg: "#15803d" },
};

export default function OgohlantirishPage() {
  const router = useRouter();
  const [mijozlar, setMijozlar] = useState<Mijoz[]>([]);
  const [ogoh, setOgoh] = useState<Ogoh[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushStatus>("default");
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => { const c = () => setIsMobile(window.innerWidth < 768); c(); window.addEventListener("resize", c); return () => window.removeEventListener("resize", c); }, []);
  useEffect(() => { ensureFreshSW(); getPushStatus().then(setPushStatus).catch(() => {}); }, []);

  async function togglePush() {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      if (pushStatus === "subscribed") {
        await disablePush();
        setPushStatus("default");
      } else {
        await enablePush(typeof window !== "undefined" ? (localStorage.getItem("yc_user") || "") : "");
        setPushStatus("subscribed");
        try { await testLocalNotification(); } catch {}
      }
    } catch (e) {
      alert((e as Error)?.message || "Push xatosi");
      setPushStatus(await getPushStatus());
    } finally { setPushBusy(false); }
  }

  function loadData() {
    setLoading(true);
    fetchSheets(["Mijozlar", "Ogohlantirish"]).then(rr => {
      setMijozlar(((rr["Mijozlar"].data || []) as Mijoz[]).filter(m => m.Mijoz_ID && (m.Ism || "").trim()));
      setOgoh(((rr["Ogohlantirish"].data || []) as Ogoh[]).filter(o => (o.Ogoh_ID || "").trim()));
    }).finally(() => setLoading(false));
  }
  useEffect(() => { loadData(); }, []);

  const mMap = useMemo(() => { const m: Record<string, Mijoz> = {}; mijozlar.forEach(x => m[x.Mijoz_ID] = x); return m; }, [mijozlar]);

  // Eng yangi tepada
  const list = useMemo(() => [...ogoh].reverse(), [ogoh]);

  async function createNew() {
    setCreating(true);
    const { sana, vaqt } = nowStr();
    const id = uid();
    try {
      await fetch("/api/sheets", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet: "Ogohlantirish", row: { Ogoh_ID: id, Mijoz_ID: "", Sana: sana, Vaqt: vaqt, Status: "Jarayonda", Izoh: "", Qoshilgan_vaqt: `${sana} ${vaqt}`, Chek_file: "", Chek: "", Change: "" } }) });
      afterWrite("Ogohlantirish");
      router.push(`/ogohlantirish/${id}`);
    } catch { setCreating(false); }
  }

  function namesPreview(o: Ogoh) {
    const ids = parseIds(o.Mijoz_ID);
    const names = ids.map(id => mMap[id]?.Ism).filter(Boolean);
    const shown = names.slice(0, 3).join(", ");
    const extra = names.length - 3;
    return { count: ids.length, text: shown + (extra > 0 ? ` +${extra}` : "") };
  }

  return (
    <>
      <header className="header">
        <div className="header__inner">
          <h1 className="header__title" style={{ paddingLeft: 4 }}>Ogohlantirish</h1>
          <span style={{ fontSize: 11, color: "var(--text-3)", paddingLeft: 4 }}>Mijozlar ostatkasi bo&apos;yicha ogohlantirishlar</span>
          <div className="header__spacer" />
          {pushStatus !== "unsupported" && (
            <button onClick={pushStatus === "denied" ? undefined : togglePush} disabled={pushBusy || pushStatus === "denied"}
              title={pushStatus === "denied" ? "Brauzerda bloklangan — sozlamalardan ruxsat bering" : pushStatus === "subscribed" ? "Push yoqilgan — o'chirish" : "Push bildirishnomani yoqish"}
              className="btn btn--outline" style={{ flexShrink: 0, gap: 6,
                color: pushStatus === "subscribed" ? "#15803d" : pushStatus === "denied" ? "var(--text-3)" : "var(--text-2)",
                borderColor: pushStatus === "subscribed" ? "#bbf7d0" : "var(--border)",
                background: pushStatus === "subscribed" ? "#f0fdf4" : "var(--white)" }}>
              {pushStatus === "subscribed" ? (
                <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2a6 6 0 00-6 6v3.6L4.3 15.4A1 1 0 005.2 17h13.6a1 1 0 00.9-1.6L18 11.6V8a6 6 0 00-6-6zm0 20a2.5 2.5 0 002.45-2h-4.9A2.5 2.5 0 0012 22z"/></svg>
              ) : (
                <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
              )}
              {!isMobile && (pushBusy ? "..." : pushStatus === "subscribed" ? "Push yoqilgan" : pushStatus === "denied" ? "Push bloklangan" : "Push yoqish")}
            </button>
          )}
          {!isMobile && (
            <button className="btn btn--primary" onClick={createNew} disabled={creating} style={{ flexShrink: 0 }}>
              <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              Yangi ogohlantirish
            </button>
          )}
        </div>
      </header>

      <div className="page-content" style={{ maxWidth: 760 }}>
        {loading && <div className="spinner--page" />}

        {!loading && (
          <>
            <p className="count-label" style={{ marginBottom: 10 }}>{list.length} ta ogohlantirish</p>
            {list.length === 0 ? (
              <div className="empty" style={{ padding: 40, textAlign: "center" }}>
                <p className="empty__title">Hali ogohlantirish yo&apos;q</p>
                <button className="btn btn--primary" onClick={createNew} disabled={creating}>+ Yangi ogohlantirish</button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {list.map(o => {
                  const p = namesPreview(o);
                  const sc = STATUS_COLOR[o.Status || ""] || { bg: "var(--bg)", fg: "var(--text-3)" };
                  return (
                    <button key={o.Ogoh_ID} onClick={() => router.push(`/ogohlantirish/${o.Ogoh_ID}`)}
                      style={{ textAlign: "left", background: "var(--white)", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-sm)", padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 42, height: 42, borderRadius: 12, background: "var(--primary-soft, #eef2ff)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontWeight: 800, fontSize: 15 }}>
                        {p.count}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text)" }}>{p.count} ta mijoz</span>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: sc.bg, color: sc.fg }}>{o.Status || "—"}</span>
                        </div>
                        <div style={{ fontSize: 12.5, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.text || "Mijoz tanlanmagan"}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-2)" }}>{o.Sana}</div>
                        <div style={{ fontSize: 11, color: "var(--text-3)" }}>{o.Vaqt}</div>
                      </div>
                      <svg width="18" height="18" fill="none" stroke="var(--text-3)" viewBox="0 0 24 24" style={{ flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Mobil FAB */}
      {isMobile && (
        <button onClick={createNew} disabled={creating} aria-label="Yangi ogohlantirish"
          style={{ position: "fixed", right: 18, bottom: 24, zIndex: 40, width: 56, height: 56, borderRadius: "50%", border: "none", background: "var(--primary)", color: "#fff", boxShadow: "0 6px 18px rgba(15,42,76,.35)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="26" height="26" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M12 4v16m8-8H4"/></svg>
        </button>
      )}
    </>
  );
}
