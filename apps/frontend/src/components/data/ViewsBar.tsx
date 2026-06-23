'use client';

/**
 * ViewsBar — настоящий селектор представлений (M5/V1) для Data Hub.
 *
 * Что делает (всё на ЖИВОМ backend, без mock):
 *  • «All records» (системное) + список сохранённых Views объекта (из БД).
 *  • Выбор Views → страница применяет его filters/sorts/columns к реальным записям
 *    через backend (counts синхронны: бейдж = backend total).
 *  • «Unsaved changes» когда текущий запрос отличается от сохранённого вида:
 *      – активен сохранённый вид → «Save» (updateView, персист в БД);
 *      – активен All records → «Save as view» (createView).
 *      – «Reset» возвращает к сохранённому состоянию.
 *  • Каждый сохранённый вид: переименование (updateView name) и удаление (deleteView).
 *  • Создание нового вида из текущего запроса (имя → createView).
 *
 * RBAC (V1-заглушка под будущий V3): если canManage=false (MEMBER без прав) —
 * управление общими видами скрыто, выбор/просмотр остаётся.
 */

import { useEffect, useRef, useState } from 'react';
import { Layers, Plus, Check, X, MoreHorizontal, Pencil, Trash2, Save, RotateCcw, Lock, Users } from 'lucide-react';

import clsx from 'clsx';
import type { CrmView, CrmViewScope } from '@/lib/crmApi';
import { useT } from '@/i18n';

interface Props {
  views: CrmView[];                       // сохранённые (не-default) виды объекта
  activeViewId: string | null;            // null = All records
  dirty: boolean;                         // текущий запрос отличается от сохранённого вида
  dirtySummary: string;                   // что именно изменилось: 'columns' | 'filters' | 'sort' | 'columns · sort' | 'changes'
  canManage: boolean;                     // RBAC: можно ли создавать/менять/удалять виды
  onSelect: (id: string | null) => void;  // null = All records
  onSaveNew: (name: string, scope: CrmViewScope) => void; // создать вид из текущего запроса (personal/shared)
  onUpdate: () => void;                   // обновить активный вид текущим запросом
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onShare: (id: string, scope: CrmViewScope) => void; // M24-2: сделать вид shared/private
  onReset: () => void;                    // отменить несохранённые изменения
}

export default function ViewsBar({
  views, activeViewId, dirty, dirtySummary, canManage,
  onSelect, onSaveNew, onUpdate, onRename, onDelete, onShare, onReset,
}: Props) {
  const t = useT();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newScope, setNewScope] = useState<CrmViewScope>('personal');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuId) return;
    function h(e: MouseEvent) { if (barRef.current && !barRef.current.contains(e.target as Node)) setMenuId(null); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [menuId]);

  const pill = (active: boolean) =>
    clsx('inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-semibold transition-colors',
      active ? 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100' : 'text-ink-muted hover:bg-surface-2 hover:text-ink');

  function commitNew() {
    const n = newName.trim();
    if (n) onSaveNew(n, newScope);
    setNewName(''); setCreating(false);
  }
  function commitRename(id: string) {
    const n = renameVal.trim();
    if (n) onRename(id, n);
    setRenameId(null); setRenameVal('');
  }

  return (
    <div ref={barRef} className="flex h-11 shrink-0 items-center gap-1 overflow-visible border-b border-line bg-surface px-4">
      <span className="mr-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-subtle"><Layers size={12} /> {t('data.views.bar')}</span>

      {/* All records (системный) */}
      <button type="button" onClick={() => onSelect(null)} className={pill(activeViewId === null)}>{t('data.views.allRecords')}</button>

      {/* сохранённые виды */}
      <div className="flex items-center gap-1 overflow-x-auto">
        {views.map((v) => {
          const active = v.id === activeViewId;
          const meta = (v.filters?.length ?? 0) + (v.sorts?.length ?? 0);
          if (renameId === v.id) {
            return (
              <span key={v.id} className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-1.5 py-0.5 ring-1 ring-inset ring-brand-200">
                <input
                  autoFocus value={renameVal}
                  onChange={(e) => setRenameVal(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitRename(v.id); if (e.key === 'Escape') { setRenameId(null); setRenameVal(''); } }}
                  className="h-6 w-28 rounded border border-line bg-surface px-1.5 text-[12px] text-ink outline-none focus:border-brand-500"
                />
                <button type="button" onClick={() => commitRename(v.id)} className="text-emerald-600 hover:text-emerald-700"><Check size={13} /></button>
                <button type="button" onClick={() => { setRenameId(null); setRenameVal(''); }} className="text-ink-subtle hover:text-rose-500"><X size={13} /></button>
              </span>
            );
          }
          return (
            <span key={v.id} className="relative inline-flex items-center">
              <button type="button" onClick={() => onSelect(v.id)} className={pill(active)} title={`${v.scope === 'shared' ? t('data.views.sharedWithWorkspace') : t('data.views.privateToYou')} · ${t('data.views.filtersN', { count: v.filters?.length ?? 0 })} · ${t('data.views.sortsN', { count: v.sorts?.length ?? 0 })}`}>
                {v.scope === 'shared' ? <Users size={11} className={active ? 'text-brand-600' : 'text-ink-subtle'} /> : <Lock size={11} className={active ? 'text-brand-600' : 'text-ink-subtle'} />} {v.name}
                {meta > 0 && <span className={clsx('rounded-full px-1 text-[10px] font-bold', active ? 'bg-brand-100 text-brand-700' : 'bg-surface-2 text-ink-subtle')}>{meta}</span>}
              </button>
              {canManage && (
                <button type="button" onClick={() => setMenuId(menuId === v.id ? null : v.id)} className="ml-0.5 rounded p-0.5 text-ink-subtle hover:bg-surface-2 hover:text-ink" title={t('data.views.viewOptions')}><MoreHorizontal size={13} /></button>
              )}
              {menuId === v.id && (
                <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-44 rounded-lg border border-line bg-surface p-1 shadow-xl">
                  <button type="button" onClick={() => { setMenuId(null); setRenameId(v.id); setRenameVal(v.name); }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-ink hover:bg-surface-2"><Pencil size={12} /> {t('data.views.rename')}</button>
                  {v.scope === 'shared' ? (
                    <button type="button" onClick={() => { setMenuId(null); onShare(v.id, 'personal'); }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-ink hover:bg-surface-2"><Lock size={12} /> {t('data.views.makePrivate')}</button>
                  ) : (
                    <button type="button" onClick={() => { setMenuId(null); onShare(v.id, 'shared'); }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-ink hover:bg-surface-2"><Users size={12} /> {t('data.views.shareWithWorkspace')}</button>
                  )}
                  <button type="button" onClick={() => { setMenuId(null); onDelete(v.id); }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-rose-600 hover:bg-rose-50"><Trash2 size={12} /> {t('data.views.deleteView')}</button>
                </div>
              )}
            </span>
          );
        })}
      </div>

      {/* создать новый вид */}
      {canManage && (creating ? (
        <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-1.5 py-0.5 ring-1 ring-inset ring-brand-200">
          <input
            autoFocus value={newName} placeholder={t('data.views.viewName')}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commitNew(); if (e.key === 'Escape') { setCreating(false); setNewName(''); } }}
            className="h-6 w-28 rounded border border-line bg-surface px-1.5 text-[12px] text-ink outline-none focus:border-brand-500"
          />
          {/* scope: personal (приватно создателю) | shared (всему workspace с READ к источнику) */}
          <span className="inline-flex items-center rounded border border-line bg-surface p-0.5" title={t('data.views.whoCanSee')}>
            {(['personal', 'shared'] as const).map((s) => (
              <button key={s} type="button" onClick={() => setNewScope(s)} className={clsx('inline-flex h-5 items-center gap-0.5 rounded px-1 text-[10px] font-bold transition-colors', newScope === s ? 'bg-brand-600 text-white' : 'text-ink-subtle hover:text-ink')}>
                {s === 'personal' ? <Lock size={9} /> : <Users size={9} />}{s === 'personal' ? t('data.views.private') : t('data.views.shared')}
              </button>
            ))}
          </span>
          <button type="button" onClick={commitNew} className="text-emerald-600 hover:text-emerald-700"><Check size={13} /></button>
          <button type="button" onClick={() => { setCreating(false); setNewName(''); }} className="text-ink-subtle hover:text-rose-500"><X size={13} /></button>
        </span>
      ) : (
        <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold text-brand-700 hover:bg-brand-50"><Plus size={12} /> {t('data.views.newView')}</button>
      ))}

      {!canManage && (
        <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-ink-subtle" title={t('data.views.membersUseShared')}><Lock size={10} /> {t('data.views.viewOnly')}</span>
      )}

      {/* несохранённые изменения */}
      {dirty && (
        <div className="ml-auto flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> {t('data.views.unsaved')}{dirtySummary ? ` · ${dirtySummary}` : ` ${t('data.views.changesWord')}`}
          </span>
          {canManage && (activeViewId ? (
            <button type="button" onClick={onUpdate} className="inline-flex h-7 items-center gap-1 rounded-md bg-brand-600 px-2.5 text-[11.5px] font-semibold text-white hover:bg-brand-700"><Save size={12} /> {t('data.views.save')}</button>
          ) : (
            <button type="button" onClick={() => setCreating(true)} className="inline-flex h-7 items-center gap-1 rounded-md bg-brand-600 px-2.5 text-[11.5px] font-semibold text-white hover:bg-brand-700"><Plus size={12} /> {t('data.saveAsView')}</button>
          ))}
          <button type="button" onClick={onReset} className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-surface px-2 text-[11.5px] font-medium text-ink-muted hover:bg-surface-2"><RotateCcw size={11} /> {t('data.views.reset')}</button>
        </div>
      )}
    </div>
  );
}
