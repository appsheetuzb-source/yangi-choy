export interface AuthUser {
  id: string;
  nomi: string;
  lavozim: string; // "Admin" | "Sotuvchi" | ...
  pochta: string;
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

// Sotuvchi ko'ra oladigan sahifalar
export const SOTUVCHI_ROUTES = ["/", "/sotuv", "/sotuv/tolov", "/mijozlar", "/mahsulot", "/gazna", "/xarajat"];

export function canAccess(user: AuthUser | null, path: string): boolean {
  if (!user) return false;
  if (isAdmin(user)) return true;
  return SOTUVCHI_ROUTES.some(r => path === r || path.startsWith(r + "/"));
}
