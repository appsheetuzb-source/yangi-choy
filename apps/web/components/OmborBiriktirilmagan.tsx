// Admin bo'lmagan foydalanuvchiga ombor biriktirilmagan bo'lsa — mahsulot/qoldiq o'rniga shu xabar.
// (Avval ombor bo'sh bo'lsa barcha omborlarning mahsulot va qoldiqlari ko'rinib qolardi.)
export default function OmborBiriktirilmagan({ sarlavha }: { sarlavha: string }) {
  return (
    <>
      <header className="header">
        <div className="header__inner">
          <h1 className="header__title" style={{ paddingLeft: 4 }}>{sarlavha}</h1>
        </div>
      </header>
      <div className="page-content">
        <div className="empty">
          <div className="empty__icon">📦</div>
          <p className="empty__title" style={{ marginBottom: 6, fontWeight: 700, color: "var(--text)" }}>Sizga ombor biriktirilmagan</p>
          <p style={{ fontSize: 13, color: "var(--text-3)", maxWidth: 380, lineHeight: 1.5 }}>
            Mahsulot va qoldiqlarni ko&apos;rish uchun administrator «Foydalanuvchilar» bo&apos;limida sizga ombor tanlashi kerak.
          </p>
        </div>
      </div>
    </>
  );
}
