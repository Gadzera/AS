/**
 * Theme (M23-2, S374). light/dark. Source-of-truth — backend (User.themePref); localStorage — мгновенный кэш
 * против FOUC. applyTheme переключает класс `dark` на <html> → CSS-токены меняются для всего app-shell.
 */
import { authApi } from '@/lib/api';

export type Theme = 'light' | 'dark';
const KEY = 'ai_sdr_theme';

export function applyTheme(t: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', t === 'dark');
}
export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  return (localStorage.getItem(KEY) as Theme) || 'light';
}
function cache(t: Theme) { try { localStorage.setItem(KEY, t); } catch { /* noop */ } }

// мгновенно применить кэш (для провайдера на маунте)
export function bootTheme(): void { applyTheme(getStoredTheme()); }

// сменить тему: DOM + кэш + СЕРВЕР (persist между устройствами)
export async function setTheme(t: Theme): Promise<void> {
  cache(t); applyTheme(t);
  await authApi.setTheme(t).catch(() => undefined);
}

// синхронизировать с сервером (после логина/маунта): backend выигрывает
export async function syncThemeFromServer(): Promise<Theme> {
  try {
    const me = await authApi.me();
    const t: Theme = me.themePref === 'dark' ? 'dark' : 'light';
    cache(t); applyTheme(t);
    return t;
  } catch { const t = getStoredTheme(); applyTheme(t); return t; }
}
