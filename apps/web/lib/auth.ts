export interface AuthUser {
  id: string;
  nomi: string;
  lavozim: string; // "Admin" | "Sotuvchi" | "Omborchi" | ...
  pochta: string;
  omborId?: string; // asosiy (birinchi) biriktirilgan ombor ID
  omborIds?: string[]; // foydalanuvchiga biriktirilgan BARCHA omborlar (birinchisi — asosiy)
  gaznaIds?: string[]; // foydalanuvchiga biriktirilgan gazna ID'lari
}

const KEY = "yc_user";

export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch { return null; }
}

export function setUser(user: AuthUser) {
  localStorage.setItem(KEY, JSON.stringify(user));
}

export function clearUser() {
  localStorage.removeItem(KEY);
}

export function isAdmin(user: AuthUser | null) {
  return user?.lavozim === "Admin";
}

export function isSotuvchi(user: AuthUser | null) {
  return user?.lavozim === "Sotuvchi";
}

// Vergul bilan ajratilgan Gazna_ID matnini massivga aylantirish
export function parseGaznaIds(raw?: string): string[] {
  return (raw || "").split(",").map(s => s.trim()).filter(Boolean);
}

// Foydalanuvchiga ko'rinadigan gaznalar: Admin → barchasi, boshqalar → o'ziga biriktirilgan (Gazna_ID)
export function gaznaForUser<T extends { Gazna_ID: string }>(user: AuthUser | null, gaznalar: T[]): T[] {
  if (!user) return [];
  if (user.lavozim === "Admin") return gaznalar;
  const ids = user.gaznaIds || [];
  return gaznalar.filter(g => ids.includes(g.Gazna_ID));
}

// Foydalanuvchiga biriktirilgan omborlar (birinchisi — asosiy). Eski saqlangan sessiyada omborIds bo'lmasa —
// omborId dan olinadi (server /api/auth/me javobi kelguncha).
export function userOmborIds(user: AuthUser | null): string[] {
  if (!user) return [];
  if (Array.isArray(user.omborIds)) return user.omborIds.map(s => String(s).trim()).filter(Boolean);
  return (user.omborId || "").split(",").map(s => s.trim()).filter(Boolean);
}

// Foydalanuvchiga ko'rinadigan omborlar: Admin → barchasi, boshqalar → faqat o'ziga biriktirilganlar
export function omborForUser<T extends { Ombor_ID: string }>(user: AuthUser | null, omborlar: T[]): T[] {
  if (!user) return [];
  if (user.lavozim === "Admin") return omborlar;
  const ids = userOmborIds(user);
  return omborlar.filter(o => ids.includes(String(o.Ombor_ID || "").trim()));
}

// Sotuvchi ko'ra oladigan sahifalar
export const SOTUVCHI_ROUTES = ["/", "/sotuv", "/sotuv/tolov", "/mijozlar", "/akt-sverka", "/mahsulot", "/narx-chek", "/gazna", "/xarajat"];

export function canAccess(user: AuthUser | null, path: string): boolean {
  if (!user) return false;
  if (isAdmin(user)) return true;
  return SOTUVCHI_ROUTES.some(r => path === r || path.startsWith(r + "/"));
}
