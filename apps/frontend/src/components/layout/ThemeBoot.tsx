'use client';

import { useEffect } from 'react';
import { bootTheme, syncThemeFromServer } from '@/lib/theme';

// M23-2: применяет кэш темы мгновенно (анти-FOUC), затем синхронизирует с сервером (source-of-truth).
export default function ThemeBoot() {
  useEffect(() => { bootTheme(); void syncThemeFromServer(); }, []);
  return null;
}
