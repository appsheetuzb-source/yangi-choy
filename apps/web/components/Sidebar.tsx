"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

// role: null = hammaga, "Admin" = faqat adminga
const allNavItems = [
  { href: "/",               label: "Bosh sahifa",    role: null,    icon: <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg> },
  { href: "/mahsulot",       label: "Mahsulotlar",    role: null,    icon: <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg> },
  { href: "/mijozlar",       label: "Klient",         role: null,    icon: <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg> },
  { href: "/sotuv",          label: "Sotuvlar",       role: null,    icon: <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg> },
  { href: "/sotuv/tolov",    label: "Pul ayirish",    role: null,    icon: <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg> },
  { href: "/xarid",          label: "Xaridlar",       role: "Admin", icon: <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg> },
  { href: "/xarid/tolov",    label: "Xarid to'lovlar",role: "Admin", icon: <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg> },
  { href: "/xarajat",        label: "Xarajatlar",     role: null,    icon: <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> },
  { href: "/gazna",          label: "Gazna",          role: null,    icon: <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg> },
  { href: "/statistika",     label: "Statistika",     role: "Admin", icon: <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg> },
  { href: "/foydalanuvchi",  label: "Foydalanuvchi",  role: "Admin", icon: <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg> },
  { href: "/taminotchi",     label: "Firma",          role: "Admin", icon: <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg> },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showChangePass, setShowChangePass] = useState(false);
  const [passForm, setPassForm] = useState({ old: "", new1: "", new2: "" });
  const [passErr, setPassErr] = useState("");
  const [passSaving, setPassSaving] = useState(false);
  const pathname = usePathname();
  const router   = useRouter();
  const { user, logout } = useAuth();

  const isAdmin = user?.lavozim === "Admin";
  const navItems = allNavItems.filter(item =>
    item.role === null || (item.role === "Admin" && isAdmin)
  );

  function handleLogout() { logout(); router.replace("/login"); }

  async function handleChangePass() {
    setPassErr("");
    if (!passForm.old || !passForm.new1) { setPassErr("Barcha maydonlarni to'ldiring"); return; }
    if (passForm.new1 !== passForm.new2) { setPassErr("Yangi parollar mos emas"); return; }
    if (passForm.new1.length < 4) { setPassErr("Parol kamida 4 ta belgi bo'lsin"); return; }
    setPassSaving(true);
    try {
      const res = await fetch("/api/sheets?range=Foydalanuvchi", { cache: "no-store" });
      const json = await res.json();
      const me = (json.data as Record<string,string>[]).find(u => u.Foydalanuvchi_ID === user?.id);
      if (!me) { setPassErr("Foydalanuvchi topilmadi"); return; }
      if ((me.Parol || "").trim() !== passForm.old.trim()) { setPassErr("Joriy parol noto'g'ri"); return; }
      await fetch("/api/sheets", { method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheet: "Foydalanuvchi", idColumn: "Foydalanuvchi_ID", idValue: user?.id, row: { ...me, Parol: passForm.new1 } }) });
      setShowChangePass(false);
      setPassForm({ old: "", new1: "", new2: "" });
    } catch { setPassErr("Xatolik yuz berdi"); }
    finally { setPassSaving(false); }
  }

  // User footer — doim ko'rinib turadi
  function UserFooter() {
    if (!user) return null;
    return (
      <div style={{ borderTop: "1px solid var(--border)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {/* User info */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#2f81f7,#1f6feb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0, boxShadow: "0 2px 8px rgba(47,129,247,.3)" }}>
            {user.nomi?.[0]?.toUpperCase() || "U"}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.nomi}</p>
            <p style={{ fontSize: 11, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.pochta}</p>
          </div>
        </div>

        {/* Actions */}
        <button onClick={() => { setShowChangePass(true); setPassForm({ old: "", new1: "", new2: "" }); setPassErr(""); }}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 9, fontSize: 12.5, fontWeight: 500, color: "var(--text-2)", cursor: "pointer", border: "none", background: "transparent", transition: "all .12s", textAlign: "left" }}
          onMouseEnter={e => { e.currentTarget.style.background = "var(--white)"; e.currentTarget.style.color = "var(--text)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-2)"; }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
          Parolni o&apos;zgartirish
        </button>

        <button onClick={handleLogout}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 9, fontSize: 12.5, fontWeight: 500, color: "var(--red)", cursor: "pointer", border: "none", background: "transparent", transition: "all .12s", textAlign: "left" }}
          onMouseEnter={e => { e.currentTarget.style.background = "var(--red-bg)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
          Chiqish
        </button>

      </div>
    );
  }

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Sahifa o'zgarganda mobilni yop
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Body scroll lock when mobile menu open
  useEffect(() => {
    if (isMobile) document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen, isMobile]);

  if(pathname?.endsWith("/chek")) return null;

  // Eng uzun mos href → faqat bitta element active bo'ladi
  const activeHref = [...navItems]
    .filter(item =>
      item.href === "/"
        ? pathname === "/"
        : pathname === item.href || pathname?.startsWith(item.href + "/")
    )
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  if (isMobile) {
    return (
      <>
        {/* Mobile hamburger button */}
        <button
          onClick={() => setMobileOpen(true)}
          style={{
            position: "fixed", top: 12, left: 12, zIndex: 40,
            width: 36, height: 36, borderRadius: 10,
            background: "var(--white)", border: "1px solid var(--border)",
            boxShadow: "var(--shadow-sm)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--text)",
          }}>
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>

        {/* Overlay */}
        {mobileOpen && (
          <div
            onClick={() => setMobileOpen(false)}
            style={{
              position: "fixed", inset: 0, zIndex: 45,
              background: "rgba(0,0,0,.45)",
            }}
          />
        )}

        {/* Mobile sidebar drawer */}
        <aside style={{
          position: "fixed", top: 0, left: 0, height: "100dvh", zIndex: 46,
          width: 260, background: "var(--white)",
          borderRight: "1px solid var(--border)",
          display: "flex", flexDirection: "column",
          transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform .25s cubic-bezier(.4,0,.2,1)",
          boxShadow: mobileOpen ? "4px 0 24px rgba(0,0,0,.15)" : "none",
        }}>
          {/* Head */}
          <div style={{ display: "flex", alignItems: "center", height: 56, borderBottom: "1px solid var(--border)", padding: "0 16px", gap: 10 }}>
            <div className="sidebar__logo">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
              </svg>
            </div>
            <span className="sidebar__title">Yangi Choy</span>
            <button
              onClick={() => setMobileOpen(false)}
              style={{ marginLeft: "auto", width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)" }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, padding: "12px 8px", overflowY: "auto" }}>
            <p className="sidebar__label">Menyu</p>
            <ul className="sidebar__list">
              {navItems.map((item) => {
                const active = item.href === activeHref;
                return (
                  <li key={item.href} className={`sidebar__item${active ? " sidebar__item--active" : ""}`}>
                    <Link href={item.href} style={{ fontSize: 15 }}>
                      {item.icon}
                      <span>{item.label}</span>
                      {active && <span className="sidebar__dot"/>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <UserFooter />
        </aside>
      </>
    );
  }

  // Desktop sidebar
  return (
    <aside className={`sidebar ${collapsed ? "sidebar--collapsed" : "sidebar--full"}`}>
      <div className="sidebar__head" style={collapsed ? { justifyContent: "center", padding: "0 0" } : {}}>
        <div className="sidebar__logo">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
          </svg>
        </div>
        {!collapsed && <span className="sidebar__title">Yangi Choy</span>}
        {!collapsed && (
          <button className="sidebar__toggle" onClick={() => setCollapsed(true)}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/>
            </svg>
          </button>
        )}
      </div>

      {collapsed && (
        <div style={{ padding: "8px", display: "flex", justifyContent: "center" }}>
          <button className="sidebar__toggle" onClick={() => setCollapsed(false)}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
      )}

      <nav className="sidebar__nav">
        {!collapsed && <p className="sidebar__label">Menyu</p>}
        <ul className="sidebar__list">
          {navItems.map((item) => {
            const active = item.href === activeHref;
            return (
              <li key={item.href} className={`sidebar__item${active ? " sidebar__item--active" : ""}`}>
                <Link href={item.href} title={collapsed ? item.label : undefined}
                  style={collapsed ? { justifyContent: "center" } : {}}>
                  {item.icon}
                  {!collapsed && <span>{item.label}</span>}
                  {!collapsed && active && <span className="sidebar__dot"/>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <UserFooter />

      {/* Parol o'zgartirish modal */}
      {showChangePass && (
        <div onClick={() => setShowChangePass(false)} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--white-2)", border: "1px solid var(--border-2)", borderRadius: 18, width: "100%", maxWidth: 380, padding: 28, boxShadow: "0 16px 48px rgba(0,0,0,.5)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 20 }}>Parolni o&apos;zgartirish</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {["old","new1","new2"].map((k, i) => (
                <div key={k} className="field">
                  <label>{["Joriy parol","Yangi parol","Yangi parol (takror)"][i]}</label>
                  <input type="password" value={passForm[k as keyof typeof passForm]}
                    onChange={e => setPassForm(f => ({ ...f, [k]: e.target.value }))}
                    placeholder="••••••••" />
                </div>
              ))}
              {passErr && <p style={{ fontSize: 12, color: "var(--red)", fontWeight: 600, padding: "8px 12px", background: "var(--red-bg)", borderRadius: 8 }}>{passErr}</p>}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button className="btn btn--outline" style={{ flex: 1 }} onClick={() => setShowChangePass(false)} disabled={passSaving}>Bekor</button>
              <button className="btn btn--primary" style={{ flex: 1 }} onClick={handleChangePass} disabled={passSaving}>{passSaving ? "Saqlanmoqda..." : "Saqlash"}</button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
