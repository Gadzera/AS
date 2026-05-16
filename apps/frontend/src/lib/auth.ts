import type { User } from '@/types';

const TOKEN_KEY = 'ai_sdr_token';
const USER_KEY = 'ai_sdr_user';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  // Also set a cookie so server-side middleware can verify auth
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  document.cookie = `auth_token=${token}; path=/; SameSite=Strict; max-age=604800${secure}`;
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  document.cookie = 'auth_token=; path=/; max-age=0';
}

export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: User): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function logout(): void {
  removeToken();
  window.location.href = '/login';
}
