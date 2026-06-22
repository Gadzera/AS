'use client';

/**
 * Appearance (M23-2, S374) — тема light/dark, per-user, persist на сервере. Меняет токены всего app-shell.
 */
import { useEffect, useState } from 'react';
import { Sun, Moon, Loader2 } from 'lucide-react';
import { getStoredTheme, setTheme, syncThemeFromServer, type Theme } from '@/lib/theme';

export default function AppearanceToggle() {
  const [theme, setLocal] = useState<Theme>('light');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setLocal(getStoredTheme()); syncThemeFromServer().then(setLocal); }, []);

  async function choose(t: Theme) {
    if (t === theme) return;
    if (t === 'dark') return; // тёмная тема в доработке — выбор временно недоступен
    setBusy(true); setLocal(t);
    try { await setTheme(t); } finally { setBusy(false); }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-2/40 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-ink">Theme</p>
        <p className="text-[11.5px] text-ink-muted">Applies across the whole app and syncs to your account.</p>
      </div>
      {busy && <Loader2 size={14} className="animate-spin text-ink-subtle" />}
      <div className="inline-flex rounded-lg border border-line bg-surface p-0.5">
        {(['light', 'dark'] as Theme[]).map((t) => {
          const disabled = t === 'dark'; // dark в доработке
          return (
            <button
              key={t}
              type="button"
              onClick={() => choose(t)}
              disabled={disabled}
              title={disabled ? 'Dark theme is being polished — coming soon' : undefined}
              className={['inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors', theme === t ? 'bg-brand-600 text-white shadow-brand' : 'text-ink-muted hover:text-ink', disabled ? 'cursor-not-allowed opacity-50 hover:text-ink-muted' : ''].join(' ')}
            >
              {t === 'light' ? <Sun size={13} /> : <Moon size={13} />} {t === 'light' ? 'Light' : 'Dark'}
              {disabled && <span className="ml-1 rounded bg-surface-2 px-1 py-px text-[9.5px] font-bold uppercase tracking-wide text-ink-subtle">Soon</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
