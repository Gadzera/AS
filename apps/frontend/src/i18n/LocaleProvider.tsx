'use client';

// Клиентский i18n-провайдер: активная локаль (en/de/ru), persist в localStorage (ai_sdr_locale),
// синхронизация <html lang>, хук useT() (точечные ключи + интерполяция + фолбэк на en) и useLocale().
// Без next-intl/locale-в-URL — дашборд это client-SPA за auth; локаль переключается мгновенно, без навигации.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { en } from './messages/en';
import { de } from './messages/de';
import { ru } from './messages/ru';
import type { Messages } from './messages/en';
import { translateKey, type Dict } from './translate';

export type Locale = 'en' | 'de' | 'ru';
export const LOCALES: Locale[] = ['en', 'de', 'ru'];
const STORAGE_KEY = 'ai_sdr_locale';
const DICTS: Record<Locale, Messages> = { en, de, ru };

export type TFunc = (key: string, params?: Record<string, string | number>) => string;

interface LocaleCtx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: TFunc;
}

const Ctx = createContext<LocaleCtx | null>(null);

function isLocale(v: unknown): v is Locale {
  return v === 'en' || v === 'de' || v === 'ru';
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  // SSR-безопасно: и сервер, и первый клиентский рендер — 'en' (без рассинхрона гидратации);
  // сохранённая локаль применяется в effect после монтирования.
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (isLocale(stored)) setLocaleState(stored);
    } catch { /* localStorage недоступен — остаёмся на en */ }
  }, []);

  useEffect(() => {
    try { document.documentElement.lang = locale; } catch { /* no-op */ }
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* no-op */ }
  }, []);

  const t = useCallback<TFunc>((key, params) => {
    return translateKey(DICTS[locale] as unknown as Dict, en as unknown as Dict, key, params);
  }, [locale]);

  const value = useMemo<LocaleCtx>(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocale(): { locale: Locale; setLocale: (l: Locale) => void } {
  const c = useContext(Ctx);
  if (!c) throw new Error('useLocale must be used within LocaleProvider');
  return { locale: c.locale, setLocale: c.setLocale };
}

export function useT(): TFunc {
  const c = useContext(Ctx);
  if (!c) throw new Error('useT must be used within LocaleProvider');
  return c.t;
}
