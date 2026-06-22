'use client';

/**
 * DataHubBoard — board/kanban (M5/V2) для Data Hub.
 * Группирует реальные записи объекта по SELECT-атрибуту (например Deals → stage).
 * Колонки строятся из AttributeOption (порядок/цвет/лейбл) + «Unassigned» для пустых.
 * Drag-drop карточки между колонками → onMove(recordId, from, to) (родитель пишет stage в БД).
 * Никакого локального-только состояния: после успешного PATCH стадия сохранена; при ошибке родитель откатывает.
 */

import { useState } from 'react';
import type { DragEvent } from 'react';
import { Building2, User as UserIcon, GripVertical, Lock } from 'lucide-react';
import type { CrmRecord, CrmAttribute, CrmAttributeOption } from '@/lib/crmApi';

const COLOR_DOT: Record<string, string> = {
  gray: 'bg-ink-subtle', slate: 'bg-slate-400', blue: 'bg-blue-500', sky: 'bg-sky-500', cyan: 'bg-cyan-500',
  purple: 'bg-violet-500', violet: 'bg-violet-500', pink: 'bg-pink-500', fuchsia: 'bg-fuchsia-500',
  yellow: 'bg-amber-500', amber: 'bg-amber-500', orange: 'bg-orange-500', green: 'bg-emerald-500',
  emerald: 'bg-emerald-500', red: 'bg-rose-500', rose: 'bg-rose-500', indigo: 'bg-brand-500',
};
const colorDot = (c?: string | null) => COLOR_DOT[c ?? ''] ?? 'bg-ink-subtle';
const colorRing: Record<string, string> = {
  gray: 'ring-ink-subtle/30', blue: 'ring-blue-300', purple: 'ring-violet-300', violet: 'ring-violet-300',
  yellow: 'ring-amber-300', amber: 'ring-amber-300', orange: 'ring-orange-300', green: 'ring-emerald-300',
  emerald: 'ring-emerald-300', red: 'ring-rose-300', rose: 'ring-rose-300',
};

// значение SELECT в записи: бэкенд отдаёт {value,label,color} либо строку
export function recordSelectValue(rec: CrmRecord, key: string): string | null {
  const v = (rec.values || {})[key];
  if (v == null) return null;
  if (typeof v === 'string') return v || null;
  if (typeof v === 'object' && 'value' in (v as Record<string, unknown>)) {
    const val = (v as Record<string, unknown>).value;
    return typeof val === 'string' ? val : null;
  }
  return null;
}

function fmtMoney(v: unknown): string | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const amount = typeof o.amount === 'number' ? o.amount : typeof o.amount === 'string' ? Number(o.amount) : NaN;
  if (!Number.isFinite(amount)) return null;
  const ccy = typeof o.currencyCode === 'string' ? o.currencyCode : 'USD';
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: ccy, maximumFractionDigits: 0 }).format(amount); }
  catch { return `${amount}`; }
}

function relName(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'object') { const o = v as Record<string, unknown>; return (o.displayName as string) || (o.name as string) || null; }
  return null;
}

function ageLabel(iso?: string): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const days = Math.floor((Date.now() - t) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return '1d';
  if (days < 30) return `${days}d`;
  const m = Math.floor(days / 30);
  return `${m}mo`;
}

interface Lane { value: string | null; label: string; color?: string | null }

// M24-2: значение группировки для USER-атрибута (сериализуется как {id,name,email}).
function recordUserValue(rec: CrmRecord, key: string): string | null {
  const v = (rec.values || {})[key];
  if (v == null) return null;
  if (typeof v === 'string') return v || null;
  if (typeof v === 'object' && 'id' in (v as Record<string, unknown>)) {
    const id = (v as Record<string, unknown>).id;
    return typeof id === 'string' ? id : null;
  }
  return null;
}

interface Props {
  records: CrmRecord[];
  groupAttr: CrmAttribute;        // SELECT (options) или USER-атрибут группировки
  userOptions?: { value: string; label: string }[]; // M24-2: участники org — колонки для board-by-USER
  canManage: boolean;             // RBAC: можно ли двигать карточки
  busyId: string | null;          // запись в процессе PATCH (визуальный лок)
  onMove: (recordId: string, from: string | null, to: string | null) => void;
  onOpen: (recordId: string) => void;
}

export default function DataHubBoard({ records, groupAttr, userOptions, canManage, busyId, onMove, onOpen }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<string | null>(null);
  const [overLane, setOverLane] = useState<string | null>(null);

  const isUser = groupAttr.type === 'USER';
  // адверс M3: при USER-группировке значение, которого нет среди колонок (деактивированный/удалённый
  // участник), сворачиваем в «No stage» — иначе карточка исчезает и ломается инвариант cards=total.
  const knownUserIds = new Set((userOptions ?? []).map((u) => u.value));
  const valueOf = (r: CrmRecord): string | null => {
    if (!isUser) return recordSelectValue(r, groupAttr.key);
    const id = recordUserValue(r, groupAttr.key);
    return id && knownUserIds.has(id) ? id : null;
  };

  const options: CrmAttributeOption[] = (groupAttr.options ?? []).filter((o) => o && o.value != null);
  const baseLanes: Lane[] = isUser
    ? (userOptions ?? []).map((u) => ({ value: u.value, label: u.label, color: 'indigo' as string | null }))
    : options.map((o) => ({ value: o.value as string, label: o.label || (o.value as string), color: o.color }));
  // «No stage» — ВСЕГДА присутствует как drop-таргет (drag сюда = очистка значения, M24-2); required-атрибут backend отклонит 422.
  const lanes: Lane[] = [
    ...baseLanes,
    { value: null as string | null, label: 'No stage', color: 'gray' as string | null },
  ];

  const byLane = (laneVal: string | null) => records.filter((r) => valueOf(r) === laneVal);
  const laneKey = (v: string | null) => v ?? '__none__';

  function onDragStart(e: DragEvent, rec: CrmRecord) {
    if (!canManage) { e.preventDefault(); return; }
    setDragId(rec.id);
    setDragFrom(valueOf(rec));
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', rec.id); } catch { /* noop */ }
  }
  function onDropLane(e: DragEvent, laneVal: string | null) {
    e.preventDefault();
    setOverLane(null);
    let id = dragId;
    if (!id) { try { id = e.dataTransfer.getData('text/plain') || null; } catch { /* noop */ } }
    setDragId(null); setDragFrom(null);
    if (!canManage || !id) return;
    // текущую стадию берём из самой записи (надёжнее, чем drag-state)
    const rec = records.find((r) => r.id === id);
    const cur = rec ? valueOf(rec) : dragFrom;
    if (cur === laneVal) return; // та же колонка — ничего не делаем
    onMove(id, cur, laneVal);
  }

  return (
    <div className="flex h-full min-h-0 gap-3 overflow-x-auto p-4">
      {lanes.map((lane) => {
        const cards = byLane(lane.value);
        const isOver = overLane === laneKey(lane.value);
        return (
          <div
            key={laneKey(lane.value)}
            data-lane={laneKey(lane.value)}
            onDragOver={(e) => { if (canManage) { e.preventDefault(); setOverLane(laneKey(lane.value)); } }}
            onDragLeave={() => setOverLane((p) => (p === laneKey(lane.value) ? null : p))}
            onDrop={(e) => onDropLane(e, lane.value)}
            className={[
              'flex w-[280px] shrink-0 flex-col rounded-xl border bg-surface-2/40 transition-colors',
              isOver ? 'border-brand-400 bg-brand-50/50 ring-2 ring-brand-200' : 'border-line',
            ].join(' ')}
          >
            {/* lane header */}
            <div className="flex items-center gap-2 border-b border-line px-3 py-2">
              <span className={`h-2 w-2 shrink-0 rounded-full ${colorDot(lane.color)}`} />
              <span className="truncate text-[12.5px] font-bold text-ink">{lane.label}</span>
              <span className="ml-auto rounded-full bg-surface px-1.5 py-0.5 text-[10.5px] font-bold text-ink-subtle ring-1 ring-inset ring-line">{cards.length}</span>
            </div>

            {/* cards */}
            <div className="flex min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto p-2">
              {cards.length === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-line py-6 text-center text-[11px] text-ink-subtle">
                  {isOver ? 'Drop here' : 'No records here'}
                </div>
              ) : (
                cards.map((rec) => {
                  const v = rec.values || {};
                  const title = rec.displayName || (typeof v.name === 'string' ? v.name : 'Untitled');
                  const company = relName(v.company);
                  const money = fmtMoney(v.value);
                  const owner = relName(v.owner);
                  const age = ageLabel(rec.updatedAt as unknown as string);
                  const moving = busyId === rec.id;
                  return (
                    <div
                      key={rec.id}
                      data-card={rec.id}
                      draggable={canManage && !moving}
                      onDragStart={(e) => onDragStart(e, rec)}
                      onDragEnd={() => { setDragId(null); setOverLane(null); }}
                      className={[
                        'group rounded-lg border border-line bg-surface p-2.5 shadow-xs transition-all',
                        canManage ? 'cursor-grab active:cursor-grabbing hover:-translate-y-0.5 hover:shadow-md' : 'cursor-default',
                        dragId === rec.id ? 'opacity-40' : '',
                        moving ? 'ring-2 ring-brand-200' : '',
                      ].join(' ')}
                    >
                      <div className="flex items-start gap-1.5">
                        {canManage && <GripVertical size={13} className="mt-0.5 shrink-0 text-ink-subtle opacity-0 transition-opacity group-hover:opacity-100" />}
                        <button type="button" onClick={() => onOpen(rec.id)} className="min-w-0 flex-1 text-left">
                          <p className="truncate text-[12.5px] font-bold text-ink hover:text-brand-700 hover:underline">{title}</p>
                          {company && <p className="mt-0.5 inline-flex items-center gap-1 truncate text-[11px] text-ink-muted"><Building2 size={10} className="text-ink-subtle" /> {company}</p>}
                        </button>
                        {moving && <span className="mt-0.5 h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600" />}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        {money && <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700">{money}</span>}
                        {owner && <span className="inline-flex items-center gap-1 text-[10.5px] text-ink-subtle"><UserIcon size={9} /> {owner}</span>}
                        {age && <span className="ml-auto text-[10px] text-ink-subtle" title="Last activity">{age}</span>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}

      {!canManage && (
        <div className="flex shrink-0 items-start pt-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-surface px-2 py-1 text-[10.5px] font-medium text-ink-subtle ring-1 ring-inset ring-line"><Lock size={10} /> View-only — members can't move deals</span>
        </div>
      )}
    </div>
  );
}
