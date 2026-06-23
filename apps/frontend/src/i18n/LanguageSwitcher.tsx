'use client';

// Переключатель языка EN/DE/RU. Два вида: 'topbar' (компактная кнопка-глобус с выпадающим меню) и
// 'settings' (подпись «Язык» + три пилюли). Меняет локаль через useLocale (persist в localStorage).
import { useEffect, useRef, useState } from 'react';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { useLocale, useT, LOCALES, type Locale } from './LocaleProvider';

const SHORT: Record<Locale, string> = { en: 'EN', de: 'DE', ru: 'RU' };

export default function LanguageSwitcher({ variant = 'topbar' }: { variant?: 'topbar' | 'settings' }) {
  const { locale, setLocale } = useLocale();
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc); };
  }, [open]);

  if (variant === 'settings') {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-muted"><Globe size={14} /> {t('lang.label')}</span>
        <div className="inline-flex rounded-lg border border-line bg-surface p-0.5">
          {LOCALES.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLocale(l)}
              aria-pressed={locale === l}
              className={['rounded-md px-2.5 h-7 text-[12.5px] font-semibold transition-colors', locale === l ? 'bg-brand-600 text-white' : 'text-ink-muted hover:bg-surface-2'].join(' ')}
            >
              {t(`lang.${l}`)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        data-testid="lang-switcher"
        aria-label={t('lang.label')}
        title={t('lang.label')}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-surface px-2 text-[12px] font-semibold text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <Globe size={14} strokeWidth={1.9} />
        <span>{SHORT[locale]}</span>
        <ChevronDown size={12} strokeWidth={2} className="text-ink-subtle" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-40 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-lg">
          <p className="px-3 pb-1 pt-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-subtle">{t('lang.label')}</p>
          {LOCALES.map((l) => (
            <button
              key={l}
              type="button"
              data-testid={`lang-option-${l}`}
              onClick={() => { setLocale(l); setOpen(false); }}
              className={['flex w-full items-center justify-between px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-surface-2', locale === l ? 'font-semibold text-brand-700' : 'text-ink'].join(' ')}
            >
              <span>{t(`lang.${l}`)}</span>
              {locale === l && <Check size={14} className="text-brand-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
