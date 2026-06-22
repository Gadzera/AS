'use client';

/**
 * CommandPalette (⌘K) — «Ask the agent» / глобальный поиск.
 *
 * Открывается по ⌘K / Ctrl+K и из Sidebar (кнопки «Ask the agent» и поиск).
 * Возможности:
 *  - Навигация по всем экранам
 *  - Быстрые действия (новая кампания / запись, конфиг AI-полей …)
 *  - ЖИВОЙ глобальный поиск через GET /api/search (RBAC/org-scoped):
 *    leads → Lead 360, records → Data Hub, campaigns → Sequences, meetings, calls.
 *
 * Монтируется один раз в DashboardLayout.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Gauge, Radar, Send, Inbox, CalendarCheck, FlaskConical, BookOpenCheck,
  GraduationCap, Database, Settings, Plus, Sparkles, Search, CornerDownLeft,
  Building2, User, ArrowRight, Loader2, Phone, ListChecks, Bell,
} from 'lucide-react';
import clsx from 'clsx';
import { usePalette } from '@/lib/paletteStore';
import { searchApi, type SearchGroup, type SearchHit } from '@/lib/api';

interface Cmd {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  group: string;
  keywords?: string;
  run: () => void;
}

const NAV: { href: string; label: string; icon: React.ReactNode }[] = [
  { href: '/dashboard', label: 'Agent Cockpit', icon: <Gauge size={15} /> },
  { href: '/pipeline', label: 'Pipeline Radar', icon: <Radar size={15} /> },
  { href: '/campaigns', label: 'Outreach Studio', icon: <Send size={15} /> },
  { href: '/sequences', label: 'Sequences', icon: <ListChecks size={15} /> },
  { href: '/replies', label: 'Replies', icon: <Inbox size={15} /> },
  { href: '/meetings', label: 'Meetings', icon: <CalendarCheck size={15} /> },
  { href: '/calls', label: 'Calls', icon: <Phone size={15} /> },
  { href: '/notifications', label: 'Notifications', icon: <Bell size={15} /> },
  { href: '/research', label: 'Research Lab', icon: <FlaskConical size={15} /> },
  { href: '/playbooks', label: 'Playbooks', icon: <BookOpenCheck size={15} /> },
  { href: '/learning', label: 'Learning', icon: <GraduationCap size={15} /> },
  { href: '/reports', label: 'Reports', icon: <Gauge size={15} /> },
  { href: '/data', label: 'Data Hub', icon: <Database size={15} /> },
  { href: '/settings', label: 'Settings', icon: <Settings size={15} /> },
];

// Иконка результата поиска по типу сущности.
function hitIcon(type: string): React.ReactNode {
  switch (type) {
    case 'lead': return <User size={15} />;
    case 'record': return <Building2 size={15} />;
    case 'campaign': return <Send size={15} />;
    case 'meeting': return <CalendarCheck size={15} />;
    case 'call': return <Phone size={15} />;
    default: return <Search size={15} />;
  }
}

export default function CommandPalette() {
  const { isOpen, open, close } = usePalette();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // ⌘K / Ctrl+K — глобальный тумблер. Esc — закрыть.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        isOpen ? close() : open();
      }
      if (e.key === 'Escape' && isOpen) close();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, open, close]);

  // Сброс при открытии + фокус
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setCursor(0);
      setGroups([]);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [isOpen]);

  // Живой глобальный поиск (один RBAC-эндпоинт), debounce
  useEffect(() => {
    const q = query.trim();
    if (!isOpen || q.length < 2) {
      setGroups([]);
      setSearching(false);
      return;
    }
    let alive = true;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await searchApi.global(q, 6);
        if (alive) setGroups(r.groups);
      } catch {
        if (alive) setGroups([]);
      } finally {
        if (alive) setSearching(false);
      }
    }, 220);
    return () => { alive = false; clearTimeout(t); };
  }, [query, isOpen]);

  const go = useCallback((href: string) => { router.push(href); close(); }, [router, close]);

  // Открыть результат поиска по deep-link. Для записи — ещё событие, чтобы /data
  // открыл дровер, даже если страница уже смонтирована.
  const openHit = useCallback((type: string, hit: SearchHit) => {
    router.push(hit.href);
    if (type === 'record') {
      const qs = new URLSearchParams(hit.href.split('?')[1] || '');
      const object = qs.get('object'); const record = qs.get('record');
      if (object && record) window.dispatchEvent(new CustomEvent('data:open-record', { detail: { object, record } }));
    }
    close();
  }, [router, close]);

  // Статические команды
  const actions: Cmd[] = useMemo(() => [
    { id: 'a-campaign', group: 'Actions', label: 'New campaign', hint: 'Outreach Studio', icon: <Send size={15} />, keywords: 'campaign new создать кампания', run: () => { router.push('/campaigns?new=1'); window.dispatchEvent(new CustomEvent('campaigns:new')); close(); } },
    { id: 'a-record', group: 'Actions', label: 'New record', hint: 'Data Hub', icon: <Plus size={15} />, keywords: 'record new создать запись компания', run: () => { router.push('/data?new=1'); window.dispatchEvent(new CustomEvent('data:new-record')); close(); } },
    { id: 'a-ai', group: 'Actions', label: 'Configure AI fields', hint: 'Settings → Objects', icon: <Sparkles size={15} />, keywords: 'ai field attribute настроить поле объект', run: () => go('/settings/objects') },
    { id: 'a-research', group: 'Actions', label: 'Run research agent', hint: 'Data Hub', icon: <FlaskConical size={15} />, keywords: 'research enrich исследование агент', run: () => go('/data') },
  ], [router, close, go]);

  const navCmds: Cmd[] = useMemo(
    () => NAV.map((n) => ({ id: `nav-${n.href}`, group: 'Navigate', label: n.label, icon: n.icon, keywords: n.label, run: () => go(n.href) })),
    [go],
  );

  // Фильтрация статических команд
  const q = query.trim().toLowerCase();
  const staticMatches = useMemo(() => {
    const all = [...actions, ...navCmds];
    if (!q) return all;
    return all.filter((c) => `${c.label} ${c.keywords ?? ''}`.toLowerCase().includes(q));
  }, [actions, navCmds, q]);

  // Команды из результатов поиска
  const hitCmds: Cmd[] = useMemo(
    () => groups.flatMap((g) => g.items.map((h) => ({
      id: `hit-${g.type}-${h.id}`,
      group: g.label,
      label: h.title,
      hint: h.subtitle ?? undefined,
      icon: hitIcon(g.type),
      run: () => openHit(g.type, h),
    }))),
    [groups, openHit],
  );

  const items = useMemo(() => [...staticMatches, ...hitCmds], [staticMatches, hitCmds]);

  // Держим курсор в пределах
  useEffect(() => { setCursor((c) => Math.min(c, Math.max(0, items.length - 1))); }, [items.length]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); items[cursor]?.run(); }
  }

  // Скролл к активному
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${cursor}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  // Группировка для рендера с сохранением общего индекса. Сначала статические
  // группы, затем динамические группы поиска в порядке выдачи бэкенда.
  const grouped = useMemo(() => {
    const dynamicOrder = groups.map((g) => g.label);
    const order = ['Actions', 'Navigate', ...dynamicOrder];
    const map = new Map<string, { cmd: Cmd; idx: number }[]>();
    items.forEach((cmd, idx) => {
      const list = map.get(cmd.group) ?? [];
      list.push({ cmd, idx });
      map.set(cmd.group, list);
    });
    return order.filter((g, i) => order.indexOf(g) === i && map.has(g)).map((g) => ({ group: g, entries: map.get(g)! }));
  }, [items, groups]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={close} />
          <motion.div
            className="relative w-full max-w-[600px] overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ type: 'spring', stiffness: 460, damping: 34 }}
          >
            {/* Поле ввода */}
            <div className="flex items-center gap-2.5 border-b border-line px-4">
              <Sparkles size={16} className="shrink-0 text-brand-500" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
                onKeyDown={onKeyDown}
                placeholder="Ask the agent or find a lead, record, campaign, meeting…"
                className="h-12 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-subtle"
              />
              {searching && <Loader2 size={14} className="shrink-0 animate-spin text-ink-subtle" />}
              <kbd className="hidden shrink-0 rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-ink-subtle sm:block">esc</kbd>
            </div>

            {/* Список */}
            <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-1.5">
              {items.length === 0 ? (
                <div className="flex flex-col items-center gap-1.5 py-10 text-ink-subtle">
                  <Search size={20} />
                  <p className="text-[13px]">{q.length >= 2 ? `No results for “${query}”` : 'Start typing to search…'}</p>
                </div>
              ) : (
                grouped.map(({ group, entries }) => (
                  <div key={group} className="mb-1">
                    <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-subtle">{group}</p>
                    {entries.map(({ cmd, idx }) => {
                      const active = idx === cursor;
                      return (
                        <button
                          key={cmd.id}
                          data-idx={idx}
                          type="button"
                          onMouseEnter={() => setCursor(idx)}
                          onClick={() => cmd.run()}
                          className={clsx(
                            'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                            active ? 'bg-brand-50 text-ink' : 'text-ink-muted hover:bg-surface-2',
                          )}
                        >
                          <span className={clsx('shrink-0', active ? 'text-brand-600' : 'text-ink-subtle')}>{cmd.icon}</span>
                          <span className="flex-1 truncate text-[13px] font-medium text-ink">{cmd.label}</span>
                          {cmd.hint && <span className="ml-2 max-w-[40%] shrink-0 truncate text-[11px] text-ink-subtle">{cmd.hint}</span>}
                          {active ? (
                            <CornerDownLeft size={13} className="shrink-0 text-brand-500" />
                          ) : (
                            <ArrowRight size={13} className="shrink-0 text-transparent" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Подвал */}
            <div className="flex items-center justify-between border-t border-line px-4 py-2 text-[11px] text-ink-subtle">
              <span className="inline-flex items-center gap-1.5"><Sparkles size={11} className="text-brand-500" /> AISDR Agent</span>
              <span className="inline-flex items-center gap-2">
                <span className="inline-flex items-center gap-1"><kbd className="rounded border border-line bg-surface-2 px-1">↑</kbd><kbd className="rounded border border-line bg-surface-2 px-1">↓</kbd> navigate</span>
                <span className="inline-flex items-center gap-1"><kbd className="rounded border border-line bg-surface-2 px-1">↵</kbd> select</span>
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
