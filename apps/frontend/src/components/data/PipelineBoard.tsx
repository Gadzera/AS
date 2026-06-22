'use client';

/**
 * PipelineBoard — kanban PIPELINE-списка (LST-2).
 *
 * ОТЛИЧИЕ от DataHubBoard (M24-2): тот группирует по SELECT/USER-АТРИБУТУ ЗАПИСИ (record value).
 * Здесь колонки = LIST-LOCAL стадии (config.stages списка), а стадия карточки = ListEntry.stage —
 * это НЕ значение записи. Одна и та же запись может стоять в разных стадиях в разных pipeline-списках.
 * Drag-drop → onMove(recordId, toStage, toPosition) → PATCH /lists/:id/entries/:recordId/move (персист).
 * Никакого локального-только состояния: после PATCH стадия в БД; при ошибке родитель откатывает.
 */

import { useState } from 'react';
import type { DragEvent } from 'react';
import { GripVertical, Lock, Sparkles } from 'lucide-react';
import type { ListRecordEntry, PipelineStage } from '@/lib/crmApi';

const UNKNOWN = '__unknown__';

function valText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return String(o.displayName ?? o.name ?? o.label ?? o.value ?? '');
  }
  return String(v);
}

interface Props {
  stages: PipelineStage[];
  records: ListRecordEntry[];   // каждая со своим .stage (ListEntry.stage)
  canManage: boolean;
  busyId: string | null;
  onMove: (recordId: string, toStage: string, toPosition?: number) => void;
  onOpen: (recordId: string) => void;
}

export default function PipelineBoard({ stages, records, canManage, busyId, onMove, onOpen }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overLane, setOverLane] = useState<string | null>(null);

  const stageKeys = new Set(stages.map((s) => s.key));
  // карточки без валидной стадии (null / legacy / удалённая стадия) → лейн «Unknown stage», карточки НЕ теряем
  const hasUnknown = records.some((r) => !r.stage || !stageKeys.has(r.stage));
  const lanes: { key: string; label: string; color?: string | null; unknown?: boolean }[] = [
    ...stages.map((s) => ({ key: s.key, label: s.label, color: s.color })),
    ...(hasUnknown ? [{ key: UNKNOWN, label: 'Unknown stage', color: '#f59e0b', unknown: true }] : []),
  ];

  const laneOf = (r: ListRecordEntry) => (r.stage && stageKeys.has(r.stage) ? r.stage : UNKNOWN);
  const cardsIn = (laneKey: string) => records.filter((r) => laneOf(r) === laneKey);
  // вторичная строка карточки: первое непустое не-name значение
  const subOf = (r: ListRecordEntry): string => {
    for (const [k, v] of Object.entries(r.values ?? {})) { if (k !== 'name') { const t = valText(v); if (t) return t; } }
    return '';
  };

  function onDragStart(e: DragEvent, id: string) {
    if (!canManage) { e.preventDefault(); return; }
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', id); } catch { /* noop */ }
  }
  function resolveId(e: DragEvent): string | null {
    let id = dragId;
    if (!id) { try { id = e.dataTransfer.getData('text/plain') || null; } catch { /* noop */ } }
    return id;
  }
  // drop на колонку = в конец стадии (append); drop на карточку = вставить ПЕРЕД ней (её индекс)
  function dropToLane(e: DragEvent, laneKey: string) {
    e.preventDefault(); e.stopPropagation();
    setOverLane(null);
    const id = resolveId(e); setDragId(null);
    if (!canManage || !id || laneKey === UNKNOWN) return; // в Unknown переносить нельзя — это служебный лейн
    onMove(id, laneKey); // position omitted → append
  }
  function dropToCard(e: DragEvent, laneKey: string, index: number) {
    e.preventDefault(); e.stopPropagation();
    setOverLane(null);
    const id = resolveId(e); setDragId(null);
    if (!canManage || !id || laneKey === UNKNOWN) return;
    // off-by-one: бэкенд вставляет в колонку БЕЗ перетаскиваемой карты. Если тащим ВНИЗ внутри той же
    // стадии (источник выше цели), индекс цели в массиве-без-себя на 1 меньше → шлём index-1, чтобы
    // карта встала ИМЕННО перед целевой (а не после неё).
    const laneCards = cardsIn(laneKey);
    const fromIdx = laneCards.findIndex((c) => c.id === id);
    const pos = fromIdx !== -1 && fromIdx < index ? index - 1 : index;
    onMove(id, laneKey, pos);
  }

  return (
    <div className="flex h-full min-h-0 gap-3 overflow-x-auto p-4">
      {lanes.map((lane) => {
        const cards = cardsIn(lane.key);
        const isOver = overLane === lane.key;
        const droppable = canManage && !lane.unknown;
        return (
          <div
            key={lane.key}
            data-lane={lane.key}
            onDragOver={(e) => { if (droppable) { e.preventDefault(); setOverLane(lane.key); } }}
            onDragLeave={() => setOverLane((p) => (p === lane.key ? null : p))}
            onDrop={(e) => dropToLane(e, lane.key)}
            className={[
              'flex w-[280px] shrink-0 flex-col rounded-xl border bg-surface-2/40 transition-colors',
              isOver ? 'border-brand-400 bg-brand-50/50 ring-2 ring-brand-200' : lane.unknown ? 'border-amber-200' : 'border-line',
            ].join(' ')}
          >
            <div className="flex items-center gap-2 border-b border-line px-3 py-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-inset ring-white/40" style={{ backgroundColor: lane.color ?? '#94a3b8' }} />
              <span className="truncate text-[12.5px] font-bold text-ink">{lane.label}</span>
              <span className="ml-auto rounded-full bg-surface px-1.5 py-0.5 text-[10.5px] font-bold text-ink-subtle ring-1 ring-inset ring-line">{cards.length}</span>
            </div>

            <div className="flex min-h-[140px] flex-1 flex-col gap-2 overflow-y-auto p-2">
              {lane.unknown && (
                <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50/60 px-2 py-1.5 text-[10.5px] text-amber-700">These records sit in a stage that no longer exists. Drag them into a valid stage, or fix the entry.</p>
              )}
              {cards.length === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-line py-6 text-center text-[11px] text-ink-subtle">
                  {isOver ? 'Drop here' : 'No records here'}
                </div>
              ) : (
                cards.map((rec, idx) => {
                  const moving = busyId === rec.id;
                  const sub = subOf(rec);
                  return (
                    <div
                      key={rec.id}
                      data-card={rec.id}
                      draggable={canManage && !moving}
                      onDragStart={(e) => onDragStart(e, rec.id)}
                      onDragEnd={() => { setDragId(null); setOverLane(null); }}
                      onDragOver={(e) => { if (droppable) { e.preventDefault(); e.stopPropagation(); setOverLane(lane.key); } }}
                      onDrop={(e) => dropToCard(e, lane.key, idx)}
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
                          <p className="truncate text-[12.5px] font-bold text-ink hover:text-brand-700 hover:underline">{rec.displayName || 'Record'}</p>
                          {sub && <p className="mt-0.5 truncate text-[11px] text-ink-muted">{sub}</p>}
                        </button>
                        {moving && <span className="mt-0.5 h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600" />}
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
          <span className="inline-flex items-center gap-1 rounded-md bg-surface px-2 py-1 text-[10.5px] font-medium text-ink-subtle ring-1 ring-inset ring-line"><Lock size={10} /> View-only — you can&apos;t move cards</span>
        </div>
      )}
      <div className="flex shrink-0 items-start pt-2">
        <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-1 text-[10.5px] font-medium text-violet-700 ring-1 ring-inset ring-violet-200"><Sparkles size={10} /> Stages are local to this list</span>
      </div>
    </div>
  );
}
