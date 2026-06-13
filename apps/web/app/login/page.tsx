"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();

  const [pochta, setPochta] = useState("");
  const [parol, setParol]   = useState("");
  const [showP, setShowP]   = useState(false);
  const [error, setError]   = useState("");
  const [busy, setBusy]     = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [user, loading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pochta || !parol) { setError("Login va parolni kiriting"); return; }
    setBusy(true); setError("");
    const err = await login(pochta, parol);
    if (err) { setError(err); setBusy(false); }
    else { router.replace("/"); }
  }

  if (loading) return null;

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg)",
      backgroundImage: "radial-gradient(ellipse at 20% 50%, rgba(47,129,247,.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(63,185,80,.06) 0%, transparent 50%)",
    }}>
      <div style={{
        width: "100%", maxWidth: 400, padding: "0 20px",
        animation: "fadeIn .3s ease",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16,
            background: "linear-gradient(135deg, #2f81f7, #1f6feb)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 24px rgba(47,129,247,.4)",
            marginBottom: 16,
          }}>
            <svg width="26" height="26" fill="none" stroke="#fff" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", marginBottom: 6 }}>
            Yangi Choy
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-2)" }}>Boshqaruv tizimiga kirish</p>
        </div>

        {/* Card */}
        <div style={{
          background: "var(--white)",
          border: "1px solid var(--border-2)",
          borderRadius: 20,
          padding: "28px 28px",
          boxShadow: "0 12px 36px rgba(30,64,124,.16)",
        }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>

            {/* Login */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 8 }}>
                Login (pochta)
              </label>
              <input
                type="email"
                value={pochta}
                onChange={e => setPochta(e.target.value)}
                placeholder="email@example.com"
                autoFocus
                style={{
                  width: "100%", padding: "11px 14px",
                  background: "var(--bg-2)", border: "1px solid var(--border-2)",
                  borderRadius: 10, color: "var(--text)", fontSize: 14, outline: "none",
                  transition: "border-color .15s, box-shadow .15s",
                }}
                onFocus={e => { e.target.style.borderColor = "var(--primary)"; e.target.style.boxShadow = "0 0 0 3px var(--primary-glow)"; }}
                onBlur={e  => { e.target.style.borderColor = "var(--border-2)"; e.target.style.boxShadow = "none"; }}
              />
            </div>

            {/* Parol */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 8 }}>
                Parol
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showP ? "text" : "password"}
                  value={parol}
                  onChange={e => setParol(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: "100%", padding: "11px 44px 11px 14px",
                    background: "var(--bg-2)", border: "1px solid var(--border-2)",
                    borderRadius: 10, color: "var(--text)", fontSize: 14, outline: "none",
                    transition: "border-color .15s, box-shadow .15s",
                  }}
                  onFocus={e => { e.target.style.borderColor = "var(--primary)"; e.target.style.boxShadow = "0 0 0 3px var(--primary-glow)"; }}
                  onBlur={e  => { e.target.style.borderColor = "var(--border-2)"; e.target.style.boxShadow = "none"; }}
                />
                <button type="button" onClick={() => setShowP(s => !s)} style={{
                  position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                  color: "var(--text-3)", transition: "color .15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--text)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--text-3)")}>
                  {showP
                    ? <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
                    : <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                  }
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                padding: "10px 14px", borderRadius: 10,
                background: "var(--red-bg)", border: "1px solid rgba(248,81,73,.3)",
                fontSize: 13, color: "var(--red)", fontWeight: 600,
              }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={busy} style={{
              width: "100%", padding: "12px",
              background: busy ? "var(--border-2)" : "linear-gradient(135deg, #2f81f7, #1f6feb)",
              color: busy ? "var(--text-3)" : "#fff",
              borderRadius: 10, fontSize: 15, fontWeight: 700,
              cursor: busy ? "not-allowed" : "pointer",
              transition: "all .2s",
              boxShadow: busy ? "none" : "0 4px 16px rgba(47,129,247,.4)",
              transform: "translateY(0)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
            onMouseEnter={e => { if (!busy) e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}>
              {busy
                ? <><span className="spinner" style={{ borderTopColor: "var(--text-2)", borderColor: "var(--border)" }}/> Kirilmoqda...</>
                : "Kirish"
              }
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "var(--text-3)" }}>
          Parolni unutdingizmi? Administrator bilan bog&apos;laning.
        </p>
      </div>
    </div>
  );
}
