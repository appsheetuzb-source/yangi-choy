"use client";

/**
 * Mobil uchun suzuvchi (floating) qo'shish tugmasi — o'ng-pastda, scroll'da doim ko'rinadi.
 * Ishlatish: {isMobile && <FabAdd onClick={openAdd} />}
 */
export default function FabAdd({ onClick, label = "Qo'shish" }: { onClick: () => void; label?: string }) {
  return (
    <button
      className="btn btn--primary"
      onClick={onClick}
      aria-label={label}
      style={{
        position: "fixed", right: 18, bottom: 24, zIndex: 40,
        width: 56, height: 56, minWidth: 56, padding: 0, borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 6px 20px rgba(37,99,235,0.45)",
      }}
    >
      <svg width="26" height="26" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg>
    </button>
  );
}
