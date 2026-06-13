export interface AuthUser {
  id: string;
  nomi: string;
  lavozim: string; // "Admin" | "Sotuvchi" | ...
  pochta: string;
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

// Foydalanuvchiga ko'rinadigan gaznalar: Admin → barchasi, boshqalar → biriktirilganlar
export function gaznaForUser<T extends { Gazna_ID: string }>(user: AuthUser | null, gaznalar: T[]): T[] {
  if (!user) return [];
  if (user.lavozim === "Admin") return gaznalar;
  const ids = user.gaznaIds || [];
  return gaznalar.filter(g => ids.includes(g.Gazna_ID));
}

// Sotuvchi ko'ra oladigan sahifalar
export const SOTUVCHI_ROUTES = ["/", "/sotuv", "/sotuv/tolov", "/mijozlar", "/mahsulot", "/gazna", "/xarajat"];

export function canAccess(user: AuthUser | null, path: string): boolean {
  if (!user) return false;
  if (isAdmin(user)) return true;
  return SOTUVCHI_ROUTES.some(r => path === r || path.startsWith(r + "/"));
}
